import {Timestamp} from "firebase-admin/firestore";
import {HttpsError,onCall} from "firebase-functions/v2/https";
import {requireAdmin} from "../../auth/authorization.js";
import {db} from "../../config/firebase.js";
import {callableOptions} from "../../config/runtime.js";
import {collections} from "../../domain/collections.js";
import type {GameConfiguration} from "../../domain/types.js";
import {assertScoringRoster,scoringSlotId,seasonScoringSnapshot,validateSeasonScoringRules} from "../../engines/seasonPoints.js";
import {reserveIdempotencyKey} from "../../services/idempotency.js";
import {writeAdminAudit} from "../../services/audit.js";
import {warmupWindow} from "../../services/eventTiming.js";
interface Input {requestId:string;eventId:string;pairs:Array<[string,string]>;gameConfig:GameConfiguration;}
/** Designated pre-event pairings do not require main-evening attendance check-in. */
export const adminCreateEventWarmups=onCall<Input>(callableOptions,async request=>{
  const actor=await requireAdmin(request),input=request.data;
  if(!input.eventId||!Array.isArray(input.pairs)||!input.pairs.length||input.pairs.length>50||
    !input.gameConfig?.maps||!input.gameConfig?.victory||!input.gameConfig?.civilizations||
    input.gameConfig.civilizations.mode==="DRAFT") {
    throw new HttpsError("invalid-argument","Provide Event, 1v1 pairs and a nondraft warm-up configuration.");
  }
  const ids=input.pairs.flat();
  try {
    for(const pair of input.pairs) {
      if(!Array.isArray(pair)||pair.length!==2)throw new Error("Each warm-up pair requires two players.");
      assertScoringRoster(pair.map((playerId,index)=>({playerId,slot:index+1,team:index+1})));
    }
    if(new Set(ids).size!==ids.length)throw new Error("Each player may have one warm-up per Event.");
  }catch(error){throw new HttpsError("invalid-argument",(error as Error).message);}
  const eventRef=db.collection(collections.events).doc(input.eventId);
  const result=await db.runTransaction(async transaction=>{
    const eventSnapshot=await transaction.get(eventRef),event=eventSnapshot.data();
    if(!event||!["PUBLISHED","ACTIVE"].includes(event.status)||!event.seasonId) {
      throw new HttpsError("failed-precondition","Warm-ups require a published or active season Event.");
    }
    const window=warmupWindow(event.startsAt,event.warmupOpensAt,event.timezone);
    if(Date.now()>=event.startsAt.toMillis())throw new HttpsError("failed-precondition","Schedule warm-ups before the main Event starts.");
    let rules;
    try{rules=validateSeasonScoringRules(event.scoringSnapshot?.rules??{});}
    catch(error){throw new HttpsError("failed-precondition",(error as Error).message);}
    if(!rules)throw new HttpsError("failed-precondition","Warm-ups require the V1 season points profile.");
    const [slots,members,players]=await Promise.all([
      Promise.all(ids.map(id=>transaction.get(eventRef.collection("scoringSlots").doc(scoringSlotId("WARMUP",id))))),
      Promise.all(ids.map(id=>transaction.get(db.collection(collections.seasons).doc(event.seasonId).collection("participants").doc(id)))),
      Promise.all(ids.map(id=>transaction.get(db.collection(collections.players).doc(id)))),
    ]);
    if(slots.some(slot=>slot.exists))throw new HttpsError("failed-precondition","A player already has a designated warm-up.");
    if(members.some(member=>member.data()?.status!=="ENTERED")||players.some(player=>player.data()?.membershipStatus!=="ACTIVE")) {
      throw new HttpsError("failed-precondition","All warm-up players must be active members entered in this Season.");
    }
    await reserveIdempotencyKey(transaction,input.requestId,"adminCreateEventWarmups",actor.authUid);
    const now=Timestamp.now(),matchIds:string[]=[];
    const gameConfig={...input.gameConfig,diplomacyEnabled:false};
    input.pairs.forEach((pair,index)=>{
      const matchId=input.eventId+"-W"+((event.warmupMatchIds?.length??0)+index+1);
      const matchRef=db.collection(collections.matches).doc(matchId);
      const participants=pair.map((playerId,index)=>({playerId,slot:index+1,team:index+1}));
      const scoringSnapshot=seasonScoringSnapshot({act:"WARMUP",diplomacyEnabled:false,placementPolicy:"NONE",emperorPlayerId:null});
      transaction.create(matchRef,{
        seasonId:event.seasonId,eventId:input.eventId,matchNumber:index+1,format:"ONE_V_ONE",participants,status:"READY",
        context:{type:"SEASON_EVENT",affectsLeaguePoints:true,affectsWarRoomPoints:false,affectsGold:true,
          affectsSeasonStats:true,affectsLifetimeStats:true,affectsPowerRating:true},
        seriesRule:{maxGames:1,gamesRequiredToWin:1},gameConfigSnapshot:gameConfig,
        scoringSnapshot,goldRewardSnapshot:event.goldRewardSnapshot,canonicalResult:null,
        playOpensAt:window.opensAt,playClosesAt:window.closesAt,
        createdBy:actor.playerId,createdAt:now,updatedAt:now,completedAt:null,
      });
      transaction.create(matchRef.collection("games").doc("G1"),{
        gameNumber:1,status:"READY",
        players:participants.map(p=>({...p,color:null,civilization:null,civilizationSelection:"UNKNOWN",position:null})),
        gameConfigSnapshot:gameConfig,
        replayParticipantBindings:(event.replayParticipantBindings??[]).filter((binding:{playerId:string})=>pair.includes(binding.playerId)),
        replay:null,canonicalResult:null,createdAt:now,updatedAt:now,startedAt:null,completedAt:null,
      });
      for(const playerId of pair)transaction.create(eventRef.collection("scoringSlots").doc(scoringSlotId("WARMUP",playerId)),{
        playerId,act:"WARMUP",matchId,seasonId:event.seasonId,createdAt:now,
      });
      matchIds.push(matchId);
    });
    transaction.update(eventRef,{warmupMatchIds:[...(event.warmupMatchIds??[]),...matchIds],updatedAt:now});
    writeAdminAudit(transaction,{actorUid:actor.authUid,actorPlayerId:actor.playerId,action:"EVENT_WARMUPS_CREATED",targetType:"EVENT",targetId:input.eventId,after:{matchIds,pairs:input.pairs}});
    return {matchIds};
  });
  return {success:true,...result};
});

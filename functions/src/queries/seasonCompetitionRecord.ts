import {currentOfficialGameOutcome} from '../engines/recordingMatchFacts.js';
import {battleGameManifest} from '../engines/battleGameManifest.js';
import {resolveSeriesResult} from '../engines/seriesResult.js';
import {db} from '../config/firebase.js';
import {bindingDigest} from '../engines/nativeRecordingIntegration.js';
import {HttpsError} from 'firebase-functions/v2/https';

type Bag=Record<string,any>;
export interface SeasonCompetitionRecord {wins:number;losses:number}
type MatchSnapshot={id:string;data:()=>Bag;ref:FirebaseFirestore.DocumentReference};
const same=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right);

/** Competition W–L counts canonical Battles, independently of which warm-up
 * earns points. Reuse current official-result/series authority; never infer a
 * result from the point ledger, recording claim or cached statistics totals.
 */
export async function readSeasonCompetitionRecords(matches:MatchSnapshot[]):Promise<Map<string,SeasonCompetitionRecord>>{
  return db.runTransaction(async tx=>{
  const records=new Map<string,SeasonCompetitionRecord>();
  for(const snapshot of matches){
    // Tie W–L to the same Match revisions used by the point masking reader.
    // Games and recording sources share this read transaction's snapshot.
    const current=await tx.get(snapshot.ref);
    if(bindingDigest(current.data()??null)!==bindingDigest(snapshot.data()))
      throw new HttpsError('aborted','Season results changed during the read. Retry.');
    const match=snapshot.data();
    if(match.status!=='COMPLETED'||match.activeResultDisputeId||
      match.context?.affectsSeasonStats!==true||match.opponentKind==='AI'||match.aiOpponent)continue;
    const aggregate=currentOfficialGameOutcome({status:'COMPLETED',players:match.participants,
      canonicalResult:match.canonicalResult},match);
    if(aggregate.qualification!=='OFFICIAL')continue;

    const gamesSnapshot=await tx.get(snapshot.ref.collection('games'));
    const games=gamesSnapshot.docs.map(doc=>({gameId:doc.id,...doc.data()} as Bag));
    let used:Bag[];
    if((match.seriesRule?.maxGames??1)>1){
      const manifest=battleGameManifest(match,games as any);
      if(!manifest.gameManifestComplete)continue;
      let resolved;
      try{resolved=resolveSeriesResult(games as any,match.seriesRule,match.participants);}
      catch{continue;}
      const revisions=Object.entries(resolved.seriesGameRevisions).sort(([a],[b])=>a.localeCompare(b));
      if(resolved.sourceGameId!==match.canonicalResult.sourceGameId||
        !same(revisions,Object.entries(match.canonicalResult.seriesGameRevisions??{}).sort(([a],[b])=>a.localeCompare(b)))||
        !same([...resolved.result.winningPlayerIds].sort(),aggregate.winnerPlayerIds))continue;
      used=games.filter(game=>Object.hasOwn(resolved.seriesGameRevisions,game.gameId));
    }else{
      const sourceId=match.canonicalResult.sourceGameId;
      // Preserve historical canonical/manual Match-only results. A named
      // missing Game or recording-bound result cannot use this compatibility.
      if(!sourceId&&games.length===0&&match.canonicalResult.source!=='RECORDING_VERIFIED')used=[];
      else{
        const game=games.find(g=>g.gameId===sourceId);
        if(!game||game.canonicalResult?.revision!==match.canonicalResult.revision||
          !same([...(game.canonicalResult?.winningPlayerIds??[])].sort(),aggregate.winnerPlayerIds))continue;
        used=[game];
      }
    }
    let eligible=true;
    for(const game of used){
      if(currentOfficialGameOutcome(game,match).qualification!=='OFFICIAL'){eligible=false;break;}
      if(game.recordingResultBinding||game.canonicalResult?.source==='RECORDING_VERIFIED'){
        const hash=game.recordingResultBinding?.sourceHash;
        if(typeof hash!=='string'||!hash||hash!==game.activeReplayStatisticsId){eligible=false;break;}
        const source=(await tx.get(snapshot.ref.collection('games').doc(game.gameId).collection('replaySources').doc(hash))).data();
        const ids=Array.isArray(source?.playerMapping)?source.playerMapping.map((p:Bag)=>p.playerId):[];
        if(source?.state!=='READY'||game.replayStatisticsState!=='READY'||
          !Number.isSafeInteger(game.replayStatisticsRevision)||game.replayStatisticsRevision<1||
          source.replayStatisticsRevision!==game.replayStatisticsRevision||
          source.sourceHash!==hash||source.matchId!==snapshot.id||source.gameId!==game.gameId||
          ids.length!==match.participants.length||new Set(ids).size!==ids.length||
          ids.some((id:string)=>!match.participants.some((p:Bag)=>p.playerId===id))){eligible=false;break;}
      }
    }
    if(!eligible)continue;
    const winners=new Set<string>(aggregate.winnerPlayerIds);
    for(const player of match.participants){
      const current=records.get(player.playerId)??{wins:0,losses:0};
      if(winners.has(player.playerId))current.wins++;else current.losses++;
      records.set(player.playerId,current);
    }
  }
  return records;
  });
}

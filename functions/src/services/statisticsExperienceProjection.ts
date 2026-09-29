import {createHash} from 'node:crypto';
import {getStorage} from 'firebase-admin/storage';
import {Timestamp,type Transaction,type DocumentReference,type Query} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {db} from '../config/firebase.js';
import {EXPERIENCE_VERSION,StatisticsExperience,projectStatistics,type GameStatistics,type ProjectionMetadata,type StatisticsScope,type StatisticsDataset} from '../engines/statisticsExperience.js';
import {SEASON_SHOWCASE_VERSION,augmentSeasonShowcase} from '../engines/seasonShowcaseProjection.js';

const stable=(value:any):any=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
export function statisticsMetadata(matchId:string,gameId:string,match:any,game:any,source:any):ProjectionMetadata {
  const disputed=!!game.activeResultDisputeId||!!match.activeResultDisputeId||game.status==='DISPUTED'||match.status==='DISPUTED';
  const eligible=!disputed&&game.status==='COMPLETED'&&!!game.canonicalResult&&!['CANCELLED','VOID','PROPOSED'].includes(match.status);
  const iso=game.completedAt??match.completedAt??match.firstCompletedAt;
  const orderAtMs=typeof iso?.toMillis==='function'?iso.toMillis():typeof iso==='string'?Date.parse(iso):0;
  const config=game.gameConfigSnapshot??match.gameConfigSnapshot??{};
  // Until the played map is retained in this read model, a multi-map or unknown
  // pool cannot support cross-Game timing/record comparisons.
  const comparisonConfig=config.maps?.pool?.length===1?config:{...config,recordScope:matchId+'/'+gameId};
  return {matchId,gameId,seasonId:match.seasonId??null,eventId:match.eventId??null,format:match.format??'UNKNOWN',
    contextKey:[match.format??'UNKNOWN',JSON.stringify(stable(comparisonConfig))].join(' · '),
    orderAtMs:Number.isFinite(orderAtMs)?orderAtMs:0,revision:Number(game.replayStatisticsRevision??1),sourceHash:source.sourceHash??'',
    eligible,exclusionReason:eligible?null:disputed?'Result disputed':'Official Game result pending',
    affectsSeason:match.context?.affectsSeasonStats!==false,affectsLifetime:match.context?.affectsLifetimeStats!==false,
    roster:(game.players??[]).map((p:any)=>({...p,steamName:source.playerMapping?.find((m:any)=>m.playerId===p.playerId)?.sourceName??p.playerId})),mapping:source.playerMapping??[]};
}

async function hydrateProjection(matchId:string,gameId:string,match:any,game:any,sourceRef:DocumentReference,source:any):Promise<void>{
  if(source.experience?.version===EXPERIENCE_VERSION&&source.experience?.seasonShowcaseVersion===SEASON_SHOWCASE_VERSION)return;
  if(!source.statistics?.path||!source.statistics?.sha256)return;
  const project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
  const bucket=process.env.REPLAY_BUCKET||`${project}.appspot.com`;
  const [bytes]=await getStorage().bucket(bucket).file(source.statistics.path).download();
  if(createHash('sha256').update(bytes).digest('hex')!==source.statistics.sha256)throw new HttpsError('data-loss','Stored statistics failed integrity verification.');
  const raw=JSON.parse(bytes.toString('utf8'));
  const metadata=statisticsMetadata(matchId,gameId,match,game,source);
  const experience=augmentSeasonShowcase(raw,projectStatistics(raw,metadata),metadata);
  // Immutable source revision: backfill presentation only, never promote another replay.
  await sourceRef.update({experience});
}

/** Reads active pointers every time; cached totals are never trusted for public claims. */
export async function collectStatistics(scope:StatisticsScope={},transaction?:Transaction,hydrate=false):Promise<StatisticsDataset>{
  const read=(ref:DocumentReference|Query):Promise<any>=>transaction?transaction.get(ref as DocumentReference):ref.get();
  let query:Query=db.collection('matches');
  if(scope.seasonId)query=query.where('seasonId','==',scope.seasonId);
  else if(scope.eventId)query=query.where('eventId','==',scope.eventId);
  const snapshots=scope.matchId?[await read(db.collection('matches').doc(scope.matchId))]:(await read(query)).docs;
  const identities=await read(db.collection('players'));
  const names=new Map<string,string>(identities.docs.map((p:any)=>[p.id,p.data().steamName??p.id]));
  const games:GameStatistics[]=[];let unavailableGames=0;
  for(const matchSnapshot of snapshots){
    if(!matchSnapshot.exists)continue;
    const match=matchSnapshot.data();
    if(match.status==='PROPOSED')continue;
    if(scope.seasonId&&match.seasonId!==scope.seasonId||scope.eventId&&match.eventId!==scope.eventId)continue;
    const gameSnapshots=await read(matchSnapshot.ref.collection('games'));
    for(const gameSnapshot of gameSnapshots.docs){
      const game=gameSnapshot.data(),sourceId=game.activeReplayStatisticsId;
      if(!sourceId){if(game.status==='COMPLETED')unavailableGames++;continue;}
      const sourceRef=gameSnapshot.ref.collection('replaySources').doc(sourceId),sourceSnapshot=await read(sourceRef);
      if(!sourceSnapshot.exists||sourceSnapshot.data().state!=='READY'){unavailableGames++;continue;}
      let source=sourceSnapshot.data();
      if(hydrate&&(source.experience?.version!==EXPERIENCE_VERSION||source.experience?.seasonShowcaseVersion!==SEASON_SHOWCASE_VERSION)){await hydrateProjection(matchSnapshot.id,gameSnapshot.id,match,game,sourceRef,source);source=(await sourceRef.get()).data();}
      if(source?.experience?.version!==EXPERIENCE_VERSION){unavailableGames++;continue;}
      const metadata=statisticsMetadata(matchSnapshot.id,gameSnapshot.id,match,game,source);
      const {mapping:_,roster,...base}=metadata;
      const experience=source.experience as GameStatistics;
      if(experience.players.length!==roster.length||experience.players.some(p=>!roster.some(r=>r.playerId===p.playerId))){unavailableGames++;continue;}
      games.push({...experience,...base,players:experience.players.map(p=>({...p,name:names.get(p.playerId)??p.name,team:roster.find(r=>r.playerId===p.playerId)?.team??null,civilization:roster.find(r=>r.playerId===p.playerId)?.civilization??null}))});
    }
  }
  return {version:EXPERIENCE_VERSION,games,unavailableGames};
}

/** A transaction-wide rebuild is intentional for a small private league.
 * Reading the authoritative Games and writing complete replacements prevents
 * duplicate delivery, stale out-of-order triggers, and correction double counts.
 */
export async function rebuildStatisticsReadModels():Promise<void>{
  await db.runTransaction(async transaction=>{
    const dataset=await collectStatistics({},transaction);
    // Include empty scopes so withdrawal/deletion clears previously persisted totals.
    const playersSnapshot=await transaction.get(db.collection('players'));
    const seasonsSnapshot=await transaction.get(db.collection('seasons'));
    const playerIds=[...new Set([...playersSnapshot.docs.map(p=>p.id),...dataset.games.flatMap(g=>g.players.map(p=>p.playerId))])];
    const seasons=[...new Set([...seasonsSnapshot.docs.map(s=>s.id),...dataset.games.map(g=>g.seasonId).filter((id):id is string=>!!id)])];
    const lifetime=new StatisticsExperience(dataset.games.filter(g=>g.affectsLifetime));
    const lifetimeRows=lifetime.aggregate();
    const seasonalRows=new Map(seasons.map(id=>[id,new StatisticsExperience(dataset.games.filter(g=>g.seasonId===id&&g.affectsSeason)).aggregate()]));
    const writes:{ref:DocumentReference;data:unknown}[]=[];
    for(const id of playerIds){
      const row=lifetimeRows.find(p=>p.playerId===id);
      writes.push({ref:db.collection('players').doc(id).collection('statistics').doc('experienceLifetime'),data:{version:EXPERIENCE_VERSION,playerId:id,games:row?.games??0,values:row?.values??{},updatedAt:Timestamp.now()}});
      for(const seasonId of seasons){
        const p=seasonalRows.get(seasonId)!.find(p=>p.playerId===id);
        writes.push({ref:db.collection('seasons').doc(seasonId).collection('statisticsExperience').doc(id),data:{version:EXPERIENCE_VERSION,playerId:id,games:p?.games??0,values:p?.values??{},updatedAt:Timestamp.now()}});
      }
    }
    for(const write of writes)transaction.set(write.ref,write.data as Record<string,unknown>);
  });
}

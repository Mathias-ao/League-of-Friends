import type {LeagueRepository,LeagueSnapshot,PlayerRecord} from '../domain/league';

export type DetailSelection={type:'event'|'match'|'player';id:string;request:number;openChronicle?:boolean};
export function summaryPlayer(snapshot:LeagueSnapshot,id:string):PlayerRecord|null {
  return [snapshot.viewer,...snapshot.players,...snapshot.standings,
    ...snapshot.matches.flatMap(match=>match.participants)].find(player=>player?.playerId===id)??null;
}
/** Public summary dependencies only. Never cache a private projection or treat
 * a remembered full detail as current action authority. */
export function detailRevision(snapshot:LeagueSnapshot,selection:DetailSelection,uid:string|null|undefined){
  const {type,id}=selection;
  const matches=snapshot.matches.filter(match=>type==='match'?match.matchId===id:
    type==='event'?match.eventId===id:match.participants.some(player=>player.playerId===id));
  return JSON.stringify([uid,snapshot.membership,[snapshot.viewer?.playerId,snapshot.viewer?.role],snapshot.season,
    snapshot.enteredSeason,snapshot.hasLeagueHistory,type,id,
    type==='player'?summaryPlayer(snapshot,id):snapshot.events.find(event=>event.eventId===
      (type==='event'?id:matches[0]?.eventId)),matches]);
}
/** Coalesce only in-flight reads, bounded and owned by one mounted App.
 * Completion evicts the promise, so warm reopen always validates authority. */
export function detailRequests(){
  const pending=new Map<string,Promise<unknown>>();
  return {read<T>(key:string,load:()=>Promise<T>):Promise<T>{
    const existing=pending.get(key);if(existing)return existing as Promise<T>;
    const task=Promise.resolve().then(load);pending.set(key,task);
    if(pending.size>8)pending.delete(pending.keys().next().value!);
    void task.finally(()=>{if(pending.get(key)===task)pending.delete(key);}).catch(()=>{});
    return task;
  },clear:()=>pending.clear()};
}
export type DetailRequests=ReturnType<typeof detailRequests>;
export function accessCurrent(repository:LeagueRepository,uid:string|null|undefined){
  return !repository.currentAuthUid||repository.currentAuthUid()===uid;
}

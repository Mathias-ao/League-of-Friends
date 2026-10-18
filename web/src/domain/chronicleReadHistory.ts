import type {PlayerChronicleBookEntry} from './league';

export const chronicleEntryKey=(entry:PlayerChronicleBookEntry)=>entry.sceneId??entry.entryId;
/** Preserve every old ID and unrelated/withdrawn scene. Exact owner×pair×Battle
 * prefix is necessary; a correction's changed beat suffix is not new history. */
export function migrateChronicleSeen(stored:string|null,entries:PlayerChronicleBookEntry[],
  ownerId:string,counterpartId:string):{storedIds:string[];fresh:Set<string>}{
  const parsed=stored===null?null:JSON.parse(stored);
  const seen=new Set<string>(Array.isArray(parsed)?parsed.filter((id):id is string=>typeof id==='string'):[]);
  const fresh=new Set<string>();
  for(const entry of entries){
    const prefix=`AOF_PLAYER_CHRONICLE_V1:${ownerId}:${counterpartId}:${entry.battleId}:`;
    const prior=seen.has(chronicleEntryKey(entry))||seen.has(entry.entryId)||
      !!entry.sceneId&&entry.entryId.startsWith(prefix)&&[...seen].some(id=>id.startsWith(prefix));
    if(stored!==null&&!prior)fresh.add(chronicleEntryKey(entry));
    // Append both forms for safe browser/server upgrades and downgrades.
    seen.add(entry.entryId);if(entry.sceneId)seen.add(entry.sceneId);
  }
  return {storedIds:[...seen],fresh};
}

import type {AchievementSummary} from './league';

/**
 * A small local read marker for owner-authenticated ACTIVE awards.
 * This is not an award ledger or a source of grant authority.
 */
export function honoursSeenKey(ownerId:string):string{
  return 'aof:honours-seen:v1:'+encodeURIComponent(ownerId);
}
export const HONOURS_VIEWED_EVENT='aof:honours-viewed';

function awardToken(award:AchievementSummary):string|null{
  if(!award.awardId||!award.firstAwardedAt||!Number.isFinite(Date.parse(award.firstAwardedAt)))return null;
  return JSON.stringify([award.awardId,award.firstAwardedAt]);
}
function tokens(awards:AchievementSummary[]):string[]{
  return [...new Set(awards.map(awardToken).filter((token):token is string=>token!==null))].sort();
}
function parseSeen(raw:string|null):Set<string>|null{
  if(raw===null)return null;
  try{
    const parsed=JSON.parse(raw);
    if(!Array.isArray(parsed)||parsed.length>5000||parsed.some(item=>typeof item!=='string'||item.length>400))return null;
    return new Set(parsed);
  }catch{return null;}
}
export function reconcileHonourNotices(awards:AchievementSummary[],raw:string|null):{
  unseen:AchievementSummary[];initialSeen:string|null;
}{
  const known=parseSeen(raw);
  // A first read establishes the existing cabinet as history, not a flood
  // of retroactive "new" achievements for a returning player.
  if(!known)return {unseen:[],initialSeen:JSON.stringify(tokens(awards))};
  return {unseen:awards.filter(award=>{const token=awardToken(award);return token!==null&&!known.has(token);}),initialSeen:null};
}
export function markHonoursViewed(awards:AchievementSummary[],raw:string|null):string{
  return JSON.stringify([...new Set([...(parseSeen(raw)??[]),...tokens(awards)])].sort());
}

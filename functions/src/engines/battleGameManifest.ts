import {currentOfficialGameOutcome} from './recordingMatchFacts.js';
import {resolveSeriesResult,type AcceptedSeriesGame} from './seriesResult.js';
export interface BattleGameManifest {knownGameIds:string[];unusedGameIds:string[];gameManifestComplete:boolean}
const stable=(value:any):any=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
/** Read-only manifest from the same fenced Match/Game authority as statistics. */
export function battleGameManifest(match:any,games:(AcceptedSeriesGame&Record<string,any>)[]):BattleGameManifest{
  let decisiveNumber:number|null=null;
  const rule=match.seriesRule;
  if(rule?.maxGames>1&&match.status==='COMPLETED'&&!match.activeResultDisputeId&&
      Number.isInteger(match.canonicalResult?.revision)&&match.canonicalResult.revision>0){
    try{
      const resolved=resolveSeriesResult(games,rule,match.participants??[]);
      const used=games.filter(game=>Object.hasOwn(resolved.seriesGameRevisions,game.gameId));
      if(resolved.sourceGameId===match.canonicalResult.sourceGameId&&
          JSON.stringify(stable(resolved.seriesGameRevisions))===JSON.stringify(stable(match.canonicalResult.seriesGameRevisions))&&
          JSON.stringify([...resolved.result.winningPlayerIds].sort())===JSON.stringify([...(match.canonicalResult.winningPlayerIds??[])].sort())&&
          used.every(game=>currentOfficialGameOutcome(game,match).qualification==='OFFICIAL'))
        decisiveNumber=games.find(game=>game.gameId===resolved.sourceGameId)!.gameNumber;
    }catch{/* Unresolved or corrected series cannot certify an unused terminal Game. */}
  }
  const unused=games.filter(game=>decisiveNumber!==null&&Number.isInteger(game.gameNumber)&&
    game.gameNumber>decisiveNumber&&game.gameNumber<=rule.maxGames&&
    game.status==='NO_CONTEST'&&!game.canonicalResult&&!game.activeResultDisputeId&&!game.activeReplayStatisticsId&&
    game.resolutionReason==='Series decided by '+match.canonicalResult.sourceGameId);
  const known=games.filter(game=>!unused.includes(game));
  let complete=true;
  if(rule?.maxGames>1){
    // A series rule names numbered opportunities, not missing document IDs.
    // Keep unknown required slots incomplete without inventing G2/G3 identities.
    const required=decisiveNumber??rule.maxGames;
    const active=known.filter(game=>game.status!=='REMAKE');
    complete=Number.isInteger(required)&&required>0&&required<=rule.maxGames&&active.length===required&&
      Array.from({length:required},(_,index)=>index+1).every(number=>active.filter(game=>game.gameNumber===number).length===1)&&
      active.every(game=>Number.isInteger(game.gameNumber)&&game.gameNumber>0&&game.gameNumber<=required);
  }
  return {knownGameIds:known.map(game=>game.gameId).sort(),unusedGameIds:unused.map(game=>game.gameId).sort(),gameManifestComplete:complete};
}

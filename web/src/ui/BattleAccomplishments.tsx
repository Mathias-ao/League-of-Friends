import {useState} from 'react';
import {selectBattleShowcase,type EventShowcaseItem} from '../domain/eventRoundoffShowcase';
import type {GameStatistics} from '../domain/statistics';
import type {MatchDetail} from '../domain/league';
import {AccomplishmentEmblem} from './AccomplishmentEmblem';
import {BattleOverlay} from './BattleOverlay';

export function BattleAccomplishments({game,data,preview}:{game:GameStatistics;data:MatchDetail;preview:boolean}){
  const record=data.games.find(row=>row.gameId===game.gameId),roster=record?.players??[];
  const items=record?selectBattleShowcase({game,match:{...data.match,participants:roster},illustrative:preview,
    pendingResultSource:{gameStatus:record.status,resultPending:!record.result,resultDisputeOpen:record.resultDisputeOpen,
      statisticsState:record.replay?.statisticsState??null,statisticsId:record.replay?.statisticsId??null,
      statisticsRevision:record.replay?.statisticsRevision??null}}):[];
  // A result dispute does not authenticate the underlying source. Without
  // independent source-dispute authority, this path fails closed on disputes.
  // Bind even officially qualified Game cards to the *current* READY source.
  // A result correction can refresh the Game pointer before UI stats refresh.
  const currentSource=record?.replay?.statisticsState==='READY'&&
    record.replay.statisticsId===game.sourceHash&&
    record.replay.statisticsRevision===game.revision;
  if(!record||record.resultDisputeOpen||(!preview&&!currentSource)||!items.length)return null;
  // The opened claim belongs to one viewer, Game and current source. Remount
  // its state synchronously on rebinding; returning from an unavailable source
  // must also require a fresh evidence action rather than revive the old claim.
  const binding=JSON.stringify([data.match.matchId,game.gameId,game.sourceHash,game.revision,
    record.replay?.statisticsState,record.replay?.statisticsId,record.replay?.statisticsRevision,
    data.viewer.playerId,data.viewer.isParticipant,preview,game.eligible,game.exclusionReason,
    data.match.status,record.status,record.gameNumber,record.result?.revision,items]);
  return <BattleAccomplishmentCards key={binding} game={game} items={items} gameNumber={record.gameNumber}/>;
}

function BattleAccomplishmentCards({game,items,gameNumber}:{game:GameStatistics;items:EventShowcaseItem[];gameNumber:number}){
  const [evidence,setEvidence]=useState<EventShowcaseItem|null>(null);
  return <section className="battle-accomplishments" aria-label={`Battle highlights · Game ${gameNumber}`}><span className="eyebrow">BATTLE HIGHLIGHTS · GAME {gameNumber}</span><ol>{items.map(item=><li key={item.id}><button onClick={()=>setEvidence(item)} aria-label={`View evidence for ${item.title}`}><AccomplishmentEmblem kind={item.emblem}/><span><strong>{item.title}</strong><b>{item.value}</b><small>{item.playerIds.map(id=>game.players.find(player=>player.playerId===id)?.name??id).join(' · ')}</small><em>{item.tier.toLowerCase()}</em></span></button></li>)}</ol>
    {evidence&&<BattleOverlay title={evidence.title} onClose={()=>setEvidence(null)}><p>{evidence.detail}</p><p>{evidence.playerIds.map(id=>game.players.find(player=>player.playerId===id)?.name??id).join(' · ')} · {evidence.value}</p><small>Game {gameNumber} · Recording revision {game.revision}</small></BattleOverlay>}
  </section>;
}

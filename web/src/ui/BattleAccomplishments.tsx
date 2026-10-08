import {useState} from 'react';
import {selectBattleShowcase,type EventShowcaseItem} from '../domain/eventRoundoffShowcase';
import type {GameStatistics} from '../domain/statistics';
import type {MatchDetail} from '../domain/league';
import {AccomplishmentEmblem} from './AccomplishmentEmblem';
import {BattleOverlay} from './BattleOverlay';

export function BattleAccomplishments({game,data,preview}:{game:GameStatistics;data:MatchDetail;preview:boolean}){
  const [evidence,setEvidence]=useState<EventShowcaseItem|null>(null);
  const record=data.games.find(row=>row.gameId===game.gameId),roster=record?.players??[];
  const items=selectBattleShowcase({game,match:{...data.match,participants:roster},illustrative:preview});
  if(!record?.result||record.resultDisputeOpen||!items.length)return null;
  return <section className="battle-accomplishments" aria-label="Battle accomplishments"><span className="eyebrow">DISTINCTIONS OF THE BATTLE</span><ol>{items.map(item=><li key={item.id}><button onClick={()=>setEvidence(item)} aria-label={`View evidence for ${item.title}`}><AccomplishmentEmblem kind={item.emblem}/><span><strong>{item.title}</strong><b>{item.value}</b><small>{item.playerIds.map(id=>game.players.find(player=>player.playerId===id)?.name??id).join(' · ')}</small><em>{item.tier.toLowerCase()}</em></span></button></li>)}</ol>
    {evidence&&<BattleOverlay title={evidence.title} onClose={()=>setEvidence(null)}><p>{evidence.detail}</p><p>{evidence.playerIds.map(id=>game.players.find(player=>player.playerId===id)?.name??id).join(' · ')} · {evidence.value}</p><small>Game {data.games.find(row=>row.gameId===game.gameId)?.gameNumber} · Recording revision {game.revision}</small></BattleOverlay>}
  </section>;
}

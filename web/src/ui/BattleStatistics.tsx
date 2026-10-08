import {useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {CATEGORIES,formatTime,type Category,type GameStatistics,type PlayerMeasurement} from '../domain/statistics';
import {BATTLE_CATEGORY_HELP,battleMetricsFor,battleMeasurement,type BattleMetricDefinition} from '../domain/battleStatistics';

export function BattleStatistics({game,viewerId,preview,provisional,openPlayer}:{game:GameStatistics;viewerId?:string;preview:boolean;provisional:boolean;openPlayer:(id:string)=>void}){
  const [category,setCategory]=useState<Category>('Opening');
  const [inspect,setInspect]=useState<{player:PlayerMeasurement;metric:BattleMetricDefinition}|null>(null);
  const evidence=useRef<HTMLElement>(null),trigger=useRef<HTMLButtonElement|null>(null);
  const metrics=battleMetricsFor(category,game);
  const players=[...game.players].sort((a,b)=>(a.team??Infinity)-(b.team??Infinity)||a.name.localeCompare(b.name));
  useEffect(()=>{if(inspect)evidence.current?.focus();},[inspect]);
  const close=()=>{setInspect(null);trigger.current?.focus();};
  return <div className="sx-panel battle-ledger">
    <div className="sx-notice">{preview&&<strong>Illustrative preview · </strong>}{provisional?'Provisional recording · result pending or under review.':'Accepted recording.'} Select a measurement to inspect its meaning and source. Missing evidence remains “—”.</div>
    <nav className="sx-tabs" aria-label="Statistics categories">{CATEGORIES.map(item=><button key={item} aria-pressed={category===item} onClick={()=>{setCategory(item);setInspect(null);}}>{item}</button>)}</nav>
    <section aria-label={`${category} statistics`}>
      <p className="battle-ledger-intro">{BATTLE_CATEGORY_HELP[category]}</p>
      <div className="sx-table-scroll" tabIndex={0} aria-label={`${category} player comparison`}><table className="sx-table battle-ledger-table"><thead><tr><th scope="col">Statistic</th>{players.map(player=><th scope="col" key={player.playerId} className={player.playerId===viewerId?'battle-ledger-you':''}><button onClick={()=>openPlayer(player.playerId)}>{player.name}</button><small>{player.playerId===viewerId?'YOU · ':''}{player.team!=null?`Side ${player.team}`:'The field'}{player.civilization?` · ${player.civilization}`:''}</small></th>)}</tr></thead><tbody>{metrics.map(metric=><tr key={metric.id} data-metric={metric.id}><th scope="row">{metric.label}<small>{metric.battleHint}</small></th>{players.map(player=>{const measure=battleMeasurement(game,player,metric);return <td key={player.playerId}><button className="sx-value-button" aria-label={`${player.name}, ${metric.label}: ${measure.display}. View evidence.`} onClick={event=>{trigger.current=event.currentTarget;setInspect({player,metric});}}>{measure.display}</button></td>;})}</tr>)}</tbody></table></div>
    </section>
    {inspect&&<section ref={evidence} tabIndex={-1} className="battle-ledger-evidence" aria-label="Statistic evidence"><header><h3>{inspect.player.name} · {inspect.metric.label}</h3><button aria-label="Close evidence" onClick={close}><X size={18}/></button></header><p><strong>{battleMeasurement(game,inspect.player,inspect.metric).display}</strong> · {inspect.metric.battleHint}</p>{battleMeasurement(game,inspect.player,inspect.metric).display==='—'&&<p>{battleMeasurement(game,inspect.player,inspect.metric).unavailable}</p>}<p className="battle-ledger-source">{game.matchId} / {game.gameId} · revision {game.revision} · {provisional?'Provisional':'Accepted'}<br/>Source model: {inspect.player.models[inspect.metric.id]??'Unavailable'}<br/>Recording: {game.sourceHash??'Unavailable'}</p><MetricEpisodes game={game} player={inspect.player} metric={inspect.metric}/></section>}
  </div>;
}
function MetricEpisodes({game,player,metric}:{game:GameStatistics;player:PlayerMeasurement;metric:BattleMetricDefinition}){
  const kinds:Record<string,string>={raidsOut:'raid',raidsIn:'raid',response:'raid',assistsOut:'assist',cooperation:'cooperation',feudal:'age',castle:'age',imperial:'age'};
  const kind=kinds[metric.id];if(!kind)return null;
  const episodes=game.episodes.filter(episode=>episode.kind===kind&&(['raidsIn','response'].includes(metric.id)?episode.targets.includes(player.playerId):episode.actors.includes(player.playerId))&&(!['feudal','castle','imperial'].includes(metric.id)||episode.label.toLowerCase().startsWith(metric.id)));
  return <>{episodes.length?<ol className="battle-ledger-episodes">{episodes.map(episode=><li key={episode.id}><time>{formatTime(episode.atMs)}</time> · {episode.label}</li>)}</ol>:<p>No corresponding detailed episodes retained.</p>}{game.evidenceTruncated&&<p>Only the first 600 episodes are retained; measurements may cover more episodes.</p>}</>;
}

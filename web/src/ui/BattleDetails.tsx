import {useEffect,useState} from 'react';
import {BarChart3,RefreshCw} from 'lucide-react';
import {formatName,type MatchDetail} from '../domain/league';
import {MatchDialog} from './Views';
import {BattleTimeline,useStatistics} from './StatisticsDashboardLegacy';
import {BattleStatistics} from './BattleStatistics';
import {BattleOverlay} from './BattleOverlay';
import {BattleAccomplishments} from './BattleAccomplishments';
import type {ViewProps} from './App';

export function BattleDetails(props:ViewProps&{data:MatchDetail;onUpdated:()=>void}){
  const {data,repository,preview,snapshot,openPlayer}=props;
  const [gameId,setGameId]=useState(data.games[0]?.gameId??''),[statisticsOpen,setStatisticsOpen]=useState(false);
  const selected=data.games.find(game=>game.gameId===gameId)??data.games[0];
  const revision=JSON.stringify(data.games.map(game=>[game.gameId,game.status,game.result?.revision,game.resultDisputeOpen,game.replay?.statisticsRevision]));
  const state=useStatistics(repository,{matchId:data.match.matchId},revision);
  const recorded=state.dataset?.games.find(game=>game.gameId===selected?.gameId);
  useEffect(()=>{setGameId(data.games[0]?.gameId??'');setStatisticsOpen(false);},[data.match.matchId]);
  return <div className="battle-details">
    <header className="battle-detail-header"><div><span className="eyebrow">{data.match.scoringAct==='WARMUP'?'ACT I · WARM-UP':data.match.scoringAct==='MAIN'?'ACT II · MAIN EVENT':'THE FIELD OF BATTLE'}</span><h3>{formatName(data.match.format)}{data.games.length>1&&<small> · {data.games.length} Games</small>}</h3></div><span className="quiet-badge">{data.match.status.replaceAll('_',' ')}</span></header>
    {data.games.length>1&&<label className="battle-game-picker">Game<select value={selected?.gameId??''} onChange={event=>{setGameId(event.target.value);setStatisticsOpen(false);}}>{data.games.map(game=><option key={game.gameId} value={game.gameId}>Game {game.gameNumber} · {game.status.replaceAll('_',' ')}</option>)}</select></label>}
    <MatchDialog key={data.match.matchId+'/'+selected?.gameId} {...props} compact gameId={selected?.gameId} recordedGame={recorded}/>
    {recorded&&<BattleAccomplishments key={recorded.gameId+'/'+recorded.revision+'/'+recorded.sourceHash} game={recorded} data={data} preview={preview}/>}
    <footer className="battle-statistics-entry"><div><span className="eyebrow">THE BATTLE LEDGER</span><p>{state.error?'Statistics could not be read.':!state.dataset?'Reading the recording statistics…':recorded?(recorded.eligible&&!selected?.resultDisputeOpen&&selected?.result?'Compare the players and follow the Game clock.':'Provisional measurements · result qualification pending.'):'Statistics appear after the recording is processed.'}</p></div><div><button className="battle-refresh" aria-label="Refresh Battle statistics" onClick={state.retry}><RefreshCw size={15}/></button><button className="primary" onClick={()=>setStatisticsOpen(true)}><BarChart3 size={16}/>Open Battle Ledger</button></div></footer>
    {statisticsOpen&&<BattleOverlay title={`Battle Ledger · Game ${selected?.gameNumber??1}`} wide onClose={()=>setStatisticsOpen(false)}><div className="battle-details battle-full-statistics">
      {state.error?<div role="alert"><p>{state.error}</p><button onClick={state.retry}>Retry reading statistics</button></div>:!state.dataset?<p role="status">Reading the battle ledger…</p>:recorded?<>
        <BattleStatistics key={recorded.gameId+'/'+recorded.revision+'/'+recorded.sourceHash} game={recorded} preview={preview} provisional={!recorded.eligible||!!selected?.resultDisputeOpen||!selected?.result} viewerId={snapshot.viewer?.playerId} openPlayer={openPlayer}/>
        <section className="battle-full-timeline" aria-label="Battle timeline"><BattleTimeline game={recorded}/></section>
      </>:<p className="sx-empty">This Game has no processed recording yet. Return to the Field of Battle to upload it.</p>}
    </div></BattleOverlay>}
  </div>;
}

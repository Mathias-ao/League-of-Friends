import {useCallback,useEffect,useState} from 'react';
import {canBrowseLeague,formatName,isWarmupMatch,type EventDetail,type EventRoundoff,type MatchDetail,type PlayerProfile} from '../domain/league';
import {Avatar,DateLabel,Modal} from './Primitives';
import {MatchDialogWithStatistics,ProfileDialogWithIdentity} from './StatisticsExperience';
import {EventDetails} from './EventDetails';
import {DetailLoadState} from './DetailSection';
import {accessCurrent,detailRevision,summaryPlayer,type DetailRequests,type DetailSelection,type EventTab} from './detailNavigation';
import type {ViewProps} from './App';

const authorityError=(error:unknown)=>['functions/permission-denied','functions/unauthenticated','functions/not-found']
  .includes((error as {code?:string})?.code??'')||(error as {accessChanged?:boolean})?.accessChanged===true||
  ((error as {code?:string})?.code==='functions/failed-precondition'&&/membership|linked/i.test((error as Error)?.message??''));
type Loaded={type:'event';data:EventDetail}|{type:'match';data:MatchDetail}|{type:'player';data:PlayerProfile};
export function DetailDialog(props:ViewProps&{actionError?:string;authUid:string|null|undefined;selection:DetailSelection;requests:DetailRequests;onClose:()=>void;openMatchFromEvent?:(id:string,tab:EventTab)=>void}){
  const {selection,repository,snapshot,requests}=props;
  const uid=props.authUid;
  const choiceIdentity=JSON.stringify([uid,snapshot.viewer?.playerId,selection.type,selection.id]);
  const [choiceState,setChoice]=useState<{identity:string;gameId?:string;tab?:'briefing'|'battles'|'roundoff'}>({identity:choiceIdentity,tab:selection.eventTab});
  const choice=choiceState.identity===choiceIdentity?choiceState:null;
  useEffect(()=>{setChoice(previous=>previous.identity===choiceIdentity?previous:{identity:choiceIdentity,tab:selection.eventTab});},[choiceIdentity,selection.eventTab]);
  const selectGame=useCallback((gameId:string|undefined)=>setChoice(previous=>({
    ...(previous.identity===choiceIdentity?previous:{identity:choiceIdentity}),gameId})),[choiceIdentity]);
  const selectTab=useCallback((tab:'briefing'|'battles'|'roundoff')=>setChoice(previous=>({
    ...(previous.identity===choiceIdentity?previous:{identity:choiceIdentity}),tab})),[choiceIdentity]);
  const [retry,setRetry]=useState(0);
  const [roundoffRetry,setRoundoffRetry]=useState(0);
  const [requestedRoundoff,setRequestedRoundoff]=useState('');
  const revision=detailRevision(snapshot,selection,uid),sourceKey=revision+'\n'+retry,key=sourceKey+'\n'+selection.request;
  const roundoffKey=key+'\n'+roundoffRetry;
  const [state,setState]=useState<{key:string;loaded?:Loaded;error?:string;denied?:boolean}>({key});
  const [roundoff,setRoundoff]=useState<{key:string;data?:EventRoundoff;error?:string;denied?:boolean}>({key:roundoffKey});
  const split=selection.type==='event'&&!!repository.eventEssential&&!!repository.eventRoundoff;
  const loaded=state.key===key?state.loaded:undefined;
  const wantsRoundoff=choice?.tab==='roundoff'||requestedRoundoff===key||(loaded?.type==='event'&&
    loaded.data.matches.filter(match=>isWarmupMatch(match)&&match.participants.some(p=>p.playerId===snapshot.viewer?.playerId)).length>1);
  const allowed=canBrowseLeague(snapshot)&&accessCurrent(repository,uid)&&(!repository.currentAuthUid||!!uid||repository.mode==='preview');
  useEffect(()=>{
    let active=true;setState({key});
    if(!allowed)return;
    const current=()=>active&&accessCurrent(repository,uid);
    const stop=repository.onAuthChange(()=>{if(!accessCurrent(repository,uid)){active=false;setState({key,denied:true});}});
    requests.read(sourceKey,async():Promise<Loaded>=>selection.type==='event'?
      {type:'event',data:await (split?repository.eventEssential!(selection.id):repository.event(selection.id))}:selection.type==='match'?
      {type:'match',data:await repository.match(selection.id)}:{type:'player',data:await repository.player(selection.id)})
      .then(loaded=>{
        if(!current()){if(active)setState({key,denied:true});return;}
        const id=loaded.type==='event'?loaded.data.event.eventId:loaded.type==='match'?loaded.data.match.matchId:loaded.data.player.playerId;
        if(id!==selection.id)throw Error('The selected detail changed. Retry.');
        if(loaded.type!=='player'&&loaded.data.viewer.playerId!==snapshot.viewer?.playerId){
          props.refreshStandings?.();
          throw Object.assign(new Error('Your league identity changed. Reopen the current selection.'),{accessChanged:true});
        }
        setState({key,loaded});
      }).catch(error=>{if(current())setState({key,error:error instanceof Error?error.message:'Please try again.',denied:authorityError(error)});});
    return()=>{active=false;stop();};
  },[repository,requests,key,allowed,split]);
  useEffect(()=>{
    let active=true;setRoundoff({key:roundoffKey});
    if(!allowed||!split||!wantsRoundoff)return;
    const current=()=>active&&accessCurrent(repository,uid);
    const stop=repository.onAuthChange(()=>{if(!accessCurrent(repository,uid)){active=false;setRoundoff({key:roundoffKey,denied:true});}});
    requests.read(sourceKey+'\nroundoff\n'+roundoffRetry,()=>repository.eventRoundoff!(selection.id)).then(result=>{
      if(!current()){if(active)setRoundoff({key:roundoffKey,denied:true});return;}
      if(result.eventId!==selection.id)throw Error('The selected Event changed. Retry.');
      setRoundoff({key:roundoffKey,data:result.roundoff});
    }).catch(error=>{if(current())setRoundoff({key:roundoffKey,error:error instanceof Error?error.message:'Please try again.',denied:authorityError(error)});});
    return()=>{active=false;stop();};
  },[repository,requests,roundoffKey,allowed,split,wantsRoundoff]);
  const current=state.key===key?state:null;
  const player=summaryPlayer(snapshot,selection.id);
  const event=snapshot.events.find(event=>event.eventId===selection.id);
  const match=snapshot.matches.find(match=>match.matchId===selection.id);
  const section=roundoff.key===roundoffKey?roundoff:null;
  const hidden=!allowed||current?.denied||section?.denied;
  const title=hidden?'League details':selection.type==='event'?(loaded?.type==='event'?loaded.data.event.title:event?.title)??'Event details':
    selection.type==='player'?(loaded?.type==='player'?loaded.data.player.steamName:player?.steamName)??'Player profile':'Field of Battle';
  const openMatch=(id:string)=>{
    if(selection.type==='event'&&props.openMatchFromEvent)props.openMatchFromEvent(id,choice?.tab??'briefing');
    else props.openMatch(id);
  };
  const retryRead=()=>setRetry(n=>n+1);
  const updated=()=>setRetry(n=>n+1);
  return <Modal title={title} wide className={selection.type==='event'?'event-modal':selection.type==='match'?'battle-modal':''} onClose={props.onClose}>
    {!hidden&&props.actionError&&<div className="alert" role="alert">{props.actionError}
      {props.refreshStandings&&<button type="button" disabled={props.busy} onClick={props.refreshStandings}>Refresh league state</button>}
    </div>}
    {hidden?<DetailLoadState label="League details" error={current?.error??'Access changed. Reopen the current selection.'} retry={retryRead}/>:
      selection.type==='player'&&(player||loaded?.type==='player')?<ProfileDialogWithIdentity key={revision} {...props}
        data={loaded?.type==='player'?loaded.data:undefined} summaryPlayer={player??undefined}
        recordsState={{status:loaded?'ready':current?.error?'error':'loading',error:current?.error,retry:retryRead}}
        openChronicleOnLoad={selection.openChronicle}/>:
      loaded?.type==='event'?<EventDetails {...props} openMatch={openMatch} data={split?{...loaded.data,roundoff:section?.data}:loaded.data} onUpdated={updated}
        selectedTab={choice?.tab??'briefing'} onSelectTab={selectTab}
        roundoffState={split?{status:section?.data?'ready':section?.error?'error':'loading',error:section?.error,
          request:()=>setRequestedRoundoff(key),retry:()=>setRoundoffRetry(n=>n+1)}:undefined}/>:
      loaded?.type==='match'?<MatchDialogWithStatistics key={selection.id} {...props} data={loaded.data} onUpdated={updated}
        selectedGameId={choice?.gameId} onSelectGame={selectGame}/>:
      <div className="detail-selection-summary" data-detail-shell={selection.type}>
        {selection.type==='event'&&event&&<header><h3>{event.title}</h3><p><DateLabel value={event.startsAt}/></p><span>{event.status.replaceAll('_',' ')}</span></header>}
        {selection.type==='event'&&snapshot.matches.filter(match=>match.eventId===selection.id).slice(0,8).map(match=>
          <button key={match.matchId} onClick={()=>openMatch(match.matchId)}>Open {formatName(match.format)} Battle · {match.matchId}</button>)}
        {selection.type==='match'&&match&&<header><h3>{formatName(match.format)}</h3><p>{match.status.replaceAll('_',' ')}</p>
          {match.participants.map(player=><button key={player.playerId} onClick={()=>props.openPlayer(player.playerId)}>{player.steamName}</button>)}</header>}
        {selection.type==='player'&&player&&<header><Avatar player={player} large/><h3>{player.steamName}</h3></header>}
        <DetailLoadState label={selection.type==='event'?'Event participation and Battles':selection.type==='match'?'Battle controls':'Player records'} error={current?.error} retry={retryRead}/>
      </div>}
  </Modal>;
}

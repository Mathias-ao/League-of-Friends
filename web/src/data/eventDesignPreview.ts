import type {EventDetail,LeagueSnapshot,MatchRecord} from '../domain/league';
import {selectEventShowcase} from '../domain/eventRoundoffShowcase';
import {illustrativeGame} from './statisticsFixtures';
export type EventDesignState='current'|'pairings'|'main'|'preparing'|'released'|'counted';
/** Synthetic design states only; never a publication producer or a live-data fallback. */
export function eventDesignPreview(data:EventDetail,snapshot:LeagueSnapshot,state:EventDesignState):EventDetail {
  if(state==='current')return data;
  const fallback=[{playerId:'sample-halvar',steamName:'Halvar'},{playerId:'sample-ulrik',steamName:'Ulrik'}];
  const candidates=[...(snapshot.viewer?[snapshot.viewer]:[]),...snapshot.players,...fallback];
  const players=candidates.filter((p,i)=>candidates.findIndex(other=>other.playerId===p.playerId)===i).slice(0,8);
  const eventId=data.event.eventId;
  const matches:MatchRecord[]=Array.from({length:Math.floor(players.length/2)},(_,i)=>({
    matchId:`${eventId}-design-W${i+1}`,eventId,format:'ONE_V_ONE',scoringAct:'WARMUP',status:i===0||state!=='pairings'?'COMPLETED':'READY',
    ...(i>0&&state==='pairings'?{playOpensAt:'2026-10-17T17:00:00Z',playClosesAt:'2026-10-24T17:00:00Z'}:{}),
    participants:players.slice(i*2,i*2+2).map((p,j)=>({...p,team:j+1,slot:j+1}))
  }));
  if(state!=='pairings')matches.push({matchId:`${eventId}-design-M1`,eventId,format:'FOUR_V_FOUR',scoringAct:'MAIN',status:state==='main'?'READY':'COMPLETED',participants:players.map((p,i)=>({...p,team:i<4?1:2,slot:i+1}))});
  for(const match of matches)if(match.status==='COMPLETED')match.result={revision:1,winningPlayerIds:match.participants.filter(p=>p.team===1).map(p=>p.playerId)};
  // Illustrative Emperor duel defeat exercises the categorical crown distinction.
  for(const match of matches)if(match.status==='COMPLETED'&&match.scoringAct==='WARMUP'&&match.participants.some(p=>p.playerId===snapshot.emperor?.playerId))match.result={revision:1,winningPlayerIds:match.participants.filter(p=>p.playerId!==snapshot.emperor?.playerId).map(p=>p.playerId)};
  if(state==='counted'&&players.length>=3){
    matches[0].result={revision:1,winningPlayerIds:[players[1].playerId]};
    matches.push({matchId:`${eventId}-design-W-extra`,eventId,format:'ONE_V_ONE',scoringAct:'WARMUP',status:'COMPLETED',participants:[{...players[0],team:1,slot:1},{...players[2],team:2,slot:2}],result:{revision:1,winningPlayerIds:[players[0].playerId]}});
  }
  const result:EventDetail={...data,
    event:{...data.event,startsAt:'2026-10-24T17:00:00Z',signupDeadlineAt:'2026-10-17T17:00:00Z',checkInOpensAt:'2026-10-24T16:30:00Z',checkInClosesAt:'2026-10-24T17:00:00Z',warmupOpensAt:'2026-10-17T17:00:00Z',maxParticipants:8,status:state==='preparing'||state==='released'?'COMPLETED':'ACTIVE',resultsRelease:{state:state==='released'?'RELEASED':state==='preparing'?'PREPARING':'COLLECTING',revision:state==='released'?1:undefined}},
    viewer:{...data.viewer,rsvp:'YES',signupState:'CONFIRMED',attendanceStatus:state==='pairings'?'NOT_CHECKED':'CHECKED_IN'},
    signup:{...data.signup,confirmedCount:players.length,waitingListCount:0,confirmed:players.map(p=>({...p,attendanceStatus:state==='pairings'?'NOT_CHECKED':'CHECKED_IN'}))},matches,roundoff:undefined};
  if(state==='released'||state==='counted')result.roundoff={revision:1,points:players.map(p=>({playerId:p.playerId,warmup:matches.find(m=>m.scoringAct==='WARMUP'&&m.participants.some(q=>q.playerId===p.playerId))?.result?.winningPlayerIds?.includes(p.playerId)?3:1,main:matches.find(m=>m.scoringAct==='MAIN')?.result?.winningPlayerIds?.includes(p.playerId)?10:4,placement:0,emperor:0})),showcase:selectEventShowcase({eventId,matches:matches.map(m=>({...m,acceptedGameIds:['sample-game-1'],standardStart:true,emperorPlayerIdAtApproval:m.scoringAct==='WARMUP'?snapshot.emperor?.playerId:null})),games:matches.map((m,i)=>illustrativeGame(m,i,players)),illustrative:true})};
  if(state==='counted'&&result.roundoff&&players[0]?.playerId===data.viewer.playerId){
    result.roundoff.points.find(row=>row.playerId===data.viewer.playerId)!.warmup=3;
    result.roundoff.viewerWarmupSelection={playerId:data.viewer.playerId,matchId:`${eventId}-design-W-extra`,points:3,win:true,resultRevision:1,sourceHash:`preview-${eventId}-design-W-extra`,otherWarmupCount:1};
  }
  return result;
}

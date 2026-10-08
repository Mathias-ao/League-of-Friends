import type {EventDetail,LeagueSnapshot,MatchRecord} from '../domain/league';
export type EventDesignState='current'|'pairings'|'main'|'preparing'|'released';
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
  const result:EventDetail={...data,
    event:{...data.event,startsAt:'2026-10-24T17:00:00Z',signupDeadlineAt:'2026-10-17T17:00:00Z',checkInOpensAt:'2026-10-24T16:30:00Z',checkInClosesAt:'2026-10-24T17:00:00Z',warmupOpensAt:'2026-10-17T17:00:00Z',maxParticipants:8,status:state==='preparing'||state==='released'?'COMPLETED':'ACTIVE',resultsRelease:{state:state==='released'?'RELEASED':state==='preparing'?'PREPARING':'COLLECTING',revision:state==='released'?1:undefined}},
    viewer:{...data.viewer,rsvp:'YES',signupState:'CONFIRMED',attendanceStatus:state==='pairings'?'NOT_CHECKED':'CHECKED_IN'},
    signup:{...data.signup,confirmedCount:players.length,waitingListCount:0,confirmed:players.map(p=>({...p,attendanceStatus:state==='pairings'?'NOT_CHECKED':'CHECKED_IN'}))},matches,roundoff:undefined};
  if(state==='released')result.roundoff={revision:1,points:players.map((p,i)=>({playerId:p.playerId,warmup:i%2===0?3:1,main:i<4?10:4,placement:0,emperor:0})),happenings:[
    {title:'Four duels, one battlefield',description:'The warm-ups gave way to the main 4v4. Both acts are collected in this Event record.',matchId:`${eventId}-design-M1`},
    {title:'The first encounter',description:`${players[0]?.steamName} and ${players[1]?.steamName} opened the warm-up act. Revisit their Battle record.`,matchId:`${eventId}-design-W1`}
  ]};
  return result;
}

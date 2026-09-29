import {EXPERIENCE_VERSION,METRICS,median,type GameStatistics,type PlayerMeasurement} from '../domain/statistics';
import type {MatchRecord,PlayerRecord} from '../domain/league';

/** Deliberately synthetic fixtures, confined to the labelled preview repository. */
export function illustrativeGame(match:MatchRecord,index:number,players:PlayerRecord[]):GameStatistics{
  const roster=match.participants;
  const unit=['Knight','Archer','Mangonel','Spearman','Scout Cavalry','Monk'];
  const game:GameStatistics={version:EXPERIENCE_VERSION,matchId:match.matchId,gameId:'sample-game-1',seasonId:'S001',eventId:match.eventId??null,format:match.format??'UNKNOWN',contextKey:`${match.format} · Lombardia · standard start`,orderAtMs:Date.parse(match.completedAt??'2026-09-01'),revision:1,sourceHash:'preview-'+match.matchId,eligible:match.status==='COMPLETED',exclusionReason:match.status==='DISPUTED'?'Result disputed':null,affectsSeason:true,affectsLifetime:true,durationMs:2700000+index*30000,players:[],episodes:[],evidenceTruncated:false,warnings:[]};
  game.players=roster.map((p,i)=>{
    const identity=Math.max(0,players.findIndex(x=>x.playerId===p.playerId));
    const values=Object.fromEntries(METRICS.map(m=>[m.id,null])) as Record<string,number|null>;
    Object.assign(values,{feudal:570000+i*23000+index*4000,castle:1150000+i*43000-index*12000,imperial:2010000+i*17000,
      villagers10:30+i+(index%3),commands5:155+i*18+index*3,darkAgeGap:14000+i*3200+index*600,firstLumberCamp:170000+i*6000+index*1500,firstMiningCamp:425000+i*9000+index*2500,
      feudalVillagers:23+i,firstMilitary:645000+i*13000,loom:532000,earlyWalls:identity*7,
      food:10000+index*640+i*930,wood:12000+index*850+i*620,gold:8000+index*500+i*900,stone:1500+i*900,total:0,housesBuilt:14+i+(index%4),tradeUnits:4+i+(index%3),tributeSent:250+i*110+index*45,tributeReceived:220+i*90+index*35,villagerRequests:70+i*6,tcIdle:12000+i*6000,extraTCs:2,secondTC:1260000+i*22000,thirdTC:1600000,
      militaryCommitment:11000+i*1700+index*600,militaryTechs:10+i+(index%5),unitRequests:120+i*20,raidsOut:0,raidsIn:0,skirmishes:8+i,skirmishTime:360000+i*32000,assistsOut:0,assistsIn:0,cooperation:0,
      scouting:12+i*1.8,expansionTCs:1+(i+index)%3,expansions:2+(i+index)%4,forward:(i+index)%5,forwardEco:(i+index)%3,walls:10+i*18,contact:420000+i*12000,apm:35+i*8+index,combatApm:48+i*10,response:8+i*2,responded:0,received:0});
    values.total=values.food!+values.wood!+values.gold!+values.stone!;
    const ally=roster.some(q=>q.playerId!==p.playerId&&q.team===p.team);
    if(!ally){values.assistsOut=null;values.assistsIn=null;values.cooperation=null;}
    return {playerId:p.playerId,name:p.steamName,team:p.team??null,civilization:['FRANKS','BRITONS','TEUTONS','BYZANTINES','SARACENS','ITALIANS'][identity%6],opening:['Scout Rush','Archer Rush','Fast Castle','Boom'][identity%4],mainUnit:unit[identity%6],values,
      unavailable:Object.fromEntries(Object.entries(values).filter(([,v])=>v===null).map(([k])=>[k,'No qualified opportunity in this format.'])),models:Object.fromEntries(METRICS.map(m=>[m.id,'ILLUSTRATIVE_V2'])),
      composition:{cavalry:values.unitRequests!*(i%2===0?.6:.1),archers:values.unitRequests!*(i%2===1?.6:.1),infantry:values.unitRequests!*.2,siege:values.unitRequests!*.1},responseTimes:[],
      byAge:Object.fromEntries(['dark','feudal','castle','imperial'].map((age,a)=>[age,Object.fromEntries(['food','wood','gold','stone','total'].map(k=>[k,values[k]!*([.05,.15,.35,.45][a])]))])),
      details:[{label:'Double-Bit Axe',value:'Research request',atMs:700000,category:'Economy'},{label:'Bodkin Arrow',value:'Research request',atMs:1400000,category:'Military'}]} as PlayerMeasurement;
  });
  for(const [i,p] of game.players.entries()){
    const opponent=game.players.find(q=>q.team!==p.team)!;
    const raids=2+(i+index)%4+(index===7&&i===1?7:0);
    for(let n=0;n<raids;n++){
      const atMs=740000+n*150000+i*15000;
      game.episodes.push({id:`raid-${i}-${n}`,kind:'raid',atMs,endMs:atMs+40000,actors:[p.playerId],targets:[opponent.playerId],label:'Detected raid'});
      p.values.raidsOut!++;opponent.values.raidsIn!++;opponent.values.received!++;
      if(n%3!==0){opponent.values.responded!++;opponent.responseTimes.push(8+i*2);}
    }
    const ally=game.players.find(q=>q.playerId!==p.playerId&&q.team===p.team);
    if(ally){
      const count=1+(i+index)%3;
      for(let n=0;n<count;n++){
        game.episodes.push({id:`assist-${i}-${n}`,kind:'assist',atMs:1400000+n*120000+i*15000,endMs:1400000+n*120000+i*15000,actors:[p.playerId],targets:[ally.playerId],label:'Defensive assist'});
        p.values.assistsOut!++;ally.values.assistsIn!++;
      }
      if(i%2===0){game.episodes.push({id:`coop-${i}`,kind:'cooperation',atMs:1900000,endMs:1980000,actors:[p.playerId,ally.playerId],targets:[opponent.playerId],label:'Cooperative attack'});p.values.cooperation!++;ally.values.cooperation!++;}
    }
    for(const age of ['feudal','castle','imperial'])game.episodes.push({id:`age-${i}-${age}`,kind:'age',atMs:p.values[age]!,endMs:p.values[age]!,actors:[p.playerId],targets:[],label:age+' timing ≈'});
  }
  if(index===7&&game.players.length>=4)game.episodes.push({id:'great-1',kind:'greatBattle',atMs:1840000,endMs:1920000,actors:game.players.map(p=>p.playerId),targets:[],label:'Great Battle'});
  for(const p of game.players){p.values.response=median(p.responseTimes);p.values.firstRaid=Math.min(...game.episodes.filter(e=>e.kind==='raid'&&e.actors.includes(p.playerId)).map(e=>e.atMs));}
  game.episodes.sort((a,b)=>a.atMs-b.atMs);
  return game;
}

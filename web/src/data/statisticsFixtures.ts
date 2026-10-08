import {EXPERIENCE_VERSION,METRICS,median,type GameStatistics,type PlayerMeasurement} from '../domain/statistics';
import type {MatchRecord,PlayerRecord} from '../domain/league';

/** Deliberately synthetic fixtures, confined to the labelled preview repository. */
export function illustrativeGame(match:MatchRecord,index:number,players:PlayerRecord[]):GameStatistics{
  const roster=match.participants;
  const unit=['Knight','Archer','Mangonel','Spearman','Scout Cavalry','Monk'];
  const firstUnit=['Scout Cavalry','Archer','Spearman','Scout Cavalry','Militia','Archer'];
  const wallStyle=['Open','Partially Walled','Fully Walled','Open','Partially Walled','Open'];
  const game:GameStatistics={version:EXPERIENCE_VERSION,matchId:match.matchId,gameId:'sample-game-1',seasonId:'S001',eventId:match.eventId??null,format:match.format??'UNKNOWN',contextKey:`${match.format} · Lombardia · standard start`,orderAtMs:Date.parse(match.completedAt??'2026-09-01'),revision:1,sourceHash:'preview-'+match.matchId,eligible:match.status==='COMPLETED',exclusionReason:match.status==='DISPUTED'?'Result disputed':null,affectsSeason:true,affectsLifetime:true,durationMs:2700000+index*30000,players:[],episodes:[],evidenceTruncated:false,warnings:[]};
  game.players=roster.map((p,i)=>{
    const identity=Math.max(0,players.findIndex(x=>x.playerId===p.playerId));
    const values=Object.fromEntries(METRICS.map(m=>[m.id,null])) as Record<string,number|null>;
    Object.assign(values,{
      // Existing shared statistics used by Battle/Event surfaces.
      feudal:570000+i*23000+index*4000,castle:1150000+i*43000-index*12000,imperial:2010000+i*17000,feudalVillagers:23+i,firstMilitary:645000+i*13000,
      food:10000+index*640+i*930,wood:12000+index*850+i*620,gold:8000+index*500+i*900,stone:1500+i*900,total:0,thirdTC:1600000,militaryCommitment:11000+i*1700+index*600,
      firstRaid:740000+i*15000,skirmishes:8+i,skirmishTime:360000+i*32000,assistsIn:0,combatApm:48+i*10,responded:0,received:0,

      // Opening catalogue.
      buildOrderExecution:76+identity*3+(index%5),villagers10:29+i+(index%3),tcIdle:12000+i*6000,earlyWalls:identity*7,loom:532000+i*3500,
      housesBeforeFeudal:3+(identity%3),darkAgeGap:14000+i*3200+index*600,firstMiningCamp:425000+i*9000+index*2500,firstLumberCamp:170000+i*6000+index*1500,
      commands5:155+i*18+index*3,scouting:12+i*1.8+(index%3)*.4,

      // Economy catalogue.
      villagerRequests:70+i*6+(index%4),villagers20:48+i*2+(index%3),townCenters:2+(i+index)%3,secondTC:1260000+i*22000,
      economyBuildings:31+i*4+(index%5),horseCollar:760000+i*9000,farmsPlaced:28+i*3+(index%5),farmsBeforeCastle:16+i*2+(index%4),boarsLured:1+((i+index)%2),
      ecoMilitary20:1.2+i*.18+(index%3)*.05,economyTechs:8+i+(index%3),housesBuilt:14+i+(index%4),marketSales:(i+index)%5,marketPurchases:(i*2+index)%4,
      tradeUnits:4+i+(index%3),tributeSent:250+i*110+index*45,tributeReceived:220+i*90+index*35,

      // Military catalogue.
      unitRequests:120+i*20+(index%5),militaryBuildingsCastle:2+(i+index)%4,battlesFought:3+(i+index)%5,battleTime:300000+i*45000+index*12000,greatBattles:0,
      raidsOut:0,raidsIn:0,reinforcements:1+(i+index)%4,cooperation:0,assistsOut:0,castles:1+(i+index)%3,firstCastle:1510000+i*25000+index*4000,
      militaryTechs:10+i+(index%5),blacksmith30:5+i+(index%3),army10:800+i*120+index*35,army15:2100+i*250+index*80,army20:4300+i*420+index*130,

      // Map Presence catalogue.
      mapCoverage:38+i*4+(index%4),enemySide:26+i*5+(index%3),forward:(i+index)%5,forwardEco:(i+index)%3,expansionTCs:1+(i+index)%3,
      contact:420000+i*12000,goldControl:18+i*8+(index%4),relics:(i+index)%5,firstRelic:1080000+i*35000+index*5000,walls:10+i*18,towers:(i+index)%4,firstAggression:null,

      // Execution catalogue.
      apm:35+i*8+index,firstCommand:9000+i*1800,response:8+i*2,garrisonsDuringRaids:(i+index)%4,ecoActionsFights:18+i*5+(index%4),
      longestInactivity:52000+i*8500+index*900,townBell:(i+index)%2,backToWork:1+(i+index)%4,

      // Distinct older aliases retained for Battle/Event previews.
      extraTCs:2,expansions:2+(i+index)%4,
    });
    values.total=values.food!+values.wood!+values.gold!+values.stone!;
    const ally=roster.some(q=>q.playerId!==p.playerId&&q.team===p.team);
    if(!ally){values.assistsOut=null;values.assistsIn=null;values.cooperation=null;values.reinforcements=null;}
    const modelIds=[...new Set([...METRICS.map(m=>m.id),...Object.keys(values),'firstMilitaryUnit','wallStyle'])];
    const unavailable=Object.fromEntries(Object.entries(values).filter(([,v])=>v===null).map(([k])=>[k,k==='firstAggression'?'First Aggression does not yet have a qualified deterministic replay definition.':'No qualified opportunity in this format.']));
    const player={playerId:p.playerId,name:p.steamName,team:p.team??null,civilization:['FRANKS','BRITONS','TEUTONS','BYZANTINES','SARACENS','ITALIANS'][identity%6],opening:['Scout Rush','Archer Rush','Fast Castle','Boom'][identity%4],mainUnit:unit[identity%6],values,unavailable,models:Object.fromEntries(modelIds.map(id=>[id,'ILLUSTRATIVE_V3'])),
      composition:{cavalry:values.unitRequests!*(i%2===0?.6:.1),archers:values.unitRequests!*(i%2===1?.6:.1),infantry:values.unitRequests!*.2,siege:values.unitRequests!*.1},responseTimes:[],
      byAge:Object.fromEntries(['dark','feudal','castle','imperial'].map((age,a)=>[age,Object.fromEntries(['food','wood','gold','stone','total'].map(k=>[k,values[k]!*([.05,.15,.35,.45][a])]))])),
      details:[{label:'Double-Bit Axe',value:'Research request',atMs:700000,category:'Economy'},{label:'Bodkin Arrow',value:'Research request',atMs:1400000,category:'Military'}],
      seasonText:{firstMilitaryUnit:firstUnit[identity%firstUnit.length],wallStyle:wallStyle[identity%wallStyle.length]}} as PlayerMeasurement&{seasonText:Record<string,string>};
    return player;
  });
  // Influence shares cannot collectively exceed 100%, even in an illustrative recording.
  const influenceWeight=game.players.reduce((n,_,i)=>n+3+i*2,0);
  for(const [i,p] of game.players.entries())p.values.goldControl=100*(3+i*2)/influenceWeight;
  // Distinct, deliberately illustrative Event performances, also visible in linked Battle statistics.
  if(match.matchId.endsWith('-design-M1')){
    if(game.players[2])game.players[2].values.farmsPlaced=185;
    if(game.players[4])game.players[4].values.battlesFought=34;
    if(game.players[6])game.players[6].values.army20=8500;
  }
  for(const [i,p] of game.players.entries()){
    const opponent=game.players.find(q=>q.team!==p.team)!;
    const raids=match.matchId.endsWith('-design-M1')&&i===1?22:2+(i+index)%4+(index===7&&i===1?7:0);
    for(let n=0;n<raids;n++){
      const atMs=740000+n*(raids>10?65000:150000)+i*15000;
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
  if(index===7&&game.players.length>=4){game.episodes.push({id:'great-1',kind:'greatBattle',atMs:1840000,endMs:1920000,actors:game.players.map(p=>p.playerId),targets:[],label:'Great Battle'});for(const player of game.players)player.values.greatBattles=1;}
  for(const p of game.players){p.values.response=median(p.responseTimes);p.values.firstRaid=Math.min(...game.episodes.filter(e=>e.kind==='raid'&&e.actors.includes(p.playerId)).map(e=>e.atMs));}
  game.episodes.sort((a,b)=>a.atMs-b.atMs);
  return game;
}

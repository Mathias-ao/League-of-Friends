import type {
  MatchRecord,
  PlayerRecord,
  PlayerRelationshipSummary,
} from '../domain/league';

interface SharedHistoryRow {
  player: PlayerRecord;
  matchesTogether: number;
  wins: number;
  losses: number;
}

interface PreviewRelationshipData {
  opponents: SharedHistoryRow[];
  teammates: SharedHistoryRow[];
  relationships: PlayerRelationshipSummary[];
}

const track=(stageId:string|null,state='ACTIVE',historicalPeakStageId:string|null=stageId)=>({
  status:'READY',state,stageId,historicalPeakStageId
});

const pair=(left:string,right:string)=>[left,right].sort().join('|');

const fixtures:Record<string,Omit<PlayerRelationshipSummary,'otherPlayer'>>={
  [pair('sample-you','sample-ragnar')]:{
    pairId:'preview-you-ragnar',
    relationshipEngineVersion:'AOF_RELATIONSHIP_ENGINE_V2',
    relationshipRulesConfigured:true,
    tracks:{
      rivalry:track('Rivalry','DORMANT','Nemesis'),
      hostility:track('Grudge','DORMANT','Feud'),
      bond:track(null,'ACTIVE',null),
    },
    chronicle:[
      {entryId:'yr-5',matchId:'preview-battle-8',eventId:'preview-campaign',seasonId:'S001',playedAt:'2026-09-17T18:00:00Z',kind:'OPPOSED_NO_CONTACT',title:'The quarrel went quiet',text:'They met again as opponents. With interaction coverage available, no qualifying direct pair contact was recorded.',relation:'OPPOSED',tracksTouched:['RIVALRY','HOSTILITY']},
      {entryId:'yr-4',matchId:'preview-battle-6',eventId:'preview-campaign',seasonId:'S001',playedAt:'2026-09-15T18:00:00Z',kind:'OPPOSED_CONTACT',title:'The contest was answered',text:'Both players contributed qualifying direct pressure during the Battle. Their rivalry had become reciprocal.',relation:'OPPOSED',tracksTouched:['RIVALRY','HOSTILITY']},
      {entryId:'yr-3',matchId:'preview-battle-4',eventId:'preview-campaign',seasonId:'S001',playedAt:'2026-09-13T18:00:00Z',kind:'HOSTILE_PRESSURE',title:'Pressure without reply',text:'Ragnar directed repeated qualified pressure toward D’Karius. The hostility remained one-sided at this point.',relation:'OPPOSED',tracksTouched:['HOSTILITY']},
      {entryId:'yr-2',matchId:'preview-battle-1',eventId:'preview-campaign',seasonId:'S001',playedAt:'2026-09-10T18:00:00Z',kind:'OPPOSED_CONTACT',title:'A recurring contest began',text:'They met as opponents again and recorded qualifying direct interaction.',relation:'OPPOSED',tracksTouched:['RIVALRY']},
      {entryId:'yr-1',matchId:'sample-duel',eventId:null,seasonId:'S001',playedAt:'2026-09-06T18:00:00Z',kind:'FIRST_OPPOSED',title:'First meeting across the battlefield',text:'Their first recorded encounter placed them on opposing sides.',relation:'OPPOSED',tracksTouched:[]},
    ],
  },
  [pair('sample-you','sample-baguette')]:{
    pairId:'preview-you-baguette',
    relationshipEngineVersion:'AOF_RELATIONSHIP_ENGINE_V2',
    relationshipRulesConfigured:true,
    tracks:{
      rivalry:track(null,'ACTIVE',null),
      hostility:track('Tension','ACTIVE','Grudge'),
      bond:track('Fellowship','ACTIVE','Trusted Allies'),
    },
    chronicle:[
      {entryId:'yb-4',matchId:'preview-battle-8',eventId:'preview-campaign',seasonId:'S001',playedAt:'2026-09-17T18:00:00Z',kind:'ALLIED_COOPERATION',title:'The line held together',text:'They recorded qualifying cooperative action while fighting beneath the same banner.',relation:'ALLIED',tracksTouched:['HOSTILITY','BOND']},
      {entryId:'yb-3',matchId:'preview-battle-5',eventId:'preview-campaign',seasonId:'S001',playedAt:'2026-09-14T18:00:00Z',kind:'ALLIED_NO_COOPERATION',title:'An uneasy alliance',text:'They fought as allies, but available interaction coverage recorded no qualifying cooperation between them.',relation:'ALLIED',tracksTouched:['HOSTILITY']},
      {entryId:'yb-2',matchId:'preview-battle-3',eventId:'preview-campaign',seasonId:'S001',playedAt:'2026-09-12T18:00:00Z',kind:'ALLIED_COOPERATION',title:'Aid under pressure',text:'D’Karius reinforced Lord Baguette during a qualified defensive episode.',relation:'ALLIED',tracksTouched:['HOSTILITY','BOND']},
      {entryId:'yb-1',matchId:'preview-battle-1',eventId:'preview-campaign',seasonId:'S001',playedAt:'2026-09-10T18:00:00Z',kind:'FIRST_ALLIED',title:'First battle under one banner',text:'Their first recorded shared Battle placed them on the same side.',relation:'ALLIED',tracksTouched:[]},
    ],
  },
  [pair('sample-you','sample-steve')]:{
    pairId:'preview-you-steve',
    relationshipEngineVersion:'AOF_RELATIONSHIP_ENGINE_V2',
    relationshipRulesConfigured:true,
    tracks:{
      rivalry:track('Contest','ACTIVE','Contest'),
      hostility:track('Tension','ACTIVE','Tension'),
      bond:track(null,'ACTIVE',null),
    },
    chronicle:[
      {entryId:'ys-3',matchId:'preview-battle-7',eventId:'preview-campaign',seasonId:'S001',playedAt:'2026-09-16T18:00:00Z',kind:'OPPOSED_CONTACT',title:'The contest continued',text:'Another Battle produced qualifying direct interaction between them.',relation:'OPPOSED',tracksTouched:['RIVALRY']},
      {entryId:'ys-2',matchId:'preview-battle-4',eventId:'preview-campaign',seasonId:'S001',playedAt:'2026-09-13T18:00:00Z',kind:'HOSTILE_PRESSURE',title:'Pressure crossed the line',text:'Qualified directed pressure added tension to an already recurring matchup.',relation:'OPPOSED',tracksTouched:['HOSTILITY']},
      {entryId:'ys-1',matchId:'preview-battle-2',eventId:'preview-campaign',seasonId:'S001',playedAt:'2026-09-11T18:00:00Z',kind:'OPPOSED_CONTACT',title:'First recorded contest',text:'They met on opposing sides and recorded qualifying direct interaction.',relation:'OPPOSED',tracksTouched:['RIVALRY']},
    ],
  },
};

function sharedHistory(playerId:string,players:PlayerRecord[],matches:MatchRecord[]){
  const playersById=new Map(players.map(player=>[player.playerId,player]));
  const opponentRows=new Map<string,{matchesTogether:number;wins:number;losses:number}>();
  const teammateRows=new Map<string,{matchesTogether:number;wins:number;losses:number}>();

  for(const match of matches){
    const subject=match.participants.find(player=>player.playerId===playerId);
    if(!subject)continue;
    const won=match.status==='COMPLETED'&&!!match.result?.winningPlayerIds?.includes(playerId);
    const resultKnown=match.status==='COMPLETED'&&!!match.result?.winningPlayerIds?.length;
    for(const other of match.participants){
      if(other.playerId===playerId)continue;
      const allied=subject.team!=null&&other.team!=null&&subject.team===other.team;
      const rows=allied?teammateRows:opponentRows;
      const row=rows.get(other.playerId)??{matchesTogether:0,wins:0,losses:0};
      row.matchesTogether++;
      if(resultKnown){if(won)row.wins++;else row.losses++;}
      rows.set(other.playerId,row);
    }
  }

  const materialize=(rows:Map<string,{matchesTogether:number;wins:number;losses:number}>):SharedHistoryRow[]=>[...rows.entries()]
    .map(([otherPlayerId,row])=>({player:playersById.get(otherPlayerId)??{playerId:otherPlayerId,steamName:otherPlayerId},...row}))
    .sort((left,right)=>right.matchesTogether-left.matchesTogether||left.player.steamName.localeCompare(right.player.steamName));

  return {opponents:materialize(opponentRows),teammates:materialize(teammateRows)};
}

export function previewRelationshipData(playerId:string,players:PlayerRecord[],matches:MatchRecord[]):PreviewRelationshipData{
  const shared=sharedHistory(playerId,players,matches);
  const playersById=new Map(players.map(player=>[player.playerId,player]));
  const relationships:Object[]=[];

  for(const [key,fixture] of Object.entries(fixtures)){
    const [first,second]=key.split('|');
    if(playerId!==first&&playerId!==second)continue;
    const otherPlayerId=playerId===first?second:first;
    const otherPlayer=playersById.get(otherPlayerId);
    if(!otherPlayer)continue;
    relationships.push({...fixture,otherPlayer});
  }

  return {
    ...shared,
    relationships:(relationships as PlayerRelationshipSummary[]).sort((left,right)=>left.otherPlayer.steamName.localeCompare(right.otherPlayer.steamName)),
  };
}

"""Export bounded, actual decoder evidence for the backend qualification tests."""
import sys,json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(root/'replay-tools'))
from header_compat import parse
from canonical_stream import frames,ExactReader,command_layout
from mgz.fast import meta
from parse_replay import extract_players,build_settings,text,json_safe
from match_facts import compact_header
out=[]
for filename in ['1v1_1.aoe2record','1v1_2.aoe2record','aof-test-game-1.aoe2record','aof-test-game-2.aoe2record','aof-test-game-3.aoe2record','2v2.aoe2record','3v3.aoe2record','4v4.aoe2record']:
 p=root/'replay-fixtures'/filename
 if not p.exists():continue
 sourceHash=hashlib.sha256(p.read_bytes()).hexdigest()
 with p.open('rb') as h:
  header=parse(h);meta(ExactReader(h,p.stat().st_size));players=extract_players(header,[]);settings=build_settings(header,players)
  clock=0;resigns=[];post=[];complete=True
  for n,(op,payload,begin,end,raw,error) in enumerate(frames(h,p.stat().st_size)):
   if op=='SYNC':clock+=payload[0]
   if op=='UNKNOWN':complete=False
   if op=='ACTION' and payload[0].name=='RESIGN':
    layout=command_layout(raw,'RESIGN');disconnected=layout.get('disconnectedRaw')
    resigns.append(dict(replaySlot=payload[1].get('player_id'),atMs=clock,sourceEventId=f'OP{n}',operationOrdinal=n,commandLayout=layout['layout'],disconnected=bool(disconnected) if disconnected in (0,1) else None))
   if op=='POSTGAME':post.append(dict(sourceEventId=f'OP{n}',timestampMs=clock,operationOrdinal=n,decoded=json_safe(payload)))
  compact=compact_header(header)
  facts=dict(source={'replaySha256':sourceHash},game=dict(guid=text(header.get('de',{}).get('guid')),observedDurationMs=clock,bodyParseComplete=complete,resignationCommandCount=len(resigns),recordingVersion={'save_version':header['save_version']}),headerFieldCandidates={section+'.'+k:json_safe(v) for section,data in compact.items() if isinstance(data,dict) for k,v in data.items()},rules={k:{'value':v} for k,v in settings.items()},players=[dict(playerId=p['replaySlot'],lobbyTeamIdRaw=p['teamId'],civilization={'rawId':p['civilizationId']}) for p in players],diplomacy={'commandTimelines':{}},result=dict(resignationEvidence=resigns,postgameEvidence=post))
  out.append(dict(filename=filename,sourceHash=sourceHash,players=[{k:p[k] for k in ['replaySlot','name','teamId','civilizationId']} for p in players],matchFacts=facts))
 (root/'functions/tests/fixtures/recording-outcomes.json').write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8')
 print(filename,clock,len(players),[(r['replaySlot'],r['disconnected']) for r in resigns],len(post))

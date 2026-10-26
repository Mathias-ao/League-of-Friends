"""#168 emulator-only worker orchestration, no new parser/detector/scorer.

Restore verified native shared delivery with the existing lossless reader, then
reuse #165 identity proof and #167's exact method admission. Canonical league
order, Claims and historical simulation remain server-owned in Functions.
"""
import base64
import gzip
import hashlib
import json
from int_c1_preview import load_preview_request, prepare_preview_inputs, require
from int_c2a_preview import preview_candidates_from_analysis
from social_v1_source_grades import admit_contextual_source_grades
from statistics_direct_shared import restore_full_statistics, VERSION as DELIVERY

VERSION='AOF_SOCIAL_E2E_WORKER_1'

def progression_from_analysis(*,snapshot,statistics,analysis,historical_order):
    require(statistics.get('sharedEpisodeDelivery',{}).get('version')==DELIVERY,'VERIFIED_NATIVE_SHARED_DELIVERY_REQUIRED')
    full=restore_full_statistics(statistics)  # Existing offline compatibility reader, ONLY in the demo worker route.
    base=preview_candidates_from_analysis(snapshot=snapshot,statistics=full,analysis=analysis,historical_order=historical_order)
    context,measurements=prepare_preview_inputs(snapshot=snapshot,statistics=full,analysis=analysis)
    admission=admit_contextual_source_grades(statistics=full,context=context,source_measurements=measurements,
        action_events=analysis['actionEvents'],game_scope=base['producer']['gameScope'],producer=base['producer'])
    refs={ref for e in admission['episodes'] for g in e['perTrackGrades'] for ref in g['sourceEventIds']}
    refs.update(ref for e in admission['episodes'] for g in e['perTrackGrades'] for c in g['corroboration'] for ref in c['sourceEventIds'])
    require(len(refs)<=20000,'E2E_SOURCE_WITNESS_BUDGET_EXCEEDED')
    witnesses={e['eventId']:{'sourceEventId':e['eventId'],'actorReplaySlot':e['actorPlayerId'],
        'atMs':e['timestampMs'],'operationOrdinal':e.get('operationOrdinal'),'action':e.get('sourceActionName')}
        for e in analysis['actionEvents'] if e['eventId'] in refs}
    require(set(witnesses)==refs,'E2E_SOURCE_WITNESS_MISSING')
    return {'version':VERSION,'inputModel':DELIVERY,'compatibility':base,'admission':admission,
        'gradeWitnesses':[witnesses[k] for k in sorted(witnesses)]}

def process_progression(request):
    require(isinstance(request,dict) and set(request)=={'snapshot','events','statisticsArtifact','historicalOrder'},'INVALID_PRIVATE_E2E_REQUEST')
    packet=request['statisticsArtifact'];require(isinstance(packet,dict) and set(packet)=={'metadata','base64'},'INVALID_STATISTICS_ARTIFACT')
    meta=packet['metadata'];require(type(meta.get('bytes')) is int and 0<meta['bytes']<=16*1024*1024 and
        type(meta.get('uncompressedBytes')) is int and 0<meta['uncompressedBytes']<=128*1024*1024,'E2E_STATISTICS_BUDGET_EXCEEDED')
    raw=base64.b64decode(packet['base64'],validate=True)
    require(len(raw)==meta['bytes'] and hashlib.sha256(raw).hexdigest()==meta['sha256'],'E2E_STATISTICS_INTEGRITY')
    require(any(r['kind']=='STATISTICS' and r['digest']==meta['sha256'] and r['generation']==str(meta['generation'])
                for r in request['snapshot']['artifactRefs']),'E2E_STATISTICS_SNAPSHOT_MISMATCH')
    # Exact bounded decompression, no caller-selected statistics or methods.
    import io
    with gzip.GzipFile(fileobj=io.BytesIO(raw)) as source:
        plain=source.read(meta['uncompressedBytes']+1)
    require(len(plain)==meta['uncompressedBytes'] and hashlib.sha256(plain).hexdigest()==meta['uncompressedSha256'],'E2E_STATISTICS_UNCOMPRESSED_INTEGRITY')
    statistics=json.loads(plain)
    loaded=load_preview_request({'snapshot':request['snapshot'],'statistics':statistics,
        'events':request['events'],'historicalOrder':request['historicalOrder']})
    return progression_from_analysis(**loaded)

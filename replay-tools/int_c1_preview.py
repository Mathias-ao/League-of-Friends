"""INT-C1 transport/admission only. Grade methods remain Worker 4's #153.

Reuse retained-stream decoder, Context V2, #149 and #141; never another parser,
metric formula or progression evaluator. Missing grade admission only DOWN-gates.
"""
import base64
import hashlib
import json
from pathlib import Path
import tempfile
from recorded_events_stream import load_analysis
from social_v1_context import project_social_v1_context
from social_v1_source_measurements import project_social_source_measurements
from social_v1_inference import qualify_social_v1
from social_v1_contract import validate_record
from native_worker_transport import native_processor_revision

VERSION = 'AOF_INT_C1_WORKER_PREVIEW_1'
GRADE_DTO = 'AOF_INT_C1_PENDING_GRADE_ENVELOPE_1'
TEST = json.loads(Path(__file__).with_name('int_c1_wiring_test.json').read_text())
def digest(v):
    return hashlib.sha256(json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()).hexdigest()
POLICY_DIGEST = digest(TEST)
def require(ok, code):
    if not ok:
        raise ValueError(code)


def contribution_groups(deeds, snapshot):
    """Conservative source-overlap components, not a scoring/episode detector.
    Same original event OR detector incident may not multiply into new credits.
    No clock/name proximity joins, and no cross-original source rebind.
    """
    parent = {d['deedId']: d['deedId'] for d in deeds}
    def root(k):
        while parent[k] != k:
            parent[k] = parent[parent[k]]
            k = parent[k]
        return k
    seen = {}
    for deed in sorted(deeds, key=lambda d: d['deedId']):
        for tag, refs in [('EVENT', deed.get('sourceEventIds', [])), ('INCIDENT', deed.get('incidentIds', []))]:
            for ref in refs:
                key = (tag, ref)
                if key in seen:
                    a, b = sorted([root(deed['deedId']), root(seen[key])])
                    parent[b] = a
                seen[key] = deed['deedId']
    groups = {}
    for did in parent:
        groups.setdefault(root(did), []).append(did)
    return {did: 'group-'+digest([snapshot['gameGuid'], snapshot['sourceHash'], sorted(members)])
            for members in groups.values() for did in members}


def preview_from_analysis(*, snapshot, statistics, analysis, historical_order):
    validate_record('SourceSnapshot', snapshot)
    require(snapshot['gameGuid'] and len(snapshot['artifactRefs']) == 3, 'NATIVE_SNAPSHOT_REQUIRED')
    source = analysis['source']
    require(all(source.get(k) == statistics['source'].get(k) for k in
                ('replaySha256','recordedEventsSha256','recordedEventsVersion','extractionRunId','parserVersion')),
            'RETAINED_EVENTS_STATISTICS_SOURCE_MISMATCH')
    require(source['replaySha256'] == snapshot['sourceHash'], 'SNAPSHOT_SOURCE_MISMATCH')
    events_ref = next(r for r in snapshot['artifactRefs'] if r['kind'] == 'RECORDED_EVENTS')
    require(events_ref['digest'] == source['recordedEventsSha256'], 'EVENT_ARTIFACT_MISMATCH')
    context = project_social_v1_context(statistics=statistics)  # TERR is unconfigured.
    descriptors = project_social_source_measurements(statistics=statistics, context=context,
        action_events=analysis['actionEvents'], lookback_ms=TEST['lookbackMs'])
    pair = statistics['pairSocialEvidence']
    groups = contribution_groups(pair['deeds'], snapshot)
    lineages = {d['deedId']: {'incidentId':'incident-'+digest([snapshot['gameGuid'],snapshot['sourceHash'],d['deedId']]),
        'overlapGroupId':groups[d['deedId']], 'state':'CURRENT','lineage':'SOURCE_ANCHORED'} for d in pair['deeds']}
    original = [{'sourceEventId':e['eventId'],'actorPlayerId':e['actorPlayerId'],
        'moment':{'atMs':e['timestampMs'],'operationOrdinal':e.get('operationOrdinal')}} for e in analysis['actionEvents']]
    result = qualify_social_v1(snapshot=snapshot, context=context, pair_deeds=pair['deeds'],pair_observations=original,
        replay_bindings={'players':{r['replaySlot']:r['playerId'] for r in snapshot['roster']},
            'methodVersions':list(TEST['qualifier']['measurementMethods'].values())},
        incident_lineages=lineages, measurements=[],calibration=TEST['qualifier'],historical_order=historical_order)
    # No #153 grade method or #152 matrix is approved/installed. Even a proposal
    # that #141 could qualify must NOT become admitted conduct or a stage.
    for inf in result['inferences']:
        inf.update(decision='PENDING',significanceBandId=None)
        inf['coverage']['tier']='LIMITED'
        inf['reasonCodes']=sorted(set(inf['reasonCodes']+['GRADE_METHOD_AND_OWNER_MATRIX_PENDING']))
        inf['coverage']['limitations'].append('NO_GRADE_ADMISSION_INSTALLED')
        validate_record('Inference',inf)
    for row in result['effects']:
        claim=row['claim'];claim.update(decision='PENDING',significanceBandId=None)
        claim['reciprocity'].update(decision='INELIGIBLE',independentActorRefs=[])
        claim['claimRevision']=digest([claim['claimRevision'],GRADE_DTO,'PENDING',POLICY_DIGEST])
        validate_record('Claim',claim)
    result['actorWitnesses']=[]
    bindings={r['replaySlot']:r['playerId'] for r in snapshot['roster']}
    grades=[]
    windows={d['sourceDeedId']:d for d in context['deedContexts']}
    for obs in descriptors['observations']:
        did=obs['sourceDeedId']; window=windows[did]
        grades.append({'version':GRADE_DTO,'candidateId':obs['observationId'],
            'sourceAuthority':snapshot['authorityRevision'],'sourceContextRevision':context['sourceContextRevision'],
            'sourceDeedId':did,'incidentId':lineages[did]['incidentId'],'contributionGroupId':groups[did],
            'actorPlayerId':bindings[obs['fromReplayPlayerId']],'counterpartPlayerId':bindings[obs['toReplayPlayerId']],
            'actorReplaySlot':obs['fromReplayPlayerId'],'counterpartReplaySlot':obs['toReplayPlayerId'],
            'metricId':obs['kind'],'measurementMethodVersion':obs['methodVersion'],
            'raw':{'value':obs['recordedCommandCount'],'unit':'RECORDED_COMMAND_REQUESTS','opportunity':None},
            'window':{'startMs':window['firstAtMs'],'endMs':window['lastAtMs']},
            'firstSourceMoment':obs['firstSourceMoment'],'sourceEventIds':obs['sourceEventIds'],
            'meaning':obs['layer'],'coverage':'LIMITED',
            'grade':{'status':'PENDING','methodVersion':None,'ruleVersion':None,'bandId':None,
                     'reasonCodes':['GRADE_METHOD_AND_OWNER_MATRIX_PENDING','COMMAND_EXECUTION_NOT_PROVEN']},
            'counterevidenceRefs':[], 'missing':['ADMITTED_OPPORTUNITY','OWNER_METRIC_MATRIX','APPROVED_GRADE_METHOD']})
    allowed={(g['incidentId'],g['actorPlayerId'],g['counterpartPlayerId']) for g in grades}
    by_inf={i['inferenceId']:i for i in result['inferences']}
    result['effects']=[e for e in result['effects'] if any(
        (e['claim']['incidentId'],by_inf[r['id']]['action']['actorPlayerId'],
         by_inf[r['id']]['action']['counterpartPlayerId']) in allowed
        for r in e['claim']['supportRefs'] if r['kind']=='INFERENCE')]
    used={r['id'] for e in result['effects'] for r in e['claim']['supportRefs'] if r['kind']=='INFERENCE'}
    result['inferences']=[i for i in result['inferences'] if i['inferenceId'] in used]
    require(len(grades)<=1000 and len(result['effects'])<=10000, 'PREVIEW_EPISODE_BUDGET_EXCEEDED')
    return {'version':VERSION,'processorRevision':native_processor_revision(),
        'authorityRevision':snapshot['authorityRevision'],'sourceHash':snapshot['sourceHash'],
        'testPolicyDigest':POLICY_DIGEST,'contextVersion':context['version'],
        'sourceContextRevision':context['sourceContextRevision'],'grades':grades,
        'inferences':result['inferences'],'effects':result['effects'],'actorWitnesses':[],
        'officialWrites':False,'publicationAllowed':False,'gradeMethodsInstalled':False}


def process_preview(request):
    require(isinstance(request,dict) and set(request)=={'snapshot','statistics','events','historicalOrder'},'INVALID_PRIVATE_PREVIEW_REQUEST')
    envelope=request['events'];require(isinstance(envelope,dict) and set(envelope)=={'metadata','base64'},'INVALID_EVENTS_ENVELOPE')
    meta=envelope['metadata']
    require(type(meta.get('bytes')) is int and 0<meta['bytes']<=16*1024*1024 and
            type(meta.get('uncompressedBytes')) is int and 0<meta['uncompressedBytes']<=128*1024*1024,'PREVIEW_EVENTS_SIZE_LIMIT')
    raw=base64.b64decode(envelope['base64'],validate=True)
    require(len(raw)==meta['bytes'],'PREVIEW_EVENTS_SIZE_MISMATCH')
    with tempfile.TemporaryDirectory(prefix='aof-grade-preview-') as tmp:
        path=Path(tmp)/'events.jsonl.gz';path.write_bytes(raw)
        analysis=load_analysis(path,meta)  # Existing strict stream validator, exhausted in full.
    require(len(analysis['actionEvents'])<=600000,'PREVIEW_ACTION_BUDGET_EXCEEDED')
    return preview_from_analysis(snapshot=request['snapshot'], statistics=request['statistics'],
        analysis=analysis,historical_order=request['historicalOrder'])

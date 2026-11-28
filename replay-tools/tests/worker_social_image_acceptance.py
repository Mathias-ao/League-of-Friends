"""Bounded EU endpoint completeness witness; controlled league binding, no grants."""
from copy import deepcopy
import gzip
import base64
import json
from unittest.mock import patch


def verify_social(server, native, call):
    statistics = json.loads(gzip.decompress(base64.b64decode(native['statistics']['base64'])))
    facts = statistics['matchFacts']
    refs = [('STATISTICS', native['statistics']), ('RECORDED_EVENTS', native['recordedEvents']),
            ('ORIGINAL', {'sha256': native['sourceHash']})]
    snapshot = {'contract': 'AOF_SOCIAL_V1_SHARED_1', 'authorityRevision': 'a' * 64,
        'battleId': 'controlled-method-case', 'matchId': 'controlled-method-case', 'gameId': 'g1',
        'eventId': 'controlled-event', 'seasonId': 'controlled-season', 'gameGuid': facts['game']['guid'],
        'sourceHash': native['sourceHash'], 'statisticsRevision': 1,
        'artifactRefs': [{'kind': kind, 'digest': meta['sha256'], 'generation': '1'} for kind, meta in refs],
        'mappingDigest': 'b' * 64, 'eventAdmissionDigest': 'c' * 64,
        'outcome': {'qualification': 'UNRESOLVED', 'resultRevision': None, 'winningPlayerIds': None},
        'roster': [{'replaySlot': p['replaySlot'], 'playerId': 'controlled-player-' + str(p['replaySlot']),
                    'teamId': str(p['lobbyTeamIdRaw']) if p['lobbyTeamIdRaw'] is not None else None}
                   for p in facts['players']]}
    packet = {'snapshot': snapshot,
        'events': {'metadata': {**native['recordedEvents'], 'generation': '1'}, 'base64': native['recordedEvents']['base64']},
        'statisticsArtifact': {'metadata': {**native['statistics'], 'generation': '1'}, 'base64': native['statistics']['base64']},
        'historicalOrder': {'leagueOrderKey': None, 'gameNumber': 1, 'order': 'UNKNOWN'}}
    for key in ('events', 'statisticsArtifact'):
        packet[key]['metadata'].pop('base64')
    route = '/social-hosted-grade-v1'
    assert call(server, route, '{}', 'local-test-only')[0] == 404
    with patch.dict('os.environ', {'GCLOUD_PROJECT': 'age-of-friends-staging-eu',
         'FUNCTION_REGION': 'europe-west1', 'AOF_EU_TEST_PROGRESSION': 'v1',
         'AOF_SOCIAL_HOSTED_GRADE_V1_ENDPOINT': '1'}):
        for token in (None, 'wrong'):
            assert call(server, route, '{}', token)[0] == 401
        assert call(server, route, '{}', 'local-test-only')[0] == 400
        status, result = call(server, route, json.dumps(packet), 'local-test-only')
        assert status == 200, (status, result)
        assert result['compatibility']['sourceHash'] == native['sourceHash']
        assert result['compatibility']['processorRevision'] == native['processorRevision']
        tracks = {g['track'] for e in result['admission']['episodes'] for g in e['perTrackGrades']}
        assert tracks & {'GALLANTRY', 'CHIVALRY', 'CRUELTY'}, tracks
        assert tracks & {'RIVALRY', 'BOND', 'HOSTILITY'}, tracks
        for defect in ('source', 'generation', 'statistics'):
            changed = deepcopy(packet)
            if defect == 'source': changed['snapshot']['sourceHash'] = 'f' * 64
            elif defect == 'generation': changed['statisticsArtifact']['metadata']['generation'] = '2'
            else: changed['statisticsArtifact']['base64'] = base64.b64encode(b'tampered').decode()
            assert call(server, route, json.dumps(changed), 'local-test-only')[0] == 400, defect
    return {'httpStatus': 200, 'reputationAndRelationshipsEvaluated': True,
            'tracks': sorted(tracks), 'malformedAndProvenanceNegativesRejected': True,
            'defaultOffAndAuthenticationVerified': True, 'controlledLeagueBindingNotHostedHistory': True}

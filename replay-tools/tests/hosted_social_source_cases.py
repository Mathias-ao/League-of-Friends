"""Genuine retained-byte positives + explicitly CONTROLLED detector ablation.

No new source method. League IDs/authority below are a disclosed test binding,
not a hosted history. The separate Functions emulator test authenticates and
binds the real source->worker->DTO->mounted profile path.
"""
import base64
from copy import deepcopy
import gzip
from hashlib import sha256
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from int_c2b_progression import process_progression
from int_c1_preview import load_preview_request, prepare_preview_inputs
from social_v1_source_grades import admit_contextual_source_grades
from statistics_direct_shared import restore_full_statistics


def check_case(directory):
    root = Path(directory)
    manifest = json.loads((root / 'manifest.json').read_text())
    stats_meta, events_meta = manifest['statistics'], manifest['recordedEvents']
    stats_bytes = (root / stats_meta['path']).read_bytes()
    events_bytes = (root / events_meta['path']).read_bytes()
    assert sha256(stats_bytes).hexdigest() == stats_meta['sha256']
    assert sha256(events_bytes).hexdigest() == events_meta['sha256']
    statistics = json.loads(gzip.decompress(stats_bytes))
    facts = statistics['matchFacts']
    guid = facts['game']['guid']
    assert isinstance(guid, str) and guid
    snapshot = {'contract': 'AOF_SOCIAL_V1_SHARED_1', 'authorityRevision': 'a' * 64,
                'battleId': 'controlled-method-case', 'matchId': 'controlled-method-case', 'gameId': 'g1',
                'eventId': 'controlled-event', 'seasonId': 'controlled-season', 'gameGuid': guid,
                'sourceHash': manifest['source']['sha256'], 'statisticsRevision': 1,
                'artifactRefs': [{'kind': kind, 'digest': meta['sha256'], 'generation': str(meta.get('generation', '1'))}
                                 for kind, meta in [('STATISTICS', stats_meta), ('RECORDED_EVENTS', events_meta),
                                                    ('ORIGINAL', {'sha256': manifest['source']['sha256']})]],
                'mappingDigest': 'b' * 64, 'eventAdmissionDigest': 'c' * 64,
                'outcome': {'qualification': 'UNRESOLVED', 'resultRevision': None, 'winningPlayerIds': None},
                'roster': [{'replaySlot': p['replaySlot'], 'playerId': 'controlled-player-' + str(p['replaySlot']),
                            'teamId': str(p['lobbyTeamIdRaw']) if p['lobbyTeamIdRaw'] is not None else None}
                           for p in facts['players']]}
    packet = {'snapshot': snapshot,
              'events': {'metadata': events_meta, 'base64': base64.b64encode(events_bytes).decode()},
              'statisticsArtifact': {'metadata': stats_meta, 'base64': base64.b64encode(stats_bytes).decode()},
              'historicalOrder': {'leagueOrderKey': None, 'gameNumber': 1, 'order': 'UNKNOWN'}}
    original = process_progression(packet)  # existing strict artifact verifier + derivation
    full = restore_full_statistics(statistics)
    loaded = load_preview_request({'snapshot': snapshot, 'statistics': statistics,
                                   'events': packet['events'], 'historicalOrder': packet['historicalOrder']})
    # Source-preserving controlled negative: withhold only the independent Raid
    # detector, never change original bytes/commands/actors or label it natural.
    ablated = deepcopy(full)
    for player in ablated['participants']:
        raid = player.get('military', {}).get('engagements', {}).get('raidEvidence', {})
        raid['initiatedEpisodes'] = []
    context, measurements = prepare_preview_inputs(snapshot=snapshot, statistics=ablated, analysis=loaded['analysis'])
    negative = admit_contextual_source_grades(statistics=ablated, context=context,
        source_measurements=measurements, action_events=loaded['analysis']['actionEvents'],
        game_scope=original['compatibility']['producer']['gameScope'])
    tracks = ['GALLANTRY', 'CHIVALRY', 'RIVALRY', 'BOND']
    flatten = lambda doc: [(e, g) for e in doc['episodes'] for g in e['perTrackGrades']]
    positives = {t: sum(g['track'] == t and g['decision'] == 'SOURCE_ADMITTED'
                        for _, g in flatten(original['admission'])) for t in tracks}
    assert all(g['decision'] == 'PENDING' for _, g in flatten(negative))
    local_nonqualifying = {t: sum(g['track'] == t and g['decision'] == 'PENDING' and
        'FAMILY_ORIGINAL_ACTOR_METRIC_ABSENT' not in g['missingEvidence']
        for _, g in flatten(original['admission'])) for t in tracks}
    return {'genuineSourcePositives': positives, 'controlledRaidAblationPending': True,
            'naturalNonqualifyingCandidatesNotMatchedReplayNegatives': local_nonqualifying}


if __name__ == '__main__':
    cases = [check_case(path) for path in sys.argv[1:]]
    for track in ['GALLANTRY', 'CHIVALRY', 'RIVALRY', 'BOND']:
        assert sum(c['genuineSourcePositives'][track] for c in cases) > 0, track
    print(json.dumps({'genuineRetainedCases': len(cases), 'cases': cases,
                      'controlledLeagueBindingNotActualHistory': True}, sort_keys=True))

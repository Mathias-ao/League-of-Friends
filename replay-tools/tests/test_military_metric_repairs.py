from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lobby_team_context import statistics_team_context
from skirmish_detector import detect_skirmishes
from military_statistics import project_military_statistics
from test_military_statistics import CATALOG, MANIFEST, body


def event(actor, at, selected=(), target=None):
    return {'eventId': str(at), 'operationOrdinal': at, 'timestampMs': at,
            'actorPlayerId': actor, 'sourceActionName': 'ORDER' if target else 'MOVE',
            'position': {'x': 50, 'y': 50}, 'objectInstanceIds': list(selected),
            'targetInstanceId': target}


class MilitaryRepairTests(unittest.TestCase):
    def test_de_no_team_is_not_a_shared_alliance_and_raw_manifest_stays_intact(self):
        raw = {'source': {'gameBuild': 185872}, 'participants': [
            {'playerId': 1, 'lobbyTeamId': 1}, {'playerId': 2, 'lobbyTeamId': 1},
            {'playerId': 3, 'lobbyTeamId': 2}, {'playerId': 4, 'lobbyTeamId': 2}]}
        interpreted = statistics_team_context(raw)
        self.assertEqual([p['lobbyTeamId'] for p in interpreted['participants']], [None, None, 2, 2])
        self.assertEqual(raw['participants'][0]['lobbyTeamId'], 1)
        legacy = {'participants': [{'playerId': 1, 'lobbyTeamId': 1}]}
        self.assertIs(statistics_team_context(legacy), legacy)

    def test_later_created_target_controller_seeds_v2_only_after_observation(self):
        manifest = {'participants': [{'playerId': 1}, {'playerId': 2}]}
        actions = [event(1, 1000, target=999), event(2, 10000, selected=[999]),
                   event(1, 20000, target=999)]
        legacy = detect_skirmishes(manifest=manifest, initial_objects=[], action_events=actions)
        updated = detect_skirmishes(manifest=manifest, initial_objects=[], action_events=actions, controller_seeds=True)
        self.assertEqual(len(legacy['episodes']), 0)
        self.assertEqual(len(updated['episodes']), 1)
        self.assertEqual(updated['episodes'][0]['strongCommandCount'], 1)
        self.assertEqual(updated['modelVersion'], 'AOF_SKIRMISH_DETECTION_V2')
        # No future observation can backfill the first, unresolved target order.
        self.assertNotIn('1000', updated['episodes'][0]['sourceEventIds'])

    def test_same_team_target_does_not_seed_a_skirmish(self):
        manifest = {'participants': [{'playerId': 1, 'lobbyTeamId': 2}, {'playerId': 2, 'lobbyTeamId': 2}]}
        result = detect_skirmishes(manifest=manifest, initial_objects=[], controller_seeds=True,
            action_events=[event(2, 100, selected=[999]), event(1, 200, target=999)])
        self.assertEqual(result['episodes'], [])

    def project(self, source):
        return project_military_statistics(manifest=MANIFEST, body=source, catalog=CATALOG)['1']

    def test_unreached_checkpoints_are_unavailable_not_zero(self):
        result = self.project(body(durationMs=700_000, productionEvents=[
            {'replaySlot': 1, 'atMs': 500_000, 'unitId': 4, 'signedAmount': 2}]))
        checkpoints = result['armyCommitmentCheckpoints']
        self.assertEqual(checkpoints['at10Minutes']['grossPositiveQueueResources'], 140)
        self.assertIsNone(checkpoints['at15Minutes']['grossPositiveQueueResources'])
        self.assertEqual(checkpoints['at15Minutes']['coverageStatus'], 'recording_ends_before_checkpoint')

    def test_cancellation_only_unit_remains_visible_without_inflating_composition(self):
        result = self.project(body(productionEvents=[
            {'replaySlot': 1, 'atMs': 1000, 'unitId': 4, 'signedAmount': -2}]))
        self.assertEqual(result['composition']['archers'], 0)
        self.assertEqual(result['militaryUnitsTrained']['count'], 0)
        self.assertIn('+0 / -2', result['composition']['rawUnitQueueSummary']['4'])
        self.assertEqual(result['composition']['unitRows'][0]['class'], 'archers')


if __name__ == '__main__':
    unittest.main()

"""Opt-in, hash-pinned full-replay regression; missing fixtures are explicit skips."""
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from canonical_io import read_json, sha256, semantic_diff
from conformance import semantic_snapshot
from parse_replay import build_payload
from paired_conformance import paired_snapshot

ROOT = Path(__file__).parent
FIXTURE_MANIFEST = read_json(ROOT / 'fixtures.json')
FIXTURES = FIXTURE_MANIFEST['fixtures']
PAIRS = FIXTURE_MANIFEST.get('pairedFixtures', [])


class RealReplayTests(unittest.TestCase):
    def check_fixture(self, fixture):
        directory = os.environ.get('AOF_REPLAY_FIXTURE_DIR')
        if not directory:
            self.skipTest('Set AOF_REPLAY_FIXTURE_DIR to run real replay qualification regressions')
        source = Path(directory) / fixture['fileName']
        if not source.is_file():
            self.skipTest(f"Required real fixture not supplied: {fixture['id']}")
        self.assertEqual(sha256(source), fixture['sha256'], 'Fixture bytes differ from reviewed source')
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(os.environ.get('AOF_REPLAY_OUTPUT_DIR', temporary)) / fixture['id']
            output.mkdir(parents=True, exist_ok=True)
            adapter = build_payload(source, output / 'canonical')  # Includes full schema + byte conformance.
            (output / 'adapter.json').write_text(json.dumps(adapter) + '\n')
            snapshot = semantic_snapshot(output / 'canonical')
            for field, expected in fixture['expected'].items():
                actual = snapshot['stores']['facts']['recordCount'] if field == 'operationCount' else snapshot[field]
                self.assertEqual(actual, expected, f"Independent fixture assertion: {field}")
            golden = read_json(ROOT / 'goldens' / f"{fixture['id']}.json")
            changes = semantic_diff(golden, snapshot)
            self.assertEqual(changes, [], json.dumps(changes[:3], indent=2))

    def test_townbell_ffa(self):
        self.check_fixture(FIXTURES[0])

    def test_upstream_duel(self):
        self.check_fixture(FIXTURES[1])

    def test_two_recorder_duel(self):
        if not PAIRS:
            self.skipTest('No paired replay fixture declared')
        pair = PAIRS[0]
        directory = os.environ.get('AOF_REPLAY_FIXTURE_DIR')
        if not directory:
            self.skipTest('Set AOF_REPLAY_FIXTURE_DIR to run paired replay qualification regression')
        bundles = []
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for fixture in pair['recordings']:
                source = Path(directory) / fixture['fileName']
                if not source.is_file():
                    self.skipTest(f"Required paired fixture not supplied: {fixture['id']}")
                self.assertEqual(sha256(source), fixture['sha256'])
                bundle = root / fixture['id'] / 'canonical'
                adapter = build_payload(source, bundle)
                body = adapter['payload']['body']
                manifest = read_json(bundle / 'canonical-replay.json')
                actual = {'operationCount': sum(body['operationCounts'].values()),
                          'povPlayerId': manifest['source']['povPlayerId'],
                          'chatCount': body['chatOperationsTotal']}
                for field, expected in fixture['expected'].items():
                    self.assertEqual(actual[field], expected, f"Independent paired assertion: {field}")
                bundles.append(bundle)
            # build_payload already performs full bundle validation.
            actual = paired_snapshot(*bundles, validate=False)
            expected = read_json(ROOT / 'goldens' / f"{pair['id']}.json")
            changes = semantic_diff(expected, actual)
            self.assertEqual(changes, [], json.dumps(changes[:3], indent=2))


if __name__ == '__main__':
    unittest.main()

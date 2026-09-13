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

ROOT = Path(__file__).parent
FIXTURES = read_json(ROOT / 'fixtures.json')['fixtures']


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


if __name__ == '__main__':
    unittest.main()

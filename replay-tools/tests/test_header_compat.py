"""Real-format header regressions; no diplomacy-effect or game-outcome claims."""
import hashlib
import io
from pathlib import Path
import struct
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mgz.fast import header as upstream
from canonical_io import semantic_diff
from header_compat import parse, parse_scenario_68_9, SectionReader
from parse_replay import json_safe, extract_players, build_settings

FIXTURES = Path(__file__).resolve().parents[2] / 'replay-fixtures'
NEW_HASH = 'ab947d934bbd4fa4e2531f4f8a5014f9b923038a34aa7332d7260eb78fb3fab5'


class HeaderCompatibilityTests(unittest.TestCase):
    def new_fixture(self):
        path = FIXTURES / 'FFA_diplo.aoe2record'
        if not path.is_file():
            self.skipTest('New owner-supplied FFA fixture not present')
        self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), NEW_HASH)
        return path

    def test_68_9_custom_scenario_players_settings_and_body_boundary(self):
        with self.new_fixture().open('rb') as stream:
            header = parse(stream)
            self.assertEqual(stream.tell(), 1723389)
        players = extract_players(header, [])
        self.assertEqual(header['save_version'], 68.9)
        self.assertEqual(header['de']['build'], 185872)
        self.assertEqual([p['name'] for p in players],
                         ['TURK', 'Mihai', 'Wololo', 'Jeffrey', 'CBRO',
                          'Yeung Chow Fried Rice', 'Bot(Halvar)', 'Zortopos'])
        self.assertEqual(header['map']['dimension'], 240)
        self.assertEqual(header['scenario']['map_id'], 67)
        self.assertEqual(header['scenario']['trigger_names'],
                         [b'Torch --> Fish\x00', b'Better Fish\x00', b'Trade Fix\x00'])
        settings = build_settings(header, players)
        self.assertIs(settings['lockTeams'], False)
        self.assertIsNone(settings['seed'])
        self.assertIsNone(settings['revealMapId'])
        self.assertEqual(header['lobby'], {})

    def test_existing_headers_and_body_offsets_are_identical(self):
        paths = sorted(p for p in FIXTURES.glob('*.aoe2record') if p.name != 'FFA_diplo.aoe2record')
        if not paths:
            self.skipTest('Existing real replay corpus not present')
        for path in paths:
            with self.subTest(recording=path.name):
                with path.open('rb') as stream:
                    repaired, repaired_offset = parse(stream), stream.tell()
                with path.open('rb') as stream:
                    original, original_offset = upstream.parse(stream), stream.tell()
                self.assertEqual(repaired_offset, original_offset)
                self.assertEqual(semantic_diff(json_safe(original), json_safe(repaired)), [])

    def test_missing_trigger_anchor_fails_instead_of_guessing(self):
        with self.new_fixture().open('rb') as stream:
            header = upstream.decompress(stream)
            version, _, save, _ = upstream.parse_version(header, stream)
            upstream.parse_de(header, version, save)
            upstream.parse_hd(header, version, save)
            _, count = upstream.parse_metadata(header, save)
            upstream.parse_map(header, version, save)
            upstream.parse_players(header, count, version, save)
            start = header.tell()
            raw = header.getvalue()
        anchor = struct.pack('<d', 5.0)
        self.assertEqual(raw[start:].count(anchor), 1)
        mutated = io.BytesIO(raw[:start] + raw[start:].replace(anchor, struct.pack('<d', 4.5)))
        mutated.seek(start)
        with self.assertRaisesRegex(RuntimeError, 'anchor missing or ambiguous'):
            parse_scenario_68_9(mutated)

    def test_truncated_length_prefixed_fields_are_rejected(self):
        with self.assertRaisesRegex(RuntimeError, 'exceeds retained header'):
            SectionReader(io.BytesIO(struct.pack('<I', 100) + b'x')).string()


if __name__ == '__main__':
    unittest.main()

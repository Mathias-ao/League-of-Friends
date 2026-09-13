import base64
from collections import Counter
import copy
import gzip
import json
from pathlib import Path
import shutil
import struct
import sys
import tempfile
import unittest
import zlib
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from canonical_io import (ConformanceError, EventWriter, checked_path, iter_store, read_json,
                          schema_validator, semantic_diff, validate_bundle, json_bytes)
from canonical_run import project_bundle
from canonical_stream import frames
from paired_conformance import event_signature, stream_summary
import parse_replay
from fixture_support import export_fixture, controlled_body, header, PREFIX


def snapshot(bundle):
    manifest = read_json(bundle / 'canonical-replay.json')
    return {'schemaVersion': manifest['schemaVersion'], 'sourceSha256': manifest['source']['sha256'],
            'match': manifest['match'], 'participants': manifest['participants'],
            'facts': list(iter_store(bundle, manifest['factStore'])),
            'terrain': list(iter_store(bundle, manifest['initialState']['map']['terrainStore'])),
            'initialObjects': list(iter_store(bundle, manifest['initialState']['objectStore']))}


class ConformanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temp.name)
        cls.source, cls.bundle, cls.adapter = export_fixture(cls.root)
        cls.manifest = read_json(cls.bundle / 'canonical-replay.json')
        cls.events = list(iter_store(cls.bundle, cls.manifest['factStore']))

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_golden_snapshot(self):
        golden = read_json(Path(__file__).parent / 'goldens' / 'controlled-canonical.json')
        diff = semantic_diff(golden, snapshot(self.bundle))
        self.assertEqual(diff, [], json.dumps(diff[:3], indent=2))

    def test_wire_fields_not_completion_claims(self):
        body = self.adapter['payload']['body']
        self.assertEqual([e['amount'] for e in body['productionEvents']], [5, -2, 0, None])
        self.assertEqual([e['requestedAmountPositive'] for e in body['productionEvents']], [5, 0, 0, None])
        self.assertEqual(body['productionEvents'][0]['producerObjectIds'], [100, 101])
        self.assertEqual(self.events[5]['payload']['_rawLayout']['selectedBuildingIdsRaw'], [100, 101])
        self.assertEqual(self.events[6]['position']['x'], 0)
        self.assertEqual(self.events[6]['position']['y'], 1.25)
        self.assertEqual(self.events[6]['payload']['_rawLayout']['unknownInt16'], 7)
        self.assertEqual(self.events[10]['targetInstanceId'], 999)
        self.assertIsNone(self.events[10]['targetPlayerId'])
        self.assertEqual(self.events[10]['payload']['_rawLayout']['selectedCountRaw'], -1)
        self.assertEqual(self.events[10]['position']['x'], -1)

    def test_directed_diplomacy_and_tied_order(self):
        events = self.adapter['payload']['body']['diplomacyEvents']
        self.assertEqual([(e['replaySlot'], e['targetReplaySlot'], e['diplomacyMode']) for e in events],
                         [(1, 2, 3), (2, 1, 0), (1, 2, 0)])
        self.assertEqual([e['operationOrdinal'] for e in events], [7, 8, 9])
        self.assertEqual({e['atMs'] for e in events}, {100})

    def test_unknown_and_partial_bytes_survive(self):
        unknown, partial = self.events[11:13]
        self.assertEqual(unknown['sourceActionCode'], 200)
        self.assertEqual(unknown['decode']['status'], 'unknown_action')
        self.assertEqual(partial['decode']['status'], 'partial')
        for event in (unknown, partial, self.events[1]):
            self.assertEqual(event['decode']['unknownBytesBase64'], event['payload']['_rawOperationBase64'])
        self.assertIn(b'\xde\xad', base64.b64decode(self.events[1]['decode']['unknownBytesBase64']))

    def test_all_chunks_and_rectangular_map(self):
        verified = validate_bundle(self.bundle)
        self.assertEqual(verified['operationCount'], 15)
        self.assertGreater(len(self.manifest['factStore']['chunks']), 1)
        self.assertEqual((self.manifest['initialState']['map']['width'], self.manifest['initialState']['map']['height']), (2, 3))
        self.assertIsNone(self.manifest['source']['retainedReplay'])
        self.assertEqual(self.manifest['match']['completionStatus'], 'unknown')
        self.assertEqual(self.manifest['match']['winnerPlayerIds'], [])
        self.assertFalse(verified['sourceDeletionEligible'])

    def test_no_replay_needed_for_projection(self):
        hidden = self.source.with_suffix('.hidden')
        self.source.rename(hidden)
        try:
            with patch.object(parse_replay, 'parse_header', side_effect=AssertionError('Replay reopened')), \
                 patch.object(parse_replay, 'parse_body', side_effect=AssertionError('Replay reopened')):
                projected = project_bundle(self.bundle)
        finally:
            hidden.rename(self.source)
        self.assertEqual(projected['body'], self.adapter['payload']['body'])
        self.assertEqual(projected['schemaVersion'], 'AOF_CANONICAL_PROJECTION_V2')
        self.assertEqual(projected['fundamentals']['fundamentalsVersion'], 'AOF_COMMAND_FUNDAMENTALS_V2')
        self.assertEqual(projected['extractionRunId'], read_json(self.bundle / 'extraction-manifest.json')['extractionRunId'])
        self.assertEqual(projected['fundamentals']['positiveQueueAmountsByPlayerAndRawUnit'], {'1': {'83': 5}})
        self.assertEqual(projected['fundamentals']['ageAdvanceStarted']['events'], [])
        self.assertEqual(projected['fundamentals']['observedAgeReached']['events'], [])
        self.assertEqual(len(projected['fundamentals']['directedDiplomacyCommandTimelines']['1->2']), 2)

    def test_repeat_extraction_has_deterministic_facts_and_compression(self):
        with tempfile.TemporaryDirectory() as d:
            _, bundle, _ = export_fixture(Path(d))
            other = read_json(bundle / 'canonical-replay.json')
            self.assertEqual(snapshot(self.bundle), snapshot(bundle))
            for left, right in [(self.manifest['factStore'], other['factStore']),
                                (self.manifest['initialState']['objectStore'], other['initialState']['objectStore'])]:
                self.assertEqual(left, right)
            a = read_json(self.bundle / 'extraction-manifest.json')
            b = read_json(bundle / 'extraction-manifest.json')
            self.assertNotEqual(a['extractionRunId'], b['extractionRunId'])
            self.assertEqual(a['headerEvidence'], b['headerEvidence'])

    def test_partial_tail_is_retained_and_never_marked_complete(self):
        for tail in (b'\x01\x02', struct.pack('<II', 1, 999), struct.pack('<I', 0xDEADBEEF), struct.pack('<II', 1, 0)):
            with self.subTest(tail=tail), tempfile.TemporaryDirectory() as d:
                _, bundle, adapter = export_fixture(Path(d), body=controlled_body() + tail)
                manifest = read_json(bundle / 'canonical-replay.json')
                last = list(iter_store(bundle, manifest['factStore']))[-1]
                self.assertFalse(adapter['payload']['body']['bodyParseComplete'])
                self.assertEqual(last['sourceOperation'], 'UNKNOWN')
                self.assertEqual(base64.b64decode(last['decode']['unknownBytesBase64']), tail)
                self.assertEqual(validate_bundle(bundle)['retainedByteCount'], len(PREFIX + controlled_body() + tail))

    def test_missing_corrupt_or_traversing_chunk_is_rejected(self):
        for mutation in ('missing', 'corrupt', 'traversal', 'count', 'timestamp'):
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as d:
                clone = Path(d) / 'canonical'
                shutil.copytree(self.bundle, clone)
                m = read_json(clone / 'canonical-replay.json')
                ref = m['factStore']['chunks'][-1]
                if mutation == 'missing': (clone / ref['uri']).unlink()
                elif mutation == 'corrupt': (clone / ref['uri']).write_bytes(b'corrupt')
                elif mutation == 'traversal': ref['uri'] = '../escape.jsonl.gz'
                elif mutation == 'count': m['factStore']['recordCount'] += 1
                else: m['match']['durationMs'] += 1
                (clone / 'canonical-replay.json').write_bytes(json_bytes(m))
                with self.assertRaises(ConformanceError): validate_bundle(clone, verify_run=False)

        for field in ('exporterCodeSha256', 'decoderCodeSha256', 'schemaSha256', 'compatibilityRegistrySha256'):
            with self.subTest(field=field), tempfile.TemporaryDirectory() as d:
                clone = Path(d) / 'canonical'
                shutil.copytree(self.bundle, clone)
                run = read_json(clone / 'extraction-manifest.json')
                run['versions'][field] = 'unversioned-code'
                (clone / 'extraction-manifest.json').write_bytes(json_bytes(run))
                with self.assertRaises(ConformanceError): validate_bundle(clone)

    def test_invalid_schema_and_identity_are_rejected(self):
        for mutate in (lambda m: m['source'].update(sha256='bad'),
                       lambda m: m['versions'].update(schemaVersion='1.0.0'),
                       lambda m: m['participants'].append(m['participants'][0]),
                       lambda m: m.update(leagueScore=10)):
            with tempfile.TemporaryDirectory() as d:
                clone = Path(d) / 'canonical'
                shutil.copytree(self.bundle, clone)
                m = read_json(clone / 'canonical-replay.json');mutate(m)
                (clone / 'canonical-replay.json').write_bytes(json_bytes(m))
                with self.assertRaises(ConformanceError): validate_bundle(clone, verify_run=False)

    def test_no_guessed_map_or_civilization(self):
        for alter in (lambda h: h['map'].update(dimension=None),
                      lambda h: h['map'].update(tiles=[]),
                      lambda h: h['players'][0].update(civilization_id=None)):
            with tempfile.TemporaryDirectory() as d:
                h = header();alter(h)
                with self.assertRaises(ValueError): export_fixture(Path(d), fixture_header=h)
                self.assertFalse((Path(d) / 'canonical').exists())
                self.assertTrue((Path(d) / 'controlled.bin').exists())

    def test_unverified_compatibility_tuple_is_explicit(self):
        with tempfile.TemporaryDirectory() as d:
            h = header();h['save_version'] = 99.0;h['de']['build'] = 999999
            _, bundle, _ = export_fixture(Path(d), fixture_header=h)
            run = read_json(bundle / 'extraction-manifest.json')
            self.assertEqual(run['compatibility']['status'], 'unverified_tuple')
            self.assertFalse(run['retention']['sourceDeletionEligible'])

    def test_existing_bundle_is_immutable(self):
        before = (self.bundle / 'canonical-replay.json').read_bytes()
        with self.assertRaises(FileExistsError): parse_replay.build_payload(self.source, self.bundle)
        self.assertEqual((self.bundle / 'canonical-replay.json').read_bytes(), before)

    def test_semantic_diff_reports_payload_order_and_raw_changes(self):
        left = {'payload': {'amount': 1, 'unknown': 'AA=='}, 'targets': [1, 2]}
        right = {'payload': {'amount': -1, 'unknown': 'AQ=='}, 'targets': [2, 1]}
        paths = {change['path'] for change in semantic_diff(left, right)}
        self.assertEqual(paths, {'/payload/amount', '/payload/unknown', '/targets/0', '/targets/1'})

    def test_semantic_diff_compares_json_types_after_roundtrip(self):
        actual = {'amounts': Counter({'83': 5, '4': 2})}
        expected = json.loads(json.dumps(actual))
        self.assertEqual(semantic_diff(expected, actual), [])
        self.assertTrue(semantic_diff({'value': True}, {'value': 1}))

    def test_paired_signature_ignores_source_addresses_but_not_evidence(self):
        left = dict(self.events[2])
        right = json.loads(json.dumps(left))
        right.update(eventId='other-source-event', operationOrdinal=999, byteOffset=123456, byteLength=999)
        right['evidence']['sourceEventIds'] = ['other-source-event']
        self.assertEqual(event_signature(left), event_signature(right))
        self.assertTrue(stream_summary([left], [right])['exactMatch'])
        right['payload']['incrementMs'] = 999
        self.assertFalse(stream_summary([left], [right])['exactMatch'])

    def test_source_and_inflation_limits_fail_closed(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'header.bin'
            compressed = zlib.compress(b'A' * 5000, wbits=-15)
            path.write_bytes(struct.pack('<II', len(compressed) + 8, 0) + compressed)
            with self.assertRaisesRegex(ValueError, 'Inflated header'):
                parse_replay.preflight_source(path, max_header_bytes=100)
            with self.assertRaisesRegex(ValueError, 'Replay size'):
                parse_replay.preflight_source(path, max_source_bytes=8)
            parse_replay.preflight_source(path)
            path.write_bytes(struct.pack('<II', 999999, 0))
            with self.assertRaisesRegex(ValueError, 'boundary'):
                parse_replay.preflight_source(path)


if __name__ == '__main__':
    unittest.main()

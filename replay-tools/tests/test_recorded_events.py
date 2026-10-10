"""No fixture replacement or golden regeneration; compare unchanged projectors."""
from copy import deepcopy
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from jsonschema import Draft202012Validator

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from analysis_dataset import build_analysis_dataset
from canonical_io import json_bytes, read_json, semantic_diff
from fixture_support import controlled_body, export_fixture
from recorded_events import build_recorded_events, decode_dataset, encode_dataset, to_analysis, validate_recorded_events
from statistics_projector import project_statistics_from_analysis
from benchmark_recorded_events import firestore_batches


class RecordedEventsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.source, cls.bundle, _ = export_fixture(Path(cls.temp.name))
        cls.dataset = build_recorded_events(cls.bundle)
        cls.expected = project_statistics_from_analysis(build_analysis_dataset(cls.bundle, validate=False))

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_all_statistics_equal_after_serialized_roundtrip_without_source_or_archive(self):
        stored, metadata = encode_dataset(self.dataset)
        bundle_hidden = self.bundle.with_name("hidden-canonical")
        source_hidden = self.source.with_suffix(".hidden")
        self.bundle.rename(bundle_hidden)
        self.source.rename(source_hidden)
        try:
            with patch("analysis_dataset.build_analysis_dataset", side_effect=AssertionError("archive access forbidden")):
                actual = project_statistics_from_analysis(to_analysis(decode_dataset(stored, metadata)))
            self.assertEqual(semantic_diff(self.expected, actual), [])
            self.assertEqual(json_bytes(actual), json_bytes(self.expected))
        finally:
            bundle_hidden.rename(self.bundle)
            source_hidden.rename(self.source)

    def test_observations_not_duplicate_analysis_or_raw_bytes(self):
        schema = read_json(Path(__file__).resolve().parents[1] / "schemas/recorded-events-v1.schema.json")
        Draft202012Validator.check_schema(schema)
        Draft202012Validator(schema).validate(self.dataset)
        self.assertNotIn("body", self.dataset)
        self.assertNotIn("fundamentals", self.dataset)
        self.assertNotIn(b"Base64", json_bytes(self.dataset))
        self.assertEqual(self.dataset["terrain"]["tiles"][3], [-1, 2])
        self.assertEqual(self.dataset["completeness"]["initialPlayerResources"], "unavailable_parser_skips_values")
        analysis = to_analysis(self.dataset)
        production = analysis["body"]["productionEvents"]
        self.assertEqual([e["signedAmount"] for e in production[:3]], [5, -2, 0])
        self.assertEqual(production[0]["producerBuildingTypeId"], 109)
        diplomacy = analysis["body"]["diplomacyEvents"]
        self.assertEqual([e["diplomacyMode"] for e in diplomacy], [3, 0, 0])
        self.assertEqual([e["operationOrdinal"] for e in diplomacy], sorted(e["operationOrdinal"] for e in diplomacy))

    def test_chronology_counts_terrain_and_raw_payload_corruption_rejected(self):
        for mutation in (
            lambda d: d["events"][1].__setitem__(0, 999),
            lambda d: d["events"].pop(),
            lambda d: d["events"][0][12].__setitem__("incrementMs", -1),
            lambda d: d["terrain"]["tiles"].pop(),
            lambda d: d["events"][1][12].__setitem__("bytesBase64", "AA=="),
            lambda d: d["context"]["participants"].append(d["context"]["participants"][0]),
        ):
            changed = deepcopy(self.dataset)
            mutation(changed)
            with self.assertRaises(ValueError):
                validate_recorded_events(changed)

    def test_dual_integrity_and_deterministic_compression(self):
        stored, metadata = encode_dataset(self.dataset)
        self.assertEqual((stored, metadata), encode_dataset(self.dataset))
        for field, value in (("sha256", "0" * 64), ("uncompressedSha256", "0" * 64),
                             ("uncompressedBytes", 1), ("bytes", 1), ("compression", "br")):
            with self.assertRaises(ValueError):
                decode_dataset(stored, {**metadata, field: value})
        with self.assertRaises(ValueError):
            decode_dataset(stored[:-1], metadata)

    def test_measured_firestore_batches_include_header_objects_and_terrain(self):
        result = firestore_batches(self.dataset)
        self.assertEqual(result["documentCount"], 4)
        self.assertGreater(result["compressedBytes"], 0)
        self.assertLessEqual(result["maxDocumentPayloadBytes"], result["targetBytes"])

    def test_legacy_elevation_gap_is_preserved_without_discarding_retained_terrain(self):
        self.assertTrue(self.dataset["terrain"]["tiles"])
        self.assertFalse(self.dataset["legacyCompatibility"]["terrainElevationAvailable"])
        self.assertEqual(to_analysis(self.dataset)["terrainElevation"]["values"], [])

    def test_unknown_framing_is_not_complete_or_empty_evidence(self):
        with tempfile.TemporaryDirectory() as temp:
            _, bundle, _ = export_fixture(Path(temp), body=controlled_body() + b"\xff\xff\xff\xff")
            dataset = build_recorded_events(bundle)
            self.assertEqual(dataset["completeness"]["framing"], "partial")
            self.assertEqual(dataset["events"][-1][1], "UNKNOWN")
            self.assertFalse(to_analysis(dataset)["body"]["bodyParseComplete"])


if __name__ == "__main__":
    unittest.main()

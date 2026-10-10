"""Direct V1 contract, source independence, integrity and statistical parity."""
from copy import deepcopy
import gzip
import hashlib
import io
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from jsonschema import Draft202012Validator

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import parse_replay
from analysis_dataset import build_analysis_dataset
from canonical_io import json_bytes, semantic_diff
from fixture_support import export_fixture, header, controlled_body
from recorded_events_stream import (extract_recorded_events, read_records, load_analysis,
    project_recorded_events, StreamValidator, EventStreamWriter, write_statistics, _json_bound)
from statistics_projector import project_statistics_from_analysis


def native_reference(legacy, native):
    """Only provenance/retention qualifications change, never model inputs."""
    result = deepcopy(legacy)
    result["source"] = native["source"]
    result["recordingHeaderSource"] = native["recordingHeaderSource"]
    result["coverage"] = native["coverage"]
    return result


class EventStreamTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        root = Path(cls.temp.name)
        cls.source, cls.bundle, _ = export_fixture(root)
        cls.legacy = build_analysis_dataset(cls.bundle, validate=False)
        cls.path = root / "events.gz"
        def read_header(handle):
            handle.seek(8)
            return deepcopy(header())
        with patch.object(parse_replay, "preflight_source"), patch.object(parse_replay, "parse_header", side_effect=read_header), \
                patch.object(parse_replay, "build_payload", side_effect=AssertionError("No canonical export")), \
                patch.object(parse_replay, "stage_run", side_effect=AssertionError("No canonical staging")), \
                patch.object(parse_replay.base64, "b64encode", side_effect=AssertionError("No binary copies")):
            cls.metadata = extract_recorded_events(cls.source, cls.path)
        cls.native = load_analysis(cls.path, cls.metadata)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_full_statistics_and_social_evidence_with_native_provenance(self):
        self.assertEqual(self.legacy["body"], self.native["body"])
        for key in ("actionEvents", "initialObjects", "fundamentals", "postgameEvents", "recordingHeader", "terrainElevation"):
            self.assertEqual(self.legacy[key], self.native[key], key)
        expected = project_statistics_from_analysis(native_reference(self.legacy, self.native))
        hidden = self.bundle.with_name("hidden")
        self.bundle.rename(hidden)
        self.source.rename(self.source.with_suffix(".hidden"))
        try:
            with patch.object(parse_replay, "parse_header", side_effect=AssertionError("Replay access")), \
                    patch("statistics_projector.build_analysis_dataset", side_effect=AssertionError("Archive access")):
                actual = project_recorded_events(self.path, self.metadata)
            self.assertEqual(semantic_diff(expected, actual), [])
            self.assertEqual(actual["source"]["recordedEventsSha256"], self.metadata["sha256"])
            self.assertNotIn("canonicalManifestSha256", actual["source"])
            self.assertFalse(actual["matchFacts"]["policy"]["rewardsEnabled"])
        finally:
            hidden.rename(self.bundle)
            self.source.with_suffix(".hidden").rename(self.source)

    def test_retained_observations_and_qualifications(self):
        records = list(read_records(self.path, self.metadata))
        from canonical_io import read_json
        schema = read_json(Path(__file__).resolve().parents[1] / "schemas/recorded-events-stream-v1.schema.json")
        Draft202012Validator.check_schema(schema)
        validator = Draft202012Validator(schema)
        for record in records:
            validator.validate(record)
        self.assertEqual(records[0][1]["qualification"]["initialPlayerResources"], "unavailable_parser_skips_values")
        self.assertEqual([r for r in records if r[0] == "tile"][3], ["tile", 3, -1, 2])
        self.assertEqual(self.native["terrainElevation"]["values"], [])
        self.assertEqual(self.native["body"]["productionEvents"][0]["producerBuildingTypeId"], 109)
        self.assertEqual([v["signedAmount"] for v in self.native["body"]["productionEvents"][:3]], [5, -2, 0])
        self.assertNotIn(b"Base64", gzip.decompress(self.path.read_bytes()))
        self.assertNotIn(b"advanced to the", gzip.decompress(self.path.read_bytes()))

    def test_rejects_chronology_structure_completeness_and_retention_corruption(self):
        original = list(read_records(self.path, self.metadata))
        event_index = next(i for i, r in enumerate(original) if r[0] == "event")
        sync_index = next(i for i, r in enumerate(original) if r[0] == "sync")
        for mutate in (
            lambda r: r.pop(),
            lambda r: r.append(r[-1]),
            lambda r: r[event_index].__setitem__(1, 10),
            lambda r: r[event_index][2].__setitem__(0, 99),
            lambda r: r[sync_index].__setitem__(2, -1),
            lambda r: r[event_index][2][12].__setitem__("rawBase64", "AAAA"),
            lambda r: r[event_index][2].__setitem__(13, "success"),
            lambda r: r[event_index][2].__setitem__(7, ["ambiguous"]),
            lambda r: r.pop(1),
            lambda r: r[0][1]["context"]["participants"].append(r[0][1]["context"]["participants"][0]),
        ):
            records = deepcopy(original)
            mutate(records)
            validator = StreamValidator()
            with self.assertRaises(ValueError):
                for record in records:
                    validator.consume(record)
                validator.finish()

    def test_dual_integrity_and_limits(self):
        for key, value in (("sha256", "0" * 64), ("bytes", 1), ("uncompressedBytes", 1),
                           ("uncompressedBytes", 1024**3), ("uncompressedSha256", "0" * 64), ("format", "json")):
            with self.assertRaises(ValueError):
                load_analysis(self.path, {**self.metadata, key: value})
        path = Path(self.temp.name) / "truncated.gz"
        path.write_bytes(self.path.read_bytes()[:-8])
        metadata = {**self.metadata, "bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
        with self.assertRaises((ValueError, EOFError)):
            load_analysis(path, metadata)

    def test_never_replaces_existing_artifact(self):
        before = self.path.read_bytes()
        with self.assertRaises(FileExistsError):
            extract_recorded_events(self.source, self.path)
        self.assertEqual(before, self.path.read_bytes())

    def test_retains_header_position_without_promoting_spawn_or_player_type(self):
        fixture_header = header()
        fixture_header["players"][0]["position"] = {"x": 7.25, "y": 9.5}
        fixture_header["players"][0]["type"] = 2
        def read_header(handle):
            handle.seek(8)
            return deepcopy(fixture_header)
        destination = Path(self.temp.name) / "player-observations.gz"
        with patch.object(parse_replay, "preflight_source"), patch.object(parse_replay, "parse_header", side_effect=read_header):
            metadata = extract_recorded_events(self.source, destination)
        retained = list(read_records(destination, metadata))[0][1]
        player = retained["initialPlayerObservations"][0]
        self.assertEqual((player["position"]["x"], player["position"]["y"]), (7.25, 9.5))
        self.assertEqual(player["playerTypeRaw"], 2)
        self.assertIsNone(retained["context"]["participants"][0]["isHuman"])

    def test_tribute_target_is_numeric_without_allocating_base64_duplicate(self):
        from mgz.fast.enums import Action
        with patch.object(parse_replay.base64, "b64encode", side_effect=AssertionError("No binary allocation")):
            event = parse_replay.canonical_action_event(ordinal=0, elapsed_ms=0, op_start=0, op_end=10,
                action_type=Action.DE_TRIBUTE, action_data={"player_id": 1, "target_player_id": b"\x02", "gold": 10},
                raw_operation=b"", retain_raw=False)
        self.assertEqual(event["targetPlayerId"], 2)
        self.assertEqual(event["payload"]["target_player_id"], {})

    def test_source_byte_gap_rejected_before_observation_write(self):
        writer = EventStreamWriter(io.BytesIO(), body_offset=32)
        with self.assertRaisesRegex(ValueError, "source byte coverage"):
            writer.write({"operationOrdinal": 0, "byteOffset": 33, "byteLength": 8})

    def test_partial_framing_is_not_confirmed_absence(self):
        records = list(read_records(self.path, self.metadata))
        validator = StreamValidator()
        for record in records[:-1]:
            validator.consume(record)
        row = deepcopy(next(r[2] for r in records if r[0] == "event"))
        row[1], row[2], row[12], row[13] = "UNKNOWN", "operation.unknown", {}, "failed"
        row[0] = validator.elapsed
        validator.consume(["event", validator.events, row])
        self.assertEqual(validator.summary()["framing"], "partial")

    def test_streamed_statistics_encoding_is_identical(self):
        value = project_recorded_events(self.path, self.metadata)
        out = Path(self.temp.name) / "stats.json"
        write_statistics(out, value)
        self.assertEqual(out.read_bytes(), json_bytes(value))

    def test_bounded_encoder_handles_large_nested_unicode_evidence(self):
        value = {"players": [{"evidence": [{"text": "Æøå\n\t😀", "zero": 0, "missing": None,
                    "negative": -4, "float": 0.000000000000123, "known": False}] * 1000}] * 8}
        out = Path(self.temp.name) / "nested.json"
        write_statistics(out, value)
        self.assertEqual(out.read_bytes(), json_bytes(value))
        for scalar in ("Æøå\n\t😀", -100, 1e99, True, None):
            self.assertGreaterEqual(_json_bound(scalar, 65536), len(json_bytes(scalar)) - 1)

    def test_repeat_extraction_is_deterministic_and_source_mutation_rejected(self):
        def read_header(handle):
            handle.seek(8)
            return deepcopy(header())
        with patch.object(parse_replay, "preflight_source"), patch.object(parse_replay, "parse_header", side_effect=read_header):
            repeat = Path(self.temp.name) / "repeat.gz"
            self.assertEqual(extract_recorded_events(self.source, repeat), self.metadata)
            self.assertEqual(repeat.read_bytes(), self.path.read_bytes())
            real_body = parse_replay.parse_body
            original = self.source.read_bytes()
            def mutate(*args, **kwargs):
                result = real_body(*args, **kwargs)
                self.source.write_bytes(original + b"changed")
                return result
            failed = Path(self.temp.name) / "must-not-publish.gz"
            try:
                with patch.object(parse_replay, "parse_body", side_effect=mutate), self.assertRaises(ValueError):
                    extract_recorded_events(self.source, failed)
                self.assertFalse(failed.exists())
            finally:
                self.source.write_bytes(original)


if __name__ == "__main__":
    unittest.main()

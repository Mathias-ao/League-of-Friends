import csv
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from canonical_io import read_json, semantic_diff
import parse_replay
from statistics_projector import project_statistics
from statistics_registry import MATRIX_PATH, build_registry
from statistics_corpus import summarize
from fixture_support import export_fixture


def statistics_snapshot(result):
    evidence = result["commandEvidence"]
    return {
        "versions": {key: result[key] for key in (
            "statisticsSchemaVersion", "statisticsProjectionVersion", "formulaVersion",
            "eligibilityRegistryVersion", "entityCatalogVersion")},
        "source": {key: result["source"][key] for key in (
            "replaySha256", "canonicalSchemaVersion", "parserVersion")},
        "scope": result["scope"],
        "participantCommands": [{
            "playerId": p["playerId"], "isRecorder": p["isRecorder"],
            "count": p["observedCommands"]["count"],
            "firstAtMs": p["observedCommands"]["firstAtMs"],
            "lastAtMs": p["observedCommands"]["lastAtMs"],
            "firstFiveObservedMinutesCount": p["observedCommands"]["firstFiveObservedMinutesCount"],
        } for p in result["participants"]],
        "opening": [{
            "playerId": p["playerId"],
            "modelVersion": p["opening"]["modelVersion"],
            "feudalClickAtMs": p["opening"]["ageUp"]["feudal"]["clickAtMs"],
            "feudalAgeUpAtMs": p["opening"]["ageUp"]["feudal"]["ageUpAtMs"],
            "castleAgeUpAtMs": p["opening"]["ageUp"]["castle"]["ageUpAtMs"],
            "imperialAgeUpAtMs": p["opening"]["ageUp"]["imperial"]["ageUpAtMs"],
            "firstMilitaryUnitRawId": (
                p["opening"]["firstMilitaryUnitQueued"]["unit"]["rawId"]
                if p["opening"]["firstMilitaryUnitQueued"] else None
            ),
            "firstMilitaryBuildingRawId": (
                p["opening"]["firstMilitaryBuilding"]["building"]["rawId"]
                if p["opening"]["firstMilitaryBuilding"] else None
            ),
            "firstWallAtMs": (
                p["opening"]["firstWallSegment"]["atMs"]
                if p["opening"]["firstWallSegment"] else None
            ),
            "wallTilesBeforeFeudal": p["opening"]["wallTilesBeforeFeudal"]["count"],
            "wallStyle": p["opening"]["wallStyle"]["label"],
            "housesBeforeFeudal": p["opening"]["housesBeforeFeudal"]["count"],
            "loomAtMs": p["opening"]["loomTiming"]["atMs"],
            "loomBeforeFeudal": p["opening"]["loomBeforeFeudal"]["value"],
        } for p in result["participants"]],
        "combat": [{
            "playerId": p["playerId"],
            "raidsInitiated": p["combat"]["raidsInitiated"],
            "raidsAgainstYou": p["combat"]["raidsAgainstYou"],
            "modelVersion": p["combat"]["modelVersion"],
        } for p in result["participants"]],
        "queue": evidence["queueRequestsByPlayerAndUnit"],
        "queueAmounts": evidence["positiveEncodedQueueAmountsByPlayerAndRawUnit"],
        "research": evidence["researchRequestsByPlayerAndTechnology"],
        "buildings": evidence["buildingPlacementsByPlayerAndBuilding"],
        "ageStatuses": {key: evidence[key]["status"] for key in (
            "ageAdvanceStarted", "observedAgeReached", "projectedAgeCompletion")},
        "ageRequestCount": len(evidence["ageAdvanceRequestCandidates"]["events"]),
        "diplomacy": {key: [[e["replaySlot"], e["targetReplaySlot"], e["diplomacyMode"], e["operationOrdinal"]]
                            for e in events]
                      for key, events in evidence["directedDiplomacyCommands"].items()},
        "camera": result["recorderCamera"],
        "eligibility": result["townBellEligibility"],
        "warningCodes": [warning["code"] for warning in result["warnings"]],
    }


class StatisticsRegistryTests(unittest.TestCase):
    def test_registry_preserves_all_matrix_rows_and_has_one_conservative_decision_each(self):
        registry = build_registry()
        with MATRIX_PATH.open(newline="", encoding="utf-8-sig") as source:
            rows = list(csv.DictReader(source))
        self.assertEqual(registry["metricCount"], 320)
        self.assertEqual([m["sourceMatrix"] for m in registry["metrics"]], rows)
        self.assertEqual(sum(registry["eligibilityCounts"].values()), 320)
        self.assertEqual(len({m["metricId"] for m in registry["metrics"]}), 320)
        self.assertEqual(set(registry["eligibilityCounts"]), {
            "available_canonical", "inferred_with_confidence", "needs_controlled_fixture",
            "needs_parser_research", "needs_engine_simulation"})

    def test_outcome_names_are_not_declared_available(self):
        registry = build_registry()
        available = {m["metricId"] for m in registry["metrics"] if m["eligibility"] == "available_canonical"}
        for fragment in ("trained", "built", "reached", "army_value", "spend"):
            self.assertFalse([metric for metric in available if fragment in metric])


class StatisticsProjectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.source, cls.bundle, _ = export_fixture(Path(cls.temp.name))

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_schema_validated_golden_projection_without_replay(self):
        hidden = self.source.with_suffix(".hidden")
        self.source.rename(hidden)
        try:
            with patch.object(parse_replay, "parse_header", side_effect=AssertionError("Replay reopened")), \
                 patch.object(parse_replay, "parse_body", side_effect=AssertionError("Replay reopened")):
                result = project_statistics(self.bundle)
        finally:
            hidden.rename(self.source)
        golden = read_json(Path(__file__).parent / "goldens" / "controlled-statistics.json")
        diff = semantic_diff(golden, statistics_snapshot(result))
        self.assertEqual(diff, [], json.dumps(diff[:5], indent=2))

    def test_raw_ids_survive_reference_catalog_labels(self):
        result = project_statistics(self.bundle)
        villager = result["commandEvidence"]["queueRequestsByPlayerAndUnit"]["1"][0]
        self.assertEqual(villager["entity"]["rawId"], 83)
        self.assertEqual(villager["entity"]["name"], "Villager")
        self.assertEqual(villager["entity"]["resolutionStatus"], "reference_catalog_unqualified_for_replay_patch")
        self.assertEqual(villager["commandCount"], 4)
        self.assertEqual(result["commandEvidence"]["positiveEncodedQueueAmountsByPlayerAndRawUnit"], {"1": {"83": 5}})

    def test_age_requests_starts_reached_and_completion_stay_separate(self):
        evidence = project_statistics(self.bundle)["commandEvidence"]
        self.assertEqual(len(evidence["ageAdvanceRequestCandidates"]["events"]), 1)
        self.assertEqual(evidence["ageAdvanceStarted"], {"status": "insufficient_evidence", "events": []})
        self.assertEqual(evidence["observedAgeReached"], {"status": "insufficient_evidence", "events": []})
        self.assertEqual(evidence["projectedAgeCompletion"], {"status": "not_observable", "events": []})

    def test_corpus_summary_is_privacy_minimized(self):
        summary = summarize("controlled", project_statistics(self.bundle))
        self.assertEqual(summary["queueRequestCommands"], 4)
        self.assertEqual(summary["directedDiplomacyCommands"], 3)
        self.assertNotIn("participants", summary)
        self.assertNotIn("displayName", json.dumps(summary))


if __name__ == "__main__":
    unittest.main()

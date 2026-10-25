"""SOC-GRADE-02 contract and adversarial tests; semantic positives are NOT certified."""
from copy import deepcopy
from hashlib import sha256
from pathlib import Path
import json
import os
import sys
import tempfile
import unittest
from jsonschema import Draft202012Validator

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from social_v1_metric_grade_candidates import (
    VERSION, prepare_social_metric_grade_candidates as grade,
)
from social_v1_source_measurements import project_social_source_measurements as measure
from test_social_v1_source_measurements import synthetic_bundle

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = json.loads((ROOT / "contracts/social-v1/metric-grade-candidates-v1.schema.json").read_text())
Draft202012Validator.check_schema(SCHEMA)
PINS = {
    "1v1": ("replay-fixtures/1v1_1.aoe2record",
            "f00fdda9c14584c3b7f132fe48bf0543d2a0aa7108d9c781e4e4cf72ad70d181"),
    "2v2": ("replay-fixtures/2v2.aoe2record",
            "87447e342f4134e59b5b2cd6fcf6f2e7f1324cbc899d413301b2f3a25cb7baaa"),
    "4v4": ("replay-fixtures/4v4.aoe2record",
            "e415855f5223562820f5a34daf1298455ba5cbd940a4b502f03d2d8a2436a123"),
    "FFA": ("replay-fixtures/FFA_diplo.aoe2record",
            "ab947d934bbd4fa4e2531f4f8a5014f9b923038a34aa7332d7260eb78fb3fab5"),
}


def bundle(kind="pressure", **kwargs):
    b, statistics, events = synthetic_bundle(kind=kind, **kwargs)
    stats = deepcopy(statistics)
    # Only pre-existing source fixture values, no recomputed detector.
    roster = [p["playerId"] for p in stats["participants"]]
    stats["matchFacts"] = {"rules": {"lockTeams": {"value": True, "status": "DECODED"}},
                           "players": [{"playerId": i, "lobbyTeamIdRaw": i}
                                       for i in roster]}
    return b, stats, events


def call(b, stats, events, *, game=None, measured=None):
    measured = measured if measured is not None else measure(
        statistics=stats, context=b["context"], action_events=events,
        lookback_ms=5000)
    output = grade(statistics=stats, context=b["context"],
                   source_measurements=measured, action_events=events,
                   game_scope=game or {"battleId": "match-A", "gameId": "game-1",
                                       "gameGuid": "GUID-TEST",
                                       "authorityRevision": "unverified-only"})
    Draft202012Validator(SCHEMA).validate(output)
    return output


class SourceBoundMetricGradeTests(unittest.TestCase):
    def test_correlated_pressure_and_target_are_one_grade_candidate_not_two_credits(self):
        b, stats, actions = bundle("pressure")
        result = call(b, stats, actions)
        self.assertEqual(result["version"], VERSION)
        self.assertEqual(len(result["candidateEpisodeGroups"]), 1)
        group = result["candidateEpisodeGroups"][0]
        self.assertEqual(len(group["rawMeasurements"]), 2)
        self.assertEqual({m["rawValue"] for m in group["rawMeasurements"]}, {1})
        self.assertEqual(group["actorReplayPlayerId"], 1)
        self.assertEqual(group["counterpartReplayPlayerId"], 2)
        self.assertEqual(group["sourceEventIds"], ["cmd1", "cmd2"])
        self.assertEqual(group["firstSourceMoment"]["operationOrdinal"], 10)
        self.assertEqual(group["mode"]["kind"], "LOCKED_DISTINCT_TEAMS")
        self.assertEqual(group["grade"]["decision"], "PENDING")
        self.assertIsNone(group["grade"]["bandId"])
        self.assertTrue(all(t["decision"] == "PENDING" and t["noOfficialEligibility"]
                            for t in group["trackHypotheses"]))
        self.assertEqual(group["coverage"]["tier"], "LIMITED")
        self.assertIsNone(group["opportunity"]["approvedDenominator"])
        self.assertIsNone(group["comparability"]["normalizationRuleVersion"])
        self.assertFalse(group["comparability"]["observedClock"]
                         ["fullGameOriginAndCompletenessEstablished"])
        self.assertFalse(result["publicationAllowed"])
        self.assertFalse(result["officialWrites"])
        self.assertEqual(result["claims"], [])
        self.assertEqual(result["trackCredits"], [])
        self.assertEqual(result, call(deepcopy(b), deepcopy(stats), list(reversed(actions * 2))))

    def test_invalid_source_actor_cannot_become_directional_grade(self):
        b, stats, actions = bundle("pressure")
        actions[0]["actorPlayerId"] = 2
        measured = measure(statistics=stats, context=b["context"],
                           action_events=actions, lookback_ms=5000)
        self.assertEqual(len(measured["observations"]), 1)
        with self.assertRaisesRegex(ValueError, "SOURCE_EVENT_ACTOR_CLOCK_MISMATCH"):
            tampered = deepcopy(measured)
            # Put a valid retained actor-sourced facet back under the wrong actor:
            # downstream must recheck original event, not trust producer text.
            tampered["observations"].append({
                **tampered["observations"][0], "observationId": "spoofed",
                "sourceEventIds": ["cmd1"], "fromReplayPlayerId": 1,
                "kind": "DIRECTED_TARGET_COMMAND", "recordedCommandCount": 1,
                "firstSourceMoment": {"recordingAtMs": 11000,
                                     "operationOrdinal": 10, "order": "ORDERED"}})
            call(b, stats, actions, measured=tampered)

    def test_shared_opponent_has_no_direction_or_grade(self):
        b, stats, actions = bundle("co-target", people=(1, 2, 3))
        r = call(b, stats, actions)
        self.assertEqual(r["candidateEpisodeGroups"], [])
        self.assertEqual(r["claims"], [])
        self.assertEqual(r["actorWitnesses"], [])

    def test_past_only_and_source_correction_rebuild(self):
        b, stats, actions = bundle("pressure")
        first = call(b, stats, actions)
        actions.append({"eventId": "pre-command", "actorPlayerId": 1,
                        "timestampMs": 9000, "operationOrdinal": 2,
                        "sourceActionName": "QUEUE"})
        second = call(b, stats, actions)
        g = second["candidateEpisodeGroups"][0]
        self.assertEqual(g["opportunity"]["sourceEventIds"], ["pre-command"])
        self.assertEqual(g["opportunity"]["status"], "UNQUALIFIED")
        actions[-1]["timestampMs"] = 12000
        third = call(b, stats, actions)
        self.assertEqual(third["candidateEpisodeGroups"][0]["opportunity"]["sourceEventIds"], [])
        self.assertNotEqual(first["projectionRevision"], second["projectionRevision"])
        with self.assertRaisesRegex(ValueError, "MEASUREMENT_PRETENDS_TO_BE_QUALIFIED"):
            measured = measure(statistics=stats, context=b["context"],
                               action_events=actions, lookback_ms=5000)
            measured["observations"][0]["coverage"] = "ADMITTED"
            call(b, stats, actions, measured=measured)

    def test_original_missing_ordinal_is_partial_never_reconstructed(self):
        b, stats, actions = bundle("pressure")
        actions[0]["operationOrdinal"] = None
        result = call(b, stats, actions)
        g = result["candidateEpisodeGroups"][0]
        self.assertEqual(g["firstSourceMoment"]["order"], "PARTIAL")
        self.assertIsNone(g["firstSourceMoment"]["operationOrdinal"])
        self.assertEqual(g["grade"]["decision"], "PENDING")

    def test_noop_is_independent_unqualified_counterevidence_not_cancellation_proof(self):
        b, stats, actions = bundle("pressure")
        actions.append({"eventId": "stop-1", "actorPlayerId": 1,
                        "timestampMs": 11050, "operationOrdinal": 11,
                        "sourceActionName": "STOP"})
        r = call(b, stats, actions)
        group = r["candidateEpisodeGroups"][0]
        self.assertEqual(group["counterevidenceCandidates"][0]["sourceEventIds"], ["stop-1"])
        self.assertEqual(group["counterevidenceCandidates"][0]["coverage"], "LIMITED")
        self.assertEqual(group["grade"]["decision"], "PENDING")

    def test_team_mode_requires_locked_proven_teams_and_never_guesses_ffa_alignment(self):
        b, stats, actions = bundle("help", people=(1, 2, 3))
        stats["matchFacts"]["players"] = [
            {"playerId": 1, "lobbyTeamIdRaw": 1},
            {"playerId": 2, "lobbyTeamIdRaw": 1},
            {"playerId": 3, "lobbyTeamIdRaw": 2}]
        r = call(b, stats, actions)
        self.assertEqual(r["mode"]["kind"], "LOCKED_TEAMS")
        self.assertTrue(r["mode"]["fixedAlignmentProven"])
        self.assertTrue(any(t["track"] == "BOND"
                            for t in r["candidateEpisodeGroups"][0]["trackHypotheses"]))
        stats["matchFacts"]["rules"]["lockTeams"]["value"] = False
        unknown = call(b, stats, actions)
        self.assertEqual(unknown["mode"]["kind"], "DYNAMIC_DIPLOMACY_OR_UNVERIFIED")
        self.assertFalse(unknown["mode"]["effectiveDiplomacyProven"])
        self.assertEqual(unknown["candidateEpisodeGroups"][0]["grade"]["decision"], "PENDING")

    def test_one_game_multiple_replay_povs_not_multiple_independent_contributions(self):
        b, stats, actions = bundle("contest", contest=True)
        first = call(b, stats, actions)
        repeated = call(b, stats, list(reversed(actions * 2)))
        self.assertEqual(first, repeated)
        second_game = call(b, stats, actions, game={
            "battleId": "match-A", "gameId": "game-2",
            "gameGuid": "GUID-OTHER", "authorityRevision": "unverified-only"})
        self.assertNotEqual(first["candidateEpisodeGroups"][0]["independentContributionKey"],
                            second_game["candidateEpisodeGroups"][0]["independentContributionKey"])
        other_match = call(b, stats, actions, game={
            "battleId": "match-B", "gameId": "game-1",
            "gameGuid": "GUID-OTHER", "authorityRevision": "unverified-only"})
        self.assertNotEqual(first["candidateEpisodeGroups"][0]["independentContributionKey"],
                            other_match["candidateEpisodeGroups"][0]["independentContributionKey"])
        self.assertFalse(first["gameScopeAuthenticated"])

    def test_raids_are_source_bound_context_not_an_extra_independent_contribution(self):
        b, stats, actions = bundle("pressure")
        p = next(p for p in stats["participants"] if p["playerId"] == 1)
        p["military"] = {"engagements": {
            "modelVersion": "AOF_RAID_DETECTION_V3",
            "raidEvidence": {"initiatedEpisodes": [
                {"raidId": "raid-1", "attackerPlayerId": 1, "victimPlayerId": 2,
                 "sourceEventIds": ["cmd1", "cmd2"], "strongCommandCount": 2}]}}}
        result = call(b, stats, actions)
        self.assertEqual(len(result["candidateEpisodeGroups"]), 1)
        raid = result["candidateEpisodeGroups"][0]["linkedRaidDetectorCandidates"]
        self.assertEqual(len(raid), 1)
        self.assertEqual(raid[0]["raidId"], "raid-1")
        self.assertEqual(raid[0]["sharedOriginalEventIds"], ["cmd1", "cmd2"])
        self.assertEqual(result["candidateEpisodeGroups"][0]["grade"]["decision"], "PENDING")
        self.assertEqual(result["trackCredits"], [])
        # An unrelated recipient's raid is not valid context for this pair.
        p["military"]["engagements"]["raidEvidence"]["initiatedEpisodes"][0]["victimPlayerId"] = 3
        result = call(b, stats, actions)
        self.assertEqual(result["candidateEpisodeGroups"][0]["linkedRaidDetectorCandidates"], [])

    def test_closed_private_schema_rejects_credit_promotion(self):
        b, stats, actions = bundle("pressure")
        result = call(b, stats, actions)
        altered = deepcopy(result)
        altered["officialWrites"] = True
        self.assertTrue(list(Draft202012Validator(SCHEMA).iter_errors(altered)))
        altered = deepcopy(result)
        altered["candidateEpisodeGroups"][0]["grade"]["bandId"] = "FAKE_GRADE"
        self.assertTrue(list(Draft202012Validator(SCHEMA).iter_errors(altered)))
        altered = deepcopy(result)
        altered["claims"] = [{"effect": "STRENGTHEN"}]
        self.assertTrue(list(Draft202012Validator(SCHEMA).iter_errors(altered)))

    def test_context_v2_placement_is_not_castle_or_player_specific_grade(self):
        b, stats, actions = bundle("pressure", castle=True)
        actions.append({"eventId": "castle-placement", "actorPlayerId": 1,
                        "timestampMs": 8000, "operationOrdinal": 4,
                        "sourceActionName": "BUILD"})
        r = call(b, stats, actions)
        self.assertEqual(len(r["neutralPlacementContexts"]), 1)
        p = r["neutralPlacementContexts"][0]
        self.assertEqual(p["buildingClass"], "CASTLE_PLACEMENT")
        self.assertIsNone(p["counterpartReplayPlayerId"])
        self.assertFalse(p["castleOperationProven"])
        self.assertFalse(p["opponentSpecificTerritoryProven"])
        self.assertEqual(p["grade"]["decision"], "PENDING")

    def test_revision_and_source_replacement_fail_closed(self):
        b, stats, actions = bundle("pressure")
        measured = measure(statistics=stats, context=b["context"],
                           action_events=actions, lookback_ms=5000)
        b["context"]["sourceContextRevision"] = "f" * 64
        with self.assertRaisesRegex(ValueError, "STALE_SOURCE_OR_CONTEXT_REVISION"):
            call(b, stats, actions, measured=measured)
        b, stats, actions = bundle("pressure")
        measured = measure(statistics=stats, context=b["context"],
                           action_events=actions, lookback_ms=5000)
        stats["source"]["replaySha256"] = "b" * 64
        with self.assertRaisesRegex(ValueError, "STALE_SOURCE_OR_CONTEXT_REVISION"):
            call(b, stats, actions, measured=measured)

    def test_no_metric_grade_promotion_even_with_independent_detector_overlap(self):
        b, stats, actions = bundle("contest", contest=True)
        r = call(b, stats, actions)
        g = r["candidateEpisodeGroups"][0]
        self.assertTrue(g["linkedDetectorCandidates"])
        self.assertTrue(all(x["decision"] == "PENDING" for x in g["trackHypotheses"]))
        self.assertIsNone(g["grade"]["historicalEffect"])


class AuthenticRecordedMetricGradeTests(unittest.TestCase):
    """Separate opt-in genuine original corpus (never semantic execution oracle)."""

    @unittest.skipUnless(os.environ.get("AOF_SOCIAL_GRADE_AUTHENTIC") == "1",
                         "hash-pinned authentic corpus opt-in")
    def test_real_1v1_2v2_4v4_ffa_original_request_grade_candidates(self):
        from parse_replay import build_payload
        from analysis_dataset import build_analysis_dataset
        from statistics_projector import project_statistics_from_analysis
        from social_v1_context import project_social_v1_context
        for name, (filename, expected) in PINS.items():
            with self.subTest(recording=name):
                original = ROOT / filename
                self.assertTrue(original.is_file(), filename)
                actual = sha256(original.read_bytes()).hexdigest()
                if expected is None:
                    self.fail("AOF_2V2_SHA256_PIN_REQUIRED=" + actual)
                self.assertEqual(actual, expected, "Genuine original hash mismatch")
                with tempfile.TemporaryDirectory(prefix="aof-grade-source-") as folder:
                    canonical = Path(folder) / "canonical"
                    build_payload(original, canonical_dir=canonical, seal_mode="fast")
                    analysis = build_analysis_dataset(canonical, validate=False)
                    stats = project_statistics_from_analysis(analysis)
                    context = project_social_v1_context(statistics=stats)
                    measured = measure(statistics=stats, context=context,
                                       action_events=analysis["actionEvents"], lookback_ms=120000)
                    scope = {"battleId": "TEST-BATTLE-" + name, "gameId": "game-1",
                             "gameGuid": "UNVERIFIED-GUID-" + name,
                             "authorityRevision": "SYNTHETIC_UNTRUSTED_ONLY"}
                    result = grade(statistics=stats, context=context,
                                   source_measurements=measured,
                                   action_events=analysis["actionEvents"], game_scope=scope)
                    assert not result["gameScopeAuthenticated"]
                    assert not result["officialWrites"]
                    assert not result["claims"]
                    assert not result["trackCredits"]
                    assert all(g["coverage"]["tier"] == "LIMITED"
                               and g["grade"]["decision"] == "PENDING"
                               and all(h["decision"] == "PENDING" for h in g["trackHypotheses"])
                               for g in result["candidateEpisodeGroups"])
                    # Stable source-event and revision fingerprints, not invented
                    # damage/rescue/diplomacy or semantic scoring positives.
                    assert result == grade(statistics=stats, context=context,
                        source_measurements=measured,
                        action_events=list(reversed(analysis["actionEvents"])), game_scope=scope)
                    Draft202012Validator(SCHEMA).validate(result)
                    first = result["candidateEpisodeGroups"][0] if result["candidateEpisodeGroups"] else None
                    print("AUTHENTIC_SOURCE_METRIC_GRADE_WITNESS " +
                          json.dumps({"recording": name, "sha256": actual,
                                      "sourceDescriptors": len(measured["observations"]),
                                      "independentCandidateGroups": len(result["candidateEpisodeGroups"]),
                                      "neutralPlacements": len(result["neutralPlacementContexts"]),
                                      "tributeRequests": len(result["neutralTributeRequestContexts"]),
                                      "firstCandidate": None if not first else {
                                          "actor": first["actorReplayPlayerId"],
                                          "target": first["counterpartReplayPlayerId"],
                                          "sourceEventIds": first["sourceEventIds"][:6],
                                          "firstSourceMoment": first["firstSourceMoment"],
                                          "candidateId": first["candidateId"],
                                          "detectors": first["linkedDetectorCandidates"][:2],
                                          "sourceLinkedRaidContexts": first["linkedRaidDetectorCandidates"][:2]},
                                      "semanticTrackCredits": 0,
                                      "officialWrites": False}, sort_keys=True), flush=True)


if __name__ == "__main__":
    unittest.main()

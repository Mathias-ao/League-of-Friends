"""Contract and adversarial tests; no Firebase or official scoring writes."""
import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from directional_episode_ledger import (
    project_directional_episode_ledger, select_current_episode_chapters,
)

SOURCE = {
    "replaySha256": "a" * 64,
    "canonicalManifestSha256": "b" * 64,
    "canonicalSchemaVersion": "1.1.0",
    "parserVersion": "fixture",
}


def league(**overrides):
    result = {
        "matchId": "M1", "battleId": "M1", "gameId": "G1",
        "eventId": "E1", "seasonId": "S1", "eventBattleEligibility": "ELIGIBLE",
        "eventEligibilitySourceRef": "E1/rules-snapshot:fixture",
        "chapterRevision": 1, "resultRevision": 1, "battleOrder": 1, "gameNumber": 1,
        "playerMappingRevision": "binding-1",
        "playerMapping": [
            {"replayPlayerId": 1, "leaguePlayerId": "Alice"},
            {"replayPlayerId": 2, "leaguePlayerId": "Bob"},
            {"replayPlayerId": 3, "leaguePlayerId": "Cara"},
        ],
    }
    result.update(overrides)
    return result


def moment(at, ordinal):
    return {"atMs": at, "operationOrdinal": ordinal}


def fixture(facets, *, deed_id="deed-1", pair=(1, 2), source=SOURCE, extra_incidents=None,
            independence="SOURCE_EPISODE", chronology=True):
    pair = list(pair)
    refs = sorted({ref for f in facets for ref in f.get("sourceEventIds", [])})
    observed = []
    for ref in refs:
        actor = 1
        for f in facets:
            if ref not in f.get("sourceEventIds", []):
                continue
            if "fromPlayerId" in f:
                actor = f["fromPlayerId"]
                break
            if f.get("kind") == "SHARED_OPPONENT_PARTICIPATION":
                actor = next(c["contributorPlayerId"] for c in f["contributions"] if ref in c["sourceEventIds"])
                break
            if f.get("kind") == "LOCAL_COMMAND_OVERLAP":
                actor = f["contributorPlayerId"] if ref.endswith("a") else f["otherPlayerId"]
                break
        observed.append({"sourceEventId": ref, "actorPlayerId": actor,
                         "moment": moment(1000, len(observed) + 1), "commandType": "ORDER"})
    incidents = extra_incidents or [{
        "incidentId": "inc-1", "pairPlayerIds": pair, "sourceEventIds": refs,
        "chronologyCoverage": "QUALIFIED" if chronology else "UNAVAILABLE",
    }]
    return {
        "modelVersion": "AOF_PAIR_SOCIAL_EVIDENCE_V1",
        "identityNamespace": "CANONICAL_REPLAY_PLAYER_ID",
        "gameScope": copy.deepcopy(source), "source": copy.deepcopy(source), "playerIds": [1, 2, 3],
        "observations": observed,
        "incidents": incidents,
        "deeds": [{"deedId": deed_id, "pairPlayerIds": pair,
                   "incidentIds": [row["incidentId"] for row in incidents],
                   "sourceEventIds": refs, "facets": facets,
                   "startedAt": moment(1000, 1 if chronology else None),
                   "endedAt": moment(1000, len(refs) if chronology else None),
                   "independence": independence, "relationContext": "FIXED_OPPONENTS",
                   "activeWindows": []}],
    }


def pressure(ref="attack-a", a=1, b=2):
    return {"kind": "ECONOMY_PRESSURE", "fromPlayerId": a, "toPlayerId": b,
            "sourceEventIds": [ref], "outcomes": "UNAVAILABLE"}


def targeted(ref="attack-a", a=1, b=2):
    return {"kind": "TARGETED_COMMAND", "fromPlayerId": a, "toPlayerId": b,
            "sourceEventIds": [ref], "outcomes": "UNAVAILABLE"}


def support(ref="help-a", a=1, b=2):
    return {"kind": "REINFORCEMENT_COMMANDS", "fromPlayerId": a, "toPlayerId": b,
            "sourceEventIds": [ref], "outcomes": "UNAVAILABLE"}


def project(raw, **options):
    return project_directional_episode_ledger(
        pair_evidence=raw,
        league_context=options.get("league_context", league()),
        episode_context=options.get("episode_context"),
    )


def context(raw, annotations=(), sequences=()):
    return {"modelVersion": "AOF_PAIR_EPISODE_CONTEXT_V1",
            "sourceEvidenceModelVersion": raw["modelVersion"],
            "identityNamespace": raw["identityNamespace"],
            "gameScope": copy.deepcopy(raw["gameScope"]),
            "annotations": list(annotations), "sequences": list(sequences)}


class DirectionalEpisodeLedgerTests(unittest.TestCase):
    def test_pressure_and_targeting_are_one_unscored_episode(self):
        source = fixture([pressure(), targeted()])
        before = copy.deepcopy(source)
        result = project(source)
        self.assertEqual(source, before)
        self.assertEqual(len(result["episodes"]), 1)
        episode = result["episodes"][0]
        self.assertEqual(episode["pairLeaguePlayerIds"], ["Alice", "Bob"])
        self.assertEqual({a["fromLeaguePlayerId"] for a in episode["directionalObservations"]}, {"Alice"})
        self.assertEqual({a["toLeaguePlayerId"] for a in episode["directionalObservations"]}, {"Bob"})
        self.assertEqual({a["candidateTrackForReview"] for a in episode["directionalObservations"]}, {"RIVALRY"})
        self.assertIsNone(episode["relationshipContributionDirection"])
        self.assertEqual(episode["relationshipEffect"], "UNCONFIGURED_POLICY")
        self.assertFalse(result["policy"]["productionScoringEnabled"])
        self.assertFalse(result["policy"]["warRoomEffectsEnabled"])
        self.assertFalse(result["coverage"]["absenceQualified"])

    def test_opposed_membership_and_local_overlap_do_not_imply_hostility_or_counterattack(self):
        overlap = {"kind": "LOCAL_COMMAND_OVERLAP", "contributorPlayerId": 2,
                   "otherPlayerId": 1, "sourceEventIds": ["movement-a", "movement-b"],
                   "targetedActionEstablished": False}
        result = project(fixture([overlap]))
        action = result["episodes"][0]["directionalObservations"][0]
        self.assertEqual(action["kind"], "LOCAL_COMMAND_OVERLAP")
        self.assertIsNone(action["candidateTrackForReview"])
        self.assertNotIn("fromLeaguePlayerId", action)
        self.assertFalse(any(a.get("candidateTrackForReview") == "HOSTILITY" for e in result["episodes"] for a in e["directionalObservations"]))

    def test_bidirectional_actions_do_not_create_reciprocity_credits(self):
        raw = fixture([targeted("a-target", 1, 2), targeted("b-target", 2, 1)])
        result = project(raw)
        actions = result["episodes"][0]["directionalObservations"]
        self.assertEqual({(a["fromLeaguePlayerId"], a["toLeaguePlayerId"]) for a in actions},
                         {("Alice", "Bob"), ("Bob", "Alice")})
        self.assertIsNone(result["episodes"][0]["reciprocityCredit"])
        self.assertEqual(len(result["episodes"]), 1)

    def test_directed_help_not_automatically_returned_or_group_credited(self):
        raw = fixture([support("reinforcement-a", 1, 2)])
        raw["deeds"][0]["relationContext"] = "UNKNOWN"  # FFA/unlocked alignment can be unknown
        result = project(raw)
        observations = result["episodes"][0]["directionalObservations"]
        self.assertEqual([(a["fromLeaguePlayerId"], a["toLeaguePlayerId"]) for a in observations], [("Alice", "Bob")])
        self.assertEqual([a["candidateTrackForReview"] for a in observations], ["BOND"])
        self.assertFalse(any("Cara" in str(a) for a in observations))
        self.assertEqual(result["episodes"][0]["relationContext"], "UNKNOWN")

    def test_shared_opponent_target_not_directed_assistance(self):
        facet = {"kind": "SHARED_OPPONENT_PARTICIPATION", "targetPlayerId": 3,
                 "contributions": [{"contributorPlayerId": 1, "sourceEventIds": ["a"]},
                                   {"contributorPlayerId": 2, "sourceEventIds": ["b"]}],
                 "sourceEventIds": ["a", "b"], "coordinationIntent": "UNAVAILABLE"}
        output = project(fixture([facet]))
        action = output["episodes"][0]["directionalObservations"][0]
        self.assertEqual(action["commonTargetLeaguePlayerId"], "Cara")
        self.assertEqual({c["leaguePlayerId"] for c in action["contributors"]}, {"Alice", "Bob"})
        self.assertIsNone(action["candidateTrackForReview"])
        self.assertNotIn("toLeaguePlayerId", action)

    def test_context_annotations_do_not_manufacture_new_deeds_or_counterattack(self):
        raw = fixture([pressure()])
        tag = {"contextId": "ctx-1", "family": "PRESSURE_RESPONSE", "pressureDeedId": "deed-1",
               "sourceEventIds": ["attack-a", "response"]}
        output = project(raw, episode_context=context(raw, [tag]))
        self.assertEqual(len(output["episodes"]), 1)
        self.assertEqual([x["contextId"] for x in output["episodes"][0]["episodeContextLinks"]], ["ctx-1"])
        self.assertEqual(len(output["episodes"][0]["directionalObservations"]), 1)
        self.assertTrue(output["coverage"]["sourceEpisodeContextAvailable"])
        self.assertRaises(ValueError, project, raw, episode_context=context(raw, [tag, {**tag, "family": "CONFLICT"}]))

    def test_scoring_status_does_not_control_event_battle_evidence(self):
        source = fixture([targeted()])
        a = project(source, league_context=league(affectsLeaguePoints=True))
        b = project(source, league_context=league(affectsLeaguePoints=False))  # non-scoring helper warmup
        self.assertEqual(a, b)
        self.assertEqual(b["leagueContext"]["eventBattleEligibility"], "ELIGIBLE")
        unknown = project(source, league_context=league(eventBattleEligibility="PENDING"))
        self.assertEqual(len(unknown["episodes"]), 1)
        self.assertEqual(unknown["leagueContext"]["eventBattleEligibility"], "PENDING")

    def test_incomplete_identity_excludes_dyad_not_fabricated_no_contact(self):
        source = fixture([targeted()])
        mapping = league()["playerMapping"][:1]
        result = project(source, league_context=league(playerMapping=mapping))
        self.assertEqual(result["episodes"], [])
        self.assertEqual(result["excludedEpisodes"][0]["reason"], "LEAGUE_PAIR_BINDING_UNAVAILABLE")
        self.assertFalse(result["coverage"]["absenceQualified"])

    def test_missing_full_order_keeps_observation_unverified(self):
        raw = fixture([pressure()], chronology=False, independence="UNRESOLVED")
        result = project(raw, league_context=league(battleOrder=None))
        self.assertEqual(result["episodes"][0]["chronologyCoverage"], "UNAVAILABLE")
        self.assertEqual(result["episodes"][0]["independence"], "UNRESOLVED")
        self.assertFalse(result["coverage"]["crossGameChronologyEstablished"])
        self.assertFalse(result["coverage"]["leagueBattleOrderSupplied"])
        self.assertEqual(len(result["episodes"]), 1)

    def test_duplicates_reordering_are_idempotent_and_conflicts_fail_closed(self):
        raw = fixture([targeted()])
        expected = project(raw)
        copies = copy.deepcopy(raw)
        for kind, key in (("deeds", "deedId"), ("incidents", "incidentId"), ("observations", "sourceEventId")):
            copies[kind] = list(reversed(copies[kind] + copy.deepcopy(copies[kind])))
        self.assertEqual(project(copies), expected)
        copies["observations"][0]["actorPlayerId"] = 3
        self.assertRaises(ValueError, project, copies)
        altered = copy.deepcopy(raw)
        altered["deeds"][0]["facets"][0]["toPlayerId"] = 3
        self.assertRaises(ValueError, project, altered)

    def test_correction_revisions_replace_episode_identity_without_award(self):
        raw = fixture([pressure()])
        before = project(raw)
        updated = copy.deepcopy(raw)
        updated["gameScope"]["canonicalManifestSha256"] = "c" * 64
        updated["source"]["canonicalManifestSha256"] = "c" * 64
        changed = project(updated, league_context=league(chapterRevision=2, resultRevision=2))
        self.assertNotEqual(before["episodes"][0]["episodeId"], changed["episodes"][0]["episodeId"])
        self.assertEqual(changed["leagueContext"]["chapterRevision"], 2)
        self.assertFalse(changed["policy"]["productionScoringEnabled"])
        self.assertRaises(ValueError, project, updated, episode_context=context(raw))

    def test_malformed_provenance_mapping_and_source_attribution_fail_closed(self):
        raw = fixture([targeted()])
        broken = copy.deepcopy(raw)
        broken["identityNamespace"] = "LEAGUE_PLAYER_ID"
        self.assertRaises(ValueError, project, broken)
        broken = copy.deepcopy(raw)
        broken["gameScope"]["recordedEventsSha256"] = "d" * 64
        self.assertRaises(ValueError, project, broken)
        broken = copy.deepcopy(raw)
        broken["source"]["replaySha256"] = "f" * 64
        self.assertRaises(ValueError, project, broken)
        self.assertRaises(ValueError, project, raw,
                          league_context=league(eventEligibilitySourceRef=None))
        self.assertRaises(ValueError, project, raw,
                          league_context=league(playerMapping=[{"replayPlayerId": 1, "leaguePlayerId": "Alice"},
                                                               {"replayPlayerId": 2, "leaguePlayerId": "Alice"}]))
        broken = copy.deepcopy(raw)
        broken["observations"][0]["actorPlayerId"] = 2
        self.assertRaises(ValueError, project, broken)

    def test_current_chapter_selection_supersedes_rebind_and_void_without_append(self):
        raw = fixture([targeted()])
        first = project(raw)
        second = project(raw, league_context=league(chapterRevision=2,
            playerMappingRevision="rebind-2", playerMapping=[
                {"replayPlayerId": 1, "leaguePlayerId": "Ada"},
                {"replayPlayerId": 2, "leaguePlayerId": "Bob"},
            ]))
        original = [{"accepted": True, "ledger": first}, {"accepted": True, "ledger": second}]
        result = select_current_episode_chapters(original)
        self.assertEqual(len(result["currentChapters"]), 1)
        self.assertEqual(result["currentChapters"][0]["episodes"][0]["pairLeaguePlayerIds"], ["Ada", "Bob"])
        self.assertEqual(result, select_current_episode_chapters(list(reversed(original + original))))
        void = project(raw, league_context=league(chapterRevision=3))
        result = select_current_episode_chapters(original + [{"accepted": False, "ledger": void}])
        self.assertEqual(result["currentChapters"], [])
        self.assertEqual(result["withdrawnGames"][0]["chapterRevision"], 3)
        self.assertFalse(result["policy"]["authoritativeSourceAcceptanceVerified"])
        self.assertRaises(ValueError, select_current_episode_chapters,
                          original + [{"accepted": False, "ledger": second}])

    def test_native_source_revision_without_canonical_relabeling(self):
        source = {"replaySha256": "a" * 64, "recordedEventsSha256": "d" * 64,
                  "recordedEventsVersion": "AOF_RECORDED_EVENTS_V1", "parserVersion": "native",
                  "extractionRunId": "native-extraction"}
        raw = fixture([targeted()], source=source)
        result = project(raw)
        self.assertIn("recordedEventsSha256", result["sourceRevision"])
        self.assertNotIn("canonicalManifestSha256", result["sourceRevision"])
        self.assertEqual(len(result["episodes"]), 1)


if __name__ == "__main__":
    unittest.main()
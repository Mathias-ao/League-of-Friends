"""Worker #124 context conformance: synthetic adversarial and opt-in real corpus."""
from copy import deepcopy
from pathlib import Path
import os
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from social_v1_context import project_social_v1_context, VERSION

SOURCE = {"replaySha256": "a" * 64, "canonicalManifestSha256": "b" * 64,
          "canonicalSchemaVersion": "1.1.0", "parserVersion": "test-parser"}
# Geometry policy here is an explicitly synthetic preview, NOT approved TERR-01/02.
POLICY = {"friendlyMaxDistanceTiles": 20, "enemyMaxDistanceTiles": 20, "ambiguityMarginTiles": 2}


def player(pid, x=None, y=None, entries=None, military=None, gold=None):
    home = ({"x": x, "y": y, "method": "initial_town_center"}
            if x is not None else {"x": None, "y": None, "method": "initial_owned_object_centroid"})
    return {"playerId": pid, "mapPresence": {"modelVersion": "AOF_MAP_PRESENCE_V8",
        "homeAnchor": home,
        "forwardBuildings": {"evidence": list(entries or [])}, "towers": {"evidence": []},
        "forwardEco": {"ruleVersion": "AOF_FORWARD_ECO_V2", "evidence": []},
        "goldControl": gold or {"layer": "inferred", "controlSharePercent": None, "clusters": []}},
        "military": {"engagements": {"engagementEvidence": military or {}}}}


def build(ref, building, x, y, at=1000):
    return {"sourceEventId": ref, "building": {"rawId": building, "name": "Castle" if building == 82 else "Krepost" if building == 1251 else "Watch Tower"},
            "position": {"x": x, "y": y}, "atMs": at, "enemyProgressPercent": 80}


def stats(people=None, teams=None, locked=True, suffix="a", with_deed=True):
    people = people or [player(1, 10, 10), player(2, 90, 10)]
    teams = teams or {p["playerId"]: p["playerId"] for p in people}
    src = deepcopy(SOURCE); src["replaySha256"] = suffix * 64
    observations = [{"sourceEventId": "attack", "actorPlayerId": 1,
                     "moment": {"atMs": 10_000, "operationOrdinal": 1}, "commandType": "ORDER"}]
    deeds = [{"deedId": "deed-1", "pairPlayerIds": [1, 2], "incidentIds": ["incident-1"],
              "sourceEventIds": ["attack"], "startedAt": {"atMs": 10_000, "operationOrdinal": 1},
              "endedAt": {"atMs": 10_000, "operationOrdinal": 1},
              "facets": [{"kind": "ECONOMY_PRESSURE", "fromPlayerId": 1, "toPlayerId": 2}]}] if with_deed else []
    return {"source": src, "scope": {"observedUntilMs": 100_000},
            "participants": people,
            "matchFacts": {"modelVersion": "AOF_RECORDING_MATCH_FACTS_V1",
                           "rules": {"lockTeams": {"value": locked, "status": "DECODED"}},
                           "players": [{"playerId": i, "lobbyTeamIdRaw": team}
                                       for i, team in sorted(teams.items())]},
            "pairSocialEvidence": {"modelVersion": "AOF_PAIR_SOCIAL_EVIDENCE_V1",
                 "gameScope": deepcopy(src), "observations": observations if with_deed else [],
                 "deeds": deeds, "episodeContext": {"annotations": [], "sequences": []}}}


class SocialContextTests(unittest.TestCase):
    def test_contract_identity_no_claims_and_determinism(self):
        original = stats()
        saved = deepcopy(original)
        result = project_social_v1_context(statistics=original)
        self.assertEqual(result, project_social_v1_context(statistics=deepcopy(original)))
        self.assertEqual(original, saved)
        self.assertEqual(result["version"], VERSION)
        self.assertEqual(result["compatibleSharedContract"], "AOF_SOCIAL_V1_SHARED_1")
        self.assertFalse(result["trust"]["socialClaimsQualified"])
        self.assertFalse(result["trust"]["officialLeagueAuthority"])
        self.assertEqual(result["territoryPolicy"]["status"], "UNCONFIGURED")
        self.assertEqual(result["deedContexts"][0]["sourceDeedId"], "deed-1")
        self.assertEqual(result["deedContexts"][0]["facetKinds"], ["ECONOMY_PRESSURE"])

    def test_per_opponent_geometry_without_rewriting_legacy_enemy_progress(self):
        placed = build("tower", 79, 85, 10)
        s = stats(people=[player(1, 10, 10, [placed]), player(2, 90, 10), player(3, 90, 90)])
        response = project_social_v1_context(statistics=s, territory_policy=POLICY)
        item = response["placementContexts"][0]
        self.assertEqual(item["legacyEnemyProgressPercent"], 80)
        self.assertEqual(s["participants"][0]["mapPresence"]["forwardBuildings"]["evidence"][0]["enemyProgressPercent"], 80)
        by = {r["counterpartReplayPlayerId"]: r for r in item["perOpponentTerritory"]}
        self.assertEqual(by[2]["territory"], "enemy")
        self.assertEqual(by[3]["territory"], "neutral")
        self.assertEqual(response["territoryPolicy"]["status"], "PROPOSED_PREVIEW")
        self.assertFalse(response["territoryPolicy"]["approvedForClaims"])

    def test_locked_teammate_home_is_never_enemy_territory(self):
        s = stats(people=[player(1, 10, 10, [build("near-ally", 79, 50, 10)]),
                          player(2, 90, 10), player(3, 50, 10)], teams={1: 1, 2: 2, 3: 1})
        rows = project_social_v1_context(statistics=s, territory_policy=POLICY)["placementContexts"][0]["perOpponentTerritory"]
        result = {row["counterpartReplayPlayerId"]: row for row in rows}
        self.assertEqual(result[3]["territory"], "friendly")
        self.assertNotEqual(result[2]["territory"], "enemy")

    def test_ffa_multiple_enemy_homes_and_overlap_fail_closed(self):
        s = stats(people=[player(1, 10, 10, [build("shared", 82, 90, 11)]),
                          player(2, 90, 10), player(3, 91, 10)])
        item = project_social_v1_context(statistics=s, territory_policy=POLICY)["placementContexts"][0]
        for row in item["perOpponentTerritory"]:
            self.assertEqual(row["territory"], "ambiguous")
            self.assertIn("MULTIPLE_PLAUSIBLE_ENEMY_HOMES", row["reasonCodes"])
        self.assertFalse(item["specialForwardCastle"]["qualifies"])

    def test_missing_anchor_or_dynamic_relation_does_not_infer_enemy(self):
        for locked, missing in [(False, False), (True, True)]:
            s = stats(people=[player(1, 10, 10, [build("fort", 79, 89, 10)]),
                              player(2, None, None) if missing else player(2, 90, 10)], locked=locked)
            result = project_social_v1_context(statistics=s, territory_policy=POLICY)
            target = result["placementContexts"][0]["perOpponentTerritory"][0]
            self.assertEqual(target["territory"], "ambiguous")
            self.assertEqual(target["qualification"], "PENDING")

    def test_unconfigured_thresholds_never_admit_enemy_territory(self):
        s = stats(people=[player(1, 10, 10, [build("tower", 79, 89, 10)]), player(2, 90, 10)])
        r = project_social_v1_context(statistics=s)["placementContexts"][0]["perOpponentTerritory"][0]
        self.assertEqual(r["territory"], "ambiguous")
        self.assertIn("TERR_01_02_NOT_APPROVED", r["reasonCodes"])
        for invalid in ({"friendlyMaxDistanceTiles": 2}, {**POLICY, "ambiguityMarginTiles": -1}):
            with self.assertRaises(ValueError):
                project_social_v1_context(statistics=s, territory_policy=invalid)

    def test_castle_vs_krepost_and_no_completion_or_queue_inferred(self):
        s = stats(people=[player(1, 10, 10, [build("castle", 82, 89, 10), build("krepost", 1251, 88, 11)]),
                          player(2, 90, 10)])
        rows = {p["sourceEventId"]: p for p in project_social_v1_context(statistics=s, territory_policy=POLICY)["placementContexts"]}
        self.assertEqual(rows["castle"]["buildingClass"], "CASTLE_PLACEMENT")
        self.assertEqual(rows["castle"]["specialForwardCastle"]["status"], "PENDING")
        self.assertFalse(rows["castle"]["specialForwardCastle"]["operationEstablished"])
        self.assertIsNone(rows["krepost"]["specialForwardCastle"])

    def test_same_build_observed_in_three_models_is_one_placement(self):
        s = stats(people=[player(1, 10, 10, [build("watch", 79, 85, 10)]), player(2, 90, 10)])
        place = s["participants"][0]["mapPresence"]
        place["towers"]["evidence"].append({**build("watch", 79, 85, 10), "relativePosition": {"enemyProgressPercent": 80}})
        result = project_social_v1_context(statistics=s)
        self.assertEqual(len(result["placementContexts"]), 1)
        self.assertEqual(result["placementContexts"][0]["sourceFamilies"], ["forwardBuildings", "tower"])
        place["towers"]["evidence"][0]["position"] = {"x": 70, "y": 10}
        with self.assertRaisesRegex(ValueError, "conflicting_build"):
            project_social_v1_context(statistics=s)

    def test_gold_is_influence_not_mining_or_possession(self):
        influence = {"layer": "inferred", "controlSharePercent": 66.67,
                     "controlledGoldDepositEquivalent": 0.667, "takeoversWon": 1,
                     "takeoversLost": 0, "clusters": [{"clusterId": "gold-1", "center": {"x": 50, "y": 50},
                         "depositCount": 1, "playerClaimShare": .667, "finalControllerPlayerId": 1,
                         "controlHistory": [{"atMs": 1500, "fromPlayerId": 2, "toPlayerId": 1,
                                             "changeType": "enemy_control_takeover"}],
                         "playerContributions": [{"sourceEventId": "camp-placement"}]}]}
        s = stats(people=[player(1, 10, 10, gold=influence), player(2, 90, 10)])
        result = project_social_v1_context(statistics=s)
        self.assertIn("NOT_MINING_POSSESSION_OR_EXTRACTION", result["goldInfluenceContexts"][0]["meaning"])
        self.assertEqual(result["goldInfluenceContexts"][0]["clusters"][0]["contributingPlacementSourceEventIds"], ["camp-placement"])

    def test_military_engagements_are_deduped_and_linked_not_credited(self):
        battle = {"battleId": "battle-1", "sourceSkirmishId": "skirmish-1", "startedAtMs": 9500,
                  "endedAtMs": 10500, "sourceEventIds": ["attack", "defense"], "participantPlayerIds": [1, 2],
                  "greatBattle": True}
        a = player(1, 10, 10, military={"battles": [battle]})
        b = player(2, 90, 10, military={"battles": [deepcopy(battle)]})
        result = project_social_v1_context(statistics=stats(people=[a,b]))
        self.assertEqual(len(result["engagementContexts"]), 1)
        self.assertTrue(result["engagementContexts"][0]["greatBattleCandidate"])
        self.assertFalse(result["engagementContexts"][0]["outcomeEstablished"])
        self.assertEqual(result["deedContexts"][0]["linkedEngagementDetectors"][0]["sourceDetectorId"], "battle-1")

    def test_canonical_native_evidence_semantic_parity(self):
        canonical = stats(people=[player(1, 10, 10, [build("fwd", 79, 89, 10)]), player(2, 90, 10)])
        native = deepcopy(canonical)
        source = {"replaySha256": canonical["source"]["replaySha256"],
                  "recordedEventsSha256": "e" * 64,
                  "recordedEventsVersion": "AOF_RECORDED_EVENTS_V1",
                  "parserVersion": "native-parser"}
        native["source"] = source
        native["pairSocialEvidence"]["gameScope"] = deepcopy(source)
        x = project_social_v1_context(statistics=canonical, territory_policy=POLICY)
        y = project_social_v1_context(statistics=native, territory_policy=POLICY)
        for key in ("deedContexts", "engagementContexts", "placementContexts", "goldInfluenceContexts"):
            self.assertEqual(x[key], y[key])
        self.assertNotEqual(x["sourceContextRevision"], y["sourceContextRevision"])

    def test_existing_detector_incidents_preserved_as_one_deed(self):
        # Reuses the repo's actual Raid V3 -> Skirmish -> Engagement V4 -> Pair
        # Social Evidence V1 producers, not a second implementation.
        from test_pair_social_evidence import ledger, raid_actions
        pair = ledger(raid_actions())
        self.assertEqual(len(pair["deeds"]), 1)
        sample = stats()
        sample["source"] = deepcopy(pair["gameScope"])
        sample["pairSocialEvidence"] = pair
        projected = project_social_v1_context(statistics=sample)
        self.assertEqual(len(projected["deedContexts"]), 1)
        self.assertEqual(projected["deedContexts"][0]["facetKinds"],
                         ["ECONOMY_PRESSURE", "LOCAL_COMMAND_OVERLAP", "TARGETED_COMMAND"])
        self.assertFalse(projected["deedContexts"][0]["independentSocialCredit"])

    def test_source_revisions_corrections_and_invalid_refs(self):
        a = stats(suffix="a"); b = stats(suffix="c")
        self.assertNotEqual(project_social_v1_context(statistics=a)["sourceContextRevision"],
                            project_social_v1_context(statistics=b)["sourceContextRevision"])
        a["pairSocialEvidence"]["gameScope"]["replaySha256"] = "f" * 64
        with self.assertRaisesRegex(ValueError, "source_revision_mismatch"):
            project_social_v1_context(statistics=a)
        x = stats(); x["pairSocialEvidence"]["deeds"][0]["endedAt"]["atMs"] = 999
        with self.assertRaisesRegex(ValueError, "deed_outside_recording_clock|deed_reference_outside_episode_interval"):
            project_social_v1_context(statistics=x)
        x = stats(); x["pairSocialEvidence"]["deeds"][0]["sourceEventIds"] = ["absent"]
        with self.assertRaisesRegex(ValueError, "not_in_retained_observations"):
            project_social_v1_context(statistics=x)

    def test_budget_fail_not_silent_truncation(self):
        s = stats(people=[player(1, 10, 10, [build("a", 79, 85, 10), build("b", 79, 88, 10)]), player(2, 90, 10)])
        with self.assertRaisesRegex(ValueError, "budget_exceeded"):
            project_social_v1_context(statistics=s, max_placements=1)

    def test_registered_pair_families_have_no_point_effect(self):
        r = project_social_v1_context(statistics=stats())
        self.assertNotIn("credits", r)
        self.assertNotIn("claims", r)
        self.assertFalse(r["deedContexts"][0]["independentSocialCredit"])


class OptionalRealReplayRegression(unittest.TestCase):
    """Uses the original hash-pinned corpus; absent fixtures explicitly SKIP."""

    def test_original_real_duel_context(self):
        path = os.environ.get("AOF_REPLAY_FIXTURE_DIR")
        if not path:
            self.skipTest("AOF_REPLAY_FIXTURE_DIR not configured; authentic replay not bundled")
        from canonical_io import read_json, sha256
        from parse_replay import build_payload
        from statistics_projector import project_statistics
        fixture = read_json(Path(__file__).with_name("fixtures.json"))["fixtures"][1]
        original = Path(path) / fixture["fileName"]
        if not original.is_file():
            self.skipTest("Hash-pinned original replay absent")
        self.assertEqual(sha256(original), fixture["sha256"])
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "canonical"
            build_payload(original, output)
            actual = project_statistics(output, validate=False)
            before = deepcopy(actual)
            context = project_social_v1_context(statistics=actual)
            self.assertEqual(actual, before)
            self.assertEqual(context["sourceRevision"]["replaySha256"], fixture["sha256"])
            self.assertFalse(context["trust"]["socialClaimsQualified"])
            self.assertTrue(all(x["specialForwardCastle"]["status"] == "PENDING"
                                for x in context["placementContexts"] if x["specialForwardCastle"]))


if __name__ == "__main__":
    unittest.main()

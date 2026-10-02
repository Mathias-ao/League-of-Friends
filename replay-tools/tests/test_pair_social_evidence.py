import copy
import json
import unittest

from engagement_statistics import project_engagement_statistics, ENGAGEMENT_MODEL_VERSION
from pair_social_evidence import project_pair_social_evidence
from raid_detector import detect_raids
from skirmish_detector import detect_skirmishes, PAIR_EVIDENCE_VERSION
from test_engagement_statistics import CATALOG, manifest, initial_objects, action

SOURCE = {
    "replaySha256": "a" * 64, "canonicalManifestSha256": "b" * 64,
    "canonicalSchemaVersion": "1.1.0", "parserVersion": "test-qualified-source",
    "extractionRunId": "fixture",
}


def inputs(actions, teams=(1, 2), lock=True):
    game = manifest(teams=teams, lock_teams=lock)
    objects = initial_objects(len(teams))
    raids = detect_raids(
        manifest=game, catalog=CATALOG, initial_objects=objects,
        build_events=[], action_events=actions,
    )
    skirmishes = detect_skirmishes(manifest=game, initial_objects=objects, action_events=actions)
    engagements = project_engagement_statistics(
        manifest=game, catalog=CATALOG, initial_objects=objects, build_events=[],
        action_events=actions, skirmish_statistics=skirmishes, raid_statistics=raids,
    )
    return {
        "manifest": game, "source": SOURCE, "raid_statistics": raids,
        "engagement_statistics": engagements, "map_presence_statistics": {},
        "action_events": actions,
    }


def ledger(actions, teams=(1, 2), lock=True):
    return project_pair_social_evidence(**inputs(actions, teams, lock))


def raid_actions(n=5, selected_count=20):
    return [
        *[action("attack-" + str(i), 1, 10000 + i * 1000, "ORDER", 80, 80,
                 selected=list(range(1000, 1000 + selected_count)), target=201) for i in range(n)],
        action("response", 2, 12000, "MOVE", 81, 80),
    ]


class PairSocialEvidenceTests(unittest.TestCase):
    def test_raid_skirmish_and_battle_are_one_deed_with_facets(self):
        result = ledger(raid_actions())
        self.assertEqual(len(result["deeds"]), 1)
        deed = result["deeds"][0]
        self.assertEqual(len(deed["incidentIds"]), 2)
        self.assertEqual(
            {facet["kind"] for facet in deed["facets"]},
            {"ECONOMY_PRESSURE", "TARGETED_COMMAND", "LOCAL_COMMAND_OVERLAP"},
        )
        targeted = [facet for facet in deed["facets"] if facet["kind"] == "TARGETED_COMMAND"]
        self.assertEqual([(facet["fromPlayerId"], facet["toPlayerId"]) for facet in targeted], [(1, 2)])
        self.assertEqual(len(targeted[0]["sourceEventIds"]), 5)
        self.assertTrue(targeted[0]["targetEvidence"])
        self.assertEqual(deed["mergeReason"], "shared_pair_specific_strong_command_evidence")

    def test_commands_and_selected_objects_do_not_multiply_deeds(self):
        self.assertEqual(len(ledger(raid_actions(1, 1))["deeds"]), 1)
        self.assertEqual(len(ledger(raid_actions(5, 20))["deeds"]), 1)

    def test_duplicate_copies_reordering_and_rebuild_are_exact(self):
        args = inputs(raid_actions())
        expected = project_pair_social_evidence(**args)
        for row in args["engagement_statistics"].values():
            for key, values in row["engagementEvidence"].items():
                row["engagementEvidence"][key] = list(reversed(values + copy.deepcopy(values)))
        for row in args["raid_statistics"].values():
            for key, values in row["raidEvidence"].items():
                row["raidEvidence"][key] = list(reversed(values + copy.deepcopy(values)))
        args["action_events"] = list(reversed(args["action_events"] + copy.deepcopy(args["action_events"])))
        actual = project_pair_social_evidence(**args)
        self.assertEqual(expected, actual)
        self.assertEqual(actual, project_pair_social_evidence(**copy.deepcopy(args)))

    def test_independent_source_windows_are_not_one_continuous_deed(self):
        first = raid_actions(1)
        later = [
            {**event, "eventId": "later-" + event["eventId"],
             "timestampMs": event["timestampMs"] + 100000,
             "operationOrdinal": event["operationOrdinal"] + 100000}
            for event in first
        ]
        result = ledger(first + later)
        self.assertEqual(len(result["deeds"]), 2)
        self.assertTrue(all(row["durationMeaning"] == "command_evidence_envelope_not_continuous_activity"
                            for row in result["deeds"]))

    def test_local_overlap_is_not_targeted_reciprocity(self):
        result = ledger([
            action("attack", 1, 10000, "DE_ATTACK_MOVE", 50, 50),
            action("response", 2, 12000, "MOVE", 51, 50),
        ])
        self.assertEqual(len(result["deeds"]), 1)
        self.assertEqual({facet["kind"] for facet in result["deeds"][0]["facets"]}, {"LOCAL_COMMAND_OVERLAP"})
        self.assertTrue(all(not facet["targetedActionEstablished"] for facet in result["deeds"][0]["facets"]))

    def test_multiplayer_membership_does_not_create_all_to_all_pairs(self):
        result = ledger([
            action("p1", 1, 10000, "DE_ATTACK_MOVE", 50, 50),
            action("p3", 3, 11000, "DE_ATTACK_MOVE", 68, 50),
            action("p2", 2, 12000, "MOVE", 51, 50),
        ], teams=(1, 2, 1))
        contests = [row for row in result["incidents"] if row["family"] == "LOCAL_CONTEST"]
        self.assertEqual([row["pairPlayerIds"] for row in contests], [[1, 2]])

    def test_reinforcement_direction_does_not_reverse_when_received(self):
        result = ledger([
            action("help", 3, 10000, "PATROL", 20, 20, selected=[3001, 3002, 3003]),
        ], teams=(1, 2, 1))
        support = [row for row in result["deeds"] if any(facet["kind"] == "REINFORCEMENT_COMMANDS" for facet in row["facets"])]
        self.assertEqual(len(support), 1)
        self.assertEqual([(f["fromPlayerId"], f["toPlayerId"]) for f in support[0]["facets"]], [(3, 1)])

    def test_defensive_assistance_retains_helper_and_base_provenance(self):
        result = ledger([
            action("attack", 1, 10000, "DE_ATTACK_MOVE", 80, 80),
            action("defend", 2, 11000, "MOVE", 80, 81),
            action("assist", 3, 13000, "DE_ATTACK_MOVE", 79, 80),
        ], teams=(1, 2, 2))
        support = [row for row in result["incidents"] if row["family"] == "ALLIED_SUPPORT"]
        self.assertEqual(len(support), 1)
        self.assertEqual(support[0]["facets"][0]["fromPlayerId"], 3)
        self.assertEqual(support[0]["facets"][0]["toPlayerId"], 2)
        self.assertEqual(support[0]["contextSourceEventIds"], ["p2-tc"])
        self.assertEqual(support[0]["sourceEventIds"], ["assist"])

    def test_shared_attack_retains_two_contributors_and_target(self):
        result = ledger([
            action("p1", 1, 10000, "DE_ATTACK_MOVE", 20, 80),
            action("p2", 2, 11000, "DE_ATTACK_MOVE", 21, 80),
            action("p3", 3, 12000, "MOVE", 20, 81),
        ], teams=(1, 1, 2))
        shared = [row for row in result["incidents"] if row["family"] == "SHARED_OFFENSIVE_PARTICIPATION"]
        self.assertEqual(len(shared), 1)
        self.assertEqual(shared[0]["pairPlayerIds"], [1, 2])
        self.assertEqual(shared[0]["facets"][0]["targetPlayerId"], 3)
        self.assertEqual([c["contributorPlayerId"] for c in shared[0]["facets"][0]["contributions"]], [1, 2])

    def test_missing_source_is_diagnostic_not_a_deed(self):
        args = inputs(raid_actions())
        args["action_events"] = []
        result = project_pair_social_evidence(**args)
        self.assertEqual(result["deeds"], [])
        self.assertTrue(result["diagnostics"])
        self.assertTrue(all(not row["absenceQualified"] for row in result["coverage"]))

    def test_conflicting_event_identity_is_rejected(self):
        args = inputs(raid_actions())
        args["action_events"] += [{**args["action_events"][0], "actorPlayerId": 2}]
        with self.assertRaisesRegex(ValueError, "Conflicting canonical event"):
            project_pair_social_evidence(**args)

    def test_unavailable_coverage_cannot_become_zero_or_opportunity(self):
        args = inputs([])
        args["engagement_statistics"] = {}
        args["raid_statistics"] = {}
        result = project_pair_social_evidence(**args)
        self.assertTrue(all(row["status"] == "UNAVAILABLE" for row in result["coverage"]))
        self.assertEqual(result["opportunities"], [])
        self.assertFalse(result["policy"]["absenceMeaningEnabled"])

    def test_family_specific_coverage_does_not_leak(self):
        result = ledger(raid_actions())
        rows = {row["family"]: row for row in result["coverage"] if row["fromPlayerId"] == 1 and row["toPlayerId"] == 2}
        self.assertEqual(rows["DIRECTED_PRESSURE"]["status"], "QUALIFIED")
        self.assertEqual(rows["LOCAL_CONTEST"]["status"], "QUALIFIED")
        self.assertEqual(rows["ALLIED_SUPPORT"]["status"], "NOT_APPLICABLE")
        self.assertEqual(rows["RELIC_OUTCOME"]["status"], "UNAVAILABLE")
        self.assertEqual(rows["EFFECTIVE_DIPLOMACY"]["status"], "UNAVAILABLE")
        self.assertTrue(all(not row["absenceQualified"] for row in rows.values()))

    def test_dynamic_diplomacy_keeps_alignment_unknown_and_support_gated(self):
        result = ledger(raid_actions(), lock=False)
        self.assertTrue(result["deeds"])
        self.assertTrue(all(row["relationContext"] == "UNKNOWN" for row in result["deeds"]))
        self.assertTrue(all(row["status"] == "UNAVAILABLE" for row in result["coverage"]))
        result = ledger([
            action("help", 3, 10000, "PATROL", 20, 20, selected=[3001, 3002, 3003]),
        ], teams=(1, 2, 1), lock=False)
        self.assertFalse(any(row["family"] == "ALLIED_SUPPORT" for row in result["incidents"]))

    def test_locked_ffa_has_no_cooperation_and_asymmetric_teams_work(self):
        result = ledger([], teams=(None, None, None))
        self.assertTrue(all(row["status"] == "NOT_APPLICABLE" for row in result["coverage"]
                            if row["family"] == "ALLIED_SUPPORT"))
        result = ledger([
            action("help", 3, 10000, "PATROL", 20, 20, selected=[3001, 3002, 3003]),
        ], teams=(1, 2, 1, 1))
        self.assertTrue(any(row["family"] == "ALLIED_SUPPORT" for row in result["incidents"]))

    def test_missing_ordinal_does_not_invent_replay_order(self):
        args = inputs(raid_actions())
        for event in args["action_events"]:
            event["operationOrdinal"] = None
        result = project_pair_social_evidence(**args)
        self.assertTrue(all(row["chronologyCoverage"] == "UNAVAILABLE" for row in result["incidents"]))

    def test_different_game_or_correction_revises_ids(self):
        args = inputs(raid_actions())
        before = project_pair_social_evidence(**args)
        args["source"] = {**SOURCE, "canonicalManifestSha256": "c" * 64}
        corrected = project_pair_social_evidence(**args)
        self.assertNotEqual(before["deeds"][0]["deedId"], corrected["deeds"][0]["deedId"])
        args["source"] = {**SOURCE, "replaySha256": "d" * 64}
        other_game = project_pair_social_evidence(**args)
        self.assertNotEqual(before["deeds"][0]["deedId"], other_game["deeds"][0]["deedId"])

    def test_no_names_scores_motives_or_outcomes_in_projection(self):
        result = ledger(raid_actions())
        serialized = json.dumps(result)
        for forbidden in ("displayName", "refusal", "rescued", "RELIC_THEFT", "points"):
            self.assertNotIn(forbidden, serialized)
        self.assertFalse(result["policy"]["relationshipScoringEnabled"])


if __name__ == "__main__":
    unittest.main()

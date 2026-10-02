import copy
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pair_episode_context import CONTEXT_VERSION, project_pair_episode_context
from pair_social_evidence import project_pair_social_evidence
from test_pair_social_evidence import inputs, raid_actions, SOURCE
from test_engagement_statistics import action


def arguments(actions=None, teams=(1, 2), lock=True):
    base = inputs(raid_actions() if actions is None else actions, teams, lock)
    return {
        "pair_evidence": project_pair_social_evidence(**base),
        "raid_statistics": base["raid_statistics"],
        "engagement_statistics": base["engagement_statistics"],
        "execution_statistics": {},
        "action_events": base["action_events"],
    }


def response(args, victim=2, attacker=1, ref="response"):
    raw = next(row for row in args["raid_statistics"][str(victim)]["raidEvidence"]["receivedEpisodes"]
               if row["attackerPlayerId"] == attacker)
    event = next(row for row in args["action_events"] if row["eventId"] == ref)
    stats = args["execution_statistics"].setdefault(str(victim), {
        "modelVersion": "AOF_EXECUTION_STATISTICS_V2",
        "raidResponse": {"maximumResponseWindowMs": 30000, "evidence": []}})
    stats["raidResponse"]["evidence"].append({
        "raidStartedAtMs": raw["startedAtMs"], "responseAtMs": event["timestampMs"],
        "responseTimeMs": event["timestampMs"] - raw["startedAtMs"],
        "responseAction": event["sourceActionName"], "sourceEventId": ref,
        "attackerPlayerId": attacker})


def returns():
    return raid_actions(1) + [
        action("return", 2, 100000, "ORDER", 20, 20, target=101),
        action("answer", 1, 101000, "MOVE", 20, 21),
    ]


def support():
    return arguments(raid_actions() + [
        action("assist", 3, 13000, "DE_ATTACK_MOVE", 79, 80),
    ], teams=(1, 2, 2))


def family(result, name, key="annotations"):
    return [row for row in result[key] if row["family"] == name]


class PairEpisodeContextTests(unittest.TestCase):
    def test_response_enriches_pressure_without_reciprocal_attack_or_deed(self):
        args = arguments()
        response(args)
        before = copy.deepcopy(args)
        result = project_pair_episode_context(**args)
        rows = family(result, "PRESSURE_RESPONSE")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["responseActorPlayerId"], 2)
        self.assertEqual(rows[0]["pressureDirection"], {"fromPlayerId": 1, "toPlayerId": 2})
        self.assertEqual(rows[0]["responseCommandType"], "MOVE")
        self.assertFalse(rows[0]["reciprocalAttacksEstablished"])
        self.assertFalse(rows[0]["newDeed"])
        self.assertEqual(args, before)

    def test_wrong_response_actor_source_is_rejected(self):
        args = arguments()
        response(args)
        args["action_events"] = [dict(row, actorPlayerId=1) if row["eventId"] == "response" else row
                                 for row in args["action_events"]]
        result = project_pair_episode_context(**args)
        self.assertEqual(result["annotations"], [])
        self.assertTrue(result["diagnostics"])

    def test_response_before_first_pressure_ordinal_is_rejected(self):
        actions = [action("attack", 1, 10000, "ORDER", 80, 80, target=201),
                   action("response", 2, 10000, "MOVE", 80, 81)]
        actions[0]["operationOrdinal"] = 20
        actions[1]["operationOrdinal"] = 19
        args = arguments(actions)
        response(args)
        self.assertEqual(project_pair_episode_context(**args)["annotations"], [])
        actions[1]["operationOrdinal"] = 21
        args = arguments(actions)
        response(args)
        self.assertEqual(len(family(project_pair_episode_context(**args), "PRESSURE_RESPONSE")), 1)

    def test_response_latency_must_match_existing_source(self):
        args = arguments()
        response(args)
        args["execution_statistics"]["2"]["raidResponse"]["evidence"][0]["responseTimeMs"] += 1
        self.assertFalse(family(project_pair_episode_context(**args), "PRESSURE_RESPONSE"))

    def test_response_window_is_source_defined_and_enforced(self):
        args = arguments()
        response(args)
        args["execution_statistics"]["2"]["raidResponse"]["maximumResponseWindowMs"] = 1
        self.assertFalse(family(project_pair_episode_context(**args), "PRESSURE_RESPONSE"))

    def test_wrong_attacker_never_links_to_another_players_pressure(self):
        args = arguments()
        response(args)
        args["execution_statistics"]["2"]["raidResponse"]["evidence"][0]["attackerPlayerId"] = 9
        self.assertFalse(family(project_pair_episode_context(**args), "PRESSURE_RESPONSE"))

    def test_one_response_matching_two_attackers_remains_ambiguous(self):
        actions = raid_actions() + [
            dict(action("other-attack", 3, 10000, "ORDER", 80, 80, target=201), operationOrdinal=10001)]
        args = arguments(actions, teams=(1, 2, 1))
        response(args, attacker=1)
        response(args, attacker=3)
        result = project_pair_episode_context(**args)
        self.assertFalse(family(result, "PRESSURE_RESPONSE"))
        self.assertIn("AMBIGUOUS_RESPONSE_PRESSURE", [row["code"] for row in result["diagnostics"]])

    def test_unsupported_execution_does_not_qualify_response_coverage(self):
        args = arguments()
        response(args)
        args["execution_statistics"]["2"]["modelVersion"] = "unsupported"
        result = project_pair_episode_context(**args)
        self.assertEqual(result["annotations"], [])
        row = next(row for row in result["coverage"] if row["family"] == "PRESSURE_RESPONSE"
                   and row["fromPlayerId"] == 1 and row["toPlayerId"] == 2)
        self.assertEqual(row["status"], "UNAVAILABLE")

    def test_defensive_support_preserves_helper_recipient_and_threat(self):
        args = support()
        before = copy.deepcopy(args)
        result = project_pair_episode_context(**args)
        rows = family(result, "DEFENSIVE_SUPPORT_WITH_PRESSURE")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["supportDirection"], {"fromPlayerId": 3, "toPlayerId": 2})
        self.assertEqual(rows[0]["pressureDirection"], {"fromPlayerId": 1, "toPlayerId": 2})
        self.assertFalse(rows[0]["directHelperAttackOnPressureActorEstablished"])
        self.assertFalse(rows[0]["continuousPressureEstablished"])
        self.assertEqual(args, before)

    def test_temporal_overlap_without_shared_clash_is_not_support_context(self):
        args = support()
        for stats in args["engagement_statistics"].values():
            for name in ("defensiveAssistsGiven", "defensiveAssistsReceived"):
                for row in stats["engagementEvidence"][name]:
                    row["sourceSkirmishId"] = "unrelated-clash"
        self.assertFalse(family(project_pair_episode_context(**args), "DEFENSIVE_SUPPORT_WITH_PRESSURE"))

    def test_missing_support_parent_source_does_not_qualify(self):
        args = support()
        for stats in args["engagement_statistics"].values():
            for name in ("defensiveAssistsGiven", "defensiveAssistsReceived"):
                for row in stats["engagementEvidence"][name]:
                    row["parentSourceEventIds"] += ["missing"]
        result = project_pair_episode_context(**args)
        self.assertFalse(family(result, "DEFENSIVE_SUPPORT_WITH_PRESSURE"))
        self.assertTrue(result["diagnostics"])

    def test_reinforcement_alone_is_not_defensive_assistance(self):
        args = arguments([action("help", 3, 10000, "PATROL", 20, 20)], teams=(1, 2, 1))
        self.assertTrue(args["pair_evidence"]["deeds"])
        self.assertFalse(family(project_pair_episode_context(**args), "DEFENSIVE_SUPPORT_WITH_PRESSURE"))

    def test_return_pressure_links_distinct_deeds_in_reverse_direction(self):
        args = arguments(returns())
        result = project_pair_episode_context(**args)
        rows = family(result, "RETURN_PRESSURE", "sequences")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["previousDirection"], {"fromPlayerId": 1, "toPlayerId": 2})
        self.assertEqual(rows[0]["returnDirection"], {"fromPlayerId": 2, "toPlayerId": 1})
        self.assertNotEqual(rows[0]["previousPressureDeedId"], rows[0]["returnPressureDeedId"])
        self.assertFalse(rows[0]["reciprocalAttacksEstablished"])

    def test_overlapping_reverse_pressure_is_not_a_return_sequence(self):
        actions = raid_actions() + [action("return", 2, 13000, "ORDER", 20, 20, target=101)]
        result = project_pair_episode_context(**arguments(actions))
        self.assertFalse(result["sequences"])

    def test_intervening_same_direction_episode_blocks_old_return_link(self):
        actions = returns() + [
            action("repeat-return", 2, 200000, "ORDER", 20, 20, target=101),
            action("repeat-answer", 1, 201000, "MOVE", 20, 21)]
        result = project_pair_episode_context(**arguments(actions))
        self.assertEqual(len(result["sequences"]), 1)

    def test_missing_ordinal_blocks_ordered_context(self):
        actions = returns()
        for row in actions:
            row["operationOrdinal"] = None
        args = arguments(actions)
        result = project_pair_episode_context(**args)
        self.assertFalse(result["sequences"])
        self.assertTrue(result["diagnostics"])

    def test_unresolved_deed_independence_blocks_return(self):
        args = arguments(returns())
        args["pair_evidence"]["deeds"][0]["independence"] = "UNRESOLVED"
        self.assertFalse(project_pair_episode_context(**args)["sequences"])

    def test_dynamic_context_retains_ordered_facts_without_qualifying_alignment(self):
        args = arguments(returns(), lock=False)
        result = project_pair_episode_context(**args)
        self.assertEqual(len(result["sequences"]), 1)
        self.assertEqual(result["sequences"][0]["relationContext"], "UNKNOWN")
        self.assertTrue(all(row["status"] == "UNAVAILABLE" for row in result["coverage"]))

    def test_missing_families_are_unknown_and_absence_is_never_qualified(self):
        args = arguments([])
        args["execution_statistics"] = {}
        result = project_pair_episode_context(**args)
        self.assertTrue(all(not row["absenceQualified"] for row in result["coverage"]))
        self.assertFalse(result["policy"]["absenceMeaningEnabled"])
        self.assertEqual(result["annotations"], [])
        self.assertEqual(result["sequences"], [])

    def test_reordering_duplicate_copies_and_rebuilds_are_exact(self):
        args = support()
        response(args)
        expected = project_pair_episode_context(**args)
        for key in ("raid_statistics", "engagement_statistics"):
            for stats in args[key].values():
                evidence = stats.get("raidEvidence", stats.get("engagementEvidence"))
                for name, rows in evidence.items():
                    evidence[name] = list(reversed(rows + copy.deepcopy(rows)))
        args["action_events"] = list(reversed(args["action_events"] + copy.deepcopy(args["action_events"])))
        for stats in args["execution_statistics"].values():
            stats["raidResponse"]["evidence"] *= 2
        actual = project_pair_episode_context(**args)
        self.assertEqual(actual, expected)
        self.assertEqual(actual, project_pair_episode_context(**copy.deepcopy(args)))

    def test_corrected_revision_replaces_context_identity(self):
        args = arguments(returns())
        before = project_pair_episode_context(**args)
        args["pair_evidence"]["gameScope"]["canonicalManifestSha256"] = "c" * 64
        after = project_pair_episode_context(**args)
        self.assertNotEqual(before["sequences"][0]["contextId"], after["sequences"][0]["contextId"])

    def test_conflicting_canonical_identity_fails_closed(self):
        args = arguments()
        args["action_events"] += [dict(args["action_events"][0], actorPlayerId=2)]
        with self.assertRaisesRegex(ValueError, "Conflicting canonical"):
            project_pair_episode_context(**args)

    def test_shared_support_context_requires_pressure_family_coverage(self):
        args = support()
        for row in args["pair_evidence"]["coverage"]:
            if row["family"] in {"DIRECTED_PRESSURE", "LOCAL_CONTEST"}:
                row["status"] = "UNAVAILABLE"
        result = project_pair_episode_context(**args)
        coverage = next(row for row in result["coverage"]
                        if row["family"] == "DEFENSIVE_SUPPORT_WITH_PRESSURE"
                        and row["fromPlayerId"] == 3 and row["toPlayerId"] == 2)
        self.assertEqual(coverage["status"], "UNAVAILABLE")
        # Independently retained positive records need not imply family completeness.
        self.assertTrue(family(result, "DEFENSIVE_SUPPORT_WITH_PRESSURE"))

    def test_no_pressure_deed_without_unique_membership_gets_return_context(self):
        args = arguments(returns())
        args["pair_evidence"]["deeds"] = []
        self.assertFalse(project_pair_episode_context(**args)["sequences"])

    def test_policy_and_source_revision_are_explicit_and_inactive(self):
        args = support()
        result = project_pair_episode_context(**args)
        self.assertEqual(result["modelVersion"], CONTEXT_VERSION)
        self.assertEqual(result["gameScope"], args["pair_evidence"]["gameScope"])
        self.assertTrue(all(value is False for value in result["policy"].values()))
        self.assertNotIn("points", str(result))
        self.assertNotIn("rescued", str(result))


if __name__ == "__main__":
    unittest.main()

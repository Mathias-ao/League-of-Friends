"""Structural facts and pending policy are separate assertions, never credit proof."""
import copy
import unittest
from unittest.mock import patch
from upload_worker import Handler
from test_statistics_social_bridge import statistics, league, pressure, targeted, support
from social_evidence_v1a import project_social_evidence


def project(s=None, **context):
    return project_social_evidence(statistics=s if s is not None else statistics(), league_context=league(**context))


class SocialEvidenceV1aTests(unittest.TestCase):
    def test_pending_result_and_missing_history_keep_local_facts(self):
        r = project(resultRevision=None, officialOutcomeQualification="UNRESOLVED", battleOrder=None)
        self.assertEqual(r["totalDeeds"], 1)
        self.assertIsNone(r["history"]["crossBattleOrder"])
        self.assertFalse(r["trust"]["qualifiedSocialProgression"])

    def test_invalid_result_not_fabricated(self):
        for value in (0, -1, True):
            with self.assertRaises(ValueError):
                project(resultRevision=value, officialOutcomeQualification="UNRESOLVED")
        with self.assertRaises(ValueError):
            project(resultRevision=None, officialOutcomeQualification="OFFICIAL")

    def test_overlapping_families_one_deed_one_claim_per_system_track(self):
        r = project()
        d = r["deeds"][0]
        self.assertEqual(d["families"], ["CONTEST_COUNTERPLAY", "RAIDS_PRESSURE"])
        self.assertEqual(len(d["claims"]), 3)
        self.assertEqual(len({c["claimId"] for c in d["claims"]}), 3)
        self.assertEqual(d["deedQualification"]["status"], "PENDING")
        for c in d["claims"]:
            self.assertEqual(c["qualification"]["status"], "PENDING")
            if c["system"] == "REPUTATION":
                self.assertNotIn("fromLeaguePlayerId", c)
                self.assertNotIn("stage", c)

    def test_distinct_source_deeds_not_collapsed_by_actor_or_time(self):
        s = statistics()
        other = copy.deepcopy(s["pairSocialEvidence"]["deeds"][0])
        other["deedId"] = "distinct-source-deed"
        s["pairSocialEvidence"]["deeds"].append(other)
        self.assertEqual(project(s)["totalDeeds"], 2)

    def test_commands_never_qualify_even_locked_team(self):
        s = statistics([support()])
        s["pairSocialEvidence"]["deeds"][0]["relationContext"] = "FIXED_ALLIES"
        for c in project(s)["deeds"][0]["claims"]:
            self.assertEqual(c["qualification"]["status"], "PENDING")

    def test_ffa_assistance_and_independent_defender_direction_representable(self):
        s = statistics([support(a=2, b=1), targeted(ref="counter", a=1, b=2)])
        s["pairSocialEvidence"]["deeds"][0]["relationContext"] = "UNKNOWN"
        claims = project(s)["deeds"][0]["claims"]
        self.assertTrue(any(c["track"] == "BOND" and c["fromLeaguePlayerId"] == "Bob" for c in claims))
        self.assertTrue(any(c["track"] == "RIVALRY" and c["fromLeaguePlayerId"] == "Alice" for c in claims))
        self.assertTrue(all("DYNAMIC_OR_INDEPENDENT_DIRECTION_QUALIFICATION_PENDING" in c["qualification"]["reasonCodes"] for c in claims))

    def test_bad_refs_clocks_or_actor_fail_closed(self):
        for mutation in (
            lambda p: p["observations"].clear(),
            lambda p: p["observations"][0]["moment"].update(atMs=-1),
            lambda p: p["observations"][0]["moment"].update(atMs=9999999),
            lambda p: p["deeds"][0]["endedAt"].update(atMs=9999),
            lambda p: p["observations"][0].update(actorPlayerId=3),
        ):
            s = statistics(); mutation(s["pairSocialEvidence"])
            with self.assertRaises(ValueError): project(s)

    def test_exact_retry_source_correction_and_mapping_revision(self):
        s = statistics(); before = copy.deepcopy(s)
        self.assertEqual(project(s), project(s))
        self.assertEqual(s, before)
        self.assertNotEqual(project(s)["deeds"][0]["episodeId"], project(s, playerMappingRevision="corrected")["deeds"][0]["episodeId"])

    def test_non_scoring_guest_mapping_independent_of_points(self):
        c = league(); c.update(countsForPoints=False, helper=True)
        r = project_social_evidence(statistics=statistics(), league_context=c)
        self.assertEqual(r, project())

    def test_empty_factual_battle_still_has_history(self):
        r = project(statistics([]))
        self.assertEqual(r["deeds"], [])
        self.assertTrue(r["history"]["chronicleFactualEligibilityIndependentOfSocialCredit"])

    def test_worker_route_requires_both_gate_and_authentication(self):
        for env, authorization, expected in (
            ({}, "", 404),
            ({"AOF_SOCIAL_EVIDENCE_V1A_ENDPOINT": "1"}, "", 404),
            ({"AOF_SOCIAL_EVIDENCE_V1A_ENDPOINT": "1", "AOF_REPLAY_WORKER_AUTH_TOKEN": "secret"}, "Bearer wrong", 401),
        ):
            handler = Handler.__new__(Handler)
            handler.path = "/social-evidence-v1a"
            handler.headers = {"authorization": authorization}
            calls = []
            handler._json = lambda status, body: calls.append(status)
            with patch.dict("os.environ", env, clear=True): handler.do_POST()
            self.assertEqual(calls, [expected])

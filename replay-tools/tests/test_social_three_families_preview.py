"""CI-facing read-only seam checks; existing pair-detector fixtures exercise the entire chain."""
import copy
import unittest

from social_three_families_preview import project_three_families_preview, preview_chronicle_result_line


def fixture(*, mode="raid", native=False):
    source = {"replaySha256": "a" * 64, "parserVersion": "fixture"}
    source.update({"recordedEventsSha256": "b" * 64, "recordedEventsVersion": "AOF_RECORDED_EVENTS_V1"} if native else {
        "canonicalManifestSha256": "b" * 64, "canonicalSchemaVersion": "1.1.0"})
    rel = "FIXED_ALLIES" if mode == "help" else "FIXED_OPPONENTS"
    kind = "DEFENSIVE_PARTICIPATION" if mode == "help" else ("LOCAL_COMMAND_OVERLAP" if mode == "overlap" else "ECONOMY_PRESSURE")
    facet = {"kind": kind, "fromPlayerId": 1, "toPlayerId": 2, "sourceEventIds": ["op-1"]}
    return {"source": source, "pairSocialEvidence": {"modelVersion": "AOF_PAIR_SOCIAL_EVIDENCE_V1",
        "identityNamespace": "CANONICAL_REPLAY_PLAYER_ID", "gameScope": {k: source[k] for k in source},
        "playerIds": [1, 2], "observations": [{"sourceEventId": "op-1", "actorPlayerId": 1,
             "moment": {"atMs": 1000, "operationOrdinal": 7}, "commandType": "ORDER"}],
        "deeds": [{"deedId": "source-episode", "pairPlayerIds": [1, 2], "sourceEventIds": ["op-1"],
             "startedAt": {"atMs": 1000, "operationOrdinal": 7}, "endedAt": {"atMs": 1000, "operationOrdinal": 7},
             "relationContext": rel, "independence": "SOURCE_EPISODE", "facets": [facet]}]}}


class SocialThreeFamilyPreviewTests(unittest.TestCase):
    def test_read_only_raid_and_native(self):
        for native in (False, True):
            s = fixture(native=native)
            before = copy.deepcopy(s)
            result = project_three_families_preview(s)
            self.assertEqual(s, before)
            self.assertEqual({c["track"] for c in result["candidateClaims"]}, {"RIVALRY", "GALLANTRY", "CRUELTY"})
            self.assertTrue(all(c["status"] == "PENDING_SUBSTANTIVE_QUALIFICATION" for c in result["candidateClaims"]))
            self.assertFalse(result["policy"]["productionScoringEnabled"])

    def test_support_direction_and_no_automatic_bond_for_overlap(self):
        support = project_three_families_preview(fixture(mode="help"))["candidateClaims"]
        self.assertEqual({c["track"] for c in support}, {"BOND", "CHIVALRY"})
        self.assertTrue(all(c["actorReplayPlayerId"] == 1 for c in support))
        self.assertEqual(project_three_families_preview(fixture(mode="overlap"))["candidateClaims"], [])

    def test_strict_source_bounds_and_revisions(self):
        bad = fixture()
        bad["pairSocialEvidence"]["deeds"][0]["startedAt"]["atMs"] = 500
        with self.assertRaisesRegex(ValueError, "time_bounds"):
            project_three_families_preview(bad)
        bad = fixture()
        bad["pairSocialEvidence"]["gameScope"]["canonicalManifestSha256"] = "x" * 64
        with self.assertRaisesRegex(ValueError, "source_revision_mismatch"):
            project_three_families_preview(bad)
        bad = fixture()
        bad["pairSocialEvidence"]["deeds"][0]["facets"][0]["toPlayerId"] = 99
        with self.assertRaisesRegex(ValueError, "facet_direction_invalid"):
            project_three_families_preview(bad)

    def test_contested_or_ambiguous_episode_does_not_create_candidate(self):
        s = fixture()
        s["pairSocialEvidence"]["deeds"][0]["independence"] = "UNRESOLVED"
        self.assertEqual(project_three_families_preview(s)["candidateClaims"], [])

    def test_one_result_line_by_default(self):
        result = preview_chronicle_result_line(actor="Alice", opponent="Bob", map_name="Lombardia", result="WIN")
        self.assertEqual(result["sentence"], "Alice defeated Bob on Lombardia.")
        self.assertEqual(result["extraEntries"], [])
        self.assertEqual(preview_chronicle_result_line(actor="Alice", opponent="Bob", map_name="Lombardia", result="UNRESOLVED")["sentence"], None)
        with self.assertRaisesRegex(ValueError, "unsupported_result_topology"):
            preview_chronicle_result_line(actor="Alice", opponent="Bob", map_name="Lombardia", result="ALLY_WIN")

    def test_real_pair_statistics_fixture_integration(self):
        # Reuse main's real detector chain rather than fabricate another pair model.
        try:
            from test_pair_social_evidence import ledger, raid_actions, SOURCE
        except ImportError:
            self.skipTest("requires full repository replay-tools fixture")
        pair = ledger(raid_actions())
        result = project_three_families_preview({"source": SOURCE, "pairSocialEvidence": pair})
        self.assertEqual(result["deedsReviewed"], 1)
        self.assertIn("RIVALRY", {c["track"] for c in result["candidateClaims"]})
        self.assertNotIn("HOSTILITY", {c["track"] for c in result["candidateClaims"]})
        self.assertTrue(all(c["actorReplayPlayerId"] == 1 for c in result["candidateClaims"]))


if __name__ == "__main__":
    unittest.main()
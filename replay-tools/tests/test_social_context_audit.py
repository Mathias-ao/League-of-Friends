import copy
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pair_episode_context import project_pair_episode_context
from social_context_audit import validate_context, validate_ledger, metric_changes
from test_pair_episode_context import arguments, response, returns


def projection():
    args = arguments()
    response(args)
    ledger = copy.deepcopy(args["pair_evidence"])
    ledger["episodeContext"] = project_pair_episode_context(**args)
    return {"participants": [{"playerId": 1}, {"playerId": 2}],
            "pairSocialEvidence": ledger}, args["action_events"]


class SocialContextAuditTests(unittest.TestCase):
    def test_metric_comparison_preserves_unknown_zero_and_player_direction(self):
        before = {"participants": [{"playerId": 2, "military": {"engagements": {"defensiveAssistsGiven": None}}},
                                   {"playerId": 1, "military": {"engagements": {"defensiveAssistsGiven": 0}}}]}
        after = copy.deepcopy(before)
        after["participants"][0]["military"]["engagements"]["defensiveAssistsGiven"] = 3
        unchanged = copy.deepcopy(before)
        self.assertEqual(metric_changes(before, after), [{"playerId": 2, "metric": "defensiveAssistsGiven",
                                                         "before": None, "after": 3}])
        self.assertEqual(before, unchanged)
        self.assertEqual(metric_changes(before, before), [])
        with self.assertRaisesRegex(ValueError, "Comparison roster changed"):
            metric_changes(before, {"participants": []})

    def test_source_backed_response_is_accepted_without_mutating_projection(self):
        result, actions = projection()
        before = copy.deepcopy(result)
        validate_context(result, actions)
        self.assertEqual(result, before)

    def test_neutral_ledger_provenance_is_accepted(self):
        result, actions = projection()
        validate_ledger(result, actions)

    def test_local_overlap_cannot_be_promoted_to_targeted_attack(self):
        result, actions = projection()
        ledger = result["pairSocialEvidence"]
        ledger["incidents"][0]["facets"].append({
            "kind": "LOCAL_COMMAND_OVERLAP", "targetedActionEstablished": True})
        with self.assertRaisesRegex(ValueError, "Overlap became a targeted attack"):
            validate_ledger(result, actions)

    def test_pressure_contributor_direction_cannot_be_reversed(self):
        result, actions = projection()
        ledger = result["pairSocialEvidence"]
        pressure = next(row for row in ledger["incidents"] if row["family"] == "DIRECTED_PRESSURE")
        pressure["facets"][0]["fromPlayerId"] = 2
        with self.assertRaisesRegex(ValueError, "Ledger contributor reversed"):
            validate_ledger(result, actions)

    def test_activated_interpretation_fails_audit(self):
        result, actions = projection()
        key = next(iter(result["pairSocialEvidence"]["episodeContext"]["policy"]))
        result["pairSocialEvidence"]["episodeContext"]["policy"][key] = True
        with self.assertRaisesRegex(ValueError, "Interpretation activated"):
            validate_context(result, actions)

    def test_unknown_source_command_fails_audit(self):
        result, actions = projection()
        row = result["pairSocialEvidence"]["episodeContext"]["annotations"][0]
        row["sourceEventIds"].append("unretained-command")
        with self.assertRaisesRegex(ValueError, "Missing command provenance"):
            validate_context(result, actions)

    def test_wrong_response_actor_fails_audit(self):
        result, actions = projection()
        row = result["pairSocialEvidence"]["episodeContext"]["annotations"][0]
        row["responseActorPlayerId"] = 1
        with self.assertRaisesRegex(ValueError, "Response actor mismatch"):
            validate_context(result, actions)

    def test_duplicate_response_attribution_fails_audit(self):
        result, actions = projection()
        rows = result["pairSocialEvidence"]["episodeContext"]["annotations"]
        rows.append(copy.deepcopy(rows[0]))
        with self.assertRaisesRegex(ValueError, "Response uniquely attributed twice"):
            validate_context(result, actions)

    def test_outcome_claim_fails_audit(self):
        result, actions = projection()
        result["pairSocialEvidence"]["episodeContext"]["annotations"][0]["outcomes"] = "KING_KILLED"
        with self.assertRaisesRegex(ValueError, "Unqualified outcome"):
            validate_context(result, actions)

    def test_wrong_return_direction_fails_audit(self):
        args = arguments(returns())
        ledger = copy.deepcopy(args["pair_evidence"])
        ledger["episodeContext"] = project_pair_episode_context(**args)
        ledger["episodeContext"]["sequences"][0]["returnDirection"] = {"fromPlayerId": 1, "toPlayerId": 2}
        result = {"participants": [{"playerId": 1}, {"playerId": 2}], "pairSocialEvidence": ledger}
        with self.assertRaisesRegex(ValueError, "Wrong return direction"):
            validate_context(result, args["action_events"])


if __name__ == "__main__":
    unittest.main()

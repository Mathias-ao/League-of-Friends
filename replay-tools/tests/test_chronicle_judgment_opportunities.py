"""Pure Chronicle opportunity regression cases: never issue or answer a prompt."""
import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from chronicle_judgment_opportunities import (
    project_chronicle_judgment_opportunities, TREACHERY_REQUIREMENTS, VERSION,
)
from directional_episode_ledger import select_current_episode_chapters
from test_directional_episode_ledger import (
    fixture, league, project, targeted, pressure, support, context,
)


def selected(*ledgers):
    return select_current_episode_chapters([{"accepted": True, "ledger": item} for item in ledgers])


def render(*ledgers, cases=None):
    return project_chronicle_judgment_opportunities(
        selected_chapters=selected(*ledgers), reviewed_cases=cases)


def review(ledger, kind, *, case_id="review-1", respondent="Alice", counterpart="Bob",
           episode=True, **extras):
    ctx = ledger["leagueContext"]
    row = {
        "caseId": case_id, "kind": kind,
        "matchId": ctx["matchId"], "gameId": ctx["gameId"],
        "chapterRevision": ctx["chapterRevision"],
        "playerMappingRevision": ctx["playerMappingRevision"],
        "sourceRevision": copy.deepcopy(ledger["sourceRevision"]),
        "respondentLeaguePlayerId": respondent,
        "counterpartLeaguePlayerId": counterpart,
        "reviewEvidenceRef": "review-case-evidence:1",
    }
    if episode:
        row["sourceEpisodeId"] = ledger["episodes"][0]["episodeId"]
    row.update(extras)
    return row


def help_ledger(*, eligible="ELIGIBLE", with_context=True, chronology=True):
    facet = {"kind": "DEFENSIVE_PARTICIPATION", "fromPlayerId": 1,
             "toPlayerId": 2, "sourceEventIds": ["help-1"], "outcomes": "UNAVAILABLE"}
    raw = fixture([facet], chronology=chronology)
    raw["deeds"][0]["relationContext"] = "FIXED_ALLIES"
    episode_ctx = context(raw, annotations=[{
        "contextId": "support-under-attack-1",
        "family": "DEFENSIVE_SUPPORT_WITH_PRESSURE",
        "supportDeedId": "deed-1",
        "sourceEventIds": ["help-1", "pressure-2"],
    }]) if with_context else None
    return project(raw, league_context=league(eventBattleEligibility=eligible),
                   episode_context=episode_ctx)


def empty_game(n):
    raw = fixture([targeted()])
    raw["deeds"], raw["incidents"], raw["observations"] = [], [], []
    return project(raw, league_context=league(matchId=f"M{n}", battleId=f"B{n}",
                                              gameId=f"G{n}", battleOrder=n))


def loss_review(current, games):
    facts = []
    for ordinal, game in enumerate(games, 1):
        ctx = game["leagueContext"]
        facts.append({"historyOrdinal": ordinal,
                      "matchId": ctx["matchId"], "gameId": ctx["gameId"],
                      "battleId": ctx["battleId"],
                      "loserLeaguePlayerId": "Alice", "winnerLeaguePlayerId": "Bob",
                      "resultRevision": ctx["resultRevision"],
                      "sourceRevision": copy.deepcopy(game["sourceRevision"]),
                      "resultSourceRef": f"official-outcome:B{ordinal}"})
    return review(current, "THIRD_LOSS_SKILL_ACKNOWLEDGMENT", episode=False,
                  historyCoverage="COMPLETE_FOR_PAIR_THROUGH_ANCHOR",
                  historyCoverageRef="pair-history-completeness:1", lossFacts=facts)


class ChronicleJudgmentOpportunitiesV1Tests(unittest.TestCase):
    def test_no_source_no_questions_no_scoring(self):
        result = project_chronicle_judgment_opportunities(selected_chapters=selected())
        self.assertEqual(result["modelVersion"], VERSION)
        self.assertEqual(result["opportunities"], [])
        self.assertTrue(result["policy"]["privateCandidatesOnly"])
        for key in ("questionsPresented", "submissionsEnabled", "automaticPromptDeliveryEnabled",
                    "relationshipScoringEnabled", "treacheryQualifiedByProjection",
                    "skillHierarchyAcknowledgedByProjection", "chroniclePublicationEnabled",
                    "warRoomEffectsEnabled"):
            self.assertFalse(result["policy"][key])

    def test_normal_attacks_and_opposition_do_not_trigger_backstabbing_or_hostility(self):
        ledger = project(fixture([pressure(), targeted()]))
        self.assertEqual(render(ledger)["opportunities"], [])

    def test_basic_teamwork_command_does_not_trigger_routine_question(self):
        ledger = project(fixture([support()]))
        self.assertEqual(render(ledger)["opportunities"], [])
        self.assertEqual(render(help_ledger(with_context=False))["opportunities"], [])

    def test_one_context_enriched_support_produces_private_recipient_candidate(self):
        ledger = help_ledger()
        original = copy.deepcopy(ledger)
        result = render(ledger)
        self.assertEqual(ledger, original)
        self.assertEqual(len(result["opportunities"]), 1)
        row = result["opportunities"][0]
        self.assertEqual(row["kind"], "ASSISTANCE_PERCEPTION")
        self.assertEqual((row["respondentLeaguePlayerId"], row["counterpartLeaguePlayerId"]),
                         ("Bob", "Alice"))
        self.assertEqual(row["reviewStatus"], "CANDIDATE_FOR_HUMAN_REVIEW")
        self.assertEqual(row["relationshipTrackForFutureQualificationReview"], "BOND")
        self.assertFalse(row["relationshipMeaningQualified"])
        self.assertFalse(row["reciprocityQualified"])
        self.assertFalse(row["questionPresented"])
        self.assertFalse(row["judgmentSubmitted"])
        self.assertEqual(row["provenance"]["sourceEpisodeId"], ledger["episodes"][0]["episodeId"])

    def test_support_does_not_imply_reverse_assistance_or_group_membership(self):
        output = render(help_ledger())
        self.assertEqual([(r["respondentLeaguePlayerId"], r["counterpartLeaguePlayerId"])
                          for r in output["opportunities"]], [("Bob", "Alice")])
        self.assertNotIn("Cara", repr(output["opportunities"]))

    def test_source_eligibility_and_chronology_block_review(self):
        pending = render(help_ledger(eligible="PENDING"))["opportunities"][0]
        self.assertEqual(pending["reviewStatus"], "BLOCKED")
        self.assertIn("EVENT_BATTLE_ELIGIBILITY_NOT_VERIFIED", pending["blockers"])
        unordered = render(help_ledger(chronology=False))["opportunities"][0]
        self.assertEqual(unordered["reviewStatus"], "BLOCKED")
        self.assertIn("INCIDENT_CHRONOLOGY_UNAVAILABLE", unordered["blockers"])

    def test_backstabbing_requires_separately_reviewed_context_and_direction(self):
        ledger = project(fixture([pressure()]))
        row = review(ledger, "SITUATED_ANTAGONISM_PERCEPTION",
                     respondent="Bob", counterpart="Alice",
                     circumstanceSourceRefs=["qualified-unusual-context:1"])
        candidate = render(ledger, cases=[row])["opportunities"][0]
        self.assertEqual(candidate["kind"], "SITUATED_ANTAGONISM_PERCEPTION")
        self.assertEqual(candidate["relationshipTrackForFutureQualificationReview"], "HOSTILITY")
        self.assertFalse(candidate["relationshipMeaningQualified"])
        self.assertEqual(candidate["trigger"], "REVIEWED_SOURCE_CONTEXT_NOT_REPLAY_INFERENCE")
        self.assertEqual(render(ledger, cases=[{**row, "circumstanceSourceRefs": []}])
                         ["opportunities"][0]["reviewStatus"], "BLOCKED")
        self.assertRaises(ValueError, render, ledger, cases=[{
            **row, "respondentLeaguePlayerId": "Alice", "counterpartLeaguePlayerId": "Bob"}])

    def test_plain_ally_cooperation_does_not_create_treachery(self):
        self.assertEqual(render(help_ledger())["opportunities"][0]["kind"], "ASSISTANCE_PERCEPTION")
        self.assertFalse(any(r["kind"] == "TREACHERY_VICTIM_CONFIRMATION"
                             for r in render(project(fixture([pressure()]))) ["opportunities"]))

    def test_strict_treachery_review_is_private_not_objectively_qualified_by_projector(self):
        ledger = project(fixture([pressure()]))
        proofs = {r: [f"qualified-source:{r}"] for r in TREACHERY_REQUIREMENTS}
        case = review(ledger, "TREACHERY_VICTIM_CONFIRMATION", episode=False,
                      respondent="Bob", counterpart="Alice",
                      objectiveEvidenceRefs=proofs,
                      objectiveIncidentRef="king-loss-incident:1",
                      objectiveReviewRef="independent-evidence-review:1")
        output = render(ledger, cases=[case])
        row = output["opportunities"][0]
        self.assertEqual(row["kind"], "TREACHERY_VICTIM_CONFIRMATION")
        self.assertEqual(row["respondentLeaguePlayerId"], "Bob")
        self.assertEqual(row["reviewStatus"], "CANDIDATE_FOR_HUMAN_REVIEW")
        self.assertFalse(output["policy"]["treacheryQualifiedByProjection"])
        self.assertFalse(row["judgmentSubmitted"])
        self.assertNotIn("effect", row)

    def test_missing_strict_treachery_elements_block_not_assume_betrayal(self):
        ledger = project(fixture([pressure()]))
        proofs = {r: ["source:1"] for r in TREACHERY_REQUIREMENTS[:-1]}
        case = review(ledger, "TREACHERY_VICTIM_CONFIRMATION", episode=False,
                      respondent="Bob", counterpart="Alice", objectiveEvidenceRefs=proofs)
        row = render(ledger, cases=[case])["opportunities"][0]
        self.assertEqual(row["reviewStatus"], "BLOCKED")
        self.assertIn("MISSING_OBJECTIVE_INCIDENT_IDENTITY_AND_CHRONOLOGY", row["blockers"])
        self.assertIn("STRICT_OBJECTIVE_REVIEW_UNAVAILABLE", row["blockers"])

    def test_skill_requires_three_distinct_losses_from_complete_pair_history(self):
        games = [empty_game(n) for n in (1, 2, 3)]
        self.assertEqual(render(*games)["opportunities"], [])
        row = render(*games, cases=[loss_review(games[2], games)])["opportunities"][0]
        self.assertEqual(row["kind"], "THIRD_LOSS_SKILL_ACKNOWLEDGMENT")
        self.assertEqual(row["respondentLeaguePlayerId"], "Alice")
        self.assertEqual(row["counterpartLeaguePlayerId"], "Bob")
        self.assertEqual(row["reviewStatus"], "CANDIDATE_FOR_HUMAN_REVIEW")
        self.assertFalse(row["relationshipMeaningQualified"])
        self.assertFalse(row["reciprocityQualified"])
        self.assertFalse(row["judgmentSubmitted"])

    def test_two_losses_or_incomplete_coverage_do_not_qualify_third_loss_prompt(self):
        games = [empty_game(n) for n in (1, 2, 3)]
        case = loss_review(games[2], games)
        self.assertEqual(render(*games, cases=[{**case, "lossFacts": case["lossFacts"][:2]}])
                         ["opportunities"][0]["reviewStatus"], "BLOCKED")
        partial = {**case, "historyCoverage": "PARTIAL"}
        blockers = render(*games, cases=[partial])["opportunities"][0]["blockers"]
        self.assertIn("THIRD_LOSS_HISTORY_COMPLETENESS_UNVERIFIED", blockers)

    def test_wrong_winner_duplicate_battle_or_wrong_last_anchor_is_rejected_or_blocked(self):
        games = [empty_game(n) for n in (1, 2, 3)]
        case = loss_review(games[2], games)
        wrong = copy.deepcopy(case)
        wrong["lossFacts"][1]["winnerLeaguePlayerId"] = "Cara"
        self.assertRaises(ValueError, render, *games, cases=[wrong])
        dup = copy.deepcopy(case)
        dup["lossFacts"][1]["historyOrdinal"] = 1
        self.assertEqual(render(*games, cases=[dup])["opportunities"][0]["reviewStatus"], "BLOCKED")
        reordered = copy.deepcopy(case)
        reordered["lossFacts"] = list(reversed(reordered["lossFacts"]))
        self.assertEqual(render(*games, cases=[reordered])["opportunities"][0]["reviewStatus"], "BLOCKED")

    def test_stale_review_never_relabels_corrected_game(self):
        ledger = project(fixture([pressure()]))
        case = review(ledger, "SITUATED_ANTAGONISM_PERCEPTION",
                      respondent="Bob", counterpart="Alice",
                      circumstanceSourceRefs=["outside-case:1"])
        updated = project(fixture([pressure()]), league_context=league(chapterRevision=2))
        self.assertRaises(ValueError, render, updated, cases=[case])
        self.assertNotEqual(ledger["episodes"][0]["episodeId"], updated["episodes"][0]["episodeId"])

    def test_withdrawn_game_never_supplies_opportunities(self):
        ledger = help_ledger()
        selection = select_current_episode_chapters([{"accepted": True, "ledger": ledger},
                            {"accepted": False, "ledger": project(fixture([pressure()]),
                               league_context=league(chapterRevision=2))}])
        result = project_chronicle_judgment_opportunities(selected_chapters=selection)
        self.assertEqual(result["opportunities"], [])
        old_case = review(ledger, "ASSISTANCE_PERCEPTION", respondent="Bob", counterpart="Alice",
                          circumstanceSourceRefs=["helper-evidence:1"])
        self.assertRaises(ValueError, project_chronicle_judgment_opportunities,
                          selected_chapters=selection, reviewed_cases=[old_case])

    def test_rebuild_reordering_and_duplicate_review_copies_are_deterministic(self):
        a, b = help_ledger(), project(fixture([pressure()]), league_context=league(
            matchId="M2", gameId="G2", battleId="B2"))
        c = review(b, "SITUATED_ANTAGONISM_PERCEPTION", case_id="hostility-review",
                   respondent="Bob", counterpart="Alice",
                   circumstanceSourceRefs=["verified-context:1"])
        x = render(a, b, cases=[c, copy.deepcopy(c)])
        y = render(b, a, cases=[copy.deepcopy(c)])
        self.assertEqual(x, y)
        self.assertEqual(len(x["opportunities"]), 2)
        conflicting = {**c, "reviewEvidenceRef": "different-review"}
        self.assertRaises(ValueError, render, a, b, cases=[c, conflicting])

    def test_duplicate_distinct_reviews_same_episode_direction_fail_closed(self):
        ledger = project(fixture([pressure()]))
        first = review(ledger, "SITUATED_ANTAGONISM_PERCEPTION", case_id="c1",
                       respondent="Bob", counterpart="Alice",
                       circumstanceSourceRefs=["event:1"])
        second = {**first, "caseId": "c2", "reviewEvidenceRef": "review:2"}
        self.assertRaises(ValueError, render, ledger, cases=[first, second])
        self.assertRaises(ValueError, render, ledger, cases=[second, first])

    def test_linked_treachery_direction_must_match_victim(self):
        ledger = project(fixture([pressure()]))
        proofs = {r: [f"qualified:{r}"] for r in TREACHERY_REQUIREMENTS}
        case = review(ledger, "TREACHERY_VICTIM_CONFIRMATION", episode=True,
                      objectiveEvidenceRefs=proofs,
                      objectiveIncidentRef="incident:1", objectiveReviewRef="independent-review:1")
        self.assertRaises(ValueError, render, ledger, cases=[case])

    def test_all_reviewer_cases_enforce_revision_and_exact_game_pair(self):
        ledger = help_ledger()
        a = review(ledger, "ASSISTANCE_PERCEPTION", respondent="Bob", counterpart="Alice",
                   circumstanceSourceRefs=["meaningful-context:1"])
        self.assertEqual(len(render(ledger, cases=[a])["opportunities"]), 1)  # no duplicate prompt
        self.assertRaises(ValueError, render, ledger, cases=[{**a, "playerMappingRevision": "wrong"}])
        self.assertRaises(ValueError, render, ledger, cases=[{**a, "counterpartLeaguePlayerId": "Cara"}])
        self.assertRaises(ValueError, render, ledger, cases=[{**a, "gameId": "G9"}])


if __name__ == "__main__":
    unittest.main()
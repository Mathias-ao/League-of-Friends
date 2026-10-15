"""No live Chronicle, binding judgment, reviewer identity or scoring path."""
import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from chronicle_moment_design import (
    VERSION, CATALOG_VERSION, FAMILIES, QUESTIONS,
    project_chronicle_moment_design,
)
from chronicle_judgment_opportunities import TREACHERY_REQUIREMENTS
from test_chronicle_judgment_opportunities import (
    selected, help_ledger, review, empty_game, loss_review,
)
from test_directional_episode_ledger import fixture, project, pressure


def show(*ledgers, cases=None, moments=None):
    return project_chronicle_moment_design(
        selected_chapters=selected(*ledgers),
        reviewed_cases=cases, reviewed_moments=moments)


def theme_case(ledger, family="EARNED_RESPECT", *, moment_id="moment-1",
               intent="JUDGMENT_CANDIDATE", respondent="Bob", counterpart="Alice",
               **additional):
    ctx = ledger["leagueContext"]
    episode = ledger["episodes"][0]
    value = {
        "momentId": moment_id, "family": family, "presentationIntent": intent,
        "matchId": ctx["matchId"], "gameId": ctx["gameId"],
        "chapterRevision": ctx["chapterRevision"],
        "playerMappingRevision": ctx["playerMappingRevision"],
        "sourceRevision": copy.deepcopy(ledger["sourceRevision"]),
        "sourceEpisodeId": episode["episodeId"],
        "respondentLeaguePlayerId": respondent,
        "counterpartLeaguePlayerId": counterpart,
        "episodeSourceEventIds": episode["sourceEventIds"][:1],
        "circumstanceSourceRefs": ["independent-context-review:1"],
        "reviewEvidenceRef": "reviewer:1",
    }
    value.update(additional)
    return value


class ChronicleMomentDesignV1Tests(unittest.TestCase):
    def test_catalog_is_extensible_and_none_of_its_families_auto_delivers(self):
        a = show()
        self.assertEqual((a["modelVersion"], a["catalogVersion"]), (VERSION, CATALOG_VERSION))
        self.assertEqual(a["moments"], [])
        self.assertGreater(len(a["families"]), 4)
        self.assertTrue(all(not row["automaticallyEligibleToPrompt"]
                            and not row["relationshipEffectConfigured"] for row in a["families"]))
        self.assertTrue(all(key in QUESTIONS for key in FAMILIES))
        self.assertEqual(len(set(FAMILIES)), len(FAMILIES))

    def test_old_defensive_assistance_candidate_preserves_direction_and_gate(self):
        a = help_ledger()
        old = copy.deepcopy(a)
        moments = show(a)["moments"]
        self.assertEqual(a, old)
        self.assertEqual(len(moments), 1)
        m = moments[0]
        self.assertEqual(m["family"], "DIRECTED_ASSISTANCE")
        self.assertEqual((m["respondentLeaguePlayerId"], m["counterpartLeaguePlayerId"]),
                         ("Bob", "Alice"))
        self.assertEqual(m["reviewStatus"], "CANDIDATE_FOR_HUMAN_REVIEW")
        self.assertTrue(m["priorSourceCandidateGateRetained"])
        self.assertEqual(m["relationshipTrackForFutureQualificationReview"], "BOND")
        self.assertFalse(m["relationshipEffectQualified"])
        self.assertFalse(m["bindingAnswerRecorded"])
        self.assertFalse(m["themeQualificationApproved"])
        self.assertIn("episode", m["story"]["prose"])
        self.assertTrue(m["proposedQuestion"])

    def test_ordinary_attack_is_not_an_automatic_grievance_or_betrayal_story(self):
        attack = project(fixture([pressure()]))
        self.assertEqual(show(attack)["moments"], [])

    def test_betrayal_question_does_not_state_betrayal_as_fact(self):
        attack = project(fixture([pressure()]))
        source = {r: [f"source:{r}"] for r in TREACHERY_REQUIREMENTS}
        case = review(attack, "TREACHERY_VICTIM_CONFIRMATION", episode=False,
                      respondent="Bob", counterpart="Alice", objectiveEvidenceRefs=source,
                      objectiveIncidentRef="king-incident:1", objectiveReviewRef="reviewer:treachery")
        m = show(attack, cases=[case])["moments"][0]
        self.assertEqual(m["family"], "EXCEPTIONAL_TREACHERY")
        self.assertIn("do you believe", m["proposedQuestion"])
        self.assertIn("not a truth", m["story"]["prose"])
        self.assertEqual({a["choiceId"] for a in m["proposedStructuredChoices"]},
                         {"BETRAYED", "FAIR_PLAY", "UNDECIDED"})
        self.assertFalse(m["story"]["sourceFactClaim"])
        self.assertFalse(m["story"]["playerMotiveClaim"])
        self.assertFalse(m["bindingAnswerRecorded"])

    def test_grievance_is_asked_of_affected_player_not_attacker(self):
        attack = project(fixture([pressure()]))
        case = review(attack, "SITUATED_ANTAGONISM_PERCEPTION", respondent="Bob",
                      counterpart="Alice", circumstanceSourceRefs=["special-context:1"])
        m = show(attack, cases=[case])["moments"][0]
        self.assertEqual(m["family"], "PERSONAL_GRIEVANCE")
        self.assertIn("grievance beyond", m["proposedQuestion"])
        self.assertFalse(m["relationshipEffectQualified"])

    def test_third_loss_is_question_not_a_skill_statement_or_rivalry_change(self):
        games = [empty_game(i) for i in (1, 2, 3)]
        m = show(*games, cases=[loss_review(games[-1], games)])["moments"][0]
        self.assertEqual(m["family"], "SKILL_ACKNOWLEDGMENT")
        self.assertIn("do you now acknowledge", m["proposedQuestion"])
        self.assertFalse(m["bindingAnswerRecorded"])
        self.assertFalse(m["relationshipEffectQualified"])

    def test_blocked_v1_evidence_is_still_blocked_in_story_preview(self):
        blocked = help_ledger(eligible="PENDING")
        m = show(blocked)["moments"][0]
        self.assertEqual(m["reviewStatus"], "BLOCKED")
        self.assertEqual(m["renderingStatus"], "DESIGN_PREVIEW_BLOCKED")
        self.assertIn("EVENT_BATTLE_ELIGIBILITY_NOT_VERIFIED", m["blockers"])

    def test_new_reviewed_theme_is_not_an_authorised_player_question(self):
        ledger = project(fixture([pressure()]))
        moment = show(ledger, moments=[theme_case(ledger)])["moments"][0]
        self.assertEqual(moment["family"], "EARNED_RESPECT")
        self.assertEqual(moment["reviewStatus"], "EXPLORATORY_REVIEW_ONLY")
        self.assertFalse(moment["themeQualificationApproved"])
        self.assertIsNone(moment["relationshipTrackForFutureQualificationReview"])
        self.assertEqual(moment["origin"], "EXPLICIT_REVIEWED_EXPLORATORY_CASE")
        self.assertEqual(moment["evidence"]["sourceEpisodeId"], ledger["episodes"][0]["episodeId"])
        self.assertFalse(moment["questionsDisplayedToPlayer"])

    def test_narration_only_moment_has_no_question_or_answer_choices(self):
        ledger = project(fixture([pressure()]))
        m = show(ledger, moments=[theme_case(ledger, "RIVALRY_DEEPENED", intent="NARRATIVE_ONLY")])["moments"][0]
        self.assertEqual(m["presentationIntent"], "NARRATIVE_ONLY")
        self.assertIsNone(m["proposedQuestion"])
        self.assertEqual(m["proposedStructuredChoices"], [])
        self.assertEqual(m["reviewStatus"], "EXPLORATORY_REVIEW_ONLY")
        self.assertIn("rivalry", m["story"]["prose"])

    def test_narration_and_question_proposals_both_stay_undelivered(self):
        ledger = project(fixture([pressure()]))
        cases = [theme_case(ledger, "MERCY_OR_RECONCILIATION", moment_id="a"),
                 theme_case(ledger, "TRUST_TESTED", moment_id="b", intent="NARRATIVE_ONLY")]
        output = show(ledger, moments=cases)
        self.assertEqual(len(output["moments"]), 2)
        for k in ("narrationPublished", "playerQuestionsSent", "responsesCollected",
                  "bindingJudgmentsRecorded", "scoringEnabled", "warRoomEffectsEnabled",
                  "newThemeQualificationEnabled", "frequencyPolicyConfigured"):
            self.assertFalse(output["policy"][k])
        self.assertTrue(all(not m["bindingAnswerRecorded"] and not m["relationshipEffectQualified"]
                            for m in output["moments"]))

    def test_no_source_episode_means_no_themed_story(self):
        ledger = project(fixture([pressure()]))
        case = theme_case(ledger, sourceEpisodeId="invented")
        with self.assertRaises(ValueError):
            show(ledger, moments=[case])

    def test_cannot_fabricate_event_provenance_or_player_attribution(self):
        ledger = project(fixture([pressure()]))
        for changes in ({"episodeSourceEventIds": ["made-up-ref"]},
                        {"respondentLeaguePlayerId": "Cara"},
                        {"counterpartLeaguePlayerId": "Cara"},
                        {"chapterRevision": 777},
                        {"sourceRevision": {"replaySha256": "wrong"}},
                        {"reviewEvidenceRef": ""}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                show(ledger, moments=[theme_case(ledger, **changes)])

    def test_missing_circumstance_or_order_blocks_exploratory_preview(self):
        ledger = project(fixture([pressure()]))
        m = show(ledger, moments=[theme_case(ledger, circumstanceSourceRefs=[])])["moments"][0]
        self.assertEqual(m["reviewStatus"], "BLOCKED")
        self.assertIn("INDEPENDENT_CIRCUMSTANCE_REVIEW_UNAVAILABLE", m["blockers"])
        self.assertEqual(m["renderingStatus"], "DESIGN_PREVIEW_BLOCKED")

    def test_reviewed_theme_cannot_bypass_treachery_v1_gate(self):
        ledger = project(fixture([pressure()]))
        with self.assertRaises(ValueError):
            show(ledger, moments=[theme_case(ledger, "EXCEPTIONAL_TREACHERY")])
        self.assertEqual(show(ledger)["moments"], [])

    def test_rebuild_order_and_identical_review_copies_are_stable(self):
        a = project(fixture([pressure()]))
        b = project(fixture([pressure()]), league_context={
            **a["leagueContext"], "matchId": "M-extra", "gameId": "G-extra", "battleId": "B-extra"})
        ca, cb = theme_case(a, "EARNED_RESPECT", moment_id="m1"), theme_case(b, "TRUST_TESTED", moment_id="m2")
        x = show(a, b, moments=[ca, cb, copy.deepcopy(ca)])
        y = show(b, a, moments=[cb, ca])
        self.assertEqual(x, y)
        conflict = {**ca, "reviewEvidenceRef": "changed"}
        with self.assertRaises(ValueError):
            show(a, b, moments=[ca, conflict])

    def test_two_independent_respondents_have_separate_reflection_ids(self):
        ledger = project(fixture([pressure()]))
        a = theme_case(ledger, "EARNED_RESPECT", moment_id="m1", respondent="Alice", counterpart="Bob")
        b = theme_case(ledger, "EARNED_RESPECT", moment_id="m2", respondent="Bob", counterpart="Alice")
        moments = show(ledger, moments=[a, b])["moments"]
        self.assertEqual(len({m["momentId"] for m in moments}), 2)
        self.assertTrue(all(m["relationshipTrackForFutureQualificationReview"] is None for m in moments))

    def test_no_duplicate_theme_prompt_same_episode_respondent(self):
        ledger = project(fixture([pressure()]))
        a = theme_case(ledger, moment_id="m1")
        b = theme_case(ledger, moment_id="m2")
        with self.assertRaises(ValueError):
            show(ledger, moments=[a, b])

    def test_selected_source_correction_invalidates_old_theme(self):
        old = project(fixture([pressure()]))
        case = theme_case(old)
        new = project(fixture([pressure()]), league_context={**old["leagueContext"], "chapterRevision": 2})
        with self.assertRaises(ValueError):
            show(new, moments=[case])

    def test_player_wording_is_not_evidence_or_binding_consent(self):
        for family, (question, choices) in QUESTIONS.items():
            self.assertIn(family, FAMILIES)
            self.assertIn("{other}", question)
            self.assertTrue(any(code == "UNDECIDED" for code, _ in choices))
            self.assertNotIn("awarded", question.lower())
            self.assertNotIn("hostility points", question.lower())


if __name__ == "__main__":
    unittest.main()
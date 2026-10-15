"""Focused draft-only interaction regression tests: no auth or writes."""
import copy
import unittest

from chronicle_interaction_draft import project_private_chronicle_interaction as preview, VERSION
from test_chronicle_moment_design import (show, help_ledger, project, fixture, pressure,
                                         review, TREACHERY_REQUIREMENTS, theme_case)


def available():
    return show(help_ledger())


def msg(mid, kind, n, **kwargs):
    return {"actionId": f"local-{n}", "momentId": mid, "kind": kind,
            "claimedViewerLeaguePlayerId": "Bob", **kwargs}


class ChronicleInteractionDraftTests(unittest.TestCase):
    def test_private_direction_and_immutable_design_input(self):
        source = available()
        before = copy.deepcopy(source)
        bob = preview(moment_design=source, viewer_league_player_id="Bob")
        self.assertEqual(source, before)
        self.assertEqual(bob["modelVersion"], VERSION)
        self.assertEqual(len(bob["moments"]), 1)
        self.assertEqual(bob["moments"][0]["renderStatus"], "DEMO_INTERACTION_AVAILABLE")
        self.assertEqual(preview(moment_design=source, viewer_league_player_id="Alice")["moments"], [])

    def test_default_is_unanswered_and_zero_effect(self):
        result = preview(moment_design=available(), viewer_league_player_id="Bob")
        row = result["moments"][0]
        self.assertEqual(row["localSimulation"]["state"], "UNANSWERED")
        self.assertFalse(row["liveSubmissionEnabled"])
        self.assertFalse(row["relationshipEffectQualified"])
        self.assertTrue(result["policy"]["draftSimulationOnly"])
        self.assertTrue(all(not v for k, v in result["policy"].items() if k != "draftSimulationOnly"))

    def test_defer_is_not_a_judgment_and_can_be_reconsidered(self):
        source = available(); mid = source["moments"][0]["momentId"]
        defer = msg(mid, "DEFER", 1)
        first = preview(moment_design=source, viewer_league_player_id="Bob", local_actions=[defer])
        self.assertEqual(first["moments"][0]["localSimulation"]["state"], "DEFERRED")
        self.assertIsNone(first["moments"][0]["localSimulation"]["simulatedReceipt"])
        choice = msg(mid, "SAVE_DRAFT", 2, choiceIds=["MEANINGFUL_SUPPORT"], note="I remember this.")
        second = preview(moment_design=source, viewer_league_player_id="Bob", local_actions=[defer, choice])
        self.assertEqual(second["moments"][0]["localSimulation"]["state"], "LOCAL_DRAFT")

    def test_explicit_confirm_simulates_one_incident_only(self):
        source = available(); mid = source["moments"][0]["momentId"]
        save = msg(mid, "SAVE_DRAFT", 1, choiceIds=["MEANINGFUL_SUPPORT"], note="Thanks")
        confirm = msg(mid, "SIMULATE_CONFIRM", 2, explicitDemoConfirmation=True)
        result = preview(moment_design=source, viewer_league_player_id="Bob", local_actions=[save, confirm])
        sim = result["moments"][0]["localSimulation"]
        self.assertEqual(sim["state"], "SIMULATED_CONFIRMED")
        self.assertEqual(sim["simulatedReceipt"]["choiceIds"], ["MEANINGFUL_SUPPORT"])
        for k in ("bindingJudgmentRecorded", "historicalQualificationEvaluated",
                  "relationshipEffectQualified", "exceptionalTreacheryQualified", "reciprocityQualified", "warRoomEffect"):
            self.assertFalse(sim["simulatedReceipt"][k])
        replay = preview(moment_design=source, viewer_league_player_id="Bob", local_actions=[save, confirm, copy.deepcopy(confirm)])
        self.assertEqual(result, replay)

    def test_second_confirmation_and_mutations_are_rejected(self):
        source = available(); mid = source["moments"][0]["momentId"]
        save = msg(mid, "SAVE_DRAFT", 1, choiceIds=["MEANINGFUL_SUPPORT"], note="")
        confirm = msg(mid, "SIMULATE_CONFIRM", 2, explicitDemoConfirmation=True)
        for extra in (msg(mid, "SIMULATE_CONFIRM", 3, explicitDemoConfirmation=True),
                      msg(mid, "SAVE_DRAFT", 3, choiceIds=["ROUTINE_TEAMWORK"], note=""),
                      msg(mid, "DEFER", 3)):
            with self.subTest(extra=extra["kind"]), self.assertRaises(ValueError):
                preview(moment_design=source, viewer_league_player_id="Bob", local_actions=[save, confirm, extra])

    def test_no_submit_without_selected_draft_and_explicit_confirmation(self):
        source = available(); mid = source["moments"][0]["momentId"]
        with self.assertRaises(ValueError):
            preview(moment_design=source, viewer_league_player_id="Bob", local_actions=[msg(mid, "SIMULATE_CONFIRM", 1, explicitDemoConfirmation=True)])
        with self.assertRaises(ValueError):
            preview(moment_design=source, viewer_league_player_id="Bob", local_actions=[
                msg(mid, "SAVE_DRAFT", 1, choiceIds=["MEANINGFUL_SUPPORT"], note=""),
                msg(mid, "SIMULATE_CONFIRM", 2, explicitDemoConfirmation=False)])

    def test_uncertainty_cannot_create_binding_event_even_in_demo(self):
        source = available(); mid = source["moments"][0]["momentId"]
        with self.assertRaises(ValueError):
            preview(moment_design=source, viewer_league_player_id="Bob", local_actions=[
                msg(mid, "SAVE_DRAFT", 1, choiceIds=["UNDECIDED"], note=""),
                msg(mid, "SIMULATE_CONFIRM", 2, explicitDemoConfirmation=True)])

    def test_forged_viewer_or_other_player_answer_rejected(self):
        source = available(); mid = source["moments"][0]["momentId"]
        spoof = msg(mid, "SAVE_DRAFT", 1, choiceIds=["MEANINGFUL_SUPPORT"], note="")
        for viewer in ("Alice", "Unknown"):
            with self.subTest(viewer=viewer), self.assertRaises(ValueError):
                preview(moment_design=source, viewer_league_player_id=viewer, local_actions=[spoof])
        with self.assertRaises(ValueError):
            preview(moment_design=source, viewer_league_player_id="Bob", local_actions=[{**spoof, "claimedViewerLeaguePlayerId": "Alice"}])

    def test_blocked_and_exploratory_review_do_not_enable_demo_answers(self):
        blocked = show(help_ledger(eligible="PENDING"))
        row = preview(moment_design=blocked, viewer_league_player_id="Bob")["moments"][0]
        self.assertEqual(row["renderStatus"], "BLOCKED")
        with self.assertRaises(ValueError):
            preview(moment_design=blocked, viewer_league_player_id="Bob", local_actions=[msg(row["momentId"], "DEFER", 1)])
        ledger = project(fixture([pressure()]))
        exploratory = show(ledger, moments=[theme_case(ledger)])
        row = preview(moment_design=exploratory, viewer_league_player_id="Bob")["moments"][0]
        self.assertEqual(row["renderStatus"], "EDITORIAL_REVIEW_ONLY")
        with self.assertRaises(ValueError):
            preview(moment_design=exploratory, viewer_league_player_id="Bob", local_actions=[msg(row["momentId"], "DEFER", 1)])

    def test_narration_only_has_no_question_controls(self):
        ledger = project(fixture([pressure()]))
        design = show(ledger, moments=[theme_case(ledger, "RIVALRY_DEEPENED", intent="NARRATIVE_ONLY")])
        row = preview(moment_design=design, viewer_league_player_id="Bob")["moments"][0]
        self.assertEqual(row["renderStatus"], "NARRATIVE_PREVIEW_ONLY")
        self.assertIsNone(row["question"])
        self.assertEqual(row["choices"], [])

    def test_treachery_fair_play_never_claims_exceptional_treachery(self):
        ledger = project(fixture([pressure()]))
        refs = {name: ["ref:" + name] for name in TREACHERY_REQUIREMENTS}
        case = review(ledger, "TREACHERY_VICTIM_CONFIRMATION", episode=False,
                      respondent="Bob", counterpart="Alice", objectiveEvidenceRefs=refs,
                      objectiveIncidentRef="king:review", objectiveReviewRef="objective:review")
        design = show(ledger, cases=[case])
        row = preview(moment_design=design, viewer_league_player_id="Bob")["moments"][0]
        self.assertEqual(row["renderStatus"], "DEMO_INTERACTION_AVAILABLE")
        actions = [msg(row["momentId"], "SAVE_DRAFT", 1, choiceIds=["FAIR_PLAY"], note=""),
                   msg(row["momentId"], "SIMULATE_CONFIRM", 2, explicitDemoConfirmation=True)]
        res = preview(moment_design=design, viewer_league_player_id="Bob", local_actions=actions)
        self.assertFalse(res["moments"][0]["localSimulation"]["simulatedReceipt"]["exceptionalTreacheryQualified"])

    def test_current_design_does_not_expand_compatible_choice_policy(self):
        design = available(); mid = design["moments"][0]["momentId"]
        for choices in (["MEANINGFUL_SUPPORT", "ROUTINE_TEAMWORK"], ["NOT_A_CHOICE"], []):
            with self.subTest(choices=choices), self.assertRaises(ValueError):
                preview(moment_design=design, viewer_league_player_id="Bob", local_actions=[
                    msg(mid, "SAVE_DRAFT", 1, choiceIds=choices, note="")])

    def test_duplicate_conflict_is_rejected(self):
        source = available(); mid = source["moments"][0]["momentId"]
        a = msg(mid, "DEFER", 1)
        with self.assertRaises(ValueError):
            preview(moment_design=source, viewer_league_player_id="Bob", local_actions=[a, {**a, "kind": "SAVE_DRAFT"}])

    def test_source_revision_replaces_old_draft_without_migrating_qualifications(self):
        old = available(); mid = old["moments"][0]["momentId"]
        old_draft = msg(mid, "SAVE_DRAFT", 1, choiceIds=["MEANINGFUL_SUPPORT"], note="")
        # A removed/superseded moment must not be able to accept the old action log.
        altered = copy.deepcopy(old)
        altered["moments"] = []
        with self.assertRaises(ValueError):
            preview(moment_design=altered, viewer_league_player_id="Bob", local_actions=[old_draft])
        self.assertEqual(preview(moment_design=altered, viewer_league_player_id="Bob")["moments"], [])

    def test_optional_non_scoring_note_bounded(self):
        source = available(); mid = source["moments"][0]["momentId"]
        with self.assertRaises(ValueError):
            preview(moment_design=source, viewer_league_player_id="Bob", local_actions=[
                msg(mid, "SAVE_DRAFT", 1, choiceIds=["MEANINGFUL_SUPPORT"], note="X" * 2001)])

    def test_no_public_writes_notifications_or_new_trigger_rules(self):
        design = available(); out = preview(moment_design=design, viewer_league_player_id="Bob")
        self.assertEqual(len(out["moments"]), 1)
        self.assertFalse(out["policy"]["externalPersistenceEnabled"])
        self.assertFalse(out["policy"]["automaticDeliveryEnabled"])
        self.assertFalse(out["policy"]["playerFacingChronicleEnabled"])
        self.assertFalse(out["policy"]["qualifiedHistoricalEvaluationEnabled"])


if __name__ == "__main__":
    unittest.main()
"""Story templates are prose previews, not source inference or player answers."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from chronicle_story_templates import (
    VERSION, QUESTIONS, SCENES, render_chronicle_story_preview,
)


class ChronicleStoryTemplatesV1Tests(unittest.TestCase):
    def test_story_contract_is_explicitly_versioned(self):
        self.assertEqual(VERSION, "AOF_CHRONICLE_STORY_TEMPLATES_V1")
        self.assertEqual(set(SCENES), set(QUESTIONS))

    def test_all_families_have_nonleading_optional_questions(self):
        for family in QUESTIONS:
            with self.subTest(family=family):
                page = render_chronicle_story_preview(
                    family, "Counterpart", intent="JUDGMENT_CANDIDATE", blocked=False)
                self.assertTrue(page["proposedQuestion"].endswith("?"))
                self.assertIn("Counterpart", page["proposedQuestion"])
                self.assertTrue(page["proposedStructuredChoices"])
                self.assertFalse(page["story"]["sourceFactClaim"])
                self.assertFalse(page["story"]["playerMotiveClaim"])
                self.assertFalse(page["story"]["verifiedActionsDescribedByProjector"])

    def test_narrative_only_never_renders_question_or_choice(self):
        page = render_chronicle_story_preview(
            "REMEMBERED_SACRIFICE", "A", intent="NARRATIVE_ONLY", blocked=False)
        self.assertIsNone(page["proposedQuestion"])
        self.assertEqual(page["proposedStructuredChoices"], [])
        self.assertIn("sacrifice", page["story"]["prose"].lower())
        self.assertIn("not yet claim", page["story"]["prose"])

    def test_betrayal_and_reconciliation_do_not_assert_the_perception(self):
        betrayal = render_chronicle_story_preview(
            "EXCEPTIONAL_TREACHERY", "Player B", intent="JUDGMENT_CANDIDATE", blocked=False)
        self.assertIn("not a truth", betrayal["story"]["prose"])
        self.assertEqual({x["choiceId"] for x in betrayal["proposedStructuredChoices"]},
                         {"BETRAYED", "FAIR_PLAY", "UNDECIDED"})
        reconciliation = render_chronicle_story_preview(
            "MERCY_OR_RECONCILIATION", "Player B", intent="JUDGMENT_CANDIDATE", blocked=False)
        self.assertIn("not established", reconciliation["story"]["prose"])

    def test_blocked_preview_remains_blocked(self):
        page = render_chronicle_story_preview(
            "DIRECTED_ASSISTANCE", "B", intent="JUDGMENT_CANDIDATE", blocked=True)
        self.assertEqual(page["renderingStatus"], "DESIGN_PREVIEW_BLOCKED")

    def test_template_library_rejects_unknown_family_and_intent(self):
        with self.assertRaises(ValueError):
            render_chronicle_story_preview("UNREVIEWED_ALLEGATION", "B",
                                           intent="JUDGMENT_CANDIDATE", blocked=False)
        with self.assertRaises(ValueError):
            render_chronicle_story_preview("DIRECTED_ASSISTANCE", "B",
                                           intent="COLLECT_PLAYER_INPUT", blocked=False)


if __name__ == "__main__":
    unittest.main()
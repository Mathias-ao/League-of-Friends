"""Versioned, editorial-only Chronicle story templates.

Storytelling is separate from source/reviewer qualification. These are previews,
not narration of verified actions, publication copy, or player input controls.
No template may claim a player motive or turn a proposal into a fact.
"""
from __future__ import annotations

VERSION = "AOF_CHRONICLE_STORY_TEMPLATES_V1"

# A creative sentence may frame the uncertainty, never resolve it. Each option
# is a proposed *structured statement*, not an implemented binding submission.
QUESTIONS = {
    "EXCEPTIONAL_TREACHERY": (
        "When you return to this Battle in memory, do you believe {other} betrayed you?",
        (("BETRAYED", "Yes. I believe I was betrayed."),
         ("FAIR_PLAY", "No. I regard it as fair play, not betrayal."),
         ("UNDECIDED", "I cannot make that judgment yet.")),
    ),
    "PERSONAL_GRIEVANCE": (
        "Did this encounter with {other} leave you with a grievance beyond the contest itself?",
        (("PERSONAL_GRIEVANCE", "Yes. This left a personal grievance."),
         ("ORDINARY_COMPETITION", "It was fierce, but it was ordinary competition."),
         ("NO_LASTING_CHANGE", "No. It did not change how I regard them."),
         ("UNDECIDED", "I cannot say.")),
    ),
    "SKILL_ACKNOWLEDGMENT": (
        "With these Battles behind you, do you now acknowledge {other} as the stronger player?",
        (("SUPERIOR_SKILL_ACKNOWLEDGED", "Yes. I acknowledge their superior skill."),
         ("STILL_EQUALS", "No. I still consider us competitive equals."),
         ("UNDECIDED", "I am not ready to judge.")),
    ),
    "DIRECTED_ASSISTANCE": (
        "When you recall {other}'s part in that defensive episode, what did it mean to you?",
        (("MEANINGFUL_SUPPORT", "Their actions felt like meaningful support."),
         ("ROUTINE_TEAMWORK", "I appreciated it as ordinary teamwork."),
         ("UNDECIDED", "I cannot say whether it mattered to me.")),
    ),
    "EARNED_RESPECT": (
        "Did something in this encounter earn {other} a new measure of your respect?",
        (("RESPECT", "Yes. My respect for them grew."),
         ("NO_CHANGE", "No. My regard for them did not change."),
         ("UNDECIDED", "I am unsure.")),
    ),
    "UNEXPECTED_ASSISTANCE": (
        "Did {other}'s actions come as unexpected help when you needed it?",
        (("UNEXPECTED_HELP", "Yes. I felt unexpectedly supported."),
         ("EXPECTED_OR_ROUTINE", "No. It was expected or routine."),
         ("UNDECIDED", "I cannot tell.")),
    ),
    "BROTHERHOOD_IN_BATTLE": (
        "Did fighting alongside {other} leave you feeling more closely bound to them?",
        (("CLOSER_BOND", "Yes. We felt closer after this Battle."),
         ("NO_CHANGE", "No. Our bond was unchanged."),
         ("UNDECIDED", "I do not know.")),
    ),
    "MERCY_OR_RECONCILIATION": (
        "Did this moment soften an old grievance you held toward {other}?",
        (("SOFTENED_GRIEVANCE", "Yes. Some of that grievance faded."),
         ("NO_CHANGE", "No. I feel no reconciliation from this."),
         ("UNDECIDED", "I am undecided.")),
    ),
    "TRUST_TESTED": (
        "Did what happened here shake the trust you placed in {other}?",
        (("TRUST_WEAKENED", "Yes. My trust was weakened."),
         ("TRUST_UNCHANGED", "No. My trust did not change."),
         ("UNDECIDED", "I cannot say.")),
    ),
    "RIVALRY_DEEPENED": (
        "Did this contest make you want another reckoning with {other}?",
        (("DEEPENED_CONTEST", "Yes. Our contest matters more to me now."),
         ("NO_CHANGE", "No. My feelings about the contest were unchanged."),
         ("UNDECIDED", "I am uncertain.")),
    ),
    "RIVALRY_RESOLVED": (
        "When you look back on this meeting, does your contest with {other} feel settled?",
        (("FEELS_SETTLED", "Yes. I feel that contest has reached an ending."),
         ("STILL_OPEN", "No. It is not settled for me."),
         ("UNDECIDED", "I cannot tell.")),
    ),
    "FRIENDSHIP_ACROSS_DIVISIONS": (
        "Did this encounter change how you regard {other}, despite the sides you played on?",
        (("CLOSER_REGARD", "Yes. It brought us closer."),
         ("NO_CHANGE", "No. My regard was unchanged."),
         ("UNDECIDED", "I am unsure.")),
    ),
    "REMEMBERED_SACRIFICE": (
        "Did you see {other}'s actions as a sacrifice made for you?",
        (("PERCEIVED_SACRIFICE", "Yes. I understood it as a sacrifice."),
         ("NOT_SACRIFICE", "No. That is not how I saw it."),
         ("UNDECIDED", "I cannot judge.")),
    ),
}

SCENES = {
    "EXCEPTIONAL_TREACHERY": "The record points toward an unsettled incident. Whether an oath was betrayed is not a truth the Chronicle may write in your name.",
    "PERSONAL_GRIEVANCE": "The commands record a directed encounter. Their trace survives; the weight that encounter left behind does not live in the replay.",
    "SKILL_ACKNOWLEDGMENT": "Results may be written in the ledger, yet their place in a rivalry must still be spoken by those who fought.",
    "DIRECTED_ASSISTANCE": "Two names meet in an episode of defensive pressure. Commands were recorded, but the Chronicle cannot know what that moment meant to you.",
    "EARNED_RESPECT": "A contested moment rests on this page. Whether it altered the respect between two competitors is beyond the record.",
    "UNEXPECTED_ASSISTANCE": "The orders survive, but no replay can tell the Chronicle whether any help was unexpected or welcome.",
    "BROTHERHOOD_IN_BATTLE": "Two players share a place in this chapter. The recording alone cannot turn a battle into brotherhood.",
    "MERCY_OR_RECONCILIATION": "Neither silence nor a clash proves mercy. The Chronicle has not established whether any old quarrel softened here.",
    "TRUST_TESTED": "Trust does not appear among the recorded commands. The record preserves the encounter, not a claim that a bond was broken.",
    "RIVALRY_DEEPENED": "Another moment enters the record; whether it fanned a rivalry is not written in the replay.",
    "RIVALRY_RESOLVED": "The record keeps this encounter. It cannot say whether an older contest came to its end.",
    "FRIENDSHIP_ACROSS_DIVISIONS": "Sides in a Battle do not measure friendship. The Chronicle keeps this meeting without naming a new bond.",
    "REMEMBERED_SACRIFICE": "Orders can be remembered, but sacrifice requires more than commands. The Chronicle does not yet claim a cost was borne for another.",
}
DEFAULT_SCENE = "A particular recorded episode has been set aside for reflection. Its larger meaning has not been established by the source."


def render_chronicle_story_preview(family: str, counterpart: str, *, intent: str, blocked: bool) -> dict:
    """Poetic framing of uncertainty, never a verified incident narrative.

    Only the two approved editorial modes are accepted. Templates deliberately
    avoid interpolating arbitrary reviewer free-text or unverified claims.
    """
    if family not in QUESTIONS:
        raise ValueError("Unsupported Chronicle story theme")
    if intent not in ("JUDGMENT_CANDIDATE", "NARRATIVE_ONLY"):
        raise ValueError("Unsupported Chronicle story intent")
    question, choices = QUESTIONS[family]
    return {
        "story": {"tone": "EVOCATIVE_NONLEADING", "prose": SCENES.get(family, DEFAULT_SCENE),
                  "sourceFactClaim": False, "playerMotiveClaim": False,
                  "verifiedActionsDescribedByProjector": False},
        "proposedQuestion": question.format(other=counterpart) if intent == "JUDGMENT_CANDIDATE" else None,
        "proposedStructuredChoices": ([{"choiceId": code, "label": text} for code, text in choices]
                                     if intent == "JUDGMENT_CANDIDATE" else []),
        "renderingStatus": "DESIGN_PREVIEW_BLOCKED" if blocked else "DESIGN_PREVIEW_ONLY",
    }
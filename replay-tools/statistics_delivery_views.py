"""Purpose-built read-only views over a VERIFIED derived-statistics summary.

No league player binding, eligibility, official result, or reputation decision is
made here. Native provenance still needs a social-core compatibility adapter.
"""
from __future__ import annotations
from typing import Any

VERSION = "AOF_STATISTICS_DELIVERY_VIEWS_V1_EXPERIMENTAL"
SUMMARY_VERSIONS = frozenset({
    "AOF_STATISTICS_DELIVERY_V1_EXPERIMENTAL",
    "AOF_STATISTICS_SHARED_EVIDENCE_V1_EXPERIMENTAL",
})


def _require_summary(summary: dict[str, Any]) -> None:
    if (not isinstance(summary, dict) or
            not isinstance(summary.get("statisticsDelivery"), dict) or
            summary["statisticsDelivery"].get("version") not in SUMMARY_VERSIONS):
        raise ValueError("Requires verified derived statistics summary")
    if not isinstance(summary.get("participants"), list):
        raise ValueError("Missing participant measurements")


def battle_measurements(summary: dict[str, Any]) -> dict[str, Any]:
    """All five player categories without the social ledger or engagement arrays.

    Not a legacy full-statistics shape: UI must use the explicit deliveryView.
    """
    _require_summary(summary)
    keys = ("statisticsSchemaVersion", "statisticsProjectionVersion",
            "formulaVersion", "eligibilityRegistryVersion", "entityCatalogVersion",
            "source", "scope", "coverage", "warnings", "participants")
    result = {key: summary[key] for key in keys if key in summary}
    result["deliveryView"] = {
        "version": VERSION, "kind": "BATTLE_MEASUREMENTS",
        "omitted": ["pairSocialEvidence", "matchFacts", "commandEvidence",
                    "recorderCamera",
                    "participants[].military.engagements.engagementEvidence"],
    }
    return result


def neutral_social_inputs(summary: dict[str, Any]) -> dict[str, Any]:
    """Preserve social-core inputs, not social conclusions or official awards."""
    _require_summary(summary)
    if (not isinstance(summary.get("pairSocialEvidence"), dict) or
            not isinstance(summary.get("matchFacts"), dict)):
        raise ValueError("Missing neutral social evidence or match facts")
    participants = []
    for player in summary["participants"]:
        if not isinstance(player, dict) or type(player.get("playerId")) is not int:
            raise ValueError("Invalid replay participant")
        participants.append({
            key: player[key] for key in ("playerId", "replaySlot", "displayName")
            if key in player
        })
    return {
        "deliveryView": {"version": VERSION, "kind": "NEUTRAL_SOCIAL_INPUTS",
                         "ruleResultsIncluded": False},
        "source": summary["source"],
        "matchFacts": summary["matchFacts"],
        "pairSocialEvidence": summary["pairSocialEvidence"],
        "participants": participants,
    }

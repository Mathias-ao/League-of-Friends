"""Read-only DTO adapter over existing prototypes; authentication belongs to Functions.

No meaningfulness predicate is executable here. Verified source observations are
facts about recorded evidence, never proof of damage, intent, rescue or credit.
"""
from statistics_social_bridge import project_statistics_social_chapter
from military_social_families_v1 import project_military_families
from social_three_families_preview import project_three_families_preview

VERSION = "AOF_SOCIAL_EVIDENCE_V1A"


def project_social_evidence(*, statistics, league_context, offset=0):
    if type(offset) is not int or offset < 0:
        raise ValueError("invalid_page")
    # Existing preview verifies referenced observations, attribution and exact
    # source time bounds; ledger additionally verifies incident lineage/facets.
    project_three_families_preview(statistics)
    chapter = project_statistics_social_chapter(statistics=statistics, league_context=league_context)
    ledger = chapter["directionalLedger"]
    duration = chapter["sourceModels"]["observedUntilMs"]
    for observation in statistics["pairSocialEvidence"]["observations"]:
        if observation["moment"]["atMs"] > duration:
            raise ValueError("observation_outside_recording")
    families = project_military_families(bridge_chapter=chapter)
    episodes = sorted(ledger["episodes"], key=lambda e: (e["startedAt"]["atMs"], e["episodeId"]))
    if offset > len(episodes):
        raise ValueError("invalid_page")
    deeds = []
    for episode in episodes[offset:offset + 20]:
        eid = episode["episodeId"]
        facets = [d for d in families["deeds"] if d["episodeId"] == eid]
        claims = []
        for claim in families["candidateClaims"]:
            if claim["sourceEpisodeId"] != eid:
                continue
            reasons = ["SUBSTANTIVE_CONDUCT_NOT_EXECUTABLE", *claim["unsatisfiedTrackQualifications"]]
            if "FIXED_ALIGNMENT_NOT_QUALIFIED_FOR_FAMILY" in claim["sourceBlockers"]:
                reasons.append("DYNAMIC_OR_INDEPENDENT_DIRECTION_QUALIFICATION_PENDING")
            identity = ({"actorLeaguePlayerId": claim["fromLeaguePlayerId"],
                         "counterpartLeaguePlayerId": claim["toLeaguePlayerId"]}
                        if claim["system"] == "REPUTATION" else
                        {"fromLeaguePlayerId": claim["fromLeaguePlayerId"],
                         "toLeaguePlayerId": claim["toLeaguePlayerId"]})
            claims.append({"claimId": claim["claimId"], "system": claim["system"],
                           "track": claim["track"], **identity, "families": claim["families"],
                           "qualification": {"status": "PENDING", "reasonCodes": sorted(set(reasons))}})
        deeds.append({"sourceDeedId": episode["sourceDeedId"], "episodeId": eid,
                      "sourceIncidentIds": episode["sourceIncidentIds"],
                      "sourceEventIds": episode["sourceEventIds"],
                      "pairLeaguePlayerIds": episode["pairLeaguePlayerIds"],
                      "startedAt": episode["startedAt"], "endedAt": episode["endedAt"],
                      "independence": episode["independence"],
                      "relationContext": episode["relationContext"],
                      "families": sorted({f["family"] for f in facets}),
                      "observations": episode["directionalObservations"],
                      "contextLinks": episode["episodeContextLinks"],
                      "deedQualification": {"status": "PENDING", "reasonCodes":
                          ["SUBSTANTIVE_CONDUCT_NOT_EXECUTABLE"] +
                          ([] if episode["independence"] == "SOURCE_EPISODE" else ["DEED_INDEPENDENCE_UNRESOLVED"])},
                      "claims": claims})
    return {"version": VERSION, "sourceRevision": chapter["sourceRevision"],
            "totalDeeds": len(episodes), "deeds": deeds,
            "nextOffset": offset + 20 if offset + 20 < len(episodes) else None,
            "history": {"factsOnly": True, "observedDurationMs": duration,
                        "chronicleFactualEligibilityIndependentOfSocialCredit": True,
                        "crossBattleOrder": None, "reasonCodes": ["CROSS_BATTLE_ORDER_UNAVAILABLE"]},
            "trust": {"sourceStructure": "VERIFIED", "leagueAuthority": "CALLER_MUST_VERIFY",
                      "meaningfulness": "PENDING", "qualifiedSocialProgression": False},
            "lineage": "SOURCE_LOCAL_ONLY_NO_CROSS_SOURCE_MATCHING"}

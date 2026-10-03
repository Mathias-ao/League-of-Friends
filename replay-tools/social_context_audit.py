"""Review real recording context without activating social interpretation."""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from copy import deepcopy
import json
import math
import os
from pathlib import Path
import tempfile
from unittest.mock import patch

from analysis_dataset import build_analysis_dataset
from canonical_io import read_json
from pair_episode_context import project_pair_episode_context
from parse_replay import build_payload
from statistics_projector import project_statistics_from_analysis

AUDIT_VERSION = "AOF_REAL_SOCIAL_CONTEXT_AUDIT_V1"
ROOT = Path(__file__).resolve().parents[1]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def canonical_moment(event):
    return event["timestampMs"], event["operationOrdinal"]


def validate_ledger(projection, actions):
    ledger = projection["pairSocialEvidence"]
    lookup = {row["eventId"]: row for row in actions}
    require(ledger["opportunities"] == [], "Cooperation opportunity invented")
    require(ledger["policy"]["commandsAreNotOutcomes"] is True, "Command/outcome boundary removed")
    require(ledger["policy"]["relationshipScoringEnabled"] is False, "Relationship scoring activated")
    for incident in ledger["incidents"]:
        require(all(ref in lookup for ref in incident["sourceEventIds"]), "Missing ledger provenance")
        for facet in incident["facets"]:
            kind = facet["kind"]
            if kind in {"ECONOMY_PRESSURE", "TARGETED_COMMAND", "DEFENSIVE_PARTICIPATION",
                        "REINFORCEMENT_COMMANDS"}:
                require(facet["outcomes"] == "UNAVAILABLE", "Ledger outcome invented")
                require(all(lookup[ref]["actorPlayerId"] == facet["fromPlayerId"]
                            for ref in facet["sourceEventIds"]), "Ledger contributor reversed")
            elif kind == "LOCAL_COMMAND_OVERLAP":
                require(facet["targetedActionEstablished"] is False, "Overlap became a targeted attack")
            elif kind == "SHARED_OPPONENT_PARTICIPATION":
                require(facet["coordinationIntent"] == "UNAVAILABLE", "Coordination intent invented")
                require(facet["targetPlayerId"] == incident["context"]["targetPlayerId"],
                        "Common target changed")
                contributors = facet["contributions"]
                require(sorted(row["contributorPlayerId"] for row in contributors)
                        == incident["pairPlayerIds"], "Allied contributors flattened")
                require(facet["targetPlayerId"] not in incident["pairPlayerIds"], "Ally became target")
                require(all(lookup[ref]["actorPlayerId"] == row["contributorPlayerId"]
                            for row in contributors for ref in row["sourceEventIds"]),
                        "Shared attack contributor reversed")
    for row in ledger["relicTargetingObservations"]:
        require(lookup[row["sourceEventId"]]["actorPlayerId"] == row["actorPlayerId"],
                "Relic command actor reversed")


def validate_context(projection, actions):
    ledger = projection["pairSocialEvidence"]
    context = ledger["episodeContext"]
    lookup = {row["eventId"]: row for row in actions}
    incidents = {row["incidentId"]: row for row in ledger["incidents"]}
    deeds = {row["deedId"]: row for row in ledger["deeds"]}
    players = {row["playerId"] for row in projection["participants"]}
    require(all(value is False for value in context["policy"].values()), "Interpretation activated")
    require(all(not row["absenceQualified"] for row in context["coverage"]), "Absence qualified")
    response_sources = set()
    for row in context["annotations"] + context["sequences"]:
        require(row["newDeed"] is False, "Context became a deed")
        require(row["causalResponseEstablished"] is False, "Causal response claimed")
        require(row["reciprocalAttacksEstablished"] is False, "Reciprocal attacks claimed")
        require(row["outcomes"] == "UNAVAILABLE", "Unqualified outcome")
        require(set(row["pairPlayerIds"]).issubset(players), "Unknown pair")
        require(all(ref in lookup for ref in row["sourceEventIds"]), "Missing command provenance")
        for key in ("pressureIncidentId", "supportIncidentId", "previousPressureIncidentId",
                    "returnPressureIncidentId"):
            if key in row:
                require(row[key] in incidents, "Missing incident provenance")
        for key in ("pressureDeedId", "supportDeedId", "previousPressureDeedId",
                    "returnPressureDeedId"):
            if key in row:
                require(row[key] in deeds, "Missing deed provenance")
        if row["family"] == "PRESSURE_RESPONSE":
            event = lookup[row["responseSourceEventId"]]
            require(event["actorPlayerId"] == row["pressureDirection"]["toPlayerId"], "Response actor reversed")
            require(event["actorPlayerId"] == row["responseActorPlayerId"], "Response actor mismatch")
            require(event["sourceActionName"] == row["responseCommandType"], "Response command mismatch")
            require(row["responseSourceEventId"] not in response_sources, "Response uniquely attributed twice")
            response_sources.add(row["responseSourceEventId"])
        elif row["family"] == "DEFENSIVE_SUPPORT_WITH_PRESSURE":
            helper, defended = (row["supportDirection"][key] for key in ("fromPlayerId", "toPlayerId"))
            require(defended == row["pressureDirection"]["toPlayerId"], "Wrong defended player")
            require(len({helper, defended, row["pressureDirection"]["fromPlayerId"]}) == 3, "Invalid support triple")
            require(row["relationContext"] == "FIXED_ALLIES", "Unqualified alliance")
            require(all(ref in lookup for ref in row["parentSourceEventIds"]), "Missing parent evidence")
            require(row["directHelperAttackOnPressureActorEstablished"] is False, "Invented helper attack")
        elif row["family"] == "RETURN_PRESSURE":
            a, b = (row["previousDirection"][key] for key in ("fromPlayerId", "toPlayerId"))
            require(row["returnDirection"] == {"fromPlayerId": b, "toPlayerId": a}, "Wrong return direction")
            require(row["previousPressureDeedId"] != row["returnPressureDeedId"], "Same deed returned")
            before = incidents[row["previousPressureIncidentId"]]["sourceEventIds"]
            after = incidents[row["returnPressureIncidentId"]]["sourceEventIds"]
            require(not set(before) & set(after), "Return shares commands")
            require(max(canonical_moment(lookup[ref]) for ref in before)
                    < min(canonical_moment(lookup[ref]) for ref in after), "Return not ordered")


def ledger_sample(row):
    sample = deepcopy(row)
    sample = {key: sample[key] for key in
              ("incidentId", "pairPlayerIds", "startedAt", "relationContext", "facets", "context")}
    for facet in sample["facets"]:
        if "sourceEventIds" in facet:
            facet["sourceEventCount"] = len(facet["sourceEventIds"])
            facet["sourceEventIds"] = facet["sourceEventIds"][:6]
        if "targetEvidence" in facet:
            facet["targetEvidence"] = facet["targetEvidence"][:3]
        for contribution in facet.get("contributions", []):
            contribution["sourceEventCount"] = len(contribution["sourceEventIds"])
            contribution["sourceEventIds"] = contribution["sourceEventIds"][:6]
    return sample


def summarize(projection, analysis, *, sample_limit=2):
    validate_ledger(projection, analysis["actionEvents"])
    validate_context(projection, analysis["actionEvents"])
    ledger = projection["pairSocialEvidence"]
    context = ledger["episodeContext"]
    facts = projection["matchFacts"]
    require(facts["source"]["replaySha256"] == projection["source"]["replaySha256"],
            "Match facts source differs")
    require(facts["result"]["winnerPlayerIds"] is None and facts["result"]["loserPlayerIds"] is None,
            "Replay-only result was promoted")
    lookup = {row["eventId"]: row for row in analysis["actionEvents"]}
    incidents = {row["incidentId"]: row for row in ledger["incidents"]}
    rows = context["annotations"] + context["sequences"]
    families = defaultdict(list)
    for row in rows:
        families[row["family"]].append(row)
    samples = {}
    for family, values in sorted(families.items()):
        ordered = sorted(values, key=lambda row: row["contextId"])
        samples[family] = []
        for row in ordered[:sample_limit]:
            sample = deepcopy(row)
            sample["sourceEventCount"] = len(sample["sourceEventIds"])
            sample["sourceEventIds"] = sample["sourceEventIds"][:6]
            if "parentSourceEventIds" in sample:
                sample["parentSourceEventCount"] = len(sample["parentSourceEventIds"])
                sample["parentSourceEventIds"] = sample["parentSourceEventIds"][:6]
            if family == "PRESSURE_RESPONSE":
                event = lookup[row["responseSourceEventId"]]
                center = incidents[row["pressureIncidentId"]].get("context", {}).get("center") or {}
                center = center if isinstance(center, dict) else {}
                point = event.get("position") or {}
                point = point if isinstance(point, dict) else {}
                sample["recordedCommandPosition"] = point
                if all(type(value) in (int, float) for value in
                       (center.get("x"), center.get("y"), point.get("x"), point.get("y"))):
                    sample["commandDistanceToPressureCenterTiles"] = round(
                        math.hypot(point["x"] - center["x"], point["y"] - center["y"]), 3)
                sample["pressureStartedAt"] = incidents[row["pressureIncidentId"]]["startedAt"]
            samples[family].append(sample)
    ledger_samples = {}
    for family in sorted({row["family"] for row in ledger["incidents"]}):
        values = sorted((row for row in ledger["incidents"] if row["family"] == family),
                        key=lambda row: (row["startedAt"]["atMs"], row["incidentId"]))
        ledger_samples[family] = [ledger_sample(row) for row in values[:1]]
    pressure_directions = Counter()
    for row in ledger["incidents"]:
        for facet in row["facets"]:
            if facet["kind"] == "ECONOMY_PRESSURE":
                pressure_directions[f'{facet["fromPlayerId"]}->{facet["toPlayerId"]}'] += 1
    return {
        "source": projection["source"],
        "recordingMatchFacts": {"modelVersion": facts["modelVersion"],
                               "game": facts["game"], "map": facts["map"],
                               "ruleValues": {key: row["value"] for key, row in facts["rules"].items()},
                               "lobbyGroups": facts["lobbyGroups"],
                               "resultQualification": facts["result"]["qualification"],
                               "postgameEventCount": len(facts["result"]["postgameEvidence"]),
                               "resignationEventCount": len(facts["result"]["resignationEvidence"]),
                               "headerSource": facts["headerSource"]},
        "playerCount": len(projection["participants"]),
        "participants": [{"playerId": row["playerId"], "lobbyTeamId": row.get("lobbyTeamId")}
                         for row in analysis["manifest"]["participants"]],
        "settings": analysis["manifest"].get("match", {}).get("settings", {}),
        "gameGuid": analysis["manifest"].get("match", {}).get("guid"),
        "observedUntilMs": projection["scope"]["observedUntilMs"],
        "incidentCounts": dict(sorted(Counter(row["family"] for row in ledger["incidents"]).items())),
        "deedCount": len(ledger["deeds"]), "pressureDirections": dict(sorted(pressure_directions.items())),
        "contextCounts": dict(sorted(Counter(row["family"] for row in rows).items())),
        "contextDiagnosticCounts": dict(sorted(Counter(row["code"] for row in context["diagnostics"]).items())),
        "ledgerDiagnosticCounts": dict(sorted(Counter(row["code"] for row in ledger["diagnostics"]).items())),
        "responseCommandTypes": dict(sorted(Counter(row["responseCommandType"] for row in
                                                    context["annotations"] if row["family"] == "PRESSURE_RESPONSE").items())),
        "coverageCounts": dict(sorted(Counter(row["family"] + ":" + row["status"]
                                             for row in context["coverage"]).items())),
        "samples": samples, "ledgerSamples": ledger_samples,
        "relicTargetingObservationCount": len(ledger["relicTargetingObservations"]),
        "reviewBoundary": "source-backed command episodes; no confirmed damage, motives or engine outcomes",
    }


def context_inputs(projection, analysis):
    participants = projection["participants"]
    return {
        "pair_evidence": projection["pairSocialEvidence"],
        "raid_statistics": {str(row["playerId"]): row["military"]["engagements"] for row in participants},
        "engagement_statistics": {str(row["playerId"]): row["military"]["engagements"] for row in participants},
        "execution_statistics": {str(row["playerId"]): row["execution"] for row in participants},
        "action_events": analysis["actionEvents"],
    }


def audit_recording(entry, seal_mode):
    replay = (ROOT / entry["path"]).resolve()
    require(replay.is_relative_to(ROOT / "replay-fixtures"), "Fixture path escapes corpus")
    require(replay.is_file() and replay.suffix == ".aoe2record", "Recording unavailable")
    with tempfile.TemporaryDirectory(prefix="aof-social-audit-") as temporary:
        canonical = Path(temporary) / "canonical"
        build_payload(replay, canonical_dir=canonical, seal_mode=seal_mode)
        analysis = build_analysis_dataset(canonical, validate=False)
        before = deepcopy(analysis)
        projection = project_statistics_from_analysis(analysis)
        require(len(projection["participants"]) == entry.get("expectedPlayers", len(projection["participants"])),
                "Unexpected fixture player count")
        with patch("statistics_projector.project_pair_episode_context", return_value={}):
            baseline = project_statistics_from_analysis(analysis)
        active = deepcopy(projection)
        active["pairSocialEvidence"].pop("episodeContext")
        baseline["pairSocialEvidence"].pop("episodeContext")
        require(active == baseline, "Existing statistics/neutral ledger changed")
        require(analysis == before, "Analysis evidence mutated")
        args = context_inputs(projection, analysis)
        # Rebuild from the already retained analysis/statistics, never reparse.
        expected = projection["pairSocialEvidence"]["episodeContext"]
        require(project_pair_episode_context(**args) == expected, "Context rebuild differs")
        duplicated = deepcopy(args)
        duplicated["action_events"] = list(reversed(duplicated["action_events"] * 2))
        for stats in duplicated["engagement_statistics"].values():
            for name, values in stats["engagementEvidence"].items():
                stats["engagementEvidence"][name] = list(reversed(values * 2))
        for stats in duplicated["raid_statistics"].values():
            for name, values in stats["raidEvidence"].items():
                stats["raidEvidence"][name] = list(reversed(values * 2))
        for stats in duplicated["execution_statistics"].values():
            stats["raidResponse"]["evidence"] = list(reversed(stats["raidResponse"]["evidence"] * 2))
        require(project_pair_episode_context(**duplicated) == expected, "Duplicate/reordered context differs")
        result = summarize(projection, analysis)
        result.update({"id": entry["id"], "replayPath": entry["path"],
                       "logicalGameGroup": entry.get("logicalGameGroup"),
                       "canonicalSealMode": seal_mode,
                       "canonicalSealState": read_json(canonical / "extraction-manifest.json")["state"],
                       "checks": {"statisticsAndNeutralLedgerUnchanged": True,
                                  "analysisUnchanged": True, "rebuildIdentical": True,
                                  "duplicateReorderedIdentical": True, "allContextReferencesValidated": True}})
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=ROOT / "replay-lab/fixtures/social-context-audit.json")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--seal-mode", choices=("fast", "full"), default="fast")
    args = parser.parse_args()
    manifest = read_json(args.manifest)
    require(manifest["modelVersion"] == AUDIT_VERSION, "Unsupported audit manifest")
    report = {"modelVersion": AUDIT_VERSION,
              "sourceCommit": os.environ.get("GITHUB_SHA"),
              "sealMode": args.seal_mode,
              "truthBoundary": "real-recording regression, not controlled engine-state qualification",
              "recordings": [], "pairedPerspectiveComparisons": [], "errors": []}
    for entry in manifest["recordings"]:
        print("AUDIT_START " + entry["id"], flush=True)
        try:
            result = audit_recording(entry, args.seal_mode)
            report["recordings"].append(result)
            print("AUDIT_RECORDING " + json.dumps(result, separators=(",", ":"), allow_nan=False), flush=True)
        except Exception as error:
            report["errors"].append({"id": entry["id"], "error": str(error)})
            print("AUDIT_ERROR " + json.dumps(report["errors"][-1]), flush=True)
    groups = defaultdict(list)
    for row in report["recordings"]:
        if row["logicalGameGroup"]:
            groups[row["logicalGameGroup"]].append(row)
    for group, values in sorted(groups.items()):
        keys = ("playerCount", "observedUntilMs", "incidentCounts", "deedCount",
                "pressureDirections", "contextCounts", "contextDiagnosticCounts", "responseCommandTypes")
        comparison = {"logicalGameGroup": group, "recordingIds": [row["id"] for row in values],
                      "sameBattleNotIndependentHistory": True,
                      "differences": {key: [row[key] for row in values] for key in keys
                                      if any(row[key] != values[0][key] for row in values[1:])}}
        report["pairedPerspectiveComparisons"].append(comparison)
        print("AUDIT_POV " + json.dumps(comparison, separators=(",", ":")), flush=True)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    require(not report["errors"], "Some real-recording audits failed; inspect the report")


if __name__ == "__main__":
    main()

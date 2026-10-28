#!/usr/bin/env python3
"""Original-source T90 cohort data for *private* Personality/Reputation acceptance.

No auth, league mutations, award writes, or claim qualification occurs here.
Test-scoped Battle IDs are synthetic wrappers, never authenticated league history.
"""
from __future__ import annotations
import hashlib
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
sys.path.insert(0, str(ROOT))

from parse_replay import build_payload
from analysis_dataset import build_analysis_dataset
from statistics_projector import project_statistics_from_analysis
from social_v1_context import project_social_v1_context
from social_v1_source_measurements import project_social_source_measurements
from social_v1_source_grades import admit_contextual_source_grades

ORIGINALS = (
    ("aof-test-game-1", "df9fe94378c08d58e4d60b3f161c5f2f862d72f333472aad4cfdfa119730ed80",
     "546545a3-c0dd-764d-a466-2d33226a7926", 1, 3, 140),
    ("aof-test-game-2", "f7eee7367005051dab146f0cec2734c344aa467844290323062f465c29e4b815",
     "4e7bcea6-e296-564d-a814-837eedba4a87", 1, 5, 140),
    ("aof-test-game-3", "c0c32f6e04a4b678abfc48b76f02894b900b1b9141ca7285f6c8103c1b11f5da",
     "b1e73ad5-49df-de43-a196-e36e4589d0e7", 2, 1, 9),
)
TRACKS = ("GALLANTRY", "CRUELTY", "CHIVALRY", "RIVALRY", "HOSTILITY", "BOND")


def insist(ok, why):
    if not ok:
        raise AssertionError("T90_ORIGINAL_" + why)


def generate(output: Path):
    fixture = json.loads((REPO / "functions/tests/fixtures/recording-outcomes.json").read_text())
    indexed = {r["filename"].removesuffix(".aoe2record"): r for r in fixture}
    games = []
    for index, (name, pin, guid, slot, civ, map_id) in enumerate(ORIGINALS, 1):
        original = REPO / "replay-fixtures" / (name + ".aoe2record")
        insist(original.is_file(), "MISSING_" + name)
        insist(hashlib.sha256(original.read_bytes()).hexdigest() == pin, "SHA_" + name)
        record = indexed[name]
        header = record["matchFacts"]["headerFieldCandidates"]
        insist(record["sourceHash"] == pin, "MANIFEST_" + name)
        insist(record["matchFacts"]["game"]["guid"] == guid and header["de.guid"] == guid, "GUID_" + name)
        insist(header["de.build"] == 185872 and header["de.rms_map_id"] == map_id, "BUILD_MAP_" + name)
        insist(len(record["players"]) == 2, "NOT_1V1_" + name)
        t90 = record["players"][slot-1]
        insist(t90["name"] == "T90Official" and t90["civilizationId"] == civ
               and t90["replaySlot"] == slot, "T90_IDENTITY_" + name)
        with tempfile.TemporaryDirectory(prefix="aof-t90-original-") as tmp:
            canonical = Path(tmp) / "canonical"
            build_payload(original, canonical_dir=canonical, seal_mode="fast")
            analysis = build_analysis_dataset(canonical, validate=False)
            stats = project_statistics_from_analysis(analysis)
            insist(stats["source"]["replaySha256"] == pin, "STATISTICS_HASH_" + name)
            participant = next((p for p in stats["participants"] if p["playerId"] == slot), None)
            insist(participant is not None and participant["displayName"] == "T90Official",
                   "T90_PLAYER_SLOT_" + name)
            context = project_social_v1_context(statistics=stats)
            measured = project_social_source_measurements(
                statistics=stats, context=context, action_events=analysis["actionEvents"],
                lookback_ms=120000)
            grade = admit_contextual_source_grades(
                statistics=stats, context=context, source_measurements=measured,
                action_events=analysis["actionEvents"],
                game_scope={"battleId": "TEST-T90-BATTLE-" + str(index), "gameId": "G1",
                            "gameGuid": guid, "authorityRevision": "TEST_ONLY_NOT_AOF"})
            insist(grade["officialWrites"] is False
                   and grade["publicationAllowed"] is False
                   and grade["gameScopeAuthenticated"] is False, "UNSAFE_GRADE_" + name)
            insist(not grade["claims"] and not grade["receipts"] and not grade["effects"],
                   "INVENTED_CLAIM_" + name)
            decisions = {track: {"sourceAdmitted": 0, "pending": 0, "reasons": []}
                         for track in TRACKS}
            admitted = []
            for episode in grade["episodes"]:
                if episode["actorReplayPlayerId"] != slot:
                    continue
                for lane in episode["perTrackGrades"]:
                    track = lane["track"]
                    if track not in decisions:
                        continue
                    row = decisions[track]
                    row["sourceAdmitted" if lane["decision"] == "SOURCE_ADMITTED" else "pending"] += 1
                    row["reasons"].extend(lane.get("missingEvidence") or [])
                    if lane["decision"] == "SOURCE_ADMITTED":
                        admitted.append({
                            "track": track, "ruleId": lane.get("pilotRuleId"),
                            "gradeBandId": lane.get("gradeBandId"),
                            "sourceCandidateId": episode["sourceCandidateId"],
                            "sourceIndependentContributionKey": episode["sourceIndependentContributionKey"],
                            "sourcePosition": episode["sourcePosition"],
                            "sourceEventIds": lane["sourceEventIds"],
                        })
            for result in decisions.values():
                result["reasons"] = sorted(set(result["reasons"]))
            delivery = stats.get("sharedEpisodeDelivery") or {}
            groups = delivery.get("producerGroups") or {}
            player_refs = delivery.get("playerRefs") or []
            player_ref = next((r for r in player_refs if r.get("replaySlot") == slot
                               and r.get("playerId") == slot), {})
            eng = (participant.get("military") or {}).get("engagements") or {}
            chronology = (delivery.get("version") == "AOF_DIRECT_SHARED_EPISODES_V1_EXPERIMENTAL"
                and delivery.get("sourceMode") == "producer_unique_episodes"
                and all(isinstance(groups.get(k), list) for k in ("battles", "skirmishes", "reinforcements"))
                and isinstance((player_ref.get("groups") or {}).get("battles"), list)
                and isinstance((eng.get("engagementEvidence") or {}).get("battles"), list)
                and isinstance((eng.get("raidEvidence") or {}).get("initiatedEpisodes"), list)
                and eng.get("engagementModelVersion") == "AOF_ENGAGEMENT_STATISTICS_V4")
            games.append({
                "label": name, "sourceHash": pin, "gameGuid": guid, "build": 185872,
                "mapId": map_id, "civilizationId": civ, "t90ReplaySlot": slot,
                "observedDurationMs": record["matchFacts"]["game"]["observedDurationMs"],
                "observedUntilMs": stats["scope"]["observedUntilMs"],
                "recordedAtMs": header["de.timestamp"] * 1000,
                "statistics": {k: participant.get(k) for k in
                               ("playerId", "replaySlot", "economy", "military", "mapPresence")},
                "episodeChronologyComplete": chronology,
                "sourceGrades": decisions,
                "sourceAdmittedEpisodesForTestOnly": admitted,
                "allSourceCandidateEpisodes": len(grade["episodes"]),
                "actorSourceMeasurements": sum(
                    obs.get("fromReplayPlayerId") == slot
                    for obs in measured["observations"]),
            })
            print("T90_GENUINE_SOURCE " + json.dumps({
                "original": name, "sha256": pin, "slot": slot, "map": map_id,
                "civ": civ, "actorGrades": decisions}, sort_keys=True), flush=True)
    insist(len({x["sourceHash"] for x in games}) == 3
           and len({x["gameGuid"] for x in games}) == 3, "NOT_DISTINCT_ORIGINALS")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({
        "version": "AOF_T90_GENUINE_PRIVATE_COHORT_V1",
        "testOnly": True, "authenticatedLeagueHistory": False,
        "exactSourceProofsForMapFamilyNotReviewed": True,
        "officialWrites": False, "games": games
    }, sort_keys=True))
    print("T90_GENUINE_THREE_SOURCE_PASS " + str(output), flush=True)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python replay-tools/t90_original_cohort.py REPORT.json")
    generate(Path(sys.argv[1]))

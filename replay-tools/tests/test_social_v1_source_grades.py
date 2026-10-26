"""#167 narrow pilot source methods: strict synthetic negatives + genuine recordings."""
from copy import deepcopy
from hashlib import sha256
from pathlib import Path
import json
import os
import sys
import tempfile
import unittest
from jsonschema import Draft202012Validator

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from social_v1_source_grades import (
    admit_contextual_source_grades, pilot_policy, METHODS, VERSION,
)
from social_v1_metric_grade_candidates import prepare_social_metric_grade_candidates
from social_v1_source_measurements import project_social_source_measurements
from test_social_v1_metric_grade_candidates import bundle as fixture_bundle, PINS

ROOT = Path(__file__).resolve().parents[2]
METHOD_SCHEMA = json.loads((ROOT / "contracts/social-v1/source-grade-methods-v1.schema.json").read_text())
Draft202012Validator.check_schema(METHOD_SCHEMA)
SCHEMA_VALIDATOR = Draft202012Validator(METHOD_SCHEMA)
SCOPE = {"battleId":"battle-pilot","gameId":"game-1",
         "gameGuid":"GUID-INERT","authorityRevision":"UNTRUSTED_TEST"}


def synthetic(*, locked=True, raid=True, engagement=True, people=(1,2)):
    b, stats, events = fixture_bundle("pressure", contest=engagement, people=people)
    stats["matchFacts"]["rules"]["lockTeams"]["value"] = locked
    if raid:
        actor = next(p for p in stats["participants"] if p["playerId"] == 1)
        actor["military"] = {"engagements": {
            "modelVersion": "AOF_RAID_DETECTION_V3",
            "raidEvidence": {"initiatedEpisodes": [{
                "raidId":"raid-1","startedAtMs":10000, "endedAtMs":14000,
                "attackerPlayerId":1,"victimPlayerId":2,
                "sourceEventIds":["cmd1","cmd2"],"strongCommandCount":2}]}}}
    return b,stats,events


def run(b,stats,events,*,scope=None,policy=None,producer=None):
    measurements = project_social_source_measurements(
        statistics=stats,context=b["context"],action_events=events,lookback_ms=5000)
    result = admit_contextual_source_grades(
        statistics=stats,context=b["context"],source_measurements=measurements,
        action_events=events,game_scope=scope or SCOPE,policy=policy,producer=producer)
    SCHEMA_VALIDATOR.validate(result)
    return result


def lane(result,track):
    return result["episodes"][0]["perTrackGrades"][
        list(METHODS).index(track)] if result["episodes"] else None


class PilotGradeAdmissionTests(unittest.TestCase):
    def test_two_actor_commands_raid_v3_and_engagement_create_real_bounded_rivalry_method(self):
        b,stats,events=synthetic()
        out=run(b,stats,events)
        self.assertEqual(out["version"],VERSION)
        self.assertEqual(len(out["episodes"]),1)
        g=lane(out,"RIVALRY")
        self.assertEqual(g["decision"],"SOURCE_ADMITTED")
        self.assertEqual(g["sourceCoverage"],"LIMITED")
        self.assertEqual(g["methodCoverage"],"ADMITTED")
        self.assertEqual(g["gradeBandId"],"ORDINARY")
        self.assertEqual(g["sourceEventIds"],["cmd1","cmd2"])
        self.assertEqual(g["pilotRuleId"],"E2E_PAIR_CONTEST")
        self.assertIn("RAID_V3",{c["kind"] for c in g["corroboration"]})
        self.assertIn("ENGAGEMENT_SKIRMISH",{c["kind"] for c in g["corroboration"]})
        self.assertEqual(out["sourceAdmittedCount"],1)
        self.assertTrue(all(lane(out,track)["decision"]=="PENDING"
            for track in ("BOND","CHIVALRY","GALLANTRY","CRUELTY","HOSTILITY")))
        self.assertFalse(out["gameScopeAuthenticated"])
        self.assertFalse(out["officialWrites"])
        self.assertFalse(out["publicationAllowed"])
        self.assertEqual(out["claims"],[])
        self.assertEqual(out["effects"],[])
        self.assertEqual(out["actorWitnesses"],[])
        self.assertEqual(out["receipts"],[])
        self.assertTrue(out["noAutomaticHistoricalImport"])

    def test_adjacent_raid_count_without_opponent_engagement_is_pending(self):
        b,stats,events=synthetic(engagement=False)
        out=run(b,stats,events)
        self.assertEqual(lane(out,"RIVALRY")["decision"],"PENDING")
        self.assertIn("INDEPENDENT_ACTOR_ENGAGEMENT_CONTEXT_MISSING",
                      lane(out,"RIVALRY")["missingEvidence"])
        self.assertEqual(out["sourceAdmittedCount"],0)

    def test_adjacent_engagement_without_economic_target_raid_is_pending(self):
        b,stats,events=synthetic(raid=False)
        out=run(b,stats,events)
        self.assertEqual(lane(out,"RIVALRY")["decision"],"PENDING")
        self.assertIn("OPPONENT_RAID_V3_WITH_TWO_OWN_EVENTS_MISSING",
                      lane(out,"RIVALRY")["missingEvidence"])
        self.assertEqual(out["sourceAdmittedCount"],0)

    def test_wrong_opponent_and_reversed_direction_cannot_borrow_another_raid(self):
        b,stats,events=synthetic(people=(1,2,3))
        stats["participants"][0]["military"]["engagements"]["raidEvidence"][
            "initiatedEpisodes"][0]["victimPlayerId"]=3
        out=run(b,stats,events)
        self.assertEqual(out["sourceAdmittedCount"],0)
        self.assertIn("OPPONENT_RAID_V3_WITH_TWO_OWN_EVENTS_MISSING",
                      lane(out,"RIVALRY")["missingEvidence"])
        self.assertTrue(all(p["actorReplayPlayerId"]==1 for p in out["episodes"]))
        self.assertNotIn(2,[p["actorReplayPlayerId"] for p in out["episodes"]])

    def test_unlocked_diplomacy_and_same_team_prevent_automatic_rivalry(self):
        b,stats,events=synthetic(locked=False)
        out=run(b,stats,events)
        self.assertEqual(out["sourceAdmittedCount"],0)
        self.assertIn("PAIR_OPPOSITION_NOT_FIXED_OR_EFFECTIVE_DIPLOMACY_UNPROVEN",
                      lane(out,"RIVALRY")["missingEvidence"])
        b,stats,events=synthetic()
        stats["matchFacts"]["players"][1]["lobbyTeamIdRaw"]=1
        out=run(b,stats,events)
        self.assertEqual(out["sourceAdmittedCount"],0)

    def test_noop_missing_original_ordinal_and_tightening_threshold_fall_pending(self):
        b,stats,events=synthetic()
        events.append({"eventId":"STOP-1","actorPlayerId":1,
            "timestampMs":11100,"operationOrdinal":15,"sourceActionName":"STOP"})
        self.assertEqual(run(b,stats,events)["sourceAdmittedCount"],0)
        b,stats,events=synthetic()
        events[0]["operationOrdinal"]=None
        self.assertEqual(run(b,stats,events)["sourceAdmittedCount"],0)
        b,stats,events=synthetic()
        self.assertEqual(run(b,stats,events,policy=pilot_policy(min_original_commands=3))[
            "sourceAdmittedCount"],0)
        with self.assertRaisesRegex(ValueError,"PILOT_MINIMUM_MUST_KEEP_TWO_OWN_EVENTS"):
            pilot_policy(min_original_commands=1)

    def test_duplicate_povs_and_game_scope_corrections_recompute_identities(self):
        b,stats,events=synthetic()
        first=run(b,stats,events)
        self.assertEqual(first,run(deepcopy(b),deepcopy(stats),list(reversed(events*2))))
        second=run(b,stats,events,scope={**SCOPE,"gameId":"game-2"})
        self.assertNotEqual(first["projectionRevision"],second["projectionRevision"])
        self.assertNotEqual(first["episodes"][0]["sourceIndependentContributionKey"],
                            second["episodes"][0]["sourceIndependentContributionKey"])
        stats["source"]["replaySha256"]="c"*64
        b["context"]["sourceRevision"]["replaySha256"]="c"*64
        stats["pairSocialEvidence"]["gameScope"]["replaySha256"]="c"*64
        replaced=run(b,stats,events)
        self.assertNotEqual(first["projectionRevision"],replaced["projectionRevision"])
        self.assertFalse(replaced["officialWrites"])

    def test_producer_spoof_and_source_actor_spoof_are_rejected(self):
        b,stats,events=synthetic()
        m=project_social_source_measurements(statistics=stats,context=b["context"],
                                            action_events=events,lookback_ms=5000)
        prod=prepare_social_metric_grade_candidates(
            statistics=stats,context=b["context"],source_measurements=m,
            action_events=events,game_scope=SCOPE)
        prod["candidateEpisodeGroups"][0]["actorReplayPlayerId"]=2
        with self.assertRaisesRegex(ValueError,"SUPPLIED_PRODUCER_NOT_REPRODUCIBLE"):
            admit_contextual_source_grades(statistics=stats,context=b["context"],
                 source_measurements=m,action_events=events,game_scope=SCOPE,producer=prod)
        events[0]["actorPlayerId"]=2
        # #149 legitimately drops an unowned facet rather than raising. The
        # new admission layer must remain empty, never reattribute it to p2.
        withheld=run(b,stats,events)
        self.assertEqual(withheld["sourceAdmittedCount"],0)
        self.assertFalse(any(g["actorReplayPlayerId"]==2
                             for g in withheld["episodes"]))
        self.assertFalse(withheld["officialWrites"])

    def test_assistance_requires_independent_third_party_prior_threat(self):
        # Genuine helper->recipient facet, but one unthreatened generic help
        # request must never become Bond or Chivalry automatically.
        b,stats,events=fixture_bundle("help",people=(1,2,3))
        out=run(b,stats,events)
        self.assertEqual(lane(out,"BOND")["decision"],"PENDING")
        self.assertIn("INDEPENDENT_PREENTRY_THIRD_PARTY_RECIPIENT_THREAT_MISSING",
                      lane(out,"BOND")["missingEvidence"])
        self.assertEqual(lane(out,"CHIVALRY")["decision"],"PENDING")
        self.assertEqual(out["sourceAdmittedCount"],0)

    def test_exact_threat_linked_recipient_assistance_admits_bond_and_chivalry(self):
        b, stats, events = fixture_bundle("help", people=(1,2,3))
        # Synthetic *proof-shaped* test only. Real corpus decides whether the
        # actual recorded source independently supplies these witnesses.
        for row in stats["matchFacts"]["players"]:
            row["lobbyTeamIdRaw"] = 1 if row["playerId"] in (1,2) else 2
        deed = stats["pairSocialEvidence"]["deeds"][0]
        deed["sourceEventIds"] += ["help2","help3"]
        deed["facets"][0]["sourceEventIds"] += ["help2","help3"]
        b["context"]["deedContexts"][0]["sourceEventIds"] += ["help2","help3"]
        for c in b["context"]["engagementContexts"]:
            if c["kind"] == "DEFENSIVE_ASSIST":
                c["sourceEventIds"] += ["help2","help3"]
        events.extend([
            {"eventId":"help2","actorPlayerId":1,"timestampMs":11500,
             "operationOrdinal":40,"sourceActionName":"ORDER"},
            {"eventId":"help3","actorPlayerId":1,"timestampMs":11600,
             "operationOrdinal":41,"sourceActionName":"ORDER"},
            {"eventId":"enemy-threat1","actorPlayerId":3,"timestampMs":7000,
             "operationOrdinal":4,"sourceActionName":"ORDER"},
            {"eventId":"enemy-threat2","actorPlayerId":3,"timestampMs":8000,
             "operationOrdinal":5,"sourceActionName":"ORDER"},
        ])
        aggressor=next(p for p in stats["participants"] if p["playerId"]==3)
        aggressor["military"]={"engagements":{
            "modelVersion":"AOF_RAID_DETECTION_V3",
            "raidEvidence":{"initiatedEpisodes":[{
                "raidId":"prior-third-party-raid","startedAtMs":7000,
                "endedAtMs":8000,"attackerPlayerId":3,"victimPlayerId":2,
                "sourceEventIds":["enemy-threat1","enemy-threat2"],
                "strongCommandCount":2}]}}}
        admitted=run(b,stats,events)
        self.assertEqual(lane(admitted,"BOND")["decision"],"SOURCE_ADMITTED")
        self.assertEqual(lane(admitted,"CHIVALRY")["decision"],"SOURCE_ADMITTED")
        self.assertEqual(admitted["sourceAdmittedCount"],2)
        self.assertEqual(admitted["episodes"][0]["sourceEventIds"],
                         ["cmd1","help2","help3"])
        self.assertEqual(admitted["episodes"][0]["sourceIndependentContributionKey"],
                         admitted["episodes"][0]["perTrackGrades"][1]
                         ["independentContributionKey"])
        self.assertEqual(admitted["claims"],[])
        neg=deepcopy(stats)
        neg_attacker=next(p for p in neg["participants"] if p["playerId"]==3)
        neg_attacker["military"]["engagements"]["raidEvidence"]["initiatedEpisodes"][
            0]["victimPlayerId"]=1  # wrong threatened beneficiary
        refused=run(b,neg,events)
        self.assertEqual(lane(refused,"BOND")["decision"],"PENDING")
        self.assertEqual(lane(refused,"CHIVALRY")["decision"],"PENDING")
        self.assertEqual(refused["sourceAdmittedCount"],0)
        self.assertFalse(refused["officialWrites"])

    def test_closed_pilot_schema_rejects_forged_receipt_or_final_weight(self):
        b,stats,events=synthetic()
        out=run(b,stats,events)
        for modify in ("receipt","approved","too_low","fake_claim","band"):
            altered=deepcopy(out)
            if modify=="receipt":
                altered["receipts"]=[{"id":"synthetic"}]
            elif modify=="approved":
                altered["policy"]["status"]="APPROVED"
            elif modify=="too_low":
                altered["policy"]["minOriginalCommands"]=1
            elif modify=="fake_claim":
                altered["episodes"][0]["canonicalClaim"]={"effect":"STRENGTHEN"}
            elif modify=="band":
                altered["episodes"][0]["perTrackGrades"][0]["gradeBandId"]="SUBSTANTIAL"
            self.assertTrue(list(SCHEMA_VALIDATOR.iter_errors(altered)),modify)

    def test_standalone_weakening_victim_disadvantage_and_selective_hostility_are_pending(self):
        b,stats,events=synthetic()
        out=run(b,stats,events)
        self.assertIn("INDEPENDENT_PREENTRY_VICTIM_DISADVANTAGE_NOT_AVAILABLE",
                      lane(out,"CRUELTY")["missingEvidence"])
        self.assertIn("EFFECTIVE_RUPTURE_OR_SELECTIVE_CROSS_GAME_ANTAGONISM_UNAVAILABLE",
                      lane(out,"HOSTILITY")["missingEvidence"])
        self.assertEqual([g["track"] for g in out["episodes"][0]["perTrackGrades"]],
                         ["RIVALRY","BOND","CHIVALRY","GALLANTRY","CRUELTY","HOSTILITY"])


class AuthenticSourceAdmissionTests(unittest.TestCase):
    @unittest.skipUnless(os.environ.get("AOF_SOC_V1E_AUTHENTIC")=="1",
                         "opt-in, hash-pinned original recording corpus")
    def test_genuine_four_formats_one_real_positive_and_matched_negative(self):
        from parse_replay import build_payload
        from analysis_dataset import build_analysis_dataset
        from statistics_projector import project_statistics_from_analysis
        from social_v1_context import project_social_v1_context
        verified=[]
        counts={}
        for fmt,(name,pinned) in PINS.items():
            with self.subTest(fmt=fmt):
                recording=ROOT/name
                self.assertTrue(recording.is_file())
                self.assertEqual(sha256(recording.read_bytes()).hexdigest(),pinned)
                with tempfile.TemporaryDirectory(prefix="aof-v1e-"+fmt) as temp:
                    canonical=Path(temp)/"canonical"
                    build_payload(recording,canonical_dir=canonical,seal_mode="fast")
                    analysis=build_analysis_dataset(canonical,validate=False)
                    stats=project_statistics_from_analysis(analysis)
                    ctx=project_social_v1_context(statistics=stats)
                    original=analysis["actionEvents"]
                    metrics=project_social_source_measurements(
                        statistics=stats,context=ctx,action_events=original,lookback_ms=120000)
                    scope={**SCOPE,"gameGuid":"UNVERIFIED-"+fmt,
                           "gameId":"game-"+fmt}
                    out=admit_contextual_source_grades(
                        statistics=stats,context=ctx,source_measurements=metrics,
                        action_events=original,game_scope=scope)
                    SCHEMA_VALIDATOR.validate(out)
                    positives=[(group,g) for group in out["episodes"]
                        for g in group["perTrackGrades"] if g["decision"]=="SOURCE_ADMITTED"]
                    counts[fmt]=(len(out["episodes"]),len(positives))
                    by_track={k:sum(1 for _,grade in positives if grade["track"]==k)
                              for k in METHODS}
                    print("AUTHENTIC_SOC_V1E_TRACK_MATRIX "+json.dumps({
                        "recording":fmt,"episodes":len(out["episodes"]),
                        "sourceAdmittedByTrack":by_track,
                        "allMethodsRetainLIMITEDOriginals":True,
                        "officialWrites":False},sort_keys=True),flush=True)
                    for group,admitted in positives:
                        self.assertEqual(admitted["sourceCoverage"],"LIMITED")
                        self.assertEqual(admitted["methodCoverage"],"ADMITTED")
                        self.assertEqual(admitted["gradeBandId"],"ORDINARY")
                        self.assertGreaterEqual(len(admitted["sourceEventIds"]),2)
                        self.assertEqual(group["sourcePosition"]["order"],"ORDERED")
                        self.assertFalse(out["officialWrites"])
                        self.assertEqual(out["claims"],[])
                    if positives:
                        group, grade=next((row for row in positives if row[1]["track"]=="RIVALRY"),
                                           positives[0])
                        print("AUTHENTIC_SOC_V1E_POSITIVE "+json.dumps({
                            "recording":fmt,"sha256":pinned,
                            "track":grade["track"],"method":grade["methodVersion"],
                            "actor":group["actorReplayPlayerId"],
                            "counterpart":group["counterpartReplayPlayerId"],
                            "sourceEventIds":grade["sourceEventIds"][:12],
                            "firstSourceMoment":group["sourcePosition"],
                            "independentContext":grade["corroboration"][:3],
                            "groupKey":group["sourceIndependentContributionKey"],
                            "policy":out["policy"]["version"],
                            "officialWrites":False},sort_keys=True),flush=True)
                        verified.append((fmt,group,grade))
                    # Closest negative: same exact original recording+event refs,
                    # remove the independent opponent Raid V3 method context.
                    # A request count and skirmish are insufficient alone.
                    negative=deepcopy(stats)
                    for player in negative["participants"]:
                        military=(player.get("military") or {}).get("engagements") or {}
                        if "raidEvidence" in military:
                            military["raidEvidence"]["initiatedEpisodes"]=[]
                    # Recompute Context/measurement from the modified source
                    # projection, keeping original immutable event identities.
                    no_raid=admit_contextual_source_grades(
                        statistics=negative,context=ctx,source_measurements=metrics,
                        action_events=original,game_scope=scope)
                    SCHEMA_VALIDATOR.validate(no_raid)
                    self.assertFalse(any(x["decision"]=="SOURCE_ADMITTED"
                        and x["track"]=="RIVALRY"
                        for g in no_raid["episodes"] for x in g["perTrackGrades"]))
                    # It really is the nearest control: same original source
                    # episode ID and source event membership, without raid
                    # corroboration. No substitution of a different Game.
                    negative_by_id={g["sourceCandidateId"]:g for g in no_raid["episodes"]}
                    for original_group, positive in positives:
                        if positive["track"] != "RIVALRY":
                            continue
                        matched=negative_by_id[original_group["sourceCandidateId"]]
                        self.assertEqual(matched["sourceEventIds"],
                                         original_group["sourceEventIds"])
                        negative_lane=next(x for x in matched["perTrackGrades"]
                                           if x["track"]=="RIVALRY")
                        self.assertEqual(negative_lane["decision"],"PENDING")
                        self.assertIn("OPPONENT_RAID_V3_WITH_TWO_OWN_EVENTS_MISSING",
                                      negative_lane["missingEvidence"])
                    print("AUTHENTIC_SOC_V1E_NEAREST_NEGATIVE "+json.dumps({
                        "recording":fmt,"originalGroups":len(out["episodes"]),
                        "sameSourceGroups":len(no_raid["episodes"]),
                        "rivalrySourceAdmittedAfterWithholdingRaid":0,
                        "sourceEventsPreserved":True,"publicationAllowed":False,
                    },sort_keys=True),flush=True)
                    self.assertFalse(no_raid["officialWrites"])
        print("AUTHENTIC_SOC_V1E_COUNTS "+json.dumps(counts,sort_keys=True),flush=True)
        self.assertTrue(any(g["track"]=="RIVALRY" for _,_,g in verified),
                        "NO_GENUINE_SOURCE_VERIFIED_PAIR_CONTEST_POSITIVE")


if __name__=="__main__":
    unittest.main()

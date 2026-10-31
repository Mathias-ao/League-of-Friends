"""#182: one bounded method, all tests distinguish synthetic and genuine source."""
from copy import deepcopy
from hashlib import sha256
from pathlib import Path
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from social_v1g_active_counterplay import (
    prepare_active_defender_counterplay, VERSION, METHOD,
)
from social_v1_source_measurements import project_social_source_measurements
from test_social_v1_source_grades import synthetic, SCOPE
from test_social_v1_metric_grade_candidates import PINS, ROOT


def source_case():
    """CONTROLLED proof-shaped synthetic pair only; not a played recording."""
    b, stats, actions = synthetic()
    # Controlled source-shape must carry the genuine Raid V3 model identity;
    # unlike the old #173 fixture, this new method refuses unversioned raids.
    stats["participants"][0]["military"]["engagements"]["raidEvidence"][
        "initiatedEpisodes"][0]["modelVersion"] = "AOF_RAID_DETECTION_V3"
    source = deepcopy(stats["pairSocialEvidence"]["deeds"][0])
    source.update(deedId="B-owned-counterplay", incidentIds=["B-owned-independent"],
                  sourceEventIds=["counter1", "counter2"],
                  startedAt={"atMs":15000,"operationOrdinal":50},
                  endedAt={"atMs":15200,"operationOrdinal":51},
                  facets=[{"kind":"TARGETED_COMMAND", "fromPlayerId":2,
                           "toPlayerId":1, "sourceEventIds":["counter1","counter2"],
                           "targetEvidence":[
                               {"sourceEventId":"counter1","targetInstanceId":77,
                                "controllerEvidence":{"controllerPlayerId":1,
                                                      "sourceEventId":"initial-object-A"}},
                               {"sourceEventId":"counter2","targetInstanceId":77,
                                "controllerEvidence":{"controllerPlayerId":1,
                                                      "sourceEventId":"initial-object-A"}}]}])
    stats["pairSocialEvidence"]["deeds"].append(source)
    neutral = deepcopy(b["context"]["deedContexts"][0])
    neutral.update(sourceDeedId="B-owned-counterplay",
                   sourceIncidentIds=["B-owned-independent"],
                   pairReplayPlayerIds=[1,2],
                   directionalActors=[{"fromReplayPlayerId":2,"toReplayPlayerId":1}],
                   facetKinds=["TARGETED_COMMAND"],sourceEventIds=["counter1","counter2"],
                   firstAtMs=15000,lastAtMs=15200)
    b["context"]["deedContexts"].append(neutral)
    actions += [
        {"eventId":"counter1","actorPlayerId":2,"timestampMs":15000,
         "operationOrdinal":50,"sourceActionName":"ORDER","targetInstanceId":77},
        {"eventId":"counter2","actorPlayerId":2,"timestampMs":15200,
         "operationOrdinal":51,"sourceActionName":"ORDER","targetInstanceId":77},
    ]
    for det in b["context"]["engagementContexts"]:
        if det["kind"] in ("SKIRMISH", "TECHNICAL_BATTLE"):
            det["sourceEventIds"] = sorted(set(det["sourceEventIds"]+["counter1","counter2"]))
            det["contributorReplayPlayerIds"] = sorted(set(
                (det.get("contributorReplayPlayerIds") or [])+[2]))
    return b,stats,actions


def method(b,stats,actions,*,scope=None):
    measurements = project_social_source_measurements(
        statistics=stats, context=b["context"], action_events=actions, lookback_ms=120000)
    return prepare_active_defender_counterplay(
        statistics=stats, context=b["context"],
        source_measurements=measurements, action_events=actions,
        game_scope=scope or SCOPE)


def counter(out):
    return next(x for x in out["episodes"]
                if x["actorReplayPlayerId"]==2 and x["counterpartReplayPlayerId"]==1)


class ControlledProofShapeTests(unittest.TestCase):
    def test_defender_has_own_original_target_and_prior_attacker_source(self):
        b,stats,actions=source_case()
        out=method(b,stats,actions)
        got=counter(out)
        self.assertEqual(out["version"],VERSION)
        self.assertEqual(got["methodVersion"],METHOD)
        self.assertEqual(got["decision"],"SOURCE_MATCH_PROPOSED")
        self.assertEqual(got["sourceEventIds"],["counter1","counter2"])
        self.assertEqual(got["actorReplayPlayerId"],2)
        self.assertEqual(got["counterpartReplayPlayerId"],1)
        self.assertTrue(any(x["kind"]=="PREENTRY_ATTACKER_RAID_V3"
                            for x in got["corroboration"]))
        self.assertTrue(any(x["kind"]=="ENGAGEMENT_SKIRMISH"
                            for x in got["corroboration"]))
        self.assertEqual(got["sourceCoverage"],"LIMITED")
        self.assertIsNone(got["gradeBandId"])
        self.assertEqual(out["sourceCandidateCount"],1)
        self.assertEqual(out["sourceAdmittedCount"],0)
        self.assertIsNone(got["canonicalContributionKey"])
        self.assertFalse(out["officialWrites"])
        self.assertFalse(out["publicationAllowed"])
        self.assertEqual(out["claims"],[])
        self.assertEqual(out["actorWitnesses"],[])
        self.assertEqual(out["receipts"],[])
        self.assertFalse(out["gameScopeAuthenticated"])

    def test_nearest_control_unchanged_defender_commands_but_no_independent_threat(self):
        b,stats,actions=source_case()
        baseline=method(b,stats,actions)
        no_threat=deepcopy(stats)
        p=next(p for p in no_threat["participants"] if p["playerId"]==1)
        p["military"]["engagements"]["raidEvidence"]["initiatedEpisodes"]=[]
        refused=method(b,no_threat,actions)
        self.assertEqual(counter(refused)["decision"],"PENDING")
        self.assertIn("TWO_OWN_PRIOR_OPPONENT_RAID_COMMANDS_MISSING",
                      counter(refused)["missingEvidence"])
        self.assertEqual(counter(baseline)["sourceEventIds"],
                         counter(refused)["sourceEventIds"])

    def test_wrong_target_controller_passive_and_partial_ordinal(self):
        b,stats,actions=source_case()
        wrong=deepcopy(stats)
        face=wrong["pairSocialEvidence"]["deeds"][-1]["facets"][0]
        face["targetEvidence"][0]["controllerEvidence"]["controllerPlayerId"]=2
        face["targetEvidence"][1]["controllerEvidence"]["controllerPlayerId"]=2
        self.assertIn("TWO_CONTROLLER_BOUND_DEFENDER_OWN_TARGET_ORDERS_MISSING",
                      counter(method(b,wrong,actions))["missingEvidence"])
        half=deepcopy(actions)
        half[-1]["operationOrdinal"]=None
        self.assertEqual(counter(method(b,stats,half))["decision"],"PENDING")
        self.assertEqual(counter(method(b,stats,half))["sourceCoverage"],"LIMITED")

    def test_passive_move_and_garrison_only_cannot_mint_reverse_action(self):
        b,stats,actions=source_case()
        passive=deepcopy(actions)
        for e in passive:
            if e["eventId"] in ("counter1","counter2"):
                e["sourceActionName"]="MOVE"
        pending=counter(method(b,stats,passive))
        self.assertEqual(pending["decision"],"PENDING")
        self.assertIn("TWO_CONTROLLER_BOUND_DEFENDER_OWN_TARGET_ORDERS_MISSING",
                      pending["missingEvidence"])

    def test_correlated_new_components_share_only_one_source_method(self):
        b,stats,actions=source_case()
        d=deepcopy(stats["pairSocialEvidence"]["deeds"][-1])
        d.update(deedId="counter-again",incidentIds=["counter-again-independent"],
                 sourceEventIds=["counter3","counter4"],
                 startedAt={"atMs":15500,"operationOrdinal":55},
                 endedAt={"atMs":15700,"operationOrdinal":56})
        for f in d["facets"]:
            f["sourceEventIds"]=["counter3","counter4"]
            for i,detail in enumerate(f["targetEvidence"],start=3):
                detail["sourceEventId"]="counter"+str(i)
        stats["pairSocialEvidence"]["deeds"].append(d)
        nc=deepcopy(b["context"]["deedContexts"][-1])
        nc.update(sourceDeedId="counter-again",
                  sourceIncidentIds=["counter-again-independent"],
                  sourceEventIds=["counter3","counter4"],
                  firstAtMs=15500,lastAtMs=15700)
        b["context"]["deedContexts"].append(nc)
        actions.extend([
            {"eventId":"counter3","actorPlayerId":2,"timestampMs":15500,
             "operationOrdinal":55,"sourceActionName":"ORDER","targetInstanceId":77},
            {"eventId":"counter4","actorPlayerId":2,"timestampMs":15700,
             "operationOrdinal":56,"sourceActionName":"ORDER","targetInstanceId":77},
        ])
        for det in b["context"]["engagementContexts"]:
            if det["kind"] in ("SKIRMISH","TECHNICAL_BATTLE"):
                det["sourceEventIds"]+=["counter3","counter4"]
        out=method(b,stats,actions)
        directed=[x for x in out["episodes"] if x["actorReplayPlayerId"]==2]
        self.assertEqual(len(directed),2)
        self.assertEqual(sum(x["decision"]=="SOURCE_MATCH_PROPOSED" for x in directed),1)
        self.assertTrue(any("CORRELATED_SOURCE_DETECTOR_ALREADY_ADMITTED"
                            in x["missingEvidence"] for x in directed))
        self.assertEqual(out["claims"],[])
        self.assertFalse(out["officialWrites"])

    def test_no_new_credit_from_duplicate_pov_or_stale_source(self):
        b,stats,actions=source_case()
        before=method(b,stats,actions)
        self.assertEqual(before,method(deepcopy(b),deepcopy(stats),
                                       list(reversed(actions+deepcopy(actions)))))
        corrected=deepcopy(b)
        corrected["context"]["sourceRevision"]["replaySha256"]="f"*64
        with self.assertRaisesRegex(ValueError,"STALE_OR_INCONSISTENT_SOURCE_REVISION"):
            method(corrected,stats,actions)

    def test_untrusted_scope_relabel_is_not_a_new_original_contribution(self):
        b,stats,actions=source_case()
        before=method(b,stats,actions)
        # #158's source key binds the canonical Battle/Game and source deed.
        # GUID and authority labels are separately authenticated by Sol's
        # consumer, never a reason to mint another original contribution.
        for field in ("gameGuid","authorityRevision"):
            next_scope={**SCOPE,field:"another-untrusted-label"}
            now=method(b,stats,actions,scope=next_scope)
            self.assertEqual(counter(before)["sourceIndependentContributionKey"],
                             counter(now)["sourceIndependentContributionKey"])
            self.assertEqual(now["gameScope"],next_scope)
            self.assertNotEqual(before["sourceProjectionRevision"],
                                now["sourceProjectionRevision"])
            self.assertFalse(now["gameScopeAuthenticated"])
            self.assertEqual(now["sourceAdmittedCount"],0)
            self.assertEqual(now["claims"],[])
            self.assertEqual(now["receipts"],[])
            self.assertFalse(now["officialWrites"])

    def test_distinct_canonical_game_or_battle_has_a_distinct_source_key(self):
        b,stats,actions=source_case()
        before=method(b,stats,actions)
        for field in ("gameId","battleId"):
            now=method(b,stats,actions,scope={**SCOPE,field:"another-canonical-id"})
            self.assertNotEqual(counter(before)["sourceIndependentContributionKey"],
                                counter(now)["sourceIndependentContributionKey"])
            self.assertFalse(now["gameScopeAuthenticated"])
            self.assertEqual(now["sourceAdmittedCount"],0)

    def test_no_ffa_or_friendly_credit(self):
        b,stats,actions=source_case()
        ffa=deepcopy(stats)
        ffa["matchFacts"]["rules"]["lockTeams"]["value"]=False
        self.assertEqual(counter(method(b,ffa,actions))["decision"],"PENDING")
        friend=deepcopy(stats)
        for row in friend["matchFacts"]["players"]:
            row["lobbyTeamIdRaw"]=1
        self.assertEqual(counter(method(b,friend,actions))["decision"],"PENDING")


class GenuineOriginalTests(unittest.TestCase):
    @unittest.skipUnless(os.environ.get("AOF_SOC_V1G_AUTHENTIC")=="1",
                         "hash-pinned genuine original corpus is CI opt-in")
    def test_genuine_new_defender_positive_and_adjacent_negatives(self):
        from parse_replay import build_payload
        from analysis_dataset import build_analysis_dataset
        from statistics_projector import project_statistics_from_analysis
        from social_v1_context import project_social_v1_context
        totals={}
        genuine=[]
        natural_negatives=[]
        for fmt,(filename,pin) in PINS.items():
            with self.subTest(fmt=fmt):
                path=ROOT/filename
                self.assertEqual(sha256(path.read_bytes()).hexdigest(),pin)
                with tempfile.TemporaryDirectory(prefix="aof-counterproof-") as tmp:
                    canonical=Path(tmp)/"canonical"
                    build_payload(path,canonical_dir=canonical,seal_mode="fast")
                    analysis=build_analysis_dataset(canonical,validate=False)
                    stats=project_statistics_from_analysis(analysis)
                    ctx=project_social_v1_context(statistics=stats)
                    original=analysis["actionEvents"]
                    scope={**SCOPE,"battleId":"UNTRUSTED-"+fmt,
                           "gameId":"UNTRUSTED-"+fmt,"gameGuid":"UNTRUSTED-"+fmt}
                    metric=project_social_source_measurements(
                        statistics=stats,context=ctx,action_events=original,
                        lookback_ms=120000)
                    out=prepare_active_defender_counterplay(
                        statistics=stats,context=ctx,source_measurements=metric,
                        action_events=original,game_scope=scope)
                    admitted=[r for r in out["episodes"]
                              if r["decision"]=="SOURCE_MATCH_PROPOSED"]
                    pending=[r for r in out["episodes"]
                              if r["decision"]=="PENDING"]
                    totals[fmt]={"admitted":len(admitted),"pending":len(pending)}
                    for r in admitted[:4]:
                        self.assertGreaterEqual(len(r["sourceEventIds"]),2)
                        self.assertNotEqual(r["actorReplayPlayerId"],r["counterpartReplayPlayerId"])
                        self.assertTrue(all(x["sourceEventIds"] for x in r["corroboration"]))
                        assert r["canonicalClaim"] is None and not out["officialWrites"]
                        genuine.append((fmt,r))
                        print("GENUINE_DEFENDER_SOURCE_POSITIVE "+json.dumps({
                            "format":fmt,"sha256":pin,
                            "actor":r["actorReplayPlayerId"],"attacker":r["counterpartReplayPlayerId"],
                            "eventIds":r["sourceEventIds"],
                            "position":r["sourcePosition"],
                            "detectors":r["corroboration"],
                            "contributionKey":r["sourceIndependentContributionKey"],
                            "requestedNotExecuted":True},sort_keys=True),flush=True)
                    for r in pending:
                        if ("TWO_OWN_PRIOR_OPPONENT_RAID_COMMANDS_MISSING" in r["missingEvidence"]
                                and len(r["sourceEventIds"]) >= 2):
                            natural_negatives.append((fmt,r))
                            print("GENUINE_NATURAL_UNQUALIFIED_SOURCE "+json.dumps({
                                "format":fmt,"sha256":pin,
                                "actor":r["actorReplayPlayerId"],
                                "other":r["counterpartReplayPlayerId"],
                                "sourceEventIds":r["sourceEventIds"][:8],
                                "missing":r["missingEvidence"],
                                "notAPlayedMatchedCounterfactual":True
                            },sort_keys=True),flush=True)
                            break
                    # Source-preserving method control: erase ONLY inferred
                    # earlier source Raid V3 from derived stats, keep action
                    # stream and defender targeting unchanged.
                    no_raid=deepcopy(stats)
                    for p in no_raid["participants"]:
                        military=(p.get("military") or {}).get("engagements") or {}
                        if "raidEvidence" in military:
                            military["raidEvidence"]["initiatedEpisodes"]=[]
                    refused=prepare_active_defender_counterplay(
                        statistics=no_raid,context=ctx,source_measurements=metric,
                        action_events=original,game_scope=scope)
                    self.assertEqual(refused["sourceCandidateCount"],0)
                    self.assertEqual(refused["sourceAdmittedCount"],0)
                    same={r["sourceCandidateId"]:r for r in refused["episodes"]}
                    for r in admitted:
                        near=same[r["sourceCandidateId"]]
                        self.assertEqual(near["sourceEventIds"],r["sourceEventIds"])
                        self.assertIn("TWO_OWN_PRIOR_OPPONENT_RAID_COMMANDS_MISSING",
                                      near["missingEvidence"])
        print("GENUINE_DEFENDER_COUNTS "+json.dumps(totals,sort_keys=True),flush=True)
        print("GENUINE_NATURAL_PENDING_COUNT "+str(len(natural_negatives)),flush=True)
        # Fail CI rather than claiming a new method on synthetic fixtures.
        self.assertTrue(genuine,"NO_GENUINE_ORIGINAL_DEFENDER_PROPOSED_MATCH; KEEP_METHOD_DRAFT_AND_PENDING")
        # A genuine naturally unqualified case is reported if present,
        # not falsely advertised as a matched same-opportunity negative.
        # The source-preserving detector ablation above is a controlled
        # nearest-method negative, never a second played recording.

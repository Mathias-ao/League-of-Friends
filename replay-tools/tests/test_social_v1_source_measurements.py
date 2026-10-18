"""#126 source-measurement tests: strict neutral behaviour and hash-pinned originals.

Genuine original recordings prove source commands and detector provenance only.
No fixture is labeled as a genuinely confirmed social deed or scoring result.
"""
from copy import deepcopy
from hashlib import sha256
from pathlib import Path
import os
import json
import shutil
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from social_v1_source_measurements import project_social_source_measurements as project
from test_social_v1_inference import case, decisions, config, snapshot
from social_v1_inference import qualify_social_v1
from social_v1_contract import validate_record

ROOT = Path(__file__).resolve().parents[2]
# Genuine repository recordings; original hashes verified independently.
PINS = {
    "duel": ("replay-fixtures/1v1_1.aoe2record",
             "f00fdda9c14584c3b7f132fe48bf0543d2a0aa7108d9c781e4e4cf72ad70d181", 2),
    "team": ("replay-fixtures/4v4.aoe2record",
             "e415855f5223562820f5a34daf1298455ba5cbd940a4b502f03d2d8a2436a123", 8),
    "ffa": ("replay-fixtures/FFA_diplo.aoe2record",
            "ab947d934bbd4fa4e2531f4f8a5014f9b923038a34aa7332d7260eb78fb3fab5", 8),
}


def synthetic_bundle(kind="pressure", **kwargs):
    b = case(kind=kind, **kwargs)
    r = b["context"]["sourceRevision"]
    rows = []
    for e in b["pair_observations"]:
        rows.append({
            "eventId": e["sourceEventId"], "actorPlayerId": e["actorPlayerId"],
            "timestampMs": e["moment"]["atMs"],
            "operationOrdinal": e["moment"]["operationOrdinal"],
            "sourceActionName": e.get("commandType")})
    pair = {"modelVersion": "AOF_PAIR_SOCIAL_EVIDENCE_V1",
            "gameScope": r, "deeds": b["pair_deeds"]}
    statistics = {"source": r, "participants": [
        {"playerId": p} for p in b["replay_bindings"]["players"]],
        "pairSocialEvidence": pair}
    return b, statistics, rows


def measure(b, statistics, rows):
    return project(statistics=statistics, context=b["context"],
                   action_events=rows, lookback_ms=5000)


class InertMeasurementTests(unittest.TestCase):
    def test_synthetic_own_actor_and_bounded_prior_records(self):
        b, stats, actions = synthetic_bundle(kind="contest", contest=True)
        rows = measure(b, stats, actions)
        self.assertTrue(rows["observations"])
        self.assertFalse(rows["publicationAllowed"])
        self.assertFalse(rows["qualifiesAnySocialFact"])
        self.assertTrue(all(o["coverage"] == "LIMITED" for o in rows["observations"]))
        self.assertTrue(all(not o["qualifiesSocialFact"] for o in rows["observations"]))
        target = next(r for r in rows["observations"] if r["kind"] == "DIRECTED_TARGET_COMMAND")
        self.assertEqual(target["fromReplayPlayerId"], 1)
        self.assertEqual(target["toReplayPlayerId"], 2)
        self.assertEqual(target["firstSourceMoment"]["operationOrdinal"], 10)
        self.assertEqual(target["recordedCommandCount"], 1)
        self.assertNotIn("confirmedDamage", target)

    def test_fake_actor_and_source_revision_are_not_qualified(self):
        b, stats, actions = synthetic_bundle(kind="contest", contest=True)
        stats["pairSocialEvidence"]["deeds"][0]["facets"][0]["fromPlayerId"] = 2
        stats["pairSocialEvidence"]["deeds"][0]["facets"][0]["toPlayerId"] = 1
        output = measure(b, stats, actions)
        self.assertTrue(output["diagnostics"])
        self.assertFalse(any(o["fromReplayPlayerId"] == 2 for o in output["observations"]))
        b, stats, actions = synthetic_bundle()
        stats["source"]["replaySha256"] = "f" * 64
        with self.assertRaisesRegex(ValueError, "STALE_OR_INCONSISTENT_SOURCE_REVISION"):
            measure(b, stats, actions)
        b, stats, actions = synthetic_bundle()
        actions.append({**actions[0], "timestampMs": 1})
        with self.assertRaisesRegex(ValueError, "CONFLICTING_ORIGINAL_SOURCE_EVENT"):
            measure(b, stats, actions)

    def test_copied_povs_shared_target_and_missing_ordinal(self):
        b, stats, actions = synthetic_bundle(kind="co-target", people=(1, 2, 3))
        self.assertEqual(measure(b, stats, actions)["observations"], [])
        b, stats, actions = synthetic_bundle(kind="contest", contest=True)
        self.assertEqual(measure(b, stats, actions),
                         measure(deepcopy(b), deepcopy(stats), list(reversed(actions * 2))))
        actions[0]["operationOrdinal"] = None
        output = measure(b, stats, actions)
        affected = next(r for r in output["observations"]
                        if r["kind"] == "DIRECTED_TARGET_COMMAND")
        self.assertEqual(affected["firstSourceMoment"]["order"], "PARTIAL")
        self.assertIsNone(affected["firstSourceMoment"]["operationOrdinal"])

    def test_game_scoping_and_corrected_context_revision(self):
        b, stats, actions = synthetic_bundle()
        before = measure(b, stats, actions)
        b["context"]["sourceContextRevision"] = "e" * 64
        after = measure(b, stats, actions)
        self.assertNotEqual(before["projectionRevision"], after["projectionRevision"])
        self.assertNotEqual(before["observations"][0]["observationId"],
                            after["observations"][0]["observationId"])
        assert before["publicationAllowed"] is False
        # Different Game source correction is not the same neutral identity.
        b, stats, actions = synthetic_bundle()
        stats["source"]["replaySha256"] = "f" * 64
        b["context"]["sourceRevision"]["replaySha256"] = "f" * 64
        stats["pairSocialEvidence"]["gameScope"]["replaySha256"] = "f" * 64
        refreshed = measure(b, stats, actions)
        self.assertNotEqual(before["projectionRevision"], refreshed["projectionRevision"])

    def test_preentry_is_prior_only_and_missing_not_equivalent_to_zero(self):
        b, stats, actions = synthetic_bundle()
        actions.append({"eventId": "early-queue", "actorPlayerId": 1,
                        "timestampMs": 9000, "operationOrdinal": 9,
                        "sourceActionName": "DE_QUEUE"})
        out = measure(b, stats, actions)
        metric = out["observations"][0]["preEntryRequestedActivity"]
        self.assertEqual(metric["windowEndExclusiveMs"], 10000)
        self.assertEqual(metric["actorOriginalCommandCount"], 1)
        self.assertEqual(metric["sourceEventIds"], ["early-queue"])
        self.assertIn("NOT_ARMY_SURVIVAL_OR_EFFECT", metric["meaning"])
        # No pre-entry recorded action is never validated inactivity or strength.
        only = measure(b, stats, actions[:-1])["observations"][0]
        self.assertEqual(only["preEntryRequestedActivity"]["actorOriginalCommandCount"], 0)
        self.assertFalse(only["qualifiesSocialFact"])

    def test_qualifier_rejects_synthetic_label_injection_through_limited_evidence(self):
        b, stats, actions = synthetic_bundle()
        observed = measure(b, stats, actions)
        self.assertFalse(observed["qualifiesAnySocialFact"])
        # Honest adapter submits NO semantic measurements to the qualifier.
        # Rivalry can only qualify from separately linked local contest,
        # while Gallantry/Cruelty/Chivalry/Hostility/Bond stay unresolved.
        b["measurements"] = []
        claims = decisions(b)
        self.assertFalse(any(x["decision"] == "QUALIFIED"
                             for x in claims["inferences"]
                             if x["familyId"] in ("DARING_OFFENSE",
                                "PREEXISTING_VULNERABILITY_PRESSURE",
                                "NOTEWORTHY_DIRECTED_PROTECTION",
                                "DISTINCT_RUPTURE_ANTAGONISM")))


class AuthenticCorpusMeasurements(unittest.TestCase):
    """Opt-in local original replay scan; specifically CI-authorized fixture use."""

    @unittest.skipUnless(os.environ.get("AOF_SOCIAL_AUTHENTIC_MEASUREMENTS") == "1",
                         "authentic corpus review opt-in, not synthetic CI")
    def test_hash_pinned_original_1v1_team_ffa_neutral_measurements(self):
        from parse_replay import build_payload
        from analysis_dataset import build_analysis_dataset
        from statistics_projector import project_statistics_from_analysis
        from social_v1_context import project_social_v1_context
        for name, (filename, expected, players) in PINS.items():
            with self.subTest(recording=name):
                original = ROOT / filename
                self.assertTrue(original.is_file(), "Original fixture missing: " + filename)
                actual = sha256(original.read_bytes()).hexdigest()
                if expected is None:
                    self.fail("TEAM_4V4_PIN_REQUIRED_SHA256=" + actual)
                self.assertEqual(actual, expected, "Recording hash changed")
                with tempfile.TemporaryDirectory(prefix="aof-social-source-") as folder:
                    canonical = Path(folder) / "canonical"
                    build_payload(original, canonical_dir=canonical, seal_mode="fast")
                    analysis = build_analysis_dataset(canonical, validate=False)
                    stat = project_statistics_from_analysis(analysis)
                    context = project_social_v1_context(statistics=stat)
                    self.assertEqual(len(stat["participants"]), players)
                    measured = project(statistics=stat, context=context,
                        action_events=analysis["actionEvents"], lookback_ms=120000)
                    self.assertFalse(measured["publicationAllowed"])
                    self.assertFalse(measured["qualifiesAnySocialFact"])
                    self.assertTrue(all(x["coverage"] == "LIMITED"
                                        for x in measured["observations"]))
                    self.assertTrue(all(x["firstSourceMoment"]["recordingAtMs"] >= 0
                                        for x in measured["observations"]))
                    self.assertEqual(measured, project(statistics=stat, context=context,
                        action_events=list(reversed(analysis["actionEvents"])), lookback_ms=120000))
                    # Source-authenticated admission cannot be created inside
                    # this test. This is deliberately a SYNTHETIC league binding
                    # wrapped around genuinely decoded recording observations.
                    # No new semantic measurements are fabricated: existing
                    # source-bound Pair Contest is the only configured rule.
                    pair = stat["pairSocialEvidence"]
                    ids = sorted(p["playerId"] for p in stat["participants"])
                    authority = sha256((actual + ":" + name).encode()).hexdigest()
                    snap = snapshot(tuple(ids), authority=authority,
                                    battle="TEST-BATTLE-" + name, game="game-1",
                                    event="TEST-EVENT-" + name, source=actual)
                    orig = pair["observations"]
                    lineages = {deed["deedId"]: {
                        "incidentId": "synthetic-source-" +
                            sha256((actual + name + deed["deedId"]).encode()).hexdigest(),
                        "overlapGroupId": "synthetic-overlap-" +
                            sha256((actual + name + deed["deedId"]).encode()).hexdigest(),
                        "lineage": "SOURCE_ANCHORED", "state": "CURRENT"}
                        for deed in pair["deeds"]}
                    kwargs = {
                        "snapshot": snap, "context": context, "pair_deeds": pair["deeds"],
                        "pair_observations": orig,
                        "replay_bindings": {"players": {i: "p" + str(i) for i in ids},
                                            "methodVersions": ["SYNTHETIC_ATTESTED_STATS_NOT_APPROVED_V1"]},
                        "incident_lineages": lineages, "measurements": [],
                        "calibration": config(["PAIR_CONTEST"]),
                        "historical_order": {"leagueOrderKey": "TEST-EVENT-" + name,
                                              "gameNumber": 1, "order": "ORDERED"},
                    }
                    proposed = qualify_social_v1(**kwargs)
                    for inference in proposed["inferences"]:
                        validate_record("Inference", inference)
                    for effect in proposed["effects"]:
                        validate_record("Claim", effect["claim"])
                    self.assertFalse(proposed["publicationAllowed"])
                    self.assertFalse(proposed["officialWrites"])
                    self.assertFalse(any(x["decision"] == "QUALIFIED"
                        for x in proposed["inferences"] if x["familyId"] != "PAIR_CONTEST"))
                    admissible = [e for e in proposed["effects"]
                        if e["claim"]["decision"] == "QUALIFIED"]
                    for e in admissible:
                        self.assertEqual(e["claim"]["subject"]["track"], "RIVALRY")
                        self.assertEqual(e["claim"]["historicalPosition"]["order"], "ORDERED")
                        self.assertIsInstance(e["claim"]["historicalPosition"]["operationOrdinal"], int)
                    self._test_history_handoff(snap, proposed)
                    print("AUTHENTIC_MEASUREMENT_REPORT " + name +
                          " SHA256=" + actual + " candidates=" +
                          str(len(measured["observations"])) +
                          " diagnostics=" + str(len(measured["diagnostics"])) +
                          " proposed_pair_contest=" + str(len(admissible)) +
                          " other_semantic_facts=0",
                          flush=True)

    def _test_history_handoff(self, snap, proposed):
        if not shutil.which("node"):
            self.skipTest("Node not installed in authentic test job")
        script = """
import {evaluateHistory} from './functions/src/engines/socialV1History/history.js';
let raw=''; for await(const chunk of process.stdin)raw+=chunk;
const x=JSON.parse(raw); const tracks={REPUTATION:['GALLANTRY','CRUELTY','CHIVALRY'],RELATIONSHIP:['RIVALRY','HOSTILITY','BOND']};
const stages=Object.fromEntries(Object.entries(tracks).map(([sys,items])=>[
  sys,Object.fromEntries(items.map(track=>[track,{
    up:[1,2,3],down:[1,1,1],...(sys==='RELATIONSHIP'?{reciprocity:{3:1}}:{})
  }]))]));
const budgets={
  reputationBattle:Object.fromEntries(tracks.REPUTATION.map(t=>[t,{STRENGTHEN:3,WEAKEN:3}])),
  relationshipEvent:Object.fromEntries(tracks.RELATIONSHIP.map(t=>[t,{STRENGTHEN:3,WEAKEN:3}]))
};
const rules={};
for(const e of x.effects){ const c=e.claim;if(c.decision!=='QUALIFIED')continue;
rules[c.ruleId]={system:c.subject.system,track:c.subject.track,effect:c.effect,
 bands:{[c.significanceBandId]:1}};
}
const cfg={version:'AUTHENTIC_SOURCE_SYNTHETIC_CALIBRATION_UNAPPROVED',
 policy:{policyVersion:'AOF_SOC_V1_INFERENCE_PROPOSAL',configurationVersion:'SYNTHETIC_TEST_ONLY',status:'PROPOSED',approvalRef:null},
 stages,budgets,rules,treachery:{consumptionUnits:0,maximumStage:3}};
const s=x.snapshot,chapters=[{battleId:s.battleId,matchId:s.matchId,gameId:s.gameId,
 gameGuid:s.gameGuid,eventId:s.eventId,seasonId:s.seasonId,sourceAuthority:s.authorityRevision,
 revision:1,state:'READY',order:{event:1,battle:1,game:1,key:s.eventId}}];
const r=evaluateHistory({chapters,effects:x.effects,actorWitnesses:x.witnesses,calibration:cfg});
console.log(JSON.stringify({officialWrites:r.officialWrites,
 publicationAllowed:r.publicationAllowed,receipts:r.receipts.length,
 projections:r.projections.map(p=>({track:p.subject.track,status:p.status,stage:p.stage,pendingReasons:p.pendingReasons})),
 audits:r.audit}));
"""
        process = subprocess.run(["node", "--input-type=module", "-e", script],
             input=json.dumps({"snapshot": snap,"effects": proposed["effects"],
                               "witnesses": proposed["actorWitnesses"]}),
             text=True, cwd=ROOT, capture_output=True, check=True)
        result = json.loads(process.stdout)
        self.assertFalse(result["officialWrites"])
        self.assertFalse(result["publicationAllowed"])
        self.assertEqual(result["receipts"], 0)
        self.assertTrue(all(p["track"] == "RIVALRY" for p in result["projections"]))



if __name__ == "__main__":
    unittest.main()

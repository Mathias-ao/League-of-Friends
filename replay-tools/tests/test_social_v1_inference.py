"""Synthetic #126 acceptance, never proof of an authentic replay's social conduct."""
from copy import deepcopy
from pathlib import Path
import json
import shutil
import subprocess
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from social_v1_context import project_social_v1_context, VERSION as EMITTED_CONTEXT_VERSION
from social_v1_inference import (qualify_social_v1, validate_inference_configuration,
                                 MANDATORY, FAMILIES)
from social_v1_contract import validate_record

H = "a" * 64
B = "b" * 64
D = "d" * 64
METHOD = "SYNTHETIC_ATTESTED_STATS_NOT_APPROVED_V1"
SOURCE = {"replaySha256": H, "canonicalManifestSha256": B,
          "canonicalSchemaVersion": "1.1.0", "parserVersion": "synthetic"}
POLICY = {"policyVersion": "AOF_SOC_V1_INFERENCE_PROPOSAL",
          "configurationVersion": "SYNTHETIC_TEST_ONLY", "status": "PROPOSED",
          "approvalRef": None}


def config(names=None):
    names = list(FAMILIES) if names is None else names
    return {"version": "SYNTHETIC_VERSION_1", "policy": deepcopy(POLICY),
            "measurementMethods": {"synthetic_provenance_only": METHOD},
            "rules": {name: {"ruleId": name + "_SYNTHETIC",
                             "significanceBandId": "SYNTHETIC_MEANINGFUL",
                             "minIndependentSourceEvents": 2,
                             "measurementMinimums": {key: 1 for key in MANDATORY[name]}}
                      for name in names}}


def snapshot(people=(1, 2), *, authority=D, battle="match-1", game="game-1",
             event="event-1", source=H):
    s = {"contract": "AOF_SOCIAL_V1_SHARED_1", "authorityRevision": authority,
         "battleId": battle, "matchId": battle, "gameId": game,
         "eventId": event, "seasonId": "season-1", "gameGuid": "guid-test",
         "sourceHash": source, "statisticsRevision": 1,
         "artifactRefs": [{"kind": "STATISTICS", "digest": B, "generation": None}],
         "mappingDigest": B, "eventAdmissionDigest": B,
         "outcome": {"qualification": "UNRESOLVED", "resultRevision": None,
                     "winningPlayerIds": None},
         "roster": [{"replaySlot": i, "playerId": "p" + str(i), "teamId": None}
                    for i in people]}
    validate_record("SourceSnapshot", s)
    return s


def metric(kind, ident, at, *, actor=1, target=2, value=2, duration=None):
    before = kind.startswith("PREENTRY") or kind == "DISTINCT_PREENTRY_COOPERATION"
    # The time window MUST end before the episode for pre-entry facts.
    start = at - (duration if duration is not None else 100)
    return {"kind": kind, "fromReplayPlayerId": actor,
            "toReplayPlayerId": target, "value": value, "measuredAtMs": at,
            "windowStartMs": start, "windowEndMs": at,
            "sourceEventIds": [ident], "sourceAuthority": D,
            "methodVersion": METHOD, "coverage": "ADMITTED"}


def case(*, people=(1, 2), teams=None, kind="pressure", actor=1, target=2,
         contest=False, facts=(), locked=True, battle="match-1", event="event-1", castle=False):
    teams = teams or {p: p for p in people}
    facets = {
        "pressure": ("ECONOMY_PRESSURE", "TARGETED_COMMAND"),
        "contest": ("TARGETED_COMMAND", "LOCAL_COMMAND_OVERLAP"),
        "defense": ("DEFENSIVE_PARTICIPATION", "LOCAL_COMMAND_OVERLAP"),
        "help": ("DEFENSIVE_PARTICIPATION",),
        "co-target": ("SHARED_OPPONENT_PARTICIPATION",),
    }[kind]
    source_events = ["cmd1", "cmd2"] if len(facets) > 1 or kind == "co-target" else ["cmd1"]
    source_facets = ([{"kind": "SHARED_OPPONENT_PARTICIPATION",
                       "targetPlayerId": next(p for p in people if p not in (actor, target)),
                       "contributions": [
                           {"contributorPlayerId": actor, "sourceEventIds": ["cmd1"]},
                           {"contributorPlayerId": target, "sourceEventIds": ["cmd2"]}],
                       "coordinationIntent": "UNAVAILABLE"}]
                     if kind == "co-target" else
                     [{"kind": facet, "fromPlayerId": actor, "toPlayerId": target,
                       "sourceEventIds": [source_events[i % len(source_events)]]}
                      for i, facet in enumerate(facets)])
    row = {"deedId": "deed-X", "pairPlayerIds": sorted([actor, target]),
           "incidentIds": ["original-X"], "sourceEventIds": source_events,
           "startedAt": {"atMs": 10000, "operationOrdinal": 10},
           "endedAt": {"atMs": 14000, "operationOrdinal": 20},
           "facets": source_facets}
    observations = [{"sourceEventId": ident,
                     "actorPlayerId": target if kind == "co-target" and i == 1 else actor,
                     "moment": {"atMs": 11000 + 100 * i,
                                "operationOrdinal": 10 + i}, "commandType": "ORDER"}
                    for i, ident in enumerate(source_events)]
    # A physically identical source event may corroborate two proposed labels,
    # but must never become contradictory observations or two independent deeds.
    observed_by_id = {e["sourceEventId"]: e for e in observations}
    for measurement in facts:
        event_id = measurement["sourceEventIds"][0]
        source_observation = {"sourceEventId": event_id,
                 "actorPlayerId": measurement["fromReplayPlayerId"],
                 "moment": {"atMs": measurement["measuredAtMs"],
                            "operationOrdinal": 100 + len(observations)},
                 "commandType": "DERIVED_METRIC_SOURCE"}
        if event_id in observed_by_id:
            existing = observed_by_id[event_id]
            if (existing["actorPlayerId"] != source_observation["actorPlayerId"] or
                    existing["moment"]["atMs"] != source_observation["moment"]["atMs"]):
                raise ValueError("INVALID_SYNTHETIC_SOURCE_EVENT_REUSE")
        else:
            observations.append(source_observation)
            observed_by_id[event_id] = source_observation
    military = {}
    extra_ids = [f["sourceEventIds"][0] for f in facts]
    if extra_ids:
        military["battles"] = [{"battleId": "context-metrics", "startedAtMs": 0,
                               "endedAtMs": 18000, "sourceEventIds": extra_ids,
                               "participantPlayerIds": [actor, target]}]
    if contest:
        military["skirmishes"] = [{"skirmishId": "pair-skirmish",
                                  "startedAtMs": 10000, "endedAtMs": 14000,
                                  "sourceEventIds": ["cmd1", "cmd2"],
                                  "participantPlayerIds": [actor, target]}]
    if kind == "help":
        military["defensiveAssistsGiven"] = [
            {"battleId": "help-context", "startedAtMs": 10000, "endedAtMs": 14000,
             "sourceEventIds": ["cmd1"], "helperPlayerId": actor,
             "defendedPlayerId": target}]
    players = []
    for p in people:
        entry = {"playerId": p, "mapPresence": {
            "modelVersion": "AOF_MAP_PRESENCE_V8",
            "homeAnchor": {"x": p * 30, "y": 10, "method": "initial_town_center"},
            "forwardBuildings": {"evidence": []}, "towers": {"evidence": []},
            "forwardEco": {"evidence": []},
            "goldControl": {"layer": "inferred", "clusters": []}},
            "military": {"engagements": {"engagementEvidence":
                military if p == actor else {}}}}
        players.append(entry)
    if castle:
        players[0]["mapPresence"]["forwardBuildings"]["evidence"] = [{
            "sourceEventId": "castle-placement",
            "building": {"rawId": 82, "name": "Castle"},
            "position": {"x": 45.0, "y": 10.0},
            "atMs": 8000, "enemyProgressPercent": 80}]
    stats = {"source": deepcopy(SOURCE), "scope": {"observedUntilMs": 20000},
             "participants": players,
             "matchFacts": {"rules": {"lockTeams": {"value": locked,
                                                 "status": "DECODED"}},
                            "players": [{"playerId": p, "lobbyTeamIdRaw": teams[p]}
                                        for p in people]},
             "pairSocialEvidence": {"modelVersion": "AOF_PAIR_SOCIAL_EVIDENCE_V1",
                 "gameScope": deepcopy(SOURCE), "observations": observations,
                 "deeds": [row], "episodeContext": {"annotations": [], "sequences": []}}}
    context = project_social_v1_context(statistics=stats)
    snap = snapshot(people, battle=battle, event=event)
    return {"snapshot": snap, "context": context,
            "pair_deeds": [row], "pair_observations": observations,
            "measurements": list(facts),
            "incident_lineages": {"deed-X": {"incidentId": "stable-lineage-X",
                                            "overlapGroupId": "overlap-X",
                                            "lineage": "SOURCE_ANCHORED",
                                            "state": "CURRENT"}},
            "calibration": config(),
            "replay_bindings": {"players": {p: "p" + str(p) for p in people},
                                "methodVersions": [METHOD]},
            "historical_order": {"leagueOrderKey": event,
                                 "gameNumber": 1, "order": "ORDERED"}}


def decisions(bundle):
    result = qualify_social_v1(**bundle)
    for row in result["inferences"]:
        validate_record("Inference", row)
    for row in result["effects"]:
        validate_record("Claim", row["claim"])
    assert result["publicationAllowed"] is False
    assert result["officialWrites"] is False
    return result


def outcome(bundle, family):
    r = decisions(bundle)
    return [row for row in r["inferences"] if row["familyId"] == family]


def admitted(bundle, family):
    return [r for r in outcome(bundle, family) if r["decision"] == "QUALIFIED"]


class QualificationTests(unittest.TestCase):
    def test_all_six_positive_pathways_use_source_backed_combinations(self):
        scenarios = [
            ("PAIR_CONTEST", dict(kind="contest", contest=True)),
            ("DIRECTED_HELP", dict(kind="help",
                facts=[metric("MEANINGFUL_DIRECTED_HELP", "help-metric", 12000)])),
            ("DISTINCT_RUPTURE_ANTAGONISM", dict(kind="pressure", facts=[
                metric("DISTINCT_PREENTRY_COOPERATION", "cooperation", 5000),
                metric("ATTRIBUTABLE_RUPTURE", "rupture", 9000),
                metric("POST_RUPTURE_DIRECTED_PRESSURE", "post", 13000)])),
            ("DARING_OFFENSE", dict(kind="pressure", facts=[
                metric("PREENTRY_CHALLENGE", "challenge", 5000, duration=2000),
                metric("MEANINGFUL_OFFENSIVE_COMMITMENT", "commit", 12000)])),
            ("PREEXISTING_VULNERABILITY_PRESSURE", dict(kind="pressure", facts=[
                metric("PREENTRY_VULNERABILITY", "vulnerability", 5000, duration=2000),
                metric("MEANINGFUL_OFFENSIVE_COMMITMENT", "commit", 12000)])),
            ("NOTEWORTHY_DIRECTED_PROTECTION", dict(kind="help", facts=[
                metric("PREENTRY_RECIPIENT_THREAT", "threat", 5000),
                metric("MEANINGFUL_DIRECTED_HELP", "help-metric", 12000)])),
        ]
        for family, kwargs in scenarios:
            with self.subTest(family=family):
                b = case(**kwargs)
                positive = admitted(b, family)
                self.assertEqual(len(positive), 1)
                self.assertEqual(positive[0]["basis"], "BOUNDED_INFERENCE")
                self.assertEqual(positive[0]["action"]["actorPlayerId"], "p1")
                self.assertEqual(positive[0]["action"]["counterpartPlayerId"], "p2")
                self.assertIn("BOUNDED_ORDINARY_INFERENCE_NOT_EXECUTION_PROOF",
                              positive[0]["reasonCodes"])

    def test_genuine_local_overlap_shape_retains_own_source_and_not_return_credit(self):
        # Neutral Pair V1 emits contributorPlayerId/otherPlayerId, with
        # commands by both participants. Opponent command is context only.
        b = case(kind="contest", contest=True)
        b["pair_deeds"][0]["facets"][1] = {
            "kind": "LOCAL_COMMAND_OVERLAP",
            "contributorPlayerId": 1, "otherPlayerId": 2,
            "sourceEventIds": ["cmd1", "cmd2"],
            "targetedActionEstablished": False}
        b["pair_observations"][1]["actorPlayerId"] = 2
        r = decisions(b)
        positives = [x for x in r["inferences"] if x["familyId"] == "PAIR_CONTEST"
                     and x["decision"] == "QUALIFIED"]
        self.assertEqual(len(positives), 1)
        self.assertEqual(positives[0]["action"]["actorPlayerId"], "p1")
        self.assertFalse(any(w["actorPlayerId"] == "p2" for w in r["actorWitnesses"]))
        own_refs = [f["id"] for f in positives[0]["supportRefs"]
                    if f["kind"] == "SOURCE_EVENT"]
        self.assertIn("cmd1", own_refs)
        self.assertNotIn("cmd2", own_refs)
        b["pair_observations"][1]["actorPlayerId"] = 3
        with self.assertRaisesRegex(ValueError, "INVALID_RECORDED_EVENT_ANCHOR"):
            decisions(b)

    def test_ordinary_warfare_is_neither_cruelty_nor_hostility(self):
        b = case(kind="pressure")
        self.assertFalse(admitted(b, "DISTINCT_RUPTURE_ANTAGONISM"))
        self.assertFalse(admitted(b, "PREEXISTING_VULNERABILITY_PRESSURE"))
        self.assertFalse(admitted(b, "DARING_OFFENSE"))
        self.assertTrue(all(x["decision"] == "PENDING"
                            for x in outcome(b, "DISTINCT_RUPTURE_ANTAGONISM")))

    def test_contest_requires_own_direction_and_linked_skirmish(self):
        a = case(kind="contest", contest=True)
        self.assertEqual(len(admitted(a, "PAIR_CONTEST")), 1)
        a["context"]["engagementContexts"] = []
        a["context"]["deedContexts"][0]["linkedEngagementDetectors"] = []
        self.assertFalse(admitted(a, "PAIR_CONTEST"))
        b = case(kind="co-target", contest=True, people=(1, 2, 3))
        self.assertFalse(admitted(b, "PAIR_CONTEST"))

    def test_ffa_qualified_direction_only_with_own_explicit_support(self):
        b = case(people=(1, 2, 3), teams={1: 1, 2: 2, 3: 3}, kind="help",
                 facts=[metric("MEANINGFUL_DIRECTED_HELP", "help-metric", 12000)])
        r = decisions(b)
        self.assertEqual(len(admitted(b, "DIRECTED_HELP")), 1)
        qualified = [x for x in r["effects"] if x["claim"]["decision"] == "QUALIFIED"
                     and x["claim"]["subject"]["track"] == "BOND"]
        self.assertEqual(len(qualified), 1)
        self.assertEqual(qualified[0]["claim"]["subject"]["fromPlayerId"], "p1")
        self.assertEqual(qualified[0]["claim"]["subject"]["toPlayerId"], "p2")
        self.assertFalse(any(x["claim"]["subject"].get("fromPlayerId") == "p2" for x in r["effects"]))
        self.assertFalse(any(x["claim"]["subject"].get("toPlayerId") == "p3" for x in r["effects"]))

    def test_team_assistance_not_automatic_for_other_team_member(self):
        b = case(people=(1, 2, 3, 4), teams={1: 1, 2: 1, 3: 1, 4: 4},
                 kind="help", facts=[metric("MEANINGFUL_DIRECTED_HELP", "help-metric", 12000)])
        r = decisions(b)
        self.assertEqual(len([q for q in r["effects"] if q["claim"]["decision"] == "QUALIFIED"
                          and q["claim"]["subject"].get("toPlayerId") == "p3"]), 0)

    def test_no_ffa_team_co_target_proximity_or_ordinary_transfer_shortcut(self):
        b = case(kind="co-target", people=(1, 2, 3))
        self.assertFalse(admitted(b, "DIRECTED_HELP"))
        self.assertFalse(admitted(b, "NOTEWORTHY_DIRECTED_PROTECTION"))
        self.assertFalse(admitted(b, "PAIR_CONTEST"))

    def test_genuine_undirected_shared_opponent_facet_remains_neutral(self):
        # Two actual distinct contributor source events; pair participation
        # never becomes either directional Relationship Claim or own witness.
        b = case(kind="co-target", people=(1, 2, 3))
        self.assertEqual({e["actorPlayerId"] for e in b["pair_observations"]}, {1, 2})
        self.assertEqual(b["context"]["deedContexts"][0]["directionalActors"], [])
        r = decisions(b)
        self.assertEqual(r["effects"], [])
        self.assertEqual(r["actorWitnesses"], [])

    def test_preentry_context_does_not_take_late_weakness_or_victory_as_prior(self):
        f = metric("PREENTRY_VULNERABILITY", "post-loss", 12500)
        b = case(facts=[f, metric("MEANINGFUL_OFFENSIVE_COMMITMENT", "commit", 13000)])
        x = outcome(b, "PREEXISTING_VULNERABILITY_PRESSURE")[0]
        self.assertEqual(x["decision"], "NOT_QUALIFIED")
        self.assertIn("POST_ENTRY_CONTEXT_CANNOT_PROVE_PREENTRY", x["reasonCodes"])
        f2 = metric("PREENTRY_CHALLENGE", "victory", 18000)
        b = case(facts=[f2, metric("MEANINGFUL_OFFENSIVE_COMMITMENT", "commit", 13000)])
        self.assertFalse(admitted(b, "DARING_OFFENSE"))

    def test_unordered_rupture_cannot_credit_hostility(self):
        facts = [metric("DISTINCT_PREENTRY_COOPERATION", "coop", 5000),
                 metric("ATTRIBUTABLE_RUPTURE", "rupture", 13000),
                 metric("POST_RUPTURE_DIRECTED_PRESSURE", "post", 12000)]
        b = case(kind="pressure", facts=facts)
        self.assertFalse(admitted(b, "DISTINCT_RUPTURE_ANTAGONISM"))

    def test_separately_justified_strengthening_and_weakening_same_incident(self):
        facts = [metric("DISTINCT_PREENTRY_COOPERATION", "coop", 5000),
                 metric("ATTRIBUTABLE_RUPTURE", "rupture", 9000),
                 metric("POST_RUPTURE_DIRECTED_PRESSURE", "post", 13000),
                 metric("SERIOUS_BOND_HARM_CONTEXT", "bond-harm", 13000)]
        b = case(kind="pressure", facts=facts)
        self.assertEqual(len(admitted(b, "DISTINCT_RUPTURE_ANTAGONISM")), 1)
        self.assertEqual(len(admitted(b, "SERIOUS_BOND_ANTAGONISM")), 1)
        r = decisions(b)
        q = [x["claim"] for x in r["effects"] if x["claim"]["decision"] == "QUALIFIED"]
        self.assertIn(("HOSTILITY", "STRENGTHEN"), {(c["subject"]["track"], c["effect"]) for c in q})
        self.assertIn(("BOND", "WEAKEN"), {(c["subject"]["track"], c["effect"]) for c in q})
        self.assertFalse(any(c["subject"]["system"] == "REPUTATION" for c in q))

    def test_help_does_not_automatically_cool_hostility_without_reconciliation(self):
        b = case(kind="help",
                 facts=[metric("MEANINGFUL_DIRECTED_HELP", "help-metric", 12000)])
        self.assertEqual(len(admitted(b, "DIRECTED_HELP")), 1)
        self.assertFalse(admitted(b, "RECONCILIATORY_HELP"))
        b = case(kind="help", facts=[metric("MEANINGFUL_DIRECTED_HELP", "h", 12000),
                                     metric("RECONCILIATION_CONTEXT", "r", 12200)])
        self.assertEqual(len(admitted(b, "RECONCILIATORY_HELP")), 1)

    def test_limited_coverage_pending_and_unapproved_calibration_rejected(self):
        b = case(kind="pressure", facts=[metric("PREENTRY_CHALLENGE", "prior", 5000)])
        q = outcome(b, "DARING_OFFENSE")[0]
        self.assertEqual(q["decision"], "PENDING")
        self.assertIn("MISSING_OR_UNQUALIFIED_MEANINGFUL_OFFENSIVE_COMMITMENT", q["reasonCodes"])
        b["calibration"]["policy"]["status"] = "APPROVED"
        b["calibration"]["policy"]["approvalRef"] = "fake"
        with self.assertRaisesRegex(ValueError, "PREVIEWS_ONLY"):
            decisions(b)

    def test_reproduced_both_limited_measurements_never_promote_to_admitted(self):
        # Organiser 2 reproducible counterexample at db4c2102: two distinct
        # original actor-bound sources, values above test-only minima, but
        # both method-specific measurements only LIMITED, not ADMITTED.
        facts = [metric("PREENTRY_CHALLENGE", "prior-challenge", 5000),
                 metric("MEANINGFUL_OFFENSIVE_COMMITMENT", "own-commit", 12000)]
        for fact in facts:
            fact["coverage"] = "LIMITED"
        b = case(kind="pressure", facts=facts)
        result = decisions(b)
        inference = next(x for x in result["inferences"] if x["familyId"] == "DARING_OFFENSE")
        self.assertEqual(inference["decision"], "PENDING")
        self.assertEqual(inference["coverage"]["tier"], "LIMITED")
        self.assertIn("LIMITED_METHOD_COVERAGE_RULE_UNCONFIGURED", inference["reasonCodes"])
        self.assertNotEqual(inference["coverage"]["tier"], "ADMITTED")
        claims = [e["claim"] for e in result["effects"] if e["claim"]["subject"]["track"] == "GALLANTRY"]
        self.assertEqual(len(claims), 1)
        self.assertEqual(claims[0]["decision"], "PENDING")
        self.assertEqual(claims[0]["reciprocity"]["decision"], "INELIGIBLE")
        self.assertFalse(result["actorWitnesses"])

        # A single LIMITED dimension cannot borrow an otherwise sound one,
        # and an unsupported method string cannot bypass the method registry.
        facts[0]["coverage"] = "ADMITTED"
        partial = decisions(b)
        self.assertEqual(next(x for x in partial["inferences"]
                              if x["familyId"] == "DARING_OFFENSE")["decision"], "PENDING")
        facts[1]["methodVersion"] = "FAKE_UNREGISTERED_LIMITED_METHOD"
        with self.assertRaisesRegex(ValueError, "UNADMITTED_MEASUREMENT_PROVENANCE"):
            decisions(b)

    def test_identity_dedup_and_correction_fences(self):
        b = case(kind="contest", contest=True, battle="match-A", event="warmup")
        r = decisions(b)
        self.assertEqual(r, decisions(deepcopy(b)))
        qualified = [e["claim"] for e in r["effects"] if e["claim"]["decision"] == "QUALIFIED"]
        self.assertTrue(qualified)
        b["context"]["sourceContextRevision"] = B
        changed = decisions(b)
        old = {c["claimId"]: c["claimRevision"] for c in qualified}
        changed_q = [e["claim"] for e in changed["effects"] if e["claim"]["decision"] == "QUALIFIED"]
        self.assertEqual({c["claimId"] for c in qualified}, {c["claimId"] for c in changed_q})
        self.assertTrue(any(old[c["claimId"]] != c["claimRevision"] for c in changed_q))
        b["context"]["sourceRevision"]["replaySha256"] = "z" * 64
        with self.assertRaisesRegex(ValueError, "STALE_CONTEXT"):
            decisions(b)

    def test_directional_facet_proof_prevents_copying_one_actors_conduct_to_another(self):
        b = case(kind="contest", contest=True)
        # Same merged deed, but source facet belongs to p1, not both.
        b["context"]["deedContexts"][0]["directionalActors"].append(
            {"fromReplayPlayerId": 2, "toReplayPlayerId": 1})
        with self.assertRaisesRegex(ValueError, "DIRECTIONAL_FACET_MAPPING"):
            decisions(b)

    def test_unknown_lineage_or_stale_source_never_claimed(self):
        b = case(kind="contest", contest=True)
        b["incident_lineages"] = {}
        self.assertEqual(decisions(b)["effects"], [])
        b = case(kind="contest", contest=True)
        b["incident_lineages"]["deed-X"]["state"] = "WITHDRAWN"
        self.assertEqual(decisions(b)["effects"], [])

    def test_rule_deletion_means_unconfigured_not_automatic_zero_claim(self):
        b = case(kind="contest", contest=True)
        b["calibration"] = config([])
        self.assertEqual(decisions(b)["effects"], [])

    def test_corroborator_event_cannot_be_backdated_to_prior_window(self):
        b = case(facts=[metric("PREENTRY_VULNERABILITY", "vuln", 5000),
                        metric("MEANINGFUL_OFFENSIVE_COMMITMENT", "commit", 12000)])
        for event in b["pair_observations"]:
            if event["sourceEventId"] == "vuln":
                event["moment"]["atMs"] = 16000
        with self.assertRaisesRegex(ValueError, "SOURCE_EVENTS_OUTSIDE_MEASUREMENT_WINDOW"):
            decisions(b)

    def test_correlated_metric_event_cannot_prove_two_independent_dimensions(self):
        # Both interpret the *same physically consistent original event*. The
        # neutral validator should pass; the qualifier must reject false
        # independence between meaningful help and reconciliation.
        b = case(kind="help", facts=[
            metric("MEANINGFUL_DIRECTED_HELP", "one", 12000),
            metric("RECONCILIATION_CONTEXT", "one", 12000)])
        r = decisions(b)
        q = [v for v in r["inferences"] if v["familyId"] == "RECONCILIATORY_HELP"][0]
        self.assertEqual(q["decision"], "NOT_QUALIFIED")
        self.assertIn("CORRELATED_MEASUREMENT_WITNESSES", q["reasonCodes"])
        self.assertFalse(any(e["claim"]["decision"] == "QUALIFIED" and
            e["claim"]["subject"]["track"] == "HOSTILITY" for e in r["effects"]))

    def test_snapshot_roster_identity_requires_server_proven_replay_binding(self):
        b = case(kind="contest", contest=True)
        b["replay_bindings"]["players"][2] = "p1"
        with self.assertRaisesRegex(ValueError, "AMBIGUOUS_REPLAY_BINDINGS"):
            decisions(b)


    def test_directional_source_event_actor_spoof_is_refused_without_muting_real_actor(self):
        b = case(kind="contest", contest=True)
        b["pair_deeds"][0]["facets"].append({
            "kind": "TARGETED_COMMAND", "fromPlayerId": 2, "toPlayerId": 1,
            "sourceEventIds": ["cmd1"]})
        # #124 neutral context detects both *claimed* directions, but original
        # actor of cmd1 is p1. Strict directional qualification is #126's job.
        b["context"]["deedContexts"][0]["directionalActors"].append(
            {"fromReplayPlayerId": 2, "toReplayPlayerId": 1})
        r = decisions(b)
        self.assertTrue(any(x["fromReplayPlayerId"] == 2
                            for x in r["rejectedActorDirections"]))
        self.assertFalse(any(e["claim"]["subject"].get("fromPlayerId") == "p2"
                             for e in r["effects"]))
        self.assertFalse(any(w["actorPlayerId"] == "p2" for w in r["actorWitnesses"]))
        self.assertTrue(any(e["claim"]["subject"].get("fromPlayerId") == "p1"
                            and e["claim"]["decision"] == "QUALIFIED"
                            for e in r["effects"]))

    def test_ordered_original_ordinal_and_ambiguous_ordinals_fail_pending(self):
        b = case(kind="contest", contest=True)
        result = decisions(b)
        claim = next(e["claim"] for e in result["effects"]
                     if e["claim"]["decision"] == "QUALIFIED")
        self.assertEqual(claim["historicalPosition"]["recordingAtMs"], 11000)
        self.assertEqual(claim["historicalPosition"]["operationOrdinal"], 10)
        self.assertEqual(claim["historicalPosition"]["order"], "ORDERED")
        b["pair_observations"][0]["moment"]["operationOrdinal"] = None
        altered = decisions(b)
        self.assertFalse(any(e["claim"]["decision"] == "QUALIFIED" for e in altered["effects"]))
        self.assertEqual(altered["actorWitnesses"], [])
        self.assertTrue(any("SOURCE_ORDINAL_UNAVAILABLE_OR_AMBIGUOUS" in x["reasonCodes"]
                            for x in altered["inferences"]))
        self.assertTrue(all(e["claim"]["historicalPosition"]["order"] == "PARTIAL"
                            for e in altered["effects"]))
        b = case(kind="contest", contest=True)
        # Both events are now actor-owned TARGETED_COMMAND facets, not merely a
        # local opponent-overlap event, and claim the same source ordinal.
        b["pair_deeds"][0]["facets"].append({
            "kind": "TARGETED_COMMAND", "fromPlayerId": 1, "toPlayerId": 2,
            "sourceEventIds": ["cmd2"]})
        b["pair_observations"][1]["moment"]["atMs"] = 11000
        b["pair_observations"][1]["moment"]["operationOrdinal"] = 10
        altered = decisions(b)
        self.assertFalse(any(e["claim"]["decision"] == "QUALIFIED"
                             for e in altered["effects"]))
        contested = [e["claim"] for e in altered["effects"]
                     if e["claim"]["subject"]["track"] == "RIVALRY"
                     and e["claim"]["effect"] == "STRENGTHEN"]
        self.assertEqual(len(contested), 1)
        self.assertEqual(contested[0]["decision"], "PENDING")

    def test_actual_emitted_context_version_and_castle_are_not_social_proof(self):
        # This calls the actual merged context PROJECTOR, not a relabelled V1
        # dictionary. Once Worker 1's corrected V2 lands, CI automatically
        # exercises the authentic V2 serializer/consumer contract.
        b = case(kind="contest", contest=True, castle=True)
        self.assertEqual(b["context"]["version"], EMITTED_CONTEXT_VERSION)
        self.assertIn(EMITTED_CONTEXT_VERSION,
                      {"AOF_SOCIAL_V1_CONTEXT_V1", "AOF_SOCIAL_V1_CONTEXT_V2"})
        self.assertEqual(len(b["context"]["placementContexts"]), 1)
        castle = b["context"]["placementContexts"][0]["specialForwardCastle"]
        self.assertFalse(castle["operationEstablished"])
        self.assertFalse(castle["qualifies"])
        r = decisions(b)
        self.assertEqual(len([e for e in r["effects"] if e["claim"]["decision"] == "QUALIFIED"
                              and e["claim"]["subject"]["track"] == "CRUELTY"]), 0)
        self.assertEqual(len([e for e in r["effects"] if e["claim"]["decision"] == "QUALIFIED"
                              and e["claim"]["subject"]["track"] == "HOSTILITY"]), 0)
        self.assertFalse(any("CASTLE" in x["familyId"] for x in r["inferences"]))
        b["context"]["version"] = "AOF_SOCIAL_V1_CONTEXT_V3"
        with self.assertRaisesRegex(ValueError, "INCOMPATIBLE_CONTEXT"):
            decisions(b)

    def test_actual_context_v2_projector_acceptance(self):
        if EMITTED_CONTEXT_VERSION != "AOF_SOCIAL_V1_CONTEXT_V2":
            self.skipTest("Worker 1 corrected actual Context V2 is not merged")
        b = case(kind="contest", contest=True, castle=True)
        assert b["context"]["version"] == EMITTED_CONTEXT_VERSION
        castle = b["context"]["placementContexts"][0]["specialForwardCastle"]
        self.assertIn(castle["status"], ("PENDING", "NOT_QUALIFIED"))
        self.assertFalse(castle["qualifies"])
        self.assertFalse(castle["operationEstablished"])
        self.assertTrue(any(x["claim"]["decision"] == "QUALIFIED"
                            and x["claim"]["subject"]["track"] == "RIVALRY"
                            for x in decisions(b)["effects"]))
        # Castle placement and distance never become a distinct antagonism act.
        self.assertFalse(any(x["claim"]["decision"] == "QUALIFIED"
                             and x["claim"]["subject"]["track"] == "HOSTILITY"
                             for x in decisions(b)["effects"]))

    def test_python_qualifier_claim_reaches_javascript_historical_evaluator(self):
        """Cross-language #126 -> merged #139: ordered effect is allocatable,
        unknown ordinal remains pending; synthetic-only proposed simulation."""
        if not shutil.which("node"):
            self.skipTest("Node runtime not available for Python→JS handoff")
        b = case(kind="contest", contest=True)
        q = decisions(b)
        valid = [e for e in q["effects"] if e["claim"]["decision"] == "QUALIFIED"]
        self.assertEqual(len(valid), 1)
        subject = valid[0]["claim"]["subject"]
        self.assertEqual(subject["track"], "RIVALRY")
        self.assertEqual(valid[0]["claim"]["historicalPosition"]["operationOrdinal"], 10)
        payload = {
            "snapshot": b["snapshot"], "calibration": b["calibration"],
            "effects": valid, "actorWitnesses": q["actorWitnesses"],
        }
        script = """
import {evaluateHistory} from './functions/src/engines/socialV1History/history.js';
let input='';
for await (const part of process.stdin) input+=part;
const x=JSON.parse(input), policy=x.calibration.policy;
const R=['GALLANTRY','CRUELTY','CHIVALRY'], P=['RIVALRY','HOSTILITY','BOND'];
const stages={
 REPUTATION:Object.fromEntries(R.map(t=>[t,{up:[1,2,3],down:[1,1,1]}])),
 RELATIONSHIP:Object.fromEntries(P.map(t=>[t,{up:[1,2,3],down:[1,1,1],reciprocity:{3:1}}])),
};
const budgets={
 reputationBattle:Object.fromEntries(R.map(t=>[t,{STRENGTHEN:4,WEAKEN:4}])),
 relationshipEvent:Object.fromEntries(P.map(t=>[t,{STRENGTHEN:4,WEAKEN:4}])),
};
const claim=x.effects[0].claim, calibration={
 version:'SYNTHETIC_CROSS_LANGUAGE_ONLY',policy,stages,budgets,
 rules:{[claim.ruleId]:{system:claim.subject.system,track:claim.subject.track,
  effect:claim.effect,bands:{[claim.significanceBandId]:2}}},
 treachery:{consumptionUnits:0,maximumStage:3}
};
const s=x.snapshot, chapters=[{
 battleId:s.battleId,matchId:s.matchId,gameId:s.gameId,gameGuid:s.gameGuid,
 eventId:s.eventId,seasonId:s.seasonId,sourceAuthority:s.authorityRevision,
 revision:1,state:'READY',order:{event:1,battle:1,game:1,
 key:claim.historicalPosition.leagueOrderKey}
}];
const result=evaluateHistory({chapters,effects:x.effects,
 actorWitnesses:x.actorWitnesses,calibration});
const projection=result.projections.find(z=>z.subject.track==='RIVALRY');
console.log(JSON.stringify({stage:projection?.stage,status:projection?.status,
 pendingReasons:projection?.pendingReasons,
 audit:result.audit,receipts:result.receipts.length,
 officialWrites:result.officialWrites,simulation:result.simulation}));
"""
        proc = subprocess.run(["node", "--input-type=module", "-e", script],
            input=json.dumps(payload), text=True, capture_output=True,
            cwd=Path(__file__).resolve().parents[2], check=True)
        r = json.loads(proc.stdout)
        self.assertEqual(r["status"], "VERIFIED")
        self.assertEqual(r["stage"], 1)
        self.assertEqual(r["audit"], [])
        self.assertEqual(r["pendingReasons"], [])
        self.assertEqual(r["receipts"], 0)
        self.assertFalse(r["officialWrites"])
        self.assertTrue(r["simulation"]["receiptPublicationBlocked"])
        b["pair_observations"][0]["moment"]["operationOrdinal"] = None
        partial = decisions(b)
        self.assertFalse(any(e["claim"]["decision"] == "QUALIFIED"
                             for e in partial["effects"]))
        self.assertFalse(partial["actorWitnesses"])


if __name__ == "__main__":
    unittest.main()

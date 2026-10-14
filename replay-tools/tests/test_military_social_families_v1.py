"""Evidence families and restrained Chronicle: contract/adversarial tests."""
import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from military_social_families_v1 import (
    VERSION, EDITOR_VERSION, project_military_families, preview_chronicle_from_credits,
)
from test_statistics_social_bridge import statistics, chapter
from test_directional_episode_ledger import pressure, targeted, support, league


def military(facets=None, **options):
    stats = statistics(facets)
    if options.get("context"):
        stats = statistics(facets, context_enriched=True)
    if options.get("relation"):
        for row in stats["pairSocialEvidence"]["deeds"]:
            row["relationContext"] = options["relation"]
    return project_military_families(bridge_chapter=chapter(stats, options.get("league")))


def result(outcome="DUEL_WIN", *, owner="Alice", other="Bob", map_name="Lombardia"):
    return {"battleId": "M1", "ownerLeaguePlayerId": owner,
            "counterpartLeaguePlayerId": other, "mapName": map_name,
            "outcome": outcome}


def credit(families, *, track="RIVALRY", kind="RELATIONSHIP_PROGRESS", receipt_id="receipt-1"):
    claim = next(row for row in families["candidateClaims"] if row["track"] == track)
    return {"receiptId": receipt_id, "battleId": "M1", "ruleVersion": "EXTERNAL-QUALIFIER-R1",
            "status": "CREDITED", "kind": kind,
            "actorLeaguePlayerId": claim["fromLeaguePlayerId"],
            "counterpartLeaguePlayerId": claim["toLeaguePlayerId"],
            "claimId": claim["claimId"], "sourceEpisodeId": claim["sourceEpisodeId"],
            "track": track, "system": claim["system"]}


class ThreeFamiliesV1Tests(unittest.TestCase):
    def test_pressure_and_targeting_share_one_source_deed(self):
        projection = military([pressure(), targeted()])
        self.assertEqual(projection["modelVersion"], VERSION)
        self.assertEqual({row["family"] for row in projection["deeds"]},
                         {"RAIDS_PRESSURE", "CONTEST_COUNTERPLAY"})
        self.assertEqual(len({row["episodeId"] for row in projection["deeds"]}), 1)
        self.assertTrue(all(row["creditedEffect"] is False for row in projection["deeds"]))

    def test_pressure_creates_independent_qualified_track_candidates(self):
        projection = military([pressure()])
        claims = projection["candidateClaims"]
        self.assertEqual({(r["system"], r["track"]) for r in claims},
                         {("RELATIONSHIP", "RIVALRY"), ("REPUTATION", "GALLANTRY"),
                          ("REPUTATION", "CRUELTY")})
        self.assertTrue(all(r["status"] == "PENDING_QUALIFICATION" for r in claims))
        self.assertTrue(all(not r["meaningfulnessQualified"] and r["points"] is None for r in claims))
        self.assertIn("SUSTAINED_DISADVANTAGE_AT_ENTRY", next(r for r in claims if r["track"]=="CRUELTY")["unsatisfiedTrackQualifications"])
        self.assertFalse(any(r["track"] == "HOSTILITY" for r in claims))

    def test_gallantry_from_raids_and_contest_is_one_claim_per_deed(self):
        projection = military([pressure(), targeted()])
        gallantry = [r for r in projection["candidateClaims"] if r["track"] == "GALLANTRY"]
        self.assertEqual(len(gallantry), 1)
        self.assertEqual(gallantry[0]["families"], ["CONTEST_COUNTERPLAY", "RAIDS_PRESSURE"])
        self.assertIn("QUALIFIED_OFFENSIVE_SEMANTICS", gallantry[0]["unsatisfiedTrackQualifications"])

    def test_targeted_only_not_assumed_sufficient_to_actually_fight(self):
        projection = military([targeted()])
        self.assertIn("QUALIFIED_COMPETITIVE_ACTION_SEMANTICS",
                      next(r for r in projection["candidateClaims"] if r["track"] == "RIVALRY")["unsatisfiedTrackQualifications"])
        self.assertFalse(projection["policy"]["anyClaimQualifiedHere"])

    def test_local_overlap_stays_nondirectional(self):
        facet = {"kind":"LOCAL_COMMAND_OVERLAP", "contributorPlayerId":1,
                 "otherPlayerId":2, "sourceEventIds":["movement-a","movement-b"],
                 "targetedActionEstablished":False}
        projection=military([facet])
        self.assertEqual(len(projection["deeds"]),1)
        self.assertEqual(projection["candidateClaims"],[])
        self.assertEqual(projection["deeds"][0]["family"],"CONTEST_COUNTERPLAY")

    def test_shared_target_is_not_bond(self):
        facet = {"kind": "SHARED_OPPONENT_PARTICIPATION", "targetPlayerId":3,
                 "contributions": [{"contributorPlayerId":1,"sourceEventIds":["a"]},
                                   {"contributorPlayerId":2,"sourceEventIds":["b"]}],
                 "sourceEventIds":["a","b"]}
        projection=military([facet])
        self.assertEqual(projection["deeds"],[])
        self.assertEqual(projection["candidateClaims"],[])

    def test_assistance_requires_qualified_fixed_alliance(self):
        good=military([support()],relation="FIXED_ALLIES")
        self.assertEqual({r["track"] for r in good["candidateClaims"]},{"BOND","CHIVALRY"})
        self.assertEqual({(r["fromLeaguePlayerId"],r["toLeaguePlayerId"]) for r in good["candidateClaims"]},
                         {("Alice","Bob")})
        wrong=military([support()],relation="FIXED_OPPONENTS")
        self.assertEqual({r["status"] for r in wrong["candidateClaims"]},{"SOURCE_BLOCKED"})
        self.assertTrue(all("FIXED_ALIGNMENT_NOT_QUALIFIED_FOR_FAMILY" in r["sourceBlockers"] for r in wrong["candidateClaims"]))

    def test_assistance_does_not_gain_chivalry_merely_from_reinforcement(self):
        projection=military([support()],relation="FIXED_ALLIES")
        record=next(r for r in projection["candidateClaims"] if r["track"]=="CHIVALRY")
        self.assertIn("NOTEWORTHY_PROTECTION_OR_SUPPORT",record["unsatisfiedTrackQualifications"])
        self.assertFalse(record["creditedEffect"])

    def test_no_reverse_bond_and_no_hostility_or_reciprocity(self):
        projection=military([support()],relation="FIXED_ALLIES")
        self.assertNotIn("HOSTILITY",{r["track"] for r in projection["candidateClaims"]})
        self.assertEqual({(r["fromLeaguePlayerId"],r["toLeaguePlayerId"]) for r in projection["candidateClaims"]},
                         {("Alice","Bob")})
        self.assertTrue(all(r["reciprocityCredit"] is None for r in projection["candidateClaims"]))

    def test_reverse_targeting_is_two_directions_but_no_credit(self):
        projection=military([targeted("a-target",1,2),targeted("b-target",2,1)])
        self.assertEqual({(r["fromLeaguePlayerId"],r["toLeaguePlayerId"]) for r in projection["candidateClaims"]},
                         {("Alice","Bob"),("Bob","Alice")})
        self.assertTrue(all(r["reciprocityCredit"] is None for r in projection["candidateClaims"]))

    def test_pressure_response_context_does_not_forge_counterplay(self):
        projection=military([pressure()],context=True)
        self.assertEqual({r["fromLeaguePlayerId"] for r in projection["candidateClaims"]},{"Alice"})
        self.assertFalse(any(r["fromLeaguePlayerId"]=="Bob" and r["track"]=="RIVALRY" for r in projection["candidateClaims"]))

    def test_pending_event_or_unordered_battle_blocks_social_claims(self):
        pending=military([pressure()],league=league(eventBattleEligibility="PENDING", eventEligibilitySourceRef=None))
        self.assertTrue(all(r["status"]=="SOURCE_BLOCKED" for r in pending["candidateClaims"]))
        unordered=military([pressure()],league=league(battleOrder=None))
        self.assertEqual(unordered["candidateClaims"][0]["status"],"PENDING_QUALIFICATION")
        self.assertIn("CROSS_BATTLE_ORDER_NOT_SUPPLIED",unordered["candidateClaims"][0]["historyEvaluationBlockers"])

    def test_native_version_remains_supported(self):
        from test_statistics_social_bridge import statistics
        x=project_military_families(bridge_chapter=chapter(statistics(native=True)))
        self.assertEqual(x["modelVersion"],VERSION)

    def test_input_immutability_and_repeatability(self):
        b=chapter(statistics([pressure(),targeted()]))
        original=copy.deepcopy(b)
        self.assertEqual(project_military_families(bridge_chapter=b),project_military_families(bridge_chapter=b))
        self.assertEqual(b,original)

    def test_unsupported_bridge_fails_closed(self):
        with self.assertRaisesRegex(ValueError,"versioned"):
            project_military_families(bridge_chapter={"modelVersion":"fake"})

    def test_no_direct_statistic_sources_in_input(self):
        x=military([pressure()])
        self.assertTrue(x["policy"]["readOnly"])
        self.assertFalse(x["policy"]["liveScoringEnabled"])
        self.assertFalse(x["policy"]["sourceAndOfficialStatusAuthenticatedHere"])


class ChronicleEditorialTests(unittest.TestCase):
    def setUp(self):
        self.families=military([pressure(),targeted()])

    def test_ordinary_win_has_exactly_one_result_line_no_highlights(self):
        x=preview_chronicle_from_credits(families=self.families,battle_results=[result()])
        self.assertEqual(x["modelVersion"], EDITOR_VERSION)
        self.assertEqual(len(x["entries"]),1)
        self.assertEqual(x["entries"][0]["resultSentence"],"Alice defeated Bob on Lombardia.")
        self.assertIsNone(x["entries"][0]["highlightSentence"])
        self.assertEqual(x["entries"][0]["selectionReason"],"ORDINARY_BATTLE_RESULT_ONLY")

    def test_source_candidates_alone_never_make_long_chronicle(self):
        # Several detailed candidate qualifications, no progression receipt.
        x=preview_chronicle_from_credits(families=self.families,battle_results=[result()])
        self.assertFalse(x["entries"][0]["selectedReceiptId"])
        self.assertFalse(x["policy"]["rawStatisticCandidatesTriggerHighlights"])

    def test_one_valid_credit_produces_one_short_highlight(self):
        credit_row=credit(self.families)
        x=preview_chronicle_from_credits(families=self.families,battle_results=[result()],credited_receipts=[credit_row])
        self.assertEqual(x["entries"][0]["highlightSentence"],
                         "Alice's independently qualified contest with Bob deepened their rivalry.")
        self.assertEqual(x["entries"][0]["selectedReceiptId"],credit_row["receiptId"])
        self.assertFalse(x["entries"][0]["verifiedByProjection"])

    def test_two_credits_do_not_create_two_highlights_or_duplicate_deeds(self):
        reputation=credit(self.families,track="GALLANTRY",kind="REPUTATION_PROGRESS",receipt_id="r-rep")
        relationship=credit(self.families,track="RIVALRY",kind="RELATIONSHIP_PROGRESS",receipt_id="r-rel")
        x=preview_chronicle_from_credits(families=self.families,battle_results=[result()],credited_receipts=[reputation,relationship])
        e=x["entries"][0]
        self.assertEqual(e["selectedReceiptId"],"r-rel")
        self.assertEqual(e["suppressedForBrevityReceiptIds"],["r-rep"])
        self.assertEqual(set(x["preservedReceiptIds"]),{"r-rep","r-rel"})

    def test_identical_receipt_retries_do_not_duplicate_candidates(self):
        r=credit(self.families)
        x=preview_chronicle_from_credits(families=self.families,battle_results=[result()],
                                         credited_receipts=[r,copy.deepcopy(r)])
        self.assertEqual(x["preservedReceiptIds"],[r["receiptId"]])
        self.assertEqual(x["entries"][0]["suppressedForBrevityReceiptIds"],[])

    def test_conflicting_receipt_revisions_are_refused(self):
        r=credit(self.families)
        other={**r,"ruleVersion":"EXTERNAL-R2"}
        with self.assertRaisesRegex(ValueError,"Conflicting"):
            preview_chronicle_from_credits(families=self.families,battle_results=[result()],
                                           credited_receipts=[r,other])

    def test_stale_acknowledgment_revision_is_not_displayed(self):
        a={"receiptId":"ack-1","battleId":"M1","ruleVersion":"qualifier-r1",
           "status":"CREDITED","kind":"QUALIFIED_ACKNOWLEDGMENT",
           "actorLeaguePlayerId":"Alice","counterpartLeaguePlayerId":"Bob",
           "judgmentIncidentId":"incident-1","visibility":"LEAGUE_VISIBLE",
           "judgmentGameId":"G1", "judgmentSourceRevision":{"replaySha256":"stale"}}
        with self.assertRaisesRegex(ValueError,"stale or unlinked"):
            preview_chronicle_from_credits(families=self.families,battle_results=[result()],
                                           credited_receipts=[a])

    def test_stage_change_takes_priority_over_small_progress(self):
        r1=credit(self.families,kind="RELATIONSHIP_STAGE_CHANGE",receipt_id="stage")
        r2=credit(self.families,track="GALLANTRY",kind="REPUTATION_PROGRESS",receipt_id="rep")
        x=preview_chronicle_from_credits(families=self.families,battle_results=[result()],credited_receipts=[r1,r2])
        self.assertEqual(x["entries"][0]["selectedReceiptId"],"stage")

    def test_team_result_does_not_claim_direct_player_duel(self):
        x=preview_chronicle_from_credits(families=self.families,
            battle_results=[result("TEAM_WIN_AGAINST")])
        self.assertEqual(x["entries"][0]["resultSentence"],"Alice's side defeated Bob's on Lombardia.")

    def test_allied_win_is_not_defeating_ally(self):
        x=preview_chronicle_from_credits(families=self.families,battle_results=[result("ALLY_WIN")])
        self.assertEqual(x["entries"][0]["resultSentence"],"Alice and Bob won together on Lombardia.")

    def test_unlinked_or_uncredited_receipt_is_rejected(self):
        fake=credit(self.families)
        fake["status"]="PENDING"
        with self.assertRaisesRegex(ValueError,"Only credited"):
            preview_chronicle_from_credits(families=self.families,battle_results=[result()],credited_receipts=[fake])
        fake=credit(self.families)
        fake["claimId"]="stale-claim"
        with self.assertRaisesRegex(ValueError,"current source claim"):
            preview_chronicle_from_credits(families=self.families,battle_results=[result()],credited_receipts=[fake])

    def test_blocked_source_cannot_be_credited(self):
        blocked=military([pressure()],league=league(eventBattleEligibility="PENDING",eventEligibilitySourceRef=None))
        receipt=credit(blocked)
        with self.assertRaisesRegex(ValueError,"Blocked source or history"):
            preview_chronicle_from_credits(families=blocked,battle_results=[result()],credited_receipts=[receipt])

    def test_private_acknowledgment_cannot_be_promoted_to_public_prose(self):
        a={"receiptId":"ack-1","battleId":"M1","ruleVersion":"qualifier-r1",
           "status":"CREDITED","kind":"QUALIFIED_ACKNOWLEDGMENT",
           "actorLeaguePlayerId":"Alice","counterpartLeaguePlayerId":"Bob",
           "judgmentIncidentId":"incident-1","visibility":"PRIVATE",
           "judgmentGameId":"G1", "judgmentSourceRevision":self.families["sourceRevision"]}
        with self.assertRaisesRegex(ValueError,"Private, stale or unlinked"):
            preview_chronicle_from_credits(families=self.families,battle_results=[result()],credited_receipts=[a])
        a["visibility"]="LEAGUE_VISIBLE"
        a["acknowledgmentKind"]="SKILL_SUPERIORITY"
        x=preview_chronicle_from_credits(families=self.families,battle_results=[result()],credited_receipts=[a])
        self.assertEqual(x["entries"][0]["highlightSentence"],
                         "Alice formally acknowledged Bob's superior skill.")

    def test_missing_result_or_duplicate_pair_battle_rejected(self):
        with self.assertRaisesRegex(ValueError,"no official-result"):
            preview_chronicle_from_credits(families=self.families,battle_results=[],credited_receipts=[credit(self.families)])
        with self.assertRaisesRegex(ValueError,"Duplicate pair"):
            preview_chronicle_from_credits(families=self.families,battle_results=[result(),result()])

    def test_missing_historical_order_preserves_source_candidate_but_prevents_credit(self):
        missing=military([pressure()],league=league(battleOrder=None))
        self.assertEqual(missing["candidateClaims"][0]["status"],"PENDING_QUALIFICATION")
        with self.assertRaisesRegex(ValueError,"Blocked source or history"):
            preview_chronicle_from_credits(families=missing,battle_results=[result()],
                                           credited_receipts=[credit(missing)])

    def test_reputation_credit_is_personal_not_echoed_on_counterpart_page(self):
        receipt=credit(self.families,track="GALLANTRY",kind="REPUTATION_PROGRESS")
        x=preview_chronicle_from_credits(families=self.families,
                                         battle_results=[result(owner="Bob",other="Alice",outcome="DUEL_LOSS")],
                                         credited_receipts=[receipt])
        self.assertIsNone(x["entries"][0]["highlightSentence"])
        self.assertEqual(x["preservedReceiptIds"],[receipt["receiptId"]])

    def test_chronicle_sources_do_not_authorize_live_publication(self):
        x=preview_chronicle_from_credits(families=self.families,battle_results=[result()])
        self.assertFalse(x["policy"]["liveChroniclePublicationEnabled"])
        self.assertFalse(x["policy"]["independentHistoricalCreditAuthorityVerifiedHere"])


if __name__ == "__main__":
    unittest.main()
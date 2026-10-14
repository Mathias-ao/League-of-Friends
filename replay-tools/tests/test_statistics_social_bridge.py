"""Statistics -> Reputation/Relationship/Chronicle bridge, adversarial contract suite."""
import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from statistics_social_bridge import (
    VERSION, project_statistics_social_chapter, project_statistics_social_history,
)
from test_directional_episode_ledger import (
    fixture, league, pressure, targeted, support, context,
)


def statistics(facets=None, *, native=False, context_enriched=False):
    raw = fixture(facets if facets is not None else [pressure(), targeted()])
    if facets == []:
        raw["deeds"], raw["incidents"], raw["observations"] = [], [], []
    if native:
        source = {
            "replaySha256": "a" * 64,
            "recordedEventsSha256": "c" * 64,
            "recordedEventsVersion": "AOF_RECORDED_EVENTS_V1",
            "parserVersion": "fixture", "extractionRunId": "native-r1",
        }
        raw["source"] = copy.deepcopy(source)
        raw["gameScope"] = copy.deepcopy(source)
    else:
        source = {**raw["source"], "extractionRunId": "canonical-r1"}
    if context_enriched:
        raw["episodeContext"] = context(raw, annotations=[{
            "contextId": "context-1", "family": "DEFENSIVE_SUPPORT_WITH_PRESSURE",
            "supportDeedId": raw["deeds"][0]["deedId"],
            "sourceEventIds": ["help-a", "pressure-other"],
        }])
    return {
        "statisticsProjectionVersion": ("AOF_RECORDED_EVENTS_STATISTICS_V1" if native
                                        else "AOF_CANONICAL_STATISTICS_V1"),
        "source": source,
        "participants": [{"playerId": player} for player in [1, 2, 3]],
        "matchFacts": {
            "modelVersion": "AOF_RECORDING_MATCH_FACTS_V1",
            "identityNamespace": "CANONICAL_REPLAY_PLAYER_ID",
            "source": copy.deepcopy(source),
            "players": [{"playerId": player} for player in [1, 2, 3]],
            "game": {"observedDurationMs": 120000},
            "result": {"qualification": "UNRESOLVED"},
        },
        "pairSocialEvidence": raw,
        "commandEvidence": {"directedDiplomacyCommands": {}},
        "scope": {"clock": "RECORDING_OBSERVED"},
    }


def chapter(stats=None, ctx=None):
    return project_statistics_social_chapter(
        statistics=stats or statistics(), league_context=ctx or league())


def current(stats=None, *, ctx=None, accepted=True):
    return {"accepted": accepted, "leagueContext": ctx or league(),
            "statistics": stats or statistics()}


class StatisticsSocialBridgeContract(unittest.TestCase):
    def test_actual_statistics_shape_connects_all_three_consumers(self):
        stats = statistics()
        untouched = copy.deepcopy(stats)
        result = chapter(stats)
        self.assertEqual(stats, untouched)
        self.assertEqual(result["modelVersion"], VERSION)
        self.assertEqual(len(result["directionalLedger"]["episodes"]), 1)
        self.assertEqual(len(result["relationshipReview"]), 1)
        self.assertEqual(result["relationshipReview"][0]["trackForIndependentQualification"], "RIVALRY")
        self.assertEqual(result["reputationReview"][0]["trackForIndependentQualification"], "CRUELTY")
        self.assertEqual(result["reputationReview"][1]["trackForIndependentQualification"], "GALLANTRY")
        self.assertEqual(len(result["chronicleFacts"]), 1)
        entry = result["chronicleFacts"][0]
        self.assertEqual(len(entry["reputationReviewIds"]), 2)
        self.assertEqual(len(entry["relationshipReviewIds"]), 1)
        self.assertFalse(entry["playerFeelingKnown"])
        self.assertTrue(entry["factsOnly"])

    def test_reputation_and_relationship_do_not_share_authority_or_scores(self):
        result = chapter()
        self.assertEqual({r["trackForIndependentQualification"] for r in result["reputationReview"]},
                         {"CRUELTY", "GALLANTRY"})
        self.assertEqual({r["trackForIndependentQualification"] for r in result["relationshipReview"]},
                         {"RIVALRY"})
        for r in result["reputationReview"]:
            self.assertFalse(r["reputationEffectQualified"])
            self.assertIsNone(r["points"])
            self.assertTrue(r["missingQualifications"])
        for r in result["relationshipReview"]:
            self.assertFalse(r["reciprocityCreditQualified"])
            self.assertIsNone(r["stage"])
        self.assertFalse(any(result["policy"][k] for k in (
            "reputationScoringEnabled", "relationshipScoringEnabled",
            "chroniclePublicationEnabled", "bindingPlayerJudgmentsEnabled",
            "warRoomEffectsEnabled")))

    def test_support_is_directional_without_reverse_bond_or_reputation_copy(self):
        result = chapter(statistics([support()]))
        self.assertEqual([(r["fromLeaguePlayerId"], r["toLeaguePlayerId"],
                           r["trackForIndependentQualification"]) for r in result["relationshipReview"]],
                         [("Alice", "Bob", "BOND")])
        self.assertEqual([(r["actorLeaguePlayerId"], r["counterpartLeaguePlayerId"],
                           r["trackForIndependentQualification"]) for r in result["reputationReview"]],
                         [("Alice", "Bob", "CHIVALRY")])

    def test_one_episode_with_multiple_commands_remains_one_deed(self):
        raw = statistics([pressure("a"), pressure("b"), targeted("b")])
        result = chapter(raw)
        self.assertEqual(len(result["chronicleFacts"]), 1)
        self.assertEqual(len(result["relationshipReview"]), 1)
        self.assertEqual(result["relationshipReview"][0]["sourceEventIds"], ["a", "b"])
        self.assertEqual(len(result["reputationReview"]), 2)

    def test_real_reverse_action_is_independent_not_fake_reciprocity(self):
        result = chapter(statistics([targeted("a", 1, 2), targeted("b", 2, 1)]))
        self.assertEqual({(r["fromLeaguePlayerId"], r["toLeaguePlayerId"])
                          for r in result["relationshipReview"]},
                         {("Alice", "Bob"), ("Bob", "Alice")})
        self.assertFalse(any(r["reciprocityCreditQualified"] for r in result["relationshipReview"]))

    def test_local_overlap_never_becomes_an_attack_grievance_or_bravery(self):
        overlap = {"kind": "LOCAL_COMMAND_OVERLAP", "contributorPlayerId": 1,
                   "otherPlayerId": 2, "sourceEventIds": ["movement-a", "movement-b"],
                   "targetedActionEstablished": False}
        result = chapter(statistics([overlap]))
        self.assertEqual(result["relationshipReview"], [])
        self.assertEqual(result["reputationReview"], [])
        self.assertEqual(len(result["chronicleFacts"]), 1)
        self.assertEqual(result["chronicleFacts"][0]["sourceEvidenceKinds"], ["LOCAL_COMMAND_OVERLAP"])

    def test_common_target_never_creates_teamwide_bond_or_chivalry(self):
        facet = {"kind": "SHARED_OPPONENT_PARTICIPATION", "targetPlayerId": 3,
                 "contributions": [{"contributorPlayerId": 1, "sourceEventIds": ["a"]},
                                   {"contributorPlayerId": 2, "sourceEventIds": ["b"]}],
                 "sourceEventIds": ["a", "b"]}
        result = chapter(statistics([facet]))
        self.assertEqual(result["relationshipReview"], [])
        self.assertEqual(result["reputationReview"], [])
        self.assertEqual(result["chronicleFacts"][0]["pairLeaguePlayerIds"], ["Alice", "Bob"])

    def test_native_recorded_events_statistics_use_distinct_source_contract(self):
        result = chapter(statistics(native=True))
        self.assertTrue(result["sourceModels"]["recordedEvents"])
        self.assertEqual(result["sourceRevision"]["recordedEventsVersion"], "AOF_RECORDED_EVENTS_V1")
        self.assertNotIn("canonicalManifestSha256", result["sourceRevision"])

    def test_missing_or_mismatched_match_facts_provenance_rejected(self):
        stats = statistics()
        del stats["matchFacts"]
        with self.assertRaisesRegex(ValueError, "match facts"):
            chapter(stats)
        stats = statistics()
        stats["matchFacts"]["source"]["replaySha256"] = "f" * 64
        with self.assertRaisesRegex(ValueError, "revision mismatch"):
            chapter(stats)

    def test_roster_revision_and_duration_corruptions_fail_closed(self):
        stats = statistics()
        stats["participants"].pop()
        with self.assertRaisesRegex(ValueError, "identities disagree"):
            chapter(stats)
        stats = statistics()
        stats["pairSocialEvidence"]["gameScope"]["replaySha256"] = "b" * 64
        with self.assertRaisesRegex(ValueError, "revision mismatch"):
            chapter(stats)
        stats = statistics()
        stats["matchFacts"]["game"]["observedDurationMs"] = 1
        with self.assertRaisesRegex(ValueError, "outside observed"):
            chapter(stats)

    def test_ambiguous_canonical_and_native_sources_fail_closed(self):
        stats = statistics()
        stats["source"]["recordedEventsVersion"] = "AOF_RECORDED_EVENTS_V1"
        stats["source"]["recordedEventsSha256"] = "c" * 64
        with self.assertRaisesRegex(ValueError, "Ambiguous"):
            chapter(stats)

    def test_unconfigured_policy_no_false_positive_from_known_undecoded_commands(self):
        stats = statistics([])
        stats["commandEvidence"]["tributeCommands"] = [{"targetPlayerId": 2, "resource": "food"}]
        stats["commandEvidence"]["directedDiplomacyCommands"] = {"1->2": [{"diplomacyMode": "ENEMY"}]}
        result = chapter(stats)
        self.assertEqual(result["reputationReview"], [])
        self.assertEqual(result["relationshipReview"], [])
        self.assertEqual(result["chronicleFacts"], [])

    def test_warmup_non_scoring_does_not_suppress_event_evidence(self):
        ctx = league(eventBattleEligibility="ELIGIBLE")
        ctx["affectsLifetimeStats"] = False
        ctx["affectsSeasonStats"] = False
        result = chapter(ctx=ctx)
        self.assertTrue(result["chronicleFacts"])
        self.assertEqual(result["readiness"]["eventEvidenceEligibility"], "ELIGIBLE")
        self.assertNotIn("affectsLifetimeStats", result["leagueContext"])

    def test_empty_evidence_no_claim_of_absence_or_peace(self):
        result = chapter(statistics([]))
        self.assertEqual(result["chronicleFacts"], [])
        self.assertEqual(result["relationshipReview"], [])
        self.assertFalse(result["directionalLedger"]["coverage"]["absenceQualified"])

    def test_selected_corrections_replace_old_evidence_not_double_count(self):
        old = current()
        new = current(statistics([support()]), ctx=league(chapterRevision=2, resultRevision=2))
        x = project_statistics_social_history(chapters=[old, new])
        y = project_statistics_social_history(chapters=[new, old])
        self.assertEqual(x, y)
        self.assertEqual(len(x["chronicleFacts"]), 1)
        self.assertEqual([r["trackForIndependentQualification"] for r in x["relationshipReview"]], ["BOND"])
        self.assertEqual(x["activeGameChapters"][0]["leagueContext"]["chapterRevision"], 2)
        self.assertEqual(len(x["chronicleOpportunityDesign"]["moments"]), 0)

    def test_revision_tombstone_removes_evidence_without_needing_old_source(self):
        tombstone = {"accepted": False,
                     "leagueContext": {"matchId": "M1", "gameId": "G1", "chapterRevision": 2}}
        result = project_statistics_social_history(chapters=[current(), tombstone])
        self.assertEqual(result["chronicleFacts"], [])
        self.assertEqual(result["relationshipReview"], [])
        self.assertEqual(result["withdrawnGames"], [{"matchId": "M1", "gameId": "G1", "chapterRevision": 2}])

    def test_duplicate_identical_revision_is_idempotent(self):
        item = current()
        expected = project_statistics_social_history(chapters=[item])
        self.assertEqual(project_statistics_social_history(chapters=[item, copy.deepcopy(item)]), expected)

    def test_conflicting_same_revision_and_acceptance_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "Conflicting Game revision"):
            project_statistics_social_history(chapters=[current(), current(statistics([support()]))])
        tombstone = {"accepted": False,
                     "leagueContext": {"matchId": "M1", "gameId": "G1", "chapterRevision": 1}}
        with self.assertRaisesRegex(ValueError, "Conflicting Game revision"):
            project_statistics_social_history(chapters=[current(), tombstone])

    def test_battle_game_order_is_not_timestamps_or_processing_arrival(self):
        one = current(ctx=league(matchId="M1", battleId="B1", gameId="G1", battleOrder=2))
        two = current(ctx=league(matchId="M2", battleId="B2", gameId="G2", battleOrder=1))
        result = project_statistics_social_history(chapters=[one, two])
        self.assertEqual([r["battleId"] for r in result["chronicleFacts"]], ["B2", "B1"])
        self.assertTrue(result["coverage"]["historyOrderInputComplete"])
        self.assertFalse(result["coverage"]["historyOrderAuthenticated"])

    def test_missing_and_conflicting_history_order_marked_pending(self):
        one = current(ctx=league(battleOrder=None))
        result = project_statistics_social_history(chapters=[one])
        self.assertIn("BATTLE_ORDER_UNAVAILABLE", result["coverage"]["blockingReasons"])
        two = current(ctx=league(matchId="M2", battleId="B2", gameId="G2", battleOrder=1))
        three = current(ctx=league(matchId="M3", battleId="B3", gameId="G3", battleOrder=1))
        result = project_statistics_social_history(chapters=[two, three])
        self.assertIn("CONFLICTING_BATTLE_ORDER", result["coverage"]["blockingReasons"])

    def test_context_enriched_support_connects_only_to_private_chronicle_candidate(self):
        stats = statistics([{"kind": "DEFENSIVE_PARTICIPATION", "fromPlayerId": 1,
                             "toPlayerId": 2, "sourceEventIds": ["help-a"]}], context_enriched=True)
        result = project_statistics_social_history(chapters=[current(stats)])
        moments = result["chronicleOpportunityDesign"]["moments"]
        self.assertEqual(len(moments), 1)
        self.assertEqual((moments[0]["respondentLeaguePlayerId"],
                          moments[0]["counterpartLeaguePlayerId"]), ("Bob", "Alice"))
        self.assertFalse(moments[0]["questionsDisplayedToPlayer"])
        self.assertEqual(result["reputationReview"][0]["trackForIndependentQualification"], "CHIVALRY")
        self.assertFalse(result["reputationReview"][0]["reputationEffectQualified"])

    def test_no_synthetic_treachery_from_hostility_or_ordinary_pressure(self):
        result = project_statistics_social_history(chapters=[current()])
        self.assertEqual(result["chronicleOpportunityDesign"]["moments"], [])
        self.assertFalse(any(r["trackForIndependentQualification"] == "HOSTILITY"
                             for r in result["relationshipReview"]))

    def test_history_output_references_current_review_ids_not_stale_sources(self):
        new = current(statistics([support()]), ctx=league(chapterRevision=2))
        output = project_statistics_social_history(chapters=[current(), new])
        archive = output["chronicleFacts"][0]
        ids = {row["reviewId"] for row in output["reputationReview"] + output["relationshipReview"]}
        self.assertTrue(set(archive["reputationReviewIds"] + archive["relationshipReviewIds"]).issubset(ids))
        self.assertFalse(archive["historicalOrderVerifiedByBridge"])

    def test_review_blocks_if_event_eligibility_or_chronology_is_unverified(self):
        pending = chapter(ctx=league(eventBattleEligibility="PENDING",
                                     eventEligibilitySourceRef=None))
        self.assertEqual(pending["relationshipReview"][0]["reviewStatus"], "BLOCKED")
        self.assertIn("EVENT_BATTLE_ELIGIBILITY_NOT_VERIFIED",
                      pending["relationshipReview"][0]["evidenceBlockers"])
        raw = statistics()
        raw["pairSocialEvidence"]["incidents"][0]["chronologyCoverage"] = "UNAVAILABLE"
        raw["pairSocialEvidence"]["deeds"][0]["startedAt"]["operationOrdinal"] = None
        raw["pairSocialEvidence"]["deeds"][0]["endedAt"]["operationOrdinal"] = None
        unordered = chapter(raw)
        self.assertEqual(unordered["reputationReview"][0]["reviewStatus"], "BLOCKED")
        self.assertIn("SOURCE_INCIDENT_CHRONOLOGY_UNAVAILABLE",
                      unordered["reputationReview"][0]["evidenceBlockers"])
        self.assertTrue(unordered["chronicleFacts"][0]["factsOnly"])

    def test_binding_and_revision_provenance_attached_to_each_review(self):
        result = chapter()
        for row in result["relationshipReview"] + result["reputationReview"] + result["chronicleFacts"]:
            self.assertEqual(row["sourceRevision"]["replaySha256"], "a" * 64)
            self.assertEqual(row["chapterRevision"], 1)
            self.assertEqual(row["playerMappingRevision"], "binding-1")
            self.assertEqual(row["resultRevision"], 1)
            self.assertEqual(row["sourceDeedId"], "deed-1")

    def test_superseded_corrupt_source_not_read_into_current_history(self):
        old = current()
        old["statistics"]["source"]["replaySha256"] = "INVALID"
        next_revision = current(statistics([support()]), ctx=league(chapterRevision=2))
        result = project_statistics_social_history(chapters=[old, next_revision])
        self.assertEqual(result["relationshipReview"][0]["trackForIndependentQualification"], "BOND")
        self.assertEqual(len(result["chronicleFacts"]), 1)

    def test_old_review_does_not_survive_a_source_revision_correction(self):
        from test_chronicle_judgment_opportunities import review
        previous = chapter()
        stale = review(previous["directionalLedger"], "SITUATED_ANTAGONISM_PERCEPTION",
                       respondent="Bob", counterpart="Alice",
                       circumstanceSourceRefs=["reviewed-circumstance:1"])
        updated = current(statistics([support()]), ctx=league(chapterRevision=2))
        with self.assertRaises(ValueError):
            project_statistics_social_history(chapters=[current(), updated], reviewed_cases=[stale])

    def test_extraction_run_mismatch_in_match_facts_is_rejected(self):
        stats = statistics()
        stats["matchFacts"]["source"]["extractionRunId"] = "other-run"
        with self.assertRaisesRegex(ValueError, "source revision mismatch"):
            chapter(stats)

    def test_unmapped_pair_is_excluded_not_claimed_neutral(self):
        result = chapter(ctx=league(playerMapping=[
            {"replayPlayerId": 1, "leaguePlayerId": "Alice"},
            {"replayPlayerId": 3, "leaguePlayerId": "Cara"},
        ]))
        self.assertEqual(result["readiness"]["unmappedEpisodes"], 1)
        self.assertEqual(result["relationshipReview"], [])
        self.assertEqual(result["reputationReview"], [])
        self.assertEqual(result["chronicleFacts"], [])

    def test_chronicle_preview_can_flow_to_private_local_interaction_draft(self):
        from chronicle_interaction_draft import project_private_chronicle_interaction
        stats = statistics([{"kind": "DEFENSIVE_PARTICIPATION", "fromPlayerId": 1,
                             "toPlayerId": 2, "sourceEventIds": ["help-a"]}], context_enriched=True)
        result = project_statistics_social_history(chapters=[current(stats)])
        draft = project_private_chronicle_interaction(
            moment_design=result["chronicleOpportunityDesign"],
            viewer_league_player_id="Bob")
        other_player = project_private_chronicle_interaction(
            moment_design=result["chronicleOpportunityDesign"],
            viewer_league_player_id="Alice")
        self.assertEqual(len(draft["moments"]), 1)
        self.assertEqual(other_player["moments"], [])
        self.assertEqual(draft["moments"][0]["renderStatus"], "DEMO_INTERACTION_AVAILABLE")
        self.assertFalse(draft["policy"]["serverSideAuthorizationPerformed"])
        self.assertFalse(draft["policy"]["bindingJudgmentEnabled"])

    def test_editorial_narrative_only_is_not_a_player_question(self):
        from test_chronicle_moment_design import theme_case
        stats = statistics()
        source = chapter(stats)["directionalLedger"]
        editorial = theme_case(source, family="EARNED_RESPECT", intent="NARRATIVE_ONLY")
        result = project_statistics_social_history(
            chapters=[current(stats)], reviewed_moments=[editorial])
        self.assertEqual(len(result["chronicleOpportunityDesign"]["moments"]), 1)
        moment = result["chronicleOpportunityDesign"]["moments"][0]
        self.assertEqual(moment["family"], "EARNED_RESPECT")
        self.assertIsNone(moment["proposedQuestion"])
        self.assertFalse(moment["submissionEnabled"])
        self.assertFalse(moment["relationshipEffectQualified"])

    def test_invalid_native_version_fails_before_source_claims(self):
        stats = statistics(native=True)
        stats["source"]["recordedEventsVersion"] = "AOF_RECORDED_EVENTS_V1_EXPERIMENTAL"
        with self.assertRaisesRegex(ValueError, "Recorded Events source/projection"):
            chapter(stats)


if __name__ == "__main__":
    unittest.main()
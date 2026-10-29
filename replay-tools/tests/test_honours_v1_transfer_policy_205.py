"""Non-production reference scenarios for the 29 October FC trophy design.

All numbers, sample maturity flags, names and timestamps below are fictional
test fixtures, NOT owner-approved tier/maturity/performance thresholds or
grant instructions. The pure reference projector is deliberately local to this
test file and cannot seed or publish an award.
"""
from __future__ import annotations

import unittest
from dataclasses import dataclass


@dataclass(frozen=True)
class ExampleGame:
    game_id: str
    battle_id: str
    player: str
    fc_ms: int
    map_name: str
    civilization: str
    opportunity: str = "standard_start"
    metric_version: str = "AOF_OPENING_STATISTICS_V6"
    current_accepted: bool = True
    timing_observed: bool = True
    exceptional_time_passed: bool = True


def reference_projection(
    games: list[ExampleGame], *, maturity_approved: bool,
    prior_holder: str | None = None,
) -> tuple[tuple[str, ...], str | None, str]:
    """Illustrative source-ledger reduction; not wired to AoF runtime."""
    admissible = [
        g for g in games
        if g.current_accepted and g.timing_observed
        and g.opportunity == "standard_start"
        and g.metric_version == "AOF_OPENING_STATISTICS_V6"
    ]
    # POVs of one canonical Game must never create independent observations.
    by_game: dict[str, ExampleGame] = {}
    for g in admissible:
        existing = by_game.get(g.game_id)
        if existing is None:
            by_game[g.game_id] = g
        else:
            assert existing == g, "Different evidence for same Game needs authority resolution"
    valid = list(by_game.values())
    if not valid:
        return (), None, "NO_QUALIFIED_RECORD"
    best = min(g.fc_ms for g in valid)
    tied = [g for g in valid if g.fc_ms == best]
    holders = tuple(sorted({g.player for g in tied}))
    if not maturity_approved:
        return holders, None, "PENDING_MATURITY"
    if not all(g.exceptional_time_passed for g in tied):
        return holders, None, "PENDING_ABSOLUTE_PERFORMANCE"
    if len(holders) == 1:
        return holders, holders[0], "CURRENT_POSSESSION"
    if prior_holder in holders:
        return holders, prior_holder, "TIED_RECORD_NO_STRICT_TRANSFER"
    return holders, None, "PENDING_TIE_POLICY"


class TransferableFastCastleTrophyPolicyTests(unittest.TestCase):
    def test_three_challengers_transfer_in_season_and_equal_time_does_not(self) -> None:
        alice = ExampleGame("g-a", "b-a", "Alice", 15 * 60000 + 12000,
                            "Arabia", "Franks")
        bruno = ExampleGame("g-b", "b-b", "Bruno", 14 * 60000 + 58000,
                            "Gold Rush", "Britons")
        clara = ExampleGame("g-c", "b-c", "Clara", 14 * 60000 + 46000,
                            "Arabia", "Mayans")
        self.assertEqual(reference_projection([alice], maturity_approved=False),
                         (("Alice",), None, "PENDING_MATURITY"))
        self.assertEqual(reference_projection([alice], maturity_approved=True),
                         (("Alice",), "Alice", "CURRENT_POSSESSION"))
        self.assertEqual(reference_projection([alice, bruno], maturity_approved=True,
                                              prior_holder="Alice"),
                         (("Bruno",), "Bruno", "CURRENT_POSSESSION"))
        self.assertEqual(reference_projection([alice, bruno, clara],
                                              maturity_approved=True,
                                              prior_holder="Bruno"),
                         (("Clara",), "Clara", "CURRENT_POSSESSION"))
        tied = ExampleGame("g-b2", "b-d", "Bruno", clara.fc_ms,
                           "Acropolis", "Byzantines")
        self.assertEqual(reference_projection([alice, bruno, clara, tied],
                                              maturity_approved=True,
                                              prior_holder="Clara"),
                         (("Bruno", "Clara"), "Clara",
                          "TIED_RECORD_NO_STRICT_TRANSFER"))

    def test_initial_tie_with_no_incumbent_is_not_arbitrarily_awarded(self) -> None:
        a = ExampleGame("g-a", "b-a", "Alice", 920000, "Arabia", "Franks")
        b = ExampleGame("g-b", "b-b", "Bruno", 920000, "Arabia", "Goths")
        self.assertEqual(reference_projection([a, b], maturity_approved=True),
                         (("Alice", "Bruno"), None, "PENDING_TIE_POLICY"))
        self.assertEqual(reference_projection([a, b], maturity_approved=True,
                                              prior_holder="Alice"),
                         (("Alice", "Bruno"), "Alice",
                          "TIED_RECORD_NO_STRICT_TRANSFER"))
        c = ExampleGame("g-c", "b-c", "Clara", 919000, "Arabia", "Celts")
        self.assertEqual(reference_projection([a, b, c], maturity_approved=True),
                         (("Clara",), "Clara", "CURRENT_POSSESSION"))

    def test_special_starts_mixed_model_and_unproven_age_cannot_challenge(self) -> None:
        a = ExampleGame("g-a", "b-a", "Alice", 912000, "Arabia", "Franks")
        nomad = ExampleGame("g-n", "b-n", "Nomad", 760000, "Nomad", "Huns",
                            opportunity="nomad")
        migration = ExampleGame("g-m", "b-m", "Migration", 740000,
                                "Migration", "Persians", opportunity="migration")
        wrong_model = ExampleGame("g-v", "b-v", "OtherVersion", 730000,
                                  "Arabia", "Mongols", metric_version="INCOMPATIBLE")
        cancelled = ExampleGame("g-x", "b-x", "Cancelled", 700000,
                                "Arabia", "Lithuanians", timing_observed=False)
        self.assertEqual(reference_projection(
            [a, nomad, migration, wrong_model, cancelled],
            maturity_approved=True, prior_holder="Alice"
        ), (("Alice",), "Alice", "CURRENT_POSSESSION"))

    def test_source_corrections_restore_rightful_holder_without_false_history(self) -> None:
        a = ExampleGame("g-a", "b-a", "Alice", 912000, "Arabia", "Franks")
        b = ExampleGame("g-b", "b-b", "Bruno", 898000, "Arabia", "Britons")
        c = ExampleGame("g-c", "b-c", "Clara", 886000, "Arabia", "Celts")
        self.assertEqual(reference_projection([a, b, c], maturity_approved=True,
                                              prior_holder="Bruno")[1], "Clara")
        b_withdrawn = ExampleGame(**{**b.__dict__, "current_accepted": False})
        self.assertEqual(reference_projection([a, b_withdrawn, c],
                                              maturity_approved=True,
                                              prior_holder="Clara")[1], "Clara")
        c_corrected = ExampleGame(**{**c.__dict__, "current_accepted": False})
        self.assertEqual(reference_projection([a, b_withdrawn, c_corrected],
                                              maturity_approved=True,
                                              prior_holder="Clara"),
                         (("Alice",), "Alice", "CURRENT_POSSESSION"))

    def test_one_battle_multiple_games_and_duplicate_povs_not_extra_maturity(self) -> None:
        g1 = ExampleGame("g-a", "one-battle", "Alice", 930000, "Arabia", "Franks")
        g2 = ExampleGame("g-b", "one-battle", "Alice", 920000, "Arabia", "Franks")
        duplicate_pov = g2
        independent_battles = {g.battle_id for g in [g1, g2, duplicate_pov]}
        self.assertEqual(len(independent_battles), 1)
        self.assertEqual(reference_projection([g1, g2, duplicate_pov],
                                              maturity_approved=False),
                         (("Alice",), None, "PENDING_MATURITY"))
        # The maturity gate remains external and unapproved, never inferred
        # from "3 games" / three POV copies.

    def test_slow_nonqualifying_claim_never_dethrones_incumbent(self) -> None:
        a = ExampleGame("g-a", "b-a", "Alice", 910000, "Arabia", "Franks")
        b = ExampleGame("g-b", "b-b", "Bruno", 912000, "Arabia", "Britons")
        self.assertEqual(reference_projection([a, b], maturity_approved=True,
                                              prior_holder="Alice"),
                         (("Alice",), "Alice", "CURRENT_POSSESSION"))
        # A better measured time without validated performance qualification
        # is not automatically an eligible competitive possession.
        invalid = ExampleGame("g-c", "b-c", "Clara", 899000, "Arabia", "Celts",
                              exceptional_time_passed=False)
        self.assertEqual(reference_projection([a, b, invalid],
                                              maturity_approved=True,
                                              prior_holder="Alice")[1], None)


if __name__ == "__main__":
    unittest.main()

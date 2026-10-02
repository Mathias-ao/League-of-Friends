from __future__ import annotations

import unittest

from social_evidence_projection import _participant_social_rows


class SocialEvidenceProjectionTests(unittest.TestCase):
    def test_defensive_assists_preserve_distinct_helpers_in_one_battle(self) -> None:
        shared_battle = "battle-7"
        statistics = {
            "participants": [
                {
                    "playerId": 1,
                    "military": {
                        "engagements": {
                            "raidEvidence": {"initiatedEpisodes": []},
                            "engagementEvidence": {
                                "battles": [],
                                "allyReinforcementsSent": [],
                                "defensiveAssistsGiven": [
                                    {
                                        "battleId": shared_battle,
                                        "helperPlayerId": 1,
                                        "defendedPlayerId": 3,
                                        "firstContributionAtMs": 20_000,
                                    }
                                ],
                                "cooperativeAttacks": [],
                            },
                        }
                    },
                    "mapPresence": {},
                },
                {
                    "playerId": 2,
                    "military": {
                        "engagements": {
                            "raidEvidence": {"initiatedEpisodes": []},
                            "engagementEvidence": {
                                "battles": [],
                                "allyReinforcementsSent": [],
                                "defensiveAssistsGiven": [
                                    {
                                        "battleId": shared_battle,
                                        "helperPlayerId": 2,
                                        "defendedPlayerId": 3,
                                        "firstContributionAtMs": 20_500,
                                    }
                                ],
                                "cooperativeAttacks": [],
                            },
                        }
                    },
                    "mapPresence": {},
                },
                {"playerId": 3, "military": {"engagements": {}}, "mapPresence": {}},
            ]
        }

        projected = _participant_social_rows(statistics)

        self.assertEqual(len(projected["defensiveAssists"]), 2)
        self.assertEqual(
            {(row["helperPlayerId"], row["defendedPlayerId"]) for row in projected["defensiveAssists"]},
            {(1, 3), (2, 3)},
        )

    def test_duplicate_player_views_of_same_battle_collapse_without_losing_semantics(self) -> None:
        battle = {
            "battleId": "battle-4",
            "directedInteractionEdges": [
                {
                    "fromPlayerId": 1,
                    "toPlayerId": 2,
                    "firstAtMs": 10_000,
                    "lastAtMs": 11_000,
                    "sourceEventIds": ["e1"],
                }
            ],
        }
        statistics = {
            "participants": [
                {
                    "playerId": 1,
                    "military": {
                        "engagements": {
                            "raidEvidence": {"initiatedEpisodes": []},
                            "engagementEvidence": {"battles": [battle]},
                        }
                    },
                    "mapPresence": {},
                },
                {
                    "playerId": 2,
                    "military": {
                        "engagements": {
                            "raidEvidence": {"initiatedEpisodes": []},
                            "engagementEvidence": {"battles": [battle]},
                        }
                    },
                    "mapPresence": {},
                },
            ]
        }

        projected = _participant_social_rows(statistics)

        self.assertEqual(projected["battles"], [battle])


if __name__ == "__main__":
    unittest.main()

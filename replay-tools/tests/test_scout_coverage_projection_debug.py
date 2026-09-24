"""Temporary V6 real-replay coverage percentage diagnostic."""
import tempfile
from pathlib import Path
import unittest

from analysis_dataset import build_analysis_dataset
from parse_replay import build_payload
from statistics_projector import project_statistics_from_analysis


class ScoutCoverageProjectionDebugTests(unittest.TestCase):
    def test_real_duel_v6_scout_coverage(self):
        source = Path(__file__).resolve().parents[2] / "replay-fixtures" / "1v1_1.aoe2record"
        with tempfile.TemporaryDirectory() as temporary:
            bundle = Path(temporary) / "canonical"
            build_payload(source, bundle, seal_mode="fast")
            analysis = build_analysis_dataset(bundle, validate=False)
            statistics = project_statistics_from_analysis(analysis)
            names = {
                int(row["playerId"]): row.get("name")
                for row in analysis["manifest"]["participants"]
            }
            for player in statistics["participants"]:
                scout = player["mapPresence"]["scoutCoverageAt5Minutes"]
                print("SCOUT_V6_COVERAGE", names.get(player["playerId"]), {
                    "playerId": player["playerId"],
                    "percent": scout["percent"],
                    "orderCount": scout["orderCount"],
                    "coveredTileCount": scout["coveredTileCount"],
                    "routeTileCount": scout["routeTileCount"],
                    "methods": scout["selectionAttributionMethods"],
                })


if __name__ == "__main__":
    unittest.main()

"""Temporary V6 real-replay scout coverage radius diagnostic."""
import tempfile
from pathlib import Path
from unittest.mock import patch
import unittest

import map_presence_v5 as v5
from analysis_dataset import build_analysis_dataset
from map_presence_v6 import project_map_presence
from parse_replay import build_payload


class ScoutCoverageProjectionDebugTests(unittest.TestCase):
    def test_real_duel_v6_radius_sweep(self):
        source = Path(__file__).resolve().parents[2] / "replay-fixtures" / "1v1_1.aoe2record"
        with tempfile.TemporaryDirectory() as temporary:
            bundle = Path(temporary) / "canonical"
            build_payload(source, bundle, seal_mode="fast")
            analysis = build_analysis_dataset(bundle, validate=False)
            names = {
                int(row["playerId"]): row.get("name")
                for row in analysis["manifest"]["participants"]
            }
            for radius in (3.0, 3.25, 3.5, 3.75, 4.0):
                with patch.object(v5, "SCOUT_ROUTE_RADIUS_TILES", radius):
                    result = project_map_presence(
                        manifest=analysis["manifest"],
                        catalog=__import__("json").loads(
                            (Path(__file__).resolve().parents[1] / "entity-catalog" / "aoe2techtree-b9d494df6921.json").read_text()
                        ),
                        initial_objects=analysis["initialObjects"],
                        build_events=analysis["body"]["buildEvents"],
                        wall_events=analysis["body"].get("wallEvents", []),
                        action_events=analysis["actionEvents"],
                    )
                print("SCOUT_RADIUS_SWEEP", radius, {
                    names[player_id]: {
                        "percent": result[str(player_id)]["scoutCoverageAt5Minutes"]["percent"],
                        "orderCount": result[str(player_id)]["scoutCoverageAt5Minutes"]["orderCount"],
                        "covered": result[str(player_id)]["scoutCoverageAt5Minutes"]["coveredTileCount"],
                    }
                    for player_id in sorted(names)
                })


if __name__ == "__main__":
    unittest.main()

import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from unit_classification import (
    UNIT_CLASS_FAMILY_VERSION,
    build_initial_instance_classification,
    family_for_class_id,
    summarize_selected_instances,
)


CATALOG = {
    "units": {
        "13": {"roleKeys": ["fishing_ship", "economic_unit", "water_unit"]},
        "38": {"roleKeys": ["knight", "land_military", "cavalry"]},
        "83": {"roleKeys": ["villager", "economic_unit"]},
        "539": {"roleKeys": ["galley", "water_military", "ranged"]},
        "545": {"roleKeys": ["transport_ship", "water_unit"]},
    }
}


def obj(instance_id, object_id, class_id):
    return {
        "eventId": f"obj-{instance_id}",
        "payload": {
            "ownerPlayerId": 1,
            "instanceId": instance_id,
            "objectId": object_id,
            "classId": class_id,
        },
        "position": {"x": 10, "y": 10},
    }


class UnitClassClassificationTests(unittest.TestCase):
    def test_requested_aoe2_class_groups_map_to_families(self):
        expected = {
            6: "infantry",
            12: "cavalry",
            47: "cavalry",
            0: "archers",
            44: "archers",
            36: "cavalry_archers",
            23: "cavalry_archers",
            18: "monks",
            43: "monks",
            4: "civilian_trade_king",
            19: "civilian_trade_king",
            59: "civilian_trade_king",
            21: "ships",
            20: "ships",
            22: "ships",
            2: "ships",
            53: "ships",
            13: "siege",
            51: "siege",
            54: "siege",
            55: "siege",
            35: "siege",
            3: "buildings",
            27: "buildings",
            39: "buildings",
            49: "buildings",
            52: "buildings",
            60: "buildings",
        }
        for class_id, family in expected.items():
            with self.subTest(class_id=class_id):
                self.assertEqual(family_for_class_id(class_id), family)

    def test_initial_replay_class_id_is_preserved_as_direct_family_evidence(self):
        rows = build_initial_instance_classification(
            [
                obj(101, 38, 12),
                obj(102, 83, 4),
                obj(103, 539, 21),
                obj(104, 13, 21),
                obj(105, 545, 21),
            ],
            catalog=CATALOG,
        )
        self.assertEqual(rows[101]["family"], "cavalry")
        self.assertEqual(rows[101]["militaryStatus"], "military")
        self.assertEqual(rows[102]["militaryStatus"], "non_military")
        self.assertEqual(rows[103]["family"], "ships")
        self.assertEqual(rows[103]["militaryStatus"], "military")
        self.assertEqual(rows[104]["militaryStatus"], "non_military")
        self.assertEqual(rows[105]["militaryStatus"], "non_military")
        self.assertEqual(rows[101]["modelVersion"], UNIT_CLASS_FAMILY_VERSION)

    def test_selection_summary_counts_distinct_instances_and_keeps_unknown_unknown(self):
        rows = build_initial_instance_classification(
            [
                obj(101, 38, 12),
                obj(102, 83, 4),
            ],
            catalog=CATALOG,
        )
        summary = summarize_selected_instances(
            [101, 101, 102, 9999],
            classification_by_instance=rows,
        )
        self.assertEqual(summary["distinctObservedSelectedInstances"], 3)
        self.assertEqual(summary["militaryClassInstances"], 1)
        self.assertEqual(summary["knownNonMilitaryClassInstances"], 1)
        self.assertEqual(summary["unknownClassInstances"], 1)
        self.assertEqual(summary["familyCounts"]["cavalry"], 1)
        self.assertEqual(summary["familyCounts"]["civilian_trade_king"], 1)
        self.assertAlmostEqual(summary["typedCoveragePercent"], 66.7)


if __name__ == "__main__":
    unittest.main()

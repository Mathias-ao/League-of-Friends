"""Catalog admission, historical selection and new-ID consumer regressions."""
from pathlib import Path
import sys
import unittest
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from canonical_io import read_json
from statistics_projector import ENTITY_CATALOG, ENTITY_CATALOG_185872, select_entity_catalog
from military_statistics import _military_class, _unit_cost
from opening_statistics import _first_military_unit
from fixture_support import export_fixture, header
from analysis_dataset import build_analysis_dataset
from statistics_projector import project_statistics_from_analysis


class EntityCatalogTests(unittest.TestCase):
    def setUp(self):
        self.catalog = read_json(ENTITY_CATALOG_185872)

    def test_exact_build_selection_and_historical_fallback(self):
        for build in (None, 180059, 185871, 185873):
            self.assertEqual(select_entity_catalog({'source': {'gameBuild': build}}), ENTITY_CATALOG)
        self.assertEqual(select_entity_catalog({'source': {'gameBuild': 185872}}), ENTITY_CATALOG_185872)

    def test_compact_cache_preserves_build_and_explicit_catalog_override(self):
        fixture_header = header()
        fixture_header['de']['build'] = 185872
        with tempfile.TemporaryDirectory() as temporary:
            _, bundle, _ = export_fixture(Path(temporary), fixture_header=fixture_header)
            analysis = build_analysis_dataset(bundle, validate=False)
            self.assertEqual(analysis['manifest']['source']['gameBuild'], 185872)
            result = project_statistics_from_analysis(analysis)
            self.assertEqual(result['entityCatalogVersion'], 'AOF_ENTITY_CATALOG_V1_2')
            legacy = project_statistics_from_analysis(analysis, catalog_path=ENTITY_CATALOG)
            self.assertEqual(legacy['entityCatalogVersion'], 'AOF_ENTITY_CATALOG_V1_1')

    def test_new_units_have_names_costs_and_military_roles(self):
        for raw_id in (2700, 2701, 2703, 2704, 2705, 2706, 2708, 2709, 2711, 2712):
            row = self.catalog['units'][str(raw_id)]
            self.assertTrue(row['name'])
            self.assertGreater(_unit_cost(self.catalog, raw_id), 0)
            self.assertIn('land_military', row['roleKeys'])
        self.assertEqual(_military_class(self.catalog, 2708, 82), 'cavalry')
        self.assertEqual(_military_class(self.catalog, 2703, 82), 'infantry')
        first = _first_military_unit([{'unitId': 2700, 'atMs': 1000,
                                      'requestedAmountPositive': 1}], self.catalog)
        self.assertEqual(first['unit']['rawId'], 2700)

    def test_upgrade_and_building_ids_resolve_without_inventing_costs(self):
        row = self.catalog['technologies']['100']
        self.assertEqual(row['upgradesUnitId'], 24)
        self.assertEqual(row['researchTime'], 35)
        self.assertEqual(self.catalog['buildings']['82']['name'], 'Castle')
        for raw_id in ('490', '673'):
            row = self.catalog['buildings'][raw_id]
            self.assertEqual(row['airef']['deApplicability'], 1)
            self.assertNotIn('cost', row)

    def test_upgraded_warships_are_military_but_economic_ships_are_not(self):
        for raw_id in (21, 442, 532, 1103, 1104, 1105):
            # Siege Tower is a land siege unit despite the nearby ship IDs.
            expected = 'siege' if raw_id == 1105 else 'warships'
            self.assertEqual(_military_class(self.catalog, raw_id, None), expected)
        for raw_id in (13, 17):
            self.assertIsNone(_military_class(self.catalog, raw_id, 45))
        self.assertEqual(_military_class(self.catalog, 545, 45), 'navalSupport')

    def test_conflicting_elite_ids_use_current_primary_upgrade_links(self):
        for elite, base in ((2706, 2705), (2709, 2708), (1961, 1959)):
            row = self.catalog['units'][str(elite)]
            self.assertEqual(row['roleSource']['baseUnitId'], base)
            self.assertNotIn('airef', row)
            self.assertTrue(row['roleKeys'])

    def test_reference_classes_are_not_replay_observed_classes(self):
        for section in ('buildings', 'units'):
            for row in self.catalog[section].values():
                self.assertNotIn('classId', row)
                if 'airef' in row:
                    self.assertEqual(row['airef']['deApplicability'], 1)
                    self.assertEqual(row['airef']['sourceTablePath'], 'tables/objects.html')


if __name__ == '__main__':
    unittest.main()

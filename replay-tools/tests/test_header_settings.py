from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from parse_replay import build_settings, NORMALIZER_VERSION


class HeaderSettingsTests(unittest.TestCase):
    def test_explicit_de_true_wins_over_legacy_false(self):
        self.assertIs(build_settings({"de": {"lock_teams": True},
                                     "lobby": {"lock_teams": False}}, [])["lockTeams"], True)

    def test_explicit_de_false_wins_over_legacy_true(self):
        self.assertIs(build_settings({"de": {"lock_teams": False},
                                     "lobby": {"lock_teams": True}}, [])["lockTeams"], False)

    def test_non_de_retains_legacy_setting(self):
        for value in (True, False):
            with self.subTest(value=value):
                self.assertIs(build_settings({"lobby": {"lock_teams": value}}, [])["lockTeams"], value)

    def test_missing_de_flag_falls_back_but_no_flag_remains_unknown(self):
        self.assertIs(build_settings({"de": {"lock_teams": None},
                                     "lobby": {"lock_teams": False}}, [])["lockTeams"], False)
        self.assertIsNone(build_settings({"de": {}, "lobby": {}}, [])["lockTeams"])

    def test_normalization_change_has_new_revision(self):
        self.assertEqual(NORMALIZER_VERSION, "AOF_CANONICAL_NORMALIZER_V1_2")


if __name__ == "__main__":
    unittest.main()

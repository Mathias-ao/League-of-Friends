"""Discovery gate: do not claim a new method before original probe proves one."""
import unittest
from pathlib import Path
from hashlib import sha256
from test_social_v1_metric_grade_candidates import PINS, ROOT

class SourceDiscoveryOnly(unittest.TestCase):
    def test_original_hashes_are_pinned(self):
        for _, (filename,pin) in PINS.items():
            with self.subTest(original=filename):
                self.assertEqual(sha256((ROOT/filename).read_bytes()).hexdigest(),pin)
    def test_no_new_method_admitted_from_discovery_alone(self):
        from social_v1_source_grades import METHODS
        self.assertEqual(METHODS["RIVALRY"]["methodVersion"],"AOF_SV1E_PAIR_RAID_ENGAGEMENT_CONTEST_1")

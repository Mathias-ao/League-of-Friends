"""Lossless bounded derived-detail delivery; no parser/Firebase dependencies."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from statistics_detail_delivery import (write_delivery_bundle, load_manifest, load_summary,
    list_detail_page, read_record_fragment, restore_full_statistics)


def example():
    shared = {"skirmishId": "s1", "startedAtMs": 100, "sourceEventIds": ["op-1", "op-2"],
              "directedInteractionEdges": [{"fromPlayerId": 1, "toPlayerId": 2, "sourceEventIds": ["op-1"]}]}
    large = {"battleId": "b1", "startedAtMs": 100, "sourceEventIds": [f"op-{i}" for i in range(4000)]}
    def player(p):
        return {"playerId": p, "replaySlot": p, "economy": {"food": 22},
                "military": {"engagements": {"skirmishes": 1, "engagementEvidence": {
                    "skirmishes": [shared], "battles": [large], "greatBattles": [large]}}}}
    return {"statisticsSchemaVersion": "1.2.0", "participants": [player(1), player(2)],
            "pairSocialEvidence": {"neutral": True}, "matchFacts": {"durationMs": 20000}}


class DetailDeliveryTests(unittest.TestCase):
    def test_lossless_dedup_paging_and_fragmented_huge_row(self):
        stats = example()
        with tempfile.TemporaryDirectory() as td:
            root = Path(td) / "bundle"
            receipt = write_delivery_bundle(stats, root, block_bytes=1024)
            manifest = load_manifest(root, receipt)
            summary = load_summary(root, manifest)
            self.assertEqual(len(manifest["records"]), 2)
            self.assertNotIn("engagementEvidence", summary["participants"][0]["military"]["engagements"])
            self.assertEqual(summary["participants"][0]["military"]["engagements"]["skirmishes"], 1)
            self.assertEqual(summary["pairSocialEvidence"], stats["pairSocialEvidence"])
            page = list_detail_page(manifest, 1, "battles", limit=1)
            ref = page["items"][0]["ref"]
            raw = bytearray()
            offset = 0
            while True:
                piece = read_record_fragment(root, manifest, ref, offset=offset, limit=63)
                self.assertLessEqual(len(piece["data"]), 63)
                raw.extend(piece["data"])
                if piece["nextOffset"] is None:
                    break
                offset = piece["nextOffset"]
            self.assertEqual(json.loads(raw), stats["participants"][1]["military"]["engagements"]["engagementEvidence"]["battles"][0])
            self.assertEqual(restore_full_statistics(root, receipt), stats)
            self.assertLess(receipt["uniqueDetailRecords"], 5)
            with self.assertRaises(FileExistsError):
                write_delivery_bundle(stats, root)

    def test_corruption_and_bad_requests_fail_closed(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td) / "bundle"
            receipt = write_delivery_bundle(example(), root, block_bytes=1024)
            manifest = load_manifest(root, receipt)
            ref = next(iter(manifest["records"]))
            with self.assertRaises(ValueError):
                list_detail_page(manifest, 0, "skirmishes", limit=1000)
            with self.assertRaises(ValueError):
                read_record_fragment(root, manifest, ref, limit=300000)
            page = root / manifest["blocks"][0]["path"]
            page.write_bytes(b"invalid")
            with self.assertRaises(ValueError):
                read_record_fragment(root, manifest, ref)

    def test_deterministic_bytes_across_fresh_runs(self):
        with tempfile.TemporaryDirectory() as td:
            a = Path(td) / "a"; b = Path(td) / "b"
            first = write_delivery_bundle(example(), a, block_bytes=2048)
            second = write_delivery_bundle(example(), b, block_bytes=2048)
            self.assertEqual(first, second)
            files_a = sorted(p.relative_to(a) for p in a.rglob("*.gz"))
            self.assertEqual([(str(p), (a / p).read_bytes()) for p in files_a],
                             [(str(p), (b / p).read_bytes()) for p in files_a])


if __name__ == "__main__":
    unittest.main()

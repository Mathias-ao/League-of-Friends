"""Pure offline unit tests; no replay fixtures, Firebase, or model changes."""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from statistics_shared_delivery import (
    write_shared_bundle, load_shared_manifest, load_episode, restore_shared_statistics,
)


def sample():
    large = [f"op-{i:09d}" for i in range(1000)]
    base = {
        "sourceEventIds": large, "startedAtMs": 3400,
        "directedInteractionEdges": [
            {"fromPlayerId": 1, "toPlayerId": 2, "sourceEventIds": large}
        ],
    }
    return {
        "source": {"replaySha256": "0" * 64},
        "participants": [
            {
                "playerId": i, "replaySlot": i,
                "military": {"engagements": {
                    "battles": 2,
                    "engagementEvidence": {
                        "skirmishes": [{**base, "skirmishId": "s1", "playerSpecific": i}],
                        "battles": [{**base, "battleId": "b1", "playerSpecific": i}],
                    },
                }},
            } for i in (1, 2, 3)
        ],
        "pairSocialEvidence": {"observations": [{"sourceEventId": "op-1"}]},
        "matchFacts": {"players": []},
    }


class SharedDeliveryTests(unittest.TestCase):
    def test_lossless_shared_fields_and_unique_player_variants(self):
        original = sample()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "shared"
            receipt = write_shared_bundle(original, root, block_bytes=2048)
            manifest = load_shared_manifest(root, receipt)
            self.assertEqual(receipt["uniqueEpisodeRecords"], 6)
            self.assertLess(receipt["storedRecordCount"], 9)
            ref = manifest["players"][0]["groups"]["battles"][0]["ref"]
            episode = load_episode(root, manifest, ref)
            self.assertEqual(
                episode,
                original["participants"][0]["military"]["engagements"]["engagementEvidence"]["battles"][0],
            )
            self.assertEqual(restore_shared_statistics(root, receipt), original)
            with self.assertRaises(FileExistsError):
                write_shared_bundle(original, root)

    def test_corruption_and_invalid_episode_reference_fail_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "bundle"
            receipt = write_shared_bundle(sample(), root, block_bytes=2048)
            manifest = load_shared_manifest(root, receipt)
            original_ref = next(iter(manifest["episodeStorage"]))
            with self.assertRaises(ValueError):
                load_episode(root, manifest, "0" * 64)
            tampered = {**manifest, "episodeStorage": {
                original_ref: next(iter(manifest["records"]))
            }}
            with self.assertRaises(ValueError):
                load_episode(root, tampered, original_ref)
            block = root / manifest["blocks"][0]["path"]
            block.write_bytes(b"invalid")
            with self.assertRaises(ValueError):
                restore_shared_statistics(root, receipt)

    def test_determinism_and_missing_field_distinctions(self):
        source = sample()
        source["participants"][1]["military"]["engagements"].pop("engagementEvidence")
        with tempfile.TemporaryDirectory() as tmp:
            a, b = Path(tmp) / "a", Path(tmp) / "b"
            receipt = write_shared_bundle(source, a)
            self.assertEqual(receipt, write_shared_bundle(source, b))
            self.assertEqual(restore_shared_statistics(a, receipt), source)
            source["participants"][0].pop("military")
            c = Path(tmp) / "c"
            self.assertEqual(restore_shared_statistics(c, write_shared_bundle(source, c)), source)


if __name__ == "__main__":
    unittest.main()

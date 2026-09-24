"""Temporary diagnostic for starting-scout action attribution on the paired real duel."""
from collections import Counter, defaultdict
from pathlib import Path
import tempfile
import unittest

from canonical_io import iter_store, read_json
from parse_replay import build_payload

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "replay-fixtures"


class ScoutAttributionDebugTests(unittest.TestCase):
    def test_paired_duel_first_five_minutes(self):
        for file_name in ("1v1_1.aoe2record",):
            source = FIXTURES / file_name
            self.assertTrue(source.is_file(), file_name)
            with tempfile.TemporaryDirectory() as temporary:
                bundle = Path(temporary) / "canonical"
                build_payload(source, bundle)
                manifest = read_json(bundle / "canonical-replay.json")
                names = {
                    int(p["playerId"]): p.get("name")
                    for p in manifest.get("participants", [])
                }
                scouts = {}
                for event in iter_store(bundle, manifest["initialState"]["objectStore"]):
                    payload = event.get("payload") or {}
                    if payload.get("objectId") == 448:
                        owner = payload.get("ownerPlayerId")
                        instance_id = payload.get("instanceId")
                        if isinstance(owner, int) and isinstance(instance_id, int):
                            scouts[owner] = instance_id

                counts = defaultdict(Counter)
                selected_scout = defaultdict(Counter)
                samples = defaultdict(list)
                movement_names = {
                    "MOVE", "ORDER", "AI_ORDER", "DE_AUTOSCOUT",
                    "PATROL", "DE_ATTACK_MOVE", "SPECIAL",
                }
                for event in iter_store(bundle, manifest["factStore"]):
                    if event.get("sourceOperation") != "ACTION":
                        continue
                    at = event.get("timestampMs")
                    actor = event.get("actorPlayerId")
                    if not isinstance(at, int) or at >= 300_000 or actor not in names:
                        continue
                    name = event.get("sourceActionName") or "ERROR"
                    ids = list(event.get("objectInstanceIds") or [])
                    counts[actor][name] += 1
                    scout_id = scouts.get(actor)
                    if scout_id in ids:
                        selected_scout[actor][name] += 1
                    if name in movement_names and len(samples[actor]) < 40:
                        payload = event.get("payload") or {}
                        samples[actor].append({
                            "at": at,
                            "name": name,
                            "ids": ids,
                            "payloadObjectIds": payload.get("object_ids"),
                            "position": event.get("position"),
                            "rawLayout": payload.get("_rawLayout"),
                            "eventId": event.get("eventId"),
                        })

                print("\nSCOUT_DEBUG", file_name, "names", names, "scouts", scouts)
                for player_id in sorted(names):
                    print("PLAYER", player_id, names[player_id])
                    print("ACTION_COUNTS", dict(counts[player_id]))
                    print("SCOUT_SELECTED_COUNTS", dict(selected_scout[player_id]))
                    for row in samples[player_id]:
                        print("MOVE_SAMPLE", row)


if __name__ == "__main__":
    unittest.main()

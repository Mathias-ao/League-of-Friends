"""Golden snapshot and semantic diff CLI. Snapshots never change in test runs."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from canonical_io import iter_store, json_bytes, read_json, semantic_diff, validate_bundle
from canonical_run import project_bundle


def semantic_snapshot(bundle: Path) -> dict:
    manifest = read_json(bundle / 'canonical-replay.json')
    stores = {}
    for name, store in [('facts', manifest['factStore']),
                        ('objects', manifest['initialState']['objectStore']),
                        ('terrain', manifest['initialState']['map']['terrainStore'])]:
        digest = hashlib.sha256()
        for event in iter_store(bundle, store):
            digest.update(json_bytes(event))
        stores[name] = {'recordCount': store['recordCount'], 'semanticSha256': digest.hexdigest()}
    projected = project_bundle(bundle, validate=False)
    body = projected['body']
    return {'snapshotVersion': 'AOF_GOLDEN_V2', 'schemaVersion': manifest['schemaVersion'],
            'versions': manifest['versions'],
            'source': {k: manifest['source'][k] for k in ['sha256', 'byteLength', 'saveVersion', 'gameBuild', 'povPlayerId']},
            'durationMs': manifest['match']['durationMs'], 'completionStatus': manifest['match']['completionStatus'],
            'participantsSha256': hashlib.sha256(json_bytes(manifest['participants'])).hexdigest(),
            'playerCount': len(manifest['participants']),
            'map': {k: manifest['initialState']['map'][k] for k in ['width', 'height']},
            'stores': stores, 'operationCounts': body['operationCounts'], 'actionCounts': body['allActionCounts'],
            'decodeStatusCounts': body['decodeStatusCounts'],
            'queueCommandCount': len(body['productionEvents']),
            'positiveQueueAmount': sum(max(0, e['signedAmount'] or 0) for e in body['productionEvents']),
            'researchCommandCount': len(body['researchEvents']), 'buildingPlacementCount': len(body['buildEvents']),
            'diplomacyCommandCount': len(body['diplomacyEvents']),
            'fundamentals': projected['fundamentals']}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('bundle', type=Path)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--compare', type=Path, help='Compare against a reviewed golden; nonzero exit on semantic changes.')
    group.add_argument('--write-snapshot', type=Path, help='Explicitly write a candidate snapshot for review; not an automatic test update.')
    args = parser.parse_args()
    validate_bundle(args.bundle)
    snapshot = semantic_snapshot(args.bundle)
    if args.write_snapshot:
        args.write_snapshot.write_text(json.dumps(snapshot, indent=2, sort_keys=True) + '\n')
    else:
        changes = semantic_diff(read_json(args.compare), snapshot)
        print(json.dumps({'changes': changes}, indent=2))
        if changes:
            raise SystemExit(1)


if __name__ == '__main__':
    main()

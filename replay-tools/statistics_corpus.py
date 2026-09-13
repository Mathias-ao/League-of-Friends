"""Build a privacy-minimized statistics report across canonical bundles."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from canonical_io import json_bytes
from statistics_projector import project_statistics

CORPUS_REPORT_VERSION = "AOF_STATISTICS_CORPUS_V1"


def summarize(identifier: str, result: dict) -> dict:
    evidence = result["commandEvidence"]

    def inventory_total(key: str) -> int:
        return sum(item["commandCount"] for values in evidence[key].values() for item in values)

    return {
        "id": identifier,
        "sourceSha256": result["source"]["replaySha256"],
        "canonicalSchemaVersion": result["source"]["canonicalSchemaVersion"],
        "statisticsProjectionVersion": result["statisticsProjectionVersion"],
        "observedUntilMs": result["scope"]["observedUntilMs"],
        "decodedPlayerActionCommands": sum(p["observedCommands"]["count"] for p in result["participants"]),
        "queueRequestCommands": inventory_total("queueRequestsByPlayerAndUnit"),
        "researchRequestCommands": inventory_total("researchRequestsByPlayerAndTechnology"),
        "buildingPlacementCommands": inventory_total("buildingPlacementsByPlayerAndBuilding"),
        "marketCommands": len(evidence["marketCommands"]),
        "tributeCommands": len(evidence["tributeCommands"]),
        "resignCommands": len(evidence["resignCommands"]),
        "directedDiplomacyCommands": sum(len(events) for events in evidence["directedDiplomacyCommands"].values()),
        "recorderCameraPoints": result["recorderCamera"]["pointCount"],
        "warningCodes": [warning["code"] for warning in result["warnings"]],
    }


def build_corpus(bundle_specs: list[tuple[str, Path]]) -> dict:
    return {"reportVersion": CORPUS_REPORT_VERSION,
            "reports": [summarize(identifier, project_statistics(path)) for identifier, path in bundle_specs]}


def main() -> None:
    parser = argparse.ArgumentParser(description="Project an aggregate report from canonical bundles without replay parsing.")
    parser.add_argument("--bundle", action="append", required=True, metavar="ID=PATH")
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    specs = []
    for value in args.bundle:
        identifier, separator, raw_path = value.partition("=")
        if not separator or not identifier or not raw_path:
            parser.error(f"Invalid --bundle {value!r}; expected ID=PATH")
        specs.append((identifier, Path(raw_path)))
    result = build_corpus(specs)
    if args.out:
        args.out.write_bytes(json_bytes(result))
        print(f"Wrote {len(result['reports'])} corpus reports to {args.out}")
    else:
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

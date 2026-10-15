"""Offline smoke over an E2E Game's exported statistics; never a server write."""
from __future__ import annotations

import argparse
import gzip
import json
import sys
from pathlib import Path

from social_three_families_preview import project_three_families_preview


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Read-only AoF three-family statistics E2E preview")
    parser.add_argument("statistics", type=Path, help="Verified, local statistics.json or statistics.json.gz")
    parser.add_argument("--output", type=Path, help="Optional private local report filename (default: stdout)")
    args = parser.parse_args(argv)
    try:
        opener = gzip.open if args.statistics.name.endswith(".gz") else open
        with opener(args.statistics, "rt", encoding="utf-8") as stream:
            statistics = json.load(stream)
        report = project_three_families_preview(statistics)
    except (OSError, UnicodeError, ValueError, TypeError, json.JSONDecodeError) as error:
        parser.exit(2, f"E2E preview unavailable: {error}\n")
    report["e2eMeaning"] = "evidence_only_not_an_authenticated_official_or_scoring_read"
    result = json.dumps(report, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    if args.output:
        if args.output.exists():
            parser.exit(2, "E2E preview refuses to overwrite an existing report\n")
        with args.output.open("x", encoding="utf-8") as stream:
            stream.write(result)
    else:
        sys.stdout.write(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

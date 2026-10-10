"""Safe, optional time-window candidate selection for command-episode detectors.

Retain original event order and inclusive timestamp semantics. When event input
is not strictly integer-timestamped and nondecreasing, return all original
events: existing detector predicates remain the single source of truth.
"""
from __future__ import annotations

from bisect import bisect_left, bisect_right
from typing import Any, Iterable


class ActionTimeWindow:
    def __init__(self, events: Iterable[dict[str, Any]]) -> None:
        self.events = list(events)
        times = [event.get("timestampMs") for event in self.events]
        self.usable = all(type(ts) is int for ts in times) and all(
            a <= b for a, b in zip(times, times[1:])
        )
        self.times = times if self.usable else []

    def between(self, start_ms: int, end_ms: int) -> list[dict[str, Any]]:
        """Candidate superset for time-aware predicates, inclusive at both ends."""
        if not self.usable or type(start_ms) is not int or type(end_ms) is not int:
            return self.events
        if start_ms > end_ms:
            return []
        return self.events[
            bisect_left(self.times, start_ms):bisect_right(self.times, end_ms)
        ]

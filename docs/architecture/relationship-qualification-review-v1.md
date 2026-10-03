# Relationship qualification review V1

Model: `AOF_RELATIONSHIP_QUALIFICATION_REVIEW_V1`. Presentation-only implementation on `feat/pair-social-evidence-v1`; no scoring, persistence, progression or production activation.

## What the owner can evaluate

Open **Battle record and social evidence** (preview: **Review real recording evidence**). **Relationship qualification review** appears before raw Battle context. Select a recording, pair and track; open a decision to inspect action direction, possible contribution direction, supported evidence, missing prerequisites and source references.

The retained duel shows direct contest commands and an independently ordered return-pressure sequence. The 4v4 example shows helper-to-recipient support and exact allied pairs/common targets. FFA shows directed Ally-declaration withdrawals with all effective-alliance and king-outcome prerequisites still missing. Samples are abbreviated and cannot qualify recurrence, missing help or total contributions.

The review follows [the contextual-deed matrix](contextual-social-deeds-v1.md), not the obsolete Rivalry/Enemy/Friend engine. Reputation remains Gallantry/Cruelty/Chivalry; relationships remain Rivalry/Hostility/Bond.

## Decisions and limits

- **Supported positive command evidence** qualifies the narrow existing episode or declaration fact only. It does not qualify a completed relationship award, success, damage or player feelings.
- **Policy unconfigured; candidate evidence only** exposes eligible inputs for later explicit rules. Points, thresholds, caps and ordinary stages are absent.
- **Blocked by missing prerequisites** applies to dependent claims such as support without qualified alliance or Treachery inferred from a declaration withdrawal.
- Empty selection or unavailable versioned evidence is not zero relationship or evidence of non-cooperation.

Local overlap and targeted commands remain separate; only actual targeted facets can establish targeting in both directions. The review never upgrades these to reciprocal weapon attacks. Ordered return pressure reads the existing context model and additionally checks exact reverse pair, different deed IDs and full moment order. It does not infer revenge.

Pressure action A→B is displayed separately from a possible victim-impact contribution B→A. That contribution is hypothetical, policy-gated and never emitted as returned aggression or reciprocity. Single-Game pressure cannot establish persistent cross-Battle Hostility.

Support preserves helper→recipient and requires retained FIXED_ALLIES context for the supported alliance prerequisite. Received copies never provide returned assistance. Shared offense preserves the incident's exact pair and common target, verifies both pair members have command sources, and never combines contributors from different target groups.

An Ally-declaration withdrawal qualifies recorded command history only. Mutual effective alliance, qualified rupture, subsequent hostile participation, confirmed king loss/responsibility and explicit association/mode/identity/stage policy remain mandatory for the approved exceptional Treachery escalation. No declaration row triggers it.

## Accounting and compatibility

The pure web-domain helper consumes existing versioned ledger/context/review rows. It does not parse recordings, change statistics, resolve game outcomes, create new deeds, aggregate pair chapters or call a scorer. Review rows are deduplicated by existing record/semantic identity and sorted by time/identity. Different review rows can describe the same deed and must never be summed as awards. Revision/source IDs remain inspectable.

This is an explainable evaluation surface, not a substitute for the future successor relationship engine. Durable league identity bindings, ordered Games/Battles, deed independence, replacement on corrections and configured rules remain prerequisites for lasting progression. Optional activity/standings context remains unavailable and does not erase existing positive facts.

Tests cover proximity versus targeting, reversed victim-impact direction, support alliance gating, exact common targets, ordered independent return pressure, blocked declaration-only Treachery, real retained examples, immutability/reordering, legacy unavailable inputs and interactive pair/track filters. Applicable website and backend CI results belong to the exact pull-request revision.

# Agent delivery instructions — Age of Friends

Apply these instructions to technical work in this repository. The authoritative active milestone, policy approvals, task ownership and E2E gates are in [release issue #218](https://github.com/Mathias-ao/League-of-Friends/issues/218). Follow its current decisions rather than stale PR descriptions. Preserve accepted player behavior, canonical Game/Battle/Event distinctions, genuine-source admission, auth/privacy and correction semantics.

## Delivery responsibilities

- **Owner:** product/gameplay policy, material trade-offs, runtime/deployment authorization and final player-facing E2E acceptance.
- **Organiser:** establishes bounded scope, player journey, work priority, dependencies and acceptance criteria; monitors delivery efficiency.
- **Codex / implementer:** owns the **complete approved technical delivery cycle**: reproduce/investigate → smallest scoped implementation → focused and appropriate regression tests → create/update PR → request independent review via a **verified** mechanism → address blocking/in-scope feedback → request re-review → return exact-head evidence and remaining blockers.
- **Sol:** independent technical architecture/integration reviewer, exact-head CI/release authority and shared-file ownership coordinator; reviews continuously, not only at the end.

Codex should handle routine technical feedback without asking the owner or Organiser to relay every message. Use a confirmed direct Codex↔Sol mechanism **only if it is actually configured and verified**. Otherwise use the GitHub PR review request and comment/thread workflow as the durable coordination record. **A GitHub comment or review request does not by itself prove that the existing Sol chat has been notified or run.** Report that distinction and any missing dispatch connection; never impersonate Sol or describe Codex subagent review as independent Sol acceptance.

## Scope and review rules

Choose one delivery lane before editing:

- **Lane A — bounded correction:** one implementer, one independent reviewer, minimal correction, focused regressions, suitable existing CI, integrate promptly after acceptance. Avoid unnecessary new policy reviews, broad research or extra workers.
- **Lane B — systemic change:** new gameplay mechanics, material architecture/security changes or cross-system contracts. Establish dependencies and owner-approved gameplay policy before implementation; integrate in small independently testable increments.

Do not silently widen Lane A into Lane B. Demonstrate the necessity, impact and narrow recommended decision first.

Classify review findings as: **(1) blocking correctness/security/integration**, **(2) necessary in-scope correction**, or **(3) optional/unrelated backlog**. Fix (1)/(2); defer (3). After two failed corrections on the same finding, stop the repetitive patch loop, diagnose the disagreement/root cause and agree one decisive test/resolution with Sol. Never weaken safety, source integrity or correctness to close review.

Respect the current exclusive file reservations and avoid concurrent edits to shared App/profile/repository/worker files. Open an explicit small ownership request if an unreserved hunk is truly necessary. Codex may use subagents for bounded investigation and test work, but cross-system/high-risk changes still require independent Sol review and approved exact-head CI. **Never self-authorize** gameplay policy, nonapproved source methods, cloud/IAM changes, production or staging activation, runtime policy provisioning, grants or publication.

## Player-facing definition of done

Report each milestone journey separately as **CODE VERIFIED → INTEGRATED → STAGING VERIFIED → OWNER E2E ACCEPTED**. A merged PR or emulator test is not proof of a deployed browser experience.

Every implementation must preserve evidence provenance, qualified independent opportunities, correction/withdrawal, privacy, honest Developing/Pending states, local errors/retry and perceived responsiveness. In particular, opening Event/Battle/Player details must not be blocked on all secondary reads. Sol coordinates the pinned web/Functions/worker/config staging preflight before requesting the owner's next E2E.

## Minimal handback

Reply with: **player journey and scope; PR and exact head; targeted/full CI and independent review outcome; integration/staging status; one remaining blocker or required owner decision**. Do not create extra management artifacts or restart completed implementations.

### Review-loop connectivity pilot

Before claiming autonomous Codex↔Sol handoff, verify actual messaging/review delivery on **one genuinely small Lane A correction**: Codex requests review, Sol independently responds, Codex addresses any blocking finding, Sol closes acceptance. Record whether the existing Sol worker was reached automatically or whether GitHub merely stored a request. If direct signaling is absent, keep GitHub as the review record and propose only the smallest supported dispatch automation; don't assume a connector exists or build a speculative orchestrator.

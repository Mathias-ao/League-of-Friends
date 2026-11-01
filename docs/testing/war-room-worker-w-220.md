# WAR-V1 #220 — Worker W implementation handoff (1 November 2026)

**Dependencies:** draft backend safety PR #221 `worker-w/war-room-source-gate-220`; stacked website PR #222 `worker-w/war-room-ui-220`. Starting main `e8e69b6f549116af7eaec0929081ad9cdce49187`. **Never merge #222 before its #221 base is accepted or retargeted.**

## Verified existing paths

- `getWarRoom` is exported as an authenticated callable. Old implementation read all Season challenges and treated legacy season-rivalry `status=QUALIFIED` as current eligibility. #221 changes read to active-season viewer-owned sent/received history, removes legacy unlock and scores, and marks any original qualification PENDING_SOURCE.
- `createWarRoomChallenge` and `respondToWarRoomChallenge` were fully exported mutation paths: an OPEN Season plus the deprecated rivalry row could create a challenge and an accepted Match/G1. #221 inserts an unconditional, after-auth server gate in BOTH callables, BEFORE any transaction. An existing/accepted Battle and all ledger rows are retained.
- `computeMatchRewards` and `processMatchRewards` already separate War Room Points from League Points and Gold and use correction deltas for **result revision**; they do NOT independently verify original challenge-stage eligibility nor revoke points on retrospective source invalidation. The current isolated snapshot is 0 completion/3 win, not a newly approved scoring policy.
- Season create initializes War Room CLOSED. No authority to automatically OPEN or change production flags.
- `getMySocialProgression` is an emulator-only, privately simulated **PROPOSED** calibration; `history.js` is not an approved current public stage authorization store. Worker 4 must supply independently source-confirmed stage-three directions; the #139 historical evaluator remains sole owner.

## Safety rules for Sol 1B integration

1. Preserve BOTH server mutation guards until owner separately authorizes a source-current reader, transaction-safe original stage3+ reciprocity witness and correction/rebuild path; a client flag or legacy `QUALIFIED` row is insufficient.
2. New challenges need a pair-specific, exact-season, nonpending stage eligibility token from an approved, current history projection. The token must bind original verified stage, qualified bidirectional independent-actor events, policy/version, source revisions, chronology and authentication; strict one-way Treachery Hostility3 is NOT a reciprocal Feud.
3. Creation, response and accepted Match identity need idempotent, concurrent, status/Season-safe transactions. Pending current stage blocks new actions and unaccepted invitations. Previously accepted and originally valid challenges can continue during newly pending *current* stage, but an actual correction disproving eligibility **at activation** requires competitive invalidation and points reversal. Do not remove actual Match/Game/League/Chronicle history.
4. Scoring must bind the original authorization and Game/result/source version, with no League Points/Gold for War Room reward alone. Implement challenge-specific negative ledger corrections and auditable recalculation for closed Season standings; rank-only titles/notices and physical prize decisions remain SOC-036–041 restrictions. The old simple result-correction delta is insufficient.
5. The read-only website now routes `#war-room`; the route is visible, while actions and standings remain unavailable. It renders closed/pending/empty/received/sent/history and only shows action buttons with server `qualification.status=VERIFIED` **and** current row-level verified eligibility and per-action flags. Archived revisions have separate stable row identities, retain their historical Battle links and never become incoming invitations. A stale local revision cannot answer a later invitation. No lifetime totals until a verified lifetime store exists.

## Evidence and still-blocked work

- #221 `functions/tests/war-room-safe-access.test.mjs`: authenticated A/B/third-player read isolation, legacy QUALIFIED not admitted, no standings publication, mutation denial for OPEN Season and respondent requests, closed Season history retained.
- #222 `web/tests/war-room.test.ts`: mounted closed and pending screens, mocked *server-provided* verified pair control, invitation acceptance, correction/Battle link, signed-out access, route presence. A mocked permission is **not** a real source-qualified stage.
- Independent review follow-up: backend reads immutable `history/Rn` entries only for the current authorized pair and Season, rejects malformed/duplicate/foreign revisions, and keeps current versus archived state explicit. Tests retain completed revision1's original Battle after declined revision2 for A/B, deny outsiders and leave all points unavailable. DOM/domain negatives reject Pending/Invalidated row eligibility, archived/current-status conflicts and stale revision membership even when top-level permission flags are true.
- **Not yet proven:** genuine emulator qualified stage3 + accepted Game + authenticated A/B/outsider + official source winner + revision/withdrawal/closed-Season reversible point chain; production policy/grants/open lifecycle. This is a deliberate release blocker, not an invitation to bypass gates.

No deployment, live mutation, feature-flag activation, staging write, public eligibility or scoring is performed by these PRs.

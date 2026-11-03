# 9 November 2026 — two-Event, four-Game owner proof of concept

**Scope:** two **ordinary competing** test members, one **noncompeting administrator/Emperor** managing an isolated test Season, two specially configured 1v1 test Events. Each Event contains **one designated BO1 warmup and one BO1 main Battle**, one genuine downloadable original `.aoe2record` per Game, four different original Game GUIDs, four canonical Battles. This does **not** alter the real 4v4 Lombardia Event's format. No unauthorized production/staging deployment or scoring activation.

## Preparation checklist

- [ ] An explicitly approved nonproduction testing environment, with versions of the web client, Functions, worker, source parser and current approved PR heads pinned. Check backup/rollback, auth, access, upload availability, Game start windows and server status before test day. CI success is not deployed software.
- [ ] Two separate real test identities: both active league members entered in the test Season and signed up separately for both Events. An Emperor/administrator is **outside** the two-person scored ladder, so neither participant is omitted from the ranking.
- [ ] Two Event configurations and schedules support actual approved 1v1 main Battles and paired 1v1 warmups; publish, register, check in and approve through normal authenticated flows. One warmup and one main **scoring slot per player per Event**. Do not bypass play or result authority.
- [ ] Download four distinct original human-vs-human recordings, keep original bytes and SHA-256 hashes, note true Game GUID, patch/build, replay names, map, civilization, actual source winner and source-recording attribution. Prefer the same two historical players across recordings for coherent longitudinal behavior.
- [ ] Admin-audited `adminBindReplayParticipants` resolves **observed names to the two test starter IDs BEFORE first accepted recording**, with a truthful test reason. It does not change raw replay slot/name/GUID or turn a downloaded player into a genuine league member. Reject a 2v2/4v4/FFA source, duplicate Game GUID, unmatched roster, or fabricated player identity.

## Exact score observations — approved Season Points V1

| Processed Battle | Winner | A Season Points | B Season Points | What to verify |
|---|---|---:|---:|---|
| Event 1 warmup | A | 3 | 1 | Warmup 1 participation + 2 win |
| Event 1 main | B | 7 | 11 | Main 4 participation + 6 win |
| Event 2 warmup | B | 8 | 14 | Independent second Event warmup |
| Event 2 main | A | **18** | **18** | Equal points, main wins (1/1) and warmup wins (1/1) |

The final player ladder is tied **rank 1** unless current approved scoring has an independently applicable additional rule. The Emperor is shown outside the two-player ladder. Both players have 2 wins / 2 losses. The combined earned points total is **36**. `functions/tests/nov9-two-event-standings.test.mjs` runs this through the real frozen reward writer and checks repeat idempotency.

**Correction case:** After four accepted results, correct the Event 1 main winner from B to A through the normal dispute/official result-revision flow. Expected A **24**, B **12**, main wins A 2 / B 0, warmup wins A 1 / B 1, **no fifth Battle** and no duplicate ledger credit. Restore original official outcome if part of the test plan and prove the original ladder recovers.

## Player-observed acceptance matrix

| Stage | Page or dispatch | Expected |
|---|---|---|
| Before play | Front-page Campaign cloth | Sign up, check-in and muster actions appear only for current signed-in member, then disappear when actually resolved |
| After approved Orders | Front-page Battle cloth | Open the correct Battle; do **not** announce 'Recording due' merely because an unplayed Game is READY |
| After genuinely finished Game with no active accepted recording | Crimson recording dispatch | Appears only when the official Game result and current detail confirm missing source; never while source processing or READY |
| Upload | Battle/Game Statistics | Verified source/Game identity, native AUTO status and individual measured results. Measure button click to visible READY. If outcome unresolved, result-based awards stay pending |
| Season/All-time | Statistics Hall | Correct Per-Battle independence, cumulative Game totals, Game provenance, eligible PB/records and compatible model; four Battles are **below the usual five-Battle qualified Season comparison threshold**, so no fabricated qualified cohort leader |
| After each accepted result | Season standing and player profiles | Exact score table above, W–L after completion, proper tie-breaks and Emperor seat distinction |
| New achievement | Owner's Chronicle personal leaf | Full current ACTIVE collection, only source/authorized award; new verified award shows gold banner and NEW seal until the leaf is viewed; no award from Battle/Event spotlight selection |
| Chronicle history | Pair leaf | Four concise factual entries for four accepted pair Battles, one each, not a compulsory dramatic story |
| Social and Personality | Private current-source progress | Two compatible independent Battles may expose genuinely supported axes (not necessarily all five); ordinary 1v1 may **not** prove Bond/Chivalry, stage-3 Rivalry, Hostility, mutual feelings or Treachery |
| Rare Chronicle question | Private Chronicle | Only current emulator-only eligible offered invitation prompts; skip/defer/decline no penalty, no public allegation. No fake invitation quota |
| One source/result correction | All affected views | New current revision replaces old observations, record holder recalculates, points reconcile, historical callbacks refresh only where dependent; no repeated awards, phantom Battles or cross-account leakage |
| Return/reload | Front-page dispatches | One banner per actionable item, two flags + More, source correction retracts stale state, owner-only achievement markers do not cross account; keyboard/mobile/reduced-motion work |

## Evidence and release boundary

- The 9 Nov exercise is a **two-Event functional pilot**, not completion of full 1v1/2v2/4v4/FFA acceptance #132 or separately measured p95 <20s in each format #143.
- Actual official achievements, trophies, Reputation/Relationship stage transitions, private Chronicle invitations and exceptional events **must remain Pending** until independently authorized current proof and grants exist. A fabricated example is not a valid unlock.
- Relationship **stage 3+ escalation/cooling** cloth is reserved in #236; current read state is not sufficient to prove a correction-safe transition. News requires an approved current announcement source. No speculative banners.
- Distinguish source-observed player actions from player feelings and intentions. The replay-name binding is an audited controlled *simulation* only.
- Record for every case: source hashes and Game IDs, viewed account, official result revision, screenshots of the exact UI state, expected/actual points and record selection, any pending/blocked method, errors and browser upload timing.

**Outcome:** POC PASS / PARTIAL / BLOCKED by subsystem. Review all new draft PRs and run exact-head CI before integrating; no merge, flags, staging/cloud activation or entitlement grants are implied by this checklist.

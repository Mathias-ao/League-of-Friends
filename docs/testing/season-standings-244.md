# Issue #244: Season standings and asynchronous refresh

Base: `c2eea748ee8bbef497f90f99dde7bff5eac7931f`. Continues the existing PR #253 handoff. No scoring formula, point writer, ledger masking, ranking tie-break or Emperor-office rule changes.

## Actual staging diagnosis, 21 November 2026

Read-only Firestore trace at 18:41 UTC used the existing authorized operator session against **age-of-friends-staging**, default STANDARD database. Private identifiers remain in local evidence; the public trace uses participant aliases.

All four original Battles across two Events (two main, two warm-up) and their Games were COMPLETED at canonical revision 1. Each Match had `scoringResultRevision=1`, `scoringState=COMPLETE`, and completed processing jobs without errors. The active Season matched all four; both participants were ENTERED.

| Participant | Main ledger units, each Event | Warm-up ledger units, each Event | Season units | Points |
|---|---:|---:|---:|---:|
| Competing player | 3360 | 840 | 8400 | 10 |
| Emperor | 8400 | 2520 | 21840 | 26 |

The unit scale is the existing **840 units per point**. Both standing balances exactly equal net ledger amounts. Best-warmup rows are Event-owned: `matchId=null`, with `sourceMatchId` identifying the selected Battle. Querying only `matchId` incorrectly appears to find no warm-up award.

The existing authenticated browser initially displayed Emperor 0 points and an empty player ladder. A hard reload of the same Season displayed Emperor 26 points and the competing player at rank 1 with 10 points. W–L stayed an em dash before and after reload. Thus this cohort's missing-points symptom is confirmed client staleness; missing awards, enrollment and masking do not explain this observed case. No data repair or extra award is warranted.

## Change and boundaries

Bootstrap now supplies canonical eligible **Battle** wins/losses, separately from point-selected warm-up counters. A multi-Game Battle counts once; every genuine eligible warm-up can contribute to its record even if only one earns Event points. Manual canonical outcomes do not acquire a new replay requirement. Recording-bound outcomes require a current READY source, exact statistics revision and participant mapping; series require the existing exact Game revision manifest. W–L Game/source reads share a transaction and reject changed Match snapshots.

The Firebase repository already passes bootstrap rows directly into `snapshot.standings`; no mapping change is necessary. SeasonView renders the supplied W–L and adds a manual refresh. App performs five non-overlapping foreground refreshes over approximately 110 seconds, restarts on view/focus return and after actions, and cancels on leaving the view or unmount. Preview/hidden/busy states avoid background loads. Existing generation/auth fences prevent stale account responses from restoring another viewer.

The ordinary original-upload emulator harness includes a bootstrap record assertion. Controlled tests separately cover two Events/main/warm-up, Event-owned ledgers, duplicate processing, correction/dispute/withdrawal, missing standings, manual results, multi-Game Battles, source revisions, authentication and refresh/account changes. Controlled fixtures do not substitute for a new deployed browser acceptance run.

## Staging requirements after separate release approval

1. Independently review this exact PR head and its CI, including genuine ordinary-upload acceptance. Keep #244 open until deployed acceptance; no auto-merge or deployment is authorized here.
2. Verify served web and bootstrap backend pins separately after an authorized release. Preserve the existing point writers, IAM, source flags and Emperor seat.
3. With the existing four originals, verify fresh bootstrap and Season UI show the actual 26/10 balances, fixed Emperor office, player rank 1 and canonical 4–0 / 0–4 records. Record the response and ordinary browser evidence privately with redacted public conclusions.
4. Exercise an authorized genuine asynchronous result/correction: remain on Season and confirm the bounded refresh catches completion; repeat with focus return and the manual refresh after the window expires. Processing longer than the finite window requires focus/manual refresh; this is intentionally not perpetual polling.
5. Verify duplicate delivery changes neither point ledger nor W–L; check pending/disputed/withdrawn/VOID outcomes, requalification, and a genuine multi-Game series. Do not manufacture points or seed production data for a PASS.

Sol is the independent reviewer. Actual corrected staging UI acceptance remains pending until a separately approved deployment and verification.

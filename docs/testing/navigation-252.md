# #252 immediate detail navigation — bounded verification

Base: `925101bc63434d96eabc0ae1f0211c7824417c0c`. Sole implementation:
Codex worker `01a146a9-2d62-7831-9118-2b4c33de62c5`,
`fix/immediate-detail-navigation-252`.

## Diagnosis and change

Reuse Sol's [measured dependency baseline](https://github.com/Mathias-ao/League-of-Friends/issues/252#issuecomment-7076386723):
App awaited a full detail before opening, and Event details unconditionally
awaited transactional Roundoff. This PR moves selection before remote resolution,
uses explicit summary/minimal shells, and retains loaded DTO authority for actions.
No full DTO is manufactured from a summary. Profile public records, existing
private Personality and hosted social reads are independently presented/retryable.
Chronicle's existing full-profile dependency remains localized pending; its
reader and source semantics are unchanged. Battle controls wait for the existing
full Match DTO; existing per-Game Statistics and source readers remain unchanged.

The existing Event callable accepts optional `essential` or `roundoff` sections.
The omitted/default response stays compatible. Both explicit paths retain ACTIVE
linked membership and DRAFT visibility, and revalidate actor/Event version before
returning. The existing Roundoff projection/transaction is unchanged. Roundoff is
requested on tab selection (including keyboard navigation), or for an actual
multiple-warmup counted-selection note; failure/Retry does not block Briefing or
Battles. No extra callable/export or feature gate is introduced.

Only in-flight reads coalesce, in an eight-entry App-owned map. Settled responses
are evicted; reopening revalidates authority rather than trusting a completed
cache. UID, player/role, Season, relevant entity/result/source-summary revisions,
refresh generation, close/back and late responses fence presentation. The selected
viewer must match loaded action authority. Existing social partial/quiet/null
semantics and 125s SDK timeout are preserved. The bootstrap's existing bounded
abort retries and standings renewal remain, with an additional SDK UID check.

Measured large-history rendering also justified retaining the unchanged archive
beneath a detail modal and rendering the profile Battle carousel in batches of12.
All selected-player Battles remain reachable using Show more; unrelated players'
Battles are excluded. This is rendering work only, not a second history projection.

Exact additional Event seams were released by [Sol7095060943](https://github.com/Mathias-ao/League-of-Friends/issues/252#issuecomment-7095060943).
Entity-scoped Game/tab choice props were released by [Sol7096111479](https://github.com/Mathias-ao/League-of-Friends/issues/252#issuecomment-7096111479).
The remaining scope uses [the exclusive shared-file handoff](https://github.com/Mathias-ao/League-of-Friends/issues/252#issuecomment-7086185100).
No scoring, policy/evaluator, source-admission/parser, IAM/config or deployment changes.

## Local before/after observations

Controlled React/JSDOM commit observations, NOT browser layout/paint, hosted RTT,
Firebase latency, p95 upload performance (#143), or staged acceptance. Each cell
is **p50/p95 milliseconds**, n=10 per condition. Detail responses are withheld for
80ms; the Battle Statistics response and on-demand Roundoff each add a further
80ms when requested. Five and200 canonical Battle summaries span two Seasons.
Cold means a fresh mounted App; warm means reopening within that App, not a real
browser/network cache. The baseline uses pinned App/profile source with a JSX
runtime import and compatible shared detail components; no baseline gameplay or
read semantics are rewritten.

Shell is the first open-dialog observation; essential is the full authorized
DTO commit. Secondary is the requested Roundoff tab, Battle Statistics completion,
or public profile records; unapproved private runtime APIs are disabled in this
latency fixture and tested separately with controlled promises. On-demand Event
Roundoff intentionally moves work after selection, so full secondary readiness
can take longer while shell/controls stop waiting. These results establish no
hosted millisecond SLA. The structural budget is zero awaited remote dependencies
before shell; a real staged numeric budget still needs operator/Sol observation.

| Detail | Battles | Condition | Shell before → after | Essential before → after | Secondary before → after |
| --- | ---: | --- | --- | --- | --- |
| event | 5 | cold-mount | 109.86/134.23 → 7.09/17.49 | 109.86/134.23 → 96.69/132.47 | 116.78/143.04 → 191.40/236.19 |
| event | 5 | warm-reopen | 103.28/112.71 → 6.04/6.27 | 103.29/112.71 → 102.37/108.05 | 110.49/119.50 → 196.91/213.85 |
| match | 5 | cold-mount | 96.86/108.26 → 5.95/7.06 | 96.86/108.26 → 92.96/95.84 | 186.91/197.97 → 188.19/192.55 |
| match | 5 | warm-reopen | 100.94/103.51 → 5.19/5.55 | 100.94/103.51 → 98.26/100.70 | 191.39/194.13 → 193.03/197.34 |
| player | 5 | cold-mount | 105.22/114.51 → 23.40/42.41 | 105.22/114.51 → 91.92/96.43 | 105.22/114.51 → 91.92/96.43 |
| player | 5 | warm-reopen | 108.76/114.24 → 21.18/24.86 | 108.76/114.24 → 96.32/97.10 | 108.76/114.24 → 96.32/97.10 |
| event | 200 | cold-mount | 110.60/121.00 → 7.80/8.64 | 110.61/121.00 → 96.09/106.19 | 117.32/128.46 → 193.07/210.08 |
| event | 200 | warm-reopen | 102.14/115.95 → 7.08/8.71 | 102.14/115.95 → 102.50/105.52 | 109.62/123.17 → 197.14/213.97 |
| match | 200 | cold-mount | 163.97/379.16 → 10.48/18.40 | 163.97/379.16 → 91.32/98.97 | 259.26/467.70 → 187.90/195.19 |
| match | 200 | warm-reopen | 145.96/379.46 → 7.94/14.70 | 145.97/379.46 → 97.02/98.97 | 234.89/465.91 → 194.37/196.56 |
| player | 200 | cold-mount | 193.01/318.46 → 35.22/41.55 | 193.01/318.46 → 93.92/108.36 | 193.01/318.46 → 93.92/108.36 |
| player | 200 | warm-reopen | 197.56/303.04 → 35.27/36.89 | 197.56/303.04 → 95.95/108.09 | 197.56/303.04 → 95.95/108.09 |

Repository calls per navigation: Event1 essential call (legacy1 full call), plus1
on-demand Roundoff call if requested; Battle1 detail+1 Statistics; Player1 public
records call, with independently gated owner-private calls only when permitted.
The fixture observed one bootstrap load; detail opening does not restart it.

The controlled read-operation fixture with one missing active source per Game
produced full Event30/165/615 operations for5/50/200 Event Matches, versus13 for
each essential read. It counts reference/query/transaction get operations, NOT
billable documents, bytes or a claim of constant document reads: the Event-scoped
Match roster still grows with that Event. The old Roundoff alone was5+3M operations
in Sol's baseline; these full-call counts additionally include Event authority and
participation reads. Explicit sections add narrow actor/Event revalidation reads;
requesting all sections is not advertised as reducing total billed cost.

Reproduce from web: `node --import ./tests/register-assets.mjs --import tsx tests/detail-navigation-benchmark.mjs --baseline`
and the same without `--baseline`. `AOF_NAV_SAMPLES` selects local repetitions.
The script removes only the temporary baseline modules it creates. Raw local
reports are review evidence, not deterministic golden performance tests.

## Regression and release boundaries

Same-entity refresh/Retry retains only the selected Game ID or Event tab, while
unmounting old authority. A missing Game falls back to a fresh valid Game, tested
through the actual draft command target. A retained Roundoff tab issues a new
section read; old sections cannot satisfy it. Different entity/account/close resets
choices. Default uncontrolled preview/detail callers retain their behavior.

Focused tests also cover actual-App RSVP and Battle command failures inside the
active modal, successful recovery, late-failure rejection across selection/account
changes, and an exhausted post-command bootstrap abort followed by a league refresh
without command resubmission. Action errors remain distinct from section-read errors.

Focused tests cover unresolved/failed independent sections, local Retry, preview/
older-repository fallback, wrong entity/viewer, same-ID coalescing, source/result/
Season/role changes, logout/account switch before callback delivery, close/back,
BO3 and reused Game IDs across Battles, and bounded selected-player history.
Backend tests exercise the actual callable/default projection and authorization,
invalid section values, unavailable Roundoff, final revocation/version fences and
scaled operation counts. Existing full suites/genuine-source CI remain required
on the exact PR head; their results are recorded in the PR.

Staging is **not verified** by this change. Under a separately authorized release,
measure real cold/warm click→shell, essential paint and each secondary section,
request/read volumes/errors on representative old/new Events, BO1/BO3, long
Chronicles and multiple Seasons; test slow/offline, correction/withdrawal/dispute,
account/role/membership changes and keyboard/back/close. Preserve all eight-system
source/privacy preflight gates. No cloud mutation, activation or deployment is
performed by these tests or this report.

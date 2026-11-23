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
| event | 5 | cold-mount | 109.86/134.23 → 7.09/17.42 | 109.86/134.23 → 96.16/117.05 | 116.78/143.04 → 189.88/219.19 |
| event | 5 | warm-reopen | 103.28/112.71 → 6.05/6.75 | 103.29/112.71 → 101.91/108.04 | 110.49/119.50 → 196.39/213.32 |
| match | 5 | cold-mount | 96.86/108.26 → 5.95/7.07 | 96.86/108.26 → 93.88/96.02 | 186.91/197.97 → 191.43/194.16 |
| match | 5 | warm-reopen | 100.94/103.51 → 5.13/6.02 | 100.94/103.51 → 98.37/100.70 | 191.39/194.13 → 195.65/198.59 |
| player | 5 | cold-mount | 105.22/114.51 → 21.67/27.52 | 105.22/114.51 → 93.23/98.06 | 105.22/114.51 → 93.23/98.06 |
| player | 5 | warm-reopen | 108.76/114.24 → 20.45/28.94 | 108.76/114.24 → 96.52/97.58 | 108.76/114.24 → 96.52/97.58 |
| event | 200 | cold-mount | 110.60/121.00 → 7.30/8.06 | 110.61/121.00 → 97.21/106.78 | 117.32/128.46 → 191.93/202.01 |
| event | 200 | warm-reopen | 102.14/115.95 → 6.89/9.54 | 102.14/115.95 → 100.93/102.56 | 109.62/123.17 → 196.33/198.19 |
| match | 200 | cold-mount | 163.97/379.16 → 10.03/14.70 | 163.97/379.16 → 91.88/99.95 | 259.26/467.70 → 183.73/197.43 |
| match | 200 | warm-reopen | 145.96/379.46 → 7.35/7.50 | 145.97/379.46 → 97.50/99.40 | 234.89/465.91 → 193.03/197.25 |
| player | 200 | cold-mount | 193.01/318.46 → 34.97/48.95 | 193.01/318.46 → 102.85/109.45 | 193.01/318.46 → 102.85/109.45 |
| player | 200 | warm-reopen | 197.56/303.04 → 35.35/40.71 | 197.56/303.04 → 96.28/99.70 | 197.56/303.04 → 96.28/99.70 |

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

# Personality V1 approved private policy — #245

Base: `c0cafda77513913518c7177f1375637df554e1b1` (merged navigation #259).
Single implementation task: `01a146a9-2d62-7831-9118-2b4c33de62c5`;
branch `feat/personality-v1-approved-245`.

## Immutable gameplay decision and separate runtime gate

[Owner D2 decision](https://github.com/Mathias-ao/League-of-Friends/issues/245#issuecomment-7097019706)
approves `AOF_PERSONALITY_V1_PRACTICAL_SOURCE_PROXIES_1` /
`AOF_PERSONALITY_V1_PRACTICAL_SOURCE_CONFIG_1`.
`functions/src/engines/personalityV1/practicalPolicyResource.ts` exports the exact
canonical, recursively key-sorted JSON UTF-8 bytes, including terminating LF:
**3562 bytes**, SHA-256
`7ec5d2dce94eb6e04e0a5f3a1130b54fc0b890489ffa7bb652996e136e32083c`.
Sol independently verified these bytes/semantics in
[early review7097619918](https://github.com/Mathias-ao/League-of-Friends/issues/245#issuecomment-7097619918).

This is real gameplay approval, not runtime activation. The fixed read-only
resolver defaults off. It requires a separately authorized staging private
runtime record bound to this resource/hash, an independent runtime release
reference, exact project/scope and current source-quality reviews. No runtime
record, source registry, flag, IAM setting or deployment is provisioned here.
The old demo-only policy/guards remain unchanged and cannot authorize hosted
numbers. A bare APPROVED label cannot authorize the private SHARED_1 adapter;
only its frozen server-created policy configuration has that authority.

## Existing evaluator and source qualification

The sole existing Personality/playstyle evaluator remains responsible for all
formulas. Each required Game must pass its own source/axis checks. Complete
compatible series contribute the mean Game fraction once per canonical Battle.
The approved scale is 100 times a valid fraction/normalized entropy. Career
median has weight .75; median of the most recent up to three comparable Battles
has weight .25, ordered by accepted canonical chronology. Internal values retain
full precision through the same evaluator; only UI display rounds to an integer.
Omitted/false precision options preserve all existing callers' rounding.

| Axis | Qualified observation | Source requirements |
| --- | --- | --- |
| A | Military positive-cost request resources / all positive-cost request resources | Complete observed interval, both unpriced counts zero, positive bounded denominator, exact recording build/product/catalog applicability |
| B | Unique forward strategic placements / home+forward placements | Exact-build reviewed strategic IDs, source-linked positions/clock, initial TC, reviewed ordinary land/start context, at least four eligible observations per required Game |
| C | Contested command episodes / qualified economy-directed+contested episodes | Complete hydrated Raid V3/Engagement V4, reviewed actor attribution, valid targets/clock, distinct producer groups and nonoverlapping source events, at least two episodes per required Game |
| D | Shannon queue-family entropy / ln(available eligible families) | Exact build/civ/game opportunity, at least two genuinely available families including unchosen alternatives, reconciled positive quantities and no unknown amounts |
| E | Distinct remote economic clusters / clusters+home economic placements | Initial TC, reviewed map/start/build-specific sites/catalogue, unique supported cluster/event identities, at least six combined units per required Game |

Source reviews bind the complete current SourceSnapshot fingerprint, including
original SHA/GUID, mapping, authority/statistics revisions and artifact digests /
generations. Missing/mismatched proof cannot inherit another build's taxonomy.
A's applicable catalogue review is independent of spatial/family opportunities.
Spatial/command/family qualification currently fails closed outside reviewed
ordinary LAND/standard contexts; no water/special-start equivalence is inferred.
A missing axis never vetoes an independently qualified one.

Presentation requires three distinct accepted original Games AND three complete
canonical source-qualified Battles. Numeric axes separately require two qualified
comparable Battles. Raw measurement count is exposed separately from comparable
count. Duplicate POV/GUID cannot add a sample. Both gates apply to every approved
private profile value, including the internal profile returned to its owner.

Existing authenticated collection, source/mapping/artifact authorization, manifest,
GUID and accepted-order fences are preserved. The final transaction revalidates
source/access/order plus the exact runtime/source-review record before returning.
No scores are persisted and no other gameplay system or public profile changes.

## Evidence and remaining staging limitation

`personality-practical-policy.test.mjs` and the authenticated history tests cover
all five formula qualifications, legitimate zeros, B4/E6 per required Game,
BO3/missing siblings, catalog/build/proof mismatch despite zero unpriced counts,
C duplicate canonical groups vs genuinely distinct controlled groups, missing
family opportunity, full precision, comparable-vs-raw counts, mixed contexts,
chronology, idempotency, withdrawal/retraction and runtime/membership revocation.
Mounted owner UI tests cover integer display, factual explanation, comparable
count, Developing reasons, logout/account switch and delayed-response rejection.

The unchanged genuine parser rehashed/reparsed the three T90 originals locally.
Their A fractions are 2159/7909, 18003/32538 and 19100/40225. The new approved-policy
original-source test gets 100*(19100/40225) using those real measurements plus
explicit isolated TEST canonical/authority metadata envelopes and an applicable
build185872/no-mod base-request catalogue witness. This is **not** a hosted owner
history or a retained native-artifact admission witness. The same real measurements
without applicable review remain null. The existing actual native AUTO/authenticated
two-original emulator separately retains its admission, pending result, withdrawal,
privacy and too-few-Games/one-Battle negatives; demo guard restrictions are unchanged.

B/E genuine raw positives (including B's actual 0/12) are retained, but those three
originals lack hosted exact-source spatial reviews, so the approved path leaves
B/E Developing. Genuine C/D opportunities remain absent, so no genuine positive
for either is claimed. Controlled formula positives are labelled as controlled.

The operator's actual current four-recording source/build/cost/opportunity matrix
is still unknown. No score or per-axis qualified count for those real owners is
claimed. Implementation does not wait for that matrix. Before a separately
authorized D staging release, verify it privately, review exact worker/catalog /
source compatibility and runtime resource/hash/rollback, then exercise real owner
browser values/Developing, correction/retraction and outsider/logout/account-switch
cases. Local tests/emulators are not staging verification or owner E2E acceptance.

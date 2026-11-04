# 9 November 2026 — two-Event, four-Game owner proof of concept

**Binding owner correction, 4 November:** the planned browser inputs are four **newly downloaded, distinct original 1v1 recordings**. Historical players and names may differ in every Game. The two approved AoF accounts are controlled test identities, not a claim that unrelated historical humans changed aliases. The repository originals below are fallback fixtures only. Their 18–18 regression is not the expected score of the new recordings. Source inspection and mapping must precede any pilot winner/standings prediction.

**Scope:** two **ordinary competing** test members, one **noncompeting administrator/Emperor** managing an isolated test Season, two specially configured 1v1 test Events. Each Event contains **one designated BO1 warmup and one BO1 main Battle**, one genuine downloadable original `.aoe2record` per Game, four different original Game GUIDs, four canonical Battles. This does **not** alter the real 4v4 Lombardia Event's format. No unauthorized production/staging deployment or scoring activation.

## Preparation checklist

- [ ] An explicitly approved nonproduction testing environment, with versions of the web client, Functions, worker, source parser and current approved PR heads pinned. Check backup/rollback, auth, access, upload availability, Game start windows and server status before test day. CI success is not deployed software.
- [ ] Two separate real test identities: both active league members entered in the test Season and signed up separately for both Events. An Emperor/administrator is **outside** the two-person scored ladder, so neither participant is omitted from the ranking.
- [ ] Two Event configurations and schedules support actual approved 1v1 main Battles and paired 1v1 warmups; publish, register, check in and approve through normal authenticated flows. One warmup and one main **scoring slot per player per Event**. Do not bypass play or result authority.
- [ ] Download four distinct original human-vs-human recordings, keep original bytes and SHA-256 hashes, and inspect true Game GUID, patch/build, replay names, slots, teams, settings, observed outcome and recording attribution. Different historical players across Games are expected and allowed.
- [ ] Approve exactly two AoF starters for each Game. Try ordinary upload before binding: a unique matching current Steam name/history may resolve automatically; unknown or ambiguous names must fail safely. Do not manufacture a verified Steam alias to force an automatic-match positive.
- [ ] For an unfamiliar name, the Emperor inspects the exact original slots/settings, opens **Battle controls → Resolve recording names**, supplies a review reason, and binds the observed names to the approved starters. Verify the `REPLAY_IDENTITIES_BOUND` audit. The participant retries the **unchanged original** through ordinary AUTO upload. Repeat independently per Game.
- [ ] `adminBindReplayParticipants` establishes a pre-acceptance **Game-specific** binding. It does **not** add an alias to permanent Steam name history or authorize it for another Game. Preserve source names/slots/GUID/hash. Reject foreign participants, duplicate slots/names, reused GUIDs, unauthorized or late rebinding and incompatible roster/settings.

## Source manifest and actual expected standings

After the four new originals are available, create an explicit four-row plan with the two approved test IDs, each source file, Event/act, original replay-slot mapping and announced Game configuration. Run the read-only `scripts/nov9-pilot-report.mjs` utility as described in [the browser runbook](nov9-browser-runbook.md). It freshly inspects original bytes using the existing decoder and computes expected standings with the existing result and reward engines. Retain its source hashes, GUIDs, original names/teams/settings, per-Game mapping, outcome qualification and cumulative points/ranks alongside browser evidence.

Unresolved or unsupported source outcomes stay Pending until an exact-source Emperor review establishes the real outcome. A calculated source outcome is a preflight oracle, not proof that ordinary upload or browser rendering passed. Recompute after an actual supported source/result correction. The owner's new-input manifest, results and browser acceptance are **PENDING INPUTS / NOT RUN** until those files and an authorized environment exist.

## Known four-original backup fixture set (checked into repo)

These are genuine source bytes, not invented test Games. The exact SHA-256, independent GUID, original player name/slot, source resignation and postgame clock are asserted by `functions/tests/nov9-original-fixtures.test.mjs`.

| Event/act | Original file in `replay-fixtures/` | Observed map / build | Bind actual original source name → **simulation only** | Source winner / test winner |
|---|---|---|---|---|
| E1 warmup | `1v1_1.aoe2record` | map ID 9 / 180059 | T90Official → A; Mr Greed → B | T90Official → A |
| E1 main | `aof-test-game-1.aoe2record` | map ID 140 / 185872 | NOC \| Target331 → A; T90Official → B | T90Official → B |
| E2 warmup | `aof-test-game-2.aoe2record` | map ID 140 / 185872 | NOC \| Target331 → A; T90Official → B | T90Official → B |
| E2 main | `aof-test-game-3.aoe2record` | map ID 9 / 185872 | T90Official → A; Mununez → B | T90Official → A |

**Do not use** `1v1_2.aoe2record` as a fifth distinct Game: it has the *same Game GUID* as `1v1_1.aoe2record`, just the other recorder's POV.

**Honesty:** this fixed 18–18 regression varies the historical actor assigned to each test identity. The four actual winners remain T90Official; no observed result is reversed. The resulting A/B longitudinal history is a controlled identity-binding simulation. It does not prove those historical people changed their names. The owner is not required to download the same historical player, use these files, reproduce a tie or use any alternative fixed score. Never export simulated history to production.

**Configuration preflight:** the accepted Game must announce source-true map ID 9 or 140, version-compatible victory/settings and actual teams; warmup and main Game configurations may differ by approved schedule. Map ID 140's human display name must be verified from the authoritative map registry before naming it publicly. The current outcome resolver supports only carefully admitted versions/settings and may leave some sources in `PENDING_ADMIN_REVIEW`. Only authenticated source-bound Emperor review with the real outcome may settle them; never bypass with a fabricated result merely to display points. Recorded original play dates remain their historical dates; scheduling in this POC is an explicitly synthetic arrangement and should not claim actual November competition.

### Security and release note

These four files are a **backup** for the owner's preferred newly downloaded originals; they avoid a scramble if external downloads are unavailable. They are enough for an original-byte *preflight*, not proof that the native upload worker, correct Event map/victory configuration, auth, deployment, timestamps and browser READY display will work on November 9. Check the current deployed flags/allowlist and test host under a separately approved environment window. Retain independent genuine source hashes and preserve corrections.

## Fixed controlled regression only — approved Season Points V1

The following oracle belongs only to the committed A/B regression. For the real pilot use the new recordings' actual accepted outcomes and slot mappings. A different winner sequence produces different points, wins/losses and ranks.

| Processed Battle | Winner | A Season Points | B Season Points | What to verify |
|---|---|---:|---:|---|
| Event 1 warmup | A | 3 | 1 | Warmup 1 participation + 2 win |
| Event 1 main | B | 7 | 11 | Main 4 participation + 6 win |
| Event 2 warmup | B | 8 | 14 | Independent second Event warmup |
| Event 2 main | A | **18** | **18** | Equal points, main wins (1/1) and warmup wins (1/1) |

The final player ladder is tied **rank 1** unless current approved scoring has an independently applicable additional rule. The Emperor is shown outside the two-player ladder. Both players have 2 wins / 2 losses. The combined earned points total is **36**. `functions/tests/nov9-two-event-standings.test.mjs` runs this through the real frozen reward writer and checks repeat idempotency.

**Controlled correction regression:** the synthetic reward-writer fixture changes Event 1 main B→A and expects A24/B12, then idempotency. This does not authorize changing a real recording winner. For the browser pilot choose a source withdrawal/restoration or a correction supported by original evidence through the existing authorized review flow. Record actual resulting eligibility, points and ranks; preserve every genuine observed winner. There must still be four canonical Battles and no duplicate credits.

## Player-observed acceptance matrix

| Stage | Page or dispatch | Expected |
|---|---|---|
| Before play | Front-page Campaign cloth | Sign up, check-in and muster actions appear only for current signed-in member, then disappear when actually resolved |
| After approved Orders | Front-page Battle cloth | Open the correct Battle; do **not** announce 'Recording due' merely because an unplayed Game is READY |
| After genuinely finished Game with no active accepted recording | Crimson recording dispatch | Appears only when the official Game result and current detail confirm missing source; never while source processing or READY |
| Upload | Battle/Game Statistics | Verified source/Game identity, native AUTO status and individual measured results. Measure button click to visible READY. If outcome unresolved, result-based awards stay pending |
| Season/All-time | Statistics Hall | Correct Per-Battle independence, cumulative Game totals, Game provenance, eligible PB/records and compatible model; four Battles are **below the usual five-Battle qualified Season comparison threshold**, so no fabricated qualified cohort leader |
| After each accepted result | Season standing and player profiles | Dynamic manifest's actual source/mapping-based expected points and W–L, proper tie-breaks and Emperor seat distinction; fixed 18–18 applies only to its controlled regression |
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

**Outcome:** record PASS / PENDING / BLOCKED by subsystem. Existing controlled regressions and source preflight are separate from actual new-recording identity acceptance and browser results. Source review/merge is authorized by the owner's 4 November instruction; deployment, protected staging/flags/cloud resources and public award grants still require separate approval.

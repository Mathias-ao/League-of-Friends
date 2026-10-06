# Social incident interpreter V1: implemented shadow pilot

Implemented 6 October 2026 on feat/pair-social-evidence-v1. Design authority:
[revision 4](social-incident-policy-v1-proposal.md). This is a testable additive
interpreter, not activation of official Reputation/Relationships or a deployment.

## Implemented behavior

- One portable engine, functions/src/engines/socialIncidentCore.js, shared by the
  backend, website, Replay Lab and CLI; functions build copies it to lib.
- Source/manifest/roster checks, full timestamp/ordinal chronology, duplicate and
  conflicting-reference handling; no stats or canonical mutation.
- Declared truce formation/withdrawal, initiating/response/contested/unknown context,
  known-continuity association and explicit generic-targeted-order candidates.
- Per-family MATCHED/NOT_MET/UNAVAILABLE/NOT_APPLICABLE/UNCONFIGURED_POLICY decisions.
- Fixed-team support/common-target Bond candidates from supported versioned episode
  evidence, plus accepted mapped human duel Rivalry. Scope remains command-derived
  participation: no completed rescue, coordination intent, hits or kills.
- Typed admitted-qualifier interface for substantive aid, offensive attempts and
  the approved king-loss exception. Registry is EMPTY in default server rules.
  Tests admit a controlled test-only qualifier; this is not game-engine qualification.
- Independent Bond/Chivalry consumers for qualified material-aid instructions;
  recorded-breach Hostility and limited economic-betrayal Cruelty tiers after their
  gates. Single economic unit may qualify; structures/mixed roles remain gated.
  Prior cooperation cannot be backfilled from later help. Known responses earn no
  initiating-betrayal award. Unknown local self-defense is not labeled unprovoked.
- Aggregate per-actor/track/Battle shadow budgets spanning all victims/families;
  pair-specific Relationship budgets. No counterpart-repeat damping or click rewards.
- Rebuild of complete supplied active chapters: identical duplicates, latest result
  revisions, void/dispute replacement, source-context conflicts, pair exposures,
  ordinary 1/2/3-Battle stage gates and track-specific reciprocity.
- Approved king-loss directed escalation is implemented behind qualified-input
  gates. It bypasses ordinary caps, deduplicates each victim/responsible-actor
  king-loss episode, uses the historical event cutoff, and never creates mutual Feud
  or automatic Cruelty. No real replay's king loss is qualified by this pilot.

Shadow magnitude is one ordinary unit, budget one per track/Battle, ordinary stages
at one/two/three distinct Battles (third requires independent reciprocity), maximum
exceptional stage four by default. Configurations are explicitly versioned proposals,
not approved production progression. No fourth ordinary stage is configured.

## Read surfaces

getReplayStatistics returns socialIncidents separately from the unchanged stored
statistics artifact. Battle record adds a recording-player filter, withdrawals,
source references, candidate orders, decisions and exposure. Sampling examples never
become league history.

getSocialHistory is an authenticated read-only callable. It reads current completed
Battle/Game outcomes, active READY artifacts, hashes and authoritative mappings;
uses recorded Game sequence, rebuilds shadow history, and checks for concurrent
correction/dispute changes before returning. Missing sources are PARTIAL with explicit
exclusions, never peacefulness or complete opportunity coverage. It currently caps
at 100 completed Battles and fails rather than returning truncated stages. It writes
no score, reward, War Room, relationship or player document. Player profile's Chronicle
has an expandable Social history shadow view. Functions need emulator/deployment to
exercise this live read; branch publication alone is not deployment.

Replay Lab adds Social incidents below Military. Restart after pulling. Existing
statistics are sufficient; no source re-upload, schema change or recalculation is
required for this read projection. Default unmapped recording participants accrue
no shadow persistent contributions. An AI-like human name never implies AI.

CLI:

```powershell
node scripts/review-social-incidents.mjs --statistics path/to/statistics-current.json --out social-review.json
```

The CLI rejects output that would overwrite its input. It requires no Functions
build or additional dependency, and cannot activate server awards.

## Remaining gates and deliberate omissions

The default registry does NOT claim generic ORDER is a weapon attack, promote
runtime effective diplomacy, classify every produced target, validate tribute
semantics, derive live disadvantage, assign king responsibility or establish final
two survivors. Gallantry's daring-context qualifier, economic structures/materiality
for stronger tiers, and outcome-based severity remain unavailable.

The ledger currently rebuilds positive ordinary progression and the gated exceptional
rule. Configured event-driven Bond damage/Hostility cooling, higher ordinary stages,
reputation title unlocks, historical rating/underdog achievements, aggregate conduct
ratios and official contribution persistence/activation remain successor work. Current
and historical ordinary stage fields coincide while no negative transition is active;
no inactivity/absence cooling is invented. Official legacy social state is not replaced.

Expected-deception interpretation is accepted as context by the pure interpreter,
but no new event preset administration or automatic header-derived expectations are
introduced. The live getter uses default shadow interpretation; later configured
presets need an authoritative event-snapshot adapter. No visibility/ranking changes.

## Sanity check and fixes

Full FFA_diplo current statistics: 83 directed orders, 23 Ally-declaration withdrawals,
28 co-present pairs; 12 initiating breaches, ten responses and one unresolved withdrawal.
Seventy associated targeted ORDER candidates, zero independently qualified offensive
attempts and zero fabricated social awards. These counts cover the recorded interval;
not all actual interactions. Halvar's 57:42 changes remain initiators; TURK/Mihai's
12-14-second replies remain responses. First 1:05:00 chronology still has 74 commands.

The committed regression fixture retains real command chronology and abbreviated
positive target context at the same replay/manifest hashes. It is not full combat
coverage or a semantic qualification fixture. Full-recording sanity uses the CLI.

Sanity review fixed: stale-campaign response attribution after a renewed truce;
disabled policy re-awarding during rebuild; unmapped/AI duel eligibility erasing
valid command chronology; contradictory source bounds; cross-pair facet attribution;
prototype-like malformed modes; and concurrent authoritative revision reads.

Verification: 92 backend tests, 42 website tests, 19 Replay Lab tests, and 256 Python
replay tests pass (four explicit opt-in Python skips). Backend and website builds
pass; player callable-boundary checks pass. A real HTTP Replay Lab test verifies
source-backed responses, shared module serving and byte-identical stored statistics.
Semantic fixtures cover registry admission, single target, genuine reciprocal aid,
post-rupture aid, Neutral/unknown/restored intervals, contested chronology, caps,
POVs/retries, corrections, disputes and exceptional directed escalation. No unrelated
statistical golden or extraction formula was changed.

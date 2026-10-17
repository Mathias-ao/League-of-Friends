> **Research archive (17 October 2026).** This is the worker's original read-only investigation, preserved for traceability. It is not an approved scoring rule, implemented capability, deployment report, or activation decision. See [the integrated V1 launch roadmap](../project/SOCIAL-V1-LAUNCH-ROADMAP-2026-10-17.md) for current conclusions and precedence.

# Age of Friends V1 — Executed-Action Evidence Feasibility

## Executive finding

The smallest credible path to automated social progression is to add narrowly scoped execution witnesses, not to reconstruct an entire Age of Empires II match.

The central distinction is between a recorded player command and a verified resulting state change. Some gameplay actions may be provable from independent observations already available or obtainable from a controlled game-engine replay. Others, particularly combat materiality and historical disadvantage, require additional state evidence.

### Verified starting point

| Item                    | Result                                                   |
| ----------------------- | -------------------------------------------------------- |
| Repository              | `Mathias-ao/League-of-Friends`                           |
| Current `main`          | `25f120412df5ed0118b9557cdf822ab175108242`               |
| Starting SHA            | Matches current main                                     |
| Latest merged milestone | PR #120 — Social Evidence V1a                            |
| V1b baseline            | No automatically qualified substantive deeds established |
| Investigation scope     | Research only; no production changes                     |

I found the repository's replay foundation, controlled-fixture specifications and parser code. The specific previous Codex report and source-witness JSON were not available among the accessible files, so I am treating the supplied 14 positive tribute requests, 392 zero controls and C8 observation as the fixed baseline—not claiming to have independently reproduced their underlying binary offsets.

## Investigation 1 — Tribute: what does `DE_TRIBUTE` mean?

### 1.1 Upstream semantics

The repository uses the `mgz-fast` decoding path. I inspected the upstream decoder in [`mgz/fast/__init__.py`](https://github.com/happyleavesaoc/aoc-mgz/blob/master/mgz/fast/__init__.py?utm_source=chatgpt.com) and [`mgz/fast/actions.py`](https://github.com/happyleavesaoc/aoc-mgz/blob/master/mgz/fast/actions.py?utm_source=chatgpt.com).

There are two relevant DE layouts:

| Layout                   | Decoded content                         | Important limitation                        |
| ------------------------ | --------------------------------------- | ------------------------------------------- |
| Earlier DE action layout | Sender, recipient, four resource floats | Unknown fields not semantically established |
| Newer DE action layout   | Four resource floats, recipient         | Separate cost and attribute fields skipped  |

The newer layout reads `wood`, `food`, `gold`, `stone`, then advances past 16 bytes identified in the decoder comment as `cost[4]`, followed by 8 bytes of attribute identifiers. The existence of those fields is a useful binary lead, but their precise meaning is not proven by the decoder comments.

The AoF code in [`canonical_projector.py`](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/replay-tools/canonical_projector.py?utm_source=chatgpt.com) projects the decoded tribute operation. [`economy_statistics_v5.py`](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/replay-tools/economy_statistics_v5.py?utm_source=chatgpt.com#L144-L211) explicitly states that fees and tax effects are not simulated.

That supports the following distinctions.

| Claim                                       | Current proof                            |
| ------------------------------------------- | ---------------------------------------- |
| A tribute command is recorded               | Yes                                      |
| A specific sender and recipient are decoded | Yes, subject to source/layout validation |
| Positive resource amounts are encoded       | Yes                                      |
| The engine accepted the transfer            | Not established                          |
| Donor resources were actually deducted      | Not established                          |
| A fee was actually deducted                 | Not established                          |
| Recipient obtained the stated resources     | Not established                          |

### 1.2 Interpretation of the FFA observations

Nonzero requests

# 14

All-zero controls

# 392

C8 requested resources

# 2,346

C8: Source slot 5 → slot 6. The decoded command requests 2,346 resources in aggregate. Until an execution witness is established, this is a requested quantity, not a confirmed donation or receipt.

The 392 zero entries are particularly valuable negative controls. They show why treating the existence of a tribute action as execution would be unsafe.

The 14 positive entries establish candidate commands rather than 14 independently verified completed donations. Neither positive amounts nor two independently retained player recordings would, alone, demonstrate recipient receipt: both recordings may contain the same underlying command stream.

### 1.3 A narrower execution witness already has a plausible interface

I found a more promising route than reconstructing resource balances from all economic commands.

The community-documented AoE2DE replay gRPC protocol, in [LibreMatch's ](https://github.com/librematch/delta-play-replay/blob/main/crates/uncage-client/proto/cade_api.proto?utm_source=chatgpt.com)[`cade_api.proto`](https://github.com/librematch/delta-play-replay/blob/main/crates/uncage-client/proto/cade_api.proto?utm_source=chatgpt.com), contains an explicit `Event.Tribute` structure:

```
senderId
receiverId
attributeType
senderValueBefore
senderValueChange
receiverValueBefore
receiverValueChange
```

This is materially stronger than the original replay command. It describes resource changes observed through the replaying engine.

The protocol also exposes frame times, events, commands and state-delta patches. LibreMatch documents this as a reverse-engineered replay-observation interface used in the CaptureAge ecosystem.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://librematch.github.io\&sz=32)

LibreMatch Documentation

+1



Important qualification: This establishes that a technically relevant observation interface is documented. It does not establish that it is accessible, unchanged or accurate on AoF's current game build. A controlled compatibility experiment is still mandatory.

If the event works as documented, it could distinguish acceptance, deduction, fees and receipt without requiring AoF to implement its own resource-economy simulator.

### 1.4 Tribute witness T1 — Validate the original binary fields

Feasible, but not execution proof

Source and reproduction: Use the retained original `.aoe2record`, the pinned `mgz-fast` decoder, and the exact source-operation offsets from the Codex witness JSON. Independently decode the 14 nonzero commands, all 392 zero controls, and C8's complete binary payload. Compare the earlier and newer DE layouts, including skipped cost and attribute fields.

Proves: The exact command representation, sender/recipient identity, resource ordering, whether the amount and cost vectors differ, and whether zero entries form a distinct structural pattern.

Cannot prove: Whether any command executed or any player received resources. Even a decoded cost value is not a verified fee deduction.

Controlled cases: Each resource independently, multi-resource tribute, no-fee and fee-enabled transfers, insufficient donor resources, attempted invalid transfers, zero controls and repeated requests. Include Coinage/Banking where applicable, with the exact game-build rules recorded.

Retention/performance: No production retention changes. Original recordings are already retained. This is an offline diagnostic pass over selected operations.

Smallest experiment: Decode the entire C8 command frame and compare its fields against one newly recorded, engine-observed single-resource tribute with known sender and receiver balances.

Potential unlocks: Foundational evidence for Bond and Chivalry, and verified assistance in FFA. Not sufficient alone for any social credit.

### 1.5 Tribute witness T2 — Engine-confirmed resource receipt

Highest-priority execution experiment

Source and reproduction: Play a short, controlled recording in the game, attach a local replay observer using the documented `CadeRemote.Frames` interface, and capture `Event.Tribute`. Match sender, recipient, resource, game time and relevant recorded command. Preserve the original SHA-256, game build, observer version and raw event values.

Proves, if validated: An engine-observed transfer event, sender balance change and recipient balance change. It can establish actual received quantity independently of the request. Differences between sender deduction and recipient increase can be analyzed as fee effects, once the controlled cases exclude other simultaneous changes.

Cannot prove: The donor's motivation, the recipient's need, an economic rescue or the significance of an ordinary donation.

Controlled cases: A successful isolated tribute; insufficient resources; no valid recipient; zero-amount command; fee-reducing technologies; consecutive transfers; and simultaneous economic changes. For negative tests, verify the observer has complete event coverage before interpreting absence as nonexecution.

Retention/performance: Keep this observer completely outside upload. Initially retain only temporary local evidence; a future optional proof artifact could contain the matched event values and source references. No full resource ledger or video is required in the production database.

Smallest experiment: One short recorded 1v1 or FFA game with a single positive tribute and one intentionally nonexecuting control. Verify that the event's sender and receiver changes agree with separately observed game resource counters.

Potential unlocks: Substantive directional assistance for Bond, potentially Chivalry when separately qualified as noteworthy. It could also support independently qualified Hostility cooling, according to the existing directional rules.

Decision: This is the first experiment I would run. If the documented protocol is usable, it could establish a useful category of actual gameplay conduct with very little additional AoF-side logic.

## Investigation 2 — Military execution

A second important discovery is that the same documented replay-observation interface contains an `EntityKilled` event with an entity ID and killer ID. It also transmits frame state patches. The project has a potentially narrower source of execution evidence than an AoF-built combat simulator.

However, `EntityKilled` alone is not enough to establish pair-specific responsibility. It needs a trustworthy mapping from entity IDs to their owner, class and relevant state at the time of death. Nor does a unit death necessarily establish a meaningful deed.

### 2.1 Witness M1 — Confirmed kill with attributed attacker and victim

Promising

Source/reproduction: Use replay-engine `EntityKilled(id, killerId)` events. Resolve both IDs against the preceding entity-state observations. Join them to AoF's authenticated recording identities and exact event clock.

Proves: A unit or building was destroyed, and a specific killer entity was attributed by the engine, provided owner/class resolution succeeds. This establishes a real consequence rather than an attack order.

Cannot prove: Who deliberately commanded the kill, that every attack connected, a full battle outcome, or historical relative strength. Kills from automatic attacks must remain distinguishable from player-issued targeted commands.

Positive/negative controls: Enemy archer kills a villager; military unit kills an enemy military unit; an automatic defensive tower kill; a unit deleted by its owner; environmental death; conversion before death; and a kill with ambiguous attacker attribution.

Retention/performance: Retain a small verified event witness per qualifying encounter, not the full state stream. Perform replay observation only in a separate offline process.

Smallest experiment: One controlled archer-versus-villager kill, followed by a controlled unit deletion and an automatic tower kill. Confirm correct ownership and source attribution for all three.

Potential unlocks: Pair-specific Rivalry, actual offensive conduct, economic raiding and contextual Gallantry/Cruelty candidates. Gallantry still requires appropriate opponent-strength evidence; Cruelty requires independently established disadvantage at entry. Hostility does not automatically follow from killing enemies.

### 2.2 Witness M2 — Damage and material economic action

Feasible with additional state decoding

Source/reproduction: Use entity-state patches to observe target health, class, ownership and position. Combine them with event-level kills, validated offensive command semantics and attacker identity where available. Restrict the first experiment to a simple, single-attacker situation.

Proves: Health changed on a real entity or an economic entity was destroyed. A controlled attack can establish that particular damage was caused by the identified attacker.

Cannot prove: General attacker causality from a health difference alone. Multiple attackers, regeneration, conversion, repair and simultaneous effects must be addressed. A hit against a mill also does not automatically prove lost food production.

Positive/negative controls: Enemy attack damages a villager; attack destroys a lumber camp; attack misses or never reaches the target; multiple simultaneous attackers; own-unit deletion; target repair during attack; and command-only movement past an economic target.

Retention/performance: Small time-bounded pre/post entity witnesses, generated offline. No continuous position history needs to be retained for ordinary statistics.

Smallest experiment: Compare one archer hitting an isolated enemy villager against an issued attack command that produces no hit. Verify whether the state patches expose stable entity IDs, health changes and exact event times.

Potential unlocks: Actual raids, directed pressure, Rivalry, and contextual Gallantry/Cruelty. Economic materiality still requires a separately supported significance judgment.

### 2.3 Witness M3 — Defensive resistance without counterattack

Possible, not yet qualified

Source/reproduction: Observe an actual defender-controlled protective action during independently verified incoming pressure. First test successful repair, garrisoning, withdrawal or defensive repositioning, using replay-engine state transitions and matching recorded commands. Choose only mechanics for which the observer exposes clear state changes.

Proves: The defender did something executable and observable—for example, completed a garrison action or restored health to a damaged defensive asset. The deed need not include an attack on the aggressor.

Cannot prove: A passive defender resisted meaningfully merely because its units survived or were damaged. Nor can a health increase alone prove who repaired the structure. A successful retreat cannot automatically be described as winning a defensive contest.

Positive/negative controls: Repair under actual attack; successful garrison while threatened; automatic defensive fire; being attacked without any defender action; an unexecuted repair command; and the same protective action performed outside any threat.

Retention/performance: Retain the attributed protective state transition and bounded pressure context. Execute observation offline.

Smallest experiment: Record a threatened building, an explicit defender repair action that produces an observable state change, and an otherwise identical test where the defender only issues an unsuccessful repair order.

Potential unlocks: Defender→attacker Rivalry where actual substantive defensive resistance qualifies, and defensive evidence supporting Chivalry or Bond when a separate helper and beneficiary are involved.

This preserves an important approved design requirement: the defender does not have to counterattack to qualify meaningful resistance, but merely being attacked or surviving is not sufficient.

### 2.4 Witness M4 — Executed assistance and reinforcement

Medium feasibility

Source/reproduction: The simplest first case is T2's verified tribute receipt. The military case should join a helper's actual actions to a specific threatened beneficiary: for example, observed helper units engaging the attacker threatening B, with attributable kills or other verified protective consequences. If an allied repair/heal mechanic is used, first confirm that the game permits it and exposes its execution.

Proves: The helper performed a real action. With a unique threat association and beneficiary, it may establish directed assistance.

Cannot prove: Beneficiary-specific help from shared targets, common team membership, proximity or an army arriving after the battle. A successful kill of C by A does not automatically mean A meaningfully protected B.

Positive/negative controls: A helps B against C during an active threat; A attacks C elsewhere; A arrives after the threat ends; A moves toward B but never arrives; C was not threatening B; and dynamic FFA assistance between players who are not permanent allies.

Retention/performance: Offline bounded encounter witness joining existing Pair Social Evidence references. No new production detector or upload step is necessary for the experiment.

Smallest experiment: One three-player controlled fight: C attacks B, A intervenes and defeats or materially impedes a uniquely identified threatening unit. Compare an otherwise equivalent case in which A arrives after the threat.

Potential unlocks: A→B Bond and A's Chivalry where protection is independently noteworthy. A→C competition remains a separate claim and must not manufacture reciprocity or a second assistance deed.

### 2.5 Witness M5 — Completed forward building and operational Castle

Medium feasibility

Source/reproduction: Take the existing BUILD placement event and match it to a unique construction entity in the replaying engine. Observe construction state progressing to operational completion, with stable entity identity, owner and coordinates. For a Castle, connect a later production command to that particular completed Castle.

Proves: A real building became operational at a specific location. A matching production command proves operational use was requested from that same building—not that the resulting unit finished training.

Cannot prove: Completion from BUILD alone; unique-building identity from nearby coordinates alone; actual enemy damage; or home-base pressure merely from a broadly forward placement.

Positive/negative controls: Complete Castle; canceled foundation; destroyed foundation; two Castles at similar coordinates; queue from a different Castle; queue before operational completion; and enemy-zone versus neutral-zone placement.

Retention/performance: Retain only the completion transition, stable building ID, position and linked queue event. Run observation offline against the already retained original.

Smallest experiment: Construct one Castle to completion, issue a production command from it, and separately construct a Castle foundation that is canceled before completion. Confirm the entity-ID join.

Potential unlocks: Real positional military pressure and contextual Rivalry/Gallantry qualification.

The [existing approved three-family design](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/docs/architecture/fixed-alignment-military-social-families-v1.md?utm_source=chatgpt.com) has a particularly important additional requirement: the special Forward Castle needs a unique operational Castle and its own production queue within five minutes of operational completion, as well as genuine pressure near the specific enemy's home base.

The actual home-base distance criterion has not yet been finalized. That is a remaining product-policy dependency, not a reason to weaken the construction proof.

## Investigation 3 — Historical episode-entry context

State evidence needs to be anchored before the deed begins. Later success, losses or final statistics may describe consequences but cannot prove the circumstances at entry.

### 3.1 Witness H1 — Pre-entry opposition strength

Feasible if entity patches decode reliably

Source/reproduction: Capture a state checkpoint immediately before the independently defined episode start. Extract relevant existing military units, ownership, composition, hit points, positions and known completed upgrades. Use the game's data/build version to identify units consistently.

Proves: The observed military forces and equipment existing at that historical time, within the observer's verified coverage.

Cannot prove: Combat outcome, invisible future reinforcements, player skill or strength from a simple score comparison. It cannot establish local tactical strength if positions or unit availability are missing.

Positive/negative controls: Similar opposing forces; clearly unequal forces; reinforcements arriving immediately after entry; upgrades completing after entry; mixed armies in different map areas; and missing observer frames.

Retention/performance: Store a compact source-linked entry snapshot or source-derived factual vector only after the observation method is validated. Do not put state sampling into native extraction.

Smallest experiment: Record a controlled fight with fixed known armies, then introduce reinforcements only after the initial engagement. Confirm that the entry snapshot excludes them.

Potential unlocks: Gallantry's comparable/stronger-opponent requirement, context-sensitive Rivalry and better interpretation of substantive defensive resistance.

This is a prerequisite witness, not a complete social judgment. The appropriate comparison metric must follow approved qualification rules; no new numerical superiority threshold is justified by this investigation.

### 3.2 Witness H2 — Sustained disadvantage and material beneficiary need

Feasible in principle; harder than H1

Source/reproduction: Capture a series of verified state checkpoints over the historical interval preceding episode entry. For disadvantage, inspect relevant military position, surviving forces and established pressure. For beneficiary need, observe an independently relevant threat, such as a damaged or endangered economic/defensive asset, or a verified resource deficit directly relevant to the help being supplied.

Proves: Sustained observable circumstances before the deed, provided the series is sufficiently complete. A recipient's resource balance can corroborate material need, but shortage alone does not establish necessity or rescue.

Cannot prove: Helplessness, intention, distress or actual benefit from an isolated low-resource snapshot. Later defeat cannot retrospectively create an entry disadvantage. A future result cannot retroactively make assistance meaningful.

Positive/negative controls: Sustained pressure before entry; temporary disadvantage that ends before entry; a stronger player later defeated; a threatened beneficiary receiving assistance; ordinary surplus-resource tribute; and missing checkpoints.

Retention/performance: Keep bounded pre-entry observations and coverage metadata. The experiment should not retain a full replay-wide state history.

Smallest experiment: Two controlled cases: one player disadvantaged continuously before a new offensive episode, and one whose disadvantage occurs only afterward. Check that only the first has admissible entry-context evidence.

Potential unlocks: Cruelty when punishing conduct is also separately verified; Gallantry in suitable unfavorable circumstances; Chivalry and Bond when assistance was actually material to a beneficiary.

This witness should follow the simpler execution work. It is more complex, and getting it wrong could create exactly the false moral characterization AoF has been designed to avoid.

### 3.3 Witness H3 — Established territorial pressure at entry

Feasible incrementally

Source/reproduction: Combine existing verified initial Town Center anchors and Map Presence geometry with real building completion and ownership observations. Record completed military/economic structures and relevant enemy presence that already existed before episode entry.

Proves: Established structures and observable military presence in the relevant enemy-side or home-base area at a particular historical time.

Cannot prove: Territory control solely from a BUILD command, requested movement, proximity or an abandoned foundation. Nor does a forward position automatically satisfy the special Castle pressure criterion.

Positive/negative controls: Operational building inside the enemy-side zone; placement in neutral space; canceled enemy-side foundation; Castle near the wrong opponent; building completed only after the episode began; and disputed starting anchors.

Retention/performance: Reuse the present geometry and provenance model. Add only verified construction/existence checkpoints in an offline experimental observation layer.

Smallest experiment: Compare an operational forward structure against an identically placed but uncompleted foundation; verify zone classification and historical timing.

Potential unlocks: Positionally grounded Rivalry and substantive pressure context, and a future Forward Castle qualifier once its exact remaining policy criterion is approved.

## Feasibility comparison

The investigation changes the technical outlook: it identifies a potential source of engine-generated execution events rather than only inferred command outcomes.

| Witness                       | Technical promise | Largest unresolved dependency                    |
| ----------------------------- | ----------------- | ------------------------------------------------ |
| Tribute receipt event         | High              | Current-build gRPC/event validation              |
| Attributed unit/building kill | High              | Killer and victim owner/type at time             |
| Completed construction        | Medium–high       | Stable entity identity and completion state      |
| Actual damage                 | Medium            | Attacker attribution, not just HP delta          |
| Executed defensive response   | Medium            | Independently substantive defender action        |
| Directed reinforcement        | Medium            | Actual beneficiary-specific effect               |
| Pre-entry military strength   | Medium            | Complete and meaningful state vectors            |
| Sustained disadvantage/need   | Medium–low        | Reliable pre-entry duration and materiality      |
| Existing territorial pressure | Medium            | Completed structures and zone/ownership fidelity |

These are engineering feasibility assessments, not completed validation results.

### Alternative sources examined

The existing replay files contain initial state and timed operations, not authoritative continuous game-state history. The `aoc-mgz` documentation explicitly distinguishes command parsing from obtaining resources and kills at arbitrary times, which requires replaying the game.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

+1



The `SYNC` stream is useful for chronology and integrity; it is not a reversible ledger of entity positions, damage or resources. The upstream `aoe2rec` alternative also currently retains the modern Tribute action as an opaque data payload in its inspected `actions.rs`, so simply swapping parsers would not establish execution.

CaptureAge's `.caderec` format is an additional candidate for repeatable offline state observation. CaptureAge documents converting standard replays into its own recordings, which may remain usable across engine updates. But conversion, access, exportability and licensing constraints require separate verification; it is not yet an authenticated AoF witness source.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://captureage.com\&sz=32)

Documentation

+1



For controlled tests, a synchronized replay video or observer HUD recording remains a useful independent oracle. It is appropriate for validating a decoder or telemetry adapter, but should not automatically become production progression evidence without reliable identity, clock, completeness and correction controls.

## Retention, correction and upload-performance implications

The existing architecture already preserves the original recording and its immutable provenance. That is critical: none of the first experiments needs to slow down ordinary recording acceptance.

The safe long-term shape is a separately reviewed, optional proof layer:

Proposed evidence boundary, not implemented production architecture. The optional observer operates after the existing upload has finished.

Every future witness should carry the original replay SHA-256, relevant Game/Battle/Event identity, game build, observer/schema version, event timestamp, source-operation or entity references, observed state values and completeness indicators. Source corrections must revoke the witness's current authority without deleting its historical audit provenance. A witness obtained from a different replay revision must never be silently reassigned by similar timestamps or players.

The full engine-state stream should not become another large permanent player artifact by default. Initially, experiment with temporary local captures and later retain only the minimum independently reproducible facts required for qualified deeds. Security, licensing, privacy and retained-proof reproducibility must be resolved before any production observer is authorized.

Importantly, a successfully executed action is still not automatically a meaningful social deed. The existing V1a boundary and approved directional rules should remain the authoritative separation.

## Ranked technical evidence roadmap toward AoF V1

Priority considers proof value, technical feasibility, integration risk and the likelihood of unlocking a real qualifying deed.

1

Prove one actual tribute receipt

First experiment

Validate the gRPC Tribute event on a controlled current-build recording and match it to an original decoded command. Prove the recipient actually received resources, with the donor deduction and fee independently accounted for. Then attempt C8 against a compatible replay environment.

Exit criterion: one positive, one nonexecuting negative, and fee-aware balance agreement. No Bond credit yet.

2

Validate actual kill and economic-target identity

Use engine kill events with preceding entity owner/type state. Prove one attributed hostile kill and reject deletions or ambiguous events.

Exit criterion: repeatable actor→victim identity and actual destruction, without claiming unsupported damage or intent.

3

Establish a narrow, repeatable state observer

Confirm that current-build state patches expose stable entity ownership, health, position and construction state, and that observed frames can be associated with AoF's recording clock.

Exit criterion: controlled positive/negative state transitions with explicit coverage and version information.

4

Qualify real defensive action and directed support

Start with successful protective actions under observable pressure, then a controlled A-helps-B-against-C case. Do not require an artificial reverse attack or assume shared combat establishes help.

Exit criterion: substantive independent defender/helper action and specific beneficiary/threat association.

5

Build pre-entry context from limited checkpoints

Validate force comparison, sustained disadvantage and material beneficiary need using state captured strictly before the source episode begins. Include time-coverage failures and post-entry-reinforcement negatives.

Exit criterion: historical facts independently established without using endgame results to infer earlier circumstances.

6

Validate operational forward structures

Prove foundation-versus-completed-building separation, unique Castle identity and its own timely queue command. Preserve the existing territory definitions and obtain separate approval for the unresolved home-base pressure criterion.

Exit criterion: construction and operational-use facts reproducible, with positional interpretation kept separate.

7

Connect only validated witnesses to V1 progression

After the proof sources are accepted, introduce a separately reviewed qualification boundary that consumes these witnesses through authenticated current Game/Event authority. Apply the already-approved Reputation and directional Relationship rules, independent episode deduplication, history ordering, correction fencing and credited movement receipts.

Exit criterion: a real eligible Game produces a defensible credited effect while unproven candidates remain pending and the Chronicle remains factual.

## Final feasibility verdict

The evidence does not justify promoting any of the six currently unqualified categories to automatic qualification today.

But it does justify a more optimistic technical strategy:

- Tribute may have a direct engine-generated receipt witness requiring no economic reconstruction.
- Combat already has a documented actual-kill event with a potentially verifiable owner join.
- Other conduct can be investigated through narrow game-state transitions rather than full game simulation.
- Entry circumstances can be sampled separately, avoiding the incorrect use of later match outcomes.
- All these experiments can occur after upload, preserving the existing native ingestion performance and source authority.

Recommended next technical task: validate the documented replay gRPC interface against one current-build, controlled original recording, prioritizing the `Tribute` and `EntityKilled` events and minimal entity-state decoding. Establish positive and negative oracle agreement before writing any production integration.

If it works, pursue a conservative V1 progression subset supported by independently qualified execution and historical context. Categories without adequate proof remain pending; that is a coverage limitation, not a reason to relax the approved social standards.

No production code, extraction configuration, PR, deployment or feature flag was changed. No controlled game-engine execution experiment was performed during this research.
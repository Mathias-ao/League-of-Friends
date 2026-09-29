# Season Showcase Statistics V1

Status: implementation/qualification candidate

Purpose: define the additional Battle measurements selected for Season Statistics without changing the existing replay-truth contract. These remain Battle-level measurements first; Season aggregation and category presentation consume them later.

## Invariants

- CanonicalReplay remains the durable evidence source; all additions recalculate from the existing compact `AOF_REPLAY_ANALYSIS_V1`/V3-compatible cache and require no replay reparse.
- Queue requests are not completed units. BUILD commands are not completed buildings. Research requests are not proof that a technology completed.
- For one-time research where a click may be cancelled/retried, the effective timing is the latest observed request candidate. Distinct-technology counts collapse repeated requests to one technology while retaining first/latest request evidence and repeat counts.
- Unknown decoded amounts do not become guessed zeroes.
- Each statistic has one owning Battle definition. Season presentation may show an Economy or Execution-owned metric under an Opening heading without reimplementing the calculation.
- Team-only Season eligibility is presentation/aggregation policy; Battle evidence remains neutral and traceable.

## Economy V5

Model: `AOF_ECONOMY_STATISTICS_V5`, extending V4 without changing V4 formulas.

### Villagers by 10 minutes

`villagersBy10Minutes`

Qualified starting Villagers plus net decoded Villager queue amount through 10:00. Positive and negative queue amounts are preserved separately. If a relevant queue command has an unknown amount, the player-facing count is unavailable rather than guessed. This is the same queue-derived population proxy family as Villagers by 20 minutes; it does not assert completion or survival.

### First Mining Camp / First Lumber Camp

`firstMiningCamp` and `firstLumberCamp`

Earliest catalog-qualified BUILD placement command for each building type. Timestamp, entity and source event are retained. Construction completion is not asserted.

### Houses built

`housesBuilt`

Count of catalog-qualified House BUILD placement commands, plus first placement time. This is intentionally a placement-command metric despite the player-facing shorthand “Houses built”.

### Trade units trained

`tradeUnitsTrained`

Sum of positive decoded queue amounts for catalog units carrying the `trade_unit` role (currently covering Trade Cart and Trade Cog in the pinned catalog). Negative queue amounts and unknown-amount coverage remain visible. This is a queue-derived proxy and does not assert completion/survival. Season aggregation is intended for team Battles only.

### Tribute sent / received

`tributeSent` and `tributeReceived`

Directional decoded tribute-command resource amount. DE tribute uses the decoded `amount` field; legacy tribute falls back to the decoded food/wood/gold/stone components. Command count, counterpart, timestamp, resource ID and fee fields remain available as evidence. If any qualifying command lacks a usable amount, the total is unavailable while the known decoded subtotal is retained. Tax/fee effects and resulting recipient resources are not simulated. Season aggregation is intended for team Battles only.

## Execution V2

Model: `AOF_EXECUTION_STATISTICS_V2`, extending V1 without changing V1 formulas.

### Commands in first five minutes

`commandsFirstFiveMinutes`

Count of decoded player ACTION operations with timestamp `< 300000` ms on the observed sync clock. This is the Execution-owned version of the already-retained first-five-minute command fundamental and is distinct from Map Presence scout-command count.

### Longest action gap — Dark Age

`longestActionGapDarkAge`

Largest gap between consecutive decoded player ACTION timestamps strictly before the **latest observed Feudal research request**. The pre-first-command edge and the Feudal-click boundary edge are excluded, matching the existing general longest-inactivity convention. If no supported Feudal request exists, the metric is unavailable rather than treating the entire recording as Dark Age.

The latest-click boundary is deliberate: an earlier Feudal request can be cancelled and retried. Regression coverage includes an earlier request followed by a later retry and verifies that the later request defines the boundary.

## Military V5

Model: `AOF_MILITARY_STATISTICS_V5`, extending V4 without changing V4 production/engagement formulas.

### Military techs

`militaryTechs`

A distinct research-request count intended to represent Blacksmith upgrades plus military-building/Castle-side research while avoiding double counting of retries. The model:

1. excludes age-advance IDs;
2. excludes the supported Economy technology set;
3. excludes the source-pinned University technology set;
4. excludes Town Watch/Town Patrol utility research;
5. requires a catalog-resolved technology ID;
6. counts each remaining technology ID once;
7. identifies the explicit source-pinned Blacksmith subset separately;
8. retains first request, latest request and request count for each technology.

The remaining non-Blacksmith group is intentionally named `militaryBuildingOrCastle`: current replay evidence does not safely prove the research building for every later-built structure. The metric therefore does not claim where or whether research completed. Repeated/cancelled attempts increase `requestCountTotal`/`repeatRequestCount` but not the distinct `count`.

## Map Presence V7

Model: `AOF_MAP_PRESENCE_V7`, extending V6 without changing V6 scout, geometry, gold, relic or expansion-zone formulas.

### Enemy base contact

`enemyBaseContact`

Retains the existing V2/V6 directional definition: first recorded command coordinate within 14 tiles of an unambiguous enemy starting Town Center. Multiplayer ambiguity remains discarded. This is command contact, not fog-of-war vision or actual unit position.

### Expansion Town Centers

`expansionTownCenters`

Restores the simple V2 fundamental alongside V6 `expansionZones`: observed Town Center BUILD placements at least 30 tiles from the player's starting Town Center, with the existing placement-deduplication behavior. This does not replace Expansion Zones and does not assert construction completion.

## Qualification

The branch adds focused regression coverage for:

- Villagers @10 net queue and evidence semantics;
- first Mining/Lumber Camp and House placements;
- Trade-unit queue classification;
- DE and legacy Tribute normalization;
- latest-Feudal-click Dark Age boundary and first-five-minute command count;
- distinct Military Tech counting with duplicate requests and age/economy/University/utility exclusions;
- Enemy Base Contact plus restored Expansion Town Centers.

Replay Tools CI must remain green and the existing Three-Battle Statistics Validation must run against the successor projector before these models are promoted from qualification candidate.

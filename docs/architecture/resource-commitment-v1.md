# Resource Commitment V1

`AOF_RESOURCE_COMMITMENT_V1` is a player-facing Economy statistic that estimates how many resources a player committed through decoded replay commands during a match and within each age.

## Player-facing outputs

For each player the projection reports:

- total Food, Wood, Gold and Stone committed across the observed match;
- the same four resource totals split into Dark, Feudal, Castle and Imperial Age;
- an `unknown` age bucket when no Feudal age boundary can be reconstructed;
- the reconstructed Feudal, Castle and Imperial age-up boundaries used for the split;
- coverage counts showing how many request commands could or could not be priced from the pinned entity catalog.

## Cost inputs

The model prices:

1. positive unit queue requests: catalog unit cost × positive requested amount;
2. research requests: catalog technology cost;
3. building placement commands: catalog building cost;
4. wall commands: catalog wall cost × rasterized wall tiles using the same integer wall rasterization as `AOF_OPENING_STATISTICS_V1`.

The pinned `AOF_ENTITY_CATALOG_V1_1` cost data is used. Food, Wood, Gold and Stone are retained separately and also summed to a convenience total.

## Age assignment

Age boundaries use the same deterministic reconstruction as Opening Statistics V1:

- Feudal Age starts at first Feudal research request + 130 seconds;
- Castle Age starts at first Castle research request + 160 seconds;
- Imperial Age starts at first Imperial research request + 190 seconds.

Each cost is assigned to the age the player is reconstructed to be in at the command timestamp. Therefore the cost of advancing to an age belongs to the preceding age: the Feudal research request is Dark Age commitment, the Castle request is Feudal commitment, and the Imperial request is Castle commitment.

If Feudal completion cannot be reconstructed, priced commands are placed in `unknown` rather than silently assuming Dark Age. Once Feudal is known, absence of a later age request means the player remains in the latest reconstructed age through the observed interval.

## Evidence boundary

This statistic is intentionally named **Resources Committed**, not exact engine `Resources Spent`.

It does not simulate or prove:

- whether a queue/research/build request was accepted with sufficient resources;
- cancellation or refund effects;
- civilization-specific discounts, bonuses or dynamic cost modifiers;
- market exchange, market fees or tribute as production investment;
- completed units, completed research or completed buildings.

Repeated accepted-looking commands are priced as repeated commitments because the canonical replay currently does not establish cancellation/refund state. Market and tribute remain separate command statistics.

The statistic is therefore a deterministic investment proxy over replay command evidence and pinned base costs. Any future support for civilization-aware costs, cancellation/refund accounting, accepted-request verification or engine-state spending should use a successor version if historical outputs must remain reproducible.

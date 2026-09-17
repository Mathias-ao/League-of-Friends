# Forward Eco V1

`AOF_FORWARD_ECO_V1` is an inferred player-facing Map Presence statistic that identifies economic building placements committed forward on the map.

## Definition

A placement counts as **Forward Eco** when both conditions are true:

1. the building is a **Mining Camp**, **Lumber Camp**, **Mill**, or **Town Center**;
2. the placement satisfies the exact `AOF_MAP_PRESENCE_V2` Forward Building geometry:
   - within **40 tiles** of the nearest eligible enemy starting Town Center;
   - at least **6 tiles closer** to that enemy starting Town Center than to the player's own starting Town Center.

The statistic is additive to the existing `Forward Buildings` output. A qualifying economic building therefore appears in both `forwardBuildings` and `forwardEco`.

A forward Town Center may also independently count as an **Expansion** when it is at least **30 tiles** from the player's starting Town Center. These are separate labels answering different questions.

## Player-facing output

For each player the projection retains:

- total Forward Eco count;
- first Forward Eco placement time;
- counts by economic building type;
- each qualifying placement position;
- identified enemy player;
- distance from the player's starting Town Center;
- distance to the enemy starting Town Center;
- source event ID;
- rule version and geometry thresholds.

## Evidence boundary

Forward Eco uses building placement commands as model inputs. It does **not** assert that the building completed, survived, gathered resources, or produced economic value.

The eligible building set and the inherited 40/6 forward geometry are versioned. Changing either requires a successor Forward Eco rule version if historical outputs must remain reproducible.

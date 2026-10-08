# Season leaderboard scoring V1

The two leaderboard feature branches were consolidated into one implementation before deployment.

[Season leaderboard points V1](../design/season-leaderboard-points-v1.md) is the authoritative implementation and operator contract (`AOF_SEASON_POINTS_V1`). It preserves the agreed main/warm-up awards, official coalition outcomes, source-bound qualified placements, correction/source reconciliation, disputed-standings masking, solo FFA ratings and shared-win rating exclusions.

The consolidation also retains exact 840-unit arithmetic, actual starter confirmation, team-series finalization, explicit main 1v1 act labeling and tied-rank target selection from the scoring branch. The duplicate engine/profile and its manual placement-entry route are superseded; there is no second live scoring system.

Unqualified placements remain pending. Deployment, real Steam sign-in/player-flow acceptance, identity migration and the replay placement qualifier remain separate launch work.

# Launch branch consolidation — 8 October 2026

Integrated branch heads:

| Branch | Original head | Result |
| --- | --- | --- |
| fix/statistics-launch-readiness-v1 | cba8a54126e90c03bcb046359f454ac0f2dfcde3 | Statistics coverage/source binding and publication safeguards retained |
| feat/season-leaderboard-points-v1 | 6e7b576dffb002c415b99d8c77d8cf64562e5297 | Authoritative scoring/evidence/correction engine |
| feat/aof-seal-ceremonial-ui | ed31b71e6ddf4367acafe6bec8daf13d3fed9d0e | Ceremonial assets and reduced-motion states retained |
| feat/season-leaderboard-scoring-v1 | 9ba815e5c3479a9ad54cdbde0da29958b45f493f | Exact units, starter corrections, series finalization and UI fixes consolidated |
| feat/steam-sign-in | 1e81f4928127f35e77e564101c4cb97c81356073 | Steam OpenID/Firebase admission and identity migration retained |

The Steam branch already includes the ceremonial UI. A single merge commit retains all five histories; duplicate leaderboard implementations are deliberately reconciled into `AOF_SEASON_POINTS_V1`, rather than running independent ledgers. Manual placement entry is superseded by active source-bound qualification. Solo FFA ratings are preserved; shared victories remain unrated.

Integration fixes: preserve both Current State additions; announce the callback origin as Steam's OpenID realm; claim auth state transactionally before verification so it cannot be replayed; bound verification network time; clear a series correction dispute before re-finalization; preserve actual starter reservations; classify designated main 1v1 Matches correctly; skip tied players when identifying a ladder target.

Local validation of combined code:

- Backend type-check/build and 162 passing tests, including Steam origin/realm/assertion/reuse/expiry checks and starter, exact fractional correction, source, ranking and corrected-series integration cases.
- Frontend production build and 46 passing domain/render tests.
- Replay Lab: 20 passing tests.
- Player-site callable boundary checks passed.
- Git whitespace/conflict-marker checks passed.

The frontend retains its existing bundle-size advisory. This merge does not deploy Firebase services, migrate live identities/history, claim a verified placement producer exists, or replace player-flow/footage acceptance. Those launch gates are documented in CURRENT-STATS and the scoring/auth contracts.

# Active native Battle statistics — player reader integration

Status: **read-side implementation only, not enabled or deployed.** This change connects the authenticated Battle Ledger to bounded native detail when an officially qualified native statistics source is already the Game's active READY replaySources revision.

## Strict publication boundary

Only a future **separately reviewed and activated** publisher may create a replaySources source with `nativePublicationVersion=AOF_ACTIVE_NATIVE_STATISTICS_V1`. This PR contains **no code that writes that marker**. A nativeReplayValidations candidate in VALIDATED_NOT_READY, a Storage file or an operator flag alone cannot enter the player read path.

For a source to be recognized, all of these must agree: activeReplayStatisticsId and sourceHash, Game's READY state and replayStatisticsRevision, match/game identity, current OFFICIAL Game result and absence of disputes, exact Game roster/replay-slot bindings, StatisticsExperience source binding, immutable original recording retention, Recorded Events SHA, extraction revision, processor revision, candidate provenance identifier, artifact revision and versioned compact-statistics contract. The operator also must explicitly set `AOF_ACTIVE_NATIVE_PLAYER_READS=1`. It is unset by default. No native READY activation work is authorized here.

Normal authenticated ACTIVE League members (the same audience as existing Battle statistics) may read this approved Game's player-associated episodes. The new `getActiveNativeBattleDetail` callable never accepts arbitrary candidate IDs or raw Storage paths. It reads the generation-pinned immutable statistics artifact, verifies stored/decoded hashes and source/extraction provenance, and checks the match, Game, source and caller membership after download **and again after episode selection/fragment serialization** before returning. Corrections, disputes, loss of membership or a source swap abort rather than mix stale evidence with new results.

## Player-facing experience

The existing `getStatisticsExperience` remains the source of Battle/Event/Season/player quantitative presentation and already reads persisted `experience` only from the active READY replaySources pointer with its source/roster binding. Once an activated native source is correctly published with the same proven compact experience, those scalar views need no giant JSON expansion.

`getMatchDetail` advertises `replay.statisticsDelivery=NATIVE_BOUNDED_V1` and replay-slot mapping **only** if the complete new active-source predicate succeeds. The Battle Ledger then offers recorded episode categories, short reference pages (up to 20 per page), and verified small body/field fragments. Each fragment is at most 32 KiB (Base64 transport), from the existing bounded native evidence reader. The browser verifies the assembled SHA-256 before displaying JSON. The inline viewer has a further 256 KiB memory/display limit; larger evidence remains retained in the API and is never represented as missing observations.

The legacy `getReplayStatistics` response remains unchanged for legacy READY sources, with an added post-download consistency check. It refuses to decode native compact delivery as a misleading full legacy statistics document. There is no unqualified silent fallback.

## Remaining work before READY

This does not implement the native publisher, source corrections/rollback or atomic READY transaction. It also does not qualify every social-history/Battle-record consumer or production cloud load. Continue treating VALIDATED_NOT_READY as private, with all existing READY blockers in place. Before activating native Game sources: complete atomic result/correction publication, native social read semantics, browser-level real build-185872 end-to-end tests, stress concurrent detail requests and preserve original source retention. Neither production nor staging deployment is authorized by merging this PR.

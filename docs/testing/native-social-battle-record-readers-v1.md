# Native social history and Battle-record readers — read-side acceptance V1

Status: **merged-code review only**. This increment does not activate native recording processing, write a native READY replay source, deploy Firebase/web changes or award Relationships/Reputation points. Ordinary uploads remain on the legacy CanonicalReplay path.

## Reading a qualified native source

The source must already be the current Game's **active READY** replaySources revision and meet the explicit AOF_ACTIVE_NATIVE_STATISTICS_V1 contract. Normal player permission remains ACTIVE authenticated League membership, including nonparticipants, as before. The existing AOF_ACTIVE_NATIVE_PLAYER_READS=1 operator gate is still required; it defaults to off. Native Chronicle inclusion now additionally requires AOF_ACTIVE_NATIVE_SOCIAL_READS=1, also off by default. Neither flag can transform VALIDATED_NOT_READY or an arbitrary Storage object into an active Game source.

Native Battle-record and Battle-detail queries share an authenticated correction-fenced evidence loader. It resolves the current active source; validates official Game outcome, roster, statistics experience source binding, original-recording retention and source/version metadata; downloads the **generation-pinned** immutable compressed native statistics; checks compressed and decoded hashes, source SHA, Recorded Events SHA, extraction ID, schema and player attribution; then re-reads Game, Match, source revision, membership and Auth link. If the Game is disputed/corrected, mapping changes, source changes or access is revoked, the read fails. No writes occur.

## Social Chronicle

Both getSocialHistory and owner-only getPlayerChronicle retain their existing return schema and policies. For a fully qualified native active source, the Chronicle decodes compact native statistics (maximum 64 MiB expanded compact JSON), then selects **only** the authoritative match facts, participant identities and neutral pair-social evidence for the already versioned social interpreter. No shared engagement episode hydration or full per-player statistics JSON reconstruction occurs.

Native provenance keys are not relabeled as CanonicalReplay manifest IDs. The source, match facts, neutral ledger and league replay-slot mapping must agree; absent/invalid evidence fails closed or is explicitly excluded. The accepted official outcome still comes from the current Game, never replay scores. Native shadow contributions remain unscored. The reader now snapshots source-document revision metadata as well as Game/Match revisions and aborts when sources are replaced or revised mid-read. Unqualified native evidence is counted as **excluded**, not as no contact or zero deeds.

## Battle-record reader and UI

getActiveNativeBattleRecord is a separate authenticated player callable. The existing getReplayStatistics continues serving full legacy statistics only; it never tries to interpret compact native statistics as legacy JSON.

- Overview: a small capped payload containing recording provenance, map, observed interval, selected rules, **current official** result, neutral/social episode counts or an explicit UNAVAILABLE reason, and qualified/unknown diplomacy coverage.
- Page: at most 20 short references/headers for the neutral incident or observation registry, shadow social incidents, decisions or deeds. A later page must supply the pinned artifact SHA.
- Fragment: an individual incident/observation/decision/deed or versioned match-facts, diplomacy-review or social-review section. Each response transfers at most **32 KiB** of serialized JSON bytes, includes SHA-256 of the *transfer JSON* and requires the active artifact SHA. Multiple fragments reconstruct the exact section; a mid-request source change is rejected.

The Battle Ledger shows this view only when an active native source is already qualified, an official result is present and no dispute is open. The expandable record loads only when opened. The inline inspector limits each assembled entry to 256 KiB to protect the browser; larger records remain retrievable through the bounded API. The UI does not treat its display cap as missing evidence. No normal Game page has to download the entire pair-social ledger automatically.

The native diplomacy reviewer remains advisory: recorded commands do not prove effective allegiance. Shadow social evidence does not award points. Legitimate historical chronology, order and official revisions are still bound to the currently accepted Game.

## Verification scope and gaps

The CI suite covers eight-player FFA native/canonical social semantic parity from a retained real-recording fixture, pagination/fragment reconstruction, SHA-256 and source/roster revision mismatches, invalid or missing neutral evidence, normal League viewer access, flag rollback, mid-request correction/source replacement, read-only storage and UI unavailable-state semantics. Historical opt-in replay goldens and real cloud/concurrency performance remain separate sign-off gates.

The native publishing and correction-safe READY transaction **remain unimplemented**, as do live build-185872 browser-to-cloud acceptance, production concurrency/performance qualification, and official rollout/rollback approval. For 100 completed Battles with many large native replays, Chronicle still sequentially reads and interprets each compact artifact; this has not been cloud-benchmarked. No setting or merge in this work authorizes staging or production deployment.

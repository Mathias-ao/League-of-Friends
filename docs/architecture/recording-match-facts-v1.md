# Recording match facts V1

Implemented on `feat/pair-social-evidence-v1`, 3 October 2026.
Contract: `AOF_RECORDING_MATCH_FACTS_V1` at `statistics.matchFacts`.
Official outcome adapter: `AOF_GAME_OUTCOME_CONTEXT_V1`.

## Retention and purpose

A recording carries match context as well as commands. AoF now retains reusable facts about the played map, rules, recording version, raw team assignments, initial diplomacy, directed diplomacy commands, postgame observations and resignations. These facts support later interpretation without changing statistics detectors, social deed boundaries, rewards or relationship/reputation scores.

The canonical bundle already retains the complete decoded header and raw prefix. The analysis builder now reads the decoded-header artifact through its checked path/hash/length, even when using a structural fast seal. It retains a compact whitelist and its artifact reference, plus source-identified postgame events. No recording is reopened. Missing legacy cache fields remain unavailable.

`matchFacts` includes:

- `source` and `headerSource`: replay/canonical revision, extraction identity, parser/normalizer version and decoded-header artifact hash.
- `game`: decoded GUID, recording version, observed duration and completion status. The interval does not prove whole-game completeness.
- `map`: map ID, RMS filename/mod ID, seed, dimensions and coordinate system. Missing readable names stay null; an RMS filename is not automatically a map name.
- `rules`: retained canonical settings with per-field availability and source paths, including game/victory type IDs, population, speed, ages, starting resources, treaty, reveal-map and team-lock flags.
- `headerFieldCandidates`: compact original edition/lobby/scenario domains, including important additional flags such as cheats, shared exploration, turbo mode and mod/version fields when decoded. False and zero survive. Conflicting source values remain inspectable; this projection does not silently override established canonical settings.
- `players` and `lobbyGroups`: replay slots, raw assignments, civilization/color/recorder metadata and membership groups. Raw equal team values do not establish effective alliances.
- `diplomacy`: initial raw vectors, existing normalized initial edges and existing directed command timelines. Runtime effective-state qualification remains inactive.
- `result`: retained canonical winner claims, postgame evidence and observed resignations, with replay winner/loser fields explicitly null until independently qualified.

The pinned parser's decoded postgame fields include leaderboard information, not an authoritative win/loss flag. Rankings, rating changes, surviving players, or resignations do not automatically become outcomes.

## Persistence and official outcomes

The replay upload validates the facts' model, source revision, extraction identity, roster and inactive policy before publication. Facts are retained both in the verified statistics artifact inside the canonical bundle and as `replaySources.matchFacts` in Firestore. The complete header remains in the bundle for future re-projection of fields outside the compact whitelist.

Accepted league outcomes remain authoritative at `Game.canonicalResult`. The shared acceptance/correction path now stores `losingPlayerIds` alongside `winningPlayerIds` under the same result revision. Losing members mean non-winning members of the official roster, not killed/eliminated players.

Uploads also retain `officialOutcomeAtIngestion` as a labelled historical snapshot. It must not drive current interpretation. `getReplayStatistics` supplies `officialOutcome` from the current Game and Match, including revision, source, winners and losers. Pending/disputed/void results, invalid identities and contradictory loser lists stay unresolved. Old accepted results without explicit loser arrays can derive them from the stored roster and accepted winners; stored history is not rewritten.

A confirmed league outcome never establishes who killed a king, betrayal or any other replay event.

## Compatibility and presentation

Statistics schema advances from 1.0.0 to 1.1.0 for the additive `matchFacts` field; projection/formula versions and detector outputs remain unchanged. The golden's only intended semantic change is this schema version. Analysis caches advance to V4, with replay-lab cache invalidation synchronized. V3 caches remain readable with unknown missing header/postgame coverage.

No website panels or bulk raw-settings display are added. Existing consumers continue receiving statistics; a later presentation adapter can selectively expose useful map/rules/result context. Raw IDs, provenance and technical diagnostics are internal evidence.

Existing immutable canonical bundles need no header rewrite: new statistics can be projected from them. Older deployed statistics/source documents do not magically acquire the new field. Deployment requires the updated worker and Functions together; any backfill must publish a new versioned derived artifact/revision through the administrative workflow rather than overwrite source evidence.

## Validation

Regression checks cover false/zero preservation, conflicting header domains, raw no-team groups, source integrity, missing legacy cache coverage, replay-free rebuilds and unchanged detector/social output. Result checks cover accepted team/individual rosters, corrections, disputes, invalid identities, contradictory losses, upload provenance and inactive scoring. The real-recording audit now reports retained map/rules/groups/header provenance and postgame/resignation evidence for all 14 corpus recordings. Structural audit results are distinct from full byte/event conformance.

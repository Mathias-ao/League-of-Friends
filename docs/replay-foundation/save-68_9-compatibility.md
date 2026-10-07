# DE save 68.9 custom-scenario extraction compatibility

## Scope

`AOF_DE_HEADER_COMPAT_V1` in `replay-tools/header_compat.py` restores extraction
of `replay-fixtures/FFA_diplo.aoe2record` (SHA-256
`ab947d934bbd4fa4e2531f4f8a5014f9b923038a34aa7332d7260eb78fb3fab5`),
DE build 185872, save 68.9, scenario 1.59 and trigger section 5.0.
This is an ordinary-game regression fixture, not a controlled engine-state test.

The pinned `mgz-fast==1.0.0` dependency stays unchanged. All 14 previous corpus
recordings, including the three standard-map 68.9 test recordings, retain the
original decoded header and body offset. The compatibility wrapper is local to
AoF; no installed dependency or process-global decoder function is patched.
Replay Lab, CLI extraction and the threaded upload worker share the same path.

## Failure and repair

The old decoder assumes empty scenario AI scripts, a trigger 4.5 anchor,
26-byte trigger prefixes, 216-byte effects and 125-byte conditions. This custom
scenario contains nonempty embedded AI scripts, trigger 5.0, 27-byte prefixes,
340-byte effects with selection arrays and extra strings, and 144-byte
conditions with XS strings and display-order arrays. A missing anchor was also
interpreted as offset seven instead of rejected.

The compatibility path reads length-prefixed AI text, disabled-item lists and
expanded trigger records with bounds checks. It verifies scenario/trigger
versions, repeated trigger counts, effect/condition layout markers and trigger
order. Missing/ambiguous anchors and unsupported layouts fail closed.
The scenario AI map-type identifier is read from its actual field, not from
misaligned script bytes or the trigger count.

Reference: AoE2ScenarioParser DE 1.59 structure at upstream commit
`e5b483a80f2e6096f019a8ea128eed3aa4f9f188`:
https://github.com/KSneijders/AoE2ScenarioParser/blob/e5b483a80f2e6096f019a8ea128eed3aa4f9f188/AoE2ScenarioParser/versions/DE/v1.59/structure.json
The reference is a layout aid; the actual recording supplies the trigger 5.0
anchor and the regression expectations. It does not qualify other layouts.

## Compatibility and truth boundaries

- CanonicalReplay remains schema 1.1.0 and the current normalizer revision.
- No statistics formula, detector, classification, aggregation, relationship
  rule or old statistical golden is changed.
- The extraction manifest's exporter-code digest includes this adapter. The
  retained decoded header also records `AOF_DE_HEADER_COMPAT_V1` and the offset
  of its unparsed tail. Raw header and body bytes remain reconstructable.
- The new custom-scenario extension after triggers is not the legacy lobby.
  It remains retained raw and unqualified. `lobby` is empty, and a structured
  `HEADER_LOBBY_EXTENSION_UNQUALIFIED` warning is published. Seed, reveal-map,
  legacy game-type and map-size fields remain null instead of misleading
  numbers. Separately decoded DE settings (including population and explicit
  team-lock false), map dimensions, participant identities and action evidence
  remain available.
- Embedded scenario bitmaps and unreviewed scenario/trigger versions fail with
  an explicit unsupported-layout error. Support is not claimed for every 68.9
  scenario or future recording build.
- The compatibility registry deliberately leaves this build as an unverified
  tuple for capabilities not independently qualified. Extraction/framing
  regression is not semantic qualification of diplomacy, initial objects,
  winner determination or custom scenario rules.
- There are 171025 retained operations, a 5703316 ms observed interval and 83
  directed diplomacy commands. The five existing statistics categories project
  for all eight players. Counts/labels remain subject to existing coverage and
  inference rules; no command proves successful alliance formation or betrayal.
- The owner's first-hour CaptureAge observations are still needed to compare
  diplomacy chronology. No scored betrayal or effective diplomacy transition
  is activated by this fix.

## Verification and use

```powershell
git switch feat/pair-social-evidence-v1
git pull --ff-only
npm.cmd --prefix replay-lab start
```

Restart any running Replay Lab or Python upload worker after pulling. Re-extract
the failed recording: statistics recalculation alone cannot create its missing
canonical evidence. No new pip dependency is required.

Header compatibility tests run in normal Replay Tools CI. Hash-pinned full
extraction/conformance and statistical-summary regressions run with:

```powershell
$env:AOF_REPLAY_FIXTURE_DIR = "$PWD/replay-fixtures"
python -m unittest discover -s replay-tools/tests -p test_real_replays.py -v
```

Use Replay Lab's **Full conformance audit** for exhaustive artifact/schema and
source-byte reconstruction checks. This does not substitute for engine/UI
observations when qualifying diplomacy effects.

## Repair acceptance (5 October 2026)

- Normal suite: 248 tests, 244 passed and four opt-in full-replay skips.
- Existing corpus: all 14 previous decoded headers and body offsets are
  identical to the pre-repair decoder path.
- New FFA: full schema/artifact/source-byte conformance passed; all 4408509
  source bytes and 171025 operations retained; all eight participants project
  the five statistics categories; 83 directed diplomacy commands retained.
- Node canonical-consumer checks: both passed.
- Opt-in historical full-replay tests exposed **pre-existing stale goldens**:
  TownBell FFA and upstream duel differ only in normalizer metadata (V1_1
  expected versus the branch's existing V1_2); paired-duel statistics differ
  only in the six inference/estimate warning codes already emitted by the
  current statistics engine. These are not caused by the header adapter. The
  old goldens were deliberately not rewritten as part of this repair.
- Remote CI results must be checked on the exact branch commit; local results
  do not claim that queued remote checks passed.

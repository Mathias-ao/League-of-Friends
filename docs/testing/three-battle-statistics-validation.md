# Three-Battle statistics validation

Status: development/test harness only  
Schema: `AOF_THREE_BATTLE_VALIDATION_V1`

## Purpose

Validate the current Age of Friends statistics stack with exactly three 1v1 recordings while treating the two recorded replay participants as two chosen **test league identities**.

This is deliberately not a second replay pipeline and not a shortcut around AoF evidence rules. Each recording still follows the normal replay foundation:

```text
.aoe2record
  -> full-conformance CanonicalReplay
  -> AOF_REPLAY_ANALYSIS_V3
  -> AOF_CANONICAL_STATISTICS_V1 Battle statistics
  -> test-only league identity binding
  -> neutral three-Battle aggregate / Pair History
  -> configured interpretation engines (currently intentionally unconfigured)
```

The binding happens **after** Battle statistics projection. CanonicalReplay, parser identities, replay hashes and Battle evidence keep the original recorded player names and slots.

## Why three Battles

The current player-profile contract reveals Patterns of Play after three eligible Battles. Three 1v1 Battles are therefore the smallest useful validation set for checking Battle-level evidence, a season-scoped longitudinal aggregate, personality eligibility and a persistent two-player Pair History in one controlled exercise.

Three Battles are enough data to test the plumbing. They are **not** permission to invent the missing interpretation rules. `AOF_PLAYSTYLE_ENGINE_V1` still requires an explicit normalization population and PlaystyleRuleSet. The current relationship engine also has no approved Rivalry / Hostility / Bond point/stage rules and still predates that final product model.

Expected output today:

- Battle statistics: real replay-derived output for all three recordings.
- Three-Battle season validation aggregate: real neutral aggregation, using `AOF_LIFETIME_STATISTICS_V1` over only these three Battles.
- Personality: reveal eligibility becomes true at three eligible Battles, while slider projection remains `UNCONFIGURED` until explicit rules are approved.
- Pair History: real `AOF_PAIR_HISTORY_V1` encounter/result/directional evidence across the three Battles.
- Relationship interpretation: remains `UNCONFIGURED`; no relationship points or stages are fabricated.

## Manifest and identity binding

The default manifest is:

`replay-lab/fixtures/three-battle-validation.json`

It uses the repository's three existing 1v1 recordings only as a structural regression set. They are **not claimed to be representative Age of Friends league matches**. Replace the three `replayPath` values with the representative recordings selected for the product test.

Each Battle contains two bindings:

```json
{
  "replaySlot": 1,
  "playerKey": "emperor",
  "expectedReplayName": "Name actually recorded in the replay"
}
```

`expectedReplayName` is optional for initial inspection but recommended for the final test manifest. When present, the harness fails if the slot/name pair does not match, preventing an accidental Emperor/challenger swap.

The configured `playerId` values are validation identities, not production player mutations. If the final test should use specific existing AoF player IDs, replace only the manifest values; do not edit the replay or CanonicalReplay participant identity.

## Result handling

The harness will infer a 1v1 winner only when the statistics projection contains exactly one observed resignation and the other mapped participant is therefore unambiguous.

If the replay does not expose an unambiguous result that way, the harness stops. After independently verifying the source game's result, set `winnerPlayerKey` for that Battle in the manifest. That override is labelled `validation_manifest_override` in the report and is never written into CanonicalReplay.

This strictness is intentional: season win/loss aggregation and Pair History should not be built on a guessed result.

## Run

From the repository root:

```bash
python -m pip install -r replay-tools/requirements.txt
npm --prefix functions ci
npm --prefix functions run build
node replay-lab/three-battle-validation.mjs \
  --manifest replay-lab/fixtures/three-battle-validation.json
```

Optional output path:

```bash
node replay-lab/three-battle-validation.mjs \
  --manifest replay-lab/fixtures/three-battle-validation.json \
  --out .replay-lab/my-three-battle-report.json
```

The run uses the parser's `full` CanonicalReplay seal. This is slower than Replay Lab's normal interactive `fast` seal, but appropriate for a controlled validation set.

## Output

Run artifacts remain under:

`.replay-lab/three-battle-validation/<run-id>/`

For each Battle, the directory retains its adapter, fully sealed canonical bundle, compact analysis dataset and complete Battle statistics projection. `report.json` adds only test-context binding and longitudinal outputs.

The report records:

- replay path and SHA-256;
- Battle/statistics/canonical model versions;
- raw replay identity beside mapped test league identity;
- result and result basis;
- warning codes;
- the neutral three-Battle player aggregate;
- three-Battle personality eligibility plus the deliberately `UNCONFIGURED` playstyle engine result;
- Pair History with directional replay-derived signals;
- the deliberately `UNCONFIGURED` relationship engine result.

## Guardrails

- Never rewrite recorded player names or IDs inside CanonicalReplay.
- Never write this validation run into Firebase or production league state.
- Never call the three-Battle aggregate a production Season Statistics implementation; that presentation/aggregation layer is still pending.
- Never synthesize slider normalization, weights or component rules to make personality scores appear.
- Never synthesize Gallantry / Treachery / Chivalry awards or Rivalry / Hostility / Bond points/stages.
- Keep source replay result overrides explicit and test-only.
- Keep full Battle artifacts so every longitudinal value remains traceable to source evidence and model versions.

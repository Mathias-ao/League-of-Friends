# Age of Friends entity catalogue

The entity catalogue converts raw replay IDs into reference labels and classifications without replacing the raw identity stored in CanonicalReplay.

The current primary reference snapshot is `aoe2techtree-b9d494df6921.json`. Raw replay IDs remain authoritative; reference labels are not automatically qualified for the replay's patch or data mod.

## AIRef supplementary-source rule

AIRef may be used to enrich object relationships such as class, line, set, dead-object and projectile references, subject to a strict **AoE2 DE only** rule.

Admissible AIRef source:

- `https://airef.github.io/tables/objects.html`
- corresponding source data from the same pinned `airef/airef.github.io` revision
- a row is imported only when its AIRef Definitive Edition applicability flag is true (`de == 1`)

Explicitly excluded:

- `objects-ror.html` / Return of Rome object data
- `objects-bfg.html` / Chronicles object data
- rows that do not declare Definitive Edition applicability
- generic AI-reference assumptions not tied to the pinned object row

AIRef's main AoE2 table contains version flags for AoK, The Conquerors, HD/WololoKingdoms and Definitive Edition. AoF must filter to the **DE flag**, not merely assume that appearing on the main table means an object is valid for AoE2 DE.

Every imported field must retain:

- source repository and commit/revision;
- source table/dataset;
- raw AIRef object ID representation;
- the DE applicability flag used for admission;
- field-level provenance when AIRef supplements a different primary source.

IDs that differ by version must not be collapsed into one timeless mapping. Resolution remains replay-build/version aware.

## Safety rule for statistics

Dead-object and projectile relationships are catalogue facts, not replay outcome facts. Their presence in this catalogue does **not** prove a death, kill, destroyed building, shot or damage event occurred in a recording.

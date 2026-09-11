# Age of Friends — Current State and Task Router

Status date: 11 September 2026  
Implementation baseline inspected: `94f5b125245a56f64119477f5bf00ff17da95352` on `main`  
Purpose: let a new project task start from GitHub alone.

## How to begin any task

1. Read [`PROJECT-CONTINUITY.md`](PROJECT-CONTINUITY.md) for the locked product direction and authority order.
2. Read this file for current state and select one bounded workstream.
3. Inspect the latest `main` code for the area being changed. The baseline above records the implementation reviewed for this status; later code may supersede it.
4. Read the specialist source linked in the routing table.
5. State whether the task changes product rules, implementation, analysis, generated artifacts or only documentation.
6. For replay work, state explicitly whether binary replay parsing is authorized. The extraction contract has been settled; parser implementation is deferred until a later task.

Do not require an old chat to understand a task. If a chat contains a lasting decision that is absent here, persist it in the appropriate configuration, decision record or continuity update before treating it as locked.

## Product state

Age of Friends is a private, persistent AoE2:DE league for friends. Its tone is serious, hardcore, historical, martial and understated. Competition and data truth lead; drama and narrative come from real league evidence.

The player journey is:

1. join the league and receive a durable player identity;
2. enter a season;
3. answer each event signup separately;
4. check in and receive an approved Match/Game plan;
5. complete the Game and upload a recording;
6. receive a normally final result, statistics and league consequences, with a small dispute route.

Players do not manually enter post-match statistics. Admin tools exist for exceptions and corrections.

### Locked competition direction

| Area | Current decision |
|---|---|
| Brand | Age of Friends (AoF); technical repository name League of Friends. |
| Season I | The Fiefdom of Bad Neighbors; European conflicts relevant to AoE2:DE. |
| Event I | The War for Lombardia; 4v4, Lombardia, Standard Victory; web-app civilization draft; unique civilizations within the Game; random captain when needed. |
| Flexible attendance | The approved topology may differ from the advertised format, including asymmetric teams or FFA. Systems must consume the approved Game plan. |
| Event II | Multiple Mediterranean 2v2s, some naval play, players on the same landmass, thematic civilization pool. Final rules/configuration are not yet persisted. |
| Later events | Halloween FFA, Christmas FFA Capture the Relic, New Year King of the Hill. Details remain future design. |

### Locked identity and social direction

- A permanent league `playerId` is distinct from authentication UID, display name, external profile ID, replay slot and replay object IDs.
- Relationships are separate Rivalry, Enemy and Friend tracks.
- Rivalry progression is Friction → Competing → Rivalry → Nemesis.
- Enemy progression and labels are under exploration: Grudge → Bad Blood → Enemy → Vendetta → Blood Feud → Internecine Strife.
- Friend progression and labels are under exploration: Friendly → Respect → Honored → Trusted Friend → Blood Brothers.
- Level 3 Rivalry or Enemy unlocks the War Room. The Friend reward remains unresolved.
- Current backend rivalry code implements an older single-score model. Do not present it as the settled three-track design.
- Portraits begin in a newcomer/peasant state. Later identity uses sustained production-commitment evidence across recent and lifetime Games, with minimum evidence, confidence and hysteresis. Exact thresholds are not frozen.

## Implemented repository state

“Implemented” means code or configuration is present, not that production deployment or every scenario has been certified.

| Workstream | Present on the inspected baseline | Material limitations |
|---|---|---|
| Firebase foundation | Node.js 22, TypeScript, Functions v2, Firestore rules/indexes, auth mapping and Emulator Suite setup. | No production project or deployment is documented as active. |
| Membership and competition | Membership review, seasons, events, RSVP/check-in, flexible match-plan generation/approval and Game creation. | No committed user-facing client. Draft integration is not end to end. |
| Results | Result submission/respond/admin resolution, canonical result pipeline, disputes, corrections and revision history. | Normal replay-derived automatic result qualification is not complete. Completed downstream projections need explicit eligibility withdrawal during disputes/corrections. |
| Processing | Idempotent jobs for rewards, power ratings, statistics, achievements, rivalries, records and activity. | Models are V1 foundations and may not yet reflect all locked product changes. |
| Read models | League bootstrap, event detail, Match detail, player profile and War Room queries. | Frontend consumption is absent. |
| Replay adapter | `mgz-fast==1.0.0`, V3 compact adapter, optional CanonicalReplay 1.0 bundle and seven-shape corpus tooling. | Canonical export is optional; permanent source retention and full raw-byte coverage are not enforced. |
| Replay ingestion | Admin ingestion, immutable raw-stat documents, revisions, derived statistics and player/record rebuild commands. | Name/manual mapping remains in tooling; bulk canonical artifacts are not the normal ingestion contract; caller does not guard promotion with an expected active revision. |
| Match analysis | Structural V1.3 findings and analysis-only V1.4 entity/opening/raid/diplomacy work. | V1.4 semantic review is not recorded as complete. Corpus reader currently consumes only the first listed chunk. FFA diplomacy semantics remain unqualified. |
| Content | Brand file, Season I content, Event I narrative and landing-page design record. | Event II and later content are not persisted; artwork paths are empty. |

## Replay and extraction decision

The settled decision is [`../architecture/replay-extraction-contract-v1.md`](../architecture/replay-extraction-contract-v1.md). Use it as the implementation target when replay parser work resumes.

The selected boundary is an AoF-owned canonical evidence exporter around the existing Python decoder. It must retain the original Game recording and reusable primitive evidence, with field-level provenance, coverage and immutable versioned artifacts. CanonicalReplay 1.0 remains unchanged. A separate `AOF_EXTRACTION_V1` run envelope will bind league Match/Game identity, source selection, extraction versions, artifact integrity, coverage and qualification.

The replay facts support later projections without reopening the binary file. They do not turn queue requests into completed units, spatial commands into confirmed combat, or EOF into a winner. Result qualification remains an independent path so a reliable result can become final before optional analysis completes.

The authoritative replay sources are indexed in [`../replay-foundation/README.md`](../replay-foundation/README.md). The TownBell capability matrix is a traceability catalogue, not the storage schema.

### Required later extraction work

1. Make permanent original replay retention and canonical packaging part of the normal authorized upload path.
2. Add complete raw byte/range accounting, field claims, offset domains, unknown/failure preservation and capability-level coverage.
3. Separate league Match/Game identity, source identity, recording/segment identity and extraction run identity.
4. Bind replay participants through verified external identity links and the approved Game roster; names are only cross-checks.
5. Remove invented map-size/completion fallbacks and distinguish framing completeness, recording coverage, game completion and result evidence.
6. Read and verify every canonical artifact chunk.
7. Stage immutable artifacts, then promote active pointers with expected-revision guards.
8. Qualify production requests, cancellations, producer association, timing, dynamic diplomacy and result evidence with controlled fixtures.
9. Prove complete birth/completion evidence before offering exact units-trained statistics; otherwise expose production commitment honestly.

## Task routing

| If the next task concerns… | Read first | Safe next action / gate |
|---|---|---|
| Project direction or a cross-cutting decision | `PROJECT-CONTINUITY.md`, this file, current code | Update the source closest to the decision; keep implemented and planned state distinct. |
| Replay extraction/parser | extraction contract; replay foundation; `replay-tools/`; `README-TEST.md` | Implement against the contract only when parsing is explicitly in scope. Run controlled and corpus qualification; do not infer completion from queues. |
| Match Analysis V1.4 | `README-MATCH-ANALYSIS-V1_4.md`; canonical artifacts; analysis engine | Regenerate the entity catalogue and run analysis on existing facts. Do not reparse merely for V1.4. Record review findings before V1.5. |
| Results, disputes or corrections | Firestore architecture; result commands/engine; processing trigger | Maintain one active result and one eligible downstream contribution. Test correction/dispute invalidation. |
| Replay upload integration | extraction contract; replay ingestion commands; Game model; auth | Design authenticated upload, archive-first storage, verified roster binding, async worker and guarded selection. |
| Relationships / War Room | this file; continuity; rivalry engine; War Room challenge/query files | Freeze Enemy labels/thresholds and Friend reward before migrating the single-score model to three tracks. Preserve directed evidence. |
| Player portraits | continuity; extraction contract; player statistics/analysis | Design a versioned profile model from production commitment with minimum games, confidence, recent/lifetime balance and hysteresis. |
| Events and drafting | season/event configs; match planner; event commands | Persist Event II or add draft integration. Preserve flexible topologies and civ uniqueness within each Game. |
| Web UI | brand; season/event content; landing-page design; backend queries | Establish a client stack and consume read models without client writes to authoritative competition state. |
| Firebase/backend | Phase 2 architecture; functions exports/types; setup guide; smoke scripts | Build in Functions v2, keep authoritative writes server-side and test through Emulator Suite. |

## Open product decisions

These remain choices for a future product-design task. Do not silently resolve them in implementation:

- final Enemy labels and thresholds;
- Friend-track reward or unlock behavior;
- exact relationship weights, decay, reciprocity and seasonal/lifetime policy;
- portrait graduation threshold, evidence window, dominance threshold and hysteresis;
- final Event II civilization pool, rules, schedule and content;
- frontend stack and production hosting/deployment plan;
- exact V1 statistics presented to players, within the evidence boundaries already locked.

## Known technical gaps

- `README-TEST.md` describes the structural corpus path; its “expected next step” predates V1.3/V1.4 and must not override this state file.
- `docs/architecture/phase-2-firestore.md` is the original architecture baseline. Some suggested shapes are now implemented differently; current code wins for implemented behavior.
- The existing raw-stat path stores a bounded JSON payload in Firestore. The extraction contract requires lightweight manifests plus external immutable bulk artifacts for the permanent design.
- The replay exporter currently leaves `retainedReplay.uri` null, makes `--canonical-dir` optional, derives completion from body parse completeness and uses a map-size fallback.
- The corpus analysis reader uses the first chunk only. Multi-chunk generation must not be treated as supported until every listed chunk is read and verified.
- Current admin replay ingestion maps normalized names or manual overrides. Durable external profile binding is required for the normal player upload flow.
- Current ingestion revisions are immutable and idempotent for identical data, but future worker promotion needs an expected-active/source-selection guard.
- Opening/raid analysis remains a heuristic layer. FFA raid confidence stays capped until diplomacy modes are explicitly qualified.
- The repository contains no web-client source directory.

## Validation commands

Use only the commands relevant to the files changed.

```bash
npm --prefix functions install
npm --prefix functions run build
npm --prefix functions run lint
```

Run the Emulator Suite and the relevant `scripts/smoke-test-*.mjs` scripts for backend behavior. `README-TEST.md` documents replay corpus setup. `README-MATCH-ANALYSIS-V1_4.md` documents analysis-only V1.4 execution. Replay fixture files and generated corpus outputs are deliberately uncommitted unless a task explicitly establishes a safe fixture policy.

## Completion record for future tasks

At the end of meaningful work, record:

- the exact commit and changed files;
- what behavior is implemented versus decided for later;
- tests and generated artifacts actually run;
- any changed product or evidence decision;
- the next bounded action and its prerequisites;
- whether replay binaries were parsed or the work used retained canonical facts.

Update this file when the implemented state, active routing or material gaps change. Update `PROJECT-CONTINUITY.md` only when project-wide identity, authority, architecture, locked direction or top priorities change.

# Age of Friends — Project Continuity and Recovery File

Status date: 11 September 2026  
Purpose: Preserve the project's identity, locked decisions, technical truth, active work, and restart procedure independently of long ChatGPT conversations.

## 1. How to use this file

This is the first file to read for any fresh Age of Friends task. It is a continuity map, not a replacement for current code or specialist documents. Read [`CURRENT-STATE.md`](CURRENT-STATE.md) next for the implemented state, known gaps and task routing.

Authority order when sources disagree:

1. The latest explicit decision by Mathias.
2. The current files and code on `main` in `Mathias-ao/League-of-Friends` for implemented behavior.
3. Domain-specific authoritative artifacts named in section 9.
4. This continuity file for product intent, locked decisions, current state, and routing.
5. Old conversations as historical evidence only.

Do not infer that an idea is implemented merely because it is described here. Check the repository before changing code. Do not overwrite newer repository behavior with an older chat summary.

## 2. Project identity

- Product name: **Age of Friends**.
- Short name: **AoF**.
- Technical repository/project name: **League of Friends**.
- Repository: `Mathias-ao/League-of-Friends`.
- Product: a private, persistent Age of Empires II: Definitive Edition league for friends.
- Core loop: real matches become lasting standings, statistics, achievements, player identity, rivalries, War Room activity, and shared league history.
- Tone: serious, hardcore, historical, martial, and understated.
- Avoid: generic fantasy, constant jokes, overt history-class parody, and esports clichés.
- Humor rule: humor is sparse and underplayed so it lands against an otherwise serious historical-war presentation.
- Design doctrine: competition and data truth come first; drama must be earned from real match events.

## 3. Product doctrine and invariants

- Admins steer exceptions; automation runs the normal machinery.
- Prefer configurable rules and versioned models over hard-coded special cases.
- League Points, War Room Points, and Gold are separate accounting systems.
- A Match is one competitive encounter and may contain one or more Games.
- One `.aoe2record` represents one Game.
- The original replay file must be retained permanently and identified by content hash.
- Parsed and derived results must be reproducible from retained source evidence.
- Event configuration must be snapshotted so historical results remain reproducible.
- Raw replay facts, deterministic reconstructions, inferred analysis, and league scoring must remain separate.
- The client may read Firestore directly but must not directly mutate authoritative competition state.
- Privileged changes run through authenticated Cloud Functions.
- Processing must be idempotent; corrections and disputes must be auditable.
- Do not ask players to manually enter post-match statistics. Their required post-match action is replay upload.
- A result normally becomes final directly, with a small dispute option. A resolved correction invalidates the prior canonical result so only one result contributes to statistics.

## 4. Current competition identity

### Season I

- Title: **The Fiefdom of Bad Neighbors**.
- Region and premise: European conflicts and rivalries relevant to AoE2 DE.
- Tagline: **Good fences make good neighbors. Castles make better ones.**
- Participation hierarchy: join the league once, enter each season separately, then answer each event signup separately.

### Event I

- Title: **The War for Lombardia**.
- Format: 4v4, Lombardia, Standard Victory.
- Structure: eight factions, two randomly formed alliances, one battlefield.
- Civilization selection belongs in the web app so picks map cleanly to player and replay statistics.
- Civilization choices are unique within the match.
- Match captain is selected randomly per match when a captain is needed.
- Attendance contingencies may change match topology. Drafting must adapt to the actual approved match plan rather than assume the advertised player count.

### Later event direction already chosen

- Event II: multiple 2v2 matches with a Mediterranean theme, some naval play, players on the same landmass, and a geographically appropriate civilization pool.
- Later seasonal events include a Halloween FFA, Christmas FFA Capture the Relic, and New Year King of the Hill.
- Treat later-event details not yet represented in repository configuration as design decisions awaiting formal persistence, not implemented state.

## 5. Social and identity systems

The relationship model is three distinct tracks, not one blended relationship score:

- Rivalry direction: Friction → Competing → Rivalry → Nemesis.
- Enemy direction under exploration: Grudge → Bad Blood → Enemy → Vendetta → Blood Feud → Internecine Strife. Labels and exact thresholds are not fully frozen.
- Friend direction under exploration: Friendly → Respect → Honored → Trusted Friend → Blood Brothers. The reward/unlock behavior is still unresolved.
- Level 3 on Rivalry or Enemy unlocks the War Room.
- The current repository may still contain the earlier single-score rivalry model. Treat migration to three tracks as required product work, not completed behavior.

Player portraits are persistent identities derived from evidence, not cosmetics that change after every match:

- New players begin in a peasant/newcomer state and graduate after enough games.
- Later identity reflects dominant military family and earned equipment or titles.
- Portrait changes require a clearly dominant pattern across recent matches plus lifetime evidence.
- Use confidence, minimum sample size, recency, and hysteresis so one unusual match does not rewrite identity.
- The evidence should describe military production commitment unless later simulation proves completed/live units.

## 6. Technical architecture

- Current platform: Firebase and Cloud Firestore.
- Backend: Node.js 22, TypeScript, Firebase Cloud Functions 2nd gen, Firestore, Firebase Authentication, and Local Emulator Suite.
- Authentication UID is not the permanent player identity. Private auth links map authentication accounts to durable player IDs.
- The Google Sheets / Apps Script implementation is historical domain-prototype context, not the current architecture.
- Firestore stores lightweight operational, summary, manifest, and read-model documents.
- Large immutable replay artifacts and event families should live outside Firestore documents and be referenced by hashes/manifests.
- A production Firebase project was not yet committed in the inspected repository; emulator-first development remains the documented baseline.

## 7. Replay-analysis truth model

The durable replay contract is **CanonicalReplay 1.0**. The existing 320-metric TownBell-shaped output remains a projector or compatibility/reporting layer, not the permanent source of truth.

Required layers:

1. Direct parser facts with raw IDs, coordinates, bytes, provenance, decode status, and operation ordinals.
2. Deterministic reconstructions with named rules and model versions.
3. Inferred analytical metrics with thresholds, evidence, confidence, and availability.
4. League interpretations and scoring, separately versioned.

Semantic rules:

- A recording is an initial state plus a timed operation stream, not authoritative game state at every moment.
- Preserve queue/order/placement/click/command wording unless stronger evidence exists.
- Queue commands prove requested production amounts, not guaranteed completed units. Avoid the label `unitsTrained` for queue-derived data.
- Preserve observed `AgeReached` system events separately from projected age-completion estimates.
- Actual unit creation, completion, survival, resources, kills, damage, visibility, and exact positions generally require compatible engine simulation.
- Store dynamic diplomacy as a time-varying, directed player-to-player graph.
- Store interaction evidence for every ordered pair; do not reduce FFA relations to nearest-opponent shortcuts.
- Camera evidence is recorder-only and must retain that availability limitation.
- AI may narrate established results but must never manufacture canonical match facts.

## 8. Verified implementation state

Repository baseline inspected for this recovery:

- Branch: `main`.
- Implementation baseline commit: `94f5b125245a56f64119477f5bf00ff17da95352`.
- Commit time: 11 September 2026, 07:45:00 UTC.
- Commit message: `docs: add project continuity and recovery file`.
- The later project-direction synchronization changes documentation and preserved research, not runtime implementation.
- Replay Tools CI: passed for the baseline commit.
- Backend CI: passed for the baseline commit.

Replay parser/analysis status at that baseline:

- Canonical replay extraction and corpus tooling exist in the repository.
- Match Analysis V1.3 established structural stability across 1v1, 2v2, 3v3, 4v4, FFA/dynamic diplomacy, Nomad, and water fixtures.
- V1.4 is an analysis-only semantic upgrade. **Do not reparse the replay corpus merely to run V1.4.**
- V1.4 uses entity roles for opening classification, separates context tags from strategy tags, adds raid evidence quality, caps FFA raid confidence until diplomacy semantics are mapped, and excludes low-confidence raids from team-support candidates.
- The immediate review inputs are `match-analysis-output-v1-4/match-analysis-summary.json` and `.md`.
- The immediate questions are opening resolution, context/strategy composition, high-confidence raid survival, FFA diplomacy mode mapping, and plausibility of raid pairs.
- The extraction-tool requirements are now settled in `docs/architecture/replay-extraction-contract-v1.md`. Parser implementation and new binary replay processing are deferred until a later task explicitly selects that workstream.

Important implementation boundaries:

- The repository contains a broad backend foundation and replay analysis, but no committed user-facing web client or complete authenticated replay-upload pipeline.
- The current rivalry engine predates the locked Rivalry / Enemy / Friend split.
- The current canonical exporter and ingestion path do not yet satisfy every requirement of the extraction contract.
- See `CURRENT-STATE.md` for the exact implemented/planned distinction and known gaps.

## 9. Authoritative artifacts and integrity record

### GitHub

- Repository `Mathias-ao/League-of-Friends` is the source of truth for implementation.
- `docs/project/CURRENT-STATE.md` is the current task router and implementation handoff.
- `branding/site.json` is the source of truth for brand identity.
- `seasons/S001-fiefdom-of-bad-neighbors.json` and `events/E001-lombardia.json` hold the current persisted season and first-event identity.
- `docs/architecture/replay-extraction-contract-v1.md` is the settled extraction-tool decision for later implementation.
- `README-MATCH-ANALYSIS-V1_4.md` is the analysis-only V1.4 workstream note; it does not authorize corpus reparsing.

### Replay foundation files

| Artifact | Role | SHA-256 of preserved file |
|---|---|---|
| `docs/replay-foundation/Age-of-Friends-Replay-Analysis-Foundation.md` | Research, evidence boundaries, architecture, backlog, and test plan | `83df810d644e950155145049455ea52e8666d7b241c8da4bab20e4f71876c6e5` |
| `replay-tools/canonical-replay-v1.schema.json` | CanonicalReplay 1.0 JSON Schema used by tooling | `a20de391236d8e81219fc2edac3e2407e391cbebd9c49b63a9d5e2822fa22f72` |
| `docs/replay-foundation/townbell-capability-matrix.csv` | 320-row capability mapping plus header | `2506011e77cf17a5f4c6bd2d36aae6bcf1b6f85fde62462c44fe5982e4d1d4ce` |
| `docs/architecture/replay-extraction-contract-v1.md` | Settled extraction-tool boundary, storage, evidence, lifecycle and acceptance gates | `53d86164b6f5e9cfe8c600fd85ce07d3523516e8e2ff52016a51323dd155a708` |

Integrity checks performed during recovery:

- The CanonicalReplay schema parses as valid JSON.
- The capability matrix contains 321 CSV lines: one header plus 320 capabilities.
- The three preserved files total 344,290 bytes.

The replay foundation now lives in GitHub and is indexed by `docs/replay-foundation/README.md`. Do not edit these three files casually. Make a deliberately versioned successor when their contract or research conclusions change, and record why.

## 10. Active priorities

Choose one bounded workstream. Current candidates, rather than a forced sequence, are:

1. Product rules: freeze Enemy labels/thresholds and the Friend reward, then design the three-track migration.
2. Replay upload/backend: design the authenticated archive-first upload and job-orchestration path against the extraction contract, without implementing binary parser changes unless that is explicitly the task.
3. Replay analysis: complete the V1.4 semantic review from existing canonical facts; map FFA diplomacy before high-confidence FFA raid claims. Do not reparse merely for V1.4.
4. Extraction implementation: when explicitly resumed, close source retention, identity, byte coverage, chunk reading, guarded promotion and qualification gaps in contract order.
5. Product/UI: choose a client stack and implement read-only league surfaces from existing backend queries, keeping authoritative competition writes in Functions.
6. Event design: persist Event II's final competition/content configuration and civilization pool.
7. Player identity: design the portrait model from versioned production-commitment evidence after its exact V1 inputs are chosen.

`CURRENT-STATE.md` records prerequisites, implemented limitations and specialist sources for each workstream.

## 11. Fresh-chat operating procedure

Long chats are archives, not working databases. GitHub contains the active project direction and replay foundation. Old conversations are secondary history.

Use one fresh chat per bounded workstream:

- Replay parser and match analysis.
- Firebase/backend and data model.
- Product rules, events, and relationship systems.
- Web UI, brand, and narrative content.

At the start of a fresh chat:

1. Point the task at this repository and ask it to read this file plus `CURRENT-STATE.md`.
2. Tell it to inspect the latest `main` code and the specialist source linked for the workstream.
3. State one concrete outcome for the session.
4. For replay work, explicitly say whether binary parser changes or replay processing are in scope. V1.4 alone does not require reparsing.

At the end of meaningful work:

1. Put code and implementation docs in GitHub.
2. Put large research or reusable artifacts in persistent file storage.
3. Record the exact commit, tests, generated outputs, decisions changed, and next action.
4. Update this file only when project-wide identity, authority, architecture, locked scope, or active priority changes.
5. Start a new chat when the workstream changes or the current thread becomes long and unreliable.

## 12. Copyable bootstrap prompt

> Continue Age of Friends from `Mathias-ao/League-of-Friends`. Read `docs/project/PROJECT-CONTINUITY.md` and `docs/project/CURRENT-STATE.md`, then inspect the latest `main` implementation and the specialist documents linked for this workstream. GitHub is sufficient project context; use old chats only as secondary history. Preserve the Age of Friends brand, data-truth doctrine, immutable replay evidence, CanonicalReplay layering and authority order. The concrete task is: [ONE TASK]. Before editing, identify current relevant behavior, intended files and any conflict with locked direction. When finished, record the exact commit, tests/artifacts actually run, implemented versus deferred behavior and the next bounded action.

## 13. What this recovery does and does not do

This file preserves the project's center of gravity and gives fresh tasks a reliable restart path. It does not claim every brainstorm is locked, replace detailed schemas or certify uninspected work. A lasting decision absent from GitHub is not part of the active project direction until deliberately promoted into the appropriate source.

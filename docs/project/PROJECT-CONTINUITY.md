# Age of Friends — Project Continuity and Recovery File

Status date: 11 September 2026  
Purpose: Preserve the project's identity, locked decisions, technical truth, active work, and restart procedure independently of long ChatGPT conversations.

## 1. How to use this file

This is the first file to give any fresh chat working on Age of Friends. It is a continuity map, not a replacement for the repository or the specialist replay documents.

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
- Baseline commit: `46671d9e411049bbb95855b159fa1eceb357daf3`.
- Commit time: 11 September 2026, 06:59:16 UTC.
- Commit message: `Upgrade replay parser and match analysis foundation`.
- Replay Tools CI: passed for the baseline commit.
- Backend CI: passed for the baseline commit.

Replay parser/analysis status at that baseline:

- Canonical replay extraction and corpus tooling exist in the repository.
- Match Analysis V1.3 established structural stability across 1v1, 2v2, 3v3, 4v4, FFA/dynamic diplomacy, Nomad, and water fixtures.
- V1.4 is an analysis-only semantic upgrade. **Do not reparse the replay corpus merely to run V1.4.**
- V1.4 uses entity roles for opening classification, separates context tags from strategy tags, adds raid evidence quality, caps FFA raid confidence until diplomacy semantics are mapped, and excludes low-confidence raids from team-support candidates.
- The immediate review inputs are `match-analysis-output-v1-4/match-analysis-summary.json` and `.md`.
- The immediate questions are opening resolution, context/strategy composition, high-confidence raid survival, FFA diplomacy mode mapping, and plausibility of raid pairs.

Important status mismatch:

- The root `README.md` still labels the project as Phase 2 backend foundation even though the repository now contains substantially more backend and replay-analysis work. It should be refreshed, but the code and specialist status files outrank that stale phase label.

## 9. Authoritative artifacts and integrity record

### GitHub

- Repository `Mathias-ao/League-of-Friends` is the source of truth for implementation.
- `branding/site.json` is the source of truth for brand identity.
- `seasons/S001-fiefdom-of-bad-neighbors.json` and `events/E001-lombardia.json` hold the current persisted season and first-event identity.
- `README-MATCH-ANALYSIS-V1_4.md` is the active parser-analysis resume note at the inspected baseline.

### Replay foundation files

| Artifact | Role | SHA-256 of preserved file |
|---|---|---|
| `Age-of-Friends-Replay-Analysis-Foundation.md` | Research, evidence boundaries, architecture, backlog, and test plan | `83df810d644e950155145049455ea52e8666d7b241c8da4bab20e4f71876c6e5` |
| `canonical-replay-v1.schema.json` | CanonicalReplay 1.0 JSON Schema | `a20de391236d8e81219fc2edac3e2407e391cbebd9c49b63a9d5e2822fa22f72` |
| `townbell-capability-matrix.csv` | 320-row capability mapping plus header | `2506011e77cf17a5f4c6bd2d36aae6bcf1b6f85fde62462c44fe5982e4d1d4ce` |

Integrity checks performed during recovery:

- The CanonicalReplay schema parses as valid JSON.
- The capability matrix contains 321 CSV lines: one header plus 320 capabilities.
- The three preserved files total 344,290 bytes.

Do not edit these three files casually. Make a new version when their contract or research conclusions change, and record why.

## 10. Active priorities

1. Complete the V1.4 semantic review using the existing canonical replay corpus.
2. Explicitly map FFA diplomacy mode values and transitions before allowing high-confidence FFA raid claims.
3. Validate opening classifications and high-confidence raid pairs against the corpus outputs.
4. Make derived analysis consume retained canonical facts; reparse only for missing or incorrectly decoded source facts.
5. Align the repository README and project status with the actual implementation state.
6. Persist remaining chat-only product decisions in repository configuration or decision records.
7. Migrate the relationship system from the old single-score implementation to the three-track model after thresholds and Friend behavior are frozen.

## 11. Fresh-chat operating procedure

Long chats are archives, not working databases. Do not delete them until this recovery file and the repository have been checked, but stop extending slow or error-prone threads.

Use one fresh chat per bounded workstream:

- Replay parser and match analysis.
- Firebase/backend and data model.
- Product rules, events, and relationship systems.
- Web UI, brand, and narrative content.

At the start of a fresh chat:

1. Attach or reference this continuity file.
2. Attach only the specialist artifacts needed for that task.
3. Tell the chat to inspect the latest `main` branch before proposing or editing implementation.
4. State the one concrete outcome for the session.
5. For parser work, explicitly say whether reparsing is permitted. The current V1.4 task says it is not.

At the end of meaningful work:

1. Put code and implementation docs in GitHub.
2. Put large research or reusable artifacts in persistent file storage.
3. Record the exact commit, tests, generated outputs, decisions changed, and next action.
4. Update this file only when project-wide identity, authority, architecture, locked scope, or active priority changes.
5. Start a new chat when the workstream changes or the current thread becomes long and unreliable.

## 12. Copyable bootstrap prompt

> Continue Age of Friends using the attached Project Continuity and Recovery File. Treat `Mathias-ao/League-of-Friends` on GitHub as implementation truth and inspect the latest `main` state before acting. Preserve the Age of Friends brand, data-truth doctrine, immutable replay evidence, CanonicalReplay layering, and all authority rules in the continuity file. Use old chats only as secondary historical evidence. The concrete task for this session is: [ONE TASK]. Before changing anything, report the current relevant implementation state, the files you will touch, and any conflict with the continuity file. When finished, give the exact commit/tests/artifacts and a compact handoff for the next chat.

## 13. What this recovery does and does not do

This file preserves the project's center of gravity and gives fresh chats a reliable restart path. It does not claim every brainstorm is locked, replace detailed schemas, or certify uninspected local-only work. Anything absent from GitHub or the named persistent artifacts remains at risk until deliberately promoted into one of those sources.

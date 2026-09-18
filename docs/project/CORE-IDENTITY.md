# Age of Friends — Core Identity & Philosophy

Status date: 18 September 2026  
Purpose: Define the foundational soul, unshakeable design principles, and absolute source of truth for the Age of Friends ecosystem, ensuring product alignment across all stages of development

## 1. How to use this file

This is the first file to read for any fresh Age of Friends task. It is a continuity map, not a replacement for current code or specialist documents. Read [`CURRENT-STATE.md`](CURRENT-STATE.md) next for the implemented state, known gaps and task routing.

Authority order when sources disagree:

Authority depends on the question:

1. The latest explicit decision by Mathias governs product direction until formally documented.
2. CORE-IDENTITY.md governs lasting product identity and principles.
3. The latest code on main governs current implemented behaviour.
4. Domain-specific documents govern technical details within their scope, without overriding the core identity.
5. CURRENT-STATE.md governs implementation status, known gaps and active priorities.
6. Old conversations are historical evidence only.

Do not infer that an idea is implemented merely because it is described here. Check the repository before changing code. Do not overwrite newer repository behavior with an older chat summary.

## 2. Project identity

- Product name: **Age of Friends**.
- Short name: **AoF**.
- Technical repository/project name: **League of Friends**.
- Repository: `Mathias-ao/League-of-Friends`.
- Product: a private, persistent Age of Empires II: Definitive Edition league for friends.
- Core loop: real matches become lasting standings, statistics, achievements, player identity, rivalries, War Room activity, and shared league history.
- Tone: serious, hardcore, historical, martial, and understated humour.
- Avoid: generic fantasy, constant jokes, overt history-class parody, and esports clichés.
- Humor rule: humor is sparse and underplayed so it lands against an otherwise serious historical-war presentation.
- Design doctrine: competition and data truth come first; drama must be earned from real match events.

## 3. Product doctrine and invariants

- Admins steer exceptions; automation runs the normal machinery.
- Prefer configurable rules and versioned models over hard-coded special cases.
- League Points, War Room Points, relationship scores, and Gold are separate accounting systems.
- A Match is one competitive encounter and may contain one or more Games.
- One `.aoe2record` represents one Game.
- The original replay file is a temporary upload, not a permanent system artifact.
- Canonical evidence is retained permanently. Derived results and interpretations must be reproducible from that evidence.
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

### Player relationships

Relationships are persistent histories between two players. They develop through three separate, non-exclusive pair tracks rather than one blended relationship score:

- **Rivalry**
- **Hostility**
- **Bond**

The exact stages, thresholds and visibility rules for these tracks remain under design. A future War Room experience may reveal escalated relationship state and relationship progression.

Separate from those pair tracks, **Gallantry, Treachery and Chivalry are player-level point currencies** earned from tracked actions under a future explicit rule set. They do not belong to a player pair and they are not aliases for Rivalry, Hostility or Bond. For example, raids are intended candidates for Gallantry and Treachery rewards, while meaningful defensive/ally-support actions are intended candidates for Chivalry; exact actions and values are not yet approved.

Relationship progression and player point awards must remain traceable to evidence and recalculable as their versioned rules improve. The current relationship engine still reflects the older Rivalry / Enemy / Friend model and must be migrated/versioned before it becomes the final player-facing relationship system.

### Player portraits

A player portrait represents a persistent league identity. It develops gradually from sustained evidence, does not react to one unusual Game, and does not reset between seasons.

New players begin in a peasant or newcomer state and graduate after sufficient participation.
Later identity reflects the player’s dominant military family.
Recent Games establish current preference, while lifetime evidence provides stability.
Minimum sample sizes, confidence requirements and resistance to frequent changes prevent one unusual Game from rewriting the portrait.
Military identity is based only on production or unit evidence the replay extraction system can support reliably.
Clothing, weapons, headgear and titles are earned separately through league achievements and notable accomplishments.

## 6. Technical architecture

Age of Friends is a replay-driven web application for permanent player identities, matchmaking, ladder standings, inter-player relationships, and statistics, organized through League → Season → Event → Match → Game.

Uploaded recordings are converted into trustworthy, versioned evidence and then deleted. Results, statistics, records, relationships, portraits and ladder ratings are derived from that evidence and support future matchmaking.

The system keeps observed facts separate from reconstructions and interpretations. All processing must be traceable, repeatable and resistant to duplicate or corrected data.


## 7. Replay-analysis truth model

`CanonicalReplay 1.1` is the current durable source of replay evidence; the original 1.0 contract is archived as an explicit predecessor. TownBell’s 320-metric structure remains a useful capability benchmark and reporting layer, not the Age of Friends data model.

Replay information is kept in four distinct layers:

1. **Observed evidence:** information directly present in the recording.
2. **Reconstructed evidence:** results produced by declared, deterministic rules.
3. **Inferred analysis:** estimates based on documented models, thresholds and confidence.
4. **League interpretation:** statistics, ratings, Gallantry, Treachery, Chivalry and other versioned Age of Friends rules.

A recording contains an initial state followed by player commands; it is not a complete record of game state at every moment. The system must therefore describe evidence honestly. A queued unit is not necessarily trained, a placement command is not a completed building, and inferred combat does not prove kills or damage.

Observed and estimated age timings remain separate. Exact creation, survival, resources, kills, damage, visibility and positions are not claimed unless the evidence genuinely supports them.

Diplomacy and player interaction are time-sensitive and directional. Evidence is recorded from each player toward every other player so team games, changing alliances and FFA relationships are represented correctly. Camera analysis applies only to the player whose viewpoint produced the recording.

Every statistic and interpretation must remain traceable to its evidence and model version. AI may explain or narrate established findings, but it must never invent match facts.


## 8. Document authority

GitHub is the source of truth for Age of Friends implementation and maintained project documentation.

CORE-IDENTITY.md defines the lasting product vision and locked principles. CURRENT-STATE.md records implementation status and active priorities. Specialist architecture, replay, brand, season and event documents govern their respective areas without overriding the core identity.

The detailed artifact list belongs in docs/replay-foundation/README.md.

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

### Player Personality
Player Personality describes a player's recurring strategic and behavioural tendencies across battles. It describes how they tend to play, not their character, ability, intentions, or value.

Personality is expressed through six evidence-based sliders:
- Boomer ↔ Aggressor
- Cautious ↔ Bold
- Guerrilla ↔ Frontline Fighter
- Specialist ↔ Improviser
- Compact ↔ Expansive

Neither end of a slider is inherently better. Sliders are descriptive tendencies, not performance scores.

Personality is longitudinal and context-sensitive. It requires sufficient eligible battles and should account for format, map, civilization constraints, team role, and other material context. Insufficient evidence produces Developing, not a neutral midpoint.

Recent evidence may show current tendencies while longer-term evidence provides stability. Individual battles should not materially redefine an established profile.

Slider definitions, evidence requirements, normalization, weighting, and update rules must remain explicit, versioned, and reproducible.

### Player Reputation
three independent, persistent tracks earned from tracked player actions under an explicit, versioned rule set. They represent how a player conducts themselves in battle, not their skill, results, or relationships with specific players.

- **Gallantry** — bold, aggressive, or daring conduct against opponents.
- **Cruelty** (formerly Treachery) — bRuthless, destructive, or deliberately punishing conduct against opponents.
- **Chivalry** — meaningful protection, assistance, or sacrifice in support of allies.

The tracks are non-exclusive: the same player may develop strongly in more than one. Exact qualifying actions, point values, thresholds, decay and presentation remain to be defined.

### Player relationships
Player Relationships are persistent evidence-based paired relationsships between all the players in the league. evidence-based histories between two players. They describe competitive history, not real-world feelings, motives, or character.

- **Rivalry** — sustained competitive significance between players whose encounters repeatedly create meaningful stakes.
- **Hostility** — sustained adversarial history shaped by consequential opposition, pressure, reversals, or unresolved conflict.
- **Bond** — sustained cooperative history built through meaningful shared battles, support, and success as allies.

Tracks are independent and may coexist.

Progression requires meaningful evidence across encounters, not participation alone. Mutual states should require reciprocal contribution; one-sided history may be recorded without declaring a mutual relationship.

Relationships may emerge, escalate, cool, resolve, or begin a new chapter. Turning points such as rematches, reversals, alliances, or decisive outcomes may change the active state without erasing prior history.

Exact evidence, stages, thresholds, cooling rules, and visibility remain defined by future explicit, versioned rules.

Relationship effects must remain competitively neutral. They may influence presentation, matchmaking preference, War Room activity, challenges, and historical recognition, but never competitive advantage.

Player Relationships are separate from Player Reputation: Reputation belongs to one player; Rivalry, Hostility and Bond belong to a player pair.

### Player portraits

Player Portraits represent a player's persistent league identity, derived from sustained evidence across battles and seasons.

Portrait progression should reflect stable tendencies, not isolated games, event formats, civilization restrictions, or temporary roles.
- New players begin in a neutral newcomer state.
- Portrait identities unlock only after sufficient evidence and minimum sample requirements.
- Recent evidence may influence current expression; long-term evidence provides stability.
- Identity may reflect dominant military or strategic tendencies only where replay evidence supports them reliably.
- Context should be considered where event format, civilization restrictions, team role, or map meaningfully affect observed behaviour.

Portrait changes should be gradual and resistant to short-term variance.

Players may choose among identities they have legitimately unlocked; evidence determines eligibility, while the player determines which earned identity they present.

Cosmetic elements, titles, equipment, and other distinctions are earned separately through achievements and notable accomplishments.

Exact identity definitions, eligibility thresholds, confidence rules, weighting, and update behavior remain governed by future explicit, versioned rules.

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

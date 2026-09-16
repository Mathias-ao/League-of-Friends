# Age of Friends — Core Identity & Philosophy

Status date: 16 September 2026  
Purpose: Define the foundational soul, unshakeable design principles, and absolute source of truth for the Age of Friends ecosystem, ensuring product alignment across all stages of development

## 1. How to use this file

This is the first file to read for any fresh Age of Friends task. It is a continuity map, not a replacement for current code or specialist documents. Read [`CURRENT-STATE.md`](CURRENT-STATE.md) next for the implemented state, known gaps and task routing.

Authority order when sources disagree:

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
- Event configuration must be snapshotted so historical results remain reproducible.
- Raw source reports, Age of Friends interpretation, additional inferred statistics and league consequences must remain separate.
- The client may read Firestore directly but must not directly mutate authoritative competition state.
- Privileged changes run through authenticated Cloud Functions.
- Processing must be idempotent; corrections and disputes must be auditable.
- Do not ask players to manually enter post-match statistics.
- A result normally becomes final directly, with a small dispute option. A resolved correction invalidates the prior canonical result so only one result contributes.
- For launch, TownBell-produced JSON is the authoritative statistics source report. The in-house replay/statistics system is a parallel R&D track until deliberately promoted.
- The V1 statistics path is **Match → TownBell JSON report → Age of Friends interpretation → additional inferred statistics → points / relationship systems**.
- Only the TownBell report ingestion contract is currently settled. Interpretation and every later statistics-dependent layer must be settled explicitly before becoming authoritative.
- Points and relationship rules must never consume raw TownBell fields directly.

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
- Civilization selection belongs in the web app so picks map cleanly to player and match statistics.
- Civilization choices are unique within the match.
- Match captain is selected randomly per match when a captain is needed.
- Attendance contingencies may change match topology. Drafting must adapt to the actual approved match plan rather than assume the advertised player count.

### Later event direction already chosen

- Event II: multiple 2v2 matches with a Mediterranean theme, some naval play, players on the same landmass, and a geographically appropriate civilization pool.
- Later seasonal events include a Halloween FFA, Christmas FFA Capture the Relic, and New Year King of the Hill.
- Treat later-event details not yet represented in repository configuration as design decisions awaiting formal persistence, not implemented state.

## 5. Social and identity systems

### Player relationships

Relationships are persistent histories between players. They develop through three separate, non-exclusive tracks rather than one blended relationship score. Two players may therefore become both close friends and fierce rivals.

Rivalry: Friction → Competing → Rivalry → Nemesis.
Enemy: Grudge → Bad Blood → Enemy → Vendetta → Blood Feud → Internecine Strife.
Friend: Friendly → Respect → Honored → Trusted Friend → Blood Brothers.

Enemy and Friend labels, progression thresholds and the Friend-track reward remain under exploration.

Match outcomes and approved downstream statistical evidence may eventually contribute through three behavioural axes:

Gallantry → Rivalry: recurring, reciprocal competition, including balanced results, mutual aggression, rematches and contested battles.
Treachery → Enemy: concentrated or asymmetric hostility, including focused attacks, diplomacy reversals and repeatedly targeting the same player.
Chivalry → Friend: demonstrated cooperation, including tribute, reinforcements, defensive assistance and sustained mutual support.

The formulas and eligible inputs for these axes are not yet settled under the TownBell V1 strategy.

Reaching the third stage of Rivalry or Enemy unlocks the War Room for that relationship. Progression must remain traceable to versioned source/interpretation evidence and recalculable as rules improve.

### Player portraits

A player portrait represents a persistent league identity. It develops gradually from sustained evidence, does not react to one unusual Game, and does not reset between seasons.

New players begin in a peasant or newcomer state and graduate after sufficient participation.
Later identity reflects the player’s dominant military family.
Recent Games establish current preference, while lifetime evidence provides stability.
Minimum sample sizes, confidence requirements and resistance to frequent changes prevent one unusual Game from rewriting the portrait.
Military identity is based only on downstream evidence the active statistics system can support reliably.
Clothing, weapons, headgear and titles are earned separately through league achievements and notable accomplishments.

## 6. Technical architecture

Age of Friends is a match-driven web application for permanent player identities, matchmaking, standings, inter-player relationships, and statistics, organized through League → Season → Event → Match → Game.

For V1 launch statistics, a TownBell JSON report is attached as an immutable revision to a specific Game. That report is a source artifact only. A later Age of Friends interpretation layer will normalize selected facts; a later inferred-statistics layer may derive additional measures; and points/relationship systems may then consume only approved downstream outputs according to separately versioned rules.

The in-house replay extraction, CanonicalReplay and Match Analysis stack remains in the repository as a long-term replacement path. It must not block launch and is promoted only after an explicit decision.

All processing must be traceable, repeatable and resistant to duplicate or corrected data.

## 7. Statistics truth model

TownBell-produced JSON is the launch source report. It is not itself the Age of Friends domain statistics model.

The V1 layers are:

1. **Match and source report:** the League Match/Game context plus one active immutable `TOWNBELL_REPORT_V1` revision.
2. **Age of Friends interpretation:** future approved identity mapping, selected metrics, normalization, units, qualification and unavailable-state rules with an explicit model version.
3. **Additional inferred statistics:** future estimates or compound measures derived only after interpretation, each traceable to its interpretation input and inference model version.
4. **Points / relationship consequences:** future versioned formulas that consume approved result, interpreted and/or inferred inputs. Raw TownBell fields are not valid direct inputs.

Only layer 1 report ingestion is currently settled.

The in-house replay/statistics system keeps its own observed/reconstructed/inferred evidence taxonomy while under development. It does not become the launch source merely because a metric exists there.

Every downstream statistic and consequence must remain traceable to its source report revision and relevant model versions. AI may explain or narrate established findings, but it must never invent match facts.

The V1 ingestion architecture and migration boundary are specified in [`../architecture/townbell-launch-statistics.md`](../architecture/townbell-launch-statistics.md).

## 8. Document authority

GitHub is the source of truth for Age of Friends implementation and maintained project documentation.

CORE-IDENTITY.md defines the lasting product vision and locked principles. CURRENT-STATE.md records implementation status and active priorities. Specialist architecture, statistics, brand, season and event documents govern their respective areas without overriding the core identity.

# Statistics Experience

Status: product direction anchored 18 September 2026.
Purpose: Define the player-facing statistics hierarchy, shared vocabulary and presentation commitments without inventing formulas that have not yet been approved.

## 1. Scope and terminology

Age of Friends uses several statistical scopes. They answer different player questions and should not collapse into one generic statistics screen.

| Player-facing scope | Question | Primary destination |
|---|---|---|
| **Battle Statistics** | What happened in this Battle? | Battle detail / Battle Statistics record |
| **Event Statistics** | Who and what shaped this Event across its Battles? | Completed Event detail / Event Statistics |
| **Player Statistics** | Who is this player and how do they tend to play? | Player profile |
| **Season Statistics** | How does the league play this Season? | Main **Statistics** navigation tab |
| **Lifetime Statistics** | What has this player done across Seasons? | Data layer only for Season I; player-facing UI activates when Season II makes it meaningfully distinct |
| **Relationship systems** | What has this player earned socially, and what has developed between two players? | Player-facing point currencies plus partly hidden pair-relationship progression |

The technical competition hierarchy remains:

**League → Season → Event → Match → Game**

In player-facing language, the site may call a technical **Match** a **Battle**. A Battle can contain one or more technical Games; one `.aoe2record` describes one Game. Battle Statistics therefore sit above Game-level replay outputs and must preserve Game provenance when a Battle contains more than one Game. Event Statistics aggregate all Battles belonging to the Event.

The product should not use “Match Statistics” as the main player-facing scope name. Technical/statistical code may continue to use match/game terminology where needed.

## 2. Shared statistical language

The same five categories should recur across Battle, Event, Player and Season scopes:

1. **Opening**
2. **Economy**
3. **Military**
4. **Map Presence**
5. **Execution**

The scope changes the question, not the vocabulary.

Examples:

- Battle: one player’s Build Order, Castle timing or map coverage in that Battle.
- Event: averages, totals, consistency and distinctions across the Event’s Battles.
- Player: Season-level tendencies and evidence supporting playstyle identity.
- Season: league distributions, averages, extremes and complete records.

Not every underlying metric needs to appear at every scope. A small set of continuity statistics should recur so players learn what the numbers mean and can move naturally from Battle → Event → Player → Season.

## 3. Battle Statistics

Battle Statistics are the detailed source record for a Battle.

### Access

Battle Statistics must be convenient to reach from every context where a Battle is presented:

- directly from the **Battles** tab;
- from an Event’s Battle list;
- from **Recent Battles** below the Season leaderboard if that section is added;
- from any record/distinction link whose source is that Battle.

All entry points should open the same Battle Statistics destination rather than duplicate statistics implementations.

### Content

Battle Statistics should use the five shared categories and may provide an overview before the detailed categories.

The overview should remain selective. A Battle should highlight **up to three** notable feats or records that are genuinely relevant to what happened. Do not fill empty slots with weak or zero-value distinctions.

Examples of eligible Battle distinctions include, subject to the metric being supported and the comparison being meaningful:

- fastest Feudal, Castle or Imperial timing;
- most or earliest raid pressure;
- greatest map coverage;
- most forward buildings or Forward Eco;
- most expansions;
- highest observed command activity;
- largest Food, Wood, Gold or Stone commitment.

These are factual extremes, not an overall player ranking or “MVP” judgment.

## 4. Event Statistics

An Event may contain one Battle or several Battles. Event Statistics aggregate the Event rather than merely repeating each Battle table.

The Event scope should answer:

**Who and what shaped this Event?**

Useful Event views include:

- player results across the Event;
- category aggregates across all Event Battles;
- repeated approaches or consistency where the sample supports it;
- Event-wide records with provenance back to the source Battle.

A completed Event should highlight **4–6** strong Event distinctions. These distinctions are intentionally more editorial than the complete Season record book, but every highlighted claim must remain traceable to source Battles and the metric/model that produced it.

Event distinctions should also feed the **post-Event conclusion news** used in the hero. The hero conclusion is temporary news; the completed Event and its Event Statistics remain the permanent archive.

Do not introduce a single Event MVP unless a separate, explicit scoring model is later approved.

## 5. Events tab presentation

The Events tab is intended to become a vertical Season history.

Each Event should occupy a wide horizontal presentation using its **Event-specific artwork**, with its status and the actions relevant to that state.

Typical state behavior:

- **Upcoming:** Event details and signup.
- **Active:** Event details and Battles.
- **Completed:** Event record, constituent Battles and Event Statistics / conclusion.

The completed Event remains the durable place to revisit Event distinctions after the hero has moved on to newer news.

## 6. Season Statistics

The main navigation label remains the brief **Statistics**, but the page is conceptually **Season Statistics**.

It should describe the current Season as a whole using the five shared categories.

Season Statistics should include the **complete Season record book**, not only a curated subset. Records should retain source provenance and link back to the Battle or Event that established them.

Examples include:

- fastest age timings;
- raid count/rate extremes where meaningful;
- earliest raid;
- map coverage records;
- forward-building / Forward-Eco records;
- expansion records;
- command-activity records;
- resource-commitment records.

Battle and Event surfaces curate the strongest highlights. Season Statistics is where all approved record types remain visible.

## 7. Player Statistics and playstyle sliders

Player Statistics answer:

**Who is this player?**

The Player profile should combine:

- Season-level descriptive statistics using the same five categories;
- comparisons/context where useful;
- playstyle sliders derived from multiple evidence metrics.

Playstyle sliders must answer genuine **style questions**, not assign quality or skill labels.

A valid slider should:

- make both endpoints legitimate ways of playing;
- be supported by multiple relevant evidence metrics where possible;
- use minimum sample requirements;
- resist one unusual Battle changing the player identity dramatically;
- preserve the versioned rule set and normalized evidence that produced it.

No slider catalogue, endpoint wording, metric weights, normalization population or thresholds are currently approved. The existing engine remains deliberately unconfigured until these decisions are made.

Player portraits/military identity remain a distinct identity system from playstyle sliders.

## 8. Economy: launch direction

Economy needs to feel familiar and readable at launch.

The current **Resource Commitment** model is the launch foundation. It is a deterministic estimate over priced replay commands, not exact resources collected or spent.

### Primary Battle presentation

Start with a conventional numerical table rather than requiring charts:

| Player | Food | Wood | Gold | Stone | Total |
|---|---:|---:|---:|---:|---:|
| Player A | value | value | value | value | value |
| Player B | value | value | value | value | value |

A restrained marker such as **★** may identify the largest value in that comparison. The marker means **largest recorded commitment**, not “best”.

### Commitment by age

Resource Commitment should also expose Food, Wood, Gold and Stone within:

- Dark Age;
- Feudal Age;
- Castle Age;
- Imperial Age;
- Unknown where the model cannot establish the required age boundary.

This can initially be a numerical table. Charts may be added later if they improve comprehension, but they are not required for launch.

The player-facing label must remain **Resources Committed** (or equivalent wording that preserves “commitment”), not “resources collected” or exact “resources spent”.

Possible future Economy derivations such as military/economic/technology commitment splits require their own explicit classification rules and should not be inferred into the launch UI without a documented model.

## 9. Feats, distinctions and records

Use one underlying record/distinction catalogue with scope-specific presentation.

### Battle

- Up to **3** highlighted feats.
- Only relevant feats from the actual Battle.
- Curated, not exhaustive.

### Event

- **4–6** highlighted distinctions across all Event Battles.
- Suitable for the Event conclusion and hero news.
- Curated, not exhaustive.

### Season

- Show the **complete approved record catalogue**.
- Preserve the source Battle/Event for every record.
- A record value should be navigable back to the evidence that established it.

A factual extreme is not automatically a quality judgment. For example, the largest Stone commitment is simply the largest recorded Stone commitment unless a separate interpretation model says otherwise.

## 10. Player point currencies versus pair relationships

These are two different systems and must not be conflated.

### Player point currencies

**Gallantry, Treachery and Chivalry belong to the player.**

They are player-level point currencies awarded from tracked actions or behaviors under a future explicit rule set.

Examples of intended inputs, not yet formulas:

- raids may contribute Gallantry and Treachery;
- defending or otherwise meaningfully helping an ally may contribute Chivalry;
- other tracked actions may contribute once the rule system is mapped.

The exact eligible actions, point values, caps, scope and balancing rules are **not yet specified**.

### Pair relationship tracks

**Rivalry, Hostility and Bond belong to the relationship between two players.**

These are separate, potentially non-exclusive pair tracks derived from shared history under a future explicit relationship model.

They are not simply renamed Gallantry/Treachery/Chivalry balances.

The relationship model should remain partly hidden. A future War Room experience may reveal escalated relationship states and some form of relationship progression once appropriate thresholds are reached, but the exact visibility and progression presentation are still to be designed.

### Current implementation mismatch

The existing `AOF_RELATIONSHIP_ENGINE_V1` implementation still uses the older `RIVALRY / ENEMY / FRIEND` identifiers and models points directly on those tracks. That implementation predates this product decision.

Future relationship work must migrate or version the engine so that:

1. player currencies (Gallantry / Treachery / Chivalry) are modeled separately from
2. pair relationship tracks (Rivalry / Hostility / Bond).

Do not expose the old engine semantics as the final player-facing model.

## 11. Lifetime Statistics

Lifetime aggregation remains valuable in the data architecture during Season I, but it should stay out of the player-facing UI because Season I and lifetime would currently communicate nearly the same thing.

When Season II begins, lifetime/all-time presentation can be activated without reconstructing Season I history.

Shelf the **UI**, not the underlying historical aggregation.

## 12. Open design work

The following remain intentionally open:

- exact continuity statistics chosen for prominent display at every scope;
- fuller Economy statistics beyond Resource Commitment;
- broader Military/pressure statistics beyond the current raid evidence;
- playstyle slider questions, endpoint labels, inputs, weights, normalization and sample thresholds;
- Gallantry/Treachery/Chivalry earning rules;
- Rivalry/Hostility/Bond derivation rules, stages and thresholds;
- what relationship progression becomes visible before and after War Room access;
- complete record/distinction catalogue and eligibility/tie rules;
- exact Battle/Event Statistics layout and stone-slab interaction.

Do not invent these rules merely to complete implementation. They require explicit product decisions.

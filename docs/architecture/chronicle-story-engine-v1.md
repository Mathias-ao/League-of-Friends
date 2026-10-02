# Age of Friends — Chronicle Story Engine V1

Status: implementation branch `feat/chronicle-story-engine-v1`; draft architecture under corpus qualification.

Versions introduced by this work:

- `AOF_DIPLOMACY_TIMELINE_V1`
- `AOF_DIPLOMACY_ACTION_MODE_MAP_V1`
- `AOF_INITIAL_DIPLOMACY_HEADER_MAP_V1`
- `AOF_DIPLOMACY_EVIDENCE_ADAPTER_V1`
- `AOF_PAIR_SOCIAL_EVIDENCE_V1`
- `AOF_CHRONICLE_EVENT_V1`
- `AOF_CHRONICLE_PHRASES_V1`
- `AOF_CHRONICLE_WRITER_V1`

## 1. Product purpose

The Relationship Chronicle is not a decorated match log. It is Age of Friends' durable memory of what two league players have actually done in shared Battles.

The desired player experience is that a pair history gradually acquires recognizable chapters: first meetings, recurring opposition, temporary alliances, genuine cooperation, pressure, quiet periods, relationship establishment, Dormancy, reactivation and diplomatic reversals. The drama must come from the recorded history rather than invented motive.

The runtime writer is deterministic and does **not** call an LLM, paid API or external prose service. LLMs may be used offline during development as a writing-room aid for candidate phrases, but phrases enter production only after human review and source control.

The runtime chain is:

```text
CanonicalReplay
  -> Battle Statistics / qualified reconstruction
  -> AOF_DIPLOMACY_TIMELINE_V1
  -> AOF_PAIR_SOCIAL_EVIDENCE_V1
       -> Relationship interpretation
       -> AOF_CHRONICLE_EVENT_V1
            -> historical story context
            -> AOF_CHRONICLE_WRITER_V1
                 -> published Chronicle entry
```

Each layer has a different authority:

1. CanonicalReplay retains observations and provenance.
2. Battle Statistics reconstruct measurable facts and qualified episodes.
3. Pair Social Evidence creates neutral, chronological interpersonal evidence.
4. Relationship rules interpret that evidence into Rivalry / Hostility / Bond.
5. Chronicle Event decides what is historically meaningful and safe to narrate.
6. Chronicle Writer decides how to phrase the already-qualified meaning.

Changing prose must never change replay truth or Relationship scoring.

## 2. Why Battle-wide ally/opponent is insufficient

Fixed-team games can often treat a pair as allied or opposed for the whole Battle. FFA and unlocked-diplomacy Battles cannot.

Diplomacy in AoE2 is directed. At a given moment A may mark B as ally while B remains neutral or enemy toward A. Later both may become allies, and later still one side may change stance first.

A mature AoF social model therefore reconstructs directed diplomacy over time rather than assigning one relation to the Battle.

Example:

```text
00:00  A -> B ENEMY     B -> A ENEMY
27:14  A -> B ALLY      B -> A ENEMY
28:02  A -> B ALLY      B -> A ALLY
51:41  A -> B ENEMY     B -> A ALLY
52:19  A -> B ENEMY     B -> A ENEMY
```

The meaningful pair states are then chronological segments:

```text
MUTUAL_HOSTILITY
CONFLICTED
MUTUAL_ALLIANCE
CONFLICTED
MUTUAL_HOSTILITY
```

AoF may narrate those state changes. It may not claim why a player changed diplomacy.

## 3. Diplomacy evidence domains

Initial header diplomacy and runtime diplomacy actions use different numeric domains. They are intentionally normalized by different versioned maps.

### Runtime `GAME` diplomacy action

Qualified against the upstream `aoc-mgz` `DiplomacyStanceEnum` used by the decoded GAME action:

- `0` -> ALLY
- `1` -> NEUTRAL
- `3` -> ENEMY
- anything else -> UNKNOWN

An unsupported value destroys certainty from that change forward. It is never guessed.

### Initial header diplomacy fallback

The current fast header parser exposes the player's `my_diplomacy` Int32 array. It is indexed by replay player number, including Gaia at index zero. The qualified participant values are:

- `2` -> ALLY
- `3` -> NEUTRAL
- `4` -> ENEMY
- self, Gaia, invalid or unknown values -> UNKNOWN

CanonicalReplay already defines `initialDiplomacy` as directed normalized edges, but the current extractor still writes that collection empty while retaining the raw matrix in match settings. `AOF_DIPLOMACY_EVIDENCE_ADAPTER_V1` therefore uses this order of authority:

1. native canonical `initialDiplomacy` when present;
2. retained raw header matrix as an explicitly-labelled compatibility fallback;
3. missing -> UNKNOWN.

The fallback must be removed from the critical path once canonical extraction publishes qualified initial edges.

## 4. `AOF_DIPLOMACY_TIMELINE_V1`

The timeline takes a Battle roster, duration, directed initial edges and timestamped directed changes.

It emits:

- normalized changes in deterministic replay order;
- directed stance segments;
- unordered pair segments containing both directed stances;
- pair-state classification;
- coverage on every segment;
- diagnostics for missing initial edges, unknown runtime modes and no-op commands.

Pair states are:

- `MUTUAL_ALLIANCE`
- `MUTUAL_HOSTILITY`
- `MUTUAL_NEUTRALITY`
- `ONE_SIDED_ALLIANCE`
- `ONE_SIDED_HOSTILITY`
- `CONFLICTED` — one direction ALLY and the other ENEMY
- `UNKNOWN`

Missing initial diplomacy never defaults to enemy. Unsupported runtime changes become UNKNOWN at their timestamp.

Commands sharing a timestamp are ordered by canonical operation ordinal and deterministic event id. Zero-duration intermediate states are not presented as durable segments, while the ordered change records remain auditable.

## 5. Chronicle-grade statistics

A player-facing statistic may aggregate. Chronicle evidence must not lose the direction, time, target or evidence references needed to reconstruct history.

For example:

```text
Player profile statistic:
  Tribute commands sent = 6

Chronicle-grade evidence:
  [time, sender, recipient, resource vector, source event id] x 6
```

This principle applies to all social evidence families.

### Required evidence families

| Family | Chronicle-grade minimum | Important boundary |
| --- | --- | --- |
| Diplomacy | directed initial stance; every directed change; timestamp; ordinal; raw value | never infer reciprocity from one direction |
| Direct contest | episode window; involved players; evidence ids; confidence | commands are interaction evidence, not damage or kills |
| Raid pressure | attacker; target; episode start/end; confidence; evidence ids; target-focus context | FFA classification must use diplomacy at event time |
| Forward encroachment | actor; target; placement time; position; structure identity where qualified; evidence id | placement is not completion or survival |
| Enemy-base contact | actor; target; first/episode time; spatial evidence | command proximity is not visibility or successful arrival |
| Material support | sender; recipient; time; resource vector/amount where qualified | command is not automatically settled transfer |
| Reinforcement | helper; supported player; interval; evidence ids; confidence | selected-command footprint is not unit survival |
| Defensive Assistance | helper; defended player; attacker; timing; source engagement | do not say the helper "saved" the ally |
| Cooperative Attack | pair; third player; qualifying engagement window | cooperation is evidence-backed participation, not proof of planning |
| Flares | actor; decoded recipients/targets; time; position | a flare is communication evidence; meaning requires separate qualification |
| Third-party pressure | both pressure sources; third target; overlap window | overlap alone is coincidence, not coordination or conspiracy |
| Resignation/result | player; time; canonical result context | never state who "caused" a resignation without independent evidence |
| Relics | target/interaction evidence actually available | first relic touch is not successful taking; do not narrate theft from touch |
| Chat | raw canonical evidence with privacy/provenance | Chronicle V1 does not interpret free text |

If the ordinary statistics read model does not need these details, they may live in a social-evidence projection. They must remain reconstructible from retained canonical evidence.

## 6. Coverage is per evidence family

One global `AVAILABLE` bit is too coarse for social history.

`AOF_PAIR_SOCIAL_EVIDENCE_V1` uses:

- `diplomacy`
- `oppositionInteraction`
- `alliedCooperation`
- `economicTransfer`
- `spatialPressure`
- `communication`

Each is:

- `QUALIFIED`
- `NOT_APPLICABLE`
- `UNAVAILABLE`

`UNAVAILABLE` never means zero.

A later version may split families further if corpus evidence shows that one family still covers materially different capabilities.

## 7. Opportunity is required for narrating absence

AoF must not turn absence of evidence into social accusation.

Two players being assigned as allies does not prove that they had a meaningful opportunity to cooperate. Two players sharing an FFA does not prove that they had an opportunity for direct opposition.

Absence beats therefore require **both**:

1. qualified family coverage; and
2. a separately qualified `PairInteractionOpportunity` interval.

Only then may the neutral evidence layer state:

- `NO_QUALIFYING_ALLIED_COOPERATION`; or
- `NO_QUALIFYING_OPPOSITION_CONTACT`.

Even then the wording describes the record, not motive:

> A qualifying opportunity for cooperation existed, but no qualifying cooperative interaction was recorded in that window.

It must not say:

> They refused to help one another.

Relationship interpretation remains separate. In particular, the approved product direction is that qualified allied non-cooperation may worsen **existing** Hostility but must not create Hostility from zero.

## 8. Social beats

One Battle can contain several ordered interpersonal facts. FFA especially must not be collapsed into one final state such as `ALLIED_MIXED`.

Current neutral beat vocabulary includes:

- directed diplomacy changes;
- mutual alliance formation / ending;
- one-sided alliance state;
- conflicted ally/enemy state;
- direct contest;
- raid pressure;
- forward encroachment;
- enemy-base contact;
- material support;
- ally reinforcement;
- defensive assistance;
- cooperative attack;
- flare signal;
- coincident third-party pressure;
- qualified opposition silence;
- qualified allied non-cooperation.

A Beat retains its source evidence, Battle time, direction, optional third player, evidence confidence and diplomacy snapshot at that time.

Relationship rules may consume these beats. Chronicle rules may consume the same beats. Neither is allowed to change the beat's factual meaning.

## 9. Third-party pressure and FFA intrigue

FFA produces important three-player episodes. Pair-only summaries must not erase them.

If A and B independently pressure C during the same qualified time window, the neutral event is:

`COINCIDENT_THIRD_PARTY_PRESSURE`

It is not automatically `COOPERATIVE_ATTACK`.

A cooperative attack requires the stronger Battle Statistics evidence contract for cooperative participation. The current Chronicle phrase library explicitly says that coincident pressure does not by itself prove coordination.

This distinction lets AoF surface political-looking Battle patterns without claiming a plot that the replay cannot prove.

## 10. `AOF_CHRONICLE_EVENT_V1`

Chronicle Event is the semantic history layer. It does **not** contain prose.

For each pair Battle it retains:

- Battle / Event / Season provenance;
- pair identity;
- encounter number;
- summarized alignment while retaining source beats;
- narrative concepts supported by evidence;
- selected primary beats;
- historical callbacks;
- source beat and canonical evidence ids;
- externally supplied Relationship transitions;
- internal narrative significance.

Significance is:

- `RECORD`
- `NOTABLE`
- `LANDMARK`
- `TURNING_POINT`

Significance changes how much space the writer gives an event. It never expands the set of factual claims the writer may make.

It is an editorial control, not a player-facing score.

Examples that can elevate significance include:

- first meeting;
- first mutual alliance;
- first qualifying cooperation or pressure;
- alliance formation and ending in the same Battle;
- alliance ending followed by qualifying direct contest;
- a Relationship becoming established;
- new historical Relationship peak;
- Dormancy or reactivation.

## 11. Historical context

Chronicle Events are built chronologically for one stable unordered pair. The fold retains contextual facts such as:

- encounter number;
- previous Battle alignment;
- prior allied/opposed meeting counts;
- whether a mutual alliance has ever occurred;
- whether qualifying cooperation has ever occurred;
- whether qualifying directed pressure has ever occurred.

Future extensions may add Event/Season chapter boundaries, longest alliance intervals, directional reciprocity milestones, time since last meaningful contact and other evidence-backed callbacks.

No context field may invent motive or emotion.

## 12. `AOF_CHRONICLE_WRITER_V1`

The runtime writer is a deterministic prose realizer.

It consumes:

- `AOF_CHRONICLE_EVENT_V1`;
- the underlying Pair Social Evidence for selected beats;
- stable player display names;
- the source-controlled phrase library.

It emits:

- title;
- body text;
- writer version;
- phrase-library version;
- story-pattern id;
- exact fragment ids used;
- source beat ids;
- source canonical evidence ids.

This permits the chain:

```text
published sentence
  -> phrase id
  -> Chronicle concept / Beat
  -> source evidence ids
```

A wording bug can therefore be distinguished from an evidence-classification bug.

### Determinism

Phrase selection uses a stable hash over writer version, Chronicle event identity, semantic group and sentence slot. It never calls `Math.random()`.

The writer also carries a small deterministic recent-fragment memory while rebuilding the pair history. Recently used phrases are avoided when alternatives exist. Rebuilding identical history under the same writer/phrase versions produces identical text.

### Phrase corpus

V1 begins with a large curated phrase corpus and enforces a minimum size in tests. The target is breadth through **semantic families**, not padding with superficially different adjectives.

The library covers:

- titles;
- first/repeat meetings;
- callbacks to allied/hostile/mixed previous Battles;
- alliance/hostility/neutrality/mixed/unknown alignment;
- alliance formation and ending;
- asymmetric/conflicted diplomacy;
- direct contest and pressure families;
- support/cooperation families;
- third-party overlap;
- qualified absence;
- Relationship establishment/advance/Dormancy/reactivation/weakening;
- historical codas.

The corpus should be expanded only when real replay histories demonstrate useful new semantic or syntactic variation. Raw fragment count is not a quality metric.

## 13. Claim firewall and prose linting

The writer may vary wording only within the meaning licensed by a semantic family.

The current phrase corpus is linted against unqualified words including:

- betrayed / betrayal
- saved
- rescued
- slaughtered
- humiliated
- refused
- abandoned
- avenged
- conspired

This list is not exhaustive. Review is still required for new phrase families.

Other prohibited implications include unsupported:

- intent;
- emotion;
- damage;
- kills;
- tactical success;
- causal responsibility for resignation;
- successful relic theft/pickup;
- communication or planning merely from overlapping actions.

Drama is produced by chronology and contrast rather than exaggeration.

## 14. Relationship boundary

Chronicle Event accepts Relationship transitions only when supplied by the Relationship interpretation layer. It does not derive stages from prose concepts.

Therefore:

- a raid-pressure Beat can be narrated factually even while Relationship rules are unconfigured;
- the writer may say "their Rivalry became established" only when the Relationship layer supplies an `ESTABLISHED` Rivalry transition;
- hidden points and next-stage thresholds remain hidden;
- Relationship balances never feed Player Reputation and Reputation never feeds Relationship balances.

The temporal social evidence migration must also preserve two approved rules before production activation:

1. allied non-cooperation cannot create Hostility from zero;
2. antagonism against an established Bond must use the Bond state that existed before the relevant Battle for the stronger-breach modifier.

## 15. Storage and cost

The runtime system requires no LLM/API call.

Most work is deterministic processing already adjacent to replay/statistics processing. Stored Chronicle entries are small text/read-model objects with provenance ids. Phrase data ships with application code rather than Firestore documents.

This preserves the project goal of no recurring AI/service bill in normal league operation.

## 16. Testing requirements

The Story Engine is tested as code, not judged only by screenshots.

Required automated categories include:

- raw diplomacy mode mappings;
- missing initial evidence remains UNKNOWN;
- directional asymmetry;
- mutual-alliance formation only after both directed edges qualify;
- alliance ending when one direction changes;
- timestamp ties resolved by operation ordinal;
- unsupported runtime modes destroy certainty rather than guessing;
- opportunity-gated absence;
- unavailable coverage cannot create absence;
- third-party overlap never becomes coordination automatically;
- Chronicle significance from semantic transitions;
- historical callbacks from previous Battles;
- deterministic prose rebuild;
- recent-fragment avoidance;
- unique fragment ids;
- minimum phrase-library breadth;
- prohibited-vocabulary linting;
- evidence ids survive into the published entry.

Real corpus acceptance must include at minimum:

- 1v1;
- fixed 2v2 / 3v3 / 4v4;
- at least one FFA with multiple diplomacy changes;
- one-sided alliance intervals;
- mutual alliance followed by rupture;
- repeated stance changes;
- tribute during asymmetric diplomacy;
- overlapping pressure against a third player;
- unavailable/partial evidence;
- restored or unusual recordings where chronology may be degraded.

Synthetic tests prove semantics. Real replay corpus tests prove that the evidence actually exists in the shapes assumed by those semantics.

## 17. Migration plan

The safe migration order is:

1. qualify and ship temporal diplomacy reconstruction;
2. qualify Chronicle-grade Battle Statistics outputs without changing existing public stat definitions;
3. construct Pair Social Evidence in shadow mode;
4. compare shadow evidence against real FFA/team fixtures;
5. adapt Relationship interpretation to chronological beats while rules remain unconfigured;
6. generate Chronicle Event + Writer output in shadow mode alongside the current Chronicle;
7. review real player histories for truth, tone, repetition and density;
8. switch the profile read model only after acceptance;
9. keep old versions rebuildable for audit.

Do not activate production Relationship scoring merely because the Story Engine is available.

## 18. Explicit non-goals for V1

V1 does not:

- use runtime generative AI;
- interpret raw chat text;
- claim hidden motives from diplomacy changes;
- infer coalition planning from shared targets alone;
- expose Relationship XP/thresholds;
- rewrite Battle Statistics definitions to serve prose;
- guess unavailable interaction coverage;
- treat calendar inactivity as Relationship decay.

The system should make the league feel alive because its history is remembered precisely, not because the narrator embellishes it.

# Player Chronicle Book V1

Status: implementation contract for the player-owned Chronicle surface.

## Purpose

The Player Chronicle is a private historical book owned by the signed-in league player. It records what the league can support about that player's relationships and reserves a personal leaf for honours and selected records.

It is separate from the manually authored Event Chronicle. Event history and player relationship history do not drive one another.

## Ownership invariant

There is one Chronicle book per signed-in player.

- Chronicle opened from the owner's own profile starts on the reserved self leaf.
- Chronicle opened from another player's profile opens the same book on that player's bookmark.
- The bookmark rail comes from the current league player directory, not from established relationship documents.
- Every current league player may therefore have an unwritten relationship leaf before qualifying social evidence exists.

This prevents profile-local partial books where another player's profile exposes only one pair.

## Read model

The book combines three separate sources.

### Personal leaf

The owner's profile supplies the active achievement collection and records explicitly selected for Chronicle display. Selection is represented by the owner's optional `showcasedRecordCodes` field and is capped to three Chronicle records on the read model. The selected-record surface stays reserved when nothing has been selected; absence of a selection never causes arbitrary records to be promoted.

### Official relationship standing

Stored Relationship V2 public state remains authoritative for visible current Rivalry, Hostility, Bond, dormancy and historical peak. The Chronicle renders that state as written prose rather than a dashboard strip.

### Written relationship evidence

AOF_PLAYER_CHRONICLE_V1 is projected at read time from the current accepted social-evidence chapter set:

verified replay artifact -> AOF_SOCIAL_INCIDENTS_V1 -> AOF_SOCIAL_HISTORY_V1 -> AOF_PLAYER_CHRONICLE_V1

PR #64 relationship and reputation progression remains shadow evaluation. Shadow stages are audit metadata and are never promoted to official player-facing standing by the Chronicle.

## Claim firewall

Chronicle prose is generated only from qualified semantic facts already present in the social incident model.

- A diplomacy command is written as a declared stance, never silently as effective alliance.
- Reciprocal ally declarations mean both declarations were recorded; they do not prove trust, motive or permanence.
- Support-command participation proves participation in a qualified support episode, not a rescue, save, success or outcome.
- Shared-opponent participation proves qualified common-target participation, not conspiracy.
- A material-aid order is written as an instruction, not proof of delivery.
- Post-withdrawal offensive action is written only when an admitted qualified offensive fact exists.
- Exceptional king-loss treachery wording is allowed only when every dedicated gate qualified.
- Co-presence is not interaction. It may establish the first recorded overlap but repeated co-presence alone does not create Chronicle spam.
- Missing or unreadable evidence is never translated into peacefulness, refusal, neglect or non-interaction.

DECLARATION_KNOWLEDGE_INTERRUPTED is retained in provenance but suppressed from normal prose rather than converted into a stronger claim.

## Battle synthesis

The normal written unit is one pair x Battle, not one replay command and not one Game. Several Games in the same Battle may contribute ordered social beats to one Chronicle entry.

Within an entry, first-overlap context may establish the beginning of recorded history, declared diplomacy is ordered by replay moment, stronger qualified social beats follow in replay order, repeated low-level changes may be summarized by exact count, and source beat/event IDs remain attached.

Entries sort oldest to newest so new history grows downward on the parchment.

## Relationship and reputation lineage

Each entry may retain relationshipMarks and reputationMarks copied from capped AOF_SOCIAL_HISTORY_V1 contributions for the same pair and Battle. These marks preserve provenance and future interpretation; they do not authorize the UI to display shadow stages as official.

The same neutral deed can therefore be written once while preserving separate relationship and reputation consequences underneath.

## Read boundary and coverage

`getSocialHistory` remains the authenticated review surface and retains the full shadow ledger, evidence lineage and Chronicle projection for auditing. The player UI does **not** consume that object directly.

`getPlayerChronicle` is the player-facing callable. It is owner-bound by authentication, accepts no target player ID, and strips shadow stages, contribution marks, evidence IDs, exclusions and other optimization/audit internals before returning the written pages. A profile is therefore only an entry point into the signed-in player's book; it can never request another player's private Chronicle.

Coverage remains explicit. If accepted Games cannot be read, the sanitized Chronicle read reports partial coverage and the parchment may show an incomplete-record notice. Missing Games are never translated into peacefulness, refusal, neglect or non-interaction.

## UI contract

The player profile exposes one Chronicle button. The book opens as a modal parchment/scroll over the existing profile, using the same artifact interaction language as Battle Orders.

The open book contains a reserved self bookmark, one deterministic-colour bookmark for every other current league player, sticky bookmark navigation, a self leaf for honours and selected records, relationship leaves with official standing plus chronological evidence, and unwritten leaves for potential relationships without qualified entries.

Bookmark colour is deterministic from player identity and carries no relationship meaning.

## Manuscript composition

Relationship leaves use one continuous manuscript reading column. Entries do not alternate left and right; chronology should be readable by following the page straight downward.

A decorated marginal spine runs beside the written history. It is ornamental rather than a timeline widget: braided ink strokes, small knot/leaf forms, end caps and deterministic entry medallions create the illuminated-manuscript character without turning the page into a dashboard.

Entry medallions are chosen from the already-written evidence category (for example first record, official contest, support, common-target participation, diplomacy, withdrawal/offense or exceptional king-loss rule). They never introduce a stronger claim than the Chronicle entry itself.

### Relationship flavour restraint

The spine may carry a subtle secondary accent derived only from the already-public official Relationship V2 state. The accent is deliberately low-saturation and affects only minor ornament strokes. Relationship flavour must not recolor body prose, headings, parchment, entry prominence or bookmark identity.

Where several official tracks are present, the ornament uses a neutral mixed treatment rather than selecting a dominant emotional interpretation. Where official relationship rules are unavailable or unestablished, the spine remains neutral.

The words and evidence-backed milestone titles are therefore the most dramatic part of the page. Ornament supports atmosphere; it does not tell the player how to interpret another player.

### Header epigraph

The relationship leaf does not print Rivalry / Hostility / Bond stages or a Present Standing dashboard. Instead it resolves one short deterministic epigraph from the official public relationship state.

The resolver preserves the current four ordinary Rivalry levels, four ordinary Bond levels, four ordinary Hostility levels, and the secret legendary Hostility escalation **Internecine Strife** when that stage is actually achieved. Internecine Strife is never shown as an empty future tier and its system label is not printed in the epigraph.

Combination wording is authored by shape rather than concatenating track labels: balanced pairs, one-track-led pairs, balanced three-track histories, one-track-led three-track histories, dormant echoes and the legendary Hostility case each have dedicated language. Dormant tracks describe old history as quiet rather than deleted.

The epigraph must lead with sensation, stay short enough to read as manuscript copy, avoid mechanical phrases such as “their record shows”, and never state motive or emotion as fact. A deterministic hash of pair identity plus relationship signature may choose among approved variants so wording is stable until the relationship state changes.

### Bookmark identity

Bookmark colour identifies the person, not the relationship. The self leaf retains its dedicated dark archive ribbon. Other players receive deterministic muted cloth tones that are collision-resolved across the currently open book so every visible relationship bookmark is distinct. Relationship state never changes a bookmark colour.


## Ink reveal

The browser remembers Chronicle entry IDs already seen for each owner/pair. Existing history on first opening is old ink. Later unseen entry IDs alone receive the restrained ink-writing reveal. Reduced-motion settings suppress both the ink reveal and scroll animation.

## Non-goals

This contract does not activate PR #64 shadow scores as production state, let Chronicle prose award points, interpret manual Event Chronicle text as social evidence, infer motive/emotion/damage/kills/success beyond qualified evidence, or make the Chronicle into another player's public book.

The automatic Player Chronicle is the signed-in player's evidence-backed personal record.


## Chronicle narrative V2 — drama from history, not telemetry

The player-facing Chronicle is allowed to be more dramatic than an evidence/debug surface, but it is not allowed to become less true.

`AOF_PLAYER_CHRONICLE_V2` therefore separates three time scopes:

1. **Current official relationship state** — used only for the short header epigraph.
2. **History that existed before a Battle** — used to frame that Battle's entry.
3. **Evidence from the Battle itself** — the only source for what the entry says actually happened.

Current Relationship or Reputation state must never be projected backwards onto an older Battle.

### One Battle, one remembered entry

Several Games and many raw social beats may belong to one Battle. The Chronicle groups them into one pair × Battle entry and writes a short scene rather than a telemetry transcript.

A normal entry should read as approximately two to four short sentences:
- the memorable episode;
- an earned repetition callback when one exists;
- at most one relationship/reputation context line when prior history materially changes how the event reads.

Replay-relative timestamps are provenance, not prose. The Battle/Event and calendar date remain in the entry signature.

### Repetition means independent history

Words such as “again”, “another”, “familiar”, “recurring”, or “no longer a one-off” require a prior independently qualified **Battle** containing the same semantic family.

Multiple commands, beats, POVs, or Games inside one Battle do not manufacture repetition.

Direction is retained for directed families. Repeated support from A → B is not inferred from support by B → A.

### Historical pair context

An entry may refer to an older contest, quarrel, cooperation, or contradiction only from qualified relationship contributions belonging to earlier Battles.

Examples of permitted framing:
- a supportive deed after prior Hostility evidence: “It landed on a page that already carried an older quarrel.”
- hostile evidence after prior Bond evidence: “It darkened a page that already contained cooperation between them.”
- another duel after prior Rivalry evidence: “The contest was no longer new between them.”

These are historical comparisons, not motive claims and not public stage labels.

Future Battles cannot alter this context.

### Reputation as light, never cause

The actor's reputation may colour a directed deed only from **prior** qualified reputation contributions across earlier Battles in the league.

A single prior deed is not enough to characterize a name. Narrative reputation framing requires at least two earlier distinct Battles on the relevant reputation axis.

The writer may then note alignment or contradiction:
- supportive deed after repeated Chivalry evidence: it sits beside earlier acts of aid attached to that name;
- supportive deed after repeated Cruelty evidence: it sits strangely beside harder deeds already attached to that name;
- hostile deed after repeated Cruelty evidence: harder deeds had appeared beside that name before;
- hostile deed after repeated Chivalry evidence: it cuts against more helpful deeds already attached to that name.

This context can never make the current episode qualify, prove intent, or explain *why* the player acted.

Symmetric events such as an official duel or shared-opponent participation do not assign reputation framing to whichever participant happens to occupy an internal actor field.

### Literary uncertainty instead of audit jargon

Player prose should preserve uncertainty in Chronicle language instead of exposing implementation language.

Examples:
- reinforcement commands: “The orders are certain; what reached the field is not.”
- material aid: “The command is in the ledger; delivery itself is not claimed.”
- shared opponent: “Whether by design or circumstance, the page does not say.”
- offensive attempt: “No success is claimed; the attempt itself is enough to mark the turn.”

The player-facing prose should avoid terms such as qualification, coverage, source-event IDs, rule versions, scoring, or replay timestamps.

### Exceptional events

Exceptional king-loss wording is available only after the underlying dedicated qualifier has passed every required gate. Because that evidence includes effective alliance, rupture, hostile participation, king loss, responsibility, association, and mode, the Chronicle may use stronger language such as:

> “The alliance had broken. What followed left A recorded as responsible for the loss of B's king.”

It still does not invent motive, emotion, dialogue, or unqualified causality.

### Auditability

The internal Chronicle projection retains a `narrativeContext` summary containing the prior family, relationship-evidence, and reputation-evidence counts that permitted contextual wording.

The authenticated player-facing Chronicle callable does not expose those internal counts. Players receive the finished history; review/debug surfaces retain the reason the writer was allowed to phrase it that way.

The writer remains deterministic and has no runtime LLM/API dependency.

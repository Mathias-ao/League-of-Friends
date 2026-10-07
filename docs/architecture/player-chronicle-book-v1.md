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

The owner's profile supplies the active achievement collection and records explicitly selected for Chronicle display when showcased record codes are configured. The selected-record surface stays reserved when nothing has been selected.

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

## Coverage

getSocialHistory returns the Chronicle projection with explicit source coverage. If accepted Games cannot be read, the Chronicle may show an incomplete-record notice and must not infer anything from those gaps.

## UI contract

The player profile exposes one Chronicle button. The book opens as a modal parchment/scroll over the existing profile, using the same artifact interaction language as Battle Orders.

The open book contains a reserved self bookmark, one deterministic-colour bookmark for every other current league player, sticky bookmark navigation, a self leaf for honours and selected records, relationship leaves with official standing plus chronological evidence, and unwritten leaves for potential relationships without qualified entries.

Bookmark colour is deterministic from player identity and carries no relationship meaning.

## Ink reveal

The browser remembers Chronicle entry IDs already seen for each owner/pair. Existing history on first opening is old ink. Later unseen entry IDs alone receive the restrained ink-writing reveal. Reduced-motion settings suppress both the ink reveal and scroll animation.

## Non-goals

This contract does not activate PR #64 shadow scores as production state, let Chronicle prose award points, interpret manual Event Chronicle text as social evidence, infer motive/emotion/damage/kills/success beyond qualified evidence, or make the Chronicle into another player's public book.

The automatic Player Chronicle is the signed-in player's evidence-backed personal record.

# Replay-driven Event flow V1

Implemented on `feat/replay-driven-event-flow-v1`, based on main `9f87a014bcad4919bafc117a0e79b183ef2536cc`. No deployment or historical migration is included. The latest [core identity](../project/CORE-IDENTITY.md#season-event-contract) governs product policy.

## Attendance and the draw

Warmups are drawn seven days before kickoff by the existing scheduled lifecycle. Main pairings wait for all confirmed attendance to be resolved. Missing check-in requires an Emperor-only force action and a recorded reason, even after the window expires. An Emperor can mark a verified late arrival or no-show before approval. A withdrawn RSVP no longer retains checked-in status; approval freezes the main roster.

Each main draw uses a fresh server UUID seed and SHA-256 permutations. Random is the default; League Elo balancing is an explicit option. Uneven teams keep the agreed current Season standings rule: higher earned ranks receive the numerical disadvantage. Every draw is a proposal with visible sides before approval; approval rechecks current eligibility and attendance. Approved topology governs civilisation drafting and Battle Orders.

## Human warmups and one best result

The unpaired player can invite any active AoF member, including an already-paired helper or a member outside the Season. Acceptance creates a warmup registration, never implicit Season/main signup. The helper's first reserved slot is preserved. Expired invitations require human resolution; no new AI Battle is created. Before play closes, the Emperor can record an agreed human pairing or an audited unplayed resolution. Unrecorded pairings can be replaced; accepted/recorded evidence requires the appropriate review or correction flow.

`AOF_BEST_WARMUP_V1` counts exactly one best warmup per player: 1 participation plus 2 for a win. Ties select by stable Match ID. Event-owned selection and ledger entries bind the chosen Match, result revision and active source hash. Reconciliation reads every current candidate in one transaction and reverses/rebinds net awards on dispute, correction or withdrawal. Event statistics and Roundoff use the same per-player selection while preserving the full Battle roster and evidence. Gold, League Elo, human-opponent records, Season/lifetime actual-Battle measurements and existing award eligibility remain separate policies.

Play closes at the next local midnight after the Event's calendar day, in the Event's pinned timezone. Late uploads retain evidence but require an Emperor to verify timely play against the current recording. Upload time does not establish play time. The default human acceptance deadline is just before play closes; the Emperor can announce an earlier deadline before the draw. Existing pinned historical windows/policies are not rewritten.

## Upload is result submission

The previous gap was between saved analysis and the official result that feeds processing, not an absence of upload. A separately versioned `AOF_RECORDING_OUTCOME_V1` resolver now runs after evidence persistence. Retryable source/Game triggers recover partial delivery. Accepted outcomes use the existing canonical result, revision job, points, Gold, records and statistics machinery; they do not create a parallel rewards system. Duplicate Game GUIDs cannot score in different Battles. A wrong attribution is released only after an audited cancellation/void or a reviewed correction to a different recorded Game.

The automatic adapter covers the real duel/team corpus for DE save 68.0/build 180059 and save 68.9/build 185872. It requires unique approved starter mapping, fixed locked sides, qualified map/rules, no restoration or diplomacy changes, complete framing, ordinary supported non-disconnect resignations of every opposing starter, surviving winning starters, and a subsequent terminal postgame agreeing with the stream clock. It never treats ladder rank as finishing order. The compact projector is V2 because retained resignation evidence now records wire layout, disconnect status and operation ordinal; original raw facts remain unresolved and immutable.

The eight bounded backend corpus fixtures are derived from repository recordings using `python replay-tools/export_recording_outcomes.py`. Their original hashes, command ordinals and decoded terminal evidence are retained. These exercise outcome qualification, not unknown custom-setting semantics.

Unsupported versions, map identities, drafted civilisations/additional settings, restoration, disconnects, diplomacy, incomplete endings and late timing remain `PENDING_ADMIN_REVIEW`. An Emperor reviews the actual source, verifies starters/settings/winner/timing, chooses the winner and records a reason. A result accepted from a recording binds its source hash. Replacing accepted evidence requires an open correction dispute and Emperor authorization; upholding a replaced source is rejected. Correcting rebinds the reviewed current source and retains result history. Ordinary players upload the recording and have the existing dispute option.

Qualified recording-only team series finalize automatically at the majority threshold. Unplayed later Games become NO_CONTEST; a later Game with a recording requires review. Reviewed/admin-corrected series use the Emperor's explicit conclude-series control.

## Identity and Emperor controls

Steam account authentication remains the authority for membership. The league alias is chosen by the player; verified profile lookups supply the current Steam persona and retain previous verified names. UI appends the current persona to a different alias, and replay mapping uses current/history names rather than trusting the alias. A server-only `STEAM_WEB_API_KEY` is preferred; bounded Community XML is the fallback. Profile failure leaves names pending and does not prevent authenticated account login. Ambiguous recording names have an audited Emperor binding control before upload.

Emperor controls now cover:

- Create a draft Event with announced settings, warmup policy and explicit separate Gold rewards; review and publish it.
- Configure human warmups, resolve expired invitations, record agreed opponents, replace unplayed opponents and cancel unplayed Battles.
- Resolve attendance, select draw method, force missing-check-in draws, review proposed sides and approve.
- Confirm actual starters before picks/play, bind ambiguous recording names, review qualified/late evidence, correct disputes, reject invalid evidence before any accepted Game, conclude reviewed series and retry pending result jobs.
- Inspect the Roundoff closure checklist and conclude the Event only when Battles/Games, invitations, disputes, current processing, source bindings and best-warmup accounting are resolved.

All authoritative changes remain authenticated backend commands with audit records; UI visibility alone is not authorization. Accepted Battles cannot bypass reward correction through the invalid-evidence rejection control. Retries use the ordinary leased processing pipeline.

## Live Roundoff and acceptance

Roundoff now reads points, selected warmups and qualified accomplishments in a coherent read transaction. Current accepted Game revisions and source-bound statistics determine eligibility. It updates during play. Event closure neither publishes statistics nor activates unqualified social awards; the existing social interpreter remains a shadow system.

Before end-to-end acceptance, deploy this branch's Functions, scheduler and replay worker together to the chosen test environment. The worker must produce compact projector V2 evidence. Confirm Firebase project/bucket, authenticated Steam callback origins and optional server profile key. Existing ready sources are not silently regenerated; upload a new test Game or use a deliberate retained-evidence rebuild. No real key belongs in source or browser variables.

Exercise random redraw and optional Elo; all-present check-in and explicit forced/no-show/late-arrival cases; odd-roster acceptance by both an already-paired helper and someone outside the Season; invitation expiry and unplayed replacement; supported replay auto-result, repeat/perspective upload and duplicate attribution; unsupported/late source review; decisive series; dispute/source replacement and processing retry; best-warmup fallback and live Roundoff; then Event closure. Confirm a player account cannot execute Emperor commands.

Automatic fixed-FFA winner/finishing-order qualification remains pending the user's planned known-result recording test, including automatic defeats/disconnects and complete terminal coverage. The existing placement consumer/tie/correction machinery remains ready, with explicit pending notices and no fabricated placement awards. Objective modes require their own ranking semantics. Deployed environment state and full player-flow acceptance cannot be established by repository tests alone.

Local validation: backend and web builds; 221 backend tests; 63 web tests; 262 replay tests (258 passed, four opt-in skips); authenticated callable-boundary checks. Integration coverage includes the full recording-to-rewards job, paused-step recovery without duplicate points/Gold, Emperor-only attendance and nonparticipant correction review, duplicate/reassigned Game identity, best-warmup fallback, selected Event statistics, live Roundoff and closure blockers. Node 22 CI and deployed multi-account end-to-end acceptance are separate checks.

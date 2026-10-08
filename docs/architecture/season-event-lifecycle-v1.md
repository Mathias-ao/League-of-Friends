# Season Event lifecycle V1

Implemented on `feat/season-event-lifecycle-v1`, based on main `97fedc803cc39bd7f9f6bc2b6c78d9638cdeb01d`. No deployment or historical migration is included. The [core Season Event contract](../project/CORE-IDENTITY.md#season-event-contract) remains authoritative.

## Warm-up preparation and play

The Emperor announces a warm-up map and AI difficulty before pairings exist. The configuration uses one conquest map, unrestricted civilizations, no diplomacy, and the Event's other standard game settings. The form suggests Arabia and Hard; the Emperor explicitly announces the chosen values. An Event may also supply this policy when created. Existing manual Events remain opt-in.

`AOF_WARMUP_LIFECYCLE_V1` opens exactly seven days before kickoff. A five-minute scheduled function snapshots confirmed signups who are active members entered in the Season, excludes already reserved warm-up slots, and generates a reproducible seeded draw. The unpaired player is selected from the same draw. Transactional creation and fixed Match IDs prevent duplicate Matches and scoring slots on retries. Late publication/configuration catches up while the window is open.

The draw does not close main-event signup. Later entrants can still sign up under the Event's existing signup deadline; they are not silently added to the completed draw. Attendance changes and unplayed warm-up replacement are explicit Emperor exceptions. Main check-in remains separate from warm-up eligibility.

An unpaired player challenges active Season members who have neither signed up for this Event nor reserved a scoring warm-up. Only the invited guest can accept. Acceptance rechecks both players' eligibility, creates the designated human duel, registers a warm-up-only guest, and expires competing invitations. Both receive normal 1/+2 warm-up scoring. Acceptance defaults to 48 hours before kickoff and can be configured before pairing generation.

At the acceptance deadline, an eligible unpaired player receives one AI warm-up at the announced difficulty. If that player withdrew or became ineligible, the schedule requires an administrative unplayed resolution instead. An Emperor may replace an unplayed human opponent with an agreed eligible guest, recording a reason. The survivor's existing scoring slot transfers; the withdrawn player's reservation remains. Played or recorded pairings cannot use this shortcut.

Play closes at the next local midnight after the main Event's calendar day. New Events pin an IANA timezone; Europe/Copenhagen is the default. The calculation covers daylight-saving transitions. Historical Matches with explicit play windows keep their pinned times. Replay uploads remain accepted after the deadline. New automatic human warm-up result claims submitted late enter administrative timing review; normal opponent confirmation cannot accept them. The Emperor must bind approval to the active READY source, attest timely completion, and record the reviewed evidence. Upload time alone is not evidence of play time.

## AI participation and evidence

An AI opponent is a separate opponent record, never an AoF Player or Season member. Replay ingestion maps exactly one human and one opponent slot and retains the ordinary hash-checked canonical bundle and Battle measurements. It does not retain the original upload permanently.

The current replay adapter cannot independently qualify AI identity/settings or calendar completion. Therefore AI participation requires an explicit Emperor review of the recording and announced settings, tied to the current source hash and reserved slot. Unknown opponent metadata never counts as automatic proof of AI play.

The dedicated `AOF_AI_WARMUP_PARTICIPATION_V1` ledger awards exactly one participation point. It awards no victory bonus, Gold, rating, player Relationships, Reputation or human-opponent records. Battle statistics remain available; AI measurements are excluded from competitive Season/lifetime aggregates. No current Achievement rule explicitly permits AI, so no AI Achievement processing is activated.

Retrying review or reconciliation does not duplicate points. A participant may request correction; the point is withdrawn until reviewed again. Source replacement withdraws the award until the new source is verified. Rejected evidence is audited and voided without deleting the retained evidence. Review is a bounded administrative exception, not automatic replay qualification.

## Main-event teams

New V2 main plans require closed check-in and snapshot current earned Season standings, with disputed/unreconciled awards masked. Existing Season tie rules apply: points, main wins, warm-up wins, then a shared rank. Within an uneven team Game, the highest-ranked players form the smaller team; equal ranks use a reproducible seeded draw. The snapshot and policy version persist with the plan. Emperor office alone does not substitute for earned standings.

Equal teams and grouping continue to use the existing planner. No power-rating win-probability estimate is attached to standings-based uneven teams. Approval rechecks attendance and rejects a changed roster before creating Matches. Actual approved topology continues to govern drafting.

## Administrative Event closure

The Emperor's Event checklist requires a started Event, a main plan, resolved scheduled Battles/Games, resolved guest invitations/unpaired players, no active disputes, and completed processing for the current result revision. AI participation must be reviewed against the current READY source and its ledger reconciled. Unplayed Battles may be cancelled with an audited reason; reserved scoring opportunities are preserved and no points are invented.

Finalisation is transactional and idempotent. It records the actor, time and closure revision and sets the Event to COMPLETED. It does not publish statistics or gate progression. Later evidence corrections remain eligible for normal reconciliation.

## FFA finishing-order boundary

The source-bound producer can validate independently qualified elimination outcomes, approved player mappings, current winner/result revision, complete coverage, non-restored nondiplomatic play, and simultaneous eliminations. Ties share the occupied placement awards using the existing exact-unit consumer. Game, Match and source changes requalify the current projection; existing accounting reconciles changed placement awards.

**The production qualified-adapter registry is currently empty.** This is an implementation and validation gap, not a claim that fixed FFA recordings lack outcome evidence. Complete, locked, nondiplomatic elimination games should derive their winner and finishing order from the recording. The decoder already retains player-identified, timed resignation commands; a format-specific adapter must account for automatic defeats, disconnects, duplicate commands and whether the recording covers the final outcome. Leaderboard rank is not finishing order. Objective FFA rank requires its own qualified policy. Event closure may proceed with an explicit pending-placement notice; closure does not manufacture those awards.

To activate automatic placement scoring, implement an elimination-outcome adapter and validate it against complete fixed FFA recordings with known results, including resignation and automatic-defeat cases. Also exercise truncated, restored, disconnected, duplicated, tied and winner-conflict evidence. A known result may be established by replaying the recording in the game; separate footage is not a universal prerequisite. Register the supported version, then repeat source-replacement/dispute scoring acceptance. Synthetic regression fixtures test the boundary but do not establish unknown engine semantics.

An 8 October inspection of the raw operation stream found timed RESIGN actions and matching final postgame world times in the paired duel and three AoF test recordings. The available `FFA_diplo` recording has unlocked teams and repeated disconnected RESIGN commands; `townbell-ffa-save68` has unlocked teams, victory type 9, and no RESIGN commands. Neither is a complete fixed nondiplomatic conquest FFA qualification case. Use a real fixed FFA recording to close this gap; do not apply a general diplomacy restriction to the intended fixed format.

## Validation and end-to-end acceptance

Backend and web builds, 203 backend tests, 60 web tests and callable-boundary checks pass locally. Added integration checks exercise retry-safe pairing, guest permission/eligibility, AI fallback and point reversal, late timing review, separate late main signup, standings allocation/stale attendance, cancellation/replacement, finalisation and conservative FFA qualification. Web tests cover the relevant controls and disabled review gates. Local validation used Node 24; repository CI validates Node 22.

Before V1 deployment, run the branch CI and the normal authenticated player-flow test in a staging environment. Confirm the replay worker/bucket are configured and deploy the new callables, Firestore triggers and scheduled function together. Existing Events require the Emperor to opt in before pairings exist; no automatic migration occurs.

Exercise an even draw, an accepted odd-roster guest, a declined/expired guest with AI fallback, a withdrawn unpaired player, an unplayed replacement, late evidence review, 3v2/4v3 standings allocation after check-in, a dispute/source replacement, and Event closure. Verify the ledger after each correction and that statistics appear before closure. Review real AI and FFA recordings independently. Automatic FFA finishing-order awards remain a V1 evidence prerequisite if that feature is included in launch scope. Live roundoff production and other existing statistics/social qualification gates are not completed by this branch.

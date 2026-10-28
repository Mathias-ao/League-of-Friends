/** Authenticated Firestore emulator acceptance, using two *genuine* pinned
 * recorded Games, with explicitly synthetic reviewed exceptional meaning.
 * Importing the independent INT-B harness first produces a fully authenticated
 * AUTO→READY two-Game Battle and exercises existing corrections/privacy.
 * No fixture qualifies a true executed rescue or Treachery.
 */
import assert from 'node:assert/strict';
import {Timestamp} from 'firebase-admin/firestore';
import {db} from '../lib/config/firebase.js';
import {getMyPersonalityHistory} from '../lib/queries/getMyPersonalityHistory.js';
import {offerChronicleInvitation,actOnChronicleInvitation,getMyChronicleInvitations,
 getMyChronicleSubmission,adminReviewChronicleCorrection} from '../lib/queries/chronicleInteractionService.js';
import {invitationSlotId} from '../lib/domain/socialV1.js';

assert.equal(process.env.GCLOUD_PROJECT,'demo-aof-native-player');
assert.equal(process.env.FUNCTIONS_EMULATOR,'true');
await import('./int-b-history-emulator.mjs');
const uid='intb-owner-uid',otherUid='intb-other-uid',outsider='intb-outsider',
 adminUid='intb-admin',battleId='intb-controlled-series';
process.env.AOF_CHRONICLE_INTERACTIONS_V1E='emulator-only';
const req=(uid,data)=>({auth:{uid},data});
const match=db.doc('matches/'+battleId);
// Historical invitation order is the approved Event/MatchPlan, not the
// completion timestamp or the upload order. Seed canonical server authority.
const event=db.doc('events/intb-event');
await event.update({startsAt:Timestamp.fromMillis(1000),
  approvedMatchPlanId:'intb-plan',matchPlanStatus:'APPROVED'});
await event.collection('matchPlans').doc('intb-plan').set({
  status:'APPROVED',officialMatchIds:[battleId],matches:[{}]});
await match.update({sourceMatchPlanId:'intb-plan',matchNumber:1,
  firstCompletedAt:Timestamp.fromMillis(999999)});
const owner=await getMyPersonalityHistory.run(req(uid,{}));
const other=await getMyPersonalityHistory.run(req(otherUid,{}));
assert.equal(owner.coverage.ownGames,2);
assert.equal(owner.coverage.ownBattles,1);
assert.equal(owner.coverage.currentSources,2);
const b1=owner.sources.find(s=>s.gameId==='g1'),b2=owner.sources.find(s=>s.gameId==='g2');
assert.ok(b1?.authorityRevision&&b2?.authorityRevision);
const o1=other.sources.find(s=>s.gameId==='g1');
const moment={
  methodReview:'EMULATOR_ONLY',reviewedSource:'ORIGINAL_VERIFIED_TEST_WITNESS',
  battleId,gameId:'g1',sourceAuthority:b1.authorityRevision,
  incidentId:'synthetic-rare-help-A',incidentRevision:'c'.repeat(64),
  respondentPlayerId:'intb-owner',counterpartPlayerId:'intb-opponent-alias',
  family:'ASSISTANCE',qualifierMethod:'emulator-reviewed-assistance',qualification:'ADMITTED',
  significance:'EXCEPTIONAL',sourceEvidenceRefs:['emulator-not-a-verified-help-proof'],
  independentEpisodeKey:'controlled-rare-episode-1',substantiveAssistanceVerified:true,
};
const reviews=match.collection('chronicleRareReviewedMoments');
await reviews.doc(moment.incidentId).set(moment);
const offer=()=>offerChronicleInvitation.run(req(uid,{battleId}));
await assert.rejects(offerChronicleInvitation.run({data:{battleId}}),e=>e.code==='unauthenticated');
await assert.rejects(offerChronicleInvitation.run(req(outsider,{battleId})));
await assert.rejects(offerChronicleInvitation.run(req(uid,{battleId,respondentPlayerId:'intb-opponent-alias'})),
 e=>e.code==='invalid-argument');

const [race1,race2]=await Promise.all([offer(),offer()]);
assert.equal([race1,race2].filter(r=>r.offered).length,1,'two races produce one durable slot');
const created=[race1,race2].find(r=>r.offered).invitation;
assert.equal(created.respondentPlayerId,'intb-owner');
assert.equal((await match.collection('socialV1InvitationSlots').get()).size,1);
assert.equal((await match.collection('socialV1InvitationSlots').doc(invitationSlotId(battleId,'intb-owner')).get()).exists,true);
assert.equal((await offer()).offered,false,'same Battle cannot mint a second invitation');
const own=await getMyChronicleInvitations.run(req(uid,{})),opponent=await getMyChronicleInvitations.run(req(otherUid,{})),
 out=await getMyChronicleInvitations.run(req(outsider,{}));
assert.equal(own.invitations.length,1);
assert.equal(opponent.invitations.length,0);
assert.equal(out.invitations.length,0);
assert.equal(JSON.stringify(own).includes('privateNote'),false);
assert.equal(JSON.stringify(own).includes('emulator-not-a-verified-help-proof'),false);
await assert.rejects(getMyChronicleInvitations.run(req(uid,{playerId:'intb-opponent-alias'})),
 e=>e.code==='invalid-argument');

const act=(uid,data)=>actOnChronicleInvitation.run(req(uid,{battleId,
 opportunityRevision:created.opportunityRevision,...data}));
await assert.rejects(act(otherUid,{requestId:'impersonate',action:'SUBMIT',
 expectedRevision:1,choiceId:'ACKNOWLEDGED_HELP',confirmed:true}));
await assert.rejects(act(outsider,{requestId:'outsider',action:'SUBMIT',
 expectedRevision:1,choiceId:'ACKNOWLEDGED_HELP',confirmed:true}));
await assert.rejects(act(uid,{requestId:'forged-victim',action:'SUBMIT',
 expectedRevision:1,choiceId:'FELT_BETRAYED',confirmed:true}),e=>e.code==='invalid-argument');
await assert.rejects(act(uid,{requestId:'missing-confirmation',action:'SUBMIT',
 expectedRevision:1,choiceId:'ACKNOWLEDGED_HELP'}),e=>e.code==='invalid-argument');

const defer=await act(uid,{requestId:'defer',expectedRevision:1,action:'DEFER'});
assert.equal(defer.state,'DEFERRED');
const submitArgs={requestId:'binding-v1',expectedRevision:defer.revision,
 action:'SUBMIT',choiceId:'ACKNOWLEDGED_HELP',confirmed:true,privateNote:'AUTHOR-PRIVATE-NOTE-SECRET'};
const submitRace=await Promise.allSettled([
 act(uid,submitArgs),
 act(uid,{...submitArgs,requestId:'simultaneous-rival-write'})
]);
assert.equal(submitRace.filter(x=>x.status==='fulfilled').length,1,'concurrent independent binding submissions cannot both commit');
const winnerRequest=submitRace[0].status==='fulfilled'?submitArgs:
 {...submitArgs,requestId:'simultaneous-rival-write'};
const first=submitRace.find(x=>x.status==='fulfilled').value;
assert.equal(first.state,'SUBMITTED');
assert.equal(first.revision,3);
const retry=await act(uid,winnerRequest);assert.equal(retry.idempotent,true);
await assert.rejects(act(uid,{...submitArgs,requestId:'double-submit',choiceId:'NOT_PERSONALLY_MEANINGFUL'}));
await assert.rejects(act(uid,{...winnerRequest,privateNote:'changed-data'}),e=>e.code==='already-exists');
const ownAfter=await getMyChronicleInvitations.run(req(uid,{}));
assert.equal(ownAfter.invitations[0].speaker?.authorPlayerId,'intb-owner');
assert.equal(ownAfter.invitations[0].speaker?.presentation,'ATTRIBUTED_SPEAKER_NOT_OBJECTIVE_NARRATOR');
assert.equal(ownAfter.invitations[0].speaker?.qualification,'PENDING');
assert.equal(ownAfter.invitations[0].effects.officialWrites,false);
assert.equal(JSON.stringify(ownAfter).includes('AUTHOR-PRIVATE-NOTE-SECRET'),false);
assert.equal((await getMyChronicleInvitations.run(req(otherUid,{}))).invitations.length,0);
const privateRead=await getMyChronicleSubmission.run(req(uid,{battleId}));
assert.equal(privateRead.privateSubmission.privateNote,'AUTHOR-PRIVATE-NOTE-SECRET');
await assert.rejects(getMyChronicleSubmission.run(req(otherUid,{battleId})));
await assert.rejects(getMyChronicleSubmission.run(req(outsider,{battleId})));
const correction=await act(uid,{requestId:'correction-request',action:'CORRECTION_REQUEST',expectedRevision:3,reason:'I selected the opposite option in error.'});
assert.equal(correction.revision,4);
await assert.rejects(adminReviewChronicleCorrection.run(req(uid,{battleId,
 respondentPlayerId:'intb-owner',requestId:'self-approve',expectedRevision:4,decision:'APPROVE',reason:'Self-review is forbidden.'})),
 e=>e.code==='permission-denied');
await assert.rejects(adminReviewChronicleCorrection.run(req(otherUid,{battleId,
 respondentPlayerId:'intb-owner',requestId:'not-admin',expectedRevision:4,decision:'APPROVE',reason:'Not a league administrator.'})),
 e=>e.code==='permission-denied');
const approved=await adminReviewChronicleCorrection.run(req(adminUid,{battleId,
 respondentPlayerId:'intb-owner',requestId:'impartial-review',expectedRevision:4,decision:'APPROVE',reason:'Original author verified an input mistake; rebind the same incident.'}));
assert.equal(approved.correctionState,'REOPENED');
const corrected=await act(uid,{requestId:'binding-v2',action:'CORRECT',expectedRevision:5,
 choiceId:'NOT_PERSONALLY_MEANINGFUL',confirmed:true});
assert.equal(corrected.revision,6);
const slot=match.collection('socialV1InvitationSlots').doc(invitationSlotId(battleId,'intb-owner'));
const judgments=await slot.collection('judgments').get();
assert.equal(judgments.size,2,'append-only original binding preserved under author correction');
assert.equal((await slot.collection('audit').get()).size,6,'offer,defer,submit,correction,review,rebind');
assert.equal((await slot.get()).data().judgment.version,2);
assert.equal((await getMyChronicleInvitations.run(req(uid,{}))).invitations[0].speaker.choiceId,'NOT_PERSONALLY_MEANINGFUL');
assert.equal((await getMyChronicleSubmission.run(req(uid,{battleId}))).privateSubmission?.privateNote,'');
// Separate respondent / same Battle can have at most their own one slot.
const momentB={...moment,incidentId:'synthetic-rare-help-B',incidentRevision:'d'.repeat(64),
 respondentPlayerId:'intb-opponent-alias',counterpartPlayerId:'intb-owner',
 sourceAuthority:o1.authorityRevision,independentEpisodeKey:'controlled-rare-episode-B'};
await reviews.doc(momentB.incidentId).set(momentB);
const bOffer=await offerChronicleInvitation.run(req(otherUid,{battleId}));
assert.equal(bOffer.offered,true);
const bDecline=await act(otherUid,{requestId:'B-decline',action:'DECLINE',expectedRevision:1,
 opportunityRevision:bOffer.invitation.opportunityRevision});
assert.equal(bDecline.state,'DECLINED');
assert.equal((await offerChronicleInvitation.run(req(otherUid,{battleId}))).offered,false);
assert.equal((await slot.collection('judgments').get()).size,2);
assert.equal((await db.collection('leaguePointLedger').get()).size,0);
assert.equal((await db.collection('goldLedger').get()).size,0);
// Canonical schedule mutation invalidates the invitation even if every
// recording and its completion time are unchanged.
const approvedEvent=(await event.get()).data();
await event.update({startsAt:Timestamp.fromMillis(3000)});
assert.equal((await getMyChronicleInvitations.run(req(uid,{}))).invitations[0].sourceCurrent,false);
await assert.rejects(act(uid,{requestId:'stale-approved-schedule',action:'CORRECTION_REQUEST',
  expectedRevision:6,reason:'Approved Event schedule was changed after the response.'}),e=>e.code==='aborted');
await event.set(approvedEvent);
assert.equal((await getMyChronicleInvitations.run(req(uid,{}))).invitations[0].sourceCurrent,true);
// Sibling Game source/statistics revision invalidates the pair×Battle invitation
// even when the selected g1 recording and rare incident have not changed.
// This genuine READY g2 has no canonicalResult object; never fabricate one.
const sibling=match.collection('games').doc('g2'),originalSibling=(await sibling.get()).data();
assert.ok(Number.isSafeInteger(originalSibling.replayStatisticsRevision));
await sibling.update({replayStatisticsRevision:originalSibling.replayStatisticsRevision+1});
assert.equal((await getMyChronicleInvitations.run(req(uid,{}))).invitations[0].sourceCurrent,false);
await assert.rejects(act(uid,{requestId:'stale-sibling',action:'CORRECTION_REQUEST',expectedRevision:6,
 reason:'Unrelated sibling source revision changed.'}));
await sibling.set(originalSibling);
assert.equal((await getMyChronicleInvitations.run(req(uid,{}))).invitations[0].sourceCurrent,true);
// A source withdrawal disables responses, preserves tombstone+old private audit.
const gr=match.collection('games').doc('g1'),game=(await gr.get()).data();
await gr.collection('replaySources').doc(game.activeReplayStatisticsId).update({state:'WITHDRAWN'});
await assert.rejects(act(uid,{requestId:'stale-answer',action:'CORRECT',expectedRevision:6,
 choiceId:'ACKNOWLEDGED_HELP',confirmed:true}));
const refreshed=await act(uid,{requestId:'withdrawn-refresh',action:'REFRESH',expectedRevision:6});
assert.equal(refreshed.state,'WITHDRAWN');
assert.equal((await slot.collection('judgments').get()).size,2);
assert.equal((await slot.collection('audit').get()).size,7);
assert.equal((await slot.get()).data().state,'WITHDRAWN');
assert.equal((await getMyChronicleInvitations.run(req(uid,{}))).invitations[0].sourceCurrent,false);
console.log(JSON.stringify({fixture:'CHRON_V1E_AUTHENTIC_EMULATOR',genuineOriginalGames:2,
 syntheticExceptionalProofOnly:true,concurrentOfferSingleSlot:true,
 authAccounts:['respondent-A','respondent-B','outsider','impartial-admin'],
 respondentBound:true,privateNotesAuthorOnly:true,onePerBattle:true,
 optOutNoPenalty:true,staleSourceWithdrawal:true,appendOnlyCorrections:true,
 effects:0,productionEnabled:false}));

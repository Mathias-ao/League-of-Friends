/** A single-run cross-service read after genuine private progression and
 * Chronicle response emulator suites have populated the SAME demo Firestore.
 * This is not real-browser/staging E2E, nor proof of executed rare conduct.
 */
import assert from 'node:assert/strict';
import {getMyPersonalityHistory} from '../lib/queries/getMyPersonalityHistory.js';
import {getMyPrivateChronicle} from '../lib/queries/getMyPrivateChronicle.js';
import {getMyChronicleInvitations,getMyChronicleSubmission} from '../lib/queries/chronicleInteractionService.js';
assert.equal(process.env.FUNCTIONS_EMULATOR,'true');
assert.equal(process.env.GCLOUD_PROJECT,'demo-aof-native-player');
process.env.AOF_CHRONICLE_INTERACTIONS_V1E='emulator-only';
const owner='intb-owner-uid',other='intb-other-uid',outsider='intb-outsider';
const req=(uid,data={})=>({auth:{uid},data});
const [personality,chronicle,invites]=await Promise.all([
  getMyPersonalityHistory.run(req(owner)),
  getMyPrivateChronicle.run(req(owner)),
  getMyChronicleInvitations.run(req(owner)),
]);
assert.equal(personality.ownerPlayerId,'intb-owner');
assert.equal(personality.coverage.ownBattles,1);
assert.equal(personality.coverage.ownGames,2);
assert.equal(personality.personality.personalityProfile.sliders.length,5);
assert.ok(personality.personality.personalityProfile.sliders.every(s=>s.value===null),
  'One genuine best-of-two Battle does not grant a longitudinal Personality midpoint');
assert.ok(chronicle.chronicle.pages.some(p=>p.counterpartPlayerId==='intb-opponent-alias'),
  'The same authenticated owner has a source-bound factual pair Chronicle');
assert.equal(invites.visibility,'OWNER_ONLY');
assert.equal(invites.ownerPlayerId,personality.ownerPlayerId);
assert.equal(invites.invitations.length,1);
assert.equal(invites.invitations[0].respondentPlayerId,personality.ownerPlayerId);
assert.equal(invites.invitations[0].speaker?.qualification,'PENDING');
assert.equal(invites.invitations[0].effects.officialWrites,false);
assert.equal(invites.invitations[0].effects.negativeForSilence,false);
assert.deepEqual(invites.officialEffects,[]);
const submission=await getMyChronicleSubmission.run(req(owner,{battleId:'intb-controlled-series'}));
assert.equal(submission.authorPlayerId,personality.ownerPlayerId);
assert.equal(submission.publication,'NONE_PENDING_INDEPENDENT_QUALIFICATION');
const out=await getMyChronicleInvitations.run(req(outsider));
assert.equal(out.invitations.length,0);
const peer=await getMyChronicleInvitations.run(req(other));
assert.ok(peer.invitations.every(i=>i.respondentPlayerId==='intb-opponent-alias'));
await assert.rejects(getMyChronicleSubmission.run(req(outsider,{battleId:'intb-controlled-series'})));
console.log(JSON.stringify({acceptance:'AOF_V1_COMBINED_PRIVATE_EMULATOR_1',
  originalFormats:['1v1','2v2','4v4','FFA'],
  sourceBoundSocialStageHandledBy:'INT_C2B_EXISTING_139',
  historicalOrderHandledBy:'APPROVED_EVENT_MATCHPLAN_GAME',
  authenticLongitudinalPersonalityPending:true,privateScenePresent:true,
  oneBattleTwoGames:true,authorPrivateJudgment:true,
  syntheticRareMeaningNotAnExecutedFact:true,
  noOfficialSocialWrites:true,manualBrowserE2EStillRequired:true}));

/** A joined source/progression/Chronicle read in the genuine two-Game INT-B
 * fixture. Four-format progression is a separate isolated emulator run.
 * This is not real-browser/staging E2E, nor proof of executed rare conduct.
 */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {getMyPersonalityHistory} from '../lib/queries/getMyPersonalityHistory.js';
import {getMyPrivateChronicle} from '../lib/queries/getMyPrivateChronicle.js';
import {getMyChronicleInvitations,getMyChronicleSubmission} from '../lib/queries/chronicleInteractionService.js';
import {getMyHonoursPreview} from '../lib/queries/getMyHonoursPreview.js';
import {getMySocialProgression} from '../lib/queries/getMySocialProgression.js';
assert.equal(process.env.FUNCTIONS_EMULATOR,'true');
assert.equal(process.env.GCLOUD_PROJECT,'demo-aof-native-player');
process.env.AOF_CHRONICLE_INTERACTIONS_V1E='emulator-only';
process.env.AOF_HONOURS_PRIVATE_PREVIEW='source-v1';
process.env.AOF_SOCIAL_E2E_PRIVATE_PROGRESS='pilot-v1';
const owner='intb-owner-uid',other='intb-other-uid',outsider='intb-outsider';
const req=(uid,data={})=>({auth:{uid},data});
const [personality,chronicle,invites,honours,progression]=await Promise.all([
  getMyPersonalityHistory.run(req(owner)),
  getMyPrivateChronicle.run(req(owner)),
  getMyChronicleInvitations.run(req(owner)),
  getMyHonoursPreview.run(req(owner)),
  getMySocialProgression.run(req(owner)),
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
assert.equal(honours.ownerPlayerId,personality.ownerPlayerId);
assert.equal(honours.coverage.currentSources,personality.coverage.currentSources);
assert.equal(honours.honours.length,10);
assert.ok(honours.honours.every(h=>h.status==='PENDING'&&h.evidence.length===0),
  'Two genuine 1v1 Games plus synthetic private meaning cannot fabricate any honour');
assert.equal(honours.effects.entitlementGrants,false);
assert.deepEqual(honours.sources.map(s=>[s.battleId,s.gameId,s.seasonId,s.sourceHash,
  s.statisticsRevision,s.authorityRevision,s.resultRevision]),
  personality.sources.map(s=>[s.battleId,s.gameId,s.seasonId,s.sourceHash,
    s.statisticsRevision,s.authorityRevision,s.outcome.resultRevision]));
assert.equal(progression.ownerPlayerId,personality.ownerPlayerId);
assert.deepEqual(progression.sources,personality.sources);
assert.equal(progression.coverage.ownBattles,1);
assert.equal(progression.history.officialWrites,false);
assert.equal(progression.history.publicationAllowed,false);
assert.deepEqual(progression.history.receipts,[]);
assert.equal(progression.effects.entitlementGrants,false);
const submission=await getMyChronicleSubmission.run(req(owner,{battleId:'intb-controlled-series'}));
assert.equal(submission.authorPlayerId,personality.ownerPlayerId);
assert.equal(submission.publication,'NONE_PENDING_INDEPENDENT_QUALIFICATION');
const out=await getMyChronicleInvitations.run(req(outsider));
assert.equal(out.invitations.length,0);
const peer=await getMyChronicleInvitations.run(req(other));
assert.ok(peer.invitations.every(i=>i.respondentPlayerId==='intb-opponent-alias'));
await assert.rejects(getMyChronicleSubmission.run(req(outsider,{battleId:'intb-controlled-series'})));
await assert.rejects(getMyHonoursPreview.run({data:{}}),e=>e.code==='unauthenticated');
const strangerHonours=await getMyHonoursPreview.run(req(outsider));
assert.equal(strangerHonours.coverage.currentSources,0);
assert.ok(strangerHonours.honours.every(h=>h.status==='PENDING'&&h.evidence.length===0));
const report={acceptance:'AOF_SOL1B_COMBINED_PRIVATE_EMULATOR_1',
  joinedOriginalFormats:['1v1'],fourFormatProgression:'SEPARATE_ISOLATED_EMULATOR_RUN',
  socialProgressionJoinedToSameCurrentSources:true,
  sourceBoundSocialStageHandledBy:'INT_C2B_EXISTING_139',
  historicalOrderHandledBy:'APPROVED_EVENT_MATCHPLAN_GAME',
  authenticLongitudinalPersonalityPending:true,privateScenePresent:true,
  oneBattleTwoGames:true,authorPrivateJudgment:true,
  tenHonourPreviewJoinedToSameCurrentSources:true,authenticHonourQualificationPending:true,
  syntheticRareMeaningNotAnExecutedFact:true,
  noOfficialSocialWrites:true,manualBrowserE2EStillRequired:true};
mkdirSync('.replay-lab/social-e2e',{recursive:true});
writeFileSync('.replay-lab/social-e2e/sol1b-joined-read-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));

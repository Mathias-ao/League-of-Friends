import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import Ajv2020 from 'ajv/dist/2020.js';
import {SOCIAL_V1_CONTRACT, assertRecordInvariants, assertPublicationAllowed, invitationSlotId,
  chronicleSceneId, planInvitationOffer, transitionInvitation, publicJudgment} from '../lib/domain/socialV1.js';

const root = new URL('../../', import.meta.url);
const schema = JSON.parse(readFileSync(new URL('contracts/social-v1/shared.schema.json', root)));
const f = JSON.parse(readFileSync(new URL('contracts/social-v1/fixtures/conformance.json', root)));
const validate = new Ajv2020({strict:false, strictNumbers:true, allErrors:true}).compile(schema);
function valueFor(c) {
  const value = structuredClone(f.bases[c.recordType]);
  for (const patch of c.patch) {
    let parent = value;
    for (const key of patch.path.slice(0,-1)) parent = parent[key];
    parent[patch.path.at(-1)] = structuredClone(patch.value);
  }
  return value;
}
function check(kind, value) {
  assert.ok(validate({contract:SOCIAL_V1_CONTRACT, recordType:kind, value}), JSON.stringify(validate.errors));
  assertRecordInvariants(kind, value);
}
const report = [];
for (const c of f.cases) {
  const value = valueFor(c);
  let valid = true;
  try { check(c.recordType, value); } catch { valid = false; }
  let publication = null;
  if ('publication' in c) {
    try { check(c.recordType, value); assertPublicationAllowed(value, c.approvals ?? f.approvals); publication = true; }
    catch { publication = false; }
  }
  report.push({name:c.name, valid, publication});
  test(c.name, () => {
    assert.equal(valid, c.valid);
    if ('publication' in c) assert.equal(publication, c.publication);
  });
}

test('TypeScript declarations are generated from the exact canonical schema', () => {
  execFileSync(process.execPath, [fileURLToPath(new URL('contracts/social-v1/generate-types.mjs', root)), '--check']);
  // Compile every positive fixture against the actual declarations as well.
  const dir = mkdtempSync(join(tmpdir(), 'social-v1-types-'));
  try {
    const file = join(dir, 'fixtures.mts');
    writeFileSync(file, `import type {SocialV1Records} from ${JSON.stringify(fileURLToPath(new URL('functions/src/domain/socialV1.js', root)))};\n` +
      f.cases.filter(c => c.valid).map((c,n) => `const fixture${n}: SocialV1Records[${JSON.stringify(c.recordType)}] = ${JSON.stringify(valueFor(c))};`).join('\n'));
    try {
      execFileSync(process.execPath, [fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url)),
        '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext',
        '--typeRoots', fileURLToPath(new URL('../node_modules/@types', import.meta.url)), '--types', 'node', file], {cwd:dir});
    } catch (error) { throw new Error(error.stdout?.toString() || error.message); }
  } finally { rmSync(dir, {recursive:true, force:true}); }
});

test('Battle identities ignore Games, POVs, source revisions and prose versions', () => {
  for (const v of f.identityVectors) {
    assert.equal(invitationSlotId(v.battleId, v.owner), v.slotId);
    assert.equal(chronicleSceneId(v.battleId, v.owner, v.counterpart), v.sceneId);
  }
  const first = f.bases.SourceSnapshot, second = valueFor(f.cases.find(c => c.name === 'second-game-same-battle'));
  assert.equal(new Set([first, second, {...first, sourceHash:'b'.repeat(64)}].map(s => s.battleId)).size, 1);
  assert.notEqual(invitationSlotId('match-1', 'p1'), invitationSlotId('match-1', 'p2'));
  assert.notEqual(invitationSlotId('match-1', 'p1'), invitationSlotId('match-2', 'p1'));
});

function lifecycle() {
  const o = f.bases.Opportunity, a = f.approvals;
  const first = planInvitationOffer(null, o, 0, a);
  assert.ok(first.created);
  check('InvitationSlot', first.slot);
  const snapshots = [first];
  for (const state of ['OFFERED','DEFERRED','DECLINED','WITHDRAWN']) {
    let slot = snapshots.at(-1).slot;
    if (state !== 'OFFERED') slot = transitionInvitation(slot, slot.revision, o.opportunityRevision, state);
    snapshots.push({slot, created:false});
    check('InvitationSlot', slot);
    if (state === 'WITHDRAWN') assert.throws(() => planInvitationOffer(slot, o, slot.revision, a));
    else assert.deepEqual(planInvitationOffer(slot, o, slot.revision, a), {slot, created:false});
    // A new Game/incident/family or source correction never creates a second question.
    assert.throws(() => planInvitationOffer(slot, {...o, opportunityRevision:'b'.repeat(64),
      sourceAuthority:'b'.repeat(64), incidentId:'other-game-incident', family:'SITUATED_GRIEVANCE'}, slot.revision, a));
    assert.throws(() => transitionInvitation(slot, slot.revision, 'b'.repeat(64), 'SUBMITTED'));
  }
  assert.throws(() => planInvitationOffer(first.slot, o, 0, a)); // losing create/CAS transaction
  const submitted = transitionInvitation(first.slot, 1, o.opportunityRevision, 'SUBMITTED');
  assert.throws(() => transitionInvitation(submitted, submitted.revision, o.opportunityRevision, 'DEFERRED'));
  const withdrawn = transitionInvitation(submitted, submitted.revision, o.opportunityRevision, 'WITHDRAWN');
  assert.equal(withdrawn.firstOpportunityRevision, o.opportunityRevision);
  assert.throws(() => planInvitationOffer(withdrawn, o, withdrawn.revision, a));
  return snapshots;
}
test('durable invitation slot survives retry, contention, decline and corrections', lifecycle);

test('public testimony contains resolved choices only, with attribution', () => {
  const output = publicJudgment(f.bases.Judgment, f.approvals);
  assert.deepEqual(output, f.bases.PublicJudgment);
  check('PublicJudgment', output);
  assert.ok(!JSON.stringify(output).includes('PRIVATE'));
  assert.ok(!JSON.stringify(output).includes('private-pending'));
  for (const correction of ['REOPENED','SUPERSEDED'])
    assert.equal(publicJudgment({...f.bases.Judgment, correction}, f.approvals), null);
  assert.equal(publicJudgment({...f.bases.Judgment, choices:[f.bases.Judgment.choices[1]]}, f.approvals), null);
});

test('non-finite numbers never enter the JSON contract', () => {
  for (const value of [NaN, Infinity, -Infinity]) assert.throws(() => check('Observation', {...f.bases.Observation, value}));
});

test('Python and TypeScript agree on records, publication, identities, privacy and lifecycle', {
  skip:!process.env.AOF_SOCIAL_CONFORMANCE_PYTHON && 'Dedicated Social Contract CI runs both languages',
}, () => {
  const python = JSON.parse(execFileSync(process.env.AOF_SOCIAL_CONFORMANCE_PYTHON,
    [fileURLToPath(new URL('replay-tools/tests/test_social_v1_contract.py', root)), '--report'], {encoding:'utf8'}));
  assert.deepEqual(python, {cases:report, identities:f.identityVectors.map(v => ({
    slotId:invitationSlotId(v.battleId,v.owner), sceneId:chronicleSceneId(v.battleId,v.owner,v.counterpart)})),
    publicJudgment:publicJudgment(f.bases.Judgment,f.approvals), lifecycle:lifecycle()});
});

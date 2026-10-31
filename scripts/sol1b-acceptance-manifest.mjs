/** Provenance for the combined CI run, never a browser or release certificate. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const head=git('rev-parse','HEAD');
assert.match(head,/^[a-f0-9]{40}$/);
assert.equal(head,process.env.AOF_ACCEPTANCE_EXPECTED_HEAD,'CI must check out the exact requested head');
assert.match(process.env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION??'',/^[a-f0-9]{64}$/);
assert.ok(process.env.AOF_NATIVE_CORPUS,'Pinned original recording corpus is required');
const fixtureCommit='2d04ec6adbe871d156c108a4351448efeb08f4e6';
const honoursCommit='61f545d901b2f35e92bd133e614519a20eeb4235';
assert.equal(execFileSync('git',['-C','.fixture-corpus','rev-parse','HEAD'],{encoding:'utf8'}).trim(),fixtureCommit);
assert.equal(execFileSync('git',['-C','.honours-sandbox','rev-parse','HEAD'],{encoding:'utf8'}).trim(),honoursCommit);
const formats={'1v1_t90-deak':'1v1','1v1_t90-dobb':'1v1','2v2_arabia':'2v2','4v4_arabia':'4v4','FFA_7':'FFA'};
const recordings=Object.entries(formats).map(([name,format])=>{
  const bytes=readFileSync(join(process.env.AOF_NATIVE_CORPUS,name+'.aoe2record'));
  return {name,format,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
});
const report={version:'AOF_SOL1B_ACCEPTANCE_MANIFEST_1',testedHead:head,
  testedTree:git('rev-parse','HEAD^{tree}'),releaseBase:'1c602cf682fb61718a0e68bde2d383f80f50ac57',
  processorRevision:process.env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION,
  fixtureCommit,recordings,isolatedHonoursPolicyCommit:honoursCommit,
  runtimeHonoursSandboxImported:false,
  evidenceKinds:{recordingBytes:'ORIGINAL_RECORDINGS',leagueMapping:'CONTROLLED_EMULATOR',
    rareIncidentMeaning:'CONTROLLED_FIXTURE',trophySuccession:'POLICY_SIMULATION',
    componentViews:'JSDOM',realBrowser:'UNTESTED',performanceP95:'UNPROVEN'},
  productionActivation:false,officialGrants:false};
mkdirSync('.replay-lab/social-e2e',{recursive:true});
writeFileSync('.replay-lab/social-e2e/sol1b-source-manifest.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));

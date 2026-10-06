import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
test('Replay Lab serves real source-backed incidents without changing saved statistics',async()=>{
 const home=await fs.mkdtemp(path.join(os.tmpdir(),'aof-social-server-'));
 const file=new URL('../../functions/tests/fixtures/social-ffa-diplo.json',import.meta.url);
 const original=await fs.readFile(file,'utf8');
 await fs.mkdir(path.join(home,'fixture'));await fs.writeFile(path.join(home,'fixture','statistics-current.json'),original);
 await fs.writeFile(path.join(home,'fixture','metadata.json'),JSON.stringify({id:'fixture',status:'READY',statisticsRevision:1}));
 const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;
 await new Promise(resolve=>socket.close(resolve));
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,AOF_REPLAY_LAB_HOME:home,AOF_REPLAY_LAB_PORT:String(port)},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
 try {
  let ready=false;for(let n=0;n<100;n++){try{ready=(await fetch(`http://127.0.0.1:${port}/api/health`)).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,30));}
  assert.ok(ready,output);
  const response=await fetch(`http://127.0.0.1:${port}/api/runs/fixture`);assert.equal(response.status,200);
  const run=await response.json();assert.equal(run.socialIncidents.status,'REVIEW_AVAILABLE');assert.equal(run.socialIncidents.counters.directedCommands,83);
  assert.equal(run.socialIncidents.incidents.find(i=>i.moment.atMs===3474878).role,'RESPONSE_AFTER_WITHDRAWAL');
  assert.deepEqual(run.statistics,JSON.parse(original));assert.equal(await fs.readFile(path.join(home,'fixture','statistics-current.json'),'utf8'),original);
  const shared=await fetch(`http://127.0.0.1:${port}/social-incident-core.js`);assert.equal(shared.status,200);assert.match(await shared.text(),/projectSocialIncidents/);
 } finally {child.kill();await once(child,'exit');await fs.rm(home,{recursive:true,force:true});}
});

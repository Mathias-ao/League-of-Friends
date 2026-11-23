import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Actual repository method; no SDK construction, real popup or network.
const source=readFileSync(new URL('../src/data/FirebaseLeagueRepository.ts',import.meta.url),'utf8')
  .replace(/^import .*;\n/gm,'').replace('export class FirebaseLeagueRepository','class FirebaseLeagueRepository')
  .replaceAll('import.meta.env','environment');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const callbackOrigin='https://europe-west1-age-of-friends-staging-eu.cloudfunctions.net';
function fixture({tokenError=false,startError=false,blocked=false}={}){
  const listeners=new Map<string,(event:any)=>void>(),tokens:string[]=[];
  let interval=()=>{},timeout=()=>{},opens=0;
  const popup={closed:false,document:{title:'',body:{textContent:''}},location:{href:''},close(){this.closed=true;}};
  const win={open:()=>{opens++;return blocked?null:popup;}};
  const Repository=new Function('environment','window','signInWithCustomToken','addEventListener','removeEventListener',
    'setTimeout','clearTimeout','setInterval','clearInterval',compiled+';return FirebaseLeagueRepository;')(
    {VITE_FIREBASE_PROJECT_ID:'age-of-friends-staging-eu',VITE_USE_EMULATORS:'false'},win,
    async(_auth:unknown,token:string)=>{tokens.push(token);if(tokenError)throw Error('Controlled Firebase token rejection');},
    (name:string,fn:(event:any)=>void)=>listeners.set(name,fn),(name:string)=>listeners.delete(name),
    (fn:()=>void)=>{timeout=fn;return 1;},()=>{},(fn:()=>void)=>{interval=fn;return 2;},()=>{});
  const repository=Object.create(Repository.prototype);
  repository.auth={};repository.ready=Promise.resolve();
  repository.call=async(name:string)=>{assert.equal(name,'beginSteamSignIn');if(startError)throw Error('Controlled Steam session failure');
    return {authUrl:'https://steamcommunity.com/openid/login?controlled',callbackOrigin};};
  return {repository,popup,tokens,listeners,opens:()=>opens,
    emit:(origin=callbackOrigin,source:unknown=popup,payload={type:'aof-steam-auth',token:'controlled-custom-token'})=>
      listeners.get('message')?.({origin,source,data:payload}),cancel:()=>{popup.closed=true;interval();},expire:()=>timeout()};
}
const started=()=>new Promise<void>(resolve=>setImmediate(resolve));

test('EU Steam popup accepts only its exact callback window/origin before Firebase custom-token sign-in',async()=>{
  const f=fixture(),signing=f.repository.signIn();await started();
  assert.equal(f.opens(),1);assert.match(f.popup.location.href,/steamcommunity.com/);
  f.emit('https://europe-west1-age-of-friends-staging.cloudfunctions.net');
  f.emit(callbackOrigin,{});assert.deepEqual(f.tokens,[]);
  f.emit();await signing;assert.deepEqual(f.tokens,['controlled-custom-token']);
  assert.equal(f.popup.closed,true);assert.equal(f.listeners.size,0);
});

test('Firebase readiness, Steam session and token failures propagate while cleaning up the popup',async()=>{
  const notReady=fixture();notReady.repository.ready=Promise.reject(Error('Controlled Firebase Auth readiness failure'));
  await assert.rejects(notReady.repository.signIn(),/Auth readiness failure/);assert.equal(notReady.opens(),0);
  const start=fixture({startError:true});await assert.rejects(start.repository.signIn(),/Steam session failure/);
  assert.equal(start.popup.closed,true);
  const token=fixture({tokenError:true}),signing=token.repository.signIn();await started();token.emit();
  await assert.rejects(signing,/Firebase token rejection/);assert.equal(token.popup.closed,true);assert.equal(token.listeners.size,0);
});

test('blocked, cancelled and timed-out Steam sessions never exchange a Firebase token',async()=>{
  await assert.rejects(fixture({blocked:true}).repository.signIn(),/blocked/);
  for(const operation of ['cancel','expire'] as const){
    const f=fixture(),signing=f.repository.signIn();await started();
    const rejected=assert.rejects(signing,operation==='cancel'?/cancelled/:/timed out/);f[operation]();await rejected;
    assert.deepEqual(f.tokens,[]);assert.equal(f.listeners.size,0);assert.equal(f.popup.closed,true);
  }
});

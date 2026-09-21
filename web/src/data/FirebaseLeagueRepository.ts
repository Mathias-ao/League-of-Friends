import {initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,browserLocalPersistence,setPersistence,signInWithPopup,signOut,onAuthStateChanged,connectAuthEmulator} from 'firebase/auth';
import {getFunctions,httpsCallable,connectFunctionsEmulator} from 'firebase/functions';
import {connectFirestoreEmulator,doc,getFirestore,onSnapshot} from 'firebase/firestore';
import {emptySnapshot,type LeagueRepository,type LeagueSnapshot,type Membership,type PlayerRecord,type EventRecord,type EventDetail,type MatchDetail,type PlayerProfile,type EmperorsFavorBatch,type ReplayUploadResult,type ReplayStatisticsResult} from '../domain/league';
export class FirebaseLeagueRepository implements LeagueRepository {
  readonly mode='live' as const;
  private app=initializeApp({apiKey:import.meta.env.VITE_FIREBASE_API_KEY,authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID,appId:import.meta.env.VITE_FIREBASE_APP_ID});
  private auth=getAuth(this.app);
  private functions=getFunctions(this.app,import.meta.env.VITE_FIREBASE_REGION||'europe-west1');
  private firestore=getFirestore(this.app);
  private ready:Promise<void>;
  constructor(){
    if(import.meta.env.VITE_USE_EMULATORS==='true'){
      connectAuthEmulator(this.auth,'http://127.0.0.1:9099',{disableWarnings:true});
      connectFunctionsEmulator(this.functions,'127.0.0.1',5001);
      connectFirestoreEmulator(this.firestore,'127.0.0.1',8085);
    }
    this.ready=setPersistence(this.auth,browserLocalPersistence).then(()=>this.auth.authStateReady());
  }
  private async call<T>(name:string,data:unknown={}):Promise<T>{return (await httpsCallable<unknown,T>(this.functions,name)(data)).data;}
  async load():Promise<LeagueSnapshot>{
    await this.ready;
    const empty=emptySnapshot();if(!this.auth.currentUser)return empty;
    const member=await this.call<{status:Membership;player:PlayerRecord|null}>('getMyMembership');
    if(member.status!=='ACTIVE')return {...empty,membership:member.status,viewer:member.player};
    const [bootstrap,directory]=await Promise.all([
      this.call<{viewer:PlayerRecord;activeSeason:LeagueSnapshot['season'];emperor:PlayerRecord|null;leaderboard:PlayerRecord[];upcomingEvent:EventRecord|null}>('getLeagueBootstrap'),
      this.call<{players:PlayerRecord[];events:EventRecord[];matches:LeagueSnapshot['matches'];enteredSeason:boolean;hasLeagueHistory:boolean}>('getPlayerSiteDirectory')
    ]);
    return {membership:'ACTIVE',viewer:bootstrap.viewer,season:bootstrap.activeSeason,emperor:bootstrap.emperor,standings:bootstrap.leaderboard,players:directory.players,matches:directory.matches,enteredSeason:directory.enteredSeason,hasLeagueHistory:directory.hasLeagueHistory??false,events:directory.events.map(e=>e.eventId===bootstrap.upcomingEvent?.eventId?{...e,...bootstrap.upcomingEvent}:e)};
  }
  async signIn(){await this.ready;await signInWithPopup(this.auth,new GoogleAuthProvider());}
  async signOut(){await signOut(this.auth);}
  async requestMembership(steamName:string,discordName:string,favor:string){await this.call('requestLeagueMembership',{steamName,discordName,favor});}
  generateEmperorsFavors(batchName:string,count:number){return this.call<EmperorsFavorBatch>('adminGenerateEmperorsFavors',{batchName,count});}
  async enterSeason(seasonId:string){await this.call('enterSeason',{seasonId});}
  async rsvp(eventId:string,rsvp:'YES'|'NO'){await this.call('setEventRsvp',{eventId,rsvp});}
  async checkIn(eventId:string){await this.call('checkInToEvent',{eventId});}
  async formEventMatches(eventId:string){const plan=await this.call<{planId:string}>('adminGenerateMatchPlan',{requestId:crypto.randomUUID(),eventId});await this.call('adminApproveMatchPlan',{requestId:crypto.randomUUID(),eventId,planId:plan.planId});}
  async ensureCivilizationDraft(matchId:string,gameId:string){await this.call('ensureCivilizationDraft',{matchId,gameId});}
  async pickCivilization(matchId:string,gameId:string,civilization:string){await this.call('makeCivilizationDraftPick',{matchId,gameId,civilization});}
  async resetCivilizationDraft(matchId:string,gameId:string,reason:string,rerollOrder:boolean){await this.call('adminResetCivilizationDraft',{requestId:crypto.randomUUID(),matchId,gameId,reason,rerollOrder});}
  async uploadReplay(matchId:string,gameId:string,file:File):Promise<ReplayUploadResult>{
    const bytes=new Uint8Array(await file.arrayBuffer());
    let binary='';
    const chunk=0x8000;
    for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
    const replayBase64=btoa(binary);
    return (await httpsCallable<unknown,ReplayUploadResult>(this.functions,'uploadReplay',{timeout:300000})({matchId,gameId,fileName:file.name,replayBase64})).data;
  }
  replayStatistics(matchId:string,gameId:string){return this.call<ReplayStatisticsResult>('getReplayStatistics',{matchId,gameId});}
  watchCivilizationDraft(matchId:string,gameId:string,callback:()=>void){
    let initial=true;
    return onSnapshot(
      doc(this.firestore,'matches',matchId,'civilizationDrafts',gameId),
      ()=>{
        if(initial){initial=false;return;}
        callback();
      },
      ()=>{}
    );
  }
  event(eventId:string){return this.call<EventDetail>('getEventDetail',{eventId});}
  match(matchId:string){return this.call<MatchDetail>('getMatchDetail',{matchId});}
  player(playerId:string){return this.call<PlayerProfile>('getPlayerProfile',{playerId});}
  async dispute(matchId:string,gameId:string,category:string,reason:string){await this.call('disputeCanonicalGameResult',{requestId:crypto.randomUUID(),matchId,gameId,category,reason});}
  onAuthChange(callback:()=>void){return onAuthStateChanged(this.auth,()=>callback());}
}

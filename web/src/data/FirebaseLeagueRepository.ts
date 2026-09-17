import {initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,browserLocalPersistence,setPersistence,signInWithPopup,signOut,onAuthStateChanged,connectAuthEmulator} from 'firebase/auth';
import {getFunctions,httpsCallable,connectFunctionsEmulator} from 'firebase/functions';
import {emptySnapshot,type LeagueRepository,type LeagueSnapshot,type Membership,type PlayerRecord,type EventRecord,type EventDetail,type MatchDetail,type PlayerProfile} from '../domain/league';
export class FirebaseLeagueRepository implements LeagueRepository {
  readonly mode='live' as const;
  private app=initializeApp({apiKey:import.meta.env.VITE_FIREBASE_API_KEY,authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID,appId:import.meta.env.VITE_FIREBASE_APP_ID});
  private auth=getAuth(this.app);
  private functions=getFunctions(this.app,import.meta.env.VITE_FIREBASE_REGION||'europe-west1');
  private ready:Promise<void>;
  constructor(){
    if(import.meta.env.VITE_USE_EMULATORS==='true'){
      connectAuthEmulator(this.auth,'http://127.0.0.1:9099',{disableWarnings:true});
      connectFunctionsEmulator(this.functions,'127.0.0.1',5001);
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
      this.call<{viewer:PlayerRecord;activeSeason:LeagueSnapshot['season'];leaderboard:PlayerRecord[];upcomingEvent:EventRecord|null}>('getLeagueBootstrap'),
      this.call<{players:PlayerRecord[];events:EventRecord[];matches:LeagueSnapshot['matches'];enteredSeason:boolean;hasLeagueHistory:boolean}>('getPlayerSiteDirectory')
    ]);
    return {membership:'ACTIVE',viewer:bootstrap.viewer,season:bootstrap.activeSeason,standings:bootstrap.leaderboard,players:directory.players,matches:directory.matches,enteredSeason:directory.enteredSeason,hasLeagueHistory:directory.hasLeagueHistory??false,events:directory.events.map(e=>e.eventId===bootstrap.upcomingEvent?.eventId?{...e,...bootstrap.upcomingEvent}:e)};
  }
  async signIn(){await this.ready;await signInWithPopup(this.auth,new GoogleAuthProvider());}
  async signOut(){await signOut(this.auth);}
  async requestMembership(steamName:string,discordName:string){await this.call('requestLeagueMembership',{steamName,discordName});}
  async enterSeason(seasonId:string){await this.call('enterSeason',{seasonId});}
  async rsvp(eventId:string,rsvp:'YES'|'NO'){await this.call('setEventRsvp',{eventId,rsvp});}
  async checkIn(eventId:string){await this.call('checkInToEvent',{eventId});}
  event(eventId:string){return this.call<EventDetail>('getEventDetail',{eventId});}
  match(matchId:string){return this.call<MatchDetail>('getMatchDetail',{matchId});}
  player(playerId:string){return this.call<PlayerProfile>('getPlayerProfile',{playerId});}
  async dispute(matchId:string,gameId:string,category:string,reason:string){await this.call('disputeCanonicalGameResult',{requestId:crypto.randomUUID(),matchId,gameId,category,reason});}
  onAuthChange(callback:()=>void){return onAuthStateChanged(this.auth,()=>callback());}
}

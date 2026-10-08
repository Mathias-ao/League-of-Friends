import {Timestamp} from 'firebase-admin/firestore';
import {db} from '../config/firebase.js';
export const normalizeReplayName=(name:string)=>name.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');
export function steamNameHistory(previous:any,current:string):string[] {
  return [...new Set([...(previous?.steamNameHistory??[]),...(previous?.steamPersonaName&&previous.steamPersonaName!==current?[previous.steamPersonaName]:[])].filter(n=>typeof n==='string'&&n&&n!==current))].slice(-100);
}
const validName=(value:any)=>typeof value==='string'&&value.trim().length>0&&value.length<=100?value.trim():null;
const xmlText=(value:string)=>{
  const cdata=value.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);if(cdata)return cdata[1];
  return value.replace(/&(amp|lt|gt|quot|apos);/g,(_,n)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[n as 'amp'])).replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(raw,n)=>{const code=n[0].toLowerCase()==='x'?Number.parseInt(n.slice(1),16):Number(n);return code>0&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff)?String.fromCodePoint(code):raw;});
};
/** Names come only from Steam for the authenticated immutable SteamID64.
 * The API is preferred; the bounded Community XML fallback avoids making the
 * existing sign-in depend on deployment of a new secret. A profile outage never
 * substitutes the user-entered league alias for a verified Steam persona. */
export async function fetchSteamProfile(steamId64:string):Promise<{steamPersonaName:string;avatarUrl:string|null}|null> {
  if(!/^\d{17}$/.test(steamId64))return null;
  try {
    const key=process.env.STEAM_WEB_API_KEY;
    if(key) {
      const url=new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/');url.searchParams.set('key',key);url.searchParams.set('steamids',steamId64);
      const response=await fetch(url,{signal:AbortSignal.timeout(5000)});
      if(response.ok){const data:any=await response.json(),player=data.response?.players?.find((p:any)=>p.steamid===steamId64),name=validName(player?.personaname);if(name)return {steamPersonaName:name,avatarUrl:typeof player.avatarfull==='string'?player.avatarfull:null};}
    }
    const response=await fetch('https://steamcommunity.com/profiles/'+steamId64+'/?xml=1',{signal:AbortSignal.timeout(5000)});
    if(!response.ok)return null;
    const xml=await response.text();if(xml.length>128000||/<!(DOCTYPE|ENTITY)/i.test(xml)||xml.match(/<steamID64>(\d+)<\/steamID64>/)?.[1]!==steamId64)return null;
    const name=validName(xmlText(xml.match(/<steamID>([\s\S]*?)<\/steamID>/)?.[1]??''));
    return name?{steamPersonaName:name,avatarUrl:null}:null;
  }catch{return null;}
}
export async function refreshSteamProfile(steamId64:string) {
  const profile=await fetchSteamProfile(steamId64);if(!profile)return;
  await db.runTransaction(async tx=>{
    const profileRef=db.collection('steamProfiles').doc(steamId64),link=await tx.get(db.collection('authLinks').doc('steam:'+steamId64));
    const playerRef=link.data()?.playerId?db.collection('players').doc(link.data()!.playerId):null;
    const previous=playerRef?(await tx.get(playerRef)).data():null;
    const now=Timestamp.now();
    tx.set(profileRef,{steamId64,...profile,verifiedAt:now});
    if(playerRef&&previous?.steamId64===steamId64)tx.update(playerRef,{leagueAlias:previous.leagueAlias??previous.steamName,...profile,steamIdentityVersion:'AOF_STEAM_IDENTITY_V1',steamNameHistory:steamNameHistory(previous,profile.steamPersonaName),steamNameNormalized:normalizeReplayName(profile.steamPersonaName),steamProfileVerifiedAt:now,updatedAt:now});
  });
}

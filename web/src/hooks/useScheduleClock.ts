import {useEffect,useState} from 'react';
/** Refresh at schedule boundaries, including when a suspended tab becomes visible. */
export function useScheduleClock(boundaries:Array<string|null|undefined>){
 const [now,setNow]=useState(Date.now);
 const key=boundaries.join('|');
 useEffect(()=>{
  const refresh=()=>setNow(Date.now());
  const next=key.split('|').map(Date.parse).filter(ms=>Number.isFinite(ms)&&ms>=Date.now()).sort((a,b)=>a-b)[0];
  const timer=next===undefined?undefined:setTimeout(refresh,Math.min(2147483647,Math.max(1,next-Date.now()+1)));
  const interval=setInterval(refresh,30000);
  window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  return ()=>{clearTimeout(timer);clearInterval(interval);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[key,now]);
 return now;
}

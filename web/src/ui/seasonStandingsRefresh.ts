/** A small foreground reconciliation window for async result processing.
 * Five reads over 110 seconds, never overlapping; returning to the page starts
 * another bounded window. No Firestore permission or polling flag is widened.
 */
export const SEASON_REFRESH_DELAYS_MS=[5000,10000,20000,30000,45000] as const;
type Timer=ReturnType<typeof setTimeout>|number;
interface RefreshOptions {
  refresh:()=>Promise<unknown>;
  visible:()=>boolean;
  available:()=>boolean;
  now?:()=>number;
  setTimer?:(callback:()=>void,ms:number)=>Timer;
  clearTimer?:(timer:Timer)=>void;
}
export function startSeasonStandingsRefresh(options:RefreshOptions){
  const setTimer=options.setTimer??setTimeout,clearTimer=options.clearTimer??clearTimeout;
  const now=options.now??Date.now;
  let stopped=false,inFlight=false,index=0,lastWake=-Infinity;
  let timer:Timer|null=null;
  const cancel=()=>{if(timer!==null){clearTimer(timer);timer=null;}};
  const schedule=()=>{
    if(stopped||timer!==null||index>=SEASON_REFRESH_DELAYS_MS.length||!options.visible())return;
    timer=setTimer(()=>{timer=null;index++;void run();},SEASON_REFRESH_DELAYS_MS[index]);
  };
  const run=async()=>{
    if(stopped||inFlight)return;
    if(!options.visible()||!options.available()){schedule();return;}
    inFlight=true;
    try{await options.refresh();}catch{/* App's refresh reports errors and enforces auth. */}
    finally{inFlight=false;if(!stopped)schedule();}
  };
  const wake=()=>{
    if(stopped||!options.visible()||now()-lastWake<10000)return;
    lastWake=now();index=0;cancel();
    if(inFlight)return;
    void run();
  };
  schedule();
  return {wake,stop(){stopped=true;cancel();}};
}

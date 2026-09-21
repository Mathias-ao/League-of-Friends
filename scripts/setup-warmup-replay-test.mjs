import { randomUUID } from "node:crypto";

const args=process.argv.slice(2);
const readArg=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
const projectId=readArg("--project")??"demo-aof-replay";
const opponentName=readArg("--opponent")??"Player 8";
const email=process.env.AOF_EMULATOR_ADMIN_EMAIL;
const password=process.env.AOF_EMULATOR_ADMIN_PASSWORD;
if(!email||!password){
  console.error("Set AOF_EMULATOR_ADMIN_EMAIL and AOF_EMULATOR_ADMIN_PASSWORD before running this emulator-only setup.");
  process.exit(1);
}

const authBase="http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const functionsBase=`http://127.0.0.1:5001/${projectId}/europe-west1`;

async function parse(response,label){
  const text=await response.text();
  let payload;
  try{payload=JSON.parse(text);}catch{throw new Error(`${label} returned non-JSON (${response.status}): ${text}`);}
  if(!response.ok||payload.error)throw new Error(`${label} failed: ${JSON.stringify(payload)}`);
  return payload;
}
async function signIn(){
  const response=await fetch(`${authBase}/accounts:signInWithPassword?key=fake-api-key`,{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({email,password,returnSecureToken:true})
  });
  return (await parse(response,"Emperor sign-in")).idToken;
}
async function call(name,token,data={}){
  const response=await fetch(`${functionsBase}/${name}`,{
    method:"POST",
    headers:{"content-type":"application/json",authorization:`Bearer ${token}`},
    body:JSON.stringify({data})
  });
  return (await parse(response,name)).result;
}
const normalize=value=>String(value??"").normalize("NFKC").trim().replace(/\s+/g," ").toLocaleLowerCase("en-US");

try{
  const token=await signIn();
  const [health,bootstrap,directory]=await Promise.all([
    call("backendHealth",token),
    call("getLeagueBootstrap",token),
    call("getPlayerSiteDirectory",token)
  ]);
  if(health.role!=="ADMIN")throw new Error("The emulator Emperor account is not an administrator.");
  if(!bootstrap.activeSeason?.seasonId)throw new Error("Create/activate an emulator Season first.");

  const matches=(directory.players??[]).filter(player=>normalize(player.steamName)===normalize(opponentName));
  if(matches.length!==1){
    const names=(directory.players??[]).map(player=>player.steamName).join(", ");
    throw new Error(`Expected exactly one active player named '${opponentName}'. Available players: ${names||"(none)"}`);
  }
  const opponent=matches[0];
  if(opponent.playerId===health.playerId)throw new Error("Opponent resolved to the Emperor.");

  await call("enterSeason",token,{seasonId:bootstrap.activeSeason.seasonId});

  const now=Date.now();
  const created=await call("adminCreateEvent",token,{
    requestId:randomUUID(),
    title:"Replay Warmup — Emulator",
    description:"Player acceptance test: Emperor vs Player 8, ending with a real .aoe2record upload.",
    startsAt:new Date(now+30*60*1000).toISOString(),
    endsAt:new Date(now+3*60*60*1000).toISOString(),
    signupDeadlineAt:new Date(now+20*60*1000).toISOString(),
    checkInOpensAt:new Date(now-5*60*1000).toISOString(),
    minParticipants:2,
    maxParticipants:2,
    waitingListEnabled:false,
    signupRosterVisibility:"VISIBLE",
    competitionStyle:"ONE_V_ONE",
    planningConfig:{prioritizeLargestTeams:false,preferredTeamSize:null,allowAsymmetricTeams:false,philosophy:"BALANCED",balanceWeight:1},
    gameConfig:{
      maps:{pool:["Arabia"],selectionMode:"ADMIN"},
      civilizations:{mode:"UNRESTRICTED",allowed:[],banned:[],customRuleCode:null},
      victory:{conquest:true,wonder:false,relic:false,customRuleCode:null},
      diplomacyEnabled:false,
      additionalSettings:{purpose:"REPLAY_WARMUP_ACCEPTANCE_TEST"}
    },
    scoringSnapshot:{profileId:null,profileVersion:1,rules:{}},
    goldRewardSnapshot:{attendance:0,matchCompletion:0,matchWin:0,additionalRewards:{}},
    replayParticipantBindings:[
      {sourceName:"T90Official",playerId:health.playerId},
      {sourceName:"Mr Greed",playerId:opponent.playerId}
    ]
  });

  await call("adminPublishEvent",token,{requestId:randomUUID(),eventId:created.eventId,featured:true});
  await call("seedReplayWarmupOpponent",token,{eventId:created.eventId,playerId:opponent.playerId});

  console.log("Warmup replay acceptance test is prepared.");
  console.log(`Event: ${created.eventId}`);
  console.log(`Emperor: ${health.playerId} <- replay T90Official`);
  console.log(`Opponent: ${opponent.playerId} (${opponent.steamName}) <- replay Mr Greed`);
  console.log("");
  console.log("Next in the website:");
  console.log("  1. Open the featured Replay Warmup event as the Emperor.");
  console.log("  2. RSVP YES, then Check in now. Player 8 is already checked in.");
  console.log("  3. Use the Emperor-only Form warm-up battle action.");
  console.log("  4. Open the 1v1 Battle and upload replay-fixtures/1v1_1.aoe2record.");
}catch(error){
  console.error(error instanceof Error?error.message:error);
  process.exit(1);
}

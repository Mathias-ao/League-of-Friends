import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const args=process.argv.slice(2);
const readArg=name=>{const index=args.indexOf(name);return index>=0?args[index+1]:undefined;};
const projectId=readArg('--project')??process.env.GCLOUD_PROJECT??process.env.GOOGLE_CLOUD_PROJECT;
const emulatorHost=process.env.FIRESTORE_EMULATOR_HOST??'';

if(!projectId){
  console.error('Usage: FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 node functions/scripts/seed-relationship-review.mjs --project <project-id>');
  process.exit(1);
}
if(!/^(127\.0\.0\.1|localhost):\d+$/.test(emulatorHost)){
  console.error('Refusing to run: FIRESTORE_EMULATOR_HOST must point at localhost. This fixture must never write to production Firestore.');
  process.exit(1);
}

const app=initializeApp({projectId});
const db=getFirestore(app);
const opponentId='relationship-review-rival';

try{
  const playersSnapshot=await db.collection('players').get();
  const admin=playersSnapshot.docs.find(document=>{
    const data=document.data();
    return data.role==='ADMIN'&&data.membershipStatus==='ACTIVE';
  });
  if(!admin)throw new Error('No ACTIVE administrator exists. Run scripts/bootstrap-emulator-admin.mjs first.');

  const playerOneId=[admin.id,opponentId].sort()[0];
  const playerTwoId=[admin.id,opponentId].sort()[1];
  const pairId=`${playerOneId}__${playerTwoId}`;
  const now=Date.now();
  const daysAgo=days=>now-days*24*60*60*1000;

  await db.collection('players').doc(opponentId).set({
    steamName:'Review Rival',
    steamNameNormalized:'review rival',
    discordName:null,
    avatarUrl:null,
    membershipStatus:'ACTIVE',
    role:'PLAYER',
    currentPowerRating:null,
    powerRatingGames:0,
    powerRatingAlgorithmVersion:null,
    provisionalRating:true,
    goldBalance:0,
    updatedAt:Timestamp.now(),
  },{merge:true});

  const chronicle=[
    {
      entryId:'review-chronicle-4',matchId:'REVIEW-BATTLE-04',eventId:'REVIEW-EVENT',seasonId:null,playedAtMs:daysAgo(2),kind:'OPPOSED_NO_CONTACT',
      title:'The quarrel went quiet',
      text:'They met again as opponents. With interaction coverage available, no qualifying direct pair contact was recorded.',
      relation:'OPPOSED',tracksTouched:['RIVALRY','HOSTILITY'],
    },
    {
      entryId:'review-chronicle-3',matchId:'REVIEW-BATTLE-03',eventId:'REVIEW-EVENT',seasonId:null,playedAtMs:daysAgo(9),kind:'OPPOSED_CONTACT',
      title:'The contest was answered',
      text:'Both players recorded qualifying directed pressure during the Battle. The contest was reciprocal.',
      relation:'OPPOSED',tracksTouched:['RIVALRY','HOSTILITY'],
    },
    {
      entryId:'review-chronicle-2',matchId:'REVIEW-BATTLE-02',eventId:'REVIEW-EVENT',seasonId:null,playedAtMs:daysAgo(16),kind:'ALLIED_COOPERATION',
      title:'Aid under one banner',
      text:'They recorded qualifying cooperative action while fighting on the same side.',
      relation:'ALLIED',tracksTouched:['HOSTILITY','BOND'],
    },
    {
      entryId:'review-chronicle-1',matchId:'REVIEW-BATTLE-01',eventId:'REVIEW-EVENT',seasonId:null,playedAtMs:daysAgo(23),kind:'FIRST_OPPOSED',
      title:'First meeting across the battlefield',
      text:'Their first recorded encounter placed them on opposing sides.',
      relation:'OPPOSED',tracksTouched:[],
    },
  ];

  await db.collection('relationships').doc(pairId).set({
    schemaVersion:'AOF_PAIR_HISTORY_V2',
    pairId,
    playerOneId,
    playerTwoId,
    relationshipEngineVersion:'AOF_RELATIONSHIP_ENGINE_V2',
    relationshipRuleVersion:'AOF_REVIEW_FIXTURE_ONLY',
    relationshipRulesConfigured:true,
    interactionCoverage:'AVAILABLE',
    relationship:{
      engineVersion:'AOF_RELATIONSHIP_ENGINE_V2',
      pairId,
      playerOneId,
      playerTwoId,
      rivalry:{track:'RIVALRY',status:'READY',state:'DORMANT',stageId:'Rivalry',historicalPeakStageId:'Nemesis'},
      hostility:{track:'HOSTILITY',status:'READY',state:'DORMANT',stageId:'Grudge',historicalPeakStageId:'Feud'},
      bond:{track:'BOND',status:'READY',state:'ACTIVE',stageId:'Fellowship',historicalPeakStageId:'Trusted Allies'},
      pulses:[],
    },
    chronicle,
    updatedAt:Timestamp.now(),
    reviewFixture:true,
  },{merge:true});

  await admin.ref.collection('opponentStats').doc(opponentId).set({
    otherPlayerId:opponentId,matchesTogether:3,wins:1,losses:2,
    firstMatchId:'REVIEW-BATTLE-01',lastMatchId:'REVIEW-BATTLE-04',
    firstPlayedAt:Timestamp.fromMillis(daysAgo(23)),lastPlayedAt:Timestamp.fromMillis(daysAgo(2)),
  },{merge:true});
  await admin.ref.collection('teammateStats').doc(opponentId).set({
    otherPlayerId:opponentId,matchesTogether:1,wins:1,losses:0,
    firstMatchId:'REVIEW-BATTLE-02',lastMatchId:'REVIEW-BATTLE-02',
    firstPlayedAt:Timestamp.fromMillis(daysAgo(16)),lastPlayedAt:Timestamp.fromMillis(daysAgo(16)),
  },{merge:true});

  console.log('Relationship Chronicle review fixture is ready.');
  console.log(`Administrator: ${admin.id} (${admin.data().steamName})`);
  console.log(`Review player: ${opponentId} (Review Rival)`);
  console.log(`Relationship: ${pairId}`);
  console.log('This fixture validates the live Firebase/profile/UI path only; it does not claim replay-derived relationship scoring.');
}catch(error){
  console.error(error instanceof Error?error.message:error);
  process.exit(1);
}

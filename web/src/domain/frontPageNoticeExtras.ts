import type {AchievementSummary,LeagueSnapshot,MatchDetail} from './league';
import type {PrivateChronicleInvitations} from './privateChronicleInteractions';
import type {FrontPageNotice} from './frontPageNotices';

/** Only fully current, owner-scoped sources can create new dispatches. */
export function recordingActionNotices(snapshot:LeagueSnapshot,details:MatchDetail[]):FrontPageNotice[]{
  const ownerId=snapshot.viewer?.playerId;
  if(snapshot.membership!=='ACTIVE'||!ownerId)return [];
  const known=new Map(snapshot.matches.map(match=>[match.matchId,match]));
  const notices:FrontPageNotice[]=[];
  for(const detail of details){
    const match=known.get(detail.match.matchId);
    if(!match||!match.eventId||!['COMPLETED','AWAITING_CONFIRMATION'].includes(match.status)||
      !detail.viewer.isParticipant||detail.viewer.playerId!==ownerId||
      !detail.match.participants.some(player=>player.playerId===ownerId))continue;
    const event=snapshot.events.find(event=>event.eventId===match.eventId&&
      !['CANCELLED','POSTPONED'].includes(event.status));
    if(!event)continue;
    for(const game of detail.games){
      if(game.status!=='COMPLETED'||!game.result||game.resultDisputeOpen||game.activeResultDisputeId)continue;
      const state=game.replay?.statisticsState?.toUpperCase()??'';
      // An accepted source or an ongoing worker job cannot justify a red
      // 'missing recording' notice. A result alone is proof the Game occurred,
      // not proof that the current source exists.
      if(game.replay?.statisticsId||['READY','PROCESSING','PENDING','VALIDATING','UPLOADING','QUEUED'].includes(state))continue;
      notices.push({id:`recording:${match.matchId}:${game.gameId}`,kind:'recording',
        label:'Recording due',title:'A Game has no current recording',
        context:`${event.title} · Game ${game.gameNumber}`,
        body:'An official Game result exists, but there is no current accepted recording. Open the Battle to review its evidence or correction path.',
        action:'Open Battle',eventId:match.eventId,matchId:match.matchId,priority:2});
    }
  }
  return notices;
}

/** This invitation endpoint is strictly emulator-only and never makes a public allegation. */
export function chronicleActionNotices(snapshot:LeagueSnapshot,
  invitations:PrivateChronicleInvitations|null):FrontPageNotice[]{
  const ownerId=snapshot.viewer?.playerId;
  if(snapshot.membership!=='ACTIVE'||!ownerId||!invitations||
    invitations.testOnly!==true||invitations.visibility!=='OWNER_ONLY'||
    invitations.ownerPlayerId!==ownerId||invitations.officialEffects.length!==0)return [];
  return invitations.invitations.filter(i=>i.respondentPlayerId===ownerId&&i.sourceCurrent&&
      (i.state==='OFFERED'||i.state==='DEFERRED')&&i.speaker===null&&
      i.opportunityRevision&&i.context?.status==='CURRENT_GAME_ONLY')
    .map(i=>({id:`chronicle:${i.slotId}:${i.opportunityRevision}`,kind:'chronicle' as const,
      label:'Chronicle',title:'Your perspective is invited',
      context:'A moment in your Battle history',
      body:'A rare recorded moment invites your private perspective. Your answer is optional; declining or deferring has no penalty.',
      action:'Open my Chronicle',priority:3}));
}

export function honourActionNotices(awards:AchievementSummary[]):FrontPageNotice[]{
  return awards.filter(a=>!!a.awardId&&!!a.firstAwardedAt).map(a=>({
    id:`honour:${a.awardId}:${a.firstAwardedAt}`,kind:'recognition',
    label:'New honour',title:'An achievement was entered into your Chronicle',
    context:a.name,body:'This achievement is currently recorded in your personal Chronicle. Open the book to see your earned honours.',
    action:'Open my Chronicle',priority:6,
  }));
}

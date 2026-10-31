/** WAR-V1 #220: the server, never the website, owns qualification and points. */
export interface WarRoomPlayer {
  playerId: string;
  steamName: string;
  avatarUrl?: string | null;
  leagueAlias?: string | null;
}

export interface WarRoomChallenge {
  challengeId: string;
  challengeRevision: number;
  pairId: string | null;
  challenger: WarRoomPlayer;
  challenged: WarRoomPlayer;
  status: string;
  matchId: string | null;
  winners: WarRoomPlayer[];
  createdAt: string | null;
  respondedAt: string | null;
  completedAt: string | null;
  eligibilityReview: "PENDING_SOURCE" | "VERIFIED" | "INVALIDATED";
  canRespond: boolean;
}

export interface WarRoomData {
  schemaVersion: "WAR_ROOM_V1";
  generatedAt: string;
  visible: boolean;
  status: "CLOSED" | "PENDING_SOURCE" | "OPEN";
  activeSeason: {
    seasonId: string;
    name: string;
    openedAt?: string | null;
    engineVersion?: string | null;
  } | null;
  qualification: {
    status: "PENDING_SOURCE" | "VERIFIED";
    canIssueChallenges: boolean;
    canRespond: boolean;
  };
  standingsStatus: "PENDING_REVIEW" | "VERIFIED";
  leaderboard: {rank:number;player:WarRoomPlayer;warRoomPoints:number}[];
  rivalries: unknown[];
  viewer: {
    playerId: string;
    canChallenge: boolean;
    qualifiedRivals: WarRoomPlayer[];
    rivalries: unknown[];
    pendingIncomingChallenge: WarRoomChallenge | null;
  };
  challenges: WarRoomChallenge[];
  viewerChallenges: WarRoomChallenge[];
}

export function closedWarRoom(playerId: string, activeSeason: WarRoomData["activeSeason"]): WarRoomData {
  return {
    schemaVersion: "WAR_ROOM_V1",
    generatedAt: new Date().toISOString(),
    visible: activeSeason !== null,
    status: "CLOSED",
    activeSeason,
    qualification: {status:"PENDING_SOURCE",canIssueChallenges:false,canRespond:false},
    standingsStatus: "PENDING_REVIEW",
    leaderboard: [],
    rivalries: [],
    viewer: {playerId,canChallenge:false,qualifiedRivals:[],rivalries:[],pendingIncomingChallenge:null},
    challenges: [],
    viewerChallenges: [],
  };
}

/** Both flags AND verified current source authority are necessary, never a score or last-known stage. */
export function mayIssueWarChallenge(data: WarRoomData): boolean {
  return data.status === "OPEN" && data.qualification.status === "VERIFIED" &&
    data.qualification.canIssueChallenges && data.viewer.canChallenge &&
    data.viewer.qualifiedRivals.length > 0;
}
export function mayAnswerWarChallenge(data: WarRoomData, row: WarRoomChallenge): boolean {
  return data.status === "OPEN" && data.qualification.status === "VERIFIED" &&
    data.qualification.canRespond && row.canRespond &&
    row.status === "PENDING" && row.challenged.playerId === data.viewer.playerId &&
    data.viewerChallenges.some(challenge => challenge.challengeId === row.challengeId);
}

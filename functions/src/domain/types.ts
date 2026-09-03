export type PlayerRole = "PLAYER" | "ADMIN";
export type MembershipStatus = "PENDING" | "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type SeasonStatus = "DRAFT" | "UPCOMING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
export type EventStatus = "DRAFT" | "PUBLISHED" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "POSTPONED";
export type CompetitionStyle = "ONE_V_ONE" | "TWO_V_TWO" | "BIG_TEAM" | "FFA";
export type MatchFormat = "ONE_V_ONE" | "TWO_V_TWO" | "THREE_V_THREE" | "FOUR_V_FOUR" | "ASYMMETRIC_TEAM" | "FFA";
export type MatchStatus = "PROPOSED" | "READY" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "DISPUTED";
export type GameStatus = "READY" | "COMPLETED" | "REMAKE" | "NO_CONTEST" | "DISPUTED";
export type RsvpStatus = "YES" | "NO" | "UNANSWERED";
export type SignupState = "CONFIRMED" | "WAITING_LIST" | "NONE";
export type AttendanceStatus = "NOT_CHECKED" | "CHECKED_IN" | "NO_SHOW" | "LATE_ADDED";

export interface EntityRef {
  type: string;
  id: string;
}

export interface Player {
  steamName: string;
  steamNameNormalized: string;
  discordName: string | null;
  avatarUrl: string | null;
  membershipStatus: MembershipStatus;
  role: PlayerRole;
  currentPowerRating: number | null;
  provisionalRating: boolean;
  goldBalance: number;
}

export interface AuthLink {
  playerId: string;
}

export interface MatchPlanningConfig {
  prioritizeLargestTeams: boolean;
  preferredTeamSize: 2 | 3 | 4 | null;
  allowAsymmetricTeams: boolean;
  philosophy: "BALANCED" | "VARIETY";
  balanceWeight: number;
}

export interface MapConfiguration {
  pool: string[];
  selectionMode: "ADMIN" | "RANDOM" | "PLAYER_CHOICE" | "UNRESTRICTED";
}

export interface CivilizationConfiguration {
  mode: "UNRESTRICTED" | "RANDOM" | "ALLOWED_LIST" | "BANNED_LIST" | "TEAM_THEME" | "CUSTOM";
  allowed: string[];
  banned: string[];
  customRuleCode: string | null;
}

export interface VictoryConfiguration {
  conquest: boolean;
  wonder: boolean;
  relic: boolean;
  customRuleCode: string | null;
}

export interface GameConfiguration {
  maps: MapConfiguration;
  civilizations: CivilizationConfiguration;
  victory: VictoryConfiguration;
  diplomacyEnabled: boolean | null;
  additionalSettings: Record<string, string | number | boolean | null>;
}

export interface ScoringSnapshot {
  profileId: string | null;
  profileVersion: number;
  rules: Record<string, unknown>;
}

export interface GoldRewardConfig {
  attendance: number;
  matchCompletion: number;
  matchWin: number;
  additionalRewards: Record<string, number>;
}

export interface CompetitionContext {
  type: "SEASON_EVENT" | "WAR_ROOM" | "CHALLENGE" | "EXHIBITION" | "OFF_SEASON" | "FINALS" | "SPECIAL";
  affectsLeaguePoints: boolean;
  affectsWarRoomPoints: boolean;
  affectsGold: boolean;
  affectsSeasonStats: boolean;
  affectsLifetimeStats: boolean;
  affectsPowerRating: boolean;
}

export interface MatchParticipant {
  playerId: string;
  team: number | null;
  slot: number;
}

export interface GamePlayer extends MatchParticipant {
  color: number | null;
  civilization: string | null;
  civilizationSelection: "RANDOM" | "CHOSEN" | "UNKNOWN";
  position: string | null;
}

export interface SeriesRule {
  maxGames: number;
  gamesRequiredToWin: number;
}

export interface SpecialMatchCondition {
  type: string;
  description: string;
  config: Record<string, unknown>;
}

export interface ProposedMatch {
  format: MatchFormat;
  participants: MatchParticipant[];
  teamSizes?: [number, number];
  balanceEstimate?: {
    teamOneWinProbability: number;
    teamTwoWinProbability: number;
  };
}

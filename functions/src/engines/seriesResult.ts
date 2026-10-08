import type {CanonicalGameResult, MatchParticipant, SeriesRule} from '../domain/types.js';
export interface AcceptedSeriesGame {gameId: string; gameNumber: number; status: string; canonicalResult?: CanonicalGameResult | null; activeResultDisputeId?: string | null;}
export function resolveSeriesResult(games: AcceptedSeriesGame[], rule: SeriesRule, participants: MatchParticipant[]) {
  if (!Number.isInteger(rule.maxGames) || rule.maxGames < 1 || !Number.isInteger(rule.gamesRequiredToWin) ||
    rule.gamesRequiredToWin < 1 || rule.gamesRequiredToWin * 2 <= rule.maxGames || rule.gamesRequiredToWin > rule.maxGames) throw new Error('Series requires a majority win threshold.');
  if (games.some(g => !Number.isInteger(g.gameNumber) || g.gameNumber < 1)) throw new Error('Series has invalid Game numbers.');
  const accepted = games.filter(g => g.status !== 'REMAKE' && g.status !== 'NO_CONTEST').sort((a,b) => a.gameNumber - b.gameNumber || a.gameId.localeCompare(b.gameId));
  if (new Set(accepted.map(g => g.gameNumber)).size !== accepted.length) throw new Error('Series has duplicate Game numbers.');
  const wins = new Map<string, number>();
  const revisions: Record<string, number> = {};
  let decisive: AcceptedSeriesGame | null = null;
  for (const game of accepted) {
    if (decisive) {
      if (game.status === 'COMPLETED') throw new Error('Series has accepted Games after its decisive result.');
      continue;
    }
    for (let n = 1; n < game.gameNumber; n++) if (!games.some(g => g.gameNumber === n)) throw new Error('Series has a missing earlier Game.');
    if (game.activeResultDisputeId || game.status !== 'COMPLETED' || !game.canonicalResult) throw new Error('Series has an unresolved Game before its decisive result.');
    const result = game.canonicalResult;
    if (result.type === 'COALITION_WIN') throw new Error('Shared FFA series require separately defined series rules.');
    if (!result.winningPlayerIds.length || result.winningPlayerIds.some(id => !participants.some(p => p.playerId === id))) throw new Error('Series winner is outside the roster.');
    const key = [...result.winningPlayerIds].sort().join('|');
    wins.set(key, (wins.get(key) ?? 0) + 1);
    revisions[game.gameId] = result.revision;
    if (wins.get(key) === rule.gamesRequiredToWin) decisive = game;
    if (Object.keys(revisions).length > rule.maxGames) throw new Error('Series exceeds its Game limit.');
  }
  if (!decisive) throw new Error('Series has no verified winning side yet.');
  return {result: decisive.canonicalResult!, sourceGameId: decisive.gameId, seriesGameRevisions: revisions};
}

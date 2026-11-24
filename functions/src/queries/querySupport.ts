import { Timestamp } from "firebase-admin/firestore";
import type { Player } from "../domain/types.js";

export function iso(value: Timestamp | null | undefined): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

export function publicPlayer(playerId: string, player: Player | undefined) {
  return {
    playerId,
    // Legacy steamName was the admitted league name, never the refreshed persona.
    steamName: player?.leagueAlias || player?.steamName || playerId,
    leagueAlias:player?.leagueAlias??null,
    avatarUrl: player?.avatarUrl ?? null,
    currentPowerRating: player?.currentPowerRating ?? null,
    provisionalRating: player?.provisionalRating ?? true,
  };
}

export function playerMap(
  snapshot: FirebaseFirestore.QuerySnapshot,
): Map<string, Player> {
  return new Map(snapshot.docs.map((document) => [document.id, document.data() as Player]));
}

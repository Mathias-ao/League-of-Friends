import { Timestamp } from "firebase-admin/firestore";
import type { Player } from "../domain/types.js";

export function iso(value: Timestamp | null | undefined): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

export function publicPlayer(playerId: string, player: Player | undefined) {
  return {
    playerId,
    steamName: player?.steamName ?? playerId,
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

import { pool } from "./pool.js";
import { eloDelta, type GameScore } from "../rating/elo.js";
import type { FinishedGame } from "../rooms/game-record.js";

export async function recordGame(game: FinishedGame): Promise<void> {
  if (!game.whiteId || !game.blackId || game.whiteRatingBefore === null || game.blackRatingBefore === null) {
    return; // anonymous players aren't persisted — schema requires real accounts on both sides
  }

  const whiteScore: GameScore = game.winner === "white" ? 1 : game.winner === "black" ? 0 : 0.5;
  const blackScore: GameScore = game.winner === "black" ? 1 : game.winner === "white" ? 0 : 0.5;
  const whiteDelta = eloDelta(game.whiteRatingBefore, game.blackRatingBefore, whiteScore);
  const blackDelta = eloDelta(game.blackRatingBefore, game.whiteRatingBefore, blackScore);
  const winnerId = game.winner === "white" ? game.whiteId : game.winner === "black" ? game.blackId : null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO games (id, white_id, black_id, white_rating_before, black_rating_before, status, winner_id, moves, started_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [game.id, game.whiteId, game.blackId, game.whiteRatingBefore, game.blackRatingBefore,
        game.status, winnerId, game.moves, new Date(game.startedAt)]
    );
    await client.query("UPDATE users SET rating = rating + $1 WHERE id = $2", [whiteDelta, game.whiteId]);
    await client.query("UPDATE users SET rating = rating + $1 WHERE id = $2", [blackDelta, game.blackId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

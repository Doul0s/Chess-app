import type { Color, GameStatus } from "../chess/types.js";

export interface FinishedGame {
  id: string;
  whiteId: string | null;
  blackId: string | null;
  whiteRatingBefore: number | null;
  blackRatingBefore: number | null;
  status: Exclude<GameStatus, "active">;
  winner: Color | null;
  moves: string[];
  startedAt: number;
}

export type GameEndHandler = (game: FinishedGame) => void;

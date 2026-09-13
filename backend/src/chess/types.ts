export type Color = "white" | "black";
export type PieceType = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";
export type GameStatus = "active" | "checkmate" | "stalemate" | "draw" | "timeout";

export interface Piece {
  color: Color;
  type: PieceType;
}

export interface Move {
  from: string;
  to: string;
  promotion?: Exclude<PieceType, "king" | "pawn">;
  captured?: Piece;
  isEnPassant?: boolean;
  isCastling?: boolean;
}

export type MoveResult =
  | { ok: true }
  | { ok: false; reason: string };

export function opposite(color: Color): Color {
  return color === "white" ? "black" : "white";
}
import { cloneBoard, fileOf, rankOf, squareOf } from "./board.js";
import type { Color, Move, Piece, PieceType } from "./types.js";
import { opposite } from "./types.js";

export interface PositionState {
  board: Map<string, Piece>;
  turn: Color;
  castling: { whiteKing: boolean; whiteQueen: boolean; blackKing: boolean; blackQueen: boolean };
  enPassant: string | null;
}

const KNIGHT_STEPS = [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];
const KING_STEPS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const BISHOP_DIRS = [[1,1],[1,-1],[-1,1],[-1,-1]];
const ROOK_DIRS = [[1,0],[-1,0],[0,1],[0,-1]];

const CORNER_RIGHTS: Record<string, keyof PositionState["castling"]> = {
  a1: "whiteQueen", h1: "whiteKing", a8: "blackQueen", h8: "blackKing",
};

function inBounds(file: number, rank: number): boolean { return file >= 0 && file < 8 && rank >= 0 && rank < 8; }

function slidingDirections(type: PieceType): number[][] {
  return [
    ...(type === "bishop" || type === "queen" ? BISHOP_DIRS : []),
    ...(type === "rook" || type === "queen" ? ROOK_DIRS : []),
  ];
}

function addMove(moves: Move[], state: PositionState, from: string, to: string, piece: Piece, extra: Partial<Move> = {}): void {
  const captured = state.board.get(to);
  if (captured?.color === piece.color) return;
  moves.push({ from, to, ...(captured ? { captured: { ...captured } } : {}), ...extra });
}

export function isSquareAttacked(state: PositionState, square: string, byColor: Color): boolean {
  const targetFile = fileOf(square), targetRank = rankOf(square);
  for (const [from, piece] of state.board) {
    if (piece.color !== byColor) continue;
    const f = fileOf(from), r = rankOf(from);
    const df = targetFile - f, dr = targetRank - r;

    if (piece.type === "pawn") {
      const direction = byColor === "white" ? 1 : -1;
      if (dr === direction && Math.abs(df) === 1) return true;
    } else if (piece.type === "knight") {
      if (KNIGHT_STEPS.some(([x,y]) => x === df && y === dr)) return true;
    } else if (piece.type === "king") {
      if (Math.max(Math.abs(df), Math.abs(dr)) === 1) return true;
    } else {
      for (const [sx, sy] of slidingDirections(piece.type)) {
        let x = f + sx, y = r + sy;
        while (inBounds(x,y)) {
          const blocker = state.board.get(squareOf(x,y));
          if (x === targetFile && y === targetRank) return !blocker || blocker.color !== byColor;
          if (blocker) break;
          x += sx; y += sy;
        }
      }
    }
  }
  return false;
}

export function findKing(state: PositionState, color: Color): string | null {
  for (const [square, piece] of state.board) {
    if (piece.color === color && piece.type === "king") return square;
  }
  return null;
}

export function isInCheck(state: PositionState, color: Color): boolean {
  const king = findKing(state, color);
  return king === null || isSquareAttacked(state, king, opposite(color));
}

export function applyMove(state: PositionState, move: Move): PositionState {
  const next: PositionState = {
    board: cloneBoard(state.board),
    turn: opposite(state.turn),
    castling: { ...state.castling },
    enPassant: null,
  };
  const piece = next.board.get(move.from)!;
  next.board.delete(move.from);

  if (move.isEnPassant) {
    // The captured pawn sits on the landing file, one rank behind the target.
    const captureRank = rankOf(move.to) + (piece.color === "white" ? -1 : 1);
    next.board.delete(squareOf(fileOf(move.to), captureRank));
  }

  if (move.isCastling) {
    const rank = rankOf(move.from);
    const kingSide = fileOf(move.to) > fileOf(move.from);
    const rookFrom = squareOf(kingSide ? 7 : 0, rank);
    const rookTo = squareOf(kingSide ? 5 : 3, rank);
    const rook = next.board.get(rookFrom);
    if (rook) { next.board.delete(rookFrom); next.board.set(rookTo, rook); }
  }

  next.board.delete(move.to);
  next.board.set(move.to, { ...piece, ...(move.promotion ? { type: move.promotion } : {}) });

// Moving a king or moving/capturing a rook off its corner revokes that
  // side's castling right permanently.
  if (piece.type === "king") {
    const [kingRight, queenRight] = piece.color === "white" ? ["whiteKing", "whiteQueen"] as const : ["blackKing", "blackQueen"] as const;
    next.castling[kingRight] = false;
    next.castling[queenRight] = false;
  }
  for (const square of [move.from, move.to]) {
    const right = CORNER_RIGHTS[square];
    if (right) next.castling[right] = false;
  }

  if (piece.type === "pawn" && Math.abs(rankOf(move.to) - rankOf(move.from)) === 2) {
    next.enPassant = squareOf(fileOf(move.from), (rankOf(move.from) + rankOf(move.to)) / 2);
  }
  return next;
}

export function generatePseudoLegalMoves(state: PositionState, fromFilter?: string): Move[] {
  const moves: Move[] = [];
  for (const [from, piece] of state.board) {
    if (piece.color !== state.turn || (fromFilter && from !== fromFilter)) continue;
    const f = fileOf(from), r = rankOf(from);

    if (piece.type === "pawn") {
      const dir = piece.color === "white" ? 1 : -1;
      const startRank = piece.color === "white" ? 1 : 6;
      const promotionRank = piece.color === "white" ? 7 : 0;
      const one = r + dir;
      if (inBounds(f, one)) {
        const to = squareOf(f, one);
        if (!state.board.has(to)) {
          if (one === promotionRank) {
            for (const promotion of ["queen","rook","bishop","knight"] as const) addMove(moves,state,from,to,piece,{promotion});
          } else addMove(moves,state,from,to,piece);
          if (r === startRank) {
            const two = squareOf(f, r + 2*dir);
            if (!state.board.has(two)) addMove(moves,state,from,two,piece);
          }
        }
      }
      for (const df of [-1,1]) {
        const x=f+df, y=r+dir;
        if (!inBounds(x,y)) continue;
        const to=squareOf(x,y), target=state.board.get(to);
        if (target && target.color !== piece.color) {
          if (y === promotionRank) for (const promotion of ["queen","rook","bishop","knight"] as const) addMove(moves,state,from,to,piece,{promotion});
          else addMove(moves,state,from,to,piece);
        } else if (to === state.enPassant) {
          addMove(moves,state,from,to,piece,{isEnPassant:true});
        }
      }
    } else if (piece.type === "knight" || piece.type === "king") {
      const steps = piece.type === "knight" ? KNIGHT_STEPS : KING_STEPS;
      for (const [df,dr] of steps) {
        const x=f+df,y=r+dr;
        if (inBounds(x,y)) addMove(moves,state,from,squareOf(x,y),piece);
      }
      if (piece.type === "king" && !isInCheck(state,piece.color)) {
        const rank = piece.color === "white" ? 0 : 7;
        const kingRight = piece.color === "white" ? state.castling.whiteKing : state.castling.blackKing;
        const queenRight = piece.color === "white" ? state.castling.whiteQueen : state.castling.blackQueen;
        const enemy = opposite(piece.color);
        if (kingRight && state.board.get(squareOf(7,rank))?.type === "rook" && state.board.get(squareOf(7,rank))?.color === piece.color &&
            !state.board.has(squareOf(5,rank)) && !state.board.has(squareOf(6,rank)) &&
            !isSquareAttacked(state,squareOf(5,rank),enemy) && !isSquareAttacked(state,squareOf(6,rank),enemy)) {
          addMove(moves,state,from,squareOf(6,rank),piece,{isCastling:true});
        }
        if (queenRight && state.board.get(squareOf(0,rank))?.type === "rook" && state.board.get(squareOf(0,rank))?.color === piece.color &&
            !state.board.has(squareOf(1,rank)) && !state.board.has(squareOf(2,rank)) && !state.board.has(squareOf(3,rank)) &&
            !isSquareAttacked(state,squareOf(3,rank),enemy) && !isSquareAttacked(state,squareOf(2,rank),enemy)) {
          addMove(moves,state,from,squareOf(2,rank),piece,{isCastling:true});
        }
      }
    } else {
      for (const [df,dr] of slidingDirections(piece.type)) {
        let x=f+df,y=r+dr;
        while (inBounds(x,y)) {
          const to=squareOf(x,y), target=state.board.get(to);
          if (!target) addMove(moves,state,from,to,piece);
          else { if (target.color !== piece.color) addMove(moves,state,from,to,piece); break; }
          x+=df;y+=dr;
        }
      }
    }
  }
  return moves;
}

export function generateLegalMoves(state: PositionState, fromFilter?: string): Move[] {
  return generatePseudoLegalMoves(state, fromFilter).filter(move => {
    const next = applyMove(state, move);
    return !isInCheck(next, state.turn);
  });
}

const PROMOTION_LETTERS: Record<Exclude<PieceType, "king" | "pawn">, string> = {
  queen: "q", rook: "r", bishop: "b", knight: "n",
};

export function moveToLan(move: Move): string {
  return `${move.from}${move.to}${move.promotion ? PROMOTION_LETTERS[move.promotion] : ""}`;
}

export function parseMove(input: string): { from: string; to: string; promotion?: Move["promotion"] } | null {
  const normalized = input.trim().toLowerCase();
  const match = normalized.match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/);
  if (!match) return null;
  const promotionMap = { q: "queen", r: "rook", b: "bishop", n: "knight" } as const;
  return { from: match[1]!, to: match[2]!, ...(match[3] ? { promotion: promotionMap[match[3] as keyof typeof promotionMap] } : {}) };
}

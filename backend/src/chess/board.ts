import type { Color, Piece, PieceType } from "./types.js";

export const FILES = "abcdefgh";
export const RANKS = "12345678";

export function isSquare(square: string): boolean {
  return /^[a-h][1-8]$/.test(square);
}

export function fileOf(square: string): number { return FILES.indexOf(square[0]!); }
export function rankOf(square: string): number { return Number(square[1]) - 1; }
export function squareOf(file: number, rank: number): string { return `${FILES[file]}${rank + 1}`; }

export function createInitialBoard(): Map<string, Piece> {
  const board = new Map<string, Piece>();
  const back: PieceType[] = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];

  for (let file = 0; file < 8; file++) {
    board.set(squareOf(file, 0), { color: "white", type: back[file]! });
    board.set(squareOf(file, 1), { color: "white", type: "pawn" });
    board.set(squareOf(file, 6), { color: "black", type: "pawn" });
    board.set(squareOf(file, 7), { color: "black", type: back[file]! });
  }
  return board;
}

export function cloneBoard(board: Map<string, Piece>): Map<string, Piece> {
  return new Map([...board].map(([square, piece]) => [square, { ...piece }]));
}

export function boardKey(board: Map<string, Piece>): string {
  const squares: string[] = [];
  for (let rank = 7; rank >= 0; rank--) {
    for (let file = 0; file < 8; file++) {
      const piece = board.get(squareOf(file, rank));
      squares.push(piece ? `${piece.color[0]}${piece.type[0]}` : "--");
    }
  }
  return squares.join("");
}

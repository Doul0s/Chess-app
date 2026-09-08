import { boardKey, createInitialBoard } from "./board.js";
import { applyMove, generateLegalMoves, isInCheck, parseMove, type PositionState } from "./move-generator.js";
import type { Color, GameStatus, Move, MoveResult } from "./types.js";
import { opposite } from "./types.js";

export class ChessGame {
  private state: PositionState = {
    board: createInitialBoard(),
    turn: "white",
    castling: { whiteKing: true, whiteQueen: true, blackKing: true, blackQueen: true },
    enPassant: null,
  };

  private readonly moveHistory: Move[] = [];
  private readonly positions = new Map<string, number>();
  private halfmoveClock = 0;
  public status: GameStatus = "active";

  constructor() {
    this.positions.set(this.positionKey(), 1);
  }

  get turn(): Color { return this.state.turn; }
  get history(): readonly Move[] { return this.moveHistory; }
  get board(): ReadonlyMap<string, import("./types.js").Piece> { return this.state.board; }

  makeMove(color: Color, input: string): MoveResult {
    if (this.status !== "active") return { ok: false, reason: "game_over" };
    if (color !== this.state.turn) return { ok: false, reason: "not_your_turn" };

    const parsed = parseMove(input);
    if (!parsed) return { ok: false, reason: "invalid_move_format" };

    const legal = generateLegalMoves(this.state, parsed.from).find(move =>
      move.to === parsed.to && (move.promotion ?? undefined) === (parsed.promotion ?? undefined)
    );
    if (!legal) return { ok: false, reason: "illegal_move" };

    const movingPiece = this.state.board.get(legal.from)!;
    const captured = legal.captured;
    this.state = applyMove(this.state, legal);
    this.moveHistory.push({ ...legal, ...(captured ? { captured: { ...captured } } : {}) });

    if (movingPiece.type === "pawn" || captured || legal.isEnPassant) this.halfmoveClock = 0;
    else this.halfmoveClock++;

    const key = this.positionKey();
    this.positions.set(key, (this.positions.get(key) ?? 0) + 1);
    this.updateStatus();
    return { ok: true };
  }

  isCheck(color: Color = this.state.turn): boolean { return isInCheck(this.state, color); }

  private updateStatus(): void {
    const legalMoves = generateLegalMoves(this.state);
    if (legalMoves.length === 0) {
      this.status = isInCheck(this.state, this.state.turn)
        ? "checkmate"
        : "stalemate";
      return;
    }
    if (this.halfmoveClock >= 100 || this.positions.get(this.positionKey())! >= 3 || this.isInsufficientMaterial()) {
      this.status = "draw";
      return;
    }
    this.status = "active";
  }

  private positionKey(): string {
    const rights: [boolean, string][] = [
      [this.state.castling.whiteKing, "K"], [this.state.castling.whiteQueen, "Q"],
      [this.state.castling.blackKing, "k"], [this.state.castling.blackQueen, "q"],
    ];
    const castling = rights.filter(([held]) => held).map(([, letter]) => letter).join("") || "-";
    return `${boardKey(this.state.board)}|${this.state.turn}|${castling}|${this.state.enPassant ?? "-"}`;
  }

  private isInsufficientMaterial(): boolean {
    const pieces = [...this.state.board.values()];
    const nonKings = pieces.filter(piece => piece.type !== "king");
    if (nonKings.length === 0) return true;
    if (nonKings.some(piece => piece.type === "pawn" || piece.type === "rook" || piece.type === "queen")) return false;
    if (nonKings.length === 1 && (nonKings[0]!.type === "bishop" || nonKings[0]!.type === "knight")) return true;
    if (nonKings.every(piece => piece.type === "bishop")) {
      const bishops = [...this.state.board.entries()].filter(([,p]) => p.type === "bishop");
      const colors = bishops.map(([square]) => (Number(square[1]) + "abcdefgh".indexOf(square[0]!)) % 2);
      return colors.every(c => c === colors[0]);
    }
    return false;
  }
}
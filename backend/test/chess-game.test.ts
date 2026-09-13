import test from "node:test";
import assert from "node:assert/strict";
import { ChessGame } from "../src/chess/chess-game.js";

function play(game: ChessGame, ...moves: string[]) {
  for (let i = 0; i < moves.length; i++) {
    const color = i % 2 === 0 ? "white" : "black";
    const result = game.makeMove(color, moves[i]!);
    assert.equal(result.ok, true, `${moves[i]} failed: ${result.ok ? "" : result.reason}`);
  }
}

test("starts with white to move", () => {
  const game = new ChessGame();
  assert.equal(game.turn, "white");
  assert.equal(game.status, "active");
});

test("enforces player turn", () => {
  const game = new ChessGame();
  assert.deepEqual(game.makeMove("black", "e7e5"), { ok: false, reason: "not_your_turn" });
});

test("accepts a legal pawn move and changes turn", () => {
  const game = new ChessGame();
  assert.deepEqual(game.makeMove("white", "e2e4"), { ok: true });
  assert.equal(game.turn, "black");
});

test("rejects illegal movement", () => {
  const game = new ChessGame();
  assert.deepEqual(game.makeMove("white", "e2e5"), { ok: false, reason: "illegal_move" });
});

test("rejects moving an opponent piece", () => {
  const game = new ChessGame();
  assert.deepEqual(game.makeMove("white", "e7e5"), { ok: false, reason: "illegal_move" });
});

test("detects scholar's mate checkmate", () => {
  const game = new ChessGame();
  play(game, "e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6", "h5f7");
  assert.equal(game.status, "checkmate");
  assert.equal(game.isCheck("black"), true);
  assert.deepEqual(game.makeMove("black", "a7a6"), { ok: false, reason: "game_over" });
});

test("detects stalemate", () => {
  const game = new ChessGame();
  const state = (game as any).state;
  state.board.clear();
  state.board.set("a8", { color: "black", type: "king" });
  state.board.set("c6", { color: "white", type: "king" });
  state.board.set("c7", { color: "white", type: "queen" });
  state.turn = "black";
  (game as any).updateStatus();
  assert.equal(game.status, "stalemate");
});

test("supports castling when legal", () => {
  const game = new ChessGame();
  play(game, "e2e4", "e7e5", "g1f3", "g8f6", "f1e2", "f8e7", "e1g1");
  assert.equal(game.history.at(-1)?.isCastling, true);
});

test("does not castle through check", () => {
  const game = new ChessGame();
  play(game, "e2e4", "e7e5", "g1f3", "d8h4", "f1e2", "h4f2");
  assert.deepEqual(game.makeMove("white", "e1g1"), { ok: false, reason: "illegal_move" });
});

test("supports promotion", () => {
  const game = new ChessGame();
  const state = (game as any).state;
  state.board.clear();
  state.board.set("e1", { color: "white", type: "king" });
  state.board.set("e8", { color: "black", type: "king" });
  state.board.set("a7", { color: "white", type: "pawn" });
  state.turn = "white";
  assert.deepEqual(game.makeMove("white", "a7a8q"), { ok: true });
  assert.equal(game.board.get("a8")?.type, "queen");
});

test("deducts elapsed thinking time from the mover's clock only", () => {
  const game = new ChessGame(10_000);
  game.makeMove("white", "e2e4", 4_000);
  assert.equal(game.remainingMs("white"), 6_000);
  assert.equal(game.remainingMs("black"), 10_000);
});

test("running out of time on a move attempt ends the game as a timeout", () => {
  const game = new ChessGame(10_000);
  const result = game.makeMove("white", "e2e4", 10_001);
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.reason, "timeout");
  assert.equal(game.status, "timeout");
});

test("expireClock ends the game for the color to move", () => {
  const game = new ChessGame(10_000);
  game.expireClock("white");
  assert.equal(game.status, "timeout");
});

test("expireClock does not override an already-finished game", () => {
  const game = new ChessGame(10_000);
  game.makeMove("white", "f2f3", 0);
  game.makeMove("black", "e7e5", 0);
  game.makeMove("white", "g2g4", 0);
  game.makeMove("black", "d8h4", 0);
  assert.equal(game.status, "checkmate");
  game.expireClock("black");
  assert.equal(game.status, "checkmate");
});
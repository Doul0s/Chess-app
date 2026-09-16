import { test } from "node:test";
import assert from "node:assert/strict";
import type { WebSocket } from "ws";
import { RoomManager } from "../src/rooms/room-manager.js";

class FakeSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  readonly OPEN = FakeSocket.OPEN;
  readonly CLOSED = FakeSocket.CLOSED;
  readyState = FakeSocket.OPEN;
  sent: string[] = [];
  send(data: string) { this.sent.push(data); }
  close() { this.readyState = FakeSocket.CLOSED; }
}

function asSocket(fake: FakeSocket): WebSocket { return fake as unknown as WebSocket; }

// The mandated /rooms and /rooms/:gameId contract still uses raw strings
// (matchmaking id, "white"/"black"); everything else is the JSON envelope.
function lastJson(socket: FakeSocket): any { return JSON.parse(socket.sent.at(-1)!); }
function jsonMessages(socket: FakeSocket): any[] {
  return socket.sent.flatMap(raw => { try { return [JSON.parse(raw)]; } catch { return []; } });
}

function setupRoom() {
  const manager = new RoomManager();
  const a = new FakeSocket(), b = new FakeSocket();
  manager.matchmake(asSocket(a));
  manager.matchmake(asSocket(b));
  const gameId = a.sent[0]!;
  const white = new FakeSocket(), black = new FakeSocket();
  manager.joinGame(gameId, asSocket(white));
  manager.joinGame(gameId, asSocket(black));
  return { manager, white, black };
}

test("matchmake pairs two sockets with the same raw game id", () => {
  const manager = new RoomManager();
  const a = new FakeSocket(), b = new FakeSocket();
  manager.matchmake(asSocket(a));
  assert.equal(a.sent.length, 0);
  manager.matchmake(asSocket(b));
  assert.equal(a.sent[0], b.sent[0]);
  assert.equal(a.readyState, FakeSocket.CLOSED);
});

test("joinGame assigns colors once both sockets connect, as raw strings", () => {
  const { white, black } = setupRoom();
  assert.equal(white.sent.at(-1), "white");
  assert.equal(black.sent.at(-1), "black");
});

test("valid move is broadcast to the opponent only, as a JSON move message", () => {
  const { manager, white, black } = setupRoom();
  manager.handleMove(asSocket(white), "e2e4");
  assert.deepEqual(lastJson(black), { type: "move", move: "e2e4" });
  assert.equal(white.sent.length, 1);
});

test("illegal move sends a JSON error back to the sender only", () => {
  const { manager, white, black } = setupRoom();
  manager.handleMove(asSocket(white), "e2e5");
  assert.deepEqual(lastJson(white), { type: "error", reason: "illegal_move" });
  assert.equal(black.sent.length, 1);
});

test("checkmate ends the game and sends a JSON game_over with the winner to both players", () => {
  const { manager, white, black } = setupRoom();
  const moves: [FakeSocket, string][] = [
    [white, "f2f3"], [black, "e7e5"], [white, "g2g4"], [black, "d8h4"],
  ];
  for (const [socket, move] of moves) manager.handleMove(asSocket(socket), move);

  const expected = { type: "game_over", status: "checkmate", winner: "black" };
  assert.deepEqual(lastJson(white), expected);
  assert.deepEqual(lastJson(black), expected);
  assert.equal(white.readyState, FakeSocket.CLOSED);
  assert.equal(black.readyState, FakeSocket.CLOSED);
});

test("disconnect during an active game sends a JSON opponent_disconnected notice", () => {
  const { manager, white, black } = setupRoom();
  manager.leaveGame(asSocket(white));
  assert.deepEqual(lastJson(black), { type: "opponent_disconnected" });
  assert.equal(black.readyState, FakeSocket.CLOSED);
});

test("flag falls when the side to move runs out of time", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const manager = new RoomManager(1_000);
  const a = new FakeSocket(), c = new FakeSocket();
  manager.matchmake(asSocket(a));
  manager.matchmake(asSocket(c));
  const gameId = a.sent[0]!;
  const white = new FakeSocket(), black = new FakeSocket();
  manager.joinGame(gameId, asSocket(white));
  manager.joinGame(gameId, asSocket(black));

  t.mock.timers.tick(1_000);

  const expected = { type: "game_over", status: "timeout", winner: "black" };
  assert.deepEqual(lastJson(white), expected);
  assert.deepEqual(lastJson(black), expected);
  assert.equal(white.readyState, FakeSocket.CLOSED);
  assert.equal(black.readyState, FakeSocket.CLOSED);
});

test("rescheduling after a move uses the opponent's actual remaining time, not a fresh clock", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const manager = new RoomManager(1_000);
  const a = new FakeSocket(), c = new FakeSocket();
  manager.matchmake(asSocket(a));
  manager.matchmake(asSocket(c));
  const gameId = a.sent[0]!;
  const white = new FakeSocket(), black = new FakeSocket();
  manager.joinGame(gameId, asSocket(white));
  manager.joinGame(gameId, asSocket(black));

  t.mock.timers.tick(400);
  manager.handleMove(asSocket(white), "e2e4"); // white spends 400ms, 600ms left

  t.mock.timers.tick(300);
  manager.handleMove(asSocket(black), "e7e5"); // black spends 300ms; white's next timer must use its remaining 600ms, not a fresh 1000ms

  t.mock.timers.tick(599);
  assert.equal(jsonMessages(white).filter(m => m.type === "game_over").length, 0);

  t.mock.timers.tick(1);
  assert.deepEqual(lastJson(white), { type: "game_over", status: "timeout", winner: "black" });
});

test("an illegal move attempt still burns the mover's thinking time but does not switch turns", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const manager = new RoomManager(1_000);
  const a = new FakeSocket(), c = new FakeSocket();
  manager.matchmake(asSocket(a));
  manager.matchmake(asSocket(c));
  const gameId = a.sent[0]!;
  const white = new FakeSocket(), black = new FakeSocket();
  manager.joinGame(gameId, asSocket(white));
  manager.joinGame(gameId, asSocket(black));

  t.mock.timers.tick(700);
  manager.handleMove(asSocket(white), "e2e5"); // illegal; burns 700ms of white's own clock, 300ms left
  assert.deepEqual(lastJson(white), { type: "error", reason: "illegal_move" });

  t.mock.timers.tick(299);
  assert.equal(jsonMessages(white).filter(m => m.type === "game_over").length, 0);

  t.mock.timers.tick(1);
  assert.deepEqual(lastJson(white), { type: "game_over", status: "timeout", winner: "black" });
});

test("host disconnecting before an opponent joins cleans up the room", () => {
  const manager = new RoomManager();
  const a = new FakeSocket(), c = new FakeSocket();
  manager.matchmake(asSocket(a));
  manager.matchmake(asSocket(c));
  const gameId = a.sent[0]!;
  const host = new FakeSocket();
  manager.joinGame(gameId, asSocket(host));

  manager.leaveGame(asSocket(host));

  const late = new FakeSocket();
  const room = manager.joinGame(gameId, asSocket(late));
  assert.equal(room, null);
  assert.equal(late.readyState, FakeSocket.OPEN);
});

test("reporting the same disconnect twice does not double-notify or throw", () => {
  const { manager, white, black } = setupRoom();
  manager.leaveGame(asSocket(white));
  manager.leaveGame(asSocket(white));
  assert.equal(jsonMessages(black).filter(m => m.type === "opponent_disconnected").length, 1);
});

test("createInvite seats the creator as white immediately, no waiting", () => {
  const manager = new RoomManager();
  const host = new FakeSocket();
  const gameId = manager.createInvite(asSocket(host), "private");
  assert.equal(host.sent[0], gameId);
});

test("joining an invite room assigns colors the same way as matchmaking", () => {
  const manager = new RoomManager();
  const host = new FakeSocket(), guest = new FakeSocket();
  const gameId = manager.createInvite(asSocket(host), "private");
  manager.joinGame(gameId, asSocket(guest));
  assert.equal(host.sent.at(-1), "white");
  assert.equal(guest.sent.at(-1), "black");
});

test("a public invite is listed while waiting and disappears once filled", () => {
  const manager = new RoomManager();
  const host = new FakeSocket(), guest = new FakeSocket();
  const gameId = manager.createInvite(asSocket(host), "public");
  assert.deepEqual(manager.listPublicRooms(), [gameId]);
  manager.joinGame(gameId, asSocket(guest));
  assert.deepEqual(manager.listPublicRooms(), []);
});

test("a private invite never appears in the public list", () => {
  const manager = new RoomManager();
  const host = new FakeSocket();
  manager.createInvite(asSocket(host), "private");
  assert.deepEqual(manager.listPublicRooms(), []);
});

test("a matchmaking room is never listed publicly, even mid-handshake", () => {
  const manager = new RoomManager();
  const a = new FakeSocket(), c = new FakeSocket();
  manager.matchmake(asSocket(a));
  manager.matchmake(asSocket(c));
  assert.deepEqual(manager.listPublicRooms(), []);
});

test("ratings default to 1200 when not supplied", () => {
  const manager = new RoomManager();
  const host = new FakeSocket(), guest = new FakeSocket();
  const gameId = manager.createInvite(asSocket(host), "private");
  const room = manager.joinGame(gameId, asSocket(guest));
  assert.deepEqual(room?.ratings, { white: 1200, black: 1200 });
});

test("supplied ratings are recorded per color at seating time", () => {
  const manager = new RoomManager();
  const host = new FakeSocket(), guest = new FakeSocket();
  const gameId = manager.createInvite(asSocket(host), "private", 1400);
  const room = manager.joinGame(gameId, asSocket(guest), 1350);
  assert.deepEqual(room?.ratings, { white: 1400, black: 1350 });
});

test("a matchmaking room has no ratings until players seat via /rooms/:gameId", () => {
  const manager = new RoomManager();
  const a = new FakeSocket(), c = new FakeSocket();
  manager.matchmake(asSocket(a));
  manager.matchmake(asSocket(c));
  const gameId = a.sent[0]!;
  const white = new FakeSocket();
  const room = manager.joinGame(gameId, asSocket(white), 1600);
  assert.deepEqual(room?.ratings, { white: 1600, black: null });
});

test("userIds default to null for anonymous (unauthenticated) players", () => {
  const manager = new RoomManager();
  const host = new FakeSocket(), guest = new FakeSocket();
  const gameId = manager.createInvite(asSocket(host), "private");
  const room = manager.joinGame(gameId, asSocket(guest));
  assert.deepEqual(room?.userIds, { white: null, black: null });
});

test("supplied userIds are recorded per color at seating time", () => {
  const manager = new RoomManager();
  const host = new FakeSocket(), guest = new FakeSocket();
  const gameId = manager.createInvite(asSocket(host), "private", 1400, "user-alice");
  const room = manager.joinGame(gameId, asSocket(guest), 1350, "user-bob");
  assert.deepEqual(room?.userIds, { white: "user-alice", black: "user-bob" });
});

test("onGameEnd fires with the full finished-game record once a game concludes", () => {
  const finished: any[] = [];
  const manager = new RoomManager(undefined, (game) => finished.push(game));
  const host = new FakeSocket(), guest = new FakeSocket();
  const gameId = manager.createInvite(asSocket(host), "private", 1400, "user-alice");
  manager.joinGame(gameId, asSocket(guest), 1350, "user-bob");

  const moves: [FakeSocket, string][] = [
    [host, "f2f3"], [guest, "e7e5"], [host, "g2g4"], [guest, "d8h4"],
  ];
  for (const [socket, move] of moves) manager.handleMove(asSocket(socket), move);

  assert.equal(finished.length, 1);
  assert.equal(finished[0].whiteId, "user-alice");
  assert.equal(finished[0].blackId, "user-bob");
  assert.equal(finished[0].whiteRatingBefore, 1400);
  assert.equal(finished[0].blackRatingBefore, 1350);
  assert.equal(finished[0].status, "checkmate");
  assert.equal(finished[0].winner, "black");
  assert.deepEqual(finished[0].moves, ["f2f3", "e7e5", "g2g4", "d8h4"]);
  assert.equal(typeof finished[0].startedAt, "number");
});

test("onGameEnd does not fire for a room that never had both players seated", () => {
  const finished: any[] = [];
  const manager = new RoomManager(undefined, (game) => finished.push(game));
  const host = new FakeSocket();
  manager.createInvite(asSocket(host), "private");
  manager.leaveGame(asSocket(host));
  assert.equal(finished.length, 0);
});

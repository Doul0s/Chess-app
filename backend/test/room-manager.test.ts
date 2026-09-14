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

test("joinGame assigns colors once both sockets connect", () => {
  const { white, black } = setupRoom();
  assert.equal(white.sent.at(-1), "white");
  assert.equal(black.sent.at(-1), "black");
});

test("valid move is broadcast to the opponent only", () => {
  const { manager, white, black } = setupRoom();
  manager.handleMove(asSocket(white), "e2e4");
  assert.equal(black.sent.at(-1), "e2e4");
  assert.equal(white.sent.length, 1);
});

test("illegal move sends the reason back to the sender only", () => {
  const { manager, white, black } = setupRoom();
  manager.handleMove(asSocket(white), "e2e5");
  assert.equal(white.sent.at(-1), "illegal_move");
  assert.equal(black.sent.length, 1);
});

test("checkmate ends the game and notifies both players with the winner", () => {
  const { manager, white, black } = setupRoom();
  const moves: [FakeSocket, string][] = [
    [white, "f2f3"], [black, "e7e5"], [white, "g2g4"], [black, "d8h4"],
  ];
  for (const [socket, move] of moves) manager.handleMove(asSocket(socket), move);

  assert.equal(white.sent.at(-1), "game_over:checkmate:black");
  assert.equal(black.sent.at(-1), "game_over:checkmate:black");
  assert.equal(white.readyState, FakeSocket.CLOSED);
  assert.equal(black.readyState, FakeSocket.CLOSED);
});

test("disconnect during an active game notifies the opponent and drops the room", () => {
  const { manager, white, black } = setupRoom();
  manager.leaveGame(asSocket(white));
  assert.equal(black.sent.at(-1), "opponent_disconnected");
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

  assert.equal(white.sent.at(-1), "game_over:timeout:black");
  assert.equal(black.sent.at(-1), "game_over:timeout:black");
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
  assert.equal(white.sent.filter(m => m.startsWith("game_over")).length, 0);

  t.mock.timers.tick(1);
  assert.equal(white.sent.at(-1), "game_over:timeout:black");
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
  assert.equal(white.sent.at(-1), "illegal_move");

  t.mock.timers.tick(299);
  assert.equal(white.sent.filter(m => m.startsWith("game_over")).length, 0);

  t.mock.timers.tick(1);
  assert.equal(white.sent.at(-1), "game_over:timeout:black");
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
  assert.equal(black.sent.filter(m => m === "opponent_disconnected").length, 1);
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

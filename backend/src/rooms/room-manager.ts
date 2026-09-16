import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import { ChessGame, DEFAULT_CLOCK_MS } from "../chess/chess-game.js";
import { moveToLan } from "../chess/move-generator.js";
import type { Color, GameStatus } from "../chess/types.js";
import { opposite } from "../chess/types.js";
import { DEFAULT_RATING } from "../rating/elo.js";
import { send } from "./protocol.js";
import type { GameEndHandler } from "./game-record.js";

export type RoomVisibility = "public" | "private";

export interface GameRoom {
  id: string;
  visibility: RoomVisibility;
  white: WebSocket | null;
  black: WebSocket | null;
  userIds: { white: string | null; black: string | null };
  ratings: { white: number | null; black: number | null };
  game: ChessGame;
  turnTimer: NodeJS.Timeout | null;
  turnStartedAt: number;
  startedAt: number | null;
}

export class RoomManager {
  private waitingForMatch: WebSocket | null = null;
  private readonly rooms = new Map<string, GameRoom>();

  constructor(
    private readonly clockMs: number = DEFAULT_CLOCK_MS,
    private readonly onGameEnd?: GameEndHandler,
  ) {}

  // Matchmaking id and color assignment are raw strings per the /rooms contract;
  // all other protocol messages use the JSON envelope in protocol.ts.

  matchmake(socket: WebSocket): void {
    if (!this.waitingForMatch) { this.waitingForMatch = socket; return; }
    const opponent = this.waitingForMatch;
    this.waitingForMatch = null;
    const room = this.openRoom("private");
    opponent.send(room.id);
    socket.send(room.id);
    opponent.close();
    socket.close();
  }

  leaveMatchmaking(socket: WebSocket): void { if (this.waitingForMatch === socket) this.waitingForMatch = null; }

  createInvite(socket: WebSocket, visibility: RoomVisibility, rating: number = DEFAULT_RATING, userId: string | null = null): string {
    const room = this.openRoom(visibility);
    room.white = socket;
    room.ratings.white = rating;
    room.userIds.white = userId;
    socket.send(room.id);
    return room.id;
  }

  listPublicRooms(): string[] {
    return [...this.rooms.values()]
      .filter(room => room.visibility === "public" && room.white && !room.black)
      .map(room => room.id);
  }

  joinGame(gameId: string, socket: WebSocket, rating: number = DEFAULT_RATING, userId: string | null = null): GameRoom | null {
    const room = this.rooms.get(gameId);
    if (!room || (room.white && room.black)) return null;
    if (!room.white) { room.white = socket; room.ratings.white = rating; room.userIds.white = userId; return room; }
    room.black = socket;
    room.ratings.black = rating;
    room.userIds.black = userId;
    room.startedAt = Date.now();
    room.white.send("white");
    room.black.send("black");
    this.scheduleFlag(room, "white");
    return room;
  }

  leaveGame(socket: WebSocket): void {
    const found = this.findRoomBySocket(socket);
    if (!found) return;
    const { room } = found;
    if (room.turnTimer) clearTimeout(room.turnTimer);
    const opponent = room.white === socket ? room.black : room.white;
    this.rooms.delete(room.id);
    if (opponent) {
      send(opponent, { type: "opponent_disconnected" });
      opponent.close();
    }
  }

  handleMove(socket: WebSocket, message: string): void {
    const found = this.findRoomBySocket(socket);
    if (!found) return;
    const { room, color } = found;

    if (!room.white || !room.black) {
      send(socket, { type: "game_not_started" });
      return;
    }

    if (room.turnTimer) clearTimeout(room.turnTimer);
    const elapsedMs = Date.now() - room.turnStartedAt;

    const result = room.game.makeMove(color, message.trim(), elapsedMs);
    if (!result.ok) {
      send(socket, { type: "error", reason: result.reason });
      if (room.game.status !== "active") { this.endGame(room, opposite(color)); return; }
      this.scheduleFlag(room, color);
      return;
    }

    const opponent = color === "white" ? room.black : room.white;
    send(opponent, { type: "move", move: message.trim() });

    if (room.game.status !== "active") {
      this.endGame(room, room.game.status === "checkmate" ? color : undefined);
      return;
    }

    this.scheduleFlag(room, opposite(color));
  }

  private openRoom(visibility: RoomVisibility): GameRoom {
    const room: GameRoom = {
      id: randomUUID(), visibility, white: null, black: null,
      userIds: { white: null, black: null },
      ratings: { white: null, black: null },
      game: new ChessGame(this.clockMs), turnTimer: null, turnStartedAt: 0, startedAt: null,
    };
    this.rooms.set(room.id, room);
    return room;
  }

  private scheduleFlag(room: GameRoom, color: Color): void {
    room.turnStartedAt = Date.now();
    room.turnTimer = setTimeout(() => {
      room.game.expireClock(color);
      this.endGame(room, opposite(color));
    }, room.game.remainingMs(color)).unref();
  }

  private endGame(room: GameRoom, winner?: Color): void {
    if (room.turnTimer) clearTimeout(room.turnTimer);
    // endGame is only ever called once room.game.status has left "active" (see call sites).
    const status = room.game.status as Exclude<GameStatus, "active">;

    for (const socket of [room.white, room.black]) {
      if (!socket) continue;
      send(socket, winner ? { type: "game_over", status, winner } : { type: "game_over", status });
      socket.close();
    }

    if (room.startedAt !== null) {
      this.onGameEnd?.({
        id: room.id,
        whiteId: room.userIds.white,
        blackId: room.userIds.black,
        whiteRatingBefore: room.ratings.white,
        blackRatingBefore: room.ratings.black,
        status,
        winner: winner ?? null,
        moves: room.game.history.map(moveToLan),
        startedAt: room.startedAt,
      });
    }

    this.rooms.delete(room.id);
  }

  private findRoomBySocket(socket: WebSocket): { room: GameRoom; color: Color } | null {
    for (const room of this.rooms.values()) {
      if (room.white === socket) return { room, color: "white" };
      if (room.black === socket) return { room, color: "black" };
    }
    return null;
  }
}

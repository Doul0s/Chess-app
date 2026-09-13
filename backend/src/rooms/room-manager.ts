import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import { ChessGame, DEFAULT_CLOCK_MS } from "../chess/chess-game.js";
import type { Color } from "../chess/types.js";
import { opposite } from "../chess/types.js";

export interface GameRoom {
  id: string;
  white: WebSocket | null;
  black: WebSocket | null;
  game: ChessGame;
  turnTimer: NodeJS.Timeout | null;
  turnStartedAt: number;
}

export class RoomManager {
  private waitingForMatch: WebSocket | null = null;
  private readonly rooms = new Map<string, GameRoom>();

  constructor(private readonly clockMs: number = DEFAULT_CLOCK_MS) {}

  matchmake(socket: WebSocket): void {
    if (!this.waitingForMatch) { this.waitingForMatch = socket; return; }
    const opponent = this.waitingForMatch;
    this.waitingForMatch = null;
    const room: GameRoom = {
      id: randomUUID(), white: null, black: null,
      game: new ChessGame(this.clockMs), turnTimer: null, turnStartedAt: 0,
    };
    this.rooms.set(room.id, room);
    opponent.send(room.id);
    socket.send(room.id);
    opponent.close();
    socket.close();
  }

  leaveMatchmaking(socket: WebSocket): void { if (this.waitingForMatch === socket) this.waitingForMatch = null; }

  joinGame(gameId: string, socket: WebSocket): GameRoom | null {
    const room = this.rooms.get(gameId);
    if (!room || (room.white && room.black)) return null;
    if (!room.white) { room.white = socket; return room; }
    room.black = socket;
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
    if (opponent && opponent.readyState === opponent.OPEN) {
      opponent.send("opponent_disconnected");
      opponent.close();
    }
  }

  handleMove(socket: WebSocket, message: string): void {
    const found = this.findRoomBySocket(socket);
    if (!found) return;
    const { room, color } = found;

    if (!room.white || !room.black) {
      socket.send("game_not_started");
      return;
    }

    if (room.turnTimer) clearTimeout(room.turnTimer);
    const elapsedMs = Date.now() - room.turnStartedAt;

    const result = room.game.makeMove(color, message.trim(), elapsedMs);
    if (!result.ok) {
      socket.send(result.reason);
      if (room.game.status !== "active") { this.endGame(room, opposite(color)); return; }
      this.scheduleFlag(room, color);
      return;
    }

    const opponent = color === "white" ? room.black : room.white;
    opponent.send(message.trim());

    if (room.game.status !== "active") {
      this.endGame(room, room.game.status === "checkmate" ? color : undefined);
      return;
    }

    this.scheduleFlag(room, opposite(color));
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
    const summary = winner ? `game_over:${room.game.status}:${winner}` : `game_over:${room.game.status}`;

    for (const socket of [room.white, room.black]) {
      if (socket && socket.readyState === socket.OPEN) {
        socket.send(summary);
        socket.close();
      }
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
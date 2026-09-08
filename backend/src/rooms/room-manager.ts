import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import { ChessGame } from "../chess/chess-game.js";

export interface GameRoom {
  id: string;
  white: WebSocket | null;
  black: WebSocket | null;
  game: ChessGame;
}

export class RoomManager {
  private waitingForMatch: WebSocket | null = null;
  private readonly rooms = new Map<string, GameRoom>();

  matchmake(socket: WebSocket): void {
    if (!this.waitingForMatch) { this.waitingForMatch = socket; return; }
    const opponent = this.waitingForMatch;
    this.waitingForMatch = null;
    const room: GameRoom = { id: randomUUID(), white: null, black: null, game: new ChessGame() };
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
    return room;
  }

  leaveGame(socket: WebSocket): void {
    for (const [id, room] of this.rooms) {
      if (room.white !== socket && room.black !== socket) continue;
      const opponent = room.white === socket ? room.black : room.white;
      this.rooms.delete(id);
      if (opponent && opponent.readyState === opponent.OPEN) {
        opponent.send("opponent_disconnected");
        opponent.close();
      }
      return;
    }
  }
}

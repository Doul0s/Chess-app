import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";

interface WaitingPlayer {
  socket: WebSocket;
}

export interface Room {
  id: string;
  players: WebSocket[];
}

export class RoomManager {
  private waitingPlayer: WaitingPlayer | null = null;
  private readonly rooms = new Map<string, Room>();

  addPlayer(socket: WebSocket): void {
    // Nobody is waiting yet.
    if (this.waitingPlayer === null) {
      this.waitingPlayer = { socket };

      console.log("Player is waiting for an opponent.");
      return;
    }

    // Match the waiting player with the new player.
    const firstPlayer = this.waitingPlayer.socket;
    this.waitingPlayer = null;

    const room: Room = {
      id: randomUUID(),
      players: [firstPlayer, socket],
    };

    this.rooms.set(room.id, room);

    firstPlayer.send(room.id);
    socket.send(room.id);

    console.log(`Game room created: ${room.id}`);
  }

  removePlayer(socket: WebSocket): void {
    // Player disconnected while waiting.
    if (this.waitingPlayer?.socket === socket) {
      this.waitingPlayer = null;

      console.log("Waiting player disconnected.");
      return;
    }

    for (const [id, room] of this.rooms) {
      const playerIndex = room.players.indexOf(socket);

      if (playerIndex === -1) {
        continue;
      }

      const opponent = room.players.find(
        (player) => player !== socket,
      );

      this.rooms.delete(id);

      console.log(`Player disconnected from game ${id}.`);
      console.log(`Game ${id} terminated.`);

      if (opponent && opponent.readyState === opponent.OPEN) {
        opponent.send("opponent_disconnected");
        opponent.close();
      }

      return;
    }
  }

  getRoom(id: string): Room | undefined {
    return this.rooms.get(id);
  }
}
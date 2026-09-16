import type { WebSocket } from "ws";
import type { Color, GameStatus } from "../chess/types.js";

export type ServerMessage =
  | { type: "move"; move: string }
  | { type: "error"; reason: string }
  | { type: "game_over"; status: Exclude<GameStatus, "active">; winner?: Color }
  | { type: "opponent_disconnected" }
  | { type: "game_not_started" };

export function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

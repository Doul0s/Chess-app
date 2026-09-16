import type { Color } from "../chess/types.js";

export type ServerMessage =
  | {
      type: "match_found";
      gameId: string;
    }
  | {
      type: "player_color";
      color: Color;
    }
  | {
      type: "move";
      move: string;
      color: Color;
    }
  | {
      type: "error";
      code: string;
    }
  | {
      type: "game_over";
      reason: string;
      winner?: Color;
    }
  | {
      type: "opponent_disconnected";
    };

export function sendMessage(
  socket: { send(data: string): void },
  message: ServerMessage,
): void {
  socket.send(JSON.stringify(message));
}
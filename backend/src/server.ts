import { createServer } from "node:http";
import { WebSocketServer } from "ws";

import { config } from "./config.js";
import { RoomManager } from "./rooms/room-manager.js";

const server = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("chess server");
});

const roomManager = new RoomManager();
const matchmakingWss = new WebSocketServer({ noServer: true });
const gameWss = new WebSocketServer({ noServer: true });

matchmakingWss.on("connection", (socket) => {
  roomManager.matchmake(socket);
  socket.on("close", () => roomManager.leaveMatchmaking(socket));
  socket.on("error", () => roomManager.leaveMatchmaking(socket));
});

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (url.pathname === "/rooms") {
    matchmakingWss.handleUpgrade(request, socket, head, (ws) => {
      matchmakingWss.emit("connection", ws);
    });
    return;
  }

  const gameMatch = url.pathname.match(/^\/rooms\/([^/]+)$/);
  if (gameMatch) {
    const gameId = gameMatch[1]!;
    gameWss.handleUpgrade(request, socket, head, (ws) => {
      const room = roomManager.joinGame(gameId, ws);
      if (!room) {
        ws.close();
        return;
      }
      ws.on("message", (data) => roomManager.handleMove(ws, data.toString()));
      ws.on("close", () => roomManager.leaveGame(ws));
      ws.on("error", () => roomManager.leaveGame(ws));
    });
    return;
  }

  socket.destroy();
});

server.listen(config.port, () => {
  console.log(`Chess server listening on port ${config.port}`);
});
import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";

import { config } from "./config.js";
import { RoomManager } from "./rooms/room-manager.js";

const roomManager = new RoomManager();

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "GET" && url.pathname === "/rooms/public") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(roomManager.listPublicRooms()));
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("chess server");
});

const matchmakingWss = new WebSocketServer({ noServer: true });
const gameWss = new WebSocketServer({ noServer: true });
const inviteWss = new WebSocketServer({ noServer: true });

function parseRating(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function wireGameSocket(ws: WebSocket): void {
  ws.on("message", (data) => roomManager.handleMove(ws, data.toString()));
  ws.on("close", () => roomManager.leaveGame(ws));
  ws.on("error", () => roomManager.leaveGame(ws));
}

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

  if (url.pathname === "/invite") {
    const visibility = url.searchParams.get("visibility") === "public" ? "public" : "private";
    const rating = parseRating(url.searchParams.get("rating"));
    inviteWss.handleUpgrade(request, socket, head, (ws) => {
      roomManager.createInvite(ws, visibility, rating);
      wireGameSocket(ws);
    });
    return;
  }

  const gameMatch = url.pathname.match(/^\/rooms\/([^/]+)$/);
  if (gameMatch) {
    const gameId = gameMatch[1]!;
    const rating = parseRating(url.searchParams.get("rating"));
    gameWss.handleUpgrade(request, socket, head, (ws) => {
      const room = roomManager.joinGame(gameId, ws, rating);
      if (!room) {
        ws.close();
        return;
      }
      wireGameSocket(ws);
    });
    return;
  }

  socket.destroy();
});

server.listen(config.port, () => {
  console.log(`Chess server listening on port ${config.port}`);
});

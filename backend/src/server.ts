import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";

import { config } from "./config.js";
import { RoomManager } from "./rooms/room-manager.js";
import { hashPassword, verifyPassword } from "./auth/password.js";
import { signToken, verifyToken } from "./auth/token.js";
import { createUser, findUserByUsername, getRating } from "./auth/users-repository.js";
import { recordGame } from "./db/games-repository.js";
import { DEFAULT_CLOCK_MS } from "./chess/chess-game.js";
import { DEFAULT_RATING } from "./rating/elo.js";

const roomManager = new RoomManager(DEFAULT_CLOCK_MS, (game) => {
  recordGame(game).catch((error) => console.error("failed to record game", game.id, error));
});

function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function withErrorHandling(res: ServerResponse, handler: () => Promise<void>): Promise<void> {
  try {
    await handler();
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "internal_error" });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "GET" && url.pathname === "/rooms/public") {
    sendJson(res, 200, roomManager.listPublicRooms());
    return;
  }

  if (req.method === "POST" && url.pathname === "/register") {
    await withErrorHandling(res, async () => {
      const { username, password } = await readJsonBody(req);
      if (typeof username !== "string" || username.length < 3 || typeof password !== "string" || password.length < 8) {
        sendJson(res, 400, { error: "username must be 3+ chars, password 8+ chars" });
        return;
      }
      if (await findUserByUsername(username)) {
        sendJson(res, 409, { error: "username_taken" });
        return;
      }
      const user = await createUser(username, await hashPassword(password));
      sendJson(res, 201, { token: signToken(user.id), userId: user.id, rating: user.rating });
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/login") {
    await withErrorHandling(res, async () => {
      const { username, password } = await readJsonBody(req);
      const user = typeof username === "string" ? await findUserByUsername(username) : null;
      if (!user || typeof password !== "string" || !(await verifyPassword(password, user.passwordHash))) {
        sendJson(res, 401, { error: "invalid_credentials" });
        return;
      }
      sendJson(res, 200, { token: signToken(user.id), userId: user.id, rating: user.rating });
    });
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

// Auth is additive: no ?token= means anonymous play. A token that is supplied
// must be valid, or the upgrade is rejected outright.
async function resolvePlayer(url: URL): Promise<{ rating: number; userId: string | null } | null> {
  const token = url.searchParams.get("token");
  if (!token) return { rating: parseRating(url.searchParams.get("rating")) ?? DEFAULT_RATING, userId: null };

  const userId = verifyToken(token);
  if (!userId) return null;
  const rating = await getRating(userId);
  return rating === null ? null : { rating, userId };
}

function rejectUpgrade(socket: import("node:stream").Duplex): void {
  socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
  socket.destroy();
}

function upgradeAuthenticated(
  wss: WebSocketServer,
  request: IncomingMessage,
  socket: import("node:stream").Duplex,
  head: Buffer,
  url: URL,
  onReady: (ws: WebSocket, player: { rating: number; userId: string | null }) => void,
): void {
  resolvePlayer(url).then((player) => {
    if (!player) { rejectUpgrade(socket); return; }
    wss.handleUpgrade(request, socket, head, (ws) => onReady(ws, player));
  });
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
    upgradeAuthenticated(inviteWss, request, socket, head, url, (ws, player) => {
      roomManager.createInvite(ws, visibility, player.rating, player.userId);
      wireGameSocket(ws);
    });
    return;
  }

  const gameMatch = url.pathname.match(/^\/rooms\/([^/]+)$/);
  if (gameMatch) {
    const gameId = gameMatch[1]!;
    upgradeAuthenticated(gameWss, request, socket, head, url, (ws, player) => {
      const room = roomManager.joinGame(gameId, ws, player.rating, player.userId);
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

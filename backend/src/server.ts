import { createServer } from "http";
import WebSocket, { WebSocketServer } from "ws";

import { config } from "./config.js";
import { RoomManager } from "./rooms/room-manager.js";

const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end(JSON.stringify({
    status: "Server is running",
    service: "Chess-server",
  }));
});

const roomManager = new RoomManager();
const roomWss = new WebSocketServer({ noServer: true });

roomWss.on("connection", (socket) => {
    console.log("Player connected");
    roomManager.addPlayer(socket);

    socket.on("close", () => {
      console.log("Player disconnected");
      roomManager.removePlayer(socket);
    });

    socket.on("error", (error) => {
      console.error("WebSocket error:", error);
      roomManager.removePlayer(socket);
    });
});

server.on("upgrade", (request, socket, head) => {
  const url = new URL(
    request.url ?? "/",
    `http://${request.headers.host ?? "localhost"}`,
  );

  if (url.pathname !== "/room") {
    socket.destroy();
    return;
  }

  roomWss.handleUpgrade(request, socket, head, (ws) => {
    roomWss.emit("connection", ws, request);
  });
});

server.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
  console.log('Listening on http://localhost:' + config.port + '/');
});
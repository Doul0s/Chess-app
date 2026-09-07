import { createServer } from "http";
import { config } from "./config.js";

const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end(JSON.stringify({
    status: "Server is running",
    service: "Chess-server",
  }));
});

server.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
  console.log('Listening on http://localhost:' + config.port + '/');
});
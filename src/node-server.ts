import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { WebSocketServer } from "ws";
import { api } from "./router.ts";
import { postgresPersistence } from "./adapters/postgres.ts";
import { migratePostgres } from "./adapters/postgres-migrations.ts";
import { requireUser } from "./middleware/auth.middleware.ts";
import { matchApiRoute } from "./routes/match-route.ts";
import { errorResponse, HttpError, sameOrigin } from "./http.ts";
import { attachRoomSocket } from "./room-socket.ts";
import { loadRoomConnection } from "./services/room.service.ts";
import { readBody, respond, webRequest } from "./http/node-http.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Configura DATABASE_URL para iniciar el backend PostgreSQL.");
const port = Number(process.env.PORT ?? 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT no es válido.");
const pool = new Pool({ connectionString, max: 10, connectionTimeoutMillis: 10_000 });
pool.on("error", (error) => console.error("La conexión PostgreSQL falló:", error.message));
await migratePostgres(pool, fileURLToPath(new URL("../db/postgres/", import.meta.url)));
const store = postgresPersistence(pool);

const server = createServer((request, response) => {
  void (async () => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (!url.pathname.startsWith("/api/")) throw new HttpError(404, "Ruta no encontrada.");
      await respond(response, await api(webRequest(request, port, await readBody(request)), store), request.method === "HEAD");
    } catch (error) { if (!response.headersSent) await respond(response, errorResponse(error)); else response.destroy(); }
  })();
});

const sockets = new WebSocketServer({ noServer: true, maxPayload: 2048 });
server.on("upgrade", (request, socket, head) => {
  socket.on("error", () => socket.destroy());
  void (async () => {
    try {
      const incoming = webRequest(request, port);
      const match = matchApiRoute(incoming.method, new URL(incoming.url).pathname);
      if (!match || match.route.transport !== "websocket") throw new HttpError(404, "Ruta no encontrada.");
      const code = match.params.code;
      sameOrigin(incoming);
      const user = await requireUser(store.sessions, incoming);
      const initial = await loadRoomConnection(store.rooms, code, user.id);
      sockets.handleUpgrade(request, socket, head, (client) => {
        attachRoomSocket({
          get readyState() { return client.readyState; },
          send: (data) => client.send(data),
          close: (code, reason) => client.close(code, reason),
          onMessage: (listener) => client.on("message", (data, binary) => listener(binary ? data : data.toString())),
          onClose: (listener) => client.on("close", listener),
          onError: (listener) => client.on("error", listener),
        }, store.rooms, code, user.id, initial);
      });
    } catch (error) {
      const result = errorResponse(error);
      const text = await result.text();
      socket.end(`HTTP/1.1 ${result.status} Error\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(text)}\r\nConnection: close\r\n\r\n${text}`);
    }
  })();
});

server.listen(port, process.env.HOST ?? "0.0.0.0", () => console.log(`FlashReto con PostgreSQL: http://localhost:${port}`));
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  for (const client of sockets.clients) client.close(1001, "Servidor detenido");
  setTimeout(() => process.exit(1), 5000).unref();
  await new Promise<void>((done) => server.close(() => done()));
  await pool.end();
}
process.on("SIGTERM", () => { void stop(); });
process.on("SIGINT", () => { void stop(); });

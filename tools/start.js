/* =========================================================
   START.JS - Khởi chạy chung Frontend tĩnh + REST API (json-server)
   Hỗ trợ cả môi trường local (cổng 3000) và cloud hosting (PORT từ env)
   ========================================================= */

import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const jsonServer = require("json-server");

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

const app = jsonServer.create();
const router = jsonServer.router(path.resolve("db.json"));
const middlewares = jsonServer.defaults({
  static: process.cwd(),
  bodyParser: true,
});

app.use(middlewares);
app.use(router);

const server = app.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);


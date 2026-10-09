/**
 * SERVER.JS - Máy chủ tĩnh tối giản, KHÔNG cần cài thêm gói nào
 * (chỉ dùng module lõi "http", "fs", "path" có sẵn trong Node.js).
 *
 * Vì sao cần file này?
 * Các trang trong dự án dùng <script type="module">, và trình duyệt
 * áp dụng chính sách bảo mật CORS chặn việc nạp module khi mở trực
 * tiếp file HTML kiểu "file:///..." (đặc biệt là Chrome/Edge). Chạy
 * qua một server "http://localhost" thì không gặp vấn đề này.
 *
 * Ghi chú: cách chạy KHUYẾN NGHỊ là "npm start" - json-server phục vụ
 * luôn cả trang web lẫn API ở cổng 3000. Server này chỉ là phương án
 * thay thế khi muốn tách riêng: chạy "npm run api" (API ở 3000) và
 * "npm run web" (trang web ở 5500) trên 2 cửa sổ dòng lệnh.
 *
 * Cách chạy:
 *   npm run web          (hoặc: node tools/server.js)
 * rồi mở trình duyệt tới http://localhost:5500
 *
 * Đổi cổng khác (nếu 5500 đang bận):
 *   node tools/server.js 8080
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2]) || 5500;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";

  const filePath = path.join(ROOT, urlPath);

  // Chặn truy cập ra ngoài thư mục dự án (bảo mật cơ bản)
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("403 Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<h1>404 - Không tìm thấy: ${urlPath}</h1><p><a href="/">Về trang chủ</a></p>`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log("");
  console.log("  🍸 Quán Bar Đêm - máy chủ đã sẵn sàng!");
  console.log(`  ➜  Mở trình duyệt tại: http://localhost:${PORT}`);
  console.log("  ➜  Nhấn Ctrl+C để dừng server.");
  console.log("");
});

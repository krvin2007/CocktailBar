/* =========================================================
   KIEM-TRA-MODULE.JS - Kiểm tra liên kết import/export
   Chạy: npm run check   (hoặc: node tools/kiem-tra-module.js)

   `node --check` chỉ bắt lỗi CÚ PHÁP. Lỗi kiểu
       import { openModal } from "./ui.js"
   trong khi ui.js không export openModal thì cú pháp vẫn đúng,
   nhưng trình duyệt sẽ DỪNG NẠP CẢ MODULE -> trang trắng trơn.
   Script này đọc mọi file .js, đối chiếu từng tên được import
   với danh sách export thật của file đích, và báo những chỗ hỏng.
   ========================================================= */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JS_DIR = path.join(ROOT, "js");

/** Liệt kê đệ quy mọi file .js trong thư mục */
function listJs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJs(full);
    return entry.name.endsWith(".js") ? [full] : [];
  });
}

/** Bỏ comment để không bắt nhầm chữ "import" nằm trong chú thích */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

/** Tập tên được export bởi một file */
function exportsOf(file) {
  const src = stripComments(fs.readFileSync(file, "utf8"));
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(m[1]);
  }
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    m[1].split(",").map((s) => s.trim()).filter(Boolean).forEach((part) => {
      const alias = part.split(/\s+as\s+/);
      names.add((alias[1] || alias[0]).trim());
    });
  }
  if (/export\s+default\b/.test(src)) names.add("default");
  return names;
}

/** Danh sách { names, target } cho mọi câu import tương đối trong một file */
function importsOf(file) {
  const src = stripComments(fs.readFileSync(file, "utf8"));
  const result = [];
  // Mệnh đề import không được chứa dấu ; hay dấu nháy - tránh bắt dính sang
  // câu import phía trước (VD: import "./ui.js"; import { x } from "./y.js")
  for (const m of src.matchAll(/import\s+([^;"'`]*?)\s+from\s+["'](\.[^"']+)["']/g)) {
    const clause = m[1];
    const names = [];
    const braces = clause.match(/\{([^}]*)\}/);
    if (braces) {
      braces[1].split(",").map((s) => s.trim()).filter(Boolean)
        .forEach((part) => names.push(part.split(/\s+as\s+/)[0].trim()));
    }
    const defaultName = clause.replace(/\{[^}]*\}/, "").replace(/\*\s+as\s+\w+/, "").replace(/,/g, "").trim();
    if (defaultName) names.push("default");
    result.push({ names, target: m[2] });
  }
  for (const m of src.matchAll(/import\s+["'](\.[^"']+)["']/g)) {
    result.push({ names: [], target: m[1] });
  }
  return result;
}

const files = listJs(JS_DIR);
const exportCache = new Map();
const problems = [];

for (const file of files) {
  for (const { names, target } of importsOf(file)) {
    const resolved = path.resolve(path.dirname(file), target);
    const rel = path.relative(ROOT, file);
    if (!fs.existsSync(resolved)) {
      problems.push(`${rel}: không tìm thấy file "${target}"`);
      continue;
    }
    if (!exportCache.has(resolved)) exportCache.set(resolved, exportsOf(resolved));
    const available = exportCache.get(resolved);
    names.filter((n) => !available.has(n)).forEach((n) => {
      problems.push(`${rel}: import { ${n} } nhưng "${target}" không export tên này`);
    });
  }
}

console.log(`Đã kiểm tra ${files.length} file JavaScript.`);
if (problems.length) {
  console.log(`\nPHÁT HIỆN ${problems.length} LỖI LIÊN KẾT MODULE:`);
  problems.forEach((p) => console.log("  - " + p));
  process.exit(1);
}
console.log("Mọi import đều khớp với export - không có module nào bị dừng nạp.");

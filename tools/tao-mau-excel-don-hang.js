/* =========================================================
   TAO-MAU-EXCEL-DON-HANG.JS - Tạo file Mau-Nhap-Don-Hang.xlsx ở thư mục gốc
   Chạy: node tools/tao-mau-excel-don-hang.js
   ========================================================= */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildXlsxBytes } from "../js/modules/xlsxHelper.js";
import { ORDER_IMPORT_HEADERS, ORDER_IMPORT_SAMPLE_ROWS } from "../js/modules/exportService.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(ROOT, "Mau-Nhap-Don-Hang.xlsx");
const bytes = buildXlsxBytes(ORDER_IMPORT_SAMPLE_ROWS, ORDER_IMPORT_HEADERS, "NhapDonHang");

fs.writeFileSync(outPath, bytes);
console.log(`Đã tạo file mẫu Excel nhập đơn hàng: ${outPath} (${bytes.length} bytes)`);


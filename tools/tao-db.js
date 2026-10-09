/* =========================================================
   TAO-DB.JS - Sinh file db.json (cơ sở dữ liệu của json-server)
   Chạy: npm run seed   (hoặc: node tools/tao-db.js)

   Lấy dữ liệu mẫu từ chính các module của website (SEED_DRINKS,
   SEED_ORDERS...) để chỉ có MỘT nguồn dữ liệu mẫu duy nhất - không
   phải chép tay hai nơi rồi lệch nhau.

   Dùng khi nào:
   - Lần đầu cài đặt dự án.
   - Muốn khôi phục dữ liệu demo về trạng thái ban đầu trước buổi
     bảo vệ (ngày giờ các đơn mẫu cũng được làm mới về "7 ngày gần
     nhất" để biểu đồ doanh thu trên Dashboard có số liệu).
   json-server chỉ đọc db.json lúc khởi động -> hãy chạy lệnh này khi
   server đang TẮT, hoặc tắt (Ctrl+C) rồi "npm start" lại sau khi chạy.
   ========================================================= */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Các module seed có dùng localStorage bên trong hàm (không chạy lúc import),
// nhưng storage.js vẫn cần biến toàn cục tồn tại - giả lập tối thiểu.
globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.sessionStorage ??= globalThis.localStorage;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = (name) => new URL(`../js/modules/${name}`, import.meta.url).href;

const { SEED_DRINKS } = await import(modulePath("drinksService.js"));
const { SEED_ORDERS } = await import(modulePath("ordersService.js"));
const { SEED_STAFF } = await import(modulePath("staffService.js"));
const { SPIRITS_COLLECTION } = await import(modulePath("spiritsData.js"));
const { BARTENDERS_COLLECTION } = await import(modulePath("bartendersData.js"));
const { COLLECTORS_COLLECTION } = await import(modulePath("collectorsData.js"));

// JSON.parse(JSON.stringify(...)) biến các instance class Drink thành object thuần
const plain = (data) => JSON.parse(JSON.stringify(data));

const db = {
  drinks: plain(SEED_DRINKS),
  orders: plain(SEED_ORDERS),
  staff: plain(SEED_STAFF),
  messages: [],
  spirits: plain(SPIRITS_COLLECTION),
  bartenders: plain(BARTENDERS_COLLECTION),
  collectors: plain(COLLECTORS_COLLECTION),
};

const target = path.join(ROOT, "db.json");
fs.writeFileSync(target, JSON.stringify(db, null, 2) + "\n", "utf8");

console.log(`Đã tạo ${path.relative(ROOT, target)} (nếu json-server đang chạy, hãy khởi động lại):`);
Object.entries(db).forEach(([name, list]) => {
  console.log(`  /${name.padEnd(11)} ${String(list.length).padStart(3)} bản ghi`);
});

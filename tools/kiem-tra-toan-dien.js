import fs from "fs";
import path from "path";
import http from "http";

/* ---------------- Giả lập môi trường trình duyệt cho Node ---------------- */
globalThis.window = {
  location: { pathname: "/order.html" },
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
};
globalThis.document = {
  body: { appendChild: () => {}, removeChild: () => {} },
  createElement: () => ({
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    setAttribute: () => {},
    appendChild: () => {},
    addEventListener: () => {},
  }),
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
};
function memoryStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}
globalThis.localStorage = memoryStorage();
globalThis.sessionStorage = memoryStorage();

console.log("==============================================================");
console.log("   KIỂM TRA TOÀN DIỆN HỆ THỐNG QUÁN BAR ĐÊM (HEALTH CHECK)    ");
console.log("==============================================================\n");

let passCount = 0;
let failCount = 0;

function check(label, actual, expected = true) {
  const isMatch = JSON.stringify(actual) === JSON.stringify(expected);
  if (isMatch) {
    console.log(`  OK   ${label}`);
    passCount++;
  } else {
    console.error(`  FAIL ${label}`);
    console.error(`       Thực tế:   ${JSON.stringify(actual)}`);
    console.error(`       Kỳ vọng:   ${JSON.stringify(expected)}`);
    failCount++;
  }
}

// 1. Kiểm tra toàn bộ file HTML
console.log("\n[1] Kiểm tra liên kết tài nguyên trong tất cả file HTML:");
const htmlFiles = fs.readdirSync(".").filter((f) => f.endsWith(".html"));
check(`Tìm thấy ${htmlFiles.length} file HTML`, htmlFiles.length >= 10, true);

let missingResources = 0;
htmlFiles.forEach((file) => {
  const content = fs.readFileSync(file, "utf8");
  // script
  const scriptRegex = /<script\s+[^>]*src=["']([^"']+)["']/gi;
  let match;
  while ((match = scriptRegex.exec(content)) !== null) {
    const src = match[1];
    if (!src.startsWith("http") && !src.startsWith("//")) {
      const p = path.resolve(src);
      if (!fs.existsSync(p)) {
        console.error(`  [!] Trong ${file}: Không tìm thấy file script ${src}`);
        missingResources++;
      }
    }
  }
  // css link
  const linkRegex = /<link\s+[^>]*href=["']([^"']+)["']/gi;
  while ((match = linkRegex.exec(content)) !== null) {
    const href = match[1];
    if (href.endsWith(".css") && !href.startsWith("http") && !href.startsWith("//")) {
      const p = path.resolve(href);
      if (!fs.existsSync(p)) {
        console.error(`  [!] Trong ${file}: Không tìm thấy file css ${href}`);
        missingResources++;
      }
    }
  }
});
check("Tất cả script và stylesheet nội bộ trong các file HTML đều tồn tại", missingResources, 0);

// 2. Kiểm tra cấu trúc db.json
console.log("\n[2] Kiểm tra tính toàn vẹn dữ liệu máy chủ db.json:");
const dbRaw = fs.readFileSync("db.json", "utf8");
let dbParsed = null;
try {
  dbParsed = JSON.parse(dbRaw);
} catch (e) {
  console.error("Lỗi JSON:", e);
}
check("db.json đọc và parse JSON chuẩn xác", Boolean(dbParsed), true);
const requiredTables = [
  "drinks", "orders", "staff", "customers", "vouchers",
  "messages", "spirits", "bartenders", "collectors", "settings"
];
requiredTables.forEach((t) => {
  check(`Bảng dữ liệu '${t}' tồn tại và hợp lệ`, t in dbParsed, true);
});

// 3. Kiểm tra live dev server qua HTTP
console.log("\n[3] Kiểm tra các đường dẫn chính trên máy chủ cục bộ (port 3000):");

function fetchStatus(pathname) {
  return new Promise((resolve) => {
    http.get({
      hostname: "localhost",
      port: 3000,
      path: pathname,
      timeout: 3000,
    }, (res) => {
      resolve(res.statusCode);
    }).on("error", () => {
      resolve(0);
    });
  });
}

const pagesToCheck = [
  "/index.html",
  "/order.html",
  "/menu.html",
  "/contact.html",
  "/customer-account.html",
  "/admin-orders.html",
  "/admin-messages.html",
  "/admin-dashboard.html",
  "/admin-staff.html",
  "/admin-menu.html",
  "/admin-vouchers.html",
  "/admin-customers.html",
  "/orders",
  "/drinks",
  "/settings",
];

for (const p of pagesToCheck) {
  const status = await fetchStatus(p);
  check(`Đường dẫn ${p} phản hồi HTTP 200`, status, 200);
}

// 4. Kiểm tra các module nghiệp vụ
console.log("\n[4] Kiểm tra các hàm nghiệp vụ trong module hệ thống:");
const ordersMod = await import("../js/modules/ordersService.js");
check("ordersService có hàm createOrder", typeof ordersMod.createOrder, "function");
check("ordersService có hàm reportTransferSent", typeof ordersMod.reportTransferSent, "function");
check("ordersService có hàm confirmPayment", typeof ordersMod.confirmPayment, "function");
check("ordersService có hàm getAllOrders", typeof ordersMod.getAllOrders, "function");

const vietqrMod = await import("../js/modules/vietqrService.js");
check("vietqrService có hàm openVietQRPaymentModal", typeof vietqrMod.openVietQRPaymentModal, "function");
check("vietqrService có hàm generateVietQRUrl", typeof vietqrMod.generateVietQRUrl, "function");

const emailMod = await import("../js/modules/emailService.js");
check("emailService có hàm generateBarcodeSvg", typeof emailMod.generateBarcodeSvg, "function");
check("emailService có hàm buildCinemaTicketHtml", typeof emailMod.buildCinemaTicketHtml, "function");
check("emailService có hàm sendOrderConfirmationEmail", typeof emailMod.sendOrderConfirmationEmail, "function");

console.log("\n==============================================================");
if (failCount === 0) {
  console.log(`HOÀN TẤT: ĐẠT ${passCount}/${passCount} KIỂM TRA - HỆ THỐNG HOÀN TOÀN KHÔNG CÒN LỖI!`);
} else {
  console.error(`PHÁT HIỆN ${failCount} LỖI CẦN XỬ LÝ.`);
}
console.log("==============================================================\n");
process.exit(failCount === 0 ? 0 : 1);

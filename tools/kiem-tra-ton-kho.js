/* =========================================================
   KIEM-TRA-TON-KHO.JS - Test khô nghiệp vụ tồn kho + đơn hàng
   Chạy: npm test   (hoặc: node tools/kiem-tra-ton-kho.js)

   Không cần trình duyệt, không cần bật json-server: script dựng một
   REST API giả lập trong bộ nhớ (thay hàm fetch toàn cục) hoạt động
   giống json-server - GET/POST/PATCH/DELETE trên các bảng - rồi chạy
   các service thật của website (drinksService, ordersService) qua nó.
   Bản giả lập cố ý bắt chước json-server 1.x: POST luôn tự sinh id
   mới, bỏ qua id do trình duyệt gửi lên.
   ========================================================= */

import assert from "node:assert";

/* ---------------- Giả lập localStorage ---------------- */
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

/* ---------------- REST API giả lập kiểu json-server ---------------- */
const fakeDb = {};
let serverOnline = true;
let idCounter = 0;

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  };
}

globalThis.fetch = async (url, options = {}) => {
  if (!serverOnline) throw new TypeError("Failed to fetch");

  const method = options.method || "GET";
  const [, collection, rawId] = new URL(url).pathname.split("/");
  const id = rawId ? decodeURIComponent(rawId) : null;
  const table = fakeDb[collection];
  if (!table) return jsonResponse(404, {});
  const body = options.body ? JSON.parse(options.body) : undefined;
  const index = id ? table.findIndex((r) => String(r.id) === id) : -1;

  if (method === "GET" && !id) return jsonResponse(200, structuredClone(table));
  if (method === "GET") return index === -1 ? jsonResponse(404, {}) : jsonResponse(200, structuredClone(table[index]));
  if (method === "POST") {
    const record = { ...body, id: `srv${++idCounter}` }; // giống json-server 1.x: tự sinh id
    table.push(record);
    return jsonResponse(201, structuredClone(record));
  }
  if (index === -1) return jsonResponse(404, {});
  if (method === "PATCH") {
    table[index] = { ...table[index], ...body, id: table[index].id };
    return jsonResponse(200, structuredClone(table[index]));
  }
  if (method === "DELETE") {
    table.splice(index, 1);
    return jsonResponse(200, {});
  }
  return jsonResponse(405, {});
};

/* ---------------- Nạp service thật của website ---------------- */
const mod = (name) => new URL(`../js/modules/${name}`, import.meta.url).href;
const drinks = await import(mod("drinksService.js"));
const orders = await import(mod("ordersService.js"));
const staff = await import(mod("staffService.js"));

function resetDb() {
  fakeDb.drinks = structuredClone(JSON.parse(JSON.stringify(drinks.SEED_DRINKS)));
  fakeDb.orders = structuredClone(orders.SEED_ORDERS);
  fakeDb.staff = structuredClone(staff.SEED_STAFF);
  fakeDb.messages = [];
  orders.clearCart();
  localStorage.clear();
  serverOnline = true;
}

/* ---------------- Khung kiểm thử ---------------- */
let failCount = 0;
let passCount = 0;
function check(label, actual, expected) {
  try {
    assert.deepStrictEqual(actual, expected);
    passCount++;
    console.log(`  OK   ${label}`);
  } catch {
    failCount++;
    console.log(`  FAIL ${label}`);
    console.log(`       mong đợi: ${JSON.stringify(expected)}`);
    console.log(`       thực tế : ${JSON.stringify(actual)}`);
  }
}
const section = (title) => console.log(`\n${title}`);
const stockOf = async (id) => (await drinks.getDrinkById(id)).stock;
const customer = (n) => ({ name: `Khách ${n}`, phone: `090000000${n}`, serviceType: "takeaway" });

/* ================================================================ */
resetDb();
const LOW = "d10";              // Macallan 12 - tồn kho mẫu 12 ly
const START = await stockOf(LOW);

section("[1] Đặt hàng trừ đúng tồn kho");
orders.addToCart(await drinks.getDrinkById(LOW), 3);
const r1 = await orders.createOrder(customer(1));
check("Đặt hàng thành công", r1.success, true);
check(`Tồn kho giảm 3 (${START} -> ${START - 3})`, await stockOf(LOW), START - 3);
check("Giỏ hàng được làm trống sau khi đặt", orders.getCart().length, 0);
check("Đơn mới mang id do MÁY CHỦ sinh ra (json-server 1.x)", r1.order.id.startsWith("srv"), true);

section("[2] Giỏ hàng muốn nhiều hơn tồn kho -> tự hạ về đúng tồn kho");
orders.addToCart(await drinks.getDrinkById(LOW), 999);
const s2 = await orders.syncCartWithCatalog();
check("Số lượng trong giỏ hạ về bằng tồn kho", s2.cart[0].qty, START - 3);
check("Ghi nhận thay đổi kiểu 'reduced'", s2.changes[0].type, "reduced");

section("[3] Mua hết ly cuối -> tự chuyển 'Hết hàng'");
const r3 = await orders.createOrder(customer(2));
check("Đặt hàng thành công", r3.success, true);
check("Tồn kho về 0", await stockOf(LOW), 0);
check("Trạng thái tự chuyển 'soldout'", (await drinks.getDrinkById(LOW)).status, "soldout");
check("hasEnoughStock trả về false", await drinks.hasEnoughStock(LOW, 1), false);

section("[4] Món đã hết hàng nằm trong giỏ -> bị loại khi đối chiếu");
orders.addToCart({ id: LOW, name: "Macallan", price: 195000, image: "" }, 1);
const s4 = await orders.syncCartWithCatalog();
check("Giỏ hàng bị loại món hết hàng", s4.cart.length, 0);
check("Đặt hàng với giỏ rỗng sau đối chiếu -> thất bại", (await orders.createOrder(customer(3))).success, false);

section("[5] Huỷ đơn hoàn kho; phục hồi đơn trừ kho lại");
await orders.updateOrderStatus(r1.order.id, "cancelled");
check("Huỷ đơn 3 ly -> hoàn 3 ly", await stockOf(LOW), 3);
check("Có hàng trở lại -> 'available'", (await drinks.getDrinkById(LOW)).status, "available");
await orders.updateOrderStatus(r1.order.id, "cancelled");
check("Bấm huỷ lần 2 trên đơn đã huỷ -> KHÔNG hoàn kho lần nữa", await stockOf(LOW), 3);
await orders.updateOrderStatus(r1.order.id, "pending");
check("Phục hồi đơn đã huỷ -> trừ lại 3 ly", await stockOf(LOW), 0);

section("[6] Xoá đơn chưa phục vụ phải hoàn kho, đơn đã phục vụ thì không");
await orders.deleteOrder(r1.order.id);              // đang "pending"
check("Xoá đơn 'Chờ xử lý' 3 ly -> hoàn 3 ly", await stockOf(LOW), 3);
await orders.updateOrderStatus(r3.order.id, "completed");
const beforeDelete = await stockOf(LOW);
await orders.deleteOrder(r3.order.id);               // đã "completed"
check("Xoá đơn 'Hoàn tất' -> không hoàn kho", await stockOf(LOW), beforeDelete);

section("[7] Mã đơn không bị trùng sau khi xoá một đơn ở giữa");
resetDb();
await orders.deleteOrder("o3");                      // xoá DH0003, còn 7 đơn
orders.addToCart(await drinks.getDrinkById("d1"), 1);
const r7 = await orders.createOrder(customer(7));
const codes = (await orders.getAllOrders()).map((o) => o.code);
check("Mã đơn mới là DH0009 (không phải DH0008 trùng)", r7.order.code, "DH0009");
check("Không có mã đơn nào bị trùng", codes.length, new Set(codes).size);

section("[8] Xoá món khỏi thực đơn khi đang nằm trong giỏ khách");
orders.addToCart(await drinks.getDrinkById("d2"), 2);
await drinks.deleteDrink("d2");
const s8 = await orders.syncCartWithCatalog();
check("Món đã xoá bị loại khỏi giỏ", s8.cart.some((i) => i.drinkId === "d2"), false);
check("Lý do: không còn trong thực đơn", s8.changes[0].reason, "món này không còn trong thực đơn");

section("[9] Admin đổi giá trong lúc khách đang có món trong giỏ");
orders.clearCart();
orders.addToCart(await drinks.getDrinkById("d3"), 1);
await drinks.updateDrink("d3", { price: 99000 });
const s9 = await orders.syncCartWithCatalog();
check("Giỏ hàng cập nhật theo giá mới", s9.cart[0].price, 99000);
check("Ghi nhận thay đổi kiểu 'price'", s9.changes[0].type, "price");

section("[10] Thêm món mới: dùng id do máy chủ trả về");
const created = await drinks.addDrink({ name: "Test Sour", category: "sour-fizz", price: 100000, stock: 5, abv: 15 });
check("Id món mới do máy chủ sinh (khác id trình duyệt tạo)", created.id.startsWith("srv"), true);
check("Đọc lại được món vừa tạo theo id máy chủ", (await drinks.getDrinkById(created.id)).name, "Test Sour");

section("[11] Tra cứu đơn phải khớp CẢ mã đơn lẫn số điện thoại");
check("Đúng mã + đúng SĐT -> tìm thấy", (await orders.findOrderByCodeAndPhone("dh0001", "0901112233"))?.code, "DH0001");
check("Đúng mã + sai SĐT -> không trả về đơn của người khác", await orders.findOrderByCodeAndPhone("DH0001", "0999999999"), null);

section("[12] Máy chủ API tắt");
resetDb();
await drinks.getAllDrinks();                         // lần đọc thành công -> lưu bản đệm
serverOnline = false;
const cached = await drinks.getAllDrinks();
check("Đọc vẫn được từ bản đệm localStorage", cached.length, drinks.SEED_DRINKS.length);
orders.addToCart(cached[0], 1);
let offlineError = null;
try { await orders.createOrder(customer(9)); } catch (err) { offlineError = err; }
check("Đặt hàng khi server tắt -> báo lỗi ApiError offline", offlineError?.offline, true);
check("Giỏ hàng KHÔNG bị xoá khi đặt hàng thất bại", orders.getCart().length, 1);

section("[13] Lớp Order: kế thừa, getter, setter, đa hình");
resetDb();
const { Order, BookingOrder, DineInOrder, TakeawayOrder } = orders;
const booking = Order.from({
  id: "x1", code: "DH9999", name: "A", phone: "0900000000", serviceType: "booking",
  bookingTime: "2030-01-01T20:00", guestCount: 4,
  items: [{ drinkId: "d1", name: "Negroni", price: 125000, qty: 2 }, { drinkId: "d3", name: "Martini", price: 130000, qty: 1 }],
});
check("Order.from tạo đúng lớp con BookingOrder", booking instanceof BookingOrder, true);
check("Lớp con vẫn là Order (kế thừa)", booking instanceof Order, true);
check("Getter total = 125000*2 + 130000", booking.total, 380000);
check("Getter itemCount = 3 ly", booking.itemCount, 3);
check("Getter isUpcoming (hẹn năm 2030)", booking.isUpcoming, true);
let setterError = null;
try { booking.status = "da-giao-hang"; } catch (err) { setterError = err; }
check("Setter từ chối trạng thái không hợp lệ", setterError instanceof Error, true);
check("Trạng thái giữ nguyên sau khi bị từ chối", booking.status, "pending");
const json = JSON.parse(JSON.stringify(booking));
check("toJSON có status (trường private) + total (getter) + bookingTime (lớp con)",
  [json.status, json.total, json.guestCount], ["pending", 380000, 4]);
check("Đa hình: đặt bàn có 2 dòng thông tin riêng", booking.serviceDetails().length, 2);
check("Đa hình: tại quán có số bàn -> 1 dòng", Order.from({ serviceType: "dine-in", tableNumber: "Bàn 4" }).serviceDetails().length, 1);
check("Đa hình: mang đi -> lớp TakeawayOrder", Order.from({ serviceType: "takeaway" }) instanceof TakeawayOrder, true);
check("Đa hình: tại quán -> lớp DineInOrder", Order.from({ serviceType: "dine-in" }) instanceof DineInOrder, true);

const stockBeforeBadStatus = await stockOf("d1");
let badStatusError = null;
try { await orders.updateOrderStatus("o7", "abc"); } catch (err) { badStatusError = err; }
check("updateOrderStatus với trạng thái sai -> báo lỗi", badStatusError instanceof Error, true);
check("...và KHÔNG đụng vào tồn kho", await stockOf("d1"), stockBeforeBadStatus);

section("[14] Lớp Staff: getter, setter");
const { Staff } = staff;
const veteran = new Staff({ name: "B", role: "bartender", shift: "evening", phone: "0911111111", startDate: "2000-01-15" });
check("Getter roleLabel", veteran.roleLabel, "Pha chế");
check("Getter shiftLabel", veteran.shiftLabel, "Ca tối");
check("Getter isActive (mặc định đang làm)", veteran.isActive, true);
check("Getter seniorityLabel có số năm", /năm/.test(veteran.seniorityLabel), true);
check("Ngày vào làm ở tương lai -> 'Mới vào làm'", new Staff({ startDate: "2999-01-01" }).seniorityLabel, "Mới vào làm");
let staffSetterError = null;
try { veteran.status = "nghi-phep"; } catch (err) { staffSetterError = err; }
check("Setter status từ chối giá trị sai", staffSetterError instanceof Error, true);
const before = fakeDb.staff.length;
let addError = null;
try { await staff.addStaff({ name: "C", role: "waiter", shift: "morning", phone: "0922222222", startDate: "2024-01-01", status: "xyz" }); }
catch (err) { addError = err; }
check("addStaff với trạng thái sai bị chặn TRƯỚC khi gửi lên máy chủ", [addError instanceof Error, fakeDb.staff.length], [true, before]);
const savedStaff = await staff.addStaff({ name: "D", role: "cashier", shift: "morning", phone: "0933333333", startDate: "2024-01-01" });
check("addStaff hợp lệ trả về đối tượng Staff", savedStaff instanceof Staff, true);

/* ================================================================ */
console.log("\n==============================================================");
console.log(failCount === 0
  ? `ĐẠT ${passCount}/${passCount} PHÉP KIỂM TRA - KHÔNG PHÁT HIỆN LỖI NGHIỆP VỤ.`
  : `CÓ ${failCount} PHÉP KIỂM TRA THẤT BẠI (đạt ${passCount}).`);
console.log("==============================================================\n");
process.exit(failCount === 0 ? 0 : 1);

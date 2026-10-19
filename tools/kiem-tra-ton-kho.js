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

  // Bảng dạng object (VD /settings) - json-server cho GET và PATCH cả object
  if (!Array.isArray(table)) {
    if (method === "GET") return jsonResponse(200, structuredClone(table));
    if (method === "PATCH") {
      fakeDb[collection] = { ...table, ...body };
      return jsonResponse(200, structuredClone(fakeDb[collection]));
    }
    return jsonResponse(405, {});
  }
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
const customerAuth = await import(mod("customerAuth.js"));
const vouchers = await import(mod("vouchersService.js"));
const promotions = await import(mod("promotions.js"));
const utils = await import(mod("utils.js"));

function resetDb() {
  fakeDb.drinks = structuredClone(JSON.parse(JSON.stringify(drinks.SEED_DRINKS)));
  fakeDb.orders = structuredClone(orders.SEED_ORDERS);
  fakeDb.staff = structuredClone(staff.SEED_STAFF);
  fakeDb.messages = [];
  fakeDb.customers = structuredClone(customerAuth.SEED_CUSTOMERS);
  fakeDb.vouchers = structuredClone(vouchers.SEED_VOUCHERS);
  fakeDb.settings = { bankId: "MB", bankName: "MBBank", accountNumber: "0901234567", accountName: "QUAN BAR DEM" };
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
/** Mọi đơn phải kèm ngày sinh đủ 18 tuổi - bọc lại để các test cũ không phải lặp trường này */
const createAdult = (info) => orders.createOrder({ birthDate: "1990-01-01", ...info });
const customer = (n) => ({ name: `Khách ${n}`, phone: `090000000${n}`, serviceType: "takeaway" });

/* ================================================================ */
resetDb();
const LOW = "d10";              // Macallan 12 - tồn kho mẫu 12 ly
const START = await stockOf(LOW);

section("[1] Đặt hàng trừ đúng tồn kho");
orders.addToCart(await drinks.getDrinkById(LOW), 3);
const r1 = await createAdult(customer(1));
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
const r3 = await createAdult(customer(2));
check("Đặt hàng thành công", r3.success, true);
check("Tồn kho về 0", await stockOf(LOW), 0);
check("Trạng thái tự chuyển 'soldout'", (await drinks.getDrinkById(LOW)).status, "soldout");
check("hasEnoughStock trả về false", await drinks.hasEnoughStock(LOW, 1), false);

section("[4] Món đã hết hàng nằm trong giỏ -> bị loại khi đối chiếu");
orders.addToCart({ id: LOW, name: "Macallan", price: 195000, image: "" }, 1);
const s4 = await orders.syncCartWithCatalog();
check("Giỏ hàng bị loại món hết hàng", s4.cart.length, 0);
check("Đặt hàng với giỏ rỗng sau đối chiếu -> thất bại", (await createAdult(customer(3))).success, false);

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
await orders.deleteOrder("o4");                      // xoá DH0004 (đã huỷ, chưa thu tiền), còn 7 đơn
orders.addToCart(await drinks.getDrinkById("d1"), 1);
const r7 = await createAdult(customer(7));
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
try { await createAdult(customer(9)); } catch (err) { offlineError = err; }
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

section("[15] Quy trình trạng thái đơn hàng (ORDER_TRANSITIONS)");
resetDb();
const d1Before = await stockOf("d1");
let completedCancelError = null;
try { await orders.updateOrderStatus("o1", "cancelled"); } catch (err) { completedCancelError = err; }
check("Đơn 'Hoàn tất' KHÔNG huỷ được", completedCancelError instanceof Error, true);
check("...kho KHÔNG được cộng lại số ly khách đã uống", await stockOf("d1"), d1Before);
check("...đơn vẫn 'completed' trên máy chủ", (await orders.getOrderById("o1")).status, "completed");
await orders.updateOrderStatus("o7", "preparing");
check("Chờ xử lý -> Đang pha chế: hợp lệ", (await orders.getOrderById("o7")).status, "preparing");
let backwardError = null;
try { await orders.updateOrderStatus("o7", "pending"); } catch (err) { backwardError = err; }
check("Đang pha chế -> Chờ xử lý: bị chặn", backwardError instanceof Error, true);
check("canChangeTo: Đã huỷ -> Chờ xử lý (khôi phục) được phép",
  orders.Order.from({ serviceType: "takeaway", status: "cancelled" }).canChangeTo("pending"), true);

section("[16] Nhân viên tự đăng ký phải chờ quản lý duyệt");
const auth = await import(mod("auth.js"));
const reg = await staff.registerStaff({
  name: "E", username: "nv_moi", password: "Moi@12345", role: "bartender",
  shift: "evening", phone: "0944444444", email: "e@quanbar.vn", startDate: "2026-01-01", status: "active",
});
check("Tài khoản tự đăng ký luôn 'pending' (bỏ qua status gửi lên)", reg.status, "pending");
check("Chưa duyệt -> không đăng nhập được", (await auth.login("nv_moi", "Moi@12345")).reason, "pending");
const staffCount = fakeDb.staff.length;
let managerError = null;
try {
  await staff.registerStaff({ name: "F", username: "sep_gia", password: "Sep@12345", role: "manager",
    shift: "evening", phone: "0955555555", email: "f@quanbar.vn", startDate: "2026-01-01" });
} catch (err) { managerError = err; }
check("Không tự đăng ký được vị trí Quản lý", [managerError instanceof Error, fakeDb.staff.length], [true, staffCount]);
await staff.updateStaff(reg.id, { status: "active" });
check("Quản lý duyệt xong -> đăng nhập được", (await auth.login("nv_moi", "Moi@12345")).success, true);
auth.logout();

section("[17] Tồn kho: món quản lý chủ động 'Tạm ngưng' + mức cảnh báo");
resetDb();
await drinks.updateDrink("d23", { status: "soldout" });          // chai rượu: tạm ngưng khi vẫn còn 10 lần rót
await drinks.adjustStock("d23", 2);                                // hoàn kho do huỷ đơn
const paused = await drinks.getDrinkById("d23");
check("Hoàn kho KHÔNG tự mở bán lại món đang tạm ngưng", paused.status, "soldout");
check("...và số tồn kho được giữ nguyên + cộng thêm", paused.stock, 12);
check("stockLevel: 0 ly -> 'out'", drinks.stockLevel({ category: "spirits", stock: 0 }), "out");
check(`stockLevel: ${drinks.LOW_STOCK_THRESHOLD} ly -> 'low'`, drinks.stockLevel({ category: "spirits", stock: drinks.LOW_STOCK_THRESHOLD }), "low");
check("stockLevel: 20 ly -> 'ok'", drinks.stockLevel({ category: "spirits", stock: 20 }), "ok");

section("[18] Phân quyền theo vai trò");
const asRole = (role) => ({ role });
check("Quản lý vào được trang Nhân viên", auth.canAccessPage("admin-staff.html", asRole("manager")), true);
check("Pha chế KHÔNG vào được trang Nhân viên", auth.canAccessPage("admin-staff.html", asRole("bartender")), false);
check("Pha chế KHÔNG sửa được thực đơn/giá", auth.canAccessPage("admin-menu.html", asRole("bartender")), false);
check("Pha chế đăng nhập xong vào thẳng trang Đơn hàng", auth.homePageFor(asRole("bartender")), "admin-orders.html");
check("Thu ngân được huỷ đơn nhưng KHÔNG được xoá đơn",
  [auth.can("order:cancel", asRole("cashier")), auth.can("order:delete", asRole("cashier"))], [true, false]);
check("Phục vụ xem được hộp thư liên hệ", auth.canAccessPage("admin-messages.html", asRole("waiter")), true);
check("Vai trò lạ -> không có quyền gì", auth.can("page:orders", asRole("hacker")), false);

section("[19] Thanh toán: khách báo chuyển khoản != đã thanh toán");
resetDb();
const settings = await import(mod("settingsService.js"));
orders.addToCart(await drinks.getDrinkById("d1"), 1);
const r19 = await createAdult(customer(19));
check("Đơn mới: 'Chưa thanh toán'", r19.order.paymentStatus, "unpaid");
await orders.reportTransferSent(r19.order.id);
check("Khách bấm 'Tôi đã chuyển khoản' -> chỉ 'Chờ xác nhận CK'", (await orders.getOrderById(r19.order.id)).paymentStatus, "awaiting");
await orders.confirmPayment(r19.order.id);
check("Thu ngân xác nhận -> 'Đã thanh toán'", (await orders.getOrderById(r19.order.id)).paymentStatus, "paid");
await orders.reportTransferSent(r19.order.id);
check("Đơn đã trả: khách bấm lại KHÔNG kéo về 'Chờ xác nhận'", (await orders.getOrderById(r19.order.id)).paymentStatus, "paid");
let paidCancelledError = null;
try { await orders.confirmPayment("o4"); } catch (err) { paidCancelledError = err; }
check("Không xác nhận thanh toán cho đơn đã huỷ", paidCancelledError instanceof Error, true);
check("Đơn mẫu đã hoàn tất mang trạng thái 'paid'", (await orders.getOrderById("o1")).paymentStatus, "paid");

const savedBank = await settings.saveBankSettings({ bankId: "VCB", accountNumber: "0071 0012 3456", accountName: "Quán Bar Đêm" });
check("Lưu tài khoản nhận tiền lên máy chủ (/settings), chuẩn hoá số TK + tên",
  [fakeDb.settings.bankId, savedBank.accountNumber, savedBank.accountName], ["VCB", "007100123456", "QUAN BAR DEM"]);
check("Mọi máy đọc lại cùng một tài khoản từ máy chủ", (await settings.getBankSettings()).bankId, "VCB");
let badBankError = null;
try { await settings.saveBankSettings({ bankId: "XYZ", accountNumber: "123456", accountName: "A" }); } catch (err) { badBankError = err; }
check("Ngân hàng không có trong danh sách -> từ chối", badBankError instanceof Error, true);

section("[20] Đặt bàn trước: gọi món là TUỲ CHỌN");
resetDb();
const venue = await import(mod("venue.js"));
const inHours = (daysAhead, hour = 20) => { const d = new Date(); d.setDate(d.getDate() + daysAhead); d.setHours(hour, 0, 0, 0); return d.toISOString(); };
const booker = (n, extra = {}) => ({ name: `Khách ${n}`, phone: `091000000${n}`, serviceType: "booking", bookingTime: inHours(3), guestCount: 4, ...extra });
const tableOnly = await createAdult(booker(1));
check("Giỏ trống + đặt bàn trước -> vẫn giữ bàn được", tableOnly.success, true);
check("...đơn chỉ giữ bàn: 0 món, tổng 0đ", [tableOnly.order.items.length, tableOnly.order.total, tableOnly.order.isTableOnly], [0, 0, true]);
check("...không cần quét QR thanh toán (tổng 0đ)", tableOnly.order.needsPayment, false);
orders.addToCart(await drinks.getDrinkById("d1"), 2);
const withDrinks = await createAdult(booker(2));
check("Đặt bàn kèm gọi món trước vẫn được", [withDrinks.success, withDrinks.order.itemCount], [true, 2]);
check("Gọi món tại bàn mà giỏ trống -> từ chối", (await createAdult({ ...customer(5), serviceType: "dine-in" })).success, false);
orders.addToCart({ id: LOW, name: "Macallan", price: 195000, image: "" }, 1);
await drinks.updateDrink(LOW, { stock: 0, status: "soldout" });
check("Đặt bàn có chọn món nhưng món hết sạch -> dừng lại cho khách xem lại",
  (await createAdult(booker(3))).success, false);

section("[21] Sức chứa theo khung giờ");
resetDb();
const slot = inHours(5);
const cap = venue.BOOKING_RULES.capacity;
await createAdult(booker(1, { bookingTime: slot, guestCount: cap - 4 }));
check(`Còn ${4} chỗ sau khi đã đặt ${cap - 4} khách`, await orders.getRemainingSeats(slot), 4);
let fullError = null;
try { await createAdult(booker(2, { bookingTime: slot, guestCount: 6 })); } catch (err) { fullError = err; }
check("Đặt 6 khách khi chỉ còn 4 chỗ -> từ chối", fullError instanceof Error, true);
const ok4 = await createAdult(booker(3, { bookingTime: slot, guestCount: 4 }));
check("Đặt đúng 4 chỗ cuối -> được", ok4.success, true);
const later = new Date(new Date(slot).getTime() + venue.BOOKING_RULES.slotMinutes * 60 * 1000).toISOString();
check("Khung giờ cách 2 tiếng không bị tính chồng chỗ", await orders.getRemainingSeats(later), cap);
await orders.updateOrderStatus(ok4.order.id, "cancelled");
check("Huỷ đặt bàn -> trả lại chỗ", await orders.getRemainingSeats(slot), 4);

section("[22] Khách tự huỷ đơn khi tra cứu");
resetDb();
orders.addToCart(await drinks.getDrinkById("d1"), 3);
const d1Stock = await stockOf("d1");
const future = await createAdult(booker(4, { bookingTime: inHours(2) }));
let wrongPhone = null;
try { await orders.cancelByCustomer(future.order.code, "0999999999"); } catch (err) { wrongPhone = err; }
check("Sai số điện thoại -> không huỷ được đơn người khác", wrongPhone instanceof Error, true);
await orders.cancelByCustomer(future.order.code, future.order.phone);
check("Đúng mã + SĐT, còn xa giờ hẹn -> huỷ được", (await orders.getOrderById(future.order.id)).status, "cancelled");
check("...và hoàn lại 3 ly vào kho", await stockOf("d1"), d1Stock);
const soon = orders.Order.from({ serviceType: "booking", status: "pending", bookingTime: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
check(`Còn 1 tiếng tới giờ hẹn (< ${venue.BOOKING_RULES.cancelDeadlineHours} tiếng) -> không tự huỷ được`, soon.customerCancelCheck().ok, false);
check("Đơn đang pha chế -> không tự huỷ được", orders.Order.from({ serviceType: "dine-in", status: "preparing" }).customerCancelCheck().ok, false);
check("Đơn đã thanh toán -> không tự huỷ (cần hoàn tiền qua hotline)",
  orders.Order.from({ serviceType: "dine-in", status: "pending", paymentStatus: "paid" }).customerCancelCheck().ok, false);

section("[23] Ngày kinh doanh + doanh thu đặt bàn tính theo giờ hẹn");
const at = (y, m, d, h, min = 0) => new Date(y, m - 1, d, h, min).toISOString();
check("01:30 sáng 14/10 thuộc đêm 13/10", venue.businessDayKey(at(2026, 10, 14, 1, 30)), "2026-10-13");
check("05:59 sáng vẫn thuộc đêm hôm trước", venue.businessDayKey(at(2026, 10, 14, 5, 59)), "2026-10-13");
check("06:00 sáng là ngày mới", venue.businessDayKey(at(2026, 10, 14, 6, 0)), "2026-10-14");
check("21:00 tối là chính ngày đó", venue.businessDayKey(at(2026, 10, 14, 21, 0)), "2026-10-14");
const bookedMonday = orders.Order.from({ serviceType: "booking", createdAt: at(2026, 10, 12, 10), bookingTime: at(2026, 10, 17, 20) });
check("Đặt bàn: doanh thu tính theo giờ hẹn (serviceTime = bookingTime)", venue.businessDayKey(bookedMonday.serviceTime), "2026-10-17");
check("Gọi tại bàn: serviceTime = lúc tạo đơn", orders.Order.from({ serviceType: "dine-in", createdAt: at(2026, 10, 12, 23) }).serviceTime, at(2026, 10, 12, 23));
check("Quán vẫn mở lúc 01:30 sáng (đêm trước)", venue.isWithinOpeningHours(new Date(2026, 9, 14, 1, 30)), true);
check("Không nhận khách lúc 10:00 sáng", venue.isWithinOpeningHours(new Date(2026, 9, 14, 10, 0)), false);

section("[24] Rượu mạnh bán theo lần rót");
check("Rượu mạnh mẫu có dung tích 30ml", (await drinks.getDrinkById("d23")).servingMl, 30);
check("servingLabel rượu mạnh -> '/ 30ml'", drinks.servingLabel({ servingMl: 30 }), "/ 30ml");
check("Cocktail bán theo ly -> không ghi dung tích", drinks.servingLabel(await drinks.getDrinkById("d1")), "");

section("[25] Khôi phục đơn đã huỷ: phải còn đủ kho và đủ chỗ");
resetDb();
orders.addToCart(await drinks.getDrinkById("d23"), 3);
const toCancel = await createAdult({ ...customer(6), serviceType: "dine-in", tableNumber: "Bàn 1" });
const afterSale = await stockOf("d23");
await orders.updateOrderStatus(toCancel.order.id, "cancelled");
check("Huỷ đơn -> hoàn 3 ly vào kho", await stockOf("d23"), afterSale + 3);
await drinks.updateDrink("d23", { stock: 1 });
let restoreStockError = null;
try { await orders.updateOrderStatus(toCancel.order.id, "pending"); } catch (err) { restoreStockError = err; }
check("Kho chỉ còn 1 ly mà đơn cần 3 -> KHÔNG khôi phục được", restoreStockError instanceof Error, true);
check("...đơn vẫn ở trạng thái 'đã huỷ'", (await orders.getOrderById(toCancel.order.id)).status, "cancelled");
check("...và kho không bị ghi đè về 0", await stockOf("d23"), 1);
await drinks.updateDrink("d23", { stock: 10 });
await orders.updateOrderStatus(toCancel.order.id, "pending");
check("Đủ kho (10 ly) -> khôi phục được và trừ lại 3 ly", [(await orders.getOrderById(toCancel.order.id)).status, await stockOf("d23")], ["pending", 7]);

resetDb();
const rSlot = inHours(6);
const bookingA = await createAdult(booker(1, { bookingTime: rSlot, guestCount: 10 }));
await orders.updateOrderStatus(bookingA.order.id, "cancelled");
await createAdult(booker(2, { bookingTime: rSlot, guestCount: venue.BOOKING_RULES.capacity }));
let restoreSeatError = null;
try { await orders.updateOrderStatus(bookingA.order.id, "pending"); } catch (err) { restoreSeatError = err; }
check("Khung giờ đã kín chỗ (người khác đặt trong lúc đơn bị huỷ) -> không khôi phục được", restoreSeatError instanceof Error, true);

section("[26] Số điện thoại: chuẩn hoá +84 và chặn số sai định dạng");
check("normalizePhone '+84 912 345 678' -> '0912345678'", utils.normalizePhone("+84 912 345 678"), "0912345678");
check("normalizePhone '0912.345.678' -> '0912345678'", utils.normalizePhone("0912.345.678"), "0912345678");
check("normalizePhone '84912345678' -> '0912345678'", utils.normalizePhone("84912345678"), "0912345678");
resetDb();
orders.addToCart(await drinks.getDrinkById("d1"), 1);
const intl = await createAdult({ name: "Khách quốc tế", phone: "+84 912 345 678", serviceType: "takeaway" });
check("Đơn lưu số điện thoại dạng chuẩn 0xxxxxxxxx", intl.order.phone, "0912345678");
check("Tra cứu bằng '0912 345 678' vẫn thấy đơn", (await orders.findOrderByCodeAndPhone(intl.order.code, "0912 345 678"))?.id, intl.order.id);
check("Tra cứu bằng '+84912345678' vẫn thấy đơn", (await orders.findOrderByCodeAndPhone(intl.order.code, "+84912345678"))?.id, intl.order.id);
const weirdPhone = await customerAuth.customerRegister({ birthDate: "1995-03-10", name: "Khách lạ", phone: "0|12345678", email: "", password: "Abc@1234" });
check("Đăng ký khách với SĐT chứa ký tự '|' -> từ chối", weirdPhone.success, false);
const okPhone = await customerAuth.customerRegister({ birthDate: "1995-03-10", name: "Khách tốt", phone: "+84 977 123 456", email: "", password: "Abc@1234" });
check("Đăng ký bằng +84 -> lưu dạng 0977123456", [okPhone.success, okPhone.customer?.phone], [true, "0977123456"]);
const loginIntl = await customerAuth.customerLogin("0977 123 456", "Abc@1234");
check("...đăng nhập lại bằng 0977 123 456 được", loginIntl.success, true);

section("[27] Giờ đặt bàn lưu chuẩn ISO (không phụ thuộc múi giờ máy)");
resetDb();
const naive = "2031-05-20T20:30";
const isoBooking = await createAdult(booker(7, { bookingTime: naive }));
check("Giờ 'YYYY-MM-DDTHH:mm' được đổi sang ISO UTC khi lưu", isoBooking.order.bookingTime, new Date(naive).toISOString());
let badTimeError = null;
try { await createAdult(booker(8, { bookingTime: "không phải ngày" })); } catch (err) { badTimeError = err; }
check("Giờ đặt bàn không hợp lệ -> báo lỗi rõ ràng", badTimeError instanceof Error, true);

section("[28] Tích điểm khách hàng khi đơn hoàn tất");
check("Quy đổi: 1 điểm / 10.000đ", [customerAuth.pointsForTotal(250000), customerAuth.pointsForTotal(9999), customerAuth.pointsForTotal(0)], [25, 0, 0]);
check("Hạng: 20 điểm Thân thiết, 60 Bạc, 150 Vàng",
  [customerAuth.tierForPoints(20), customerAuth.tierForPoints(60), customerAuth.tierForPoints(150)],
  ["Thành viên Thân thiết", "Thành viên Bạc", "Thành viên Vàng"]);
resetDb();
orders.addToCart(await drinks.getDrinkById("d1"), 2);
const loyal = await createAdult({ ...customer(1), serviceType: "takeaway", customerId: "cust-002" });
check("Đơn của khách đăng nhập lưu customerId", loyal.order.customerId, "cust-002");
const beforePts = fakeDb.customers.find((c) => c.id === "cust-002").points;
await orders.updateOrderStatus(loyal.order.id, "preparing");
check("Đang pha chế -> chưa cộng điểm", fakeDb.customers.find((c) => c.id === "cust-002").points, beforePts);
await orders.updateOrderStatus(loyal.order.id, "completed");
// cust-002 hạng Bạc được giảm 3%: 250.000đ -> khách trả 242.500đ -> 24 điểm (điểm tính trên số tiền THỰC TRẢ)
check("Hoàn tất đơn (đã giảm hạng Bạc 3% còn 242.500đ) -> cộng 24 điểm", fakeDb.customers.find((c) => c.id === "cust-002").points, beforePts + 24);
check("...hạng tự cập nhật theo điểm mới", fakeDb.customers.find((c) => c.id === "cust-002").tier, customerAuth.tierForPoints(beforePts + 24));
orders.addToCart(await drinks.getDrinkById("d1"), 1);
const cancelledLoyal = await createAdult({ ...customer(2), serviceType: "takeaway", customerId: "cust-002" });
await orders.updateOrderStatus(cancelledLoyal.order.id, "cancelled");
check("Đơn bị huỷ -> không cộng điểm", fakeDb.customers.find((c) => c.id === "cust-002").points, beforePts + 24);
orders.addToCart(await drinks.getDrinkById("d1"), 1);
const guestOrder = await createAdult({ ...customer(3), serviceType: "takeaway" });
await orders.updateOrderStatus(guestOrder.order.id, "completed");
check("Khách vãng lai (không đăng nhập) hoàn tất đơn -> không lỗi, không ai được cộng", fakeDb.customers.find((c) => c.id === "cust-002").points, beforePts + 24);

section("[29] Phiên đăng nhập quản trị được đối chiếu lại với danh sách nhân sự");
resetDb();
const lanLogin = await auth.signIn("lan.nguyen", "Lan@123456");
check("Pha chế đăng nhập được", [lanLogin.success, lanLogin.kind], [true, "staff"]);
fakeDb.staff.find((s) => s.username === "lan.nguyen").role = "manager";
const promoted = await auth.refreshSession();
check("Đổi vai trò trên máy chủ -> phiên cập nhật theo (không giữ quyền cũ)", [promoted?.role, auth.currentAdmin()?.role], ["manager", "manager"]);
serverOnline = false;
check("Máy chủ tắt -> KHÔNG đá nhân viên ra khỏi phiên", (await auth.refreshSession())?.username, "lan.nguyen");
serverOnline = true;
fakeDb.staff.find((s) => s.username === "lan.nguyen").status = "inactive";
check("Tài khoản bị khoá -> phiên bị huỷ", [await auth.refreshSession(), auth.isLoggedIn()], [null, false]);
const lanAgain = await auth.signIn("lan.nguyen", "Lan@123456");
check("...và không đăng nhập lại được khi còn bị khoá", lanAgain.success, false);
await auth.signIn("admin", "Admin@123");
check("Tài khoản admin gốc (không nằm trong /staff) giữ nguyên phiên", (await auth.refreshSession())?.username, "admin");
await auth.signIn("tai.le", "Tai@123456");
await new Promise((resolve) => setTimeout(resolve, 30)); // chờ lần băm lại mật khẩu chạy nền xong
fakeDb.staff = fakeDb.staff.filter((s) => s.username !== "tai.le");
check("Nhân sự bị xoá khỏi hệ thống -> phiên bị huỷ", [await auth.refreshSession(), auth.isLoggedIn()], [null, false]);

section("[30] Giới hạn thêm món vào giỏ");
resetDb();
orders.clearCart();
const limited = { id: "dx", name: "Chai thử", category: "spirits", price: 100000, image: "", status: "available", stock: 3 };
check("Còn 3 ly, giỏ trống, thêm 2 -> được", orders.checkCanAdd(limited, 2).ok, true);
orders.addToCart(limited, 2);
const over = orders.checkCanAdd(limited, 2);
check("Giỏ đã có 2, thêm 2 nữa (vượt 3) -> không được, báo còn tối đa 3", [over.ok, over.reason, over.available, over.inCart], [false, "limit", 3, 2]);
check("Món 'soldout' -> không được", orders.checkCanAdd({ ...limited, status: "soldout" }, 1).reason, "soldout");
check("Món hết kho -> không được", orders.checkCanAdd({ ...limited, stock: 0 }, 1).reason, "soldout");

section("[31] Sửa món không ghi đè tồn kho khách vừa đặt (stockPatch)");
const was = { stock: 10, status: "available" };
check("Không đổi kho/trạng thái -> không gửi gì", drinks.stockPatch(was, 10, "available"), {});
check("Đổi kho 10 -> 15 -> chỉ gửi stock", drinks.stockPatch(was, 15, "available"), { stock: 15 });
check("Kho về 0 -> bắt buộc soldout", drinks.stockPatch(was, 0, "available"), { stock: 0, status: "soldout" });
check("Quản lý chủ động tạm ngưng, giữ kho -> chỉ gửi status", drinks.stockPatch(was, 10, "soldout"), { status: "soldout" });
const empty = { stock: 0, status: "soldout" };
check("Món đang hết, nhập 12 ly, giữ nguyên trạng thái -> tự mở bán lại", drinks.stockPatch(empty, 12, "soldout"), { stock: 12, status: "available" });
check("Món đang hết, vẫn 0 -> không gửi gì", drinks.stockPatch(empty, 0, "soldout"), {});
check("Món đang hết, nhập 12 nhưng chủ động để 'available' -> available", drinks.stockPatch(empty, 12, "available"), { stock: 12, status: "available" });
resetDb();
const formOpened = await drinks.getDrinkById("d23"); // quản lý mở form sửa món
orders.addToCart(formOpened, 3);
await createAdult({ ...customer(9), serviceType: "takeaway" });        // khách đặt 3 ly lúc form đang mở
const afterCustomer = await stockOf("d23");
const renameOnly = drinks.stockPatch(formOpened, formOpened.stock, formOpened.status); // quản lý chỉ đổi tên
await drinks.updateDrink("d23", { name: "Negroni Đổi Tên", ...renameOnly });
check("Chỉ đổi tên món -> kho giữ số sau khi khách đặt (không bị ghi đè về số cũ)", await stockOf("d23"), afterCustomer);

section("[32] Đăng ký khách: dùng id máy chủ cấp, không giả vờ thành công khi máy chủ lỗi");
resetDb();
const regOk = await customerAuth.customerRegister({ birthDate: "1995-03-10", name: "Khách Id", phone: "0988777666", email: "", password: "Abc@1234" });
const stored = fakeDb.customers.find((c) => c.phone === "0988777666");
check("Phiên khách dùng đúng id do máy chủ cấp (không phải id tự sinh ở trình duyệt)", regOk.customer?.id, stored?.id);
const regBefore = fakeDb.customers.length;
delete fakeDb.customers; // máy chủ chạy nhưng thiếu bảng /customers -> 404, KHÔNG phải mất mạng
const regFail = await customerAuth.customerRegister({ birthDate: "1995-03-10", name: "Khách Lỗi", phone: "0988777555", email: "", password: "Abc@1234" });
check("Máy chủ trả lỗi 404 -> báo đăng ký thất bại, không lưu tạm rồi báo thành công", regFail.success, false);
fakeDb.customers = [];
check("(đã khôi phục bảng) kiểm tra số bản ghi trước đó không bị đổi", regBefore, 3);

section("[33] Đơn đã thu tiền không được xoá (giữ sổ doanh thu)");
resetDb();
let lockedError = null;
try { await orders.deleteOrder("o1"); } catch (err) { lockedError = err; }  // DH0001: hoàn tất + đã thu tiền
check("Xoá đơn hoàn tất đã thu tiền -> bị chặn", lockedError instanceof Error, true);
check("...đơn vẫn còn trong hệ thống", (await orders.getOrderById("o1")) !== null, true);
check("Đơn đã huỷ, chưa thu tiền -> xoá được", await orders.deleteOrder("o4"), true);
orders.addToCart(await drinks.getDrinkById("d1"), 1);
const paidThenCancelled = await createAdult({ ...customer(4), serviceType: "takeaway" });
await orders.confirmPayment(paidThenCancelled.order.id);
check("Đơn đã thu tiền mà còn đang chờ -> cũng bị khoá", (await orders.getOrderById(paidThenCancelled.order.id)).isRevenueLocked, true);
await orders.updateOrderStatus(paidThenCancelled.order.id, "cancelled");
check("Huỷ đơn (hoàn tiền) xong thì mở khoá, xoá được", await orders.deleteOrder(paidThenCancelled.order.id), true);

section("[34] Mật khẩu được băm, không lưu chữ thường");
const pw = await import(mod("passwords.js"));
const nodeCrypto = await import("node:crypto");
const samples = ["", "abc", "Quán Bar Đêm - mật khẩu có dấu", "x".repeat(200)];
check("SHA-256 tự cài khớp thư viện chuẩn của Node (4 mẫu, gồm tiếng Việt và chuỗi dài)",
  samples.map((s) => pw.sha256(s)), samples.map((s) => nodeCrypto.createHash("sha256").update(s).digest("hex")));
const hashA = pw.hashPassword("Matkhau@1");
const hashB = pw.hashPassword("Matkhau@1");
check("Bản băm có dạng sha256$muối$băm và nhận diện được", [pw.isHashed(hashA), pw.isHashed("Matkhau@1")], [true, false]);
check("Cùng mật khẩu, mỗi lần băm ra muối + kết quả khác nhau", hashA !== hashB, true);
check("Đúng mật khẩu -> ok; sai mật khẩu -> không", [pw.verifyPassword("Matkhau@1", hashA).ok, pw.verifyPassword("matkhau@1", hashA).ok], [true, false]);
check("hashIfPlain không băm hai lần", pw.hashIfPlain(hashA), hashA);
check("Mật khẩu chữ thường cũ vẫn kiểm tra được và được đánh dấu cần băm lại", pw.verifyPassword("abc123", "abc123"), { ok: true, needsUpgrade: true });
check("Mã nguồn không còn mật khẩu admin dạng chữ thường", [auth.ADMIN_ACCOUNT.password, pw.isHashed(auth.ADMIN_ACCOUNT.passwordHash)], [undefined, true]);
resetDb();
check("Dữ liệu mẫu trong bộ nhớ vẫn chữ thường (chỉ để dự phòng)", pw.isHashed(fakeDb.staff.find((s) => s.username === "lan.nguyen").password), false);
const lanFirst = await auth.signIn("lan.nguyen", "Lan@123456");
await new Promise((resolve) => setTimeout(resolve, 30));
check("Đăng nhập đúng với tài khoản cũ -> được và tự băm lại mật khẩu trên máy chủ",
  [lanFirst.success, pw.isHashed(fakeDb.staff.find((s) => s.username === "lan.nguyen").password)], [true, true]);
check("Đăng nhập lần 2 (đã băm) vẫn đúng", (await auth.signIn("lan.nguyen", "Lan@123456")).success, true);
check("Sai mật khẩu vẫn bị từ chối sau khi băm", (await auth.signIn("lan.nguyen", "sai")).success, false);
await staff.registerStaff({ name: "Nhân Viên Mới", username: "moi.nv", password: "Abcd@12345", role: "waiter", shift: "evening", phone: "0911000999", email: "moi@x.vn", startDate: "2026-01-01" });
const newbie = fakeDb.staff.find((s) => s.username === "moi.nv");
check("Nhân viên tự đăng ký: mật khẩu lưu dạng băm", pw.isHashed(newbie.password), true);
await staff.updateStaff(newbie.id, { status: "active" });
check("...sau khi được duyệt đăng nhập được bằng mật khẩu gốc", (await auth.signIn("moi.nv", "Abcd@12345")).success, true);
await staff.updateStaff(newbie.id, { password: "Doimoi@2026" });
const changed = fakeDb.staff.find((s) => s.id === newbie.id).password;
check("Đổi mật khẩu qua updateStaff -> lưu bản băm mới", [pw.isHashed(changed), pw.verifyPassword("Doimoi@2026", changed).ok], [true, true]);
await staff.updateStaff(newbie.id, { name: "Tên Khác", password: changed });
check("Gửi lại bản băm cũ (sửa hồ sơ không đổi mật khẩu) -> giữ nguyên, không băm đôi", fakeDb.staff.find((s) => s.id === newbie.id).password, changed);
const custReg = await customerAuth.customerRegister({ birthDate: "1995-03-10", name: "Khách Băm", phone: "0955000111", email: "", password: "Matkhau@9" });
check("Khách đăng ký: mật khẩu lưu dạng băm", pw.isHashed(fakeDb.customers.find((c) => c.phone === "0955000111").password), true);
check("...đăng nhập lại được", [custReg.success, (await customerAuth.customerLogin("0955000111", "Matkhau@9")).success], [true, true]);
const seedCustomer = await customerAuth.customerLogin("0909123456", "Khach@123");
await new Promise((resolve) => setTimeout(resolve, 30));
check("Khách mẫu cũ (chữ thường): đăng nhập được và được băm lại",
  [seedCustomer.success, pw.isHashed(fakeDb.customers.find((c) => c.phone === "0909123456").password)], [true, true]);

section("[35] Chỉ chai rượu có tồn kho; cocktail/mocktail không giới hạn số ly");
resetDb();
const negroni = await drinks.getDrinkById("d1");
const macallan = await drinks.getDrinkById("d23");
check("Cocktail không theo dõi tồn kho, chai rượu thì có", [drinks.tracksStock(negroni), drinks.tracksStock(macallan)], [false, true]);
check("Món pha chế luôn lưu tồn kho 0 (bị bỏ qua)", [negroni.stock, new drinks.Drink({ name: "X", category: "classic", price: 1, stock: 50 }).stock], [0, 0]);
check("Chai rượu giữ đúng tồn kho nhập vào", new drinks.Drink({ name: "Y", category: "spirits", price: 1, stock: 50 }).stock, 50);
check("Cocktail có tồn kho 0 vẫn KHÔNG bị coi là hết hàng", drinks.isSoldOut(negroni), false);
check("Chai rượu hết kho -> hết hàng", drinks.isSoldOut({ ...macallan, stock: 0 }), true);
check("Cocktail bị quản lý tạm ngưng -> không bán được", drinks.isSoldOut({ ...negroni, status: "soldout" }), true);
check("Số ly còn đặt được: cocktail tối đa 99/dòng, chai rượu = tồn kho", [drinks.availableQty(negroni), drinks.availableQty(macallan)], [99, macallan.stock]);
check("Bộ lọc 'còn hàng' vẫn giữ cocktail", drinks.filterDrinks([negroni], { onlyAvailable: true }).length, 1);
check("stockLevel của cocktail là 'na' (không cảnh báo hết/sắp hết)", drinks.stockLevel(negroni), "na");
orders.addToCart(negroni, 40);
const bigOrder = await createAdult({ ...customer(5), serviceType: "takeaway" });
check("Đặt 40 ly Negroni (nhiều hơn mọi số tồn kho mẫu) -> thành công", [bigOrder.success, bigOrder.order?.itemCount], [true, 40]);
check("...và không trừ gì ở kho của cocktail", (await drinks.getDrinkById("d1")).stock, 0);
check("...món vẫn bán được sau đó", drinks.isSoldOut(await drinks.getDrinkById("d1")), false);
await orders.updateOrderStatus(bigOrder.order.id, "cancelled");
await orders.updateOrderStatus(bigOrder.order.id, "pending");
check("Huỷ rồi khôi phục đơn cocktail: không bị chặn vì 'thiếu kho'", (await orders.getOrderById(bigOrder.order.id)).status, "pending");
orders.clearCart();
orders.addToCart(negroni, 90);
check("Cocktail: thêm 90 rồi thêm 20 nữa vượt trần 99/dòng -> báo giới hạn", orders.checkCanAdd(negroni, 20), { ok: false, reason: "limit", available: 99, inCart: 90 });
orders.clearCart();
await drinks.updateDrink("d1", { status: "soldout" });
orders.addToCart(negroni, 1);
const paused2 = await orders.syncCartWithCatalog();
check("Cocktail đang tạm ngưng nằm trong giỏ -> bị loại khi đối chiếu", [paused2.cart.length, paused2.changes[0]?.reason], [0, "đã hết hàng"]);
resetDb();
const chaiStock = (await drinks.getDrinkById("d23")).stock;
orders.addToCart(await drinks.getDrinkById("d23"), chaiStock);
const lastBottle = await createAdult({ ...customer(6), serviceType: "takeaway" });
const sold = await drinks.getDrinkById("d23");
check("Chai rượu vẫn trừ kho và tự 'hết hàng' khi bán hết", [lastBottle.success, sold.stock, sold.status], [true, 0, "soldout"]);

section("[36] Quy tắc mật khẩu: >= 8 ký tự, chữ đầu viết hoa, có ký tự đặc biệt");
const pwm = await import(mod("passwords.js"));
const pwOk = (p) => pwm.checkPassword(p).valid;
check("Hợp lệ: 'Khach@123', 'Abcdefg!', 'Đẹp#2026x'", [pwOk("Khach@123"), pwOk("Abcdefg!"), pwOk("Đẹp#2026x")], [true, true, true]);
check("Chữ đầu không viết hoa -> sai ('khach@123')", pwOk("khach@123"), false);
check("Bắt đầu bằng số hoặc ký tự đặc biệt -> sai ('1Abcdef@', '@Abcdefg')", [pwOk("1Abcdef@"), pwOk("@Abcdefg")], [false, false]);
check("Không có ký tự đặc biệt -> sai ('Khach12345')", pwOk("Khach12345"), false);
check("Khoảng trắng không tính là ký tự đặc biệt -> sai ('Khach 12345')", pwOk("Khach 12345"), false);
check("Ngắn hơn 8 ký tự -> sai ('Ab@1234' có 7 ký tự)", pwOk("Ab@1234"), false);
check("Đúng 8 ký tự -> được ('Ab@12345')", pwOk("Ab@12345"), true);
check("Không có chữ thường hay chữ số vẫn được ('ABCDEFG!') - luật không đòi", pwOk("ABCDEFG!"), true);
check("Báo lỗi bằng câu có nêu đủ 3 điều kiện", /8 ký tự.*viết hoa.*đặc biệt/.test(pwm.passwordProblem("abc")), true);
check("Mật khẩu hợp lệ -> không có thông báo lỗi", pwm.passwordProblem("Khach@123"), "");
resetDb();
const weakReg = await customerAuth.customerRegister({ birthDate: "1995-03-10", name: "Khách Yếu", phone: "0944555666", email: "", password: "khach@123" });
check("Khách đăng ký với mật khẩu chữ đầu viết thường -> bị từ chối", [weakReg.success, fakeDb.customers.some((c) => c.phone === "0944555666")], [false, false]);
const noSpecialReg = await customerAuth.customerRegister({ birthDate: "1995-03-10", name: "Khách Yếu", phone: "0944555666", email: "", password: "Khach12345" });
check("Khách đăng ký không có ký tự đặc biệt -> bị từ chối", noSpecialReg.success, false);
let weakStaffError = null;
try { await staff.registerStaff({ name: "Y", username: "yeu.nv", password: "yeukem123", role: "waiter", shift: "evening", phone: "0911333444", email: "y@x.vn", startDate: "2026-01-01" }); } catch (err) { weakStaffError = err; }
check("Nhân viên đăng ký với mật khẩu yếu -> bị chặn ngay ở tầng nghiệp vụ", [weakStaffError instanceof Error, fakeDb.staff.some((x) => x.username === "yeu.nv")], [true, false]);
let weakUpdate = null;
try { await staff.updateStaff("s2", { password: "khongdat" }); } catch (err) { weakUpdate = err; }
check("Quản lý đổi mật khẩu nhân viên thành mật khẩu yếu -> bị chặn", weakUpdate instanceof Error, true);
check("Mọi mật khẩu mẫu (nhân sự + khách) đều đạt luật mới",
  [...staff.SEED_STAFF, ...customerAuth.SEED_CUSTOMERS].every((u) => pwOk(u.password)), true);

section("[37] Hạng thành viên + lịch sử điểm");
const rk = customerAuth;
check("4 hạng theo mốc điểm: 0 / 50 / 150 / 400", rk.MEMBER_RANKS.map((r) => [r.key, r.min]), [["loyal", 0], ["silver", 50], ["gold", 150], ["diamond", 400]]);
check("Hạng theo điểm: 49 Thân thiết, 50 Bạc, 149 Bạc, 150 Vàng, 399 Vàng, 400 Kim Cương, 5000 Kim Cương",
  [49, 50, 149, 150, 399, 400, 5000].map((p) => rk.rankForPoints(p).key), ["loyal", "silver", "silver", "gold", "gold", "diamond", "diamond"]);
const prog = rk.rankProgress(120);
check("Tiến độ 120 điểm: Bạc -> Vàng, còn 30 điểm, 70%", [prog.current.key, prog.next.key, prog.toNext, prog.percent], ["silver", "gold", 30, 70]);
check("Hạng cao nhất: không có hạng kế, 100%", [rk.rankProgress(900).next, rk.rankProgress(900).percent, rk.rankProgress(900).toNext], [null, 100, 0]);
check("Điểm âm/rác không làm hỏng (0 điểm -> Thân thiết, 0%)", [rk.rankProgress(-5).current.key, rk.rankProgress("abc").percent], ["loyal", 0]);

resetDb();
const reg37 = await customerAuth.customerRegister({ birthDate: "1995-03-10", name: "Khách Hạng", phone: "0966000111", email: "", password: "Hang@1234" });
const rec37 = fakeDb.customers.find((c) => c.phone === "0966000111");
check("Đăng ký mới: 20 điểm + dòng lịch sử 'chào mừng'", [reg37.success, rec37.points, rec37.pointHistory?.length, rec37.pointHistory?.[0]?.type], [true, 20, 1, "welcome"]);

orders.addToCart(await drinks.getDrinkById("d1"), 4);              // 4 x 125.000 = 500.000đ = 50 điểm
const made37 = await createAdult({ ...customer(7), phone: "0966000111", serviceType: "takeaway", customerId: rec37.id });
await orders.updateOrderStatus(made37.order.id, "completed");
const after37 = fakeDb.customers.find((c) => c.id === rec37.id);
check("Đơn 500.000đ hoàn tất -> +50 điểm (20 -> 70), lên hạng Bạc", [after37.points, after37.tier], [70, "Thành viên Bạc"]);
const last37 = after37.pointHistory.at(-1);
check("Lịch sử ghi đúng đơn: mã đơn, tổng tiền, số điểm", [last37.type, last37.orderCode, last37.total, last37.points], ["order", made37.order.code, 500000, 50]);

// cộng điểm lặp cho cùng một đơn không được tăng lần hai
await customerAuth.awardPoints(rec37.id, { id: made37.order.id, code: made37.order.code, total: 500000 });
check("Gọi cộng điểm lại cho cùng đơn -> KHÔNG cộng đôi", [fakeDb.customers.find((c) => c.id === rec37.id).points, fakeDb.customers.find((c) => c.id === rec37.id).pointHistory.length], [70, 2]);

// đặt vãng lai bằng số điện thoại của thành viên -> vẫn được cộng điểm
orders.addToCart(await drinks.getDrinkById("d1"), 2);              // 250.000đ = 25 điểm
const guest37 = await createAdult({ name: "Chưa đăng nhập", phone: "+84 966 000 111", serviceType: "takeaway" });
await orders.updateOrderStatus(guest37.order.id, "completed");
check("Đặt KHÔNG đăng nhập nhưng cùng SĐT thành viên (+84...) -> vẫn cộng 25 điểm", fakeDb.customers.find((c) => c.id === rec37.id).points, 95);

const pointsBefore37 = fakeDb.customers.map((c) => c.points);
orders.addToCart(await drinks.getDrinkById("d1"), 1);
const strangerOrder = await createAdult({ name: "Người lạ", phone: "0900999888", serviceType: "takeaway" });
await orders.updateOrderStatus(strangerOrder.order.id, "completed");
check("SĐT không thuộc thành viên nào -> điểm của mọi khách giữ nguyên", fakeDb.customers.map((c) => c.points), pointsBefore37);

orders.addToCart(await drinks.getDrinkById("d1"), 3);
const cancelled37 = await createAdult({ ...customer(8), phone: "0966000111", serviceType: "takeaway", customerId: rec37.id });
await orders.updateOrderStatus(cancelled37.order.id, "cancelled");
check("Đơn bị huỷ không cộng điểm và không có dòng lịch sử", [fakeDb.customers.find((c) => c.id === rec37.id).points, fakeDb.customers.find((c) => c.id === rec37.id).pointHistory.length], [95, 3]);

check("Cộng điểm cho đơn dưới 10.000đ: không có điểm, không ghi lịch sử", await customerAuth.awardPoints(rec37.id, { id: "x", code: "DHX", total: 9000 }), null);
check("Khách không tồn tại -> bỏ qua, không lỗi", await customerAuth.awardPoints("khong-co", { id: "y", code: "DHY", total: 500000 }), null);
check("findCustomerByPhone nhận mọi dạng SĐT", [(await customerAuth.findCustomerByPhone("0966 000 111"))?.id, (await customerAuth.findCustomerByPhone("+84966000111"))?.id, await customerAuth.findCustomerByPhone("0000000000")], [rec37.id, rec37.id, null]);
check("Quyền: thu ngân và quản lý vào được trang khách hàng, pha chế thì không",
  [auth.canAccessPage("admin-customers.html", { role: "cashier" }), auth.canAccessPage("admin-customers.html", { role: "manager" }), auth.canAccessPage("admin-customers.html", { role: "bartender" })], [true, true, false]);

/* ---------------- [38] Khuyến mãi: giảm theo hạng, mã giảm giá, đổi điểm ---------------- */
section("[38] Khuyến mãi: giảm theo hạng + mã giảm giá + dùng điểm");
const messageOf = async (fn) => {
  try { await fn(); return ""; } catch (err) { return err.message; }
};
const custRec = (id) => fakeDb.customers.find((c) => c.id === id);
const voucherRec = (code) => fakeDb.vouchers.find((v) => v.code === code);
/** Đặt nhanh: bỏ n ly món d1 (Negroni 125.000đ, không giới hạn số ly) vào giỏ rồi tạo đơn */
const buy = async (qty, info) => {
  orders.addToCart(await drinks.getDrinkById("d1"), qty);
  return createAdult({ name: "Khách KM", phone: "0911000000", serviceType: "takeaway", ...info });
};

check("Giảm giá theo hạng: Thân thiết 0%, Bạc 3%, Vàng 5%, Kim Cương 8%",
  customerAuth.MEMBER_RANKS.map((r) => r.discountPercent), [0, 3, 5, 8]);
check("lifetimeOf: dùng lifetimePoints, hồ sơ cũ thiếu trường thì lấy points",
  [customerAuth.lifetimeOf({ points: 40, lifetimePoints: 90 }), customerAuth.lifetimeOf({ points: 40 }), customerAuth.lifetimeOf(null)], [90, 40, 0]);

// ---- Giảm theo hạng ----
resetDb();
const silverOrder = await buy(2, { customerId: "cust-002", phone: "0918765432" });          // Bạc: 250.000 -> 242.500
check("Hạng Bạc giảm 3%: 250.000đ -> 242.500đ", [silverOrder.order.subtotal, silverOrder.order.discountTotal, silverOrder.order.total], [250000, 7500, 242500]);
check("...lưu đủ dòng ưu đãi + tổng đã giảm trong đơn", [fakeDb.orders.at(-1).discounts.map((d) => [d.type, d.amount]), fakeDb.orders.at(-1).total, fakeDb.orders.at(-1).subtotal], [[["rank", 7500]], 242500, 250000]);
const goldOrder = await buy(2, { customerId: "cust-001", phone: "0909123456" });            // Vàng: 5%
check("Hạng Vàng giảm 5%: 250.000đ -> 237.500đ", goldOrder.order.total, 237500);
custRec("cust-001").lifetimePoints = 400;
const diamondOrder = await buy(2, { customerId: "cust-001", phone: "0909123456" });         // Kim Cương: 8%
check("Hạng Kim Cương giảm 8%: 250.000đ -> 230.000đ", diamondOrder.order.total, 230000);
const guestFull = await buy(2, { phone: "0911000001" });
check("Khách vãng lai không đăng nhập: không được giảm hạng", [guestFull.order.discounts, guestFull.order.total], [[], 250000]);

// ---- Mã giảm giá ----
resetDb();
const welcomeA = await buy(2, { phone: "0911000002", voucherCode: " welcome10 " });          // 10% của 250.000
check("Mã WELCOME10 (gõ thường, thừa khoảng trắng) giảm 10%: 250.000đ -> 225.000đ", [welcomeA.order.voucherCode, welcomeA.order.total], ["WELCOME10", 225000]);
check("...mã tăng 1 lượt dùng", voucherRec("WELCOME10").usedCount, 1);
check("Cùng số điện thoại dùng lại mã -> bị từ chối",
  (await messageOf(() => buy(2, { phone: "+84 911 000 002", voucherCode: "WELCOME10" }))).includes("đã dùng"), true);
check("...đơn bị từ chối không được tạo và không tăng lượt dùng", [fakeDb.orders.filter((o) => o.voucherCode === "WELCOME10").length, voucherRec("WELCOME10").usedCount], [1, 1]);
orders.clearCart();
const welcomeB = await buy(2, { phone: "0911000003", voucherCode: "WELCOME10" });
check("Số điện thoại khác vẫn dùng được cùng mã", welcomeB.order.total, 225000);
await orders.updateOrderStatus(welcomeA.order.id, "cancelled");
check("Huỷ đơn -> trả lại 1 lượt dùng mã", voucherRec("WELCOME10").usedCount, 1);
const welcomeA2 = await buy(2, { phone: "0911000002", voucherCode: "WELCOME10" });
check("...và số điện thoại đó được dùng lại mã sau khi đơn cũ bị huỷ", welcomeA2.order.total, 225000);
check("Khôi phục đơn huỷ khi SĐT đã dùng mã ở đơn khác -> bị chặn",
  (await messageOf(() => orders.updateOrderStatus(welcomeA.order.id, "pending"))).includes("đã dùng mã"), true);

resetDb();
orders.addToCart(await drinks.getDrinkById("d1"), 2);
check("Đơn dưới mức tối thiểu (250.000đ < 300.000đ) -> mã GIAM50K bị từ chối",
  (await messageOf(() => createAdult({ name: "A", phone: "0911000004", serviceType: "takeaway", voucherCode: "GIAM50K" }))).includes("chỉ áp dụng cho đơn từ"), true);
orders.clearCart();
const flat = await buy(3, { phone: "0911000004", voucherCode: "GIAM50K" });                  // 375.000 - 50.000
check("Mã giảm số tiền GIAM50K: 375.000đ -> 325.000đ", flat.order.total, 325000);
const capped = await buy(12, { phone: "0911000005", voucherCode: "HAPPYNIGHT" });           // 15% của 1.500.000 = 225.000 > trần 150.000
check("Mã giảm % có trần: HAPPYNIGHT 15% của 1.500.000đ chỉ giảm tối đa 150.000đ", capped.order.total, 1350000);

voucherRec("WELCOME10").expiresAt = new Date(Date.now() - 86400000).toISOString();
check("Mã đã hết hạn -> bị từ chối", (await messageOf(() => buy(2, { phone: "0911000006", voucherCode: "WELCOME10" }))).includes("hết hạn"), true);
orders.clearCart();
voucherRec("GIAM50K").usageLimit = 1;
voucherRec("GIAM50K").usedCount = 1;
check("Mã hết lượt sử dụng -> bị từ chối", (await messageOf(() => buy(3, { phone: "0911000007", voucherCode: "GIAM50K" }))).includes("hết lượt"), true);
orders.clearCart();
voucherRec("HAPPYNIGHT").active = false;
check("Mã đã tắt -> bị từ chối", (await messageOf(() => buy(12, { phone: "0911000008", voucherCode: "HAPPYNIGHT" }))).includes("không còn hiệu lực"), true);
orders.clearCart();
check("Mã không tồn tại -> bị từ chối", (await messageOf(() => buy(2, { phone: "0911000009", voucherCode: "KHONGCO" }))).includes("không tồn tại"), true);
orders.clearCart();

// ---- Cộng dồn: hạng -> mã -> điểm ----
resetDb();
const stacked = await buy(4, { customerId: "cust-001", phone: "0909123456", voucherCode: "WELCOME10" });   // 500.000: Vàng -25.000, mã 10% của 475.000 = 47.500
check("Cộng dồn hạng Vàng 5% + mã WELCOME10 10% (tính trên phần còn lại): 500.000đ -> 427.500đ",
  [stacked.order.discounts.map((d) => d.type), stacked.order.discountTotal, stacked.order.total], [["rank", "voucher"], 72500, 427500]);

// ---- Đổi điểm ----
resetDb();
const pts = await buy(4, { customerId: "cust-001", phone: "0909123456", pointsToUse: 100 });     // 500.000 - 25.000 - 50.000
check("Dùng 100 điểm (1 điểm = 500đ) sau giảm hạng Vàng: 500.000đ -> 425.000đ", [pts.order.pointsUsed, pts.order.total], [100, 425000]);
check("...số dư điểm giảm 150 -> 50, điểm tích luỹ giữ nguyên 150, vẫn hạng Vàng",
  [custRec("cust-001").points, custRec("cust-001").lifetimePoints, customerAuth.rankForPoints(customerAuth.lifetimeOf(custRec("cust-001"))).key], [50, 150, "gold"]);
check("...lịch sử có dòng 'redeem' -100 gắn mã đơn", custRec("cust-001").pointHistory.filter((e) => e.type === "redeem").map((e) => [e.orderCode, e.points]), [[pts.order.code, -100]]);
check("Dùng điểm: bài toán đủ điều kiện cũng không làm khách tụt hạng dù số dư < mốc 150", custRec("cust-001").points < 150 && custRec("cust-001").tier === "Thành viên Vàng", true);

await orders.updateOrderStatus(pts.order.id, "cancelled");
check("Huỷ đơn -> hoàn đủ 100 điểm (50 -> 150) + dòng 'refund'", [custRec("cust-001").points, custRec("cust-001").pointHistory.at(-1).type, custRec("cust-001").pointHistory.at(-1).points], [150, "refund", 100]);
await orders.updateOrderStatus(pts.order.id, "pending");
check("Khôi phục đơn đã huỷ -> trừ lại 100 điểm", custRec("cust-001").points, 50);
await orders.updateOrderStatus(pts.order.id, "cancelled");
custRec("cust-001").points = 10;
check("Khôi phục đơn khi khách không còn đủ điểm -> bị chặn",
  (await messageOf(() => orders.updateOrderStatus(pts.order.id, "pending"))).includes("còn 10 điểm"), true);
check("...đơn vẫn ở trạng thái huỷ", fakeDb.orders.find((o) => o.id === pts.order.id).status, "cancelled");
custRec("cust-001").points = 150;

// hoàn tất đơn dùng điểm: tích điểm trên số tiền thực trả (425.000đ = 42 điểm)
resetDb();
const pts2 = await buy(4, { customerId: "cust-001", phone: "0909123456", pointsToUse: 100 });
await orders.updateOrderStatus(pts2.order.id, "completed");
check("Hoàn tất đơn trả 425.000đ -> +42 điểm (50 -> 92), điểm tích luỹ 150 -> 192",
  [custRec("cust-001").points, custRec("cust-001").lifetimePoints], [92, 192]);

// xoá đơn chưa phục vụ cũng hoàn điểm + lượt mã
resetDb();
const pts3 = await buy(4, { customerId: "cust-001", phone: "0909123456", pointsToUse: 60, voucherCode: "WELCOME10" });
check("Đơn dùng cả điểm lẫn mã: trừ 60 điểm, tăng lượt mã", [custRec("cust-001").points, voucherRec("WELCOME10").usedCount], [90, 1]);
await orders.deleteOrder(pts3.order.id);
check("Xoá đơn chưa phục vụ -> hoàn 60 điểm và trả lượt mã", [custRec("cust-001").points, voucherRec("WELCOME10").usedCount], [150, 0]);

// các giới hạn khi dùng điểm
resetDb();
check("Dùng nhiều điểm hơn số dư -> bị từ chối", (await messageOf(() => buy(4, { customerId: "cust-002", phone: "0918765432", pointsToUse: 90 }))).includes("chỉ có 80 điểm"), true);
orders.clearCart();
check("Dùng ít hơn mức tối thiểu 20 điểm -> bị từ chối", (await messageOf(() => buy(4, { customerId: "cust-001", phone: "0909123456", pointsToUse: 10 }))).includes("tối thiểu"), true);
orders.clearCart();
check("Dùng quá 50% giá trị đơn -> bị từ chối (125.000đ Vàng 5% = 118.750đ, tối đa 118 điểm)", (await messageOf(() => buy(1, { customerId: "cust-001", phone: "0909123456", pointsToUse: 130 }))).includes("tối đa 118 điểm"), true);
orders.clearCart();
check("Khách vãng lai không đăng nhập không dùng được điểm", (await messageOf(() => buy(4, { phone: "0911000010", pointsToUse: 50 }))).includes("đăng nhập"), true);
orders.clearCart();
check("Các lần bị từ chối không trừ điểm của ai", fakeDb.customers.map((c) => c.points), [150, 80]);

const red1 = await customerAuth.redeemPoints("cust-001", 30, { code: "DH9999" });
const red2 = await customerAuth.redeemPoints("cust-001", 30, { code: "DH9999" });
check("redeemPoints gọi lặp cho cùng mã đơn -> chỉ trừ một lần", [red1.points, red2.points, custRec("cust-001").points], [120, 120, 120]);
await customerAuth.refundPoints("cust-001", { code: "DH9999" });
await customerAuth.refundPoints("cust-001", { code: "DH9999" });
check("refundPoints gọi lặp -> chỉ hoàn một lần", custRec("cust-001").points, 150);
check("refundPoints cho đơn chưa từng trừ điểm -> không đổi gì", [(await customerAuth.refundPoints("cust-001", { code: "DH0000" })).points, await customerAuth.refundPoints("", { code: "X" })], [150, null]);

// ---- Hàm tính giá dùng chung ----
resetDb();
const quote = await promotions.resolvePricing({ subtotal: 400000, customerId: "cust-002", voucherCode: "WELCOME10", pointsToUse: 40, phone: "0918765432", orders: [] });
// Bạc 3% = 12.000 -> 388.000; mã 10% = 38.800 -> 349.200; 40 điểm = 20.000 -> 329.200
check("resolvePricing: hạng -> mã -> điểm, tổng giảm đúng từng bước", [quote.discounts.map((d) => [d.type, d.amount]), quote.total], [[["rank", 12000], ["voucher", 38800], ["points", 20000]], 329200]);
const badQuote = await promotions.resolvePricing({ subtotal: 400000, voucherCode: "NOPE", pointsToUse: 50, orders: [] });
check("resolvePricing không strict: trả lỗi trong kết quả, không ném, không áp ưu đãi sai", [badQuote.voucherError.length > 0, badQuote.pointsError.length > 0, badQuote.total], [true, true, 400000]);
check("Tổng giảm không bao giờ vượt tổng tiền (mã 50.000đ cho đơn 30.000đ không chạm mốc tối thiểu)",
  (await promotions.resolvePricing({ subtotal: 30000, voucherCode: "GIAM50K", orders: [] })).total, 30000);
check("maxRedeemablePoints: giới hạn bởi số dư và 50% giá trị đơn", [promotions.maxRedeemablePoints(1000, 100000), promotions.maxRedeemablePoints(30, 100000), promotions.maxRedeemablePoints(50, 0)], [100, 30, 0]);

// ---- Quản lý mã giảm giá (CRUD + kiểm tra dữ liệu) ----
resetDb();
const newVoucher = await vouchers.addVoucher({ code: "summer20", type: "percent", value: 20, maxDiscount: 80000, minOrder: 100000, usageLimit: 5, expiresAt: "", active: true, description: "Hè" });
check("Tạo mã mới: mã được chuẩn hoá chữ hoa, bắt đầu 0 lượt dùng", [newVoucher.code, newVoucher.usedCount], ["SUMMER20", 0]);
check("Tạo mã trùng (không phân biệt hoa thường) -> bị từ chối", (await messageOf(() => vouchers.addVoucher({ code: "Summer20", type: "amount", value: 1000 }))).includes("đã tồn tại"), true);
check("Giảm % quá 100 -> bị từ chối", (await messageOf(() => vouchers.addVoucher({ code: "BAD100", type: "percent", value: 120 }))).includes("100%"), true);
check("Giá trị giảm <= 0 hoặc mã sai định dạng -> bị từ chối",
  [(await messageOf(() => vouchers.addVoucher({ code: "ZERO", type: "amount", value: 0 }))).length > 0, (await messageOf(() => vouchers.addVoucher({ code: "a b", type: "amount", value: 5000 }))).length > 0], [true, true]);
await vouchers.updateVoucher(newVoucher.id, { ...newVoucher, value: 25, active: false });
check("Sửa mã: đổi giá trị + tắt mã", [voucherRec("SUMMER20").value, voucherRec("SUMMER20").active], [25, false]);
await vouchers.deleteVoucher(newVoucher.id);
check("Xoá mã", voucherRec("SUMMER20"), undefined);
check("Quyền: quản lý vào được trang mã giảm giá, thu ngân và pha chế thì không",
  ["manager", "cashier", "bartender"].map((role) => auth.canAccessPage("admin-vouchers.html", { role })), [true, false, false]);

/* ---------------- [39] Độ tuổi: ngày sinh >= 18 tuổi ---------------- */
section("[39] Độ tuổi: chỉ phục vụ khách từ 18 tuổi (ngày sinh khách khai)");
const ageMod = await import(mod("age.js"));
const NOW = new Date(2026, 5, 15, 12, 0, 0);   // 15/06/2026 (giờ máy)
check("MIN_AGE = 18", ageMod.MIN_AGE, 18);
check("Tính tuổi theo ngày lịch: sinh 15/06/2008 -> đúng sinh nhật 18; 16/06/2008 -> còn 17; 14/06/2008 -> 18",
  [ageMod.ageOf("2008-06-15", NOW), ageMod.ageOf("2008-06-16", NOW), ageMod.ageOf("2008-06-14", NOW)], [18, 17, 18]);
check("Sinh cuối năm / đầu năm: 31/12/2007 -> 18, 01/01/2008 -> 18, sinh hôm nay -> 0",
  [ageMod.ageOf("2007-12-31", NOW), ageMod.ageOf("2008-01-01", NOW), ageMod.ageOf("2026-06-15", NOW)], [18, 18, 0]);
check("Ngày sinh sai định dạng / không có thật -> null", [ageMod.ageOf("", NOW), ageMod.ageOf("15/06/2000", NOW), ageMod.ageOf("2000-02-31", NOW), ageMod.ageOf("2001-02-29", NOW)], [null, null, null, null]);
check("Đủ 18 tuổi đúng ngày -> hợp lệ", ageMod.ageProblem("2008-06-15", NOW), "");
check("Thiếu 1 ngày mới đủ 18 -> bị từ chối, nêu rõ quy định 18 tuổi", ageMod.ageProblem("2008-06-16", NOW).includes("18 tuổi"), true);
check("Để trống -> yêu cầu nhập ngày sinh", ageMod.ageProblem("", NOW), "Vui lòng nhập ngày sinh.");
check("Ngày sinh ở tương lai / quá 120 năm / không có thật -> không hợp lệ",
  ["2027-01-01", "1800-01-01", "2000-13-40"].map((d) => ageMod.ageProblem(d, NOW)), ["Ngày sinh không hợp lệ.", "Ngày sinh không hợp lệ.", "Ngày sinh không hợp lệ."]);
check("Mọi khách mẫu đều đủ 18 tuổi", customerAuth.SEED_CUSTOMERS.every((c) => ageMod.ageProblem(c.birthDate) === ""), true);

// ---- Đăng ký thành viên ----
resetDb();
const noBirth = await customerAuth.customerRegister({ name: "Khách Tuổi", phone: "0977000001", email: "", password: "Abc@1234" });
check("Đăng ký không khai ngày sinh -> bị từ chối", [noBirth.success, noBirth.message], [false, "Vui lòng nhập ngày sinh."]);
const yearNow = new Date().getFullYear();
const minorReg = await customerAuth.customerRegister({ name: "Khách Nhỏ", phone: "0977000002", email: "", password: "Abc@1234", birthDate: `${yearNow - 15}-01-01` });
check("Đăng ký khi mới 15 tuổi -> bị từ chối, không tạo tài khoản",
  [minorReg.success, minorReg.message.includes("18 tuổi"), fakeDb.customers.some((c) => c.phone === "0977000002")], [false, true, false]);
const adultReg = await customerAuth.customerRegister({ name: "Khách Lớn", phone: "0977000003", email: "", password: "Abc@1234", birthDate: "1998-07-20" });
check("Đăng ký đủ tuổi -> thành công, ngày sinh lưu vào hồ sơ và phiên",
  [adultReg.success, fakeDb.customers.find((c) => c.phone === "0977000003")?.birthDate, adultReg.customer.birthDate], [true, "1998-07-20", "1998-07-20"]);
const loginAgain = await customerAuth.customerLogin("0977000003", "Abc@1234");
check("Đăng nhập lại -> phiên vẫn mang ngày sinh (để tự điền vào form đặt bàn)", loginAgain.customer.birthDate, "1998-07-20");

// ---- Đặt bàn / gọi món ----
resetDb();
const stockBefore39 = await stockOf("d10");
orders.addToCart(await drinks.getDrinkById("d10"), 1);
const ordersBefore39 = fakeDb.orders.length;
check("Đặt không khai ngày sinh -> bị từ chối", await messageOf(() => orders.createOrder({ name: "A", phone: "0911000011", serviceType: "takeaway" })), "Vui lòng nhập ngày sinh.");
check("Đặt khi khai mới 16 tuổi -> bị từ chối",
  (await messageOf(() => orders.createOrder({ name: "A", phone: "0911000011", serviceType: "takeaway", birthDate: `${yearNow - 16}-06-01` }))).includes("18 tuổi"), true);
check("...không tạo đơn, không trừ kho, giỏ hàng còn nguyên",
  [fakeDb.orders.length, await stockOf("d10"), orders.getCart().length], [ordersBefore39, stockBefore39, 1]);
const adultOrder = await orders.createOrder({ name: "A", phone: "0911000011", serviceType: "takeaway", birthDate: "1993-09-09" });
check("Đặt khi đủ tuổi -> thành công, ngày sinh lưu trên đơn", [adultOrder.success, adultOrder.order.birthDate, fakeDb.orders.at(-1).birthDate], [true, "1993-09-09", "1993-09-09"]);
const bookingMinor = booker(5, { birthDate: `${yearNow - 17}-03-03` });
check("Đặt bàn trước (chỉ giữ bàn, không gọi món) cũng phải đủ 18 tuổi",
  (await messageOf(() => orders.createOrder(bookingMinor))).includes("18 tuổi"), true);

/* ================================================================ */
console.log("\n==============================================================");
console.log(failCount === 0
  ? `ĐẠT ${passCount}/${passCount} PHÉP KIỂM TRA - KHÔNG PHÁT HIỆN LỖI NGHIỆP VỤ.`
  : `CÓ ${failCount} PHÉP KIỂM TRA THẤT BẠI (đạt ${passCount}).`);
console.log("==============================================================\n");
process.exit(failCount === 0 ? 0 : 1);

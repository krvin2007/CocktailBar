/* =========================================================
   ORDERS-SERVICE.JS - Giỏ hàng + CRUD đơn hàng
   - Giỏ hàng (cart): trạng thái tạm của riêng trình duyệt khách,
     lưu ở localStorage -> các hàm giỏ hàng là hàm đồng bộ.
     Mỗi món lưu GIÁ BÁN THỰC TẾ (đã trừ sale món / ưu đãi món mới,
     tính bằng getDrinkPricing) và GIÁ GỐC để hiển thị giá gạch.
     Mọi thay đổi giỏ đều phát sự kiện window "cartchange" để navbar,
     khung chat AI và trang đặt món tự vẽ lại.
   - Đơn hàng (orders): dữ liệu chung của quán, lưu trên máy chủ
     json-server tại /orders -> các hàm đơn hàng là async.
     Đơn có thể kèm MÃ GIẢM GIÁ: tạm tính (theo giá sale) - giảm theo
     mã = tổng thanh toán. Lượt dùng mã được trừ khi đặt, hoàn lại khi
     huỷ / xoá đơn chưa phục vụ, trừ lại khi phục hồi đơn đã huỷ.
   ========================================================= */

import { getItem, setItem } from "./storage.js";
import { api, getCollection, getRecord } from "./api.js";
import { getAllDrinks, adjustStock, getDrinkPricing } from "./drinksService.js";
import { validateVoucher, redeemVoucher, releaseVoucher, normalizeCode } from "./vouchersService.js";
import { uid, formatDateTime } from "./utils.js";

const CART_KEY = "cart";
const COLLECTION = "orders";

/** Sinh ngày giờ cách hiện tại "daysAgo" ngày, "hour" giờ trong ngày */
function daysAgo(days, hour = 19) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 30, 0, 0);
  return d.toISOString();
}

/**
 * Đơn hàng mẫu chuẩn phong cách Bar Lounge để Dashboard có số liệu thực tế ngay lần mở đầu.
 * 100% đồ uống có cồn & cocktail nổi tiếng thế giới.
 */
export const SEED_ORDERS = [
  { id: "o1", code: "DH0001", name: "Nguyễn Thị Mai", phone: "0901112233", email: "",
    serviceType: "dine-in", tableNumber: "Bàn 4", note: "Đá viên vuông thủ công",
    items: [{ drinkId: "d1", name: "Negroni Classico", price: 125000, image: "img/drinks/negroni.jpg", qty: 2 }],
    total: 250000, status: "completed", createdAt: daysAgo(6, 20) },

  { id: "o2", code: "DH0002", name: "Trần Văn Hùng", phone: "0912223344", email: "hung.tran@gmail.com",
    serviceType: "takeaway", note: "Gói giữ lạnh ly Rocks",
    items: [{ drinkId: "d2", name: "Smoked Old Fashioned", price: 135000, image: "img/drinks/old-fashioned.jpg", qty: 2 }],
    total: 270000, status: "completed", createdAt: daysAgo(5, 21) },

  { id: "o3", code: "DH0003", name: "Lê Thị Hoa", phone: "0923334455", email: "",
    serviceType: "booking", bookingTime: daysAgo(4, 19), guestCount: 4, note: "Bàn lounge gần quầy pha chế",
    items: [
      { drinkId: "d3", name: "Dry Martini 007", price: 130000, image: "img/drinks/dry-martini.jpg", qty: 2 },
      { drinkId: "d8", name: "Aperol Spritz Veneziano", price: 120000, image: "img/drinks/aperol-spritz.jpg", qty: 2 },
    ],
    total: 500000, status: "completed", createdAt: daysAgo(4, 19) },

  { id: "o4", code: "DH0004", name: "Phạm Minh Đức", phone: "0934445566", email: "",
    serviceType: "dine-in", tableNumber: "Bàn 7", note: "Thêm chút vỏ chanh vàng",
    items: [{ drinkId: "d4", name: "Bourbon Whiskey Sour", price: 120000, image: "img/drinks/whiskey-sour.jpg", qty: 1 }],
    total: 120000, status: "cancelled", createdAt: daysAgo(3, 22) },

  { id: "o5", code: "DH0005", name: "Vũ Thị Ngọc", phone: "0945556677", email: "ngoc.vu@gmail.com",
    serviceType: "takeaway", note: "Viền muối hồng cẩn thận",
    items: [
      { drinkId: "d5", name: "Classic Margarita", price: 115000, image: "img/drinks/margarita.jpg", qty: 2 },
      { drinkId: "d6", name: "Mojito Havana Rum", price: 105000, image: "img/drinks/mojito.jpg", qty: 1 },
    ],
    total: 335000, status: "completed", createdAt: daysAgo(2, 21) },

  { id: "o6", code: "DH0006", name: "Đặng Quốc Bảo", phone: "0956667788", email: "",
    serviceType: "booking", bookingTime: daysAgo(1, 20), guestCount: 6, note: "Kỷ niệm sinh nhật",
    items: [
      { drinkId: "d7", name: "Velvet Espresso Martini", price: 130000, image: "img/drinks/espresso-martini.jpg", qty: 3 },
      { drinkId: "d1", name: "Negroni Classico", price: 125000, image: "img/drinks/negroni.jpg", qty: 3 },
    ],
    total: 765000, status: "preparing", createdAt: daysAgo(1, 20) },

  { id: "o7", code: "DH0007", name: "Hoàng Thị Yến", phone: "0967778899", email: "",
    serviceType: "dine-in", tableNumber: "Bàn 2", note: "Thêm lát cam tươi",
    items: [{ drinkId: "d8", name: "Aperol Spritz Veneziano", price: 120000, image: "img/drinks/aperol-spritz.jpg", qty: 2 }],
    total: 240000, status: "pending", createdAt: daysAgo(0, 19) },

  { id: "o8", code: "DH0008", name: "Ngô Văn Tài", phone: "0978889900", email: "tai.ngo@gmail.com",
    serviceType: "takeaway", note: "Phục vụ ly Glencairn kèm đá",
    items: [{ drinkId: "d10", name: "The Macallan 12 Double Cask", price: 195000, image: "", qty: 1 }],
    total: 195000, status: "pending", createdAt: daysAgo(0, 20) },
];


/* ============== GIỎ HÀNG (localStorage) ============== */

/**
 * Báo cho giao diện biết giỏ hàng vừa đổi (navbar cập nhật huy hiệu số ly,
 * trang đặt món tính lại tiền + kiểm tra lại mã giảm giá...).
 * Kiểm tra có window/CustomEvent trước để module vẫn chạy được trong Node
 * (npm test không có trình duyệt).
 */
function emitCartChange(cart) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function"
    || typeof CustomEvent !== "function") return;
  window.dispatchEvent(new CustomEvent("cartchange", { detail: { cart, ...summarize(cart) } }));
}

export function getCart() {
  const cart = getItem(CART_KEY, []);
  return Array.isArray(cart) ? cart : [];
}

function saveCart(cart) {
  setItem(CART_KEY, cart);
  emitCartChange(cart);
  return cart;
}

/**
 * Giá gốc của một dòng giỏ/đơn. Dữ liệu cũ (trước khi có sale) không có
 * originalPrice -> coi giá gốc = giá bán; giá gốc thấp hơn giá bán (sửa tay
 * dữ liệu) cũng quy về giá bán để "tiết kiệm" không bao giờ âm.
 */
function originalPriceOf(item) {
  const price = Number(item.price) || 0;
  const original = Number(item.originalPrice) || 0;
  return original > price ? original : price;
}

/** Thêm món vào giỏ; nếu đã có thì cộng dồn số lượng */
export function addToCart(drink, qty = 1) {
  const cart = getCart();
  const index = cart.findIndex((item) => item.drinkId === drink.id);

  if (index !== -1) {
    // Đã có trong giỏ: thay bằng bản sao có số lượng mới (spread operator).
    // Giá giữ nguyên - trang đặt món đối chiếu lại với thực đơn trước khi đặt.
    cart[index] = { ...cart[index], qty: cart[index].qty + qty };
  } else {
    // Giá bán = giá SAU sale món / ưu đãi món mới; giữ giá gốc để hiện giá gạch
    const { finalPrice, originalPrice } = getDrinkPricing(drink);
    cart.push({
      drinkId: drink.id,
      name: drink.name,
      price: finalPrice,
      originalPrice,
      image: drink.image,
      qty,
    });
  }
  return saveCart(cart);
}

/** Đổi số lượng một món trong giỏ (>= 1) */
export function updateCartQty(drinkId, qty) {
  const cart = getCart();
  const item = cart.find((i) => i.drinkId === drinkId);
  if (item) item.qty = Math.max(1, qty);
  return saveCart(cart);
}

/** Xoá một món khỏi giỏ */
export function removeFromCart(drinkId) {
  return saveCart(getCart().filter((i) => i.drinkId !== drinkId));
}

/** Đổ trống giỏ (sau khi đặt hàng thành công) */
export function clearCart() {
  return saveCart([]);
}

/** Cộng dồn tiền + số ly của một danh sách món bằng reduce() */
function summarize(items) {
  const sum = items.reduce(
    (acc, item) => ({
      total: acc.total + item.price * item.qty,
      count: acc.count + item.qty,
      originalTotal: acc.originalTotal + originalPriceOf(item) * item.qty,
    }),
    { total: 0, count: 0, originalTotal: 0 },
  );
  // Tiền khách được bớt nhờ sale món / ưu đãi món mới (chưa tính mã giảm giá)
  return { ...sum, savings: sum.originalTotal - sum.total };
}

/**
 * Tổng tiền + tổng số ly trong giỏ, dùng reduce() theo yêu cầu đề bài.
 * @returns {{ total: number, count: number, originalTotal: number, savings: number }}
 *   total = tạm tính theo giá bán (đã trừ sale món), originalTotal = theo giá gốc,
 *   savings = originalTotal - total
 */
export function getCartSummary() {
  return summarize(getCart());
}

/**
 * Đối chiếu giỏ hàng với thực đơn MỚI NHẤT trên máy chủ.
 * Giỏ hàng lưu tên/giá/ảnh tại THỜI ĐIỂM thêm vào - nếu quản trị viên
 * vừa đổi giá, hết hàng hoặc xoá món, dữ liệu cũ đó không còn đúng.
 * Hàm tự sửa giỏ (giảm số lượng / xoá món / cập nhật giá) và trả về
 * danh sách thay đổi để báo cho khách biết lý do.
 * Chỉ gọi API 1 lần (GET /drinks) rồi tra cứu bằng Map, thay vì gọi
 * GET /drinks/:id lặp lại cho từng món.
 */
export async function syncCartWithCatalog() {
  const drinks = await getAllDrinks();
  const drinkMap = new Map(drinks.map((d) => [d.id, d]));

  const cart = getCart();
  const changes = [];
  const nextCart = [];

  cart.forEach((item) => {
    const drink = drinkMap.get(item.drinkId);

    if (!drink) {
      changes.push({ type: "removed", name: item.name, reason: "món này không còn trong thực đơn" });
      return;
    }
    if (drink.status !== "available" || drink.stock <= 0) {
      changes.push({ type: "removed", name: item.name, reason: "đã hết hàng" });
      return;
    }

    let qty = item.qty;
    if (qty > drink.stock) {
      changes.push({ type: "reduced", name: drink.name, from: qty, to: drink.stock });
      qty = drink.stock;
    }

    // So với giá bán HIỆN TẠI (đã trừ sale): admin đổi giá, bật/tắt sale,
    // hết tuần ưu đãi món mới... đều làm giá trong giỏ khác giá thật
    const { finalPrice, originalPrice, percent, reason } = getDrinkPricing(drink);
    if (item.price !== finalPrice) {
      changes.push({ type: "price", name: drink.name, from: item.price, to: finalPrice, originalPrice, percent, reason });
    }

    nextCart.push({ drinkId: drink.id, name: drink.name, price: finalPrice, originalPrice, image: drink.image, qty });
  });

  // Ghi lại khi có thay đổi khách cần biết, hoặc khi chỉ cần bổ sung/cập nhật
  // dữ liệu phụ (giỏ cũ chưa có originalPrice, đổi tên/ảnh món...)
  if (changes.length > 0 || JSON.stringify(nextCart) !== JSON.stringify(cart)) saveCart(nextCart);
  return { cart: nextCart, changes, drinkMap };
}

/* ============== ĐƠN HÀNG (API) ============== */

export const ORDER_STATUS = {
  pending: "Chờ xử lý",
  preparing: "Đang pha chế",
  completed: "Hoàn tất",
  cancelled: "Đã huỷ",
};

/** Màu huy hiệu tương ứng từng trạng thái - dùng chung cho mọi bảng/thẻ đơn hàng */
export const ORDER_STATUS_BADGE = {
  pending: "badge-warning",
  preparing: "badge-info",
  completed: "badge-success",
  cancelled: "badge-danger",
};

export const SERVICE_LABELS = {
  "dine-in": "Tại quầy / bàn",
  booking: "Đặt bàn trước",
  takeaway: "Mang đi",
};

/* ============== LỚP ĐƠN HÀNG (class, getter/setter, kế thừa) ============== */

/**
 * Lớp cha: thông tin và quy tắc CHUNG của mọi đơn hàng.
 * Ba lớp con bên dưới bổ sung phần riêng của từng hình thức phục vụ.
 */
export class Order {
  // Trường private (#): bên ngoài không gán thẳng được, chỉ đổi qua setter có kiểm tra
  #status;

  constructor({
    id, code, name, phone, email = "", serviceType,
    items = [], note = "", status = "pending", createdAt = new Date().toISOString(),
  } = {}) {
    this.id = id;
    this.code = code;
    this.name = name;
    this.phone = phone;
    this.email = email;
    this.serviceType = serviceType;
    this.items = items.map((item) => ({ ...item }));
    this.note = note;
    this.status = status; // đi qua setter -> trạng thái sai sẽ bị từ chối ngay
    this.createdAt = createdAt;
  }

  get status() {
    return this.#status;
  }

  /** Setter: chỉ chấp nhận 4 trạng thái hợp lệ */
  set status(value) {
    if (!Object.hasOwn(ORDER_STATUS, value)) {
      throw new Error(`Trạng thái đơn hàng không hợp lệ: "${value}"`);
    }
    this.#status = value;
  }

  /** Tổng tiền luôn tính lại từ danh sách món -> không bao giờ lệch với các món */
  get total() {
    return this.items.reduce((sum, item) => sum + item.price * item.qty, 0);
  }

  get itemCount() {
    return this.items.reduce((sum, item) => sum + item.qty, 0);
  }

  get statusLabel() {
    return ORDER_STATUS[this.#status];
  }

  get statusBadge() {
    return ORDER_STATUS_BADGE[this.#status];
  }

  get serviceLabel() {
    return SERVICE_LABELS[this.serviceType] || this.serviceType;
  }

  /** Đơn chưa phục vụ xong thì số ly trong đơn vẫn đang "giữ" trong tồn kho */
  get holdsStock() {
    return this.#status === "pending" || this.#status === "preparing";
  }

  /**
   * Các dòng thông tin RIÊNG của hình thức phục vụ, dạng [nhãn, giá trị].
   * Lớp cha không có gì; mỗi lớp con tự ghi đè (đa hình) - nơi hiển thị chỉ
   * cần gọi order.serviceDetails(), không phải if/else theo từng loại đơn.
   */
  serviceDetails() {
    return [];
  }

  /**
   * Dữ liệu thuần để gửi lên API. JSON.stringify không lấy được trường
   * private (#status) và getter (total), nên phải liệt kê ra đây.
   */
  toJSON() {
    return {
      id: this.id,
      code: this.code,
      name: this.name,
      phone: this.phone,
      email: this.email,
      serviceType: this.serviceType,
      items: this.items,
      note: this.note,
      status: this.status,
      total: this.total,
      createdAt: this.createdAt,
    };
  }

  /** Factory: tạo đúng lớp con theo hình thức phục vụ */
  static from(data) {
    const OrderClass = ORDER_CLASSES[data.serviceType] || Order;
    return new OrderClass(data);
  }
}

/** Đơn ngồi tại quán: có thêm vị trí bàn khách chọn */
export class DineInOrder extends Order {
  constructor(data = {}) {
    super({ ...data, serviceType: "dine-in" });
    this.tableNumber = data.tableNumber || "";
  }

  serviceDetails() {
    return this.tableNumber ? [["Vị trí bàn", this.tableNumber]] : [];
  }

  toJSON() {
    return { ...super.toJSON(), tableNumber: this.tableNumber };
  }
}

/** Đơn đặt bàn trước: có thêm giờ đến và số khách */
export class BookingOrder extends Order {
  constructor(data = {}) {
    super({ ...data, serviceType: "booking" });
    this.bookingTime = data.bookingTime || "";
    this.guestCount = Number(data.guestCount) || 0;
  }

  /** Giờ hẹn còn ở tương lai hay đã qua */
  get isUpcoming() {
    return new Date(this.bookingTime).getTime() > Date.now();
  }

  serviceDetails() {
    return [
      ["Thời gian đến", formatDateTime(this.bookingTime)],
      ["Số lượng khách", `${this.guestCount} người`],
    ];
  }

  toJSON() {
    return { ...super.toJSON(), bookingTime: this.bookingTime, guestCount: this.guestCount };
  }
}

/** Đơn mang đi: khách tự nhận tại quầy */
export class TakeawayOrder extends Order {
  constructor(data = {}) {
    super({ ...data, serviceType: "takeaway" });
  }

  serviceDetails() {
    return [["Nhận đồ uống", "Tại quầy bar"]];
  }
}

const ORDER_CLASSES = {
  "dine-in": DineInOrder,
  booking: BookingOrder,
  takeaway: TakeawayOrder,
};

/* ============== ĐƠN HÀNG: GỌI API ============== */

/** GET /orders - dữ liệu thô từ API được chuyển thành đối tượng Order */
export async function getAllOrders() {
  const list = await getCollection(COLLECTION, SEED_ORDERS);
  return list.map((data) => Order.from(data));
}

/** GET /orders/:id */
export async function getOrderById(id) {
  const data = await getRecord(COLLECTION, id, SEED_ORDERS);
  return data ? Order.from(data) : null;
}

/**
 * Sinh mã đơn kế tiếp = số lớn nhất đang có + 1.
 * KHÔNG dùng "số lượng đơn + 1": xoá 1 đơn ở giữa rồi đặt đơn mới sẽ
 * ra mã trùng với đơn cuối cùng (VD đang có DH0001..DH0008, xoá
 * DH0003 -> còn 7 đơn -> đơn mới lại là DH0008).
 */
function nextOrderCode(orders) {
  const maxNumber = orders.reduce((max, o) => {
    const n = Number(String(o.code || "").replace(/\D/g, ""));
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  return "DH" + String(maxNumber + 1).padStart(4, "0");
}

/**
 * Tạo đơn hàng mới từ giỏ hàng + thông tin khách - POST /orders.
 * Đối chiếu tồn kho lần cuối ngay trước khi lưu (an toàn kép: order.js
 * đã đối chiếu để báo khách, hàm này vẫn tự kiểm tra độc lập).
 *
 * @param {object} customerInfo { name, phone, email, serviceType, tableNumber, bookingTime, guestCount, note }
 * @returns {Promise<{ success: boolean, order?: Order, changes?: Array }>}
 */
export async function createOrder(customerInfo) {
  const { cart, changes } = await syncCartWithCatalog();
  if (cart.length === 0) return { success: false, changes };

  const orders = await getAllOrders();
  const order = Order.from({
    id: uid("order"),
    code: nextOrderCode(orders),
    ...customerInfo,
    items: cart,
    status: "pending",
    createdAt: new Date().toISOString(),
  });

  const saved = await api.post(`/${COLLECTION}`, order.toJSON());

  // Chỉ xoá giỏ hàng SAU KHI máy chủ đã lưu đơn thành công
  clearCart();

  // Trừ tồn kho các món đã bán. Mỗi món là 1 bản ghi riêng nên có thể
  // gửi song song bằng Promise.all thay vì chờ lần lượt từng món.
  await Promise.all(cart.map((item) => adjustStock(item.drinkId, -item.qty)));

  return { success: true, order: Order.from(saved), changes };
}

/**
 * Đổi trạng thái đơn hàng - PATCH /orders/:id.
 * - Chuyển SANG "cancelled": hoàn lại tồn kho các món trong đơn.
 * - Phục hồi TỪ "cancelled": trừ lại tồn kho, tránh lệch kho khi admin bấm nhầm.
 */
export async function updateOrderStatus(id, status) {
  const order = await getOrderById(id);
  if (!order) return null;

  const previous = order.status;
  order.status = status; // setter kiểm tra TRƯỚC - trạng thái sai thì dừng, chưa đụng tới kho

  if (previous !== "cancelled" && status === "cancelled") {
    await Promise.all(order.items.map((item) => adjustStock(item.drinkId, item.qty)));
  } else if (previous === "cancelled" && status !== "cancelled") {
    await Promise.all(order.items.map((item) => adjustStock(item.drinkId, -item.qty)));
  }

  const saved = await api.patch(`/${COLLECTION}/${encodeURIComponent(id)}`, { status: order.status });
  return Order.from(saved);
}

/**
 * Xoá đơn hàng - DELETE /orders/:id.
 * Đơn đang "Chờ xử lý"/"Đang pha chế" mà bị xoá thì coi như huỷ:
 * hoàn lại số ly đã trừ, nếu không tồn kho sẽ thất thoát vĩnh viễn.
 * Đơn "Hoàn tất" (đồ uống đã thật sự phục vụ) thì không hoàn kho.
 */
export async function deleteOrder(id) {
  const order = await getOrderById(id);
  if (order && order.holdsStock) {
    await Promise.all(order.items.map((item) => adjustStock(item.drinkId, item.qty)));
  }
  await api.delete(`/${COLLECTION}/${encodeURIComponent(id)}`);
  return true;
}

/** Tra cứu đơn cho khách: phải khớp cả mã đơn lẫn số điện thoại đã đặt */
export async function findOrderByCodeAndPhone(code, phone) {
  const orders = await getAllOrders();
  const normalizedCode = code.trim().toUpperCase();
  const normalizedPhone = phone.replace(/[\s.-]/g, "");
  return orders.find((o) => String(o.code).toUpperCase() === normalizedCode
    && String(o.phone).replace(/[\s.-]/g, "") === normalizedPhone) || null;
}

/** Lọc + sắp xếp đơn hàng có sẵn trong bộ nhớ (hàm đồng bộ, dùng cho bảng quản trị) */
export function filterOrders(orders, { status = "all", keyword = "", sortBy = "newest" } = {}) {
  let list = [...orders];

  if (status !== "all") {
    list = list.filter((o) => o.status === status);
  }

  const kw = keyword.trim().toLowerCase();
  if (kw) {
    list = list.filter((o) => String(o.code).toLowerCase().includes(kw)
      || String(o.name).toLowerCase().includes(kw)
      || String(o.phone).includes(kw));
  }

  const sorters = {
    newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    oldest: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    "total-desc": (a, b) => b.total - a.total,
    "total-asc": (a, b) => a.total - b.total,
  };
  if (sorters[sortBy]) list.sort(sorters[sortBy]);

  return list;
}

/** Tải từ API rồi lọc */
export async function queryOrders(opts = {}) {
  return filterOrders(await getAllOrders(), opts);
}

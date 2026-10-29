/* =========================================================
   ORDERS-SERVICE.JS - Giỏ hàng + CRUD đơn hàng
   - Giỏ hàng (cart): trạng thái tạm của riêng trình duyệt khách,
     lưu ở localStorage -> các hàm giỏ hàng là hàm đồng bộ.
   - Đơn hàng (orders): dữ liệu chung của quán, lưu trên máy chủ
     json-server tại /orders -> các hàm đơn hàng là async.
   ========================================================= */

import { getItem, setItem } from "./storage.js";
import { api, getCollection, getRecord } from "./api.js";
import { getAllDrinks, adjustStock, isSoldOut, tracksStock, availableQty } from "./drinksService.js";
import { uid, formatDateTime, normalizePhone } from "./utils.js";
import { awardPoints, findCustomerByPhone, redeemPoints, refundPoints } from "./customerAuth.js";
import { findVoucherByCode, adjustVoucherUsage, normalizeVoucherCode } from "./vouchersService.js";
import { resolvePricing } from "./promotions.js";
import { ageProblem } from "./age.js";
import { BOOKING_RULES, VENUE } from "./venue.js";

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
    total: 250000, status: "completed", paymentStatus: "paid", createdAt: daysAgo(6, 20) },

  { id: "o2", code: "DH0002", name: "Trần Văn Hùng", phone: "0912223344", email: "hung.tran@gmail.com",
    serviceType: "takeaway", note: "Gói giữ lạnh ly Rocks",
    items: [{ drinkId: "d2", name: "Smoked Old Fashioned", price: 135000, image: "img/drinks/old-fashioned.jpg", qty: 2 }],
    total: 270000, status: "completed", paymentStatus: "paid", createdAt: daysAgo(5, 21) },

  { id: "o3", code: "DH0003", name: "Lê Thị Hoa", phone: "0923334455", email: "",
    serviceType: "booking", bookingTime: daysAgo(4, 19), guestCount: 4, note: "Bàn lounge gần quầy pha chế",
    items: [
      { drinkId: "d3", name: "Dry Martini 007", price: 130000, image: "img/drinks/dry-martini.jpg", qty: 2 },
      { drinkId: "d8", name: "Aperol Spritz Veneziano", price: 120000, image: "img/drinks/aperol-spritz.jpg", qty: 2 },
    ],
    total: 500000, status: "completed", paymentStatus: "paid", createdAt: daysAgo(4, 19) },

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
    total: 335000, status: "completed", paymentStatus: "paid", createdAt: daysAgo(2, 21) },

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

export function getCart() {
  const cart = getItem(CART_KEY, []);
  return Array.isArray(cart) ? cart : [];
}

function saveCart(cart) {
  setItem(CART_KEY, cart);
  return cart;
}

/** Thêm món vào giỏ; nếu đã có thì cộng dồn số lượng */
export function addToCart(drink, qty = 1) {
  const cart = getCart();
  const index = cart.findIndex((item) => item.drinkId === drink.id);

  if (index !== -1) {
    // Đã có trong giỏ: thay bằng bản sao có số lượng mới (spread operator)
    cart[index] = { ...cart[index], qty: cart[index].qty + qty };
  } else {
    cart.push({
      drinkId: drink.id,
      name: drink.name,
      price: drink.price,
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

/** Tổng tiền + tổng số ly trong giỏ, dùng reduce() theo yêu cầu đề bài */
export function getCartSummary() {
  return getCart().reduce(
    (sum, item) => ({
      total: sum.total + item.price * item.qty,
      count: sum.count + item.qty,
    }),
    { total: 0, count: 0 },
  );
}

/**
 * Thêm `qty` ly nữa của món này vào giỏ có vượt tồn kho / đang hết hàng không.
 * Dùng chung cho trang chi tiết món và cuốn menu (cùng một luật, cùng một thông báo).
 * @returns {{ok: boolean, reason?: "soldout"|"limit", available: number, inCart: number}}
 */
export function checkCanAdd(drink, qty = 1) {
  const inCart = drink ? getCart().find((item) => item.drinkId === drink.id)?.qty || 0 : 0;
  const available = availableQty(drink); // chai rượu = tồn kho; món pha chế = không giới hạn (tối đa 99/dòng)
  if (available <= 0) return { ok: false, reason: "soldout", available: 0, inCart };
  if (inCart + qty > available) return { ok: false, reason: "limit", available, inCart };
  return { ok: true, available, inCart };
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
    if (isSoldOut(drink)) {
      changes.push({ type: "removed", name: item.name, reason: "đã hết hàng" });
      return;
    }

    let qty = item.qty;
    const maxQty = availableQty(drink);
    if (qty > maxQty) {
      changes.push({ type: "reduced", name: drink.name, from: qty, to: maxQty });
      qty = maxQty;
    }
    if (item.price !== drink.price) {
      changes.push({ type: "price", name: drink.name, from: item.price, to: drink.price });
    }

    nextCart.push({ drinkId: drink.id, name: drink.name, price: drink.price, image: drink.image, qty });
  });

  if (changes.length > 0) saveCart(nextCart);
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

/**
 * Trạng thái THANH TOÁN - tách riêng khỏi tiến độ pha chế (status):
 * khách ngồi tại quán thường uống xong mới trả, còn đặt bàn có thể trả trước.
 * - unpaid   : chưa thanh toán
 * - awaiting : khách bấm "Tôi đã chuyển khoản" -> chờ thu ngân đối chiếu sao kê
 * - paid     : thu ngân/quản lý xác nhận ĐÃ nhận tiền (tiền mặt hoặc chuyển khoản)
 * Website KHÔNG tự coi là đã trả chỉ vì khách bấm nút.
 */
export const PAYMENT_STATUS = {
  unpaid: "Chưa thanh toán",
  awaiting: "Chờ xác nhận CK",
  paid: "Đã thanh toán",
};

export const PAYMENT_STATUS_BADGE = {
  unpaid: "badge-muted",
  awaiting: "badge-warning",
  paid: "badge-success",
};

/**
 * Quy trình đơn hàng: từ mỗi trạng thái được phép chuyển sang đâu.
 * - pending   -> preparing / completed (món pha nhanh) / cancelled
 * - preparing -> completed / cancelled
 * - completed -> (không đi đâu nữa) đồ uống ĐÃ phục vụ, không thể huỷ
 *               để "hoàn kho" những ly khách đã uống
 * - cancelled -> pending (khôi phục khi quản trị bấm nhầm, kho bị trừ lại)
 */
export const ORDER_TRANSITIONS = {
  pending: ["preparing", "completed", "cancelled"],
  preparing: ["completed", "cancelled"],
  completed: [],
  cancelled: ["pending"],
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
    id, code, name, phone, email = "", serviceType, customerId = "",
    items = [], note = "", status = "pending", paymentStatus = "unpaid",
    createdAt = new Date().toISOString(),
    discounts = [], voucherCode = "", pointsUsed = 0, birthDate = "",
    doorVerification = "pending", verifiedBy = "", verificationNote = "",
  } = {}) {
    this.id = id;
    this.code = code;
    this.name = name;
    this.phone = phone ? normalizePhone(phone) : phone; // luôn lưu dạng 0xxxxxxxxx
    this.email = email;
    this.serviceType = serviceType;
    this.customerId = customerId || ""; // khách đăng nhập -> được tích điểm khi đơn hoàn tất
    this.items = items.map((item) => ({ ...item }));
    // Ưu đãi đã áp lúc đặt (giảm hạng / mã giảm giá / dùng điểm): lưu cố định, đổi chính sách sau này không làm lệch đơn cũ
    this.discounts = Array.isArray(discounts) ? discounts.map((d) => ({ ...d })) : [];
    this.voucherCode = voucherCode || "";
    this.pointsUsed = Number(pointsUsed) || 0;
    this.birthDate = birthDate || ""; // ngày sinh khách khai (đơn cũ không có) - nhân viên đối chiếu CCCD khi khách đến
    this.doorVerification = doorVerification || "pending"; // "pending" | "verified" | "rejected_underage" | "rejected_fake_info"
    this.verifiedBy = verifiedBy || "";
    this.verificationNote = verificationNote || "";
    this.note = note;
    this.status = status; // đi qua setter -> trạng thái sai sẽ bị từ chối ngay
    this.paymentStatus = Object.hasOwn(PAYMENT_STATUS, paymentStatus) ? paymentStatus : "unpaid";
    this.createdAt = createdAt;
  }

  get doorVerificationLabel() {
    const labels = {
      pending: "Chờ check-in CCCD",
      verified: "Đã duyệt CCCD 18+",
      rejected_underage: "Từ chối: Dưới 18t",
      rejected_fake_info: "Từ chối: Thông tin ảo",
    };
    return labels[this.doorVerification] || "Chưa xác minh";
  }

  get doorVerificationBadge() {
    const badges = {
      pending: "badge-door-pending",
      verified: "badge-door-verified",
      rejected_underage: "badge-door-rejected",
      rejected_fake_info: "badge-door-rejected",
    };
    return badges[this.doorVerification] || "badge-door-pending";
  }

  get paymentLabel() {
    return PAYMENT_STATUS[this.paymentStatus];
  }

  get paymentBadge() {
    return PAYMENT_STATUS_BADGE[this.paymentStatus];
  }

  /**
   * Khách còn cần quét QR trả tiền không: đơn chưa huỷ, chưa được xác nhận
   * đã trả và có tiền để trả (đặt bàn KHÔNG gọi món trước thì tổng = 0).
   */
  get needsPayment() {
    return this.#status !== "cancelled" && this.paymentStatus !== "paid" && this.total > 0;
  }

  /**
   * Đơn đã thu tiền và chưa huỷ là một dòng trong sổ doanh thu: không được xoá
   * (xoá là mất dấu tiền đã thu). Muốn bỏ thì phải huỷ đơn (hoàn tiền) trước.
   */
  get isRevenueLocked() {
    return this.paymentStatus === "paid" && this.#status !== "cancelled";
  }

  /**
   * Thời điểm khách THỰC SỰ được phục vụ - dùng để tính doanh thu theo ngày.
   * Đơn thường: lúc tạo đơn. BookingOrder ghi đè: giờ hẹn (đặt hôm thứ Hai
   * cho tối thứ Bảy thì doanh thu thuộc tối thứ Bảy).
   */
  get serviceTime() {
    return this.createdAt;
  }

  /** Đơn chỉ giữ bàn, chưa gọi món trước (chỉ có ở đặt bàn trước) */
  get isTableOnly() {
    return this.items.length === 0;
  }

  /**
   * Khách có được TỰ huỷ đơn online (trang tra cứu) không.
   * Trả về { ok, reason } để giao diện hiện lý do khi không được huỷ.
   * Lớp cha kiểm tra điều kiện chung; BookingOrder ghi đè để thêm điều kiện giờ hẹn.
   */
  customerCancelCheck(_now = Date.now()) {
    if (this.#status !== "pending") {
      return { ok: false, reason: `Đơn đang ở trạng thái "${this.statusLabel}" - vui lòng gọi hotline ${VENUE.hotline} để được hỗ trợ.` };
    }
    if (this.paymentStatus !== "unpaid") {
      return { ok: false, reason: `Đơn đã thanh toán hoặc đang chờ đối chiếu chuyển khoản - vui lòng gọi hotline ${VENUE.hotline} để được hoàn tiền.` };
    }
    return { ok: true, reason: "" };
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

  /** Tạm tính = tổng các món (chưa giảm), luôn tính lại từ danh sách món -> không lệch với các món */
  get subtotal() {
    return this.items.reduce((sum, item) => sum + item.price * item.qty, 0);
  }

  /** Tổng ưu đãi đã áp, không bao giờ vượt tạm tính */
  get discountTotal() {
    const sum = this.discounts.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
    return Math.min(sum, this.subtotal);
  }

  /** Số tiền khách PHẢI TRẢ (sau ưu đãi): dùng cho QR thanh toán, doanh thu và tích điểm */
  get total() {
    return this.subtotal - this.discountTotal;
  }

  get itemCount() {
    return this.items.reduce((sum, item) => sum + item.qty, 0);
  }

  get statusLabel() {
    return ORDER_STATUS[this.#status];
  }

  /** Từ trạng thái hiện tại có được chuyển sang "next" không (theo ORDER_TRANSITIONS) */
  canChangeTo(next) {
    return ORDER_TRANSITIONS[this.#status].includes(next);
  }

  /**
   * Đổi trạng thái THEO QUY TRÌNH. Khác với setter `status` (chỉ kiểm tra
   * giá trị hợp lệ - dùng khi nạp dữ liệu từ API), hàm này còn chặn các
   * bước chuyển sai nghiệp vụ, VD "Hoàn tất" -> "Đã huỷ".
   */
  changeStatus(next) {
    if (!Object.hasOwn(ORDER_STATUS, next)) {
      throw new Error(`Trạng thái đơn hàng không hợp lệ: "${next}"`);
    }
    if (!this.canChangeTo(next)) {
      throw new Error(`Không thể chuyển đơn ${this.code} từ "${this.statusLabel}" sang "${ORDER_STATUS[next]}".`);
    }
    this.status = next;
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
      customerId: this.customerId,
      birthDate: this.birthDate,
      items: this.items,
      note: this.note,
      status: this.status,
      paymentStatus: this.paymentStatus,
      subtotal: this.subtotal,
      discounts: this.discounts,
      voucherCode: this.voucherCode,
      pointsUsed: this.pointsUsed,
      doorVerification: this.doorVerification,
      verifiedBy: this.verifiedBy,
      verificationNote: this.verificationNote,
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

  /** Ghi đè: doanh thu của đơn đặt bàn tính theo giờ hẹn, không theo lúc bấm đặt */
  get serviceTime() {
    return this.bookingTime || this.createdAt;
  }

  /** Giờ hẹn còn ở tương lai hay đã qua */
  get isUpcoming() {
    return new Date(this.bookingTime).getTime() > Date.now();
  }

  /** Ghi đè: ngoài điều kiện chung, phải huỷ trước giờ hẹn ít nhất cancelDeadlineHours tiếng */
  customerCancelCheck(now = Date.now()) {
    const base = super.customerCancelCheck(now);
    if (!base.ok) return base;

    const hoursLeft = (new Date(this.bookingTime).getTime() - now) / (60 * 60 * 1000);
    if (hoursLeft < BOOKING_RULES.cancelDeadlineHours) {
      return {
        ok: false,
        reason: `Chỉ tự huỷ online được trước giờ hẹn ít nhất ${BOOKING_RULES.cancelDeadlineHours} tiếng - vui lòng gọi hotline ${VENUE.hotline}.`,
      };
    }
    return base;
  }

  serviceDetails() {
    return [
      ["Thời gian đến", formatDateTime(this.bookingTime)],
      ["Số lượng khách", `${this.guestCount} người`],
      ...(this.isTableOnly ? [["Gọi món", "Chỉ giữ bàn - gọi món khi đến quán"]] : []),
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

/* ============== SỨC CHỨA ĐẶT BÀN ============== */

/**
 * Tổng số khách của các lượt đặt bàn (chưa huỷ) NGỒI CÙNG LÚC với giờ "time":
 * hai lượt cách nhau ít hơn slotMinutes (2 tiếng) thì tính là chồng giờ.
 * Hàm đồng bộ, nhận danh sách đơn có sẵn -> dễ kiểm thử.
 */
export function seatsBookedAround(orders, time, excludeId = null) {
  const slotMs = BOOKING_RULES.slotMinutes * 60 * 1000;
  const target = new Date(time).getTime();
  return orders
    .filter((o) => o.serviceType === "booking" && o.status !== "cancelled" && o.id !== excludeId)
    .filter((o) => Math.abs(new Date(o.bookingTime).getTime() - target) < slotMs)
    .reduce((sum, o) => sum + (Number(o.guestCount) || 0), 0);
}

/** Số chỗ còn trống quanh giờ "time" (đọc đơn mới nhất từ máy chủ) */
export async function getRemainingSeats(time) {
  const orders = await getAllOrders();
  return Math.max(0, BOOKING_RULES.capacity - seatsBookedAround(orders, time));
}

/**
 * Tạo đơn hàng mới từ giỏ hàng + thông tin khách - POST /orders.
 * Đối chiếu tồn kho lần cuối ngay trước khi lưu (an toàn kép: order.js
 * đã đối chiếu để báo khách, hàm này vẫn tự kiểm tra độc lập).
 *
 * Quy tắc theo hình thức:
 * - Gọi món tại bàn (dine-in): bắt buộc có ít nhất 1 món.
 * - Đặt bàn trước (booking): gọi món trước là TUỲ CHỌN (giỏ trống = chỉ giữ bàn);
 *   nhưng nếu khách CÓ chọn món mà món hết sạch thì dừng lại cho khách xem lại,
 *   không tự biến thành đơn chỉ giữ bàn. Ngoài ra phải còn đủ chỗ trong khung giờ.
 *
 * @param {object} customerInfo { name, phone, email, serviceType, tableNumber, bookingTime, guestCount, note }
 * @returns {Promise<{ success: boolean, order?: Order, changes?: Array }>}
 */
export async function createOrder(customerInfo) {
  // Không phục vụ đồ uống có cồn cho người dưới 18 tuổi: ngày sinh khai thiếu/không hợp lệ/dưới 18 thì dừng ngay
  const ageError = ageProblem(customerInfo.birthDate);
  if (ageError) throw new Error(ageError);

  const isBooking = customerInfo.serviceType === "booking";
  const itemsProvided = Array.isArray(customerInfo.items) && customerInfo.items.length > 0 ? customerInfo.items : null;
  const hadItems = (itemsProvided || getCart()).length > 0;

  // Giờ đặt bàn lưu dạng ISO (UTC): chuỗi "YYYY-MM-DDTHH:mm" của ô chọn giờ không có
  // múi giờ nên sẽ bị hiểu lệch khi máy khách và máy quán khác múi giờ.
  let bookingTime = customerInfo.bookingTime || "";
  if (isBooking) {
    const parsed = new Date(bookingTime);
    if (Number.isNaN(parsed.getTime())) throw new Error("Giờ đặt bàn không hợp lệ.");
    bookingTime = parsed.toISOString();
  }

  const { cart, changes } = itemsProvided
    ? { cart: itemsProvided, changes: [] }
    : await syncCartWithCatalog();
  if (cart.length === 0 && (!isBooking || hadItems)) return { success: false, changes };

  const orders = await getAllOrders();

  if (isBooking) {
    const remaining = BOOKING_RULES.capacity - seatsBookedAround(orders, bookingTime);
    const guests = Number(customerInfo.guestCount) || 0;
    if (guests > remaining) {
      throw new Error(remaining > 0
        ? `Khung giờ này chỉ còn ${remaining} chỗ, không đủ cho ${guests} khách. Vui lòng chọn giờ khác.`
        : "Khung giờ này đã kín chỗ. Vui lòng chọn giờ khác.");
    }
  }

  // Tính ưu đãi LẠI trên máy chủ ngay lúc chốt đơn (không tin con số trên giao diện):
  // mã/điểm sai thì ném lỗi, chưa đụng tới dữ liệu nào.
  const { voucherCode: wantedCode, pointsToUse, ...orderInfo } = customerInfo;
  const pricing = await resolvePricing({
    subtotal: cart.reduce((sum, item) => sum + item.price * item.qty, 0),
    customerId: customerInfo.customerId || "",
    voucherCode: wantedCode,
    pointsToUse,
    phone: customerInfo.phone,
    orders,
    strict: true,
  });

  const order = Order.from({
    id: uid("order"),
    code: nextOrderCode(orders),
    ...orderInfo,
    bookingTime,
    items: cart,
    discounts: pricing.discounts,
    voucherCode: pricing.voucherCode,
    pointsUsed: pricing.pointsUsed,
    status: "pending",
    createdAt: new Date().toISOString(),
  });

  // Trừ điểm TRƯỚC khi lưu đơn; lưu đơn lỗi thì hoàn điểm lại ngay
  if (order.pointsUsed > 0) await redeemPoints(order.customerId, order.pointsUsed, order);
  let saved;
  try {
    saved = await api.post(`/${COLLECTION}`, order.toJSON());
  } catch (err) {
    if (order.pointsUsed > 0) await refundPoints(order.customerId, order).catch(() => {});
    throw err;
  }

  // Chỉ xoá giỏ hàng SAU KHI máy chủ đã lưu đơn thành công
  if (itemsProvided) {
    itemsProvided.forEach((item) => removeFromCart(item.drinkId));
  } else {
    clearCart();
  }

  if (pricing.voucherId) {
    try {
      await adjustVoucherUsage(pricing.voucherId, 1);
    } catch (err) {
      console.warn("[voucher] Không ghi được lượt dùng mã:", err);
    }
  }

  // Trừ tồn kho các món đã bán (đơn chỉ giữ bàn thì cart rỗng -> không trừ gì).
  // Mỗi món là 1 bản ghi riêng nên gửi song song bằng Promise.all.
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
  if (status === previous) return order; // không đổi gì -> không đụng tới kho

  // Kiểm tra TRƯỚC theo quy trình - bước chuyển sai thì dừng, chưa đụng tới kho
  order.changeStatus(status);

  // Khôi phục đơn đã huỷ = lấy lại kho + chỗ ngồi + điểm đã dùng: phải còn đủ thì mới cho khôi phục
  if (previous === "cancelled") {
    await assertCanRestore(order);
    if (order.pointsUsed > 0 && order.customerId) await redeemPoints(order.customerId, order.pointsUsed, order);
  }

  if (previous !== "cancelled" && status === "cancelled") {
    await Promise.all(order.items.map((item) => adjustStock(item.drinkId, item.qty)));
    await releasePromotions(order);
  } else if (previous === "cancelled" && status !== "cancelled") {
    await Promise.all(order.items.map((item) => adjustStock(item.drinkId, -item.qty)));
    await adjustVoucherUsageByCode(order.voucherCode, 1);
  }

  const saved = await api.patch(`/${COLLECTION}/${encodeURIComponent(id)}`, { status: order.status });
  const updated = Order.from(saved);

  // Đơn hoàn tất -> cộng điểm cho khách đã đăng nhập khi đặt (completed là bước cuối nên chỉ cộng một lần).
  // Cộng điểm lỗi không được làm hỏng việc chốt đơn.
  if (status === "completed") {
    try {
      // Đơn đặt lúc đã đăng nhập có customerId; đơn đặt vãng lai thì nhận diện thành viên qua số điện thoại
      const memberId = updated.customerId || (await findCustomerByPhone(updated.phone))?.id;
      if (memberId) await awardPoints(memberId, { id: updated.id, code: updated.code, total: updated.total });
    } catch (err) {
      console.warn("[loyalty] Không cộng được điểm thưởng:", err);
    }
  }
  return updated;
}

/** Cộng/trừ lượt dùng của mã theo CHUỖI MÃ lưu trên đơn; mã đã bị xoá hoặc lỗi mạng thì bỏ qua (không chặn nghiệp vụ chính) */
async function adjustVoucherUsageByCode(code, delta) {
  if (!code) return;
  try {
    const voucher = await findVoucherByCode(code);
    if (voucher) await adjustVoucherUsage(voucher.id, delta);
  } catch (err) {
    console.warn("[voucher] Không cập nhật được lượt dùng mã:", err);
  }
}

/** Đơn bị huỷ/xoá khi chưa phục vụ: trả điểm đã dùng về ví khách + trả lại một lượt dùng mã */
async function releasePromotions(order) {
  try {
    if (order.pointsUsed > 0 && order.customerId) await refundPoints(order.customerId, order);
  } catch (err) {
    console.warn("[loyalty] Không hoàn được điểm đã dùng:", err);
  }
  await adjustVoucherUsageByCode(order.voucherCode, -1);
}

/**
 * Điều kiện để khôi phục một đơn đã huỷ. Trong lúc đơn bị huỷ, kho đã được hoàn lại và chỗ
 * ngồi đã nhả ra - có thể đã bán/đặt cho người khác. Không kiểm tra thì adjustStock() chỉ
 * kẹp kho về 0 (bán lố ly mà không ai biết) và khung giờ có thể vượt sức chứa.
 */
async function assertCanRestore(order) {
  if (order.pointsUsed > 0 && order.customerId) {
    const customer = await api.get(`/customers/${encodeURIComponent(order.customerId)}`).catch(() => null);
    if (!customer) throw new Error(`Không thể khôi phục đơn ${order.code}: tài khoản thành viên đã dùng điểm cho đơn này không còn tồn tại.`);
    if ((Number(customer.points) || 0) < order.pointsUsed) {
      throw new Error(`Không thể khôi phục đơn ${order.code}: khách chỉ còn ${Number(customer.points) || 0} điểm, đơn đã dùng ${order.pointsUsed} điểm.`);
    }
  }
  if (order.voucherCode) {
    const code = normalizeVoucherCode(order.voucherCode);
    const phone = normalizePhone(order.phone);
    const clash = (await getAllOrders()).some((o) => o.id !== order.id && o.status !== "cancelled"
      && normalizeVoucherCode(o.voucherCode) === code && normalizePhone(o.phone) === phone);
    if (clash) throw new Error(`Không thể khôi phục đơn ${order.code}: số điện thoại này đã dùng mã ${order.voucherCode} ở đơn khác.`);
  }

  const drinkMap = new Map((await getAllDrinks()).map((d) => [d.id, d]));
  for (const item of order.items) {
    const drink = drinkMap.get(item.drinkId);
    if (!drink) {
      throw new Error(`Không thể khôi phục đơn ${order.code}: món "${item.name}" không còn trong thực đơn.`);
    }
    const stock = Number(drink.stock) || 0;
    // Chỉ chai rượu mới có tồn kho; món pha chế khôi phục thoải mái
    if (tracksStock(drink) && stock < item.qty) {
      throw new Error(`Không thể khôi phục đơn ${order.code}: "${item.name}" chỉ còn ${stock} ly trong kho (đơn cần ${item.qty}).`);
    }
  }

  if (order.serviceType === "booking") {
    const remaining = BOOKING_RULES.capacity - seatsBookedAround(await getAllOrders(), order.bookingTime, order.id);
    if (order.guestCount > remaining) {
      throw new Error(`Không thể khôi phục đơn ${order.code}: khung giờ này chỉ còn ${Math.max(0, remaining)} chỗ, đơn cần ${order.guestCount}.`);
    }
  }
}

/**
 * Xoá đơn hàng - DELETE /orders/:id.
 * Đơn đang "Chờ xử lý"/"Đang pha chế" mà bị xoá thì coi như huỷ:
 * hoàn lại số ly đã trừ, nếu không tồn kho sẽ thất thoát vĩnh viễn.
 * Đơn "Hoàn tất" (đồ uống đã thật sự phục vụ) thì không hoàn kho.
 */
export async function deleteOrder(id) {
  const order = await getOrderById(id);
  if (order?.isRevenueLocked) {
    throw new Error(`Đơn ${order.code} đã thu tiền nên được giữ lại trong sổ doanh thu, không xoá được. Cần bỏ đơn này thì hãy huỷ đơn (hoàn tiền cho khách) trước.`);
  }
  if (order && order.holdsStock) {
    await Promise.all(order.items.map((item) => adjustStock(item.drinkId, item.qty)));
    await releasePromotions(order); // xoá đơn chưa phục vụ = huỷ: trả lại điểm và lượt dùng mã
  }
  await api.delete(`/${COLLECTION}/${encodeURIComponent(id)}`);
  return true;
}

/**
 * Khách bấm "Tôi đã chuyển khoản xong" - PATCH paymentStatus = "awaiting".
 * Chỉ là LỜI BÁO của khách: đơn chưa được tính là đã trả cho tới khi
 * thu ngân đối chiếu sao kê và gọi confirmPayment().
 */
export async function reportTransferSent(id) {
  const order = await getOrderById(id);
  if (!order) throw new Error("Không tìm thấy đơn hàng.");
  if (!order.needsPayment) return order;              // đã trả hoặc đã huỷ -> không đổi
  if (order.paymentStatus === "awaiting") return order;
  const saved = await api.patch(`/${COLLECTION}/${encodeURIComponent(id)}`, { paymentStatus: "awaiting" });
  return Order.from(saved);
}

/** Thu ngân/quản lý xác nhận ĐÃ nhận tiền (tiền mặt hoặc chuyển khoản) - PATCH paymentStatus = "paid" */
export async function confirmPayment(id) {
  const order = await getOrderById(id);
  if (!order) throw new Error("Không tìm thấy đơn hàng.");
  if (order.status === "cancelled") throw new Error(`Đơn ${order.code} đã huỷ, không thể xác nhận thanh toán.`);
  const saved = await api.patch(`/${COLLECTION}/${encodeURIComponent(id)}`, { paymentStatus: "paid" });
  return Order.from(saved);
}

/**
 * Khách TỰ huỷ đơn từ trang tra cứu. Phải nhập lại đúng mã đơn + SĐT
 * (người lạ không huỷ được đơn của người khác). Điều kiện huỷ do chính
 * đối tượng đơn quyết định (customerCancelCheck - đa hình theo loại đơn);
 * huỷ xong tự hoàn kho các món qua updateOrderStatus().
 */
export async function cancelByCustomer(code, phone) {
  const order = await findOrderByCodeAndPhone(code, phone);
  if (!order) throw new Error("Không tìm thấy đơn khớp với mã và số điện thoại.");

  const { ok, reason } = order.customerCancelCheck();
  if (!ok) throw new Error(reason);

  return updateOrderStatus(order.id, "cancelled");
}

/** Tra cứu đơn cho khách: phải khớp cả mã đơn lẫn số điện thoại đã đặt */
export async function findOrderByCodeAndPhone(code, phone) {
  const orders = await getAllOrders();
  const normalizedCode = String(code || "").trim().toUpperCase();
  const normalizedPhone = normalizePhone(phone);
  return orders.find((o) => String(o.code).toUpperCase() === normalizedCode
    && normalizePhone(o.phone) === normalizedPhone) || null;
}

/** Lọc + sắp xếp đơn hàng có sẵn trong bộ nhớ (hàm đồng bộ, dùng cho bảng quản trị) */
export function filterOrders(orders, { status = "all", payment = "all", keyword = "", sortBy = "newest" } = {}) {
  let list = [...orders];

  if (status !== "all") {
    list = list.filter((o) => o.status === status);
  }
  if (payment !== "all") {
    list = list.filter((o) => o.paymentStatus === payment);
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

/**
 * Thao tác Lễ tân Door Host / Quản lý (Lê Thành Tài):
 * - status: "verified" -> Khách xuất trình CCCD chuẩn, đủ 18 tuổi.
 * - status: "rejected_underage" -> Khách dưới 18 tuổi / khai man -> Hủy đơn, hoàn kho, khóa tài khoản.
 * - status: "rejected_fake_info" -> Số điện thoại ảo / bom hàng -> Hủy đơn, hoàn kho.
 */
export async function verifyOrderDoorCheck(orderId, { status, staffName = "Lê Thành Tài", note = "" } = {}) {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Không tìm thấy đơn hàng.");

  const payload = {
    doorVerification: status,
    verifiedBy: staffName,
    verificationNote: note,
  };

  if (status === "rejected_underage" || status === "rejected_fake_info") {
    // Tự động chuyển đơn sang huỷ và hoàn kho nguyên liệu rượu
    if (order.status !== "cancelled") {
      await updateOrderStatus(orderId, "cancelled");
    }
    // Nếu khách có tài khoản thành viên, tạm khóa do gian lận thông tin
    if (order.customerId) {
      try {
        await api.patch(`/customers/${encodeURIComponent(order.customerId)}`, {
          status: "inactive",
          banReason: status === "rejected_underage"
            ? "Tài khoản bị tạm khóa do khai gian ngày sinh / chưa đủ 18 tuổi khi đối chiếu CCCD tại cửa."
            : "Tài khoản bị tạm khóa do cung cấp thông tin không có thật.",
        });
      } catch (err) {
        console.warn("[doorCheck] Không khoá được tài khoản khách:", err);
      }
    }
  }

  const saved = await api.patch(`/${COLLECTION}/${encodeURIComponent(orderId)}`, payload);
  return Order.from(saved);
}

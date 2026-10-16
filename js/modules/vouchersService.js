/* =========================================================
   VOUCHERS-SERVICE.JS - Mã giảm giá & chương trình Sale
   Dữ liệu lưu trên máy chủ json-server tại /vouchers.

   Ba nhóm mã (trường `audience`):
   - "all"          : mã công khai cho mọi khách (HAPPY10, SALE15...).
   - "new-customer" : chỉ cho đơn ĐẦU TIÊN - số điện thoại chưa từng có
                      đơn (không tính đơn đã huỷ). Gồm mã công khai
                      BANMOI10 và mã cá nhân "CHAOxxxx" tặng khi đăng ký.
   - "birthday"     : quà sinh nhật - mã cá nhân "SNyyxxxx" phát tự động
                      khi thành viên đăng nhập trong khoảng ± 7 ngày quanh
                      sinh nhật (mỗi năm 1 mã).
   - "holiday"      : quà ngày lễ - mã cá nhân phát khi thành viên đăng nhập
                      trong dịp lễ (hoặc admin gửi hàng loạt), mỗi dịp mỗi năm
                      1 mã: Giáng sinh "NOELyy..." 25%, 30/4 - 1/5 "TNyy..." 30%,
                      Quốc khánh 2/9 "QKyy..." 20%.
   Mã cá nhân mới được gửi về email của khách (emailService.js).
   Mức giảm chỉ được chọn trong các "loại sale" cố định DISCOUNT_TIERS.

   LƯU Ý VÒNG IMPORT: ordersService.js import file này (kiểm tra mã khi
   đặt đơn) nên ở đây KHÔNG import ordersService - cần đọc đơn hàng thì
   gọi thẳng getCollection("orders") của api.js.
   ========================================================= */

import { api, getCollection, getRecord } from "./api.js";
import { uid, formatMoney } from "./utils.js";
import {
  birthdayInYear, findBirthdayInWindow, parseBirthday, normalizePhone, BIRTHDAY_WINDOW_DAYS,
} from "./customersService.js";

const COLLECTION = "vouchers";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Các "loại sale" admin được chọn: 10, 15, 20, 25, 30, 35, 40, 50 (%) */
export const DISCOUNT_TIERS = [10, 15, 20, 25, 30, 35, 40, 50];

export const VOUCHER_AUDIENCES = {
  all: "Mọi khách hàng",
  "new-customer": "Khách hàng mới (đơn đầu tiên)",
  birthday: "Quà sinh nhật (mã cá nhân)",
  holiday: "Quà ngày lễ (mã cá nhân)",
};

/**
 * Các dịp lễ có quà giảm giá. Mã dùng được trong khoảng [start, end] (tháng/ngày,
 * hết ngày end lúc 23:59:59) - cũng là khoảng hệ thống tự phát mã khi khách đăng nhập.
 */
export const HOLIDAYS = [
  {
    key: "christmas", name: "Giáng sinh", percent: 25, prefix: "NOEL",
    start: { month: 12, day: 20 }, end: { month: 12, day: 26 },
    greeting: "Giáng sinh an lành và ấm áp",
  },
  {
    key: "reunification", name: "Lễ 30/4 - 1/5", percent: 30, prefix: "TN",
    start: { month: 4, day: 27 }, end: { month: 5, day: 3 },
    greeting: "Chào mừng ngày Giải phóng miền Nam 30/4 và Quốc tế Lao động 1/5",
  },
  {
    key: "national-day", name: "Quốc khánh 2/9", percent: 20, prefix: "QK",
    start: { month: 8, day: 30 }, end: { month: 9, day: 4 },
    greeting: "Chào mừng Quốc khánh 2/9",
  },
];

/** % giảm của mã quà sinh nhật / mã chào mừng thành viên mới */
export const BIRTHDAY_DISCOUNT = 25;
export const WELCOME_DISCOUNT = 15;
/** Mã chào mừng có hạn dùng 30 ngày kể từ lúc đăng ký */
export const WELCOME_VALID_DAYS = 30;

/** Trạng thái hiển thị của một mã (key -> nhãn + class huy hiệu) */
export const VOUCHER_STATUS = {
  active: { label: "Đang hiệu lực", badge: "badge-success" },
  upcoming: { label: "Chưa bắt đầu", badge: "badge-info" },
  expired: { label: "Hết hạn", badge: "badge-muted" },
  usedup: { label: "Hết lượt", badge: "badge-warning" },
  inactive: { label: "Đã tắt", badge: "badge-danger" },
};

/** Mã chỉ gồm chữ IN HOA và số, 4-16 ký tự */
export const VOUCHER_CODE_PATTERN = /^[A-Z0-9]{4,16}$/;

/* =========================================================
   TIỆN ÍCH
   ========================================================= */

/** "  happy 10 " -> "HAPPY10": cắt khoảng trắng, IN HOA, bỏ mọi dấu cách */
export function normalizeCode(code) {
  return String(code ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Đọc ngày của mã. Chuỗi chỉ có "YYYY-MM-DD" (gõ tay trong db.json) được hiểu
 * theo giờ địa phương: ngày bắt đầu = 00:00, ngày kết thúc = 23:59:59 của hôm đó.
 * Trả null nếu rỗng / sai.
 */
function parseVoucherDate(value, atEndOfDay = false) {
  if (!value) return null;
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  const d = plain
    ? new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3]), ...(atEndOfDay ? [23, 59, 59, 999] : [0, 0, 0, 0]))
    : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Cuối ngày (23:59:59.999 giờ địa phương) của một Date */
function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Ngày hiển thị trong câu thông báo: "04/10/2026" (hoặc "04/10" nếu withYear = false).
 * Tự ghép chuỗi vì định dạng ngày theo locale mỗi trình duyệt in một kiểu (VD "14-10").
 */
function formatDayMonth(date, withYear = true) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return withYear ? `${dd}/${mm}/${date.getFullYear()}` : `${dd}/${mm}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Bảng chữ sinh mã ngẫu nhiên: bỏ 0/O, 1/I (dễ đọc nhầm khi khách gõ lại) */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomChars(length) {
  const values = new Uint32Array(length);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(values);
  } else {
    for (let i = 0; i < length; i++) values[i] = Math.floor(Math.random() * 0x100000000);
  }
  return [...values].map((v) => CODE_ALPHABET[v % CODE_ALPHABET.length]).join("");
}

/**
 * Sinh mã "TIỀN TỐ + n ký tự ngẫu nhiên" KHÔNG trùng với các mã đã có.
 * @param {string} prefix VD "CHAO", "SN26"
 * @param {number} length số ký tự ngẫu nhiên
 * @param {Iterable<string>} takenCodes các mã đang tồn tại
 */
export function generateVoucherCode(prefix = "", length = 4, takenCodes = []) {
  const taken = new Set([...takenCodes].map(normalizeCode));
  const head = normalizeCode(prefix);
  for (let attempt = 0; attempt < 200; attempt++) {
    // Thử nhiều lần mà vẫn trùng (gần như không xảy ra) thì nới thêm 1 ký tự
    const code = head + randomChars(length + Math.floor(attempt / 50));
    if (!taken.has(code)) return code;
  }
  throw new Error("Không sinh được mã giảm giá không trùng - vui lòng thử lại.");
}

/** Mức % gần nhất trong DISCOUNT_TIERS (dùng khi dữ liệu cũ có % lạ) */
function nearestTier(value) {
  const n = Number(value) || 0;
  return DISCOUNT_TIERS.reduce((best, tier) => (Math.abs(tier - n) < Math.abs(best - n) ? tier : best), DISCOUNT_TIERS[0]);
}

/* =========================================================
   LỚP MÃ GIẢM GIÁ (class, getter/setter, trường private)
   ========================================================= */

export class Voucher {
  // % giảm là trường private: chỉ đổi qua setter có kiểm tra "loại sale"
  #percent;

  constructor({
    id,
    code = "",
    name = "",
    description = "",
    percent = DISCOUNT_TIERS[0],
    minOrder = 0,
    maxDiscount = 0,
    startDate = "",
    endDate = "",
    usageLimit = 0,
    usedCount = 0,
    audience = "all",
    customerId = "",
    active = true,
    createdAt = "",
    birthdayYear = 0,
    holidayKey = "",
    holidayYear = 0,
  } = {}) {
    this.id = id;
    this.code = normalizeCode(code);
    this.name = String(name || "").trim();
    this.description = String(description || "").trim();
    this.percent = percent; // đi qua setter
    this.minOrder = Math.max(0, Number(minOrder) || 0);
    this.maxDiscount = Math.max(0, Number(maxDiscount) || 0);
    this.startDate = startDate || createdAt || "";
    this.endDate = endDate || "";
    this.usageLimit = Math.max(0, Math.floor(Number(usageLimit) || 0));
    this.usedCount = Math.max(0, Math.floor(Number(usedCount) || 0));
    this.audience = Object.hasOwn(VOUCHER_AUDIENCES, audience) ? audience : "all";
    this.customerId = customerId ? String(customerId) : "";
    this.active = active !== false && active !== "false";
    this.createdAt = createdAt || new Date().toISOString();
    // Mã sinh nhật thuộc năm nào (mỗi năm mỗi khách chỉ 1 mã). Dữ liệu cũ
    // thiếu trường này thì suy ra từ mã "SNyy...".
    const fromCode = /^SN(\d{2})/.exec(this.code);
    this.birthdayYear = this.audience === "birthday"
      ? Number(birthdayYear) || (fromCode ? 2000 + Number(fromCode[1]) : 0)
      : 0;
    // Mã ngày lễ: thuộc dịp nào, năm nào (mỗi dịp mỗi năm mỗi khách chỉ 1 mã)
    this.holidayKey = this.audience === "holiday" ? String(holidayKey || "") : "";
    this.holidayYear = this.audience === "holiday" ? Number(holidayYear) || 0 : 0;
  }

  get percent() {
    return this.#percent;
  }

  /** Setter: chỉ nhận các mức trong DISCOUNT_TIERS */
  set percent(value) {
    const n = Number(value);
    if (!DISCOUNT_TIERS.includes(n)) {
      throw new Error(`Mức giảm không hợp lệ: ${value}%. Chỉ chọn một trong: ${DISCOUNT_TIERS.join(", ")}%.`);
    }
    this.#percent = n;
  }

  /** Mã cá nhân - gắn với đúng 1 thành viên */
  get isPersonal() {
    return Boolean(this.customerId);
  }

  get startTime() {
    return parseVoucherDate(this.startDate, false);
  }

  get endTime() {
    return parseVoucherDate(this.endDate, true);
  }

  /** Trạng thái tại một thời điểm bất kỳ (dùng để kiểm thử với "now" giả) */
  statusAt(now = new Date()) {
    const time = new Date(now).getTime();
    if (!this.active) return "inactive";
    if (this.endTime && time > this.endTime.getTime()) return "expired";
    if (this.usageLimit > 0 && this.usedCount >= this.usageLimit) return "usedup";
    if (this.startTime && time < this.startTime.getTime()) return "upcoming";
    return "active";
  }

  get status() {
    return this.statusAt(new Date());
  }

  get isExpired() {
    return Boolean(this.endTime) && Date.now() > this.endTime.getTime();
  }

  get isUpcoming() {
    return Boolean(this.startTime) && Date.now() < this.startTime.getTime();
  }

  get isUsedUp() {
    return this.usageLimit > 0 && this.usedCount >= this.usageLimit;
  }

  get isUsable() {
    return this.active && !this.isExpired && !this.isUpcoming && !this.isUsedUp;
  }

  /** Số lượt còn lại; Infinity nếu không giới hạn */
  get remainingUses() {
    return this.usageLimit > 0 ? Math.max(0, this.usageLimit - this.usedCount) : Infinity;
  }

  get statusLabel() {
    return VOUCHER_STATUS[this.status].label;
  }

  get statusBadge() {
    return VOUCHER_STATUS[this.status].badge;
  }

  get audienceLabel() {
    return VOUCHER_AUDIENCES[this.audience] || this.audience;
  }

  /** Mô tả điều kiện ngắn gọn: "Đơn từ 400.000đ · Giảm tối đa 100.000đ" */
  get conditionLabel() {
    const parts = [this.minOrder > 0 ? `Đơn từ ${formatMoney(this.minOrder)}` : "Mọi giá trị đơn"];
    if (this.maxDiscount > 0) parts.push(`Giảm tối đa ${formatMoney(this.maxDiscount)}`);
    return parts.join(" · ");
  }

  /**
   * Số tiền được giảm cho một đơn có tạm tính `subtotal`.
   * Chưa đủ đơn tối thiểu -> 0; có trần giảm -> không vượt trần; không vượt subtotal.
   */
  computeDiscount(subtotal) {
    const amount = Math.max(0, Number(subtotal) || 0);
    if (amount === 0 || amount < this.minOrder) return 0;
    let discount = Math.round((amount * this.percent) / 100);
    if (this.maxDiscount > 0) discount = Math.min(discount, this.maxDiscount);
    return Math.min(discount, amount);
  }

  /** Dữ liệu thuần để gửi lên API (JSON.stringify không lấy được trường private) */
  toJSON() {
    return {
      id: this.id,
      code: this.code,
      name: this.name,
      description: this.description,
      percent: this.percent,
      minOrder: this.minOrder,
      maxDiscount: this.maxDiscount,
      startDate: this.startDate,
      endDate: this.endDate,
      usageLimit: this.usageLimit,
      usedCount: this.usedCount,
      audience: this.audience,
      // Mã công khai KHÔNG ghi trường customerId: json-server 0.17 coi mọi trường
      // "...Id" là khoá ngoại và tự xoá bản ghi trỏ tới khách không tồn tại
      // (kể cả chuỗi rỗng) mỗi khi có một lệnh DELETE bất kỳ.
      ...(this.customerId ? { customerId: this.customerId } : {}),
      active: this.active,
      createdAt: this.createdAt,
      ...(this.birthdayYear ? { birthdayYear: this.birthdayYear } : {}),
      ...(this.holidayKey ? { holidayKey: this.holidayKey, holidayYear: this.holidayYear } : {}),
    };
  }

  /**
   * Tạo Voucher từ dữ liệu API. Bản ghi lỡ có % lạ (sửa tay db.json) được
   * đưa về mức gần nhất để trang quản trị vẫn hiển thị và sửa lại được.
   */
  static from(data) {
    if (data instanceof Voucher) return data;
    try {
      return new Voucher(data);
    } catch {
      console.warn(`[vouchers] Mã "${data?.code}" có mức giảm lạ (${data?.percent}%), tạm hiểu là ${nearestTier(data?.percent)}%.`);
      return new Voucher({ ...data, percent: nearestTier(data?.percent) });
    }
  }
}

/* =========================================================
   DỮ LIỆU MẪU - ngày tính tương đối từ lúc nạp module
   ========================================================= */

function seedDate(offsetDays, hour = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

const seedEnd = (offsetDays) => endOfDay(addDays(new Date(), offsetDays)).toISOString();

export const SEED_VOUCHERS = [
  {
    id: "v1", code: "BANMOI10", name: "Chào khách mới",
    description: "Giảm 10% cho đơn đầu tiên của số điện thoại chưa từng đặt tại quán.",
    percent: 10, minOrder: 0, maxDiscount: 0, startDate: seedDate(-60), endDate: seedEnd(300),
    usageLimit: 0, usedCount: 7, audience: "new-customer", active: true, createdAt: seedDate(-60, 9),
  },
  {
    id: "v2", code: "HAPPY10", name: "Happy Hour mỗi tối",
    description: "Giảm 10% cho mọi đơn từ 200.000đ.",
    percent: 10, minOrder: 200000, maxDiscount: 0, startDate: seedDate(-30), endDate: seedEnd(180),
    usageLimit: 0, usedCount: 18, audience: "all", active: true, createdAt: seedDate(-30, 10),
  },
  {
    id: "v3", code: "SALE15", name: "Sale 15% giữa tuần",
    description: "Giảm 15% đơn từ 400.000đ, tối đa 100.000đ.",
    percent: 15, minOrder: 400000, maxDiscount: 100000, startDate: seedDate(-20), endDate: seedEnd(90),
    usageLimit: 0, usedCount: 9, audience: "all", active: true, createdAt: seedDate(-20, 11),
  },
  {
    id: "v4", code: "CUOITUAN25", name: "Cuối tuần rực rỡ",
    description: "Giảm 25% đơn từ 600.000đ, tối đa 200.000đ - chỉ 50 lượt.",
    percent: 25, minOrder: 600000, maxDiscount: 200000, startDate: seedDate(-10), endDate: seedEnd(60),
    usageLimit: 50, usedCount: 12, audience: "all", active: true, createdAt: seedDate(-10, 14),
  },
  {
    id: "v5", code: "VIP30", name: "Bàn VIP sang trọng",
    description: "Giảm 30% đơn từ 1.000.000đ, tối đa 350.000đ - 20 lượt.",
    percent: 30, minOrder: 1000000, maxDiscount: 350000, startDate: seedDate(-15), endDate: seedEnd(45),
    usageLimit: 20, usedCount: 5, audience: "all", active: true, createdAt: seedDate(-15, 15),
  },
  {
    id: "v6", code: "DEMNAY35", name: "Đêm nay bùng nổ",
    description: "Giảm 35% đơn từ 1.500.000đ, tối đa 500.000đ - chỉ 10 lượt.",
    percent: 35, minOrder: 1500000, maxDiscount: 500000, startDate: seedDate(-5), endDate: seedEnd(30),
    usageLimit: 10, usedCount: 3, audience: "all", active: true, createdAt: seedDate(-5, 16),
  },
  {
    id: "v7", code: "HETHAN20", name: "Lễ hội mùa hè (đã kết thúc)",
    description: "Mã minh hoạ đã hết hạn - dùng để demo thông báo lỗi.",
    percent: 20, minOrder: 300000, maxDiscount: 150000, startDate: seedDate(-90), endDate: seedEnd(-10),
    usageLimit: 100, usedCount: 41, audience: "all", active: true, createdAt: seedDate(-90, 12),
  },
];

/* =========================================================
   KIỂM TRA DỮ LIỆU KHI THÊM / SỬA MÃ
   ========================================================= */

/** Trả câu lỗi đầu tiên tìm thấy, null nếu hợp lệ */
function voucherDataError(data, existing = [], exceptId = null) {
  const code = normalizeCode(data.code);
  if (!VOUCHER_CODE_PATTERN.test(code)) {
    return "Mã giảm giá phải gồm 4-16 ký tự, chỉ chữ IN HOA không dấu (A-Z) và số (0-9).";
  }
  if (existing.some((v) => String(v.id) !== String(exceptId) && normalizeCode(v.code) === code)) {
    return `Mã "${code}" đã tồn tại - vui lòng chọn mã khác.`;
  }
  if (!String(data.name || "").trim()) return "Vui lòng nhập tên chương trình giảm giá.";
  if (!DISCOUNT_TIERS.includes(Number(data.percent))) {
    return `Mức giảm chỉ được chọn một trong: ${DISCOUNT_TIERS.join(", ")}%.`;
  }
  if (!Object.hasOwn(VOUCHER_AUDIENCES, data.audience || "all")) return "Đối tượng áp dụng không hợp lệ.";
  for (const [field, label] of [["minOrder", "Đơn tối thiểu"], ["maxDiscount", "Giảm tối đa"], ["usageLimit", "Giới hạn lượt dùng"]]) {
    const n = Number(data[field] ?? 0);
    if (!Number.isFinite(n) || n < 0) return `${label} phải là số không âm.`;
  }
  if (!Number.isInteger(Number(data.usageLimit ?? 0))) return "Giới hạn lượt dùng phải là số nguyên.";
  if (data.startDate && !parseVoucherDate(data.startDate)) return "Ngày bắt đầu không hợp lệ.";
  if (data.endDate && !parseVoucherDate(data.endDate, true)) return "Ngày kết thúc không hợp lệ.";
  const start = parseVoucherDate(data.startDate);
  const end = parseVoucherDate(data.endDate, true);
  if (start && end && end.getTime() < start.getTime()) return "Ngày kết thúc phải sau hoặc trùng ngày bắt đầu.";
  return null;
}

/* =========================================================
   CRUD QUA API
   ========================================================= */

/** GET /vouchers -> Voucher[] (máy chủ chưa chạy thì dùng bản đệm / dữ liệu mẫu) */
export async function getAllVouchers() {
  const list = await getCollection(COLLECTION, SEED_VOUCHERS);
  return list.map((data) => Voucher.from(data));
}

/** Tìm mã theo code (không phân biệt hoa/thường, khoảng trắng) */
export async function getVoucherByCode(code) {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const all = await getAllVouchers();
  return all.find((v) => v.code === normalized) || null;
}

/**
 * POST /vouchers - thêm mã mới.
 * Chặn trùng code, % ngoài DISCOUNT_TIERS, ngày kết thúc trước ngày bắt đầu...
 */
export async function addVoucher(data = {}) {
  const all = await getAllVouchers();
  const problem = voucherDataError(data, all);
  if (problem) throw new Error(problem);

  const now = new Date().toISOString();
  const voucher = new Voucher({
    ...data,
    id: uid("vc"),
    usedCount: 0,
    startDate: data.startDate || now,
    createdAt: now,
  });
  const saved = await api.post(`/${COLLECTION}`, voucher.toJSON());
  return Voucher.from(saved);
}

/** PATCH /vouchers/:id - kiểm tra trên bản ghi SAU khi gộp thay đổi */
export async function updateVoucher(id, changes = {}) {
  const { id: _ignored, ...body } = changes;
  const all = await getAllVouchers();
  const current = all.find((v) => String(v.id) === String(id));
  if (!current) throw new Error("Mã giảm giá không còn tồn tại (có thể đã bị xoá).");

  if (body.code !== undefined) body.code = normalizeCode(body.code);
  if (body.percent !== undefined) body.percent = Number(body.percent);

  const merged = { ...current.toJSON(), ...body };
  const problem = voucherDataError(merged, all, id);
  if (problem) throw new Error(problem);

  const saved = await api.patch(`/${COLLECTION}/${encodeURIComponent(id)}`, body);
  return Voucher.from(saved);
}

/** DELETE /vouchers/:id - mã đã không còn (404) cũng coi như xoá xong */
export async function deleteVoucher(id) {
  try {
    await api.delete(`/${COLLECTION}/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err.status !== 404) throw err;
  }
  return true;
}

/** Mã công khai đang dùng được (không gồm mã cá nhân, mã sinh nhật) - % tăng dần */
export async function getPublicVouchers() {
  const all = await getAllVouchers();
  return all
    .filter((v) => v.isUsable && !v.isPersonal && v.audience !== "birthday")
    .sort((a, b) => a.percent - b.percent || a.minOrder - b.minOrder);
}

/**
 * Mã cá nhân của một thành viên.
 * Mặc định chỉ lấy mã CÒN dùng được; { includeUnusable: true } lấy cả mã
 * đã dùng / hết hạn (trang tài khoản hiển thị lịch sử).
 * Sắp xếp: mã sắp hết hạn đứng trước.
 */
export async function getCustomerVouchers(customerId, { includeUnusable = false } = {}) {
  if (!customerId) return [];
  const all = await getAllVouchers();
  const endOf = (v) => (v.endTime ? v.endTime.getTime() : Infinity);
  return all
    .filter((v) => v.customerId === String(customerId) && (includeUnusable || v.isUsable))
    .sort((a, b) => endOf(a) - endOf(b));
}

/* =========================================================
   KIỂM TRA MÃ KHI ĐẶT ĐƠN
   ========================================================= */

/** Mã chỉ được nhắc lại trong câu báo khi đúng định dạng (chống chèn HTML vào toast) */
const safeCode = (code) => (VOUCHER_CODE_PATTERN.test(code) ? `"${code}" ` : "");

/** SĐT / thành viên này đã từng có đơn KHÔNG bị huỷ chưa? */
async function hasPreviousOrder(phone, customerId) {
  const orders = await getCollection("orders", []);
  return orders.some((o) => o && o.status !== "cancelled"
    && ((phone && normalizePhone(o.phone) === phone) || (customerId && String(o.customerId || "") === customerId)));
}

/**
 * Kiểm tra một mã cho đơn có tạm tính `subtotal`.
 * @returns {Promise<{ valid: boolean, message: string, voucher?: Voucher, discount: number }>}
 *   message là câu tiếng Việt cụ thể cho từng lý do không hợp lệ.
 */
export async function validateVoucher(code, { subtotal = 0, phone = "", customerId = "", now = new Date() } = {}) {
  const normalized = normalizeCode(code);
  const fail = (message, voucher) => ({ valid: false, message, discount: 0, ...(voucher ? { voucher } : {}) });
  if (!normalized) return fail("Vui lòng nhập mã giảm giá.");

  const amount = Number(subtotal) || 0;
  const owner = customerId ? String(customerId) : "";
  const normalizedPhone = normalizePhone(phone);

  try {
    const voucher = await getVoucherByCode(normalized);
    if (!voucher) return fail(`Mã giảm giá ${safeCode(normalized)}không tồn tại. Vui lòng kiểm tra lại.`);

    // Mã cá nhân: kiểm tra chủ sở hữu TRƯỚC, không tiết lộ thông tin mã của người khác
    if (voucher.isPersonal && !owner) {
      return fail(`Mã ${voucher.code} là quà tặng cá nhân - vui lòng đăng nhập tài khoản thành viên để sử dụng.`, voucher);
    }
    if (voucher.isPersonal && voucher.customerId !== owner) {
      return fail(`Mã ${voucher.code} là quà tặng cá nhân của thành viên khác, bạn không thể sử dụng.`, voucher);
    }

    const status = voucher.statusAt(now);
    if (status === "inactive") return fail(`Mã ${voucher.code} đã ngừng áp dụng.`, voucher);
    if (status === "upcoming") {
      const start = formatDayMonth(voucher.startTime);
      return fail(`Mã ${voucher.code} chưa tới ngày áp dụng - bắt đầu từ ${start}.`, voucher);
    }
    if (status === "expired") {
      const end = formatDayMonth(voucher.endTime);
      return fail(`Mã ${voucher.code} đã hết hạn sử dụng (hết hạn ngày ${end}).`, voucher);
    }
    if (status === "usedup") return fail(`Mã ${voucher.code} đã hết lượt sử dụng.`, voucher);

    if (amount <= 0) return fail("Đơn hàng 0đ không thể áp dụng mã giảm giá - hãy thêm món vào giỏ trước.", voucher);
    if (amount < voucher.minOrder) {
      return fail(`Mã ${voucher.code} áp dụng cho đơn từ ${formatMoney(voucher.minOrder)} - đơn hiện tại `
        + `${formatMoney(amount)}, cần thêm ${formatMoney(voucher.minOrder - amount)}.`, voucher);
    }

    // Mã sinh nhật dùng chung (không gắn khách cụ thể): chỉ cho thành viên đang trong tuần sinh nhật
    if (voucher.audience === "birthday" && !voucher.isPersonal) {
      const customer = owner ? await getRecord("customers", owner) : null;
      if (!customer) return fail(`Mã ${voucher.code} là quà sinh nhật - vui lòng đăng nhập tài khoản thành viên.`, voucher);
      if (!findBirthdayInWindow(customer.birthday, now)) {
        return fail(`Mã ${voucher.code} chỉ dùng trong khoảng ${BIRTHDAY_WINDOW_DAYS} ngày trước/sau sinh nhật của bạn.`, voucher);
      }
    }

    if (voucher.audience === "new-customer") {
      if (!normalizedPhone) {
        return fail(`Mã ${voucher.code} dành cho khách hàng mới - vui lòng nhập số điện thoại để kiểm tra điều kiện.`, voucher);
      }
      if (await hasPreviousOrder(normalizedPhone, owner)) {
        return fail(`Mã ${voucher.code} chỉ dành cho đơn ĐẦU TIÊN - số điện thoại này đã từng đặt đơn tại quán.`, voucher);
      }
    }

    const discount = voucher.computeDiscount(amount);
    const cap = voucher.maxDiscount > 0 ? ` (tối đa ${formatMoney(voucher.maxDiscount)})` : "";
    return {
      valid: true,
      message: `Áp dụng mã ${voucher.code}: giảm ${voucher.percent}%${cap} - bạn tiết kiệm ${formatMoney(discount)}.`,
      voucher,
      discount,
    };
  } catch (err) {
    return fail(`Chưa kiểm tra được mã giảm giá: ${err.message}`);
  }
}

/* =========================================================
   GHI NHẬN LƯỢT DÙNG (gọi từ ordersService khi tạo / huỷ đơn)
   ========================================================= */

/** Tăng usedCount thêm 1. Mã đã bị xoá -> trả null, không ném lỗi (đơn đã lưu rồi) */
export async function redeemVoucher(voucherId) {
  if (!voucherId) return null;
  const current = await getRecord(COLLECTION, voucherId);
  if (!current) return null;
  const saved = await api.patch(`/${COLLECTION}/${encodeURIComponent(voucherId)}`, {
    usedCount: (Number(current.usedCount) || 0) + 1,
  });
  return Voucher.from(saved);
}

/** Trả lại 1 lượt (huỷ đơn). Không để âm; mã đã bị xoá -> bỏ qua, không ném lỗi */
export async function releaseVoucher(voucherId) {
  if (!voucherId) return null;
  try {
    const current = await getRecord(COLLECTION, voucherId);
    if (!current) return null;
    const saved = await api.patch(`/${COLLECTION}/${encodeURIComponent(voucherId)}`, {
      usedCount: Math.max(0, (Number(current.usedCount) || 0) - 1),
    });
    return Voucher.from(saved);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

/* =========================================================
   CHƯƠNG TRÌNH TỰ ĐỘNG: QUÀ CHÀO MỪNG & QUÀ SINH NHẬT
   ========================================================= */

/**
 * Tặng mã chào mừng cho thành viên vừa đăng ký: "CHAO" + 4 ký tự,
 * giảm WELCOME_DISCOUNT %, chỉ cho đơn đầu tiên, hạn 30 ngày, dùng 1 lần.
 * Gọi lại nhiều lần vẫn chỉ có 1 mã (trả về mã đã có).
 */
export async function issueWelcomeVoucher(customer) {
  if (!customer?.id) throw new Error("Thiếu thông tin thành viên để tặng mã chào mừng.");
  const customerId = String(customer.id);
  const all = await getAllVouchers();
  const existing = all.find((v) => v.customerId === customerId && v.audience === "new-customer");
  if (existing) return existing;

  const now = new Date();
  const voucher = new Voucher({
    id: uid("vc"),
    code: generateVoucherCode("CHAO", 4, all.map((v) => v.code)),
    name: "Quà chào mừng thành viên mới",
    description: `Giảm ${WELCOME_DISCOUNT}% cho đơn đầu tiên của ${customer.name || "thành viên mới"}.`,
    percent: WELCOME_DISCOUNT,
    minOrder: 0,
    maxDiscount: 0,
    startDate: now.toISOString(),
    endDate: endOfDay(addDays(now, WELCOME_VALID_DAYS)).toISOString(),
    usageLimit: 1,
    usedCount: 0,
    audience: "new-customer",
    customerId,
    active: true,
    createdAt: now.toISOString(),
  });
  const saved = await api.post(`/${COLLECTION}`, voucher.toJSON());
  return Voucher.from(saved);
}

/**
 * Đảm bảo thành viên có mã quà sinh nhật của năm nay.
 * - Hôm nay trong cửa sổ ± 7 ngày quanh sinh nhật (kể cả vắt qua năm) và
 *   chưa có mã của lần sinh nhật đó -> tạo "SN" + 2 số cuối năm + 4 ký tự,
 *   giảm BIRTHDAY_DISCOUNT %, dùng 1 lần, hạn tới sinh nhật + 7 ngày (23:59:59).
 * - Đã có mã của năm đó -> trả lại mã cũ (không tạo thêm).
 * - { force: true } (admin bấm "Phát mã"): cho phép phát trong cả THÁNG sinh
 *   nhật dù ngoài cửa sổ ± 7; hạn dùng ít nhất 7 ngày kể từ hôm nay.
 * @returns {Promise<Voucher|null>} null nếu chưa tới dịp / ngày sinh không hợp lệ
 */
export async function ensureBirthdayVoucher(customer, now = new Date(), { force = false } = {}) {
  if (!customer?.id || !parseBirthday(customer.birthday)) return null;
  const today = new Date(now);

  let occurrence = findBirthdayInWindow(customer.birthday, today, BIRTHDAY_WINDOW_DAYS);
  if (!occurrence && force && parseBirthday(customer.birthday).month === today.getMonth() + 1) {
    occurrence = birthdayInYear(customer.birthday, today.getFullYear());
  }
  if (!occurrence) return null;

  const year = occurrence.getFullYear();
  const customerId = String(customer.id);
  const all = await getAllVouchers();
  const existing = all.find((v) => v.audience === "birthday" && v.customerId === customerId && v.birthdayYear === year);
  if (existing) return existing;

  // Hạn dùng: hết ngày (sinh nhật + 7). Phát bù bằng tay muộn trong tháng thì vẫn còn ít nhất 7 ngày.
  const windowEnd = endOfDay(addDays(occurrence, BIRTHDAY_WINDOW_DAYS));
  const minimumEnd = endOfDay(addDays(today, BIRTHDAY_WINDOW_DAYS));
  const endDate = force && minimumEnd > windowEnd ? minimumEnd : windowEnd;
  const birthdayText = formatDayMonth(occurrence, false);

  const voucher = new Voucher({
    id: uid("vc"),
    code: generateVoucherCode(`SN${String(year).slice(-2)}`, 4, all.map((v) => v.code)),
    name: `Quà sinh nhật ${year}`,
    description: `Chúc mừng sinh nhật ${customer.name || "bạn"} (${birthdayText}) - giảm ${BIRTHDAY_DISCOUNT}% cho một đơn bất kỳ.`,
    percent: BIRTHDAY_DISCOUNT,
    minOrder: 0,
    maxDiscount: 0,
    startDate: today.toISOString(),
    endDate: endDate.toISOString(),
    usageLimit: 1,
    usedCount: 0,
    audience: "birthday",
    customerId,
    active: true,
    createdAt: today.toISOString(),
    birthdayYear: year,
  });
  const saved = await api.post(`/${COLLECTION}`, voucher.toJSON());
  return Voucher.from(saved);
}

/* =========================================================
   CHƯƠNG TRÌNH TỰ ĐỘNG: QUÀ NGÀY LỄ
   ========================================================= */

/** Tìm dịp lễ theo key ("christmas" | "reunification" | "national-day") */
export function getHoliday(key) {
  return HOLIDAYS.find((h) => h.key === key) || null;
}

/** Khoảng áp dụng của một dịp lễ trong năm `year`: { start: 00:00 ngày đầu, end: 23:59:59 ngày cuối } */
export function holidayWindow(holiday, year) {
  const start = new Date(year, holiday.start.month - 1, holiday.start.day, 0, 0, 0, 0);
  const end = endOfDay(new Date(year, holiday.end.month - 1, holiday.end.day));
  return { start, end };
}

/** Dịp lễ đang diễn ra tại thời điểm `now` (kèm năm) - không có thì null */
export function getActiveHoliday(now = new Date()) {
  const today = new Date(now);
  const year = today.getFullYear();
  for (const holiday of HOLIDAYS) {
    const { start, end } = holidayWindow(holiday, year);
    if (today >= start && today <= end) return { holiday, year, start, end };
  }
  return null;
}

/**
 * Lần gần nhất của một dịp lễ tính từ `now`: đang diễn ra thì lấy năm nay,
 * đã qua thì lấy năm sau. Dùng khi admin chủ động gửi mã trước dịp lễ.
 */
export function nextHolidayOccurrence(holiday, now = new Date()) {
  const today = new Date(now);
  let year = today.getFullYear();
  if (today > holidayWindow(holiday, year).end) year += 1;
  return { holiday, year, ...holidayWindow(holiday, year) };
}

/**
 * Đảm bảo thành viên có mã quà ngày lễ.
 * - Mặc định: chỉ phát khi hôm nay nằm trong dịp lễ (khách đăng nhập trong dịp lễ).
 * - { holidayKey } (admin gửi hàng loạt): phát cho lần gần nhất của dịp đó, kể cả
 *   gửi trước dịp lễ - mã chỉ dùng được trong khoảng ngày lễ.
 * - Mỗi khách mỗi dịp mỗi năm chỉ 1 mã: đã có thì trả lại mã cũ.
 * @returns {Promise<Voucher|null>} null nếu không có dịp lễ nào đang diễn ra
 */
export async function ensureHolidayVoucher(customer, now = new Date(), { holidayKey = "" } = {}) {
  if (!customer?.id) return null;
  let occasion;
  if (holidayKey) {
    const holiday = getHoliday(holidayKey);
    if (!holiday) throw new Error(`Không có dịp lễ "${holidayKey}".`);
    occasion = nextHolidayOccurrence(holiday, now);
  } else {
    occasion = getActiveHoliday(now);
  }
  if (!occasion) return null;

  const { holiday, year, start, end } = occasion;
  const customerId = String(customer.id);
  const all = await getAllVouchers();
  const existing = all.find((v) => v.audience === "holiday" && v.customerId === customerId
    && v.holidayKey === holiday.key && v.holidayYear === year);
  if (existing) return existing;

  const issuedAt = new Date(now);
  const voucher = new Voucher({
    id: uid("vc"),
    code: generateVoucherCode(`${holiday.prefix}${String(year).slice(-2)}`, 4, all.map((v) => v.code)),
    name: `Quà ${holiday.name} ${year}`,
    description: `${holiday.greeting}! Giảm ${holiday.percent}% cho một đơn bất kỳ của ${customer.name || "bạn"}, `
      + `dùng từ ${formatDayMonth(start)} đến hết ${formatDayMonth(end)}.`,
    percent: holiday.percent,
    minOrder: 0,
    maxDiscount: 0,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    usageLimit: 1,
    usedCount: 0,
    audience: "holiday",
    customerId,
    active: true,
    createdAt: issuedAt.toISOString(),
    holidayKey: holiday.key,
    holidayYear: year,
  });
  const saved = await api.post(`/${COLLECTION}`, voucher.toJSON());
  return Voucher.from(saved);
}

/* =========================================================
   LỌC DANH SÁCH (hàm đồng bộ - dùng cho trang quản trị)
   ========================================================= */

/**
 * Lọc mã theo từ khoá (mã, tên, mô tả), đối tượng, trạng thái, mức %.
 * `customerNames` (Map id -> tên) cho phép tìm mã cá nhân theo tên khách.
 * Kết quả: mã tạo mới nhất đứng trước.
 */
export function filterVouchers(vouchers, {
  keyword = "", audience = "all", status = "all", percent = "all", customerNames = new Map(),
} = {}) {
  let list = [...vouchers];

  const kw = String(keyword).trim().toLowerCase();
  if (kw) {
    list = list.filter((v) => v.code.toLowerCase().includes(kw)
      || v.name.toLowerCase().includes(kw)
      || v.description.toLowerCase().includes(kw)
      || String(customerNames.get(v.customerId) || "").toLowerCase().includes(kw));
  }
  if (audience !== "all") list = list.filter((v) => v.audience === audience);
  if (status !== "all") list = list.filter((v) => v.status === status);
  if (percent !== "all") list = list.filter((v) => v.percent === Number(percent));

  const created = (v) => new Date(v.createdAt).getTime() || 0;
  return list.sort((a, b) => created(b) - created(a));
}

/** Khoảng thời gian còn lại dạng chữ: "Còn 5 ngày", "Hết hạn hôm nay", "Không thời hạn" */
export function describeTimeLeft(voucher, now = new Date()) {
  const end = voucher.endTime;
  if (!end) return "Không thời hạn";
  const msLeft = end.getTime() - new Date(now).getTime();
  if (msLeft < 0) return "Đã hết hạn";
  const days = Math.floor(msLeft / DAY_MS);
  return days === 0 ? "Hết hạn hôm nay" : `Còn ${days} ngày`;
}

/* =========================================================
   CUSTOMERS-SERVICE.JS - Khách hàng thành viên (CRUD + đăng ký,
   đăng nhập, tính sinh nhật)
   Dữ liệu lưu trên máy chủ json-server tại /customers.

   Nghiệp vụ chính:
   - Quán bar chỉ nhận thành viên từ 18 tuổi trở lên.
   - Mật khẩu KHÔNG BAO GIỜ lưu dạng chữ thường: chỉ lưu chuỗi băm
     SHA-256 (hex). Đăng nhập = băm mật khẩu vừa nhập rồi so sánh.
   - "Cửa sổ sinh nhật" = từ 7 ngày TRƯỚC đến 7 ngày SAU ngày sinh
     nhật. Logic này dùng chung với vouchersService.js (mã quà sinh
     nhật) nên đặt ở đây và export ra - một nguồn sự thật duy nhất.
   - Mọi phép so sánh ngày đều quy về "số thứ tự ngày" theo lịch địa
     phương (bỏ giờ phút) để không bị lệch vì múi giờ.
   ========================================================= */

import { api, getCollection, getRecord } from "./api.js";
import { uid } from "./utils.js";

const COLLECTION = "customers";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Tuổi tối thiểu để đăng ký thành viên (quán có phục vụ đồ uống có cồn) */
export const MIN_CUSTOMER_AGE = 18;
/** Đăng ký trong vòng 30 ngày gần nhất = "thành viên mới" */
export const NEW_MEMBER_DAYS = 30;
/** Cửa sổ sinh nhật: ± 7 ngày quanh ngày sinh nhật */
export const BIRTHDAY_WINDOW_DAYS = 7;
/** Độ dài tối thiểu của mật khẩu thành viên */
export const MIN_PASSWORD_LENGTH = 6;

/* =========================================================
   TIỆN ÍCH NGÀY THÁNG (hàm thuần - test được trong Node)
   ========================================================= */

/** Nhận Date | số mili-giây | chuỗi ngày -> Date hợp lệ (sai thì lấy thời điểm hiện tại) */
function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? new Date() : value;
  if (value === undefined || value === null || value === "") return new Date();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Số thứ tự ngày theo lịch địa phương (bỏ phần giờ).
 * Dùng Date.UTC trên các thành phần ngày địa phương nên hiệu hai ngày
 * luôn là số nguyên, kể cả ở nơi có giờ mùa hè.
 */
function dayNumber(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

/** Năm nhuận theo lịch Gregory */
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Tách chuỗi ngày sinh "YYYY-MM-DD" -> { year, month (1-12), day }.
 * Trả null nếu sai định dạng hoặc ngày không tồn tại (VD 2001-02-30).
 */
export function parseBirthday(birthday) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthday ?? "").trim());
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const probe = new Date(year, month - 1, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) return null;
  return { year, month, day };
}

/** Date -> "YYYY-MM-DD" theo lịch địa phương */
export function toDateKey(date) {
  const d = toDate(date);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Ngày sinh nhật (00:00 giờ địa phương) rơi vào năm `year`.
 * Người sinh 29/02: năm không nhuận được tính sinh nhật vào 28/02.
 * @returns {Date|null} null nếu ngày sinh không hợp lệ
 */
export function birthdayInYear(birthday, year) {
  const parts = parseBirthday(birthday);
  if (!parts || !Number.isInteger(Number(year))) return null;
  const y = Number(year);
  const day = parts.month === 2 && parts.day === 29 && !isLeapYear(y) ? 28 : parts.day;
  return new Date(y, parts.month - 1, day);
}

/**
 * Tìm lần sinh nhật mà `now` đang nằm trong cửa sổ ± `days` ngày.
 * Xét cả năm trước, năm nay và năm sau để xử lý cửa sổ VẮT QUA NĂM:
 *   sinh 03/01, hôm nay 29/12/2026 -> sinh nhật 03/01/2027 còn 5 ngày -> trong cửa sổ.
 *   sinh 28/12, hôm nay 02/01/2027 -> sinh nhật 28/12/2026 đã qua 5 ngày -> trong cửa sổ.
 * @returns {Date|null} ngày sinh nhật (00:00) của lần đó, hoặc null nếu ngoài cửa sổ
 */
export function findBirthdayInWindow(birthday, now = new Date(), days = BIRTHDAY_WINDOW_DAYS) {
  const current = toDate(now);
  const today = dayNumber(current);
  let best = null;
  let bestGap = Infinity;

  [current.getFullYear() - 1, current.getFullYear(), current.getFullYear() + 1].forEach((year) => {
    const occurrence = birthdayInYear(birthday, year);
    if (!occurrence) return;
    const gap = Math.abs(dayNumber(occurrence) - today);
    if (gap <= days && gap < bestGap) {
      best = occurrence;
      bestGap = gap;
    }
  });
  return best;
}

/** Hôm nay có nằm trong cửa sổ sinh nhật (± days ngày) hay không */
export function isInBirthdayWindow(birthday, now = new Date(), days = BIRTHDAY_WINDOW_DAYS) {
  return findBirthdayInWindow(birthday, now, days) !== null;
}

/** Lần sinh nhật kế tiếp tính từ hôm nay (hôm nay là sinh nhật -> trả về hôm nay) */
export function getNextBirthday(birthday, now = new Date()) {
  const current = toDate(now);
  const thisYear = birthdayInYear(birthday, current.getFullYear());
  if (!thisYear) return null;
  if (dayNumber(thisYear) >= dayNumber(current)) return thisYear;
  return birthdayInYear(birthday, current.getFullYear() + 1);
}

/** Còn bao nhiêu ngày tới sinh nhật (0 = hôm nay); null nếu ngày sinh sai */
export function getDaysUntilBirthday(birthday, now = new Date()) {
  const next = getNextBirthday(birthday, now);
  return next ? dayNumber(next) - dayNumber(toDate(now)) : null;
}

/** Tuổi tròn tính đến `now`; null nếu ngày sinh sai */
export function calcAge(birthday, now = new Date()) {
  const parts = parseBirthday(birthday);
  if (!parts) return null;
  const current = toDate(now);
  const birthdayThisYear = birthdayInYear(birthday, current.getFullYear());
  const hadBirthday = dayNumber(current) >= dayNumber(birthdayThisYear);
  return current.getFullYear() - parts.year - (hadBirthday ? 0 : 1);
}

/* =========================================================
   SỐ ĐIỆN THOẠI & MẬT KHẨU
   ========================================================= */

/**
 * Chuẩn hoá số điện thoại để so sánh: bỏ dấu cách, dấu chấm, gạch ngang,
 * ngoặc; đầu "+84" đổi về "0". VD "+84 912.345.678" -> "0912345678".
 */
export function normalizePhone(phone) {
  const compact = String(phone ?? "").trim().replace(/[\s.\-()]/g, "");
  return compact.startsWith("+84") ? `0${compact.slice(3)}` : compact;
}

/** Số di động Việt Nam hợp lệ sau khi chuẩn hoá: 10 số, đầu 03/05/07/08/09 */
export function isValidPhone(phone) {
  return /^0(3|5|7|8|9)\d{8}$/.test(normalizePhone(phone));
}

/* ---- SHA-256 thuần JavaScript (dự phòng) ----
   crypto.subtle chỉ có trong "ngữ cảnh an toàn" (https, localhost).
   Mở web qua địa chỉ IP mạng LAN (VD xem thử trên điện thoại:
   http://192.168.1.5:3000) thì trình duyệt KHÔNG cấp crypto.subtle ->
   dùng bản cài đặt thuần dưới đây, cho kết quả giống hệt. */
const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const rotr = (x, n) => (x >>> n) | (x << (32 - n));

function sha256Fallback(bytes) {
  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  // Đệm dữ liệu: thêm bit 1, các bit 0, rồi 64 bit độ dài -> bội số của 64 byte
  const totalLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(totalLength);
  data.set(bytes);
  data[bytes.length] = 0x80;
  const view = new DataView(data.buffer);
  const bitLength = bytes.length * 8;
  view.setUint32(totalLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(totalLength - 4, bitLength >>> 0);

  const w = new Uint32Array(64);
  for (let offset = 0; offset < totalLength; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + SHA256_K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach((value, i) => { hash[i] = (hash[i] + value) >>> 0; });
  }
  return hash.map((x) => x.toString(16).padStart(8, "0")).join("");
}

/**
 * Băm mật khẩu bằng SHA-256, trả về chuỗi hex 64 ký tự.
 * Ưu tiên Web Crypto (globalThis.crypto.subtle - có cả trên trình duyệt
 * lẫn Node 22), không có thì dùng bản thuần JavaScript ở trên.
 */
export async function hashPassword(plain) {
  const bytes = new TextEncoder().encode(String(plain ?? ""));
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return sha256Fallback(bytes);
}

/* =========================================================
   LỚP KHÁCH HÀNG THÀNH VIÊN (class, getter, trường private)
   ========================================================= */

export class Customer {
  // Chuỗi băm mật khẩu để private: {...customer} hay hiển thị nhầm cũng không lộ ra
  #passwordHash;

  constructor({
    id,
    name = "",
    phone = "",
    email = "",
    birthday = "",
    passwordHash = "",
    createdAt = "",
  } = {}) {
    this.id = id;
    this.name = String(name).trim();
    this.phone = normalizePhone(phone);
    this.email = String(email || "").trim();
    this.birthday = String(birthday || "").trim();
    this.#passwordHash = String(passwordHash || "");
    this.createdAt = createdAt || new Date().toISOString();
  }

  get passwordHash() {
    return this.#passwordHash;
  }

  /** Tuổi hiện tại (null nếu ngày sinh lỗi) */
  get age() {
    return calcAge(this.birthday);
  }

  /** Đăng ký trong vòng NEW_MEMBER_DAYS ngày gần nhất */
  get isNewMember() {
    const created = new Date(this.createdAt);
    if (Number.isNaN(created.getTime())) return false;
    return dayNumber(new Date()) - dayNumber(created) <= NEW_MEMBER_DAYS;
  }

  /** Ngày sinh nhật kế tiếp (Date 00:00) - hôm nay là sinh nhật thì trả về hôm nay */
  get nextBirthday() {
    return getNextBirthday(this.birthday);
  }

  /** Số ngày còn lại tới sinh nhật, 0 = hôm nay */
  get daysUntilBirthday() {
    return getDaysUntilBirthday(this.birthday);
  }

  get isBirthdayToday() {
    return this.daysUntilBirthday === 0;
  }

  /** Đang ở trong tháng sinh nhật (29/02 năm không nhuận vẫn là tháng 2) */
  get isBirthdayMonth() {
    const parts = parseBirthday(this.birthday);
    return Boolean(parts) && parts.month === new Date().getMonth() + 1;
  }

  /** Đang trong khoảng ± 7 ngày quanh sinh nhật (cùng logic với mã quà sinh nhật) */
  get isInBirthdayWindow() {
    return isInBirthdayWindow(this.birthday);
  }

  /** Dữ liệu đầy đủ để lưu lên API (CÓ chuỗi băm mật khẩu) */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      phone: this.phone,
      email: this.email,
      birthday: this.birthday,
      passwordHash: this.#passwordHash,
      createdAt: this.createdAt,
    };
  }

  /** Dữ liệu công khai - dùng cho phiên đăng nhập, giao diện (KHÔNG có passwordHash) */
  toPublic() {
    const { passwordHash: _hidden, ...rest } = this.toJSON();
    return rest;
  }

  static from(data) {
    return data instanceof Customer ? data : new Customer(data);
  }
}

/* =========================================================
   DỮ LIỆU MẪU - ngày tính tương đối từ lúc nạp module
   (chạy "npm run seed" hôm nào thì c1 có sinh nhật đúng hôm đó)
   ========================================================= */

/** SHA-256("123456") - mật khẩu demo của các tài khoản mẫu */
const DEMO_PASSWORD_HASH = "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92";

/** Ngày sinh có cùng ngày/tháng với (hôm nay + offsetDays) nhưng ở năm `year` */
function seedBirthday(offsetDays, year) {
  const target = new Date();
  target.setDate(target.getDate() + offsetDays);
  // 29/02 chỉ tồn tại ở năm nhuận -> lùi về năm nhuận gần nhất
  let y = year;
  if (target.getMonth() === 1 && target.getDate() === 29) {
    while (!isLeapYear(y)) y -= 1;
  }
  return `${y}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
}

function seedDaysAgo(days, hour = 19) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 15, 0, 0);
  return d.toISOString();
}

export const SEED_CUSTOMERS = [
  {
    id: "c1",
    name: "Nguyễn Hoàng Anh",
    phone: "0981234567",
    email: "hoanganh.nguyen@gmail.com",
    birthday: seedBirthday(0, 1998),      // sinh nhật HÔM NAY -> demo nhận mã quà sinh nhật
    passwordHash: DEMO_PASSWORD_HASH,
    createdAt: seedDaysAgo(65, 20),
  },
  {
    id: "c2",
    name: "Trần Bảo Ngọc",
    phone: "0382345678",
    email: "baongoc.tran@gmail.com",
    birthday: seedBirthday(5, 2000),      // còn 5 ngày tới sinh nhật (đã trong cửa sổ ± 7 ngày)
    passwordHash: DEMO_PASSWORD_HASH,
    createdAt: seedDaysAgo(9, 21),        // thành viên mới (≤ 30 ngày)
  },
  {
    id: "c3",
    name: "Lê Quang Minh",
    phone: "0773456789",
    email: "",
    birthday: seedBirthday(150, 1992),    // sinh nhật còn xa
    passwordHash: DEMO_PASSWORD_HASH,
    createdAt: seedDaysAgo(120, 22),
  },
];

/* =========================================================
   KIỂM TRA DỮ LIỆU ĐĂNG KÝ / CẬP NHẬT
   ========================================================= */

/** Trả về câu lỗi tiếng Việt nếu ngày sinh không đạt, null nếu hợp lệ */
function birthdayError(birthday, now = new Date()) {
  const parts = parseBirthday(birthday);
  if (!parts) return "Ngày sinh không hợp lệ - vui lòng chọn đúng ngày/tháng/năm.";
  const born = new Date(parts.year, parts.month - 1, parts.day);
  if (dayNumber(born) > dayNumber(now)) return "Ngày sinh không được ở tương lai.";
  const age = calcAge(birthday, now);
  if (age > 120) return "Ngày sinh không hợp lệ - vui lòng kiểm tra lại năm sinh.";
  if (age < MIN_CUSTOMER_AGE) {
    return `Quán bar chỉ phục vụ khách từ ${MIN_CUSTOMER_AGE} tuổi trở lên - bạn chưa đủ tuổi đăng ký thành viên.`;
  }
  return null;
}

function nameError(name) {
  const value = String(name ?? "").trim();
  return value.length >= 2 && value.length <= 60 ? null : "Họ tên phải từ 2 đến 60 ký tự.";
}

function emailError(email) {
  const value = String(email ?? "").trim();
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : "Email không đúng định dạng.";
}

function passwordError(password) {
  return String(password ?? "").length >= MIN_PASSWORD_LENGTH
    ? null
    : `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`;
}

/* =========================================================
   CRUD QUA API
   ========================================================= */

/** GET /customers - dữ liệu thô được chuyển thành đối tượng Customer */
export async function getAllCustomers() {
  const list = await getCollection(COLLECTION, SEED_CUSTOMERS);
  return list.map((data) => Customer.from(data));
}

/** GET /customers/:id - null nếu không tồn tại */
export async function getCustomerById(id) {
  if (!id) return null;
  const data = await getRecord(COLLECTION, id, SEED_CUSTOMERS);
  return data ? Customer.from(data) : null;
}

/** Tìm thành viên theo số điện thoại (so sánh sau khi chuẩn hoá) */
export async function findCustomerByPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const all = await getAllCustomers();
  return all.find((c) => normalizePhone(c.phone) === normalized) || null;
}

/**
 * Đăng ký thành viên mới.
 * @returns {Promise<Customer>} bản ghi máy chủ đã lưu
 * @throws {Error} câu báo lỗi tiếng Việt khi dữ liệu không đạt
 */
export async function registerCustomer({ name, phone, email = "", birthday, password } = {}) {
  const problem = nameError(name)
    || (isValidPhone(phone) ? null : "Số điện thoại không hợp lệ (10 số, đầu 03, 05, 07, 08, 09).")
    || emailError(email)
    || birthdayError(birthday)
    || passwordError(password);
  if (problem) throw new Error(problem);

  if (await findCustomerByPhone(phone)) {
    throw new Error("Số điện thoại này đã được đăng ký thành viên - vui lòng đăng nhập.");
  }

  const customer = new Customer({
    id: uid("cus"),
    name,
    phone,
    email,
    birthday: String(birthday).trim(),
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  });
  const saved = await api.post(`/${COLLECTION}`, customer.toJSON());
  return Customer.from(saved);
}

/**
 * PATCH /customers/:id - cập nhật thông tin.
 * Có `password` -> tự băm thành passwordHash (không bao giờ gửi mật khẩu thường).
 */
export async function updateCustomer(id, changes = {}) {
  const { id: _ignored, password, passwordHash: _hash, ...rest } = changes;
  const body = { ...rest };

  if (body.name !== undefined) {
    const problem = nameError(body.name);
    if (problem) throw new Error(problem);
    body.name = String(body.name).trim();
  }
  if (body.email !== undefined) {
    const problem = emailError(body.email);
    if (problem) throw new Error(problem);
    body.email = String(body.email).trim();
  }
  if (body.birthday !== undefined) {
    const problem = birthdayError(body.birthday);
    if (problem) throw new Error(problem);
    body.birthday = String(body.birthday).trim();
  }
  if (body.phone !== undefined) {
    if (!isValidPhone(body.phone)) throw new Error("Số điện thoại không hợp lệ (10 số, đầu 03, 05, 07, 08, 09).");
    const owner = await findCustomerByPhone(body.phone);
    if (owner && String(owner.id) !== String(id)) {
      throw new Error("Số điện thoại này đã thuộc về một thành viên khác.");
    }
    body.phone = normalizePhone(body.phone);
  }
  if (password !== undefined) {
    const problem = passwordError(password);
    if (problem) throw new Error(problem);
    body.passwordHash = await hashPassword(password);
  }

  const saved = await api.patch(`/${COLLECTION}/${encodeURIComponent(id)}`, body);
  return Customer.from(saved);
}

/** DELETE /customers/:id - khách đã không còn (404) cũng coi như xoá xong */
export async function deleteCustomer(id) {
  try {
    await api.delete(`/${COLLECTION}/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err.status !== 404) throw err;
  }
  return true;
}

/**
 * Đăng nhập: tìm theo SĐT rồi so chuỗi băm mật khẩu.
 * @returns {Promise<Customer|null>} null nếu sai SĐT hoặc mật khẩu
 */
export async function authenticateCustomer(phone, password) {
  if (!phone || !password) return null;
  const customer = await findCustomerByPhone(phone);
  if (!customer) return null;
  const hash = await hashPassword(password);
  return hash === customer.passwordHash ? customer : null;
}

/* =========================================================
   LỌC DANH SÁCH (hàm đồng bộ - dùng cho trang quản trị)
   ========================================================= */

export const CUSTOMER_FILTERS = {
  all: "Tất cả thành viên",
  "birthday-month": "Sinh nhật tháng này",
  "birthday-soon": `Sắp sinh nhật (≤ ${BIRTHDAY_WINDOW_DAYS} ngày)`,
  new: "Thành viên mới",
};

/**
 * Lọc khách hàng theo nhóm + từ khoá (tên, SĐT, email).
 * Kết quả sắp: ai sắp tới sinh nhật hơn đứng trước.
 */
export function filterCustomers(customers, { keyword = "", group = "all" } = {}) {
  let list = [...customers];

  const kw = String(keyword).trim().toLowerCase();
  if (kw) {
    const kwPhone = normalizePhone(kw);
    list = list.filter((c) => c.name.toLowerCase().includes(kw)
      || (kwPhone && normalizePhone(c.phone).includes(kwPhone))
      || c.email.toLowerCase().includes(kw));
  }

  if (group === "birthday-month") list = list.filter((c) => c.isBirthdayMonth);
  if (group === "birthday-soon") {
    list = list.filter((c) => c.daysUntilBirthday !== null && c.daysUntilBirthday <= BIRTHDAY_WINDOW_DAYS);
  }
  if (group === "new") list = list.filter((c) => c.isNewMember);

  const days = (c) => (c.daysUntilBirthday === null ? Infinity : c.daysUntilBirthday);
  return list.sort((a, b) => days(a) - days(b) || a.name.localeCompare(b.name, "vi"));
}

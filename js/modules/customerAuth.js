/* =========================================================
   CUSTOMER-AUTH.JS - Phiên đăng nhập của KHÁCH HÀNG THÀNH VIÊN
   (khác hẳn auth.js của nhân viên quản trị)

   - Phiên lưu ở localStorage, khoá "customer_session" (qua storage.js)
     để khách đóng trình duyệt mở lại vẫn còn đăng nhập; tự hết hạn
     sau SESSION_DAYS ngày.
   - Phiên chỉ chứa thông tin CÔNG KHAI (toPublic) - tuyệt đối không
     lưu chuỗi băm mật khẩu xuống trình duyệt.
   - Sau mỗi lần đăng nhập / đăng ký / đăng xuất, phát sự kiện window
     "customerchange" để navbar và các trang vẽ lại (đổi nút "Thành
     viên", tự điền form đặt món...).
   - Đăng nhập xong tự kiểm tra quà sinh nhật + quà ngày lễ; đăng ký xong
     tặng mã chào mừng khách mới. Mã MỚI được gửi về email của khách
     (emailService.js). Lỗi phát quà / gửi mail KHÔNG làm hỏng việc đăng nhập.
   ========================================================= */

import { getItem, setItem, removeItem } from "./storage.js";
import { authenticateCustomer, registerCustomer, getCustomerById, Customer } from "./customersService.js";
import { issueWelcomeVoucher, ensureBirthdayVoucher, ensureHolidayVoucher } from "./vouchersService.js";
import { sendVoucherEmail } from "./emailService.js";

const SESSION_KEY = "customer_session";
const SESSION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Phát sự kiện cho giao diện; chạy trong Node (không có window) thì bỏ qua */
function emitChange(customer) {
  if (typeof globalThis.dispatchEvent === "function" && typeof CustomEvent === "function") {
    globalThis.dispatchEvent(new CustomEvent("customerchange", { detail: { customer } }));
  }
}

/** Ghi phiên mới từ một Customer (chỉ phần công khai) */
function saveSession(customer) {
  const profile = Customer.from(customer).toPublic();
  const now = Date.now();
  setItem(SESSION_KEY, {
    customer: profile,
    loggedInAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_DAYS * DAY_MS).toISOString(),
  });
  return profile;
}

/**
 * Khách đang đăng nhập trên trình duyệt này.
 * @returns {object|null} { id, name, phone, email, birthday, createdAt } - không có passwordHash
 */
export function getCurrentCustomer() {
  const session = getItem(SESSION_KEY, null);
  const profile = session?.customer;
  if (!profile || !profile.id) return null;

  if (session.expiresAt && Date.now() > new Date(session.expiresAt).getTime()) {
    removeItem(SESSION_KEY); // hết hạn -> coi như đã đăng xuất
    return null;
  }
  const { passwordHash: _hidden, ...publicProfile } = profile;
  return publicProfile;
}

/** Tiện ích cho trang: đã đăng nhập chưa */
export function isCustomerLoggedIn() {
  return getCurrentCustomer() !== null;
}

/**
 * Tải lại hồ sơ khách từ máy chủ (VD sau khi khách sửa thông tin, hoặc
 * admin đã xoá tài khoản). Tài khoản không còn -> tự đăng xuất.
 * @returns {Promise<object|null>} hồ sơ công khai mới nhất
 */
export async function refreshCurrentCustomer() {
  const current = getCurrentCustomer();
  if (!current) return null;
  const fresh = await getCustomerById(current.id);
  if (!fresh) {
    logoutCustomer();
    return null;
  }
  const profile = saveSession(fresh);
  emitChange(profile);
  return profile;
}

/** Gửi mã về email; lỗi chỉ ghi cảnh báo (mã vẫn nằm trong ví của khách) */
async function emailVoucher(customer, voucher, kind) {
  if (!voucher) return null;
  try {
    return (await sendVoucherEmail(customer, voucher, kind)).status;
  } catch (err) {
    console.warn(`[customerAuth] Chưa gửi được email mã ${voucher.code}:`, err.message);
    return null;
  }
}

/**
 * Phát quà theo dịp cho thành viên (gọi khi đăng nhập / mở trang Tài khoản):
 * mã sinh nhật (± 7 ngày quanh sinh nhật) và mã ngày lễ (đang trong dịp lễ).
 * Mã nào MỚI thì gửi email - gọi lại nhiều lần không phát trùng, không gửi trùng.
 * @returns {Promise<{ birthdayVoucher: object|null, holidayVoucher: object|null }>}
 */
export async function claimOccasionGifts(customer, now = new Date()) {
  let birthdayVoucher = null;
  let holidayVoucher = null;
  try {
    birthdayVoucher = await ensureBirthdayVoucher(customer, now);
  } catch (err) {
    console.warn("[customerAuth] Chưa phát được mã sinh nhật:", err.message);
  }
  try {
    holidayVoucher = await ensureHolidayVoucher(customer, now);
  } catch (err) {
    console.warn("[customerAuth] Chưa phát được mã ngày lễ:", err.message);
  }
  await emailVoucher(customer, birthdayVoucher, "birthday");
  await emailVoucher(customer, holidayVoucher, "holiday");
  return { birthdayVoucher, holidayVoucher };
}

/**
 * Đăng nhập bằng số điện thoại + mật khẩu.
 * @returns {Promise<{ success: boolean, message: string, customer?: object, birthdayVoucher?: object|null, holidayVoucher?: object|null }>}
 */
export async function loginCustomer(phone, password) {
  if (!String(phone ?? "").trim() || !password) {
    return { success: false, message: "Vui lòng nhập số điện thoại và mật khẩu." };
  }

  let customer;
  try {
    customer = await authenticateCustomer(phone, password);
  } catch (err) {
    return { success: false, message: err.message };
  }
  if (!customer) {
    return { success: false, message: "Số điện thoại hoặc mật khẩu không đúng." };
  }

  const profile = saveSession(customer);

  // Đang trong dịp sinh nhật / ngày lễ -> phát (hoặc lấy lại) mã quà + gửi email
  const { birthdayVoucher, holidayVoucher } = await claimOccasionGifts(customer);

  emitChange(profile);
  const gifts = [
    birthdayVoucher && `Chúc mừng sinh nhật! Quán tặng bạn mã ${birthdayVoucher.code} giảm ${birthdayVoucher.percent}%.`,
    holidayVoucher && `Quà ${holidayVoucher.name}: mã ${holidayVoucher.code} giảm ${holidayVoucher.percent}%.`,
  ].filter(Boolean);
  const message = gifts.length
    ? `${gifts.join(" ")} Mã đã được gửi về email của bạn.`
    : `Chào mừng ${customer.name} quay lại Quán Bar Đêm!`;
  return { success: true, message, customer: profile, birthdayVoucher, holidayVoucher };
}

/**
 * Đăng ký thành viên rồi đăng nhập luôn, tặng mã chào mừng (+ mã sinh nhật nếu đúng dịp).
 * @param {{ name, phone, email, birthday, password }} data
 * @returns {Promise<{ success: boolean, message: string, customer?: object, welcomeVoucher?: object|null, birthdayVoucher?: object|null, holidayVoucher?: object|null }>}
 */
export async function registerAndLogin(data = {}) {
  let customer;
  try {
    customer = await registerCustomer(data);
  } catch (err) {
    return { success: false, message: err.message };
  }

  const profile = saveSession(customer);

  let welcomeVoucher = null;
  try {
    welcomeVoucher = await issueWelcomeVoucher(customer);
  } catch (err) {
    console.warn("[customerAuth] Chưa tặng được mã chào mừng:", err.message);
  }
  await emailVoucher(customer, welcomeVoucher, "welcome");
  const { birthdayVoucher, holidayVoucher } = await claimOccasionGifts(customer);

  emitChange(profile);
  const gifts = [
    welcomeVoucher && `mã ${welcomeVoucher.code} giảm ${welcomeVoucher.percent}% cho đơn đầu tiên`,
    birthdayVoucher && `mã sinh nhật ${birthdayVoucher.code} giảm ${birthdayVoucher.percent}%`,
    holidayVoucher && `mã ${holidayVoucher.name} ${holidayVoucher.code} giảm ${holidayVoucher.percent}%`,
  ].filter(Boolean);
  const message = gifts.length
    ? `Đăng ký thành công! Quà tặng của bạn: ${gifts.join(", ")} - đã gửi về email ${customer.email}.`
    : "Đăng ký thành viên thành công!";
  return { success: true, message, customer: profile, welcomeVoucher, birthdayVoucher, holidayVoucher };
}

/** Đăng xuất khách hàng */
export function logoutCustomer() {
  removeItem(SESSION_KEY);
  emitChange(null);
}

// Đăng nhập / đăng xuất ở tab khác -> tab này cũng cập nhật theo
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("storage", (e) => {
    if (e.key && e.key.endsWith(SESSION_KEY)) emitChange(getCurrentCustomer());
  });
}

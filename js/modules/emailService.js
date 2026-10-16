/* =========================================================
   EMAIL-SERVICE.JS - Gửi mã giảm giá về email của khách
   Mỗi mã cá nhân mới (chào mừng thành viên, sinh nhật, ngày lễ) được:
     1. LƯU vào bảng /emails (json-server) -> hiện trong "Hộp thư ưu đãi"
        ở trang Tài khoản, demo được cả khi không có mạng / chưa cấu hình.
     2. GỬI THẬT qua EmailJS (JavaScript chạy trên trình duyệt, nạp CDN)
        nếu đã điền js/modules/emailConfig.js.
   Mỗi mã chỉ gửi 1 lần cho 1 khách (kiểm tra theo customerId + mã) - gọi
   lại nhiều lần (đăng nhập lại, tải lại trang) không gửi trùng.
   ========================================================= */

import { api, getCollection } from "./api.js";
import { formatMoney } from "./utils.js";
import { EMAILJS_CONFIG } from "./emailConfig.js";

const COLLECTION = "emails";
const EMAILJS_CDN = "https://cdn.jsdelivr.net/npm/@emailjs/browser@5.0.3/dist/email.min.js";
const SHOP_NAME = "Quán Bar Đêm";

/** Loại thư -> tiêu đề dịp tặng mã */
export const EMAIL_KINDS = {
  welcome: "Quà chào mừng thành viên mới",
  birthday: "Quà sinh nhật",
  holiday: "Quà ngày lễ",
};

/** Trạng thái gửi của một thư */
export const DELIVERY_LABELS = {
  sent: "Đã gửi tới email",
  saved: "Đã lưu vào hộp thư",
  failed: "Gửi email lỗi - đã lưu vào hộp thư",
};

/** Đã điền đủ cấu hình EmailJS chưa */
export function isRealEmailEnabled() {
  return Boolean(EMAILJS_CONFIG.publicKey && EMAILJS_CONFIG.serviceId && EMAILJS_CONFIG.templateId);
}

/** Địa chỉ demo (example.com, .test, .invalid) -> chỉ lưu hộp thư, không gửi thật */
function isDemoAddress(email) {
  return /@(example\.(com|org|net)|[^@]+\.(test|invalid|example))$/i.test(String(email || ""));
}

const pad2 = (n) => String(n).padStart(2, "0");
function formatDay(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/* ---------------- Soạn nội dung thư ---------------- */

/**
 * Soạn thư tặng mã cho khách.
 * @returns {{ subject: string, body: string, params: object }} params = biến cho template EmailJS
 */
export function buildVoucherEmail(customer, voucher, kind) {
  const name = String(customer?.name || "Quý khách").trim();
  const occasion = kind === "holiday" ? voucher.name : (EMAIL_KINDS[kind] || "Mã giảm giá");
  const validUntil = formatDay(voucher.endDate) || "khi còn hiệu lực";
  const conditions = [
    Number(voucher.minOrder) > 0 ? `áp dụng cho đơn từ ${formatMoney(voucher.minOrder)}` : "áp dụng cho mọi giá trị đơn",
    Number(voucher.maxDiscount) > 0 ? `giảm tối đa ${formatMoney(voucher.maxDiscount)}` : "",
    "dùng 1 lần",
  ].filter(Boolean).join(", ");

  const intro = {
    welcome: `Cảm ơn ${name} đã đăng ký thành viên ${SHOP_NAME}! Quán gửi tặng bạn mã giảm giá cho đơn đầu tiên.`,
    birthday: `Chúc mừng sinh nhật ${name}! ${SHOP_NAME} gửi tặng bạn món quà nhỏ cho ngày đặc biệt.`,
    holiday: `${voucher.description || `${SHOP_NAME} gửi tặng ${name} mã giảm giá nhân dịp lễ.`}`,
  }[kind] || `${SHOP_NAME} gửi tặng ${name} mã giảm giá.`;

  const subject = `[${SHOP_NAME}] ${occasion}: mã ${voucher.code} giảm ${voucher.percent}%`;
  const body = [
    `Xin chào ${name},`,
    "",
    intro,
    "",
    `Mã giảm giá: ${voucher.code}`,
    `Mức giảm: ${voucher.percent}% (${conditions})`,
    `Hạn sử dụng: đến hết ngày ${validUntil}`,
    "",
    "Cách dùng: chọn món trên website, mở trang \"Đặt bàn & Gọi món\" và nhập mã vào ô \"Mã giảm giá\".",
    "Mã cá nhân chỉ dùng được khi bạn đăng nhập đúng tài khoản thành viên.",
    "",
    `Hẹn gặp bạn tại ${SHOP_NAME} - 123 Nguyễn Huệ, Quận 1, TP.HCM (18:00 - 02:00).`,
    "Uống có trách nhiệm - không lái xe sau khi uống rượu bia.",
  ].join("\n");

  return {
    subject,
    body,
    params: {
      to_email: customer?.email || "",
      to_name: name,
      subject,
      voucher_code: voucher.code,
      discount: `${voucher.percent}%`,
      valid_until: validUntil,
      occasion,
      message: body,
    },
  };
}

/* ---------------- Gửi thật qua EmailJS ---------------- */

let emailJsPromise = null;

/** Nạp thư viện EmailJS từ CDN đúng 1 lần (chỉ chạy trên trình duyệt) */
function loadEmailJs() {
  if (globalThis.emailjs?.send) return Promise.resolve(globalThis.emailjs);
  if (!emailJsPromise) {
    emailJsPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = EMAILJS_CDN;
      script.async = true;
      script.onload = () => (globalThis.emailjs?.send ? resolve(globalThis.emailjs) : reject(new Error("Không nạp được EmailJS")));
      script.onerror = () => reject(new Error("Không tải được thư viện EmailJS (kiểm tra mạng)"));
      document.head.appendChild(script);
    }).catch((err) => {
      emailJsPromise = null; // lần sau thử nạp lại
      throw err;
    });
  }
  return emailJsPromise;
}

/**
 * Gửi thư thật. Trả về "sent" | "saved" (không gửi vì chưa cấu hình / địa chỉ demo / không có trình duyệt)
 * hoặc ném lỗi khi EmailJS báo lỗi.
 */
async function sendViaEmailJs(params) {
  if (!isRealEmailEnabled() || isDemoAddress(params.to_email) || typeof document === "undefined") return "saved";
  const emailjs = await loadEmailJs();
  await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, params, { publicKey: EMAILJS_CONFIG.publicKey });
  return "sent";
}

/* ---------------- API cho các trang ---------------- */

/** Thư đã gửi cho một khách, mới nhất trước */
export async function getCustomerEmails(customerId) {
  const list = await getCollection(COLLECTION, []);
  return list
    .filter((m) => String(m.customerId) === String(customerId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/** Đánh dấu thư đã đọc */
export async function markEmailRead(id) {
  return api.patch(`/${COLLECTION}/${encodeURIComponent(id)}`, { read: true });
}

/**
 * Gửi mã giảm giá về email của khách (và lưu vào hộp thư web).
 * - Khách chưa có email -> không gửi, trả { status: "no-email" }.
 * - Mã này đã gửi cho khách rồi -> không gửi lại, trả { status: "duplicate" }.
 * Lỗi gửi thật KHÔNG làm hỏng việc tặng mã: thư vẫn được lưu với trạng thái "failed".
 * @returns {Promise<{ status: "sent"|"saved"|"failed"|"no-email"|"duplicate", email?: object }>}
 */
export async function sendVoucherEmail(customer, voucher, kind) {
  if (!customer?.id || !voucher?.code) return { status: "no-email" };
  const to = String(customer.email || "").trim();
  if (!to) return { status: "no-email" };

  const existing = (await getCollection(COLLECTION, []))
    .find((m) => String(m.customerId) === String(customer.id) && m.voucherCode === voucher.code);
  if (existing) return { status: "duplicate", email: existing };

  const { subject, body, params } = buildVoucherEmail(customer, voucher, kind);
  let delivery;
  let error = "";
  try {
    delivery = await sendViaEmailJs(params);
  } catch (err) {
    delivery = "failed";
    error = String(err?.text || err?.message || err || "Lỗi không xác định");
    console.warn("[email] Gửi email thật thất bại:", error);
  }

  const saved = await api.post(`/${COLLECTION}`, {
    customerId: String(customer.id),
    to,
    toName: customer.name || "",
    subject,
    body,
    voucherCode: voucher.code,
    kind,
    delivery,
    ...(error ? { error } : {}),
    read: false,
    createdAt: new Date().toISOString(),
  });
  return { status: delivery, email: saved };
}

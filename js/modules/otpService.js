/* =========================================================
   OTPSERVICE.JS - Mã OTP xác thực khi đổi / đặt lại mật khẩu
   - 2 kênh nhận mã: Email hoặc SMS (khách chọn)
   - Mã 6 số, hiệu lực 5 phút, dùng 1 lần, sai tối đa 5 lần, gửi lại sau 30 giây
   - Đồ án chỉ có HTML/CSS/JS (không có máy chủ gửi thư/SMS thật) nên tin nhắn được MÔ PHỎNG trên màn hình
     (OTP_DEMO_MODE = true). Muốn gửi thật: nối dịch vụ (EmailJS cho email, cổng SMS cho điện thoại) vào
     hàm deliverOtpMessage() rồi đặt OTP_DEMO_MODE = false để mã không còn hiện trên màn hình.
   ========================================================= */

export const OTP_DEMO_MODE = true;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_RESEND_MS = 30 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

export const OTP_CHANNELS = {
  email: { label: "Email", icon: "📧" },
  sms: { label: "SMS", icon: "💬" },
};

// Chỉ giữ trong bộ nhớ trang: tải lại trang thì phải xin mã mới (an toàn hơn lưu ra localStorage)
const otpStore = new Map();
const storeKey = (customerId, purpose) => `${purpose}:${customerId}`;

export function maskEmail(email) {
  const [name = "", domain = ""] = String(email || "").split("@");
  if (!domain) return "";
  return `${name.slice(0, 2)}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

export function maskPhone(phone) {
  const p = String(phone || "");
  return p.length >= 6 ? `${p.slice(0, 3)}****${p.slice(-3)}` : "";
}

/** Kênh nào dùng được với tài khoản này (có email thì có Email, có SĐT thì có SMS) */
export function availableChannels(customer) {
  const list = [];
  if (customer?.email) list.push("email");
  if (customer?.phone) list.push("sms");
  return list;
}

/**
 * "Gửi" tin nhắn OTP. Hiện là mô phỏng: trả về nội dung để giao diện hiển thị như một tin nhắn đến.
 * Chỗ nối dịch vụ thật: gọi API gửi email/SMS ở đây.
 */
function deliverOtpMessage({ channel, to, otp, purpose }) {
  const what = purpose === "change" ? "đổi mật khẩu" : "đặt lại mật khẩu";
  return {
    channel,
    to,
    subject: channel === "email" ? `[Quán Bar Đêm] Mã xác thực ${what}` : "",
    text: `Mã OTP ${what} tại Quán Bar Đêm của bạn là ${otp}. Có hiệu lực 5 phút. Không chia sẻ mã này cho bất kỳ ai.`,
  };
}

/**
 * Tạo và gửi OTP.
 * @param {{customer:object, channel?:"email"|"sms", purpose?:"reset"|"change"}} p
 */
export function issueOtp({ customer, channel, purpose = "reset", now = Date.now() }) {
  if (!customer?.id) return { success: false, message: "Không xác định được tài khoản cần xác thực." };

  const channels = availableChannels(customer);
  const chosen = channel || channels[0];
  if (!OTP_CHANNELS[chosen]) return { success: false, message: "Vui lòng chọn cách nhận mã: Email hoặc SMS." };
  if (!channels.includes(chosen)) {
    return {
      success: false,
      message: chosen === "email"
        ? "Tài khoản này chưa có email. Vui lòng chọn nhận mã qua SMS."
        : "Tài khoản này chưa có số điện thoại. Vui lòng chọn nhận mã qua Email.",
    };
  }

  const key = storeKey(customer.id, purpose);
  const old = otpStore.get(key);
  if (old && now - old.issuedAt < OTP_RESEND_MS) {
    const wait = Math.ceil((OTP_RESEND_MS - (now - old.issuedAt)) / 1000);
    return { success: false, message: `Vui lòng chờ ${wait} giây trước khi gửi lại mã.`, waitSeconds: wait };
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  otpStore.set(key, { otp, channel: chosen, issuedAt: now, expiresAt: now + OTP_TTL_MS, attempts: 0 });

  const target = chosen === "email" ? maskEmail(customer.email) : maskPhone(customer.phone);
  const message = deliverOtpMessage({ channel: chosen, to: target, otp, purpose });
  const result = {
    success: true,
    channel: chosen,
    channelLabel: OTP_CHANNELS[chosen].label,
    target,
    message: `Mã OTP đã được gửi qua ${OTP_CHANNELS[chosen].label} tới ${target}.`,
    preview: message,
    expiresInSeconds: OTP_TTL_MS / 1000,
    resendInSeconds: OTP_RESEND_MS / 1000,
  };
  if (OTP_DEMO_MODE) result.otp = otp; // chỉ để demo/kiểm thử, bản chạy thật phải tắt
  return result;
}

/** Kiểm tra OTP. Đúng thì mã bị huỷ ngay (dùng 1 lần). */
export function verifyOtp(customerId, purpose, code, now = Date.now()) {
  const key = storeKey(customerId, purpose);
  const record = otpStore.get(key);
  if (!record) return { ok: false, message: "Chưa có mã xác thực. Vui lòng bấm gửi mã OTP trước." };
  if (now > record.expiresAt) {
    otpStore.delete(key);
    return { ok: false, message: "Mã OTP đã hết hạn hiệu lực (5 phút). Vui lòng yêu cầu mã mới." };
  }
  if (String(code || "").trim() !== record.otp) {
    record.attempts += 1;
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      otpStore.delete(key);
      return { ok: false, message: "Nhập sai quá 5 lần. Mã OTP đã bị huỷ, vui lòng yêu cầu mã mới." };
    }
    return { ok: false, message: `Mã OTP không chính xác (còn ${OTP_MAX_ATTEMPTS - record.attempts} lần thử).` };
  }
  otpStore.delete(key);
  return { ok: true, message: "" };
}

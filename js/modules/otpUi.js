/* =========================================================
   OTPUI.JS - Phần giao diện dùng chung cho bước xác thực OTP
   (ô chọn Email/SMS, thẻ tin nhắn mô phỏng, nút "Gửi lại" có đếm ngược)
   ========================================================= */

import { OTP_CHANNELS } from "./otpService.js";
import { escapeHtml } from "./utils.js";

/** Hai nút chọn cách nhận mã. name = tên nhóm radio (mỗi hộp thoại một tên riêng) */
export function otpChannelPickerHtml(name, { selected = "email", labels = null } = {}) {
  const item = (key) => {
    const labelText = labels?.[key] || `Nhận mã qua <strong>${OTP_CHANNELS[key].label}</strong>`;
    return `
    <label class="otp-channel" style="flex:1; display:flex; align-items:center; gap:8px; padding:9px 12px; border:1px solid rgba(255,255,255,0.15); border-radius:6px; background:rgba(0,0,0,0.25); cursor:pointer; font-size:0.86rem; color:var(--cream);">
      <input type="radio" name="${name}" value="${key}" ${selected === key ? "checked" : ""}>
      <span>${OTP_CHANNELS[key].icon} ${labelText}</span>
    </label>`;
  };
  return `<div class="otp-channels" role="radiogroup" aria-label="Cách nhận mã OTP" style="display:flex; gap:8px; flex-wrap:wrap;">${item("email")}${item("sms")}</div>`;
}

/** Cách nhận mã đang được chọn */
export function selectedOtpChannel(root, name) {
  return root.querySelector(`input[name="${name}"]:checked`)?.value || "email";
}

/**
 * Thẻ "tin nhắn đến" mô phỏng email/SMS. Chỉ có mã khi OTP_DEMO_MODE bật (result.otp).
 * Bấm vào mã để tự điền vào ô OTP.
 */
export function otpMessageCardHtml(result) {
  const ch = OTP_CHANNELS[result.channel] || OTP_CHANNELS.email;
  const p = result.preview || {};
  return `
    <div class="otp-sent-card" style="background: rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.3); border-radius: 6px; padding: 10px 14px; font-size: 0.82rem; color: var(--gold-light);">
      <div>${ch.icon} Mã đã gửi qua <strong>${escapeHtml(ch.label)}</strong> tới <strong style="color:#fff;">${escapeHtml(result.target)}</strong> · hiệu lực ${Math.round(result.expiresInSeconds / 60)} phút</div>
      ${result.otp ? `
      <div style="margin-top:8px; padding:8px 10px; background:rgba(0,0,0,0.4); border-radius:6px; border:1px dashed rgba(212,175,55,0.5);">
        <div style="font-size:0.7rem; color:var(--muted); margin-bottom:4px;">Chế độ demo - tin nhắn ${escapeHtml(ch.label)} được mô phỏng tại đây (chưa nối máy chủ gửi thật)</div>
        ${p.subject ? `<div style="font-size:0.78rem; color:#fff; font-weight:600;">${escapeHtml(p.subject)}</div>` : ""}
        <div style="font-size:0.78rem; color:var(--cream);">${escapeHtml(p.text || "")}</div>
        <button type="button" class="otp-fill-btn" data-otp="${escapeHtml(result.otp)}" style="margin-top:6px; background:none; border:none; padding:0; color:var(--amber-soft); font-size:0.74rem; text-decoration:underline; cursor:pointer;">Bấm để tự điền mã ${escapeHtml(result.otp)}</button>
      </div>` : ""}
    </div>`;
}

/** Khoá nút trong `seconds` giây, hiện đếm ngược trên nút; trả về hàm huỷ */
export function startResendCountdown(button, seconds, label = "Gửi lại mã") {
  let left = Math.max(0, Math.round(seconds));
  button.disabled = true;
  const tick = () => {
    if (!button.isConnected) return;
    if (left <= 0) {
      button.disabled = false;
      button.textContent = label;
      return;
    }
    button.textContent = `${label} (${left}s)`;
    left -= 1;
    timer = setTimeout(tick, 1000);
  };
  let timer = setTimeout(tick, 0);
  return () => clearTimeout(timer);
}

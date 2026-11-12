/* =========================================================
   FORGOT-PASSWORD-MODAL.JS - Hộp thoại Quên / Đặt lại mật khẩu khách hàng
   Quy trình 2 bước tiện lợi & chuẩn bảo mật:
   - Bước 1: Nhập Số điện thoại hoặc Email đã đăng ký để tìm tài khoản
   - Bước 2: Nhập mã OTP xác thực và thiết lập mật khẩu mới
   ========================================================= */

import { requestPasswordResetOtp, resetCustomerPassword } from "./customerAuth.js";
import { toast, setButtonLoading } from "./ui.js";
import { escapeHtml, normalizePhone } from "./utils.js";
import { ICONS } from "./icons.js";
import { PASSWORD_RULE_TEXT } from "./passwords.js";
import { otpChannelPickerHtml, selectedOtpChannel, otpMessageCardHtml, startResendCountdown } from "./otpUi.js";

/** Loại bỏ tiền tố +84 / 84 / số 0 đầu để hiển thị phần số sau +84 */
export function stripVietnamPhonePrefix(raw = "") {
  let clean = String(raw || "").trim().replace(/[\s.\-()]/g, "");
  if (clean.startsWith("+84")) clean = clean.slice(3);
  else if (/^84\d{9,10}$/.test(clean)) clean = clean.slice(2);
  if (clean.startsWith("0")) clean = clean.slice(1);
  return clean;
}

/** Ghép đầu số +84 chuẩn quốc tế từ phần số người dùng nhập */
export function buildIntlVietnamPhone(raw = "") {
  const national = stripVietnamPhonePrefix(raw);
  return national ? `+84${national}` : "";
}

/** Xác định kênh mặc định từ chuỗi điền sẵn */
export function detectInitialOtpChannel(prefilledIdent = "") {
  const trimmed = String(prefilledIdent || "").trim();
  if (!trimmed || trimmed.includes("@")) return "email";
  const digits = stripVietnamPhonePrefix(trimmed);
  return /^\d{6,}$/.test(digits) ? "sms" : "email";
}

/**
 * Mở hộp thoại quên mật khẩu
 * @param {string} [prefilledIdent] Số điện thoại hoặc email điền sẵn nếu có
 * @param {function} [onSuccess] Callback khi đặt lại mật khẩu thành công
 */
export function openForgotPasswordModal(prefilledIdent = "", onSuccess = null) {
  const existing = document.getElementById("forgot-password-modal");
  if (existing) existing.remove();

  const initialChannel = detectInitialOtpChannel(prefilledIdent);
  const draftByChannel = {
    email: initialChannel === "email" ? String(prefilledIdent || "").trim() : "",
    sms: initialChannel === "sms" ? stripVietnamPhonePrefix(prefilledIdent) : "",
  };

  const host = document.createElement("div");
  host.className = "modal-overlay show";
  host.id = "forgot-password-modal";
  host.innerHTML = `
    <div class="modal-box" role="dialog" aria-modal="true" style="max-width: 480px; padding: 24px;">
      <div class="modal-head" style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--gold-primary); font-size: 1.2rem;">🔒</span>
          <h3 style="margin: 0; font-family: var(--font-heading); font-size: 1.3rem; color: var(--gold-light);">Đặt Lại Mật Khẩu</h3>
        </div>
        <button type="button" class="modal-close-x" id="fp-close-x" aria-label="Đóng">&times;</button>
      </div>

      <!-- BƯỚC 1: CHỌN KÊNH & NHẬP EMAIL HOẶC SỐ ĐIỆN THOẠI (+84) -->
      <div id="fp-step-1">
        <p class="text-xs text-muted" style="margin-bottom: 14px; line-height: 1.5;">
          Chọn hình thức xác thực bằng Email hoặc Số điện thoại đã đăng ký tài khoản tại Quán Bar Đêm để nhận mã OTP đặt lại mật khẩu.
        </p>

        <form id="fp-form-step1" novalidate>
          <div class="form-group mb-3">
            <label style="display: block; font-size: 0.84rem; font-weight: 600; color: var(--cream); margin-bottom: 6px;">Chọn cách nhập &amp; nhận mã OTP</label>
            ${otpChannelPickerHtml("fp-channel", {
              selected: initialChannel,
              labels: {
                email: "<strong>Email</strong> (nhận mã qua Email)",
                sms: "<strong>Số điện thoại</strong> (nhận SMS)",
              },
            })}
          </div>

          <div class="form-group mb-3">
            <label id="fp-ident-label" for="fp-ident-input" style="display: block; font-size: 0.84rem; font-weight: 600; color: var(--cream); margin-bottom: 6px;">
              Email đã đăng ký <span class="req" style="color: #ef4444;">*</span>
            </label>
            <div class="fp-ident-wrap" id="fp-ident-wrap">
              <span class="fp-phone-prefix" id="fp-phone-prefix" hidden>+84</span>
              <input type="email" id="fp-ident-input" class="form-control fp-ident-input" placeholder="VD: email@domain.com" value="" required autocomplete="email">
            </div>
            <small class="text-xs text-muted" id="fp-ident-hint" style="display: block; margin-top: 5px; line-height: 1.4;">
              Nhập đúng địa chỉ Email bạn đã dùng khi đăng ký tài khoản.
            </small>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px;">
            <button type="button" class="btn btn-ghost btn-sm" id="fp-cancel-btn">Huỷ</button>
            <button type="submit" class="btn btn-primary" id="fp-btn-send-otp">
              <span>Gửi mã xác thực</span>
              ${ICONS.arrowRight(14)}
            </button>
          </div>
        </form>
      </div>

      <!-- BƯỚC 2: NHẬP OTP & ĐẶT MẬT KHẨU MỚI -->
      <div id="fp-step-2" hidden>
        <div id="fp-otp-notice" style="margin-bottom: 14px;"></div>
        <div style="text-align: right; margin: -6px 0 10px;">
          <button type="button" class="btn btn-ghost btn-sm" id="fp-resend-btn">Gửi lại mã</button>
        </div>

        <form id="fp-form-step2" novalidate>
          <div class="form-group mb-2">
            <label style="display: block; font-size: 0.82rem; font-weight: 600; color: var(--cream); margin-bottom: 4px;">
              Mã xác thực OTP (6 chữ số) <span class="req" style="color: #ef4444;">*</span>
            </label>
            <input type="text" id="fp-otp-input" maxlength="6" inputmode="numeric" placeholder="VD: 123456" required style="width: 100%; padding: 9px 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; font-size: 1.1rem; letter-spacing: 2px; text-align: center; font-weight: 700;">
          </div>

          <div class="form-group mb-2">
            <label style="display: block; font-size: 0.82rem; font-weight: 600; color: var(--cream); margin-bottom: 4px;">
              Mật khẩu mới <span class="req" style="color: #ef4444;">*</span>
            </label>
            <div class="pw-input-wrap" style="position: relative;">
              <input type="password" id="fp-new-pass" placeholder="Tối thiểu 8 ký tự, có chữ hoa, thường & ký tự đặc biệt" autocomplete="new-password" required style="width: 100%; padding: 9px 36px 9px 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; font-size: 0.92rem;">
              <button type="button" class="pw-toggle-btn" data-target="fp-new-pass" aria-label="Ẩn hiện mật khẩu" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--muted); cursor: pointer; padding: 4px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
            <small class="text-xs text-muted" style="display: block; margin-top: 2px; font-size: 0.72rem;">${escapeHtml(PASSWORD_RULE_TEXT)}</small>
          </div>

          <div class="form-group mb-3">
            <label style="display: block; font-size: 0.82rem; font-weight: 600; color: var(--cream); margin-bottom: 4px;">
              Nhập lại mật khẩu mới <span class="req" style="color: #ef4444;">*</span>
            </label>
            <div class="pw-input-wrap" style="position: relative;">
              <input type="password" id="fp-confirm-pass" placeholder="Nhập lại mật khẩu mới" autocomplete="new-password" required style="width: 100%; padding: 9px 36px 9px 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; font-size: 0.92rem;">
              <button type="button" class="pw-toggle-btn" data-target="fp-confirm-pass" aria-label="Ẩn hiện mật khẩu" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--muted); cursor: pointer; padding: 4px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 18px;">
            <button type="button" class="btn btn-ghost btn-sm" id="fp-back-btn">&larr; Quay lại</button>
            <button type="submit" class="btn btn-primary" id="fp-btn-submit-reset">
              <span>Lưu mật khẩu mới</span>
              ${ICONS.arrowRight(14)}
            </button>
          </div>
        </form>
      </div>
    </div>`;

  const close = () => host.remove();
  host.querySelector("#fp-close-x").addEventListener("click", close);
  host.querySelector("#fp-cancel-btn")?.addEventListener("click", close);
  host.addEventListener("click", (e) => {
    if (e.target === host) close();
  });

  // Toggle ẩn hiện mật khẩu
  host.querySelectorAll(".pw-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = host.querySelector(`#${btn.dataset.target}`);
      if (input) {
        input.type = input.type === "password" ? "text" : "password";
      }
    });
  });

  const step1El = host.querySelector("#fp-step-1");
  const step2El = host.querySelector("#fp-step-2");
  const form1 = host.querySelector("#fp-form-step1");
  const form2 = host.querySelector("#fp-form-step2");
  const identLabelEl = host.querySelector("#fp-ident-label");
  const phonePrefixEl = host.querySelector("#fp-phone-prefix");
  const identInput = host.querySelector("#fp-ident-input");
  const identHintEl = host.querySelector("#fp-ident-hint");
  const noticeEl = host.querySelector("#fp-otp-notice");
  const resendBtn = host.querySelector("#fp-resend-btn");
  const otpInput = host.querySelector("#fp-otp-input");
  const newPassInput = host.querySelector("#fp-new-pass");
  const confirmPassInput = host.querySelector("#fp-confirm-pass");
  const btnSendOtp = host.querySelector("#fp-btn-send-otp");
  const btnSubmitReset = host.querySelector("#fp-btn-submit-reset");
  const btnBack = host.querySelector("#fp-back-btn");

  let activeChannel = initialChannel;
  let currentCustomerId = "";
  let currentIdent = "";
  let stopCountdown = () => {};

  function syncChannelField({ focusInput = false } = {}) {
    const isSms = activeChannel === "sms";
    if (identLabelEl) {
      identLabelEl.innerHTML = `${isSms ? "Số điện thoại đã đăng ký" : "Email đã đăng ký"} <span class="req" style="color: #ef4444;">*</span>`;
    }
    if (phonePrefixEl) phonePrefixEl.hidden = !isSms;
    if (identInput) {
      identInput.type = isSms ? "tel" : "email";
      identInput.inputMode = isSms ? "tel" : "email";
      identInput.autocomplete = isSms ? "tel-national" : "email";
      identInput.placeholder = isSms ? "VD: 909 123 456" : "VD: email@domain.com";
      identInput.value = isSms ? stripVietnamPhonePrefix(draftByChannel.sms) : draftByChannel.email;
    }
    if (identHintEl) {
      identHintEl.textContent = isSms
        ? "Đầu số +84 được đặt sẵn — nhập phần số điện thoại (VD: 909123456)."
        : "Nhập đúng địa chỉ Email bạn đã dùng khi đăng ký tài khoản.";
    }
    if (focusInput && identInput) setTimeout(() => identInput.focus(), 30);
  }

  syncChannelField();

  host.querySelectorAll('input[name="fp-channel"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      draftByChannel[activeChannel] = identInput.value.trim();
      activeChannel = selectedOtpChannel(host, "fp-channel");
      syncChannelField({ focusInput: true });
    });
  });

  identInput.addEventListener("blur", () => {
    if (activeChannel === "sms") {
      const cleaned = stripVietnamPhonePrefix(identInput.value);
      if (cleaned !== identInput.value) identInput.value = cleaned;
    }
  });

  function showSentNotice(res) {
    noticeEl.innerHTML = otpMessageCardHtml(res);
    stopCountdown();
    stopCountdown = startResendCountdown(resendBtn, res.resendInSeconds);
  }

  // Gửi lại mã (theo kênh đang chọn ở bước 1)
  resendBtn.addEventListener("click", async () => {
    const res = await requestPasswordResetOtp(currentIdent, activeChannel);
    if (res.success) {
      showSentNotice(res);
      toast(res.message, "success");
    } else {
      toast(res.message, "danger");
    }
  });

  // Xử lý bước 1: Yêu cầu OTP
  form1.addEventListener("submit", async (e) => {
    e.preventDefault();
    const channel = selectedOtpChannel(host, "fp-channel");
    activeChannel = channel;
    const rawValue = identInput.value.trim();

    let ident = rawValue;
    if (channel === "email") {
      if (!rawValue) {
        toast("Vui lòng nhập địa chỉ Email đã đăng ký.", "warning");
        identInput.focus();
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawValue)) {
        toast("Email không đúng định dạng (VD: email@domain.com).", "warning");
        identInput.focus();
        return;
      }
    } else {
      const national = stripVietnamPhonePrefix(rawValue);
      identInput.value = national;
      if (!national) {
        toast("Vui lòng nhập Số điện thoại sau +84 (VD: 909123456).", "warning");
        identInput.focus();
        return;
      }
      if (!/^\d{9,10}$/.test(national)) {
        toast("Số điện thoại không hợp lệ (nhập 9–10 chữ số sau +84, VD: 909123456).", "warning");
        identInput.focus();
        return;
      }
      ident = buildIntlVietnamPhone(national);
    }

    const restore = setButtonLoading(btnSendOtp, "Đang kiểm tra...");
    try {
      const res = await requestPasswordResetOtp(ident, channel);
      if (res.success) {
        currentCustomerId = res.customerId;
        currentIdent = channel === "sms" ? normalizePhone(ident) : ident;
        showSentNotice(res);
        toast(res.message, "success");

        step1El.hidden = true;
        step2El.hidden = false;
        setTimeout(() => otpInput.focus(), 150);
      } else {
        toast(res.message, "danger");
      }
    } finally {
      restore();
    }
  });

  // Bấm vào dòng "tự điền mã" trong tin nhắn mô phỏng để điền OTP
  noticeEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".otp-fill-btn");
    if (!btn) return;
    otpInput.value = btn.dataset.otp;
    newPassInput.focus();
    toast("Đã tự động điền mã OTP!", "info");
  });

  // Quay lại bước 1
  btnBack?.addEventListener("click", () => {
    step2El.hidden = true;
    step1El.hidden = false;
  });

  // Xử lý bước 2: Đặt lại mật khẩu
  form2.addEventListener("submit", async (e) => {
    e.preventDefault();
    const otp = otpInput.value.trim();
    const newPass = newPassInput.value;
    const confirmPass = confirmPassInput.value;

    if (!otp) {
      toast("Vui lòng nhập mã xác thực OTP 6 chữ số.", "warning");
      otpInput.focus();
      return;
    }
    if (!newPass) {
      toast("Vui lòng nhập mật khẩu mới.", "warning");
      newPassInput.focus();
      return;
    }
    if (newPass !== confirmPass) {
      toast("Mật khẩu xác nhận không trùng khớp.", "warning");
      confirmPassInput.focus();
      return;
    }

    const restore = setButtonLoading(btnSubmitReset, "Đang lưu mật khẩu...");
    try {
      const res = await resetCustomerPassword({
        customerId: currentCustomerId,
        newPassword: newPass,
        otp,
      });

      if (res.success) {
        toast(res.message, "success");
        close();
        if (typeof onSuccess === "function") {
          onSuccess(currentIdent || identInput.value.trim(), newPass);
        }
      } else {
        toast(res.message, "danger");
      }
    } finally {
      restore();
    }
  });

  document.body.appendChild(host);
  setTimeout(() => identInput.focus(), 100);
}


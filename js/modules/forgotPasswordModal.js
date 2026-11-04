/* =========================================================
   FORGOT-PASSWORD-MODAL.JS - Hộp thoại Quên / Đặt lại mật khẩu khách hàng
   Quy trình 2 bước tiện lợi & chuẩn bảo mật:
   - Bước 1: Nhập Số điện thoại hoặc Email đã đăng ký để tìm tài khoản
   - Bước 2: Nhập mã OTP xác thực và thiết lập mật khẩu mới
   ========================================================= */

import { requestPasswordResetOtp, resetCustomerPassword } from "./customerAuth.js";
import { toast, setButtonLoading } from "./ui.js";
import { escapeHtml } from "./utils.js";
import { ICONS } from "./icons.js";
import { PASSWORD_RULE_TEXT } from "./passwords.js";

/**
 * Mở hộp thoại quên mật khẩu
 * @param {string} [prefilledIdent] Số điện thoại hoặc email điền sẵn nếu có
 * @param {function} [onSuccess] Callback khi đặt lại mật khẩu thành công
 */
export function openForgotPasswordModal(prefilledIdent = "", onSuccess = null) {
  const existing = document.getElementById("forgot-password-modal");
  if (existing) existing.remove();

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

      <!-- BƯỚC 1: XÁC MINH SỐ ĐIỆN THOẠI / EMAIL -->
      <div id="fp-step-1">
        <p class="text-xs text-muted" style="margin-bottom: 14px; line-height: 1.5;">
          Vui lòng nhập Số điện thoại hoặc Email đã đăng ký tài khoản tại Quán Bar Đêm. Hệ thống sẽ tạo mã OTP xác thực để bảo vệ tài khoản của bạn.
        </p>

        <form id="fp-form-step1" novalidate>
          <div class="form-group mb-3">
            <label style="display: block; font-size: 0.84rem; font-weight: 600; color: var(--cream); margin-bottom: 6px;">
              Số điện thoại hoặc Email <span class="req" style="color: #ef4444;">*</span>
            </label>
            <input type="text" id="fp-ident-input" class="form-control" placeholder="VD: 0909123456 hoặc email@domain.com" value="${escapeHtml(prefilledIdent)}" required style="width: 100%; padding: 10px 14px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; font-size: 0.95rem;">
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
        <div class="fp-otp-notice" style="background: rgba(212, 175, 55, 0.1); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; font-size: 0.82rem; color: var(--gold-light);">
          <div>Mã xác thực đã gửi tới: <strong id="fp-target-display" style="color: #fff;"></strong></div>
          <div id="fp-demo-otp-chip" style="margin-top: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; background: rgba(0,0,0,0.4); padding: 3px 8px; border-radius: 4px; border: 1px dashed rgba(212, 175, 55, 0.5); font-size: 0.78rem;">
            <span>Mã demo: <strong id="fp-demo-otp-val" style="color: var(--amber-soft); letter-spacing: 1px;"></strong></span>
            <span style="font-size: 0.7rem; color: var(--muted);">(Bấm để điền)</span>
          </div>
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
  const identInput = host.querySelector("#fp-ident-input");
  const targetDisplay = host.querySelector("#fp-target-display");
  const demoOtpVal = host.querySelector("#fp-demo-otp-val");
  const demoOtpChip = host.querySelector("#fp-demo-otp-chip");
  const otpInput = host.querySelector("#fp-otp-input");
  const newPassInput = host.querySelector("#fp-new-pass");
  const confirmPassInput = host.querySelector("#fp-confirm-pass");
  const btnSendOtp = host.querySelector("#fp-btn-send-otp");
  const btnSubmitReset = host.querySelector("#fp-btn-submit-reset");
  const btnBack = host.querySelector("#fp-back-btn");

  let currentCustomerId = "";

  // Xử lý bước 1: Yêu cầu OTP
  form1.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ident = identInput.value.trim();
    if (!ident) {
      toast("Vui lòng nhập Số điện thoại hoặc Email.", "warning");
      return;
    }

    const restore = setButtonLoading(btnSendOtp, "Đang kiểm tra...");
    try {
      const res = await requestPasswordResetOtp(ident);
      if (res.success) {
        currentCustomerId = res.customerId;
        targetDisplay.textContent = res.target;
        demoOtpVal.textContent = res.otp;
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

  // Bấm vào chip demo để tự động điền mã OTP
  demoOtpChip?.addEventListener("click", () => {
    otpInput.value = demoOtpVal.textContent.trim();
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
          onSuccess(identInput.value.trim(), newPass);
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

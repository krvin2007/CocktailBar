/* =========================================================
   CHANGE-PASSWORD-MODAL.JS - Hộp thoại Đổi mật khẩu tài khoản khách hàng
   Cho phép người dùng đã đăng nhập đổi mật khẩu:
   - Nhập mật khẩu hiện tại để xác thực chủ tài khoản
   - Nhập mật khẩu mới & xác nhận mật khẩu mới
   - Kiểm tra chuẩn bảo mật và băm mật khẩu sha256
   - Hỗ trợ chuyển sang "Quên mật khẩu" nếu không nhớ mật khẩu cũ
   ========================================================= */

import { changeCustomerPassword } from "./customerAuth.js";
import { toast, setButtonLoading } from "./ui.js";
import { escapeHtml } from "./utils.js";
import { ICONS } from "./icons.js";
import { PASSWORD_RULE_TEXT } from "./passwords.js";
import { openForgotPasswordModal } from "./forgotPasswordModal.js";

/**
 * Mở hộp thoại đổi mật khẩu
 * @param {Object} customer Đối tượng khách hàng đang đăng nhập ({ id, name, phone, email })
 * @param {function} [onSuccess] Callback khi đổi mật khẩu thành công
 */
export function openChangePasswordModal(customer, onSuccess = null) {
  if (!customer || !customer.id) {
    toast("Vui lòng đăng nhập để thực hiện đổi mật khẩu.", "warning");
    return;
  }

  const existing = document.getElementById("change-password-modal");
  if (existing) existing.remove();

  const host = document.createElement("div");
  host.className = "modal-overlay show";
  host.id = "change-password-modal";
  host.innerHTML = `
    <div class="modal-box" role="dialog" aria-modal="true" style="max-width: 480px; padding: 24px;">
      <div class="modal-head" style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--gold-primary); font-size: 1.2rem;">🔑</span>
          <h3 style="margin: 0; font-family: var(--font-heading); font-size: 1.3rem; color: var(--gold-light);">Đổi Mật Khẩu</h3>
        </div>
        <button type="button" class="modal-close-x" id="cp-close-x" aria-label="Đóng">&times;</button>
      </div>

      <p class="text-xs text-muted" style="margin-bottom: 14px; line-height: 1.5;">
        Tài khoản: <strong style="color: var(--cream);">${escapeHtml(customer.name)}</strong> (${escapeHtml(customer.phone || customer.email || "")}). Vui lòng nhập mật khẩu hiện tại để xác nhận quyền sở hữu.
      </p>

      <form id="cp-form" novalidate>
        <!-- MẬT KHẨU HIỆN TẠI -->
        <div class="form-group mb-2">
          <label style="display: block; font-size: 0.82rem; font-weight: 600; color: var(--cream); margin-bottom: 4px;">
            Mật khẩu hiện tại <span class="req" style="color: #ef4444;">*</span>
          </label>
          <div class="pw-input-wrap" style="position: relative;">
            <input type="password" id="cp-old-pass" placeholder="Nhập mật khẩu bạn đang sử dụng" autocomplete="current-password" required style="width: 100%; padding: 9px 36px 9px 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; font-size: 0.92rem;">
            <button type="button" class="pw-toggle-btn" data-target="cp-old-pass" aria-label="Ẩn hiện mật khẩu" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--muted); cursor: pointer; padding: 4px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
          <div style="text-align: right; margin-top: 4px;">
            <button type="button" id="cp-link-forgot" style="background: none; border: none; padding: 0; color: var(--amber-soft); font-size: 0.76rem; text-decoration: underline; cursor: pointer;">
              Quên mật khẩu hiện tại?
            </button>
          </div>
        </div>

        <!-- MẬT KHẨU MỚI -->
        <div class="form-group mb-2">
          <label style="display: block; font-size: 0.82rem; font-weight: 600; color: var(--cream); margin-bottom: 4px;">
            Mật khẩu mới <span class="req" style="color: #ef4444;">*</span>
          </label>
          <div class="pw-input-wrap" style="position: relative;">
            <input type="password" id="cp-new-pass" placeholder="Tối thiểu 8 ký tự, có chữ hoa & ký tự đặc biệt" autocomplete="new-password" required style="width: 100%; padding: 9px 36px 9px 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; font-size: 0.92rem;">
            <button type="button" class="pw-toggle-btn" data-target="cp-new-pass" aria-label="Ẩn hiện mật khẩu" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--muted); cursor: pointer; padding: 4px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
          <small class="text-xs text-muted" style="display: block; margin-top: 2px; font-size: 0.72rem;">${escapeHtml(PASSWORD_RULE_TEXT)}</small>
        </div>

        <!-- XÁC NHẬN MẬT KHẨU MỚI -->
        <div class="form-group mb-3">
          <label style="display: block; font-size: 0.82rem; font-weight: 600; color: var(--cream); margin-bottom: 4px;">
            Xác nhận mật khẩu mới <span class="req" style="color: #ef4444;">*</span>
          </label>
          <div class="pw-input-wrap" style="position: relative;">
            <input type="password" id="cp-confirm-pass" placeholder="Nhập lại chính xác mật khẩu mới" autocomplete="new-password" required style="width: 100%; padding: 9px 36px 9px 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; font-size: 0.92rem;">
            <button type="button" class="pw-toggle-btn" data-target="cp-confirm-pass" aria-label="Ẩn hiện mật khẩu" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--muted); cursor: pointer; padding: 4px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px;">
          <button type="button" class="btn btn-ghost btn-sm" id="cp-cancel-btn">Huỷ bỏ</button>
          <button type="submit" class="btn btn-primary" id="cp-submit-btn">
            <span>Cập nhật mật khẩu</span>
            ${ICONS.arrowRight(14)}
          </button>
        </div>
      </form>
    </div>`;

  const close = () => host.remove();
  host.querySelector("#cp-close-x").addEventListener("click", close);
  host.querySelector("#cp-cancel-btn")?.addEventListener("click", close);
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

  // Chuyển sang Quên mật khẩu
  host.querySelector("#cp-link-forgot")?.addEventListener("click", () => {
    close();
    openForgotPasswordModal(customer.phone || customer.email || "");
  });

  // Xử lý submit
  const form = host.querySelector("#cp-form");
  const oldPassInput = host.querySelector("#cp-old-pass");
  const newPassInput = host.querySelector("#cp-new-pass");
  const confirmPassInput = host.querySelector("#cp-confirm-pass");
  const submitBtn = host.querySelector("#cp-submit-btn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const oldPass = oldPassInput.value;
    const newPass = newPassInput.value;
    const confirmPass = confirmPassInput.value;

    if (!oldPass) {
      toast("Vui lòng nhập mật khẩu hiện tại.", "warning");
      oldPassInput.focus();
      return;
    }
    if (!newPass) {
      toast("Vui lòng nhập mật khẩu mới.", "warning");
      newPassInput.focus();
      return;
    }
    if (newPass !== confirmPass) {
      toast("Mật khẩu xác nhận không trùng khớp với mật khẩu mới.", "warning");
      confirmPassInput.focus();
      return;
    }

    const restore = setButtonLoading(submitBtn, "Đang xử lý...");
    try {
      const res = await changeCustomerPassword(customer.id, oldPass, newPass);
      if (res.success) {
        toast(res.message, "success");
        close();
        if (typeof onSuccess === "function") onSuccess();
      } else {
        toast(res.message, "danger");
      }
    } catch (err) {
      toast(err.message || "Lỗi khi đổi mật khẩu.", "danger");
    } finally {
      restore();
    }
  });

  document.body.appendChild(host);
  oldPassInput.focus();
}

/* =========================================================
   VIETQR-SERVICE.JS - Hộp thanh toán Chuyển khoản VietQR (Napas 247)
   Chuẩn mã QR ngân hàng quốc gia có thể quét và chuyển khoản thực tế
   bằng bất kỳ ứng dụng Ngân hàng (MB, VCB, Techcombank, TPBank, BIDV,
   ACB, VPBank...) và ví điện tử (MoMo, ZaloPay...) tại Việt Nam.

   Tài khoản nhận tiền đọc từ máy chủ (/settings - xem settingsService.js),
   KHÁCH KHÔNG đổi được. Chỉ quản lý đổi trong trang Quản lý đơn hàng.
   ========================================================= */

import { formatMoney, escapeHtml } from "./utils.js";
import { toast } from "./ui.js";
import { getBankSettings } from "./settingsService.js";

/**
 * Sinh URL ảnh mã QR theo chuẩn VietQR Napas 247
 * Quét bằng bất kỳ App ngân hàng nào cũng sẽ tự điền đầy đủ:
 * Ngân hàng, Số tài khoản, Tên thụ hưởng, Số tiền chuẩn xác và Nội dung đơn hàng.
 */
export function generateVietQRUrl(bank, { amount, memo }) {
  const cleanAmount = Math.max(0, Math.round(Number(amount) || 0));
  const transferContent = encodeURIComponent(memo.toUpperCase());
  const accName = encodeURIComponent(bank.accountName.toUpperCase());

  // Template "compact2": Mẫu thẻ VietQR chuẩn quốc gia kèm khung Napas và thông tin chuyển khoản
  return `https://img.vietqr.io/image/${bank.bankId}-${bank.accountNumber}-compact2.png?amount=${cleanAmount}&addInfo=${transferContent}&accountName=${accName}`;
}

/** Sao chép văn bản vào clipboard với hiệu ứng toast */
export async function copyToClipboard(text, label = "thông tin") {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    toast(`Đã sao chép ${label}!`, "success");
    return true;
  } catch {
    toast(`Không thể tự động sao chép: ${text}`, "info");
    return false;
  }
}

const COPY_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

/**
 * Mở hộp thoại thanh toán VietQR.
 * @param {object} order Đơn hàng (code, total, paymentStatus...)
 * @param {object} [options]
 * @param {string} [options.confirmLabel] Chữ trên nút xác nhận
 * @param {function} [options.onConfirm] async (order) => {...} chạy khi bấm nút xác nhận.
 *   Không truyền onConfirm thì KHÔNG vẽ nút (tránh nút bấm không có chức năng).
 */
export async function openVietQRPaymentModal(order, { confirmLabel = "Tôi Đã Chuyển Khoản Xong", onConfirm } = {}) {
  let bank;
  try {
    bank = await getBankSettings();
  } catch (err) {
    toast(err.message, "error");
    return null;
  }

  const transferContent = `BAR ${order.code}`.toUpperCase();
  const qrUrl = generateVietQRUrl(bank, { amount: order.total, memo: transferContent });

  const host = document.createElement("div");
  host.className = "modal-overlay show vietqr-modal-overlay";
  host.id = "vietqr-payment-modal";
  host.innerHTML = `
    <div class="modal-box modal-vietqr" role="dialog" aria-modal="true">
      <div class="vietqr-head">
        <div class="vietqr-head-brand">
          <span class="vietqr-badge">NAPAS 247 · VIETQR CHUẨN QUỐC GIA</span>
          <h3 class="vietqr-title">Thanh Toán Chuyển Khoản Ngân Hàng</h3>
          <p class="vietqr-sub">Mở bất kỳ ứng dụng ngân hàng hoặc ví điện tử để quét mã thanh toán tức thì</p>
        </div>
        <button type="button" class="modal-close-x" id="vqr-close-x" aria-label="Đóng">&times;</button>
      </div>

      <div class="vietqr-body-grid">
        <!-- Cột 1: Thẻ hiển thị mã QR -->
        <div class="vietqr-qr-panel">
          <div class="vietqr-img-frame">
            <img src="${qrUrl}" alt="Mã QR Chuyển khoản VietQR đơn hàng ${escapeHtml(order.code)}" class="vietqr-image" loading="eager" onerror="this.onerror=null;this.src='img/vietqr.jpg';">
            <div class="vietqr-scan-line"></div>
          </div>

          <div class="vietqr-qr-actions">
            <a href="${qrUrl}" download="VietQR_${escapeHtml(order.code)}.png" target="_blank" class="btn btn-outline btn-sm btn-block" title="Lưu mã QR về điện thoại hoặc máy tính">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              <span>Tải Mã QR Về Máy</span>
            </a>
          </div>

          <div class="vietqr-security-note">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span>Quét mã tự động điền đúng số tiền &amp; nội dung, không sợ chuyển nhầm</span>
          </div>
        </div>

        <!-- Cột 2: Thông tin chuyển khoản chi tiết -->
        <div class="vietqr-info-panel">
          <div class="vietqr-amount-banner">
            <span class="vqr-amount-label">Số tiền cần thanh toán</span>
            <strong class="vqr-amount-value">${formatMoney(order.total)}</strong>
            <button type="button" class="btn-copy-chip" id="vqr-copy-amount" title="Sao chép số tiền">
              <span>Sao chép</span>
            </button>
          </div>

          <div class="vietqr-details-card">
            <div class="vqr-row">
              <span class="vqr-label">Ngân hàng</span>
              <span class="vqr-val font-semibold">${escapeHtml(bank.bankName)}</span>
            </div>
            <div class="vqr-row">
              <span class="vqr-label">Số tài khoản</span>
              <div class="vqr-val-copy">
                <strong class="vqr-val-highlight">${escapeHtml(bank.accountNumber)}</strong>
                <button type="button" class="btn-copy-icon" id="vqr-copy-acc" title="Sao chép số tài khoản">${COPY_ICON}</button>
              </div>
            </div>
            <div class="vqr-row">
              <span class="vqr-label">Chủ tài khoản</span>
              <span class="vqr-val text-amber font-semibold">${escapeHtml(bank.accountName)}</span>
            </div>
            <div class="vqr-row">
              <span class="vqr-label">Nội dung CK</span>
              <div class="vqr-val-copy">
                <strong class="vqr-val-memo">${escapeHtml(transferContent)}</strong>
                <button type="button" class="btn-copy-icon" id="vqr-copy-memo" title="Sao chép nội dung">${COPY_ICON}</button>
              </div>
            </div>
          </div>

          ${Array.isArray(order.items) && order.items.length > 0 ? `
          <div class="vqr-items-box" style="margin-top: 10px; padding: 10px 12px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: var(--radius-sm); max-height: 120px; overflow-y: auto;">
            <div style="font-size: 0.72rem; color: var(--amber-soft); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
              Danh sách món cần thanh toán (${order.items.length} món):
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              ${order.items.map((it) => `
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; gap: 8px;">
                  <span style="color: var(--cream); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${escapeHtml(it.name)} <strong style="color: var(--amber-soft);">x${it.qty}</strong>
                  </span>
                  <span style="color: var(--muted); font-size: 0.78rem; white-space: nowrap;">${formatMoney((it.price || 0) * (it.qty || 1))}</span>
                </div>
              `).join("")}
            </div>
          </div>` : ""}

          ${onConfirm ? `
          <div class="vietqr-footer-actions">
            <button type="button" class="btn btn-primary btn-block btn-lg" id="vqr-confirm-btn">
              <span>${escapeHtml(confirmLabel)}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          </div>` : ""}
        </div>
      </div>
    </div>`;

  const close = () => host.remove();
  host.querySelector("#vqr-close-x").addEventListener("click", close);
  host.addEventListener("click", (e) => {
    if (e.target === host) close();
  });

  host.querySelector("#vqr-copy-amount").addEventListener("click", () => copyToClipboard(String(order.total), "số tiền"));
  host.querySelector("#vqr-copy-acc").addEventListener("click", () => copyToClipboard(bank.accountNumber, "số tài khoản"));
  host.querySelector("#vqr-copy-memo").addEventListener("click", () => copyToClipboard(transferContent, "nội dung chuyển khoản"));

  const confirmBtn = host.querySelector("#vqr-confirm-btn");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", async () => {
      confirmBtn.disabled = true;
      try {
        await onConfirm(order);
        close();
      } catch (err) {
        toast(err.message, "error");
        confirmBtn.disabled = false;
      }
    });
  }

  document.body.appendChild(host);
  return host;
}

/* =========================================================
   VIETQR-SERVICE.JS - Tích hợp thanh toán Chuyển khoản VietQR (Napas 247)
   Chuẩn mã QR ngân hàng quốc gia có thể quét và chuyển khoản thực tế
   bằng bất kỳ ứng dụng Ngân hàng (MB, VCB, Techcombank, TPBank, BIDV,
   ACB, VPBank...) và ví điện tử (MoMo, ZaloPay...) tại Việt Nam.
   ========================================================= */

import { formatMoney, escapeHtml } from "./utils.js";
import { toast } from "./ui.js";

const STORAGE_KEY = "bar_bank_config";

/** Danh sách các ngân hàng phổ biến tại Việt Nam hỗ trợ chuẩn VietQR */
export const VIETNAM_BANKS = [
  { id: "MB", name: "MBBank — Ngân hàng Quân Đội", bin: "970422" },
  { id: "VCB", name: "Vietcombank — Ngân hàng Ngoại Thương", bin: "970436" },
  { id: "TCB", name: "Techcombank — Ngân hàng Kỹ Thương", bin: "970407" },
  { id: "ACB", name: "ACB — Ngân hàng Á Châu", bin: "970416" },
  { id: "TPB", name: "TPBank — Ngân hàng Tiên Phong", bin: "970423" },
  { id: "BIDV", name: "BIDV — Ngân hàng Đầu tư & Phát triển", bin: "970418" },
  { id: "ICB", name: "VietinBank — Ngân hàng Công Thương", bin: "970415" },
  { id: "VPB", name: "VPBank — Ngân hàng Việt Nam Thịnh Vượng", bin: "970432" },
  { id: "VIB", name: "VIB — Ngân hàng Quốc Tế", bin: "970441" },
  { id: "STB", name: "Sacombank — Ngân hàng Sài Gòn Thương Tín", bin: "970403" },
  { id: "HDB", name: "HDBank — Ngân hàng Phát triển TP.HCM", bin: "970437" },
  { id: "SHB", name: "SHB — Ngân hàng Sài Gòn - Hà Nội", bin: "970443" },
  { id: "OCB", name: "OCB — Ngân hàng Phương Đông", bin: "970448" },
  { id: "MSB", name: "MSB — Ngân hàng Hàng Hải", bin: "970426" },
  { id: "LPB", name: "LPBank — Ngân hàng Lộc Phát", bin: "970449" },
  { id: "SEAB", name: "SeABank — Ngân hàng Đông Nam Á", bin: "970440" },
];

/** Lấy cấu hình tài khoản quán bar (ưu tiên localStorage, có bản mặc định) */
export function getBankConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.bankId && parsed.accountNumber && parsed.accountName) {
        return parsed;
      }
    }
  } catch {
    // dùng mặc định
  }

  return {
    bankId: "MB",
    bankName: "MBBank — Ngân hàng Quân Đội",
    accountNumber: "0901234567",
    accountName: "QUAN BAR DEM",
  };
}

/** Lưu cấu hình tài khoản ngân hàng mới */
export function saveBankConfig(config) {
  const bank = VIETNAM_BANKS.find((b) => b.id === config.bankId);
  const data = {
    bankId: config.bankId || "MB",
    bankName: bank ? bank.name : config.bankId,
    accountNumber: String(config.accountNumber || "").trim(),
    accountName: String(config.accountName || "").trim().toUpperCase(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}

/**
 * Sinh URL ảnh mã QR theo chuẩn VietQR Napas 247
 * Quét bằng bất kỳ App ngân hàng nào cũng sẽ tự điền đầy đủ:
 * Ngân hàng, Số tài khoản, Tên thụ hưởng, Số tiền chuẩn xác và Nội dung đơn hàng.
 */
export function generateVietQRUrl({ amount, orderCode, memo = "" }) {
  const config = getBankConfig();
  const cleanAmount = Math.max(0, Math.round(Number(amount) || 0));
  const transferContent = encodeURIComponent(memo || `BAR ${orderCode}`.toUpperCase());
  const accName = encodeURIComponent(config.accountName.toUpperCase());

  // Template "compact2": Mẫu thẻ VietQR chuẩn quốc gia kèm khung Napas và thông tin chuyển khoản
  return `https://img.vietqr.io/image/${config.bankId}-${config.accountNumber}-compact2.png?amount=${cleanAmount}&addInfo=${transferContent}&accountName=${accName}`;
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

/**
 * Mở hộp thoại thanh toán VietQR chuyển khoản ngân hàng thực tế
 * @param {object} order Đơn hàng (id, code, name, total, items, ...)
 * @param {function} onConfirm Callback khi khách bấm "Tôi đã chuyển khoản"
 */
export function openVietQRPaymentModal(order, onConfirm) {
  let config = getBankConfig();
  const transferContent = `BAR ${order.code}`.toUpperCase();
  let qrUrl = generateVietQRUrl({ amount: order.total, orderCode: order.code, memo: transferContent });

  const host = document.createElement("div");
  host.className = "modal-overlay show vietqr-modal-overlay";
  host.id = "vietqr-payment-modal";

  function renderInner() {
    config = getBankConfig();
    qrUrl = generateVietQRUrl({ amount: order.total, orderCode: order.code, memo: transferContent });

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
              <img src="${qrUrl}" alt="Mã QR Chuyển khoản VietQR đơn hàng ${escapeHtml(order.code)}" class="vietqr-image" id="vqr-qr-img" loading="eager">
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

          <!-- Cột 2: Thông tin chuyển khoản chi tiết & cấu hình -->
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
                <span class="vqr-val font-semibold">${escapeHtml(config.bankName)}</span>
              </div>

              <div class="vqr-row">
                <span class="vqr-label">Số tài khoản</span>
                <div class="vqr-val-copy">
                  <strong class="vqr-val-highlight">${escapeHtml(config.accountNumber)}</strong>
                  <button type="button" class="btn-copy-icon" id="vqr-copy-acc" title="Sao chép số tài khoản">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  </button>
                </div>
              </div>

              <div class="vqr-row">
                <span class="vqr-label">Chủ tài khoản</span>
                <span class="vqr-val text-amber font-semibold">${escapeHtml(config.accountName)}</span>
              </div>

              <div class="vqr-row">
                <span class="vqr-label">Nội dung CK</span>
                <div class="vqr-val-copy">
                  <strong class="vqr-val-memo">${escapeHtml(transferContent)}</strong>
                  <button type="button" class="btn-copy-icon" id="vqr-copy-memo" title="Sao chép nội dung">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- Khung đổi tài khoản nhận tiền (cho phép test thực tế tài khoản của người dùng) -->
            <details class="vqr-config-toggle">
              <summary>
                <span>Tuỳ chỉnh tài khoản ngân hàng nhận tiền</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </summary>
              <form id="vqr-config-form" class="vqr-config-body">
                <div class="vqr-field">
                  <label>Chọn ngân hàng</label>
                  <select name="bankId" id="vqr-cfg-bank">
                    ${VIETNAM_BANKS.map((b) => `<option value="${b.id}" ${b.id === config.bankId ? "selected" : ""}>${b.name}</option>`).join("")}
                  </select>
                </div>
                <div class="vqr-field">
                  <label>Số tài khoản thụ hưởng</label>
                  <input type="text" name="accountNumber" id="vqr-cfg-acc" value="${escapeHtml(config.accountNumber)}" required placeholder="VD: 0987654321">
                </div>
                <div class="vqr-field">
                  <label>Tên chủ tài khoản (không dấu)</label>
                  <input type="text" name="accountName" id="vqr-cfg-name" value="${escapeHtml(config.accountName)}" required placeholder="VD: NGUYEN VAN A">
                </div>
                <button type="submit" class="btn btn-outline btn-sm btn-block">
                  Cập nhật mã QR sang tài khoản này
                </button>
              </form>
            </details>

            <div class="vietqr-footer-actions">
              <button type="button" class="btn btn-primary btn-block btn-lg" id="vqr-confirm-btn">
                <span>Tôi Đã Chuyển Khoản Xong</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>`;

    attachEvents();
  }

  function attachEvents() {
    const close = () => host.remove();
    host.querySelector("#vqr-close-x")?.addEventListener("click", close);
    host.addEventListener("click", (e) => {
      if (e.target === host) close();
    });

    // Copy buttons
    host.querySelector("#vqr-copy-amount")?.addEventListener("click", () => {
      copyToClipboard(String(order.total), "số tiền");
    });
    host.querySelector("#vqr-copy-acc")?.addEventListener("click", () => {
      copyToClipboard(config.accountNumber, "số tài khoản");
    });
    host.querySelector("#vqr-copy-memo")?.addEventListener("click", () => {
      copyToClipboard(transferContent, "nội dung chuyển khoản");
    });

    // Cấu hình tài khoản
    const cfgForm = host.querySelector("#vqr-config-form");
    if (cfgForm) {
      cfgForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const bId = cfgForm.elements.bankId.value;
        const acc = cfgForm.elements.accountNumber.value;
        const name = cfgForm.elements.accountName.value;
        saveBankConfig({ bankId: bId, accountNumber: acc, accountName: name });
        toast("Đã cập nhật mã QR sang tài khoản mới!", "success");
        renderInner();
      });
    }

    // Nút xác nhận thanh toán
    host.querySelector("#vqr-confirm-btn")?.addEventListener("click", () => {
      toast(`Cảm ơn bạn! Quán Bar Đêm đã ghi nhận thanh toán cho đơn ${order.code}.`, "success");
      if (typeof onConfirm === "function") {
        onConfirm(order);
      }
      close();
    });
  }

  document.body.appendChild(host);
  renderInner();
  return host;
}

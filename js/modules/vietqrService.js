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
export async function openVietQRPaymentModal(order, { confirmLabel = "Tôi Đã Chuyển Khoản Xong", onConfirm, allItems = null } = {}) {
  let bank;
  try {
    bank = await getBankSettings();
  } catch (err) {
    toast(err.message, "error");
    return null;
  }

  // Chuẩn bị danh sách món: ưu tiên allItems nếu có, nếu không lấy từ order.items
  const rawItems = Array.isArray(allItems) && allItems.length > 0
    ? allItems
    : (Array.isArray(order?.items) ? order.items : []);

  const items = rawItems.map((it) => {
    const qty = Number(it.qty) || 1;
    const price = Number(it.price) || 0;
    const finalPrice = it.finalPrice !== undefined ? Number(it.finalPrice) : (price * qty);
    return {
      id: it.id || it.drinkId || it.name,
      drinkId: it.drinkId || it.id,
      name: it.name || "Đồ uống",
      qty,
      price,
      finalPrice,
      image: it.image || "",
      isUnpaid: Boolean(it.isUnpaid),
      orderCode: it.orderCode || (it.isUnpaid ? order?.code : "") || "",
      orderId: it.orderId || (it.isUnpaid ? order?.id : "") || "",
      sourceTag: it.sourceTag || (it.isUnpaid ? `Đơn cũ ${it.orderCode || order?.code}` : "Món mới chọn"),
      checked: it.checked !== false,
    };
  });

  const calcTotal = () => {
    if (items.length === 0) return Number(order?.total) || 0;
    return items.filter((it) => it.checked).reduce((sum, it) => sum + it.finalPrice, 0);
  };

  let currentTotal = calcTotal();
  const transferContent = `BAR ${order?.code || "ORDER"}`.toUpperCase();
  const qrUrl = generateVietQRUrl(bank, { amount: currentTotal, memo: transferContent });

  const host = document.createElement("div");
  host.className = "modal-overlay show vietqr-modal-overlay";
  host.id = "vietqr-payment-modal";
  host.innerHTML = `
    <div class="modal-box modal-vietqr" role="dialog" aria-modal="true">
      <div class="vietqr-head">
        <div class="vietqr-head-brand">
          <span class="vietqr-badge">MBBANK · NGÂN HÀNG QUÂN ĐỘI</span>
          <h3 class="vietqr-title">Thanh Toán Chuyển Khoản MBBank</h3>
          <p class="vietqr-sub">Mở App MBBank hoặc bất kỳ ứng dụng ngân hàng / ví điện tử để quét mã MB</p>
        </div>
        <button type="button" class="modal-close-x" id="vqr-close-x" aria-label="Đóng">&times;</button>
      </div>

      <div class="vietqr-body-grid">
        <!-- Cột 1: Thẻ hiển thị mã QR MBBank -->
        <div class="vietqr-qr-panel">
          <div class="vietqr-img-frame">
            <img src="img/mb-qr.jpg" alt="Mã QR MBBank đơn hàng ${escapeHtml(order?.code || '')}" class="vietqr-image" loading="eager" onerror="this.onerror=null;this.src='${qrUrl}';">
            <div class="vietqr-scan-line"></div>
          </div>

          <div class="vietqr-qr-actions">
            <a href="img/mb-qr.jpg" download="MBBank_QR_${escapeHtml(order?.code || 'ORDER')}.jpg" target="_blank" class="btn btn-outline btn-sm btn-block" title="Lưu mã QR MBBank về điện thoại hoặc máy tính">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              <span>Tải Mã QR MB Về Máy</span>
            </a>
          </div>

          <div class="vietqr-security-note">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span>Tài khoản MBBank chính thức của quán: Lê Thành Tài</span>
          </div>
        </div>

        <!-- Cột 2: Thông tin chuyển khoản chi tiết -->
        <div class="vietqr-info-panel">
          <div class="vietqr-amount-banner">
            <span class="vqr-amount-label">Số tiền cần thanh toán</span>
            <strong class="vqr-amount-value" id="vqr-amount-val">${formatMoney(currentTotal)}</strong>
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

          <!-- MỤC TÍCH CHỌN NHỮNG MÓN THANH TOÁN (CÓ Ô CHECKBOX CHỌN MÓN ĐỂ THANH TOÁN) -->
          ${items.length > 0 ? `
          <div class="vqr-checklist-box" style="margin-top: 10px; padding: 12px; background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: var(--radius-sm);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 0.78rem; color: var(--gold-primary); font-weight: 600; cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px;">
                <input type="checkbox" id="vqr-toggle-all" checked style="accent-color: var(--gold-primary); width: 16px; height: 16px; cursor: pointer;">
                <span>Tích chọn món thanh toán (<span id="vqr-sel-count">${items.length}</span>/${items.length})</span>
              </label>
              <span class="text-xs text-muted" style="font-size: 0.72rem;">Bỏ tích món chưa muốn trả</span>
            </div>

            <div class="vqr-items-scroll-list" style="display: flex; flex-direction: column; gap: 6px; max-height: 160px; overflow-y: auto; padding-right: 4px;">
              ${items.map((it, idx) => `
                <label class="vqr-item-row" style="display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 7px 10px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 6px; cursor: pointer; transition: background 0.15s;">
                  <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
                    <input type="checkbox" class="vqr-item-cb" data-index="${idx}" ${it.checked ? "checked" : ""} style="accent-color: var(--gold-primary); width: 16px; height: 16px; cursor: pointer; flex-shrink: 0;">
                    <div style="min-width: 0; flex: 1;">
                      <div style="font-size: 0.82rem; font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(it.name)}">
                        ${escapeHtml(it.name)} <strong style="color: var(--amber-soft);">x${it.qty || 1}</strong>
                      </div>
                      <div style="font-size: 0.7rem; color: var(--muted); display: flex; align-items: center; gap: 6px; margin-top: 1px;">
                        <span class="badge ${it.isUnpaid ? "badge-danger" : "badge-warning"}" style="font-size: 0.62rem; padding: 1px 5px;">
                          ${escapeHtml(it.sourceTag)}
                        </span>
                        <span>${formatMoney(it.finalPrice / (it.qty || 1))}</span>
                      </div>
                    </div>
                  </div>
                  <div style="text-align: right; white-space: nowrap;">
                    <strong class="text-amber" style="font-size: 0.84rem;">${formatMoney(it.finalPrice)}</strong>
                  </div>
                </label>
              `).join("")}
            </div>
          </div>` : ""}

          ${onConfirm ? `
          <div class="vietqr-footer-actions">
            <button type="button" class="btn btn-primary btn-block btn-lg" id="vqr-confirm-btn">
              <span>${escapeHtml(confirmLabel)} (${formatMoney(currentTotal)})</span>
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

  const checkboxes = host.querySelectorAll(".vqr-item-cb");
  const toggleAll = host.querySelector("#vqr-toggle-all");
  const amountVal = host.querySelector("#vqr-amount-val");
  const selCount = host.querySelector("#vqr-sel-count");
  const confirmBtn = host.querySelector("#vqr-confirm-btn");
  const copyAmountBtn = host.querySelector("#vqr-copy-amount");

  const syncCheckState = () => {
    let sum = 0;
    let count = 0;
    checkboxes.forEach((cb, idx) => {
      items[idx].checked = cb.checked;
      if (cb.checked) {
        count++;
        sum += items[idx].finalPrice;
      }
    });

    currentTotal = sum;
    if (amountVal) amountVal.textContent = formatMoney(sum);
    if (selCount) selCount.textContent = count;
    if (toggleAll) toggleAll.checked = count === items.length && items.length > 0;

    if (confirmBtn) {
      if (sum <= 0) {
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = "0.5";
        confirmBtn.querySelector("span").textContent = "Vui lòng tích chọn món cần thanh toán";
      } else {
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = "1";
        confirmBtn.querySelector("span").textContent = `${escapeHtml(confirmLabel)} (${formatMoney(sum)})`;
      }
    }
  };

  checkboxes.forEach((cb) => cb.addEventListener("change", syncCheckState));
  if (toggleAll) {
    toggleAll.addEventListener("change", () => {
      checkboxes.forEach((cb) => { cb.checked = toggleAll.checked; });
      syncCheckState();
    });
  }

  if (copyAmountBtn) {
    copyAmountBtn.addEventListener("click", () => copyToClipboard(String(currentTotal), "số tiền"));
  }
  host.querySelector("#vqr-copy-acc").addEventListener("click", () => copyToClipboard(bank.accountNumber, "số tài khoản"));
  host.querySelector("#vqr-copy-memo").addEventListener("click", () => copyToClipboard(transferContent, "nội dung chuyển khoản"));

  if (confirmBtn) {
    confirmBtn.addEventListener("click", async () => {
      const selectedItems = items.filter((it) => it.checked);
      if (items.length > 0 && selectedItems.length === 0) {
        toast("Vui lòng tích chọn ít nhất 1 món để thanh toán.", "warning");
        return;
      }
      confirmBtn.disabled = true;
      try {
        if (onConfirm) {
          await onConfirm({
            order,
            selectedItems,
            totalPaid: currentTotal,
            hasUnpaidSelected: selectedItems.some((it) => it.isUnpaid),
            hasCartSelected: selectedItems.some((it) => !it.isUnpaid),
          });
        }
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

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
import { getBankSettings, DEFAULT_SETTINGS } from "./settingsService.js";

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

/** Nội dung chuyển khoản tối đa 25 ký tự (giới hạn của VietQR/Napas 247 - dài hơn app ngân hàng sẽ cắt hoặc từ chối) */
export const MAX_QR_MEMO = 25;

/**
 * Nội dung chuyển khoản "BAR DH0016". Gộp nhiều đơn mà quá 25 ký tự thì rút gọn "BAR DH0016+2"
 * (thu ngân đối chiếu theo mã đơn đầu + tổng tiền).
 */
export function buildTransferMemo(codes, fallbackCode = "ORDER") {
  const list = (codes || []).filter(Boolean);
  if (list.length === 0) return `BAR ${fallbackCode}`.toUpperCase().slice(0, MAX_QR_MEMO);
  const full = `BAR ${list.join(" ")}`.toUpperCase();
  if (full.length <= MAX_QR_MEMO) return full;
  return `BAR ${list[0]}+${list.length - 1}`.toUpperCase().slice(0, MAX_QR_MEMO);
}

/**
 * Chia tổng tiền thật của một đơn (đã trừ giảm giá/điểm) xuống từng món sao cho TỔNG CÁC MÓN = ĐÚNG tổng đơn,
 * không lệch vài đồng do làm tròn (phương pháp phần dư lớn nhất). Dùng để hiển thị và để tính số tiền trên mã QR.
 * @param {Array<{price:number, qty:number}>} items
 * @param {number} orderTotal
 * @returns {number[]} tiền từng món
 */
export function allocateOrderTotal(items, orderTotal) {
  const listed = (items || []).map((it) => (Number(it.price) || 0) * (Number(it.qty) || 1));
  const listedSum = listed.reduce((a, b) => a + b, 0);
  const total = Math.round(Number(orderTotal) || 0);
  if (listed.length === 0) return [];
  if (!listedSum || total <= 0) return listed.map(() => 0);
  if (total === listedSum) return listed;
  const exact = listed.map((v) => (v * total) / listedSum);
  const floors = exact.map(Math.floor);
  let remainder = total - floors.reduce((a, b) => a + b, 0);
  const byFraction = exact.map((v, i) => [v - floors[i], i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; remainder > 0 && k < byFraction.length; k += 1, remainder -= 1) floors[byFraction[k][1]] += 1;
  return floors;
}

/**
 * Mở hộp thoại thanh toán VietQR.
 * Số tiền trên mã QR = TỔNG TIỀN THẬT của các ĐƠN đã lưu đang được tích chọn (đã trừ giảm giá/điểm),
 * nên khách quét là ra đúng số tiền, không phải gõ tay và không chuyển nhầm.
 * Ảnh QR cố định của quán (img/mb-qr.jpg) chỉ là DỰ PHÒNG khi mất mạng (vì một ảnh cố định không chứa được số tiền).
 * @param {object} order Đơn hàng (code, total, paymentStatus...)
 * @param {object} [options]
 * @param {string} [options.confirmLabel] Chữ trên nút xác nhận
 * @param {function} [options.onConfirm] async (order) => {...} chạy khi bấm nút xác nhận.
 *   Không truyền onConfirm thì KHÔNG vẽ nút (tránh nút bấm không có chức năng).
 * @param {Array} [options.allItems] Món của NHIỀU đơn đã lưu (gộp thanh toán): mỗi món có orderId/orderCode
 *   và finalPrice đã chia đúng theo tổng đơn (xem allocateOrderTotal).
 */
export async function openVietQRPaymentModal(order, { confirmLabel = "Tôi Đã Chuyển Khoản Xong", onConfirm, allItems = null } = {}) {
  let bank;
  try {
    bank = await getBankSettings();
  } catch (err) {
    toast(err.message, "error");
    return null;
  }

  const hasMultiOrderItems = Array.isArray(allItems) && allItems.length > 0;
  const rawItems = hasMultiOrderItems ? allItems : (Array.isArray(order?.items) ? order.items : []);

  // Không truyền allItems = thanh toán CHÍNH đơn này: món của nó là món của đơn đã lưu (không phải món trong giỏ),
  // tiền từng món chia đúng theo order.total (đã trừ giảm giá/điểm) để tổng khớp từng đồng.
  const singleOrderPrices = hasMultiOrderItems ? null : allocateOrderTotal(rawItems, order?.total);
  const items = rawItems.map((it, idx) => {
    const qty = Number(it.qty) || 1;
    const price = Number(it.price) || 0;
    const belongsToOrder = !hasMultiOrderItems && Boolean(order?.id);
    const isUnpaidItem = belongsToOrder || Boolean(it.isUnpaid);
    return {
      id: it.id || it.drinkId || it.name,
      drinkId: it.drinkId || it.id,
      name: it.name || "Đồ uống",
      qty,
      price,
      finalPrice: singleOrderPrices ? singleOrderPrices[idx] : (it.finalPrice !== undefined ? Number(it.finalPrice) : price * qty),
      image: it.image || "",
      isUnpaid: isUnpaidItem,
      orderCode: it.orderCode || (isUnpaidItem ? order?.code : "") || "",
      orderId: it.orderId || (isUnpaidItem ? order?.id : "") || "",
      sourceTag: it.sourceTag || (isUnpaidItem ? `Đơn ${it.orderCode || order?.code}` : "Món mới chọn"),
      checked: it.checked !== false,
    };
  });

  const calcTotal = () => {
    if (items.length === 0) return Math.round(Number(order?.total) || 0);
    return items.filter((it) => it.checked).reduce((sum, it) => sum + it.finalPrice, 0);
  };
  const selectedCodes = () => [...new Set(items.filter((it) => it.checked && it.orderCode).map((it) => it.orderCode))];
  const currentMemo = () => buildTransferMemo(items.length === 0 ? [order?.code] : selectedCodes(), order?.code || "ORDER");
  // Ảnh QR cố định của quán chỉ dùng được khi nó đúng tài khoản đang cài đặt (đổi tài khoản mà vẫn hiện ảnh cũ là khách chuyển nhầm)
  const staticQrMatchesBank = bank.accountNumber === DEFAULT_SETTINGS.accountNumber && bank.bankId === DEFAULT_SETTINGS.bankId;

  let currentTotal = calcTotal();
  let transferContent = currentMemo();
  let qrUrl = generateVietQRUrl(bank, { amount: currentTotal, memo: transferContent });

  const host = document.createElement("div");
  host.className = "modal-overlay show vietqr-modal-overlay";
  host.id = "vietqr-payment-modal";
  host.innerHTML = `
    <div class="modal-box modal-vietqr" role="dialog" aria-modal="true">
      <div class="vietqr-head">
        <div class="vietqr-head-brand">
          <span class="vietqr-badge">${escapeHtml(String(bank.bankName || "").toUpperCase())}</span>
          <h3 class="vietqr-title">Thanh Toán Chuyển Khoản</h3>
          <p class="vietqr-sub">Mở app ngân hàng hoặc ví điện tử để quét mã - số tiền và nội dung được điền sẵn</p>
        </div>
        <button type="button" class="modal-close-x" id="vqr-close-x" aria-label="Đóng">&times;</button>
      </div>

      <div class="vietqr-body-grid">
        <!-- Cột 1: mã QR ĐỘNG theo đúng số tiền + nội dung của đơn -->
        <div class="vietqr-qr-panel">
          <div class="vietqr-img-frame">
            <img id="vqr-img" src="${escapeHtml(qrUrl)}" alt="Mã QR chuyển khoản đơn ${escapeHtml(order?.code || '')}" class="vietqr-image" loading="eager">
            <div class="vietqr-scan-line"></div>
          </div>
          <p id="vqr-qr-note" class="text-xs" style="margin: 8px 0 0; text-align: center; color: var(--amber-soft);"></p>

          <div class="vietqr-qr-actions">
            <a href="${escapeHtml(qrUrl)}" id="vqr-download" download="QR_${escapeHtml(order?.code || 'ORDER')}.png" target="_blank" rel="noopener" class="btn btn-outline btn-sm btn-block" title="Lưu mã QR về điện thoại hoặc máy tính">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              <span>Tải mã QR về máy</span>
            </a>
          </div>

          <div class="vietqr-security-note">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span>Tài khoản chính thức của quán: ${escapeHtml(bank.accountName)}</span>
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
                <strong class="vqr-val-memo" id="vqr-memo-val">${escapeHtml(transferContent)}</strong>
                <button type="button" class="btn-copy-icon" id="vqr-copy-memo" title="Sao chép nội dung">${COPY_ICON}</button>
              </div>
            </div>
          </div>

          <!-- Chọn ĐƠN muốn thanh toán (các món cùng một đơn luôn được chọn / bỏ chọn cùng nhau vì không trả một phần đơn) -->
          ${items.length > 0 ? `
          <div class="vqr-checklist-box" style="margin-top: 10px; padding: 12px; background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: var(--radius-sm);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 0.78rem; color: var(--gold-primary); font-weight: 600; cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px;">
                <input type="checkbox" id="vqr-toggle-all" checked style="accent-color: var(--gold-primary); width: 16px; height: 16px; cursor: pointer;">
                <span>Tích chọn món thanh toán (<span id="vqr-sel-count">${items.length}</span>/${items.length})</span>
              </label>
              <span class="text-xs text-muted" style="font-size: 0.72rem;">Món cùng đơn được chọn chung</span>
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
  const memoVal = host.querySelector("#vqr-memo-val");
  const selCount = host.querySelector("#vqr-sel-count");
  const confirmBtn = host.querySelector("#vqr-confirm-btn");
  const copyAmountBtn = host.querySelector("#vqr-copy-amount");
  const qrImg = host.querySelector("#vqr-img");
  const qrNote = host.querySelector("#vqr-qr-note");
  const downloadLink = host.querySelector("#vqr-download");

  /** Ghi chú dưới mã QR theo chế độ đang hiển thị */
  let qrMode = "dynamic"; // dynamic | static | none
  const renderQrNote = () => {
    if (currentTotal <= 0) { qrNote.textContent = "Chưa chọn đơn nào để thanh toán."; return; }
    if (qrMode === "dynamic") qrNote.textContent = `Quét mã sẽ tự điền ${formatMoney(currentTotal)} và nội dung ${transferContent}.`;
    else if (qrMode === "static") qrNote.textContent = `Mã QR cố định (không kèm số tiền): hãy nhập đúng ${formatMoney(currentTotal)} và nội dung ${transferContent}.`;
    else qrNote.textContent = "Không tải được mã QR (cần kết nối Internet). Vui lòng chuyển khoản thủ công theo thông tin bên cạnh.";
  };

  /** Mã QR động không tải được (mất mạng): dùng ảnh QR của quán CHỈ KHI nó đúng tài khoản đang cài đặt; không thì ẩn đi */
  qrImg.addEventListener("error", () => {
    if (qrMode === "dynamic" && staticQrMatchesBank) {
      qrMode = "static";
      qrImg.src = "img/mb-qr.jpg";
      downloadLink.href = "img/mb-qr.jpg";
    } else if (qrMode !== "none") {
      qrMode = "none";
      qrImg.style.visibility = "hidden";
    }
    renderQrNote();
  });

  /** Vẽ lại mã QR + nội dung + số tiền theo các đơn đang được chọn */
  const refreshQr = () => {
    transferContent = currentMemo();
    qrUrl = generateVietQRUrl(bank, { amount: currentTotal, memo: transferContent });
    if (memoVal) memoVal.textContent = transferContent;
    const changed = qrMode !== "dynamic" || qrImg.getAttribute("src") !== qrUrl;
    qrMode = "dynamic";
    qrImg.style.visibility = "";
    if (changed) qrImg.src = qrUrl;
    downloadLink.href = qrUrl;
    renderQrNote();
  };

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
        confirmBtn.querySelector("span").textContent = `${confirmLabel} (${formatMoney(sum)})`;
      }
    }
    refreshQr();
  };

  checkboxes.forEach((cb, idx) => cb.addEventListener("change", () => {
    // Một đơn không trả được một phần: tích / bỏ một món thì cả đơn đó đổi theo
    const groupId = items[idx].orderId;
    if (groupId) checkboxes.forEach((other, j) => { if (items[j].orderId === groupId) other.checked = cb.checked; });
    syncCheckState();
  }));
  if (toggleAll) {
    toggleAll.addEventListener("change", () => {
      checkboxes.forEach((cb) => { cb.checked = toggleAll.checked; });
      syncCheckState();
    });
  }
  syncCheckState();

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

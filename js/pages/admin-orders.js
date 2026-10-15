/* =========================================================
   ADMIN-ORDERS.JS - Quản lý đơn hàng: xem, đổi trạng thái, xoá
   Đọc GET /orders, đổi trạng thái PATCH /orders/:id, xoá DELETE.
   Đổi trạng thái sang "Đã huỷ" hoặc xoá đơn chưa phục vụ sẽ tự
   hoàn lại tồn kho các món + trả lại lượt dùng mã giảm giá (xử lý
   trong ordersService.js).
   Đơn có dùng mã: bảng hiện nhãn mã nhỏ cạnh tổng tiền, chi tiết đơn
   tách Tạm tính / Tiết kiệm từ sale món / Giảm giá (mã) / Tổng. Đơn cũ
   (trước khi có khuyến mãi) không có các trường mới vẫn hiển thị đúng.
   ========================================================= */

import { initAdminLayout } from "../modules/adminLayout.js";
import {
  getAllOrders, filterOrders, updateOrderStatus, deleteOrder,
  ORDER_STATUS,
} from "../modules/ordersService.js";
import { formatMoney, formatDateTime, debounce, paginate, renderPagination, classNames, escapeHtml } from "../modules/utils.js";
import { toast, confirmDialog, openModal, closeModal, setButtonLoading } from "../modules/ui.js";
import { ICONS } from "../modules/icons.js";
import { openVietQRPaymentModal } from "../modules/vietqrService.js";

const bodyEl = document.getElementById("orders-body");
const paginationEl = document.getElementById("pagination");
const keywordInput = document.getElementById("f-keyword");
const statusSelect = document.getElementById("f-status");
const sortSelect = document.getElementById("f-sort");

const modalBody = document.getElementById("order-modal-body");
const modalTitle = document.getElementById("order-modal-title");
const statusPicker = document.getElementById("order-status-select");
const saveStatusBtn = document.getElementById("order-save-status-btn");
const deleteBtn = document.getElementById("order-delete-btn");

let allOrders = [];
let currentPage = 1;
let activeOrder = null;

/** Biểu tượng vé nhỏ đánh dấu đơn có dùng mã giảm giá */
const TICKET_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6z"/><path d="M14 5v2m0 4v2m0 4v2"/></svg>`;

/** Một dòng "nhãn - giá trị" trong modal chi tiết */
const detailRow = (label, value, cls = "") => `
  <div class="order-detail-row ${cls}"><span>${label}</span><strong>${value}</strong></div>`;

/**
 * Phần tiền của đơn: chỉ hiện các dòng có ý nghĩa với đơn đó.
 * Đơn cũ không có originalPrice / discount -> chỉ còn dòng Tạm tính + Tổng.
 */
function moneyBreakdownHtml(order) {
  const rows = [];
  if (order.productSavings > 0) {
    rows.push(detailRow("Tạm tính theo giá gốc", formatMoney(order.originalSubtotal)));
    rows.push(detailRow("Tiết kiệm từ sale món", `−${formatMoney(order.productSavings)}`, "is-saving"));
  }
  rows.push(detailRow("Tạm tính", formatMoney(order.subtotal)));
  if (order.voucherCode || order.discount > 0) {
    rows.push(detailRow(
      `Giảm giá <span class="summary-code">${escapeHtml(order.voucherCode || "—")}</span>`,
      `−${formatMoney(order.discount)}`,
      "is-discount",
    ));
  }
  return rows.join("");
}

/** Giá một món trong đơn: món đang sale lúc đặt thì hiện giá gốc gạch ngang */
function itemPriceHtml(item) {
  const lineTotal = formatMoney(item.price * item.qty);
  const original = Number(item.originalPrice) || 0;
  if (original <= item.price) return `<strong>${lineTotal}</strong>`;
  return `<span class="order-item-price">
      <span class="cart-price-old">${formatMoney(original * item.qty)}</span>
      <strong>${lineTotal}</strong>
    </span>`;
}

function rowHtml(o) {
  return `
    <tr data-id="${escapeHtml(o.id)}">
      <td><strong class="text-amber">${escapeHtml(o.code)}</strong></td>
      <td><strong>${escapeHtml(o.name)}</strong></td>
      <td><span class="text-muted text-sm">${escapeHtml(o.phone)}</span></td>
      <td><span class="text-sm">${o.serviceLabel}</span></td>
      <td>
        <strong>${formatMoney(o.total)}</strong>
        ${o.voucherCode ? `
          <span class="order-voucher-tag" title="Đã áp dụng mã ${escapeHtml(o.voucherCode)}: giảm ${formatMoney(o.discount)}">
            ${TICKET_ICON}<span>${escapeHtml(o.voucherCode)}</span>
          </span>` : ""}
      </td>
      <td><span class="${classNames("badge", o.statusBadge)}">${o.statusLabel}</span></td>
      <td class="text-muted text-sm">${formatDateTime(o.createdAt)}</td>
      <td class="cell-actions" style="text-align: right;">
        <button type="button" class="btn btn-ghost btn-sm" data-action="view">
          ${ICONS.receipt(14)} Chi tiết
        </button>
      </td>
    </tr>`;
}

function renderTable() {
  const list = filterOrders(allOrders, {
    keyword: keywordInput.value,
    status: statusSelect.value,
    sortBy: sortSelect.value,
  });
  const { items, page, totalPages } = paginate(list, currentPage, 8);
  currentPage = page;

  bodyEl.innerHTML = items.length
    ? items.map(rowHtml).join("")
    : `<tr><td colspan="8" class="table-empty py-4 text-center text-muted">
        ${allOrders.length ? "Không có đơn hàng phù hợp với bộ lọc." : "Chưa có đơn hàng nào."}
       </td></tr>`;

  renderPagination(paginationEl, page, totalPages, (p) => { currentPage = p; renderTable(); });
}

async function reloadTable() {
  try {
    allOrders = await getAllOrders();
    renderTable();
  } catch (err) {
    bodyEl.innerHTML = `<tr><td colspan="8" class="table-empty py-4 text-center text-muted">${escapeHtml(err.message)}</td></tr>`;
  }
}

/* ---------------- Modal chi tiết ---------------- */
function openDetail(order) {
  activeOrder = order;
  modalTitle.textContent = `Phiếu Đặt #${order.code}`;
  statusPicker.value = order.status;

  const itemsHtml = order.items.map((item) => `
    <div class="order-detail-row item-row">
      <span>${escapeHtml(item.name)} <span class="text-muted">× ${item.qty}</span></span>
      ${itemPriceHtml(item)}
    </div>`).join("");

  modalBody.innerHTML = `
    <div class="order-detail-row"><span>Tên khách hàng</span><strong>${escapeHtml(order.name)}</strong></div>
    <div class="order-detail-row"><span>Số điện thoại</span><strong>${escapeHtml(order.phone)}</strong></div>
    ${order.email ? `<div class="order-detail-row"><span>Email</span><strong>${escapeHtml(order.email)}</strong></div>` : ""}
    <div class="order-detail-row"><span>Hình thức</span><strong>${order.serviceLabel}</strong></div>
    ${order.serviceDetails().map(([label, value]) => `
      <div class="order-detail-row"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
    ${order.customerId ? detailRow("Tài khoản thành viên", `<span class="member-id-chip">${escapeHtml(order.customerId)}</span>`) : ""}
    ${order.note ? `<div class="order-detail-row"><span>Ghi chú pha chế</span><span class="note-box">${escapeHtml(order.note)}</span></div>` : ""}

    <div class="order-detail-items mt-3">
      <p class="text-muted text-xs uppercase font-bold mb-2">Thực đơn yêu cầu:</p>
      ${itemsHtml}
    </div>
    <div class="order-money-breakdown mt-3">
      ${moneyBreakdownHtml(order)}
    </div>
    <div class="order-detail-row total-row mt-3">
      <span class="font-bold">Tổng thanh toán</span>
      <strong class="text-amber text-lg">${formatMoney(order.total)}</strong>
    </div>`;

  openModal("order-modal");
}

bodyEl.addEventListener("click", (e) => {
  const btn = e.target.closest('button[data-action="view"]');
  if (!btn) return;
  const order = allOrders.find((o) => o.id === btn.closest("tr").dataset.id);
  if (order) openDetail(order);
});

async function handleSaveStatus() {
  if (!activeOrder) return;
  const newStatus = statusPicker.value;
  if (newStatus === activeOrder.status) {
    closeModal("order-modal");
    return;
  }

  // Huỷ đơn là thao tác quan trọng -> hỏi lại trước
  if (newStatus === "cancelled") {
    const ok = await confirmDialog(`Bạn có chắc chắn muốn huỷ đơn ${activeOrder.code}?`, {
      title: "Xác nhận huỷ đơn",
      okText: "Huỷ đơn",
    });
    if (!ok) return;
  }

  const restoreButton = setButtonLoading(saveStatusBtn, "Đang lưu...");
  try {
    await updateOrderStatus(activeOrder.id, newStatus);
    // Nhắc admin biết lượt dùng mã cũng được hoàn / trừ theo trạng thái
    let voucherNote = "";
    if (activeOrder.voucherCode && newStatus === "cancelled") voucherNote = ` Đã hoàn 1 lượt dùng mã ${activeOrder.voucherCode}.`;
    else if (activeOrder.voucherCode && activeOrder.status === "cancelled") voucherNote = ` Đã trừ lại 1 lượt dùng mã ${activeOrder.voucherCode}.`;
    toast(`Đơn ${activeOrder.code}: "${ORDER_STATUS[newStatus]}".${voucherNote}`, "success");
    closeModal("order-modal");
    await reloadTable();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    restoreButton();
  }
}

async function handleDelete() {
  if (!activeOrder) return;
  const ok = await confirmDialog(
    `Xoá vĩnh viễn đơn ${activeOrder.code}? Thao tác này không thể hoàn tác.`,
    { title: "Xác nhận xoá đơn", okText: "Xoá vĩnh viễn" },
  );
  if (!ok) return;

  const restoreButton = setButtonLoading(deleteBtn, "Đang xoá...");
  try {
    await deleteOrder(activeOrder.id);
    const released = activeOrder.voucherCode && activeOrder.holdsStock
      ? ` Đã hoàn 1 lượt dùng mã ${activeOrder.voucherCode}.` : "";
    toast(`Đã xoá đơn ${activeOrder.code}.${released}`, "success");
    closeModal("order-modal");
    await reloadTable();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    restoreButton();
  }
}

function bindEvents() {
  const debouncedRender = debounce(() => { currentPage = 1; renderTable(); }, 250);
  keywordInput.addEventListener("input", debouncedRender);
  [statusSelect, sortSelect].forEach((el) => el.addEventListener("change", () => { currentPage = 1; renderTable(); }));

  document.getElementById("order-modal-close").addEventListener("click", () => closeModal("order-modal"));
  document.getElementById("order-vietqr-btn")?.addEventListener("click", () => {
    if (activeOrder) openVietQRPaymentModal(activeOrder);
  });
  saveStatusBtn.addEventListener("click", handleSaveStatus);
  deleteBtn.addEventListener("click", handleDelete);
}

if (initAdminLayout("Quản Lý Đơn Hàng")) {
  bindEvents();
  bodyEl.innerHTML = `<tr><td colspan="8" class="table-empty py-4 text-center text-muted">Đang tải đơn hàng...</td></tr>`;
  reloadTable();
}

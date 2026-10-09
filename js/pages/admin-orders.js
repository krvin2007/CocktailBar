/* =========================================================
   ADMIN-ORDERS.JS - Quản lý đơn hàng: xem, đổi trạng thái, xoá
   Đọc GET /orders, đổi trạng thái PATCH /orders/:id, xoá DELETE.
   Đổi trạng thái sang "Đã huỷ" hoặc xoá đơn chưa phục vụ sẽ tự
   hoàn lại tồn kho các món (xử lý trong ordersService.js).
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

function rowHtml(o) {
  return `
    <tr data-id="${escapeHtml(o.id)}">
      <td><strong class="text-amber">${escapeHtml(o.code)}</strong></td>
      <td><strong>${escapeHtml(o.name)}</strong></td>
      <td><span class="text-muted text-sm">${escapeHtml(o.phone)}</span></td>
      <td><span class="text-sm">${o.serviceLabel}</span></td>
      <td><strong>${formatMoney(o.total)}</strong></td>
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
      <strong>${formatMoney(item.price * item.qty)}</strong>
    </div>`).join("");

  modalBody.innerHTML = `
    <div class="order-detail-row"><span>Tên khách hàng</span><strong>${escapeHtml(order.name)}</strong></div>
    <div class="order-detail-row"><span>Số điện thoại</span><strong>${escapeHtml(order.phone)}</strong></div>
    ${order.email ? `<div class="order-detail-row"><span>Email</span><strong>${escapeHtml(order.email)}</strong></div>` : ""}
    <div class="order-detail-row"><span>Hình thức</span><strong>${order.serviceLabel}</strong></div>
    ${order.serviceDetails().map(([label, value]) => `
      <div class="order-detail-row"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
    ${order.note ? `<div class="order-detail-row"><span>Ghi chú pha chế</span><span class="note-box">${escapeHtml(order.note)}</span></div>` : ""}

    <div class="order-detail-items mt-3">
      <p class="text-muted text-xs uppercase font-bold mb-2">Thực đơn yêu cầu:</p>
      ${itemsHtml}
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
    toast(`Đơn ${activeOrder.code}: "${ORDER_STATUS[newStatus]}".`, "success");
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
    toast(`Đã xoá đơn ${activeOrder.code}.`, "success");
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

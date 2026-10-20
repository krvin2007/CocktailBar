/* =========================================================
   ADMIN-ORDERS.JS - Quản lý đơn hàng: xem, đổi trạng thái, xoá
   Đọc GET /orders, đổi trạng thái PATCH /orders/:id, xoá DELETE.
   Đổi trạng thái sang "Đã huỷ" hoặc xoá đơn chưa phục vụ sẽ tự
   hoàn lại tồn kho các món (xử lý trong ordersService.js).
   Thanh toán: thu ngân xác nhận "đã thu tiền"; quản lý cấu hình
   tài khoản ngân hàng nhận tiền (PATCH /settings).
   ========================================================= */

import { initAdminLayout } from "../modules/adminLayout.js";
import { can, currentAdmin } from "../modules/auth.js";
import {
  getAllOrders, filterOrders, updateOrderStatus, deleteOrder, confirmPayment,
  verifyOrderDoorCheck, ORDER_STATUS, ORDER_TRANSITIONS,
} from "../modules/ordersService.js";
import { getBankSettings, saveBankSettings, VIETNAM_BANKS } from "../modules/settingsService.js";
import { ageOf } from "../modules/age.js";
import { formatMoney, formatDate, formatDateTime, debounce, paginate, renderPagination, classNames, escapeHtml } from "../modules/utils.js";
import { validateForm, clearFormErrors } from "../modules/validation.js";
import { toast, confirmDialog, openModal, closeModal, setButtonLoading } from "../modules/ui.js";
import { ICONS } from "../modules/icons.js";
import { openVietQRPaymentModal } from "../modules/vietqrService.js";

const bodyEl = document.getElementById("orders-body");
const paginationEl = document.getElementById("pagination");
const keywordInput = document.getElementById("f-keyword");
const statusSelect = document.getElementById("f-status");
const paymentSelect = document.getElementById("f-payment");
const sortSelect = document.getElementById("f-sort");

const modalBody = document.getElementById("order-modal-body");
const modalTitle = document.getElementById("order-modal-title");
const statusPicker = document.getElementById("order-status-select");
const saveStatusBtn = document.getElementById("order-save-status-btn");
const deleteBtn = document.getElementById("order-delete-btn");
const qrBtn = document.getElementById("order-vietqr-btn");
const paidBtn = document.getElementById("order-paid-btn");

const bankBtn = document.getElementById("bank-settings-btn");
const bankForm = document.getElementById("bank-form");
const bankSubmitBtn = document.getElementById("bank-form-submit");

const COLSPAN = 10;
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
      <td><span class="${classNames("badge", o.paymentBadge)}">${o.paymentLabel}</span></td>
      <td><span class="${classNames("badge", o.doorVerificationBadge)}">${o.doorVerificationLabel}</span></td>
      <td class="text-muted text-sm">${formatDateTime(o.createdAt)}</td>
      <td class="cell-actions" style="text-align: right;">
        <button type="button" class="btn btn-ghost btn-sm" data-action="view">
          ${ICONS.receipt(14)} Chi tiết
        </button>
      </td>
    </tr>`;
}

const emptyRow = (text) => `<tr><td colspan="${COLSPAN}" class="table-empty py-4 text-center text-muted">${text}</td></tr>`;

function renderTable() {
  const list = filterOrders(allOrders, {
    keyword: keywordInput.value,
    status: statusSelect.value,
    payment: paymentSelect.value,
    sortBy: sortSelect.value,
  });
  const { items, page, totalPages } = paginate(list, currentPage, 8);
  currentPage = page;

  bodyEl.innerHTML = items.length
    ? items.map(rowHtml).join("")
    : emptyRow(allOrders.length ? "Không có đơn hàng phù hợp với bộ lọc." : "Chưa có đơn hàng nào.");

  renderPagination(paginationEl, page, totalPages, (p) => { currentPage = p; renderTable(); });
}

async function reloadTable() {
  try {
    allOrders = await getAllOrders();
    renderTable();
  } catch (err) {
    bodyEl.innerHTML = emptyRow(escapeHtml(err.message));
  }
}

/* ---------------- Modal chi tiết ---------------- */
function openDetail(order) {
  activeOrder = order;
  modalTitle.textContent = `Phiếu Đặt #${order.code}`;
  statusPicker.value = order.status;

  // Chỉ cho chọn những bước chuyển hợp lệ theo quy trình (ORDER_TRANSITIONS).
  // Huỷ đơn / khôi phục đơn đã huỷ (đụng tới tồn kho) cần thêm quyền "order:cancel".
  const canCancel = can("order:cancel");
  [...statusPicker.options].forEach((opt) => {
    const touchesCancel = opt.value === "cancelled" || order.status === "cancelled";
    opt.disabled = opt.value !== order.status
      && (!order.canChangeTo(opt.value) || (touchesCancel && !canCancel));
  });
  deleteBtn.hidden = !can("order:delete") || order.isRevenueLocked;
  const isFinal = ORDER_TRANSITIONS[order.status].length === 0;
  statusPicker.disabled = isFinal;
  saveStatusBtn.disabled = isFinal;
  saveStatusBtn.title = isFinal ? "Đơn đã hoàn tất phục vụ - không đổi trạng thái được nữa" : "";

  // Mã QR chỉ cần khi đơn còn phải trả tiền; xác nhận thu tiền cần quyền "order:payment"
  qrBtn.hidden = !order.needsPayment;
  paidBtn.hidden = !order.needsPayment || !can("order:payment");

  const itemsHtml = order.items.map((item) => `
    <div class="order-detail-row item-row">
      <span>${escapeHtml(item.name)} <span class="text-muted">× ${item.qty}</span></span>
      <strong>${formatMoney(item.price * item.qty)}</strong>
    </div>`).join("");

  modalBody.innerHTML = `
    <div class="order-detail-row"><span>Tên khách hàng</span><strong>${escapeHtml(order.name)}</strong></div>
    <div class="order-detail-row"><span>Số điện thoại</span><strong>${escapeHtml(order.phone)}</strong></div>
    ${order.email ? `<div class="order-detail-row"><span>Email</span><strong>${escapeHtml(order.email)}</strong></div>` : ""}
    ${order.birthDate ? `<div class="order-detail-row"><span>Ngày sinh (khách khai)</span><strong>${escapeHtml(formatDate(order.birthDate))} · ${ageOf(order.birthDate)} tuổi</strong></div>` : ""}
    ${order.holdsStock ? `<p class="id-check-note">Nhắc nhân viên: <strong>kiểm tra CCCD / giấy tờ tuỳ thân</strong> khi khách đến nhận bàn. Ngày sinh trên đây chỉ do khách tự khai.</p>` : ""}
    <div class="order-detail-row"><span>Hình thức</span><strong>${order.serviceLabel}</strong></div>
    ${order.serviceDetails().map(([label, value]) => `
      <div class="order-detail-row"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
    ${order.note ? `<div class="order-detail-row"><span>Ghi chú pha chế</span><span class="note-box">${escapeHtml(order.note)}</span></div>` : ""}
    <div class="order-detail-row"><span>Thanh toán</span><span class="${classNames("badge", order.paymentBadge)}">${order.paymentLabel}</span></div>
    ${order.isRevenueLocked ? `<p class="text-muted text-xs mt-1">Đơn đã thu tiền được giữ trong sổ doanh thu nên không xoá được.</p>` : ""}

    <div class="order-detail-items mt-3">
      <p class="text-muted text-xs uppercase font-bold mb-2">Thực đơn yêu cầu:</p>
      ${itemsHtml || `<p class="text-muted text-sm">Chỉ giữ bàn - khách gọi món khi đến quán.</p>`}
    </div>
    ${order.discountTotal > 0 ? `
      <div class="order-detail-row mt-3"><span>Tạm tính</span><strong>${formatMoney(order.subtotal)}</strong></div>
      ${order.discounts.map((d) => `<div class="order-detail-row"><span>${escapeHtml(d.label)}</span><strong class="text-amber">−${formatMoney(d.amount)}</strong></div>`).join("")}` : ""}
    <div class="order-detail-row total-row mt-3">
      <span class="font-bold">Tổng thanh toán</span>
      <strong class="text-amber text-lg">${formatMoney(order.total)}</strong>
    </div>

    <div class="door-host-admin-panel">
      <div class="door-host-admin-title">
        <span>🛡️ Đối chiếu CCCD &amp; Độ tuổi tại cửa (Door Host)</span>
        <span class="${classNames("badge", order.doorVerificationBadge)}">${order.doorVerificationLabel}</span>
      </div>
      <p class="text-sm text-muted mb-2">
        Ngày sinh khách khai: <strong>${order.birthDate ? `${escapeHtml(formatDate(order.birthDate))} (${ageOf(order.birthDate)} tuổi)` : "Chưa có"}</strong>.
        ${order.verifiedBy ? `<br>Nhân viên xử lý: <strong>${escapeHtml(order.verifiedBy)}</strong>` : ""}
        ${order.verificationNote ? `<br>Ghi chú: <em>${escapeHtml(order.verificationNote)}</em>` : ""}
      </p>
      ${order.status !== "cancelled" ? `
        <div class="door-host-admin-actions">
          <button type="button" class="btn btn-outline btn-sm" id="door-verify-valid-btn" ${order.doorVerification === "verified" ? "disabled" : ""}>
            ✅ Xác minh CCCD Hợp lệ
          </button>
          <button type="button" class="btn btn-ghost btn-sm text-danger" id="door-verify-underage-btn">
            ❌ Từ chối: Dưới 18 tuổi (Hủy &amp; Hoàn kho)
          </button>
          <button type="button" class="btn btn-ghost btn-sm text-danger" id="door-verify-fake-btn">
            🚫 Từ chối: Thông tin ảo / Bom hàng
          </button>
        </div>
      ` : `<p class="text-xs text-muted mb-0">Đơn đã huỷ - không thể đối chiếu lại.</p>`}
    </div>`;

  openModal("order-modal");

  const validBtn = modalBody.querySelector("#door-verify-valid-btn");
  if (validBtn) {
    validBtn.onclick = async () => {
      const staff = currentAdmin();
      const staffName = staff?.displayName || "Lê Thành Tài";
      try {
        await verifyOrderDoorCheck(order.id, {
          status: "verified",
          staffName,
          note: "Đã kiểm tra CCCD/VNeID chính chủ, khách đủ 18 tuổi.",
        });
        toast(`Đã xác minh CCCD hợp lệ cho khách ${order.name}.`, "success");
        closeModal("order-modal");
        await reloadTable();
      } catch (err) {
        toast(err.message, "error");
      }
    };
  }

  const underageBtn = modalBody.querySelector("#door-verify-underage-btn");
  if (underageBtn) {
    underageBtn.onclick = async () => {
      const ok = await confirmDialog(
        `Xác nhận TỪ CHỐI PHỤC VỤ khách ${order.name} do chưa đủ 18 tuổi hoặc khai gian ngày sinh?\n\n• Đơn hàng sẽ bị HỦY.\n• Toàn bộ cocktail đã pha/dự trù sẽ được TỰ ĐỘNG HOÀN KHO.\n• Tài khoản thành viên (nếu có) sẽ bị tạm khóa vi phạm.`,
        { title: "Từ chối phục vụ (Vi phạm 18+)", okText: "Từ chối & Hủy đơn" }
      );
      if (!ok) return;
      const staff = currentAdmin();
      const staffName = staff?.displayName || "Lê Thành Tài";
      try {
        await verifyOrderDoorCheck(order.id, {
          status: "rejected_underage",
          staffName,
          note: "Từ chối phục vụ: Phát hiện chưa đủ 18 tuổi khi kiểm tra CCCD tại cửa.",
        });
        toast(`Đã từ chối phục vụ khách ${order.name} và tự động hoàn kho nguyên liệu.`, "warning");
        closeModal("order-modal");
        await reloadTable();
      } catch (err) {
        toast(err.message, "error");
      }
    };
  }

  const fakeBtn = modalBody.querySelector("#door-verify-fake-btn");
  if (fakeBtn) {
    fakeBtn.onclick = async () => {
      const ok = await confirmDialog(
        `Xác nhận HỦY ĐƠN do khách cung cấp số điện thoại hoặc thông tin ảo?\n\n• Đơn hàng sẽ bị HỦY.\n• Toàn bộ đồ uống sẽ được TỰ ĐỘNG HOÀN KHO.\n• Tài khoản thành viên (nếu có) sẽ bị tạm khóa.`,
        { title: "Từ chối thông tin ảo / Bom hàng", okText: "Hủy đơn & Hoàn kho" }
      );
      if (!ok) return;
      const staff = currentAdmin();
      const staffName = staff?.displayName || "Lê Thành Tài";
      try {
        await verifyOrderDoorCheck(order.id, {
          status: "rejected_fake_info",
          staffName,
          note: "Hủy đơn: Không liên lạc được số điện thoại hoặc thông tin giả mạo.",
        });
        toast(`Đã hủy đơn ${order.code} do thông tin ảo và hoàn kho thành công.`, "warning");
        closeModal("order-modal");
        await reloadTable();
      } catch (err) {
        toast(err.message, "error");
      }
    };
  }
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

  // Huỷ đơn là thao tác quan trọng -> hỏi lại trước; đơn đã thu tiền thì nhắc hoàn tiền
  if (newStatus === "cancelled") {
    const refundNote = activeOrder.paymentStatus === "paid"
      ? ` Đơn này ĐÃ THANH TOÁN ${formatMoney(activeOrder.total)} - nhớ hoàn tiền cho khách.`
      : "";
    const ok = await confirmDialog(`Bạn có chắc chắn muốn huỷ đơn ${activeOrder.code}?${refundNote}`, {
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

/**
 * Thu ngân đã nhận đủ tiền (đối chiếu sao kê hoặc thu tiền mặt).
 * ask = false khi bấm ngay trong hộp mã QR (nút đó đã là bước xác nhận).
 */
async function handleConfirmPayment(order = activeOrder, ask = true) {
  if (!order || !can("order:payment")) return;
  if (ask) {
    const ok = await confirmDialog(
      `Xác nhận đã nhận đủ ${formatMoney(order.total)} cho đơn ${order.code}? Nếu khách chuyển khoản, hãy kiểm tra sao kê có nội dung "BAR ${order.code}".`,
      { title: "Xác nhận đã thu tiền", okText: "Đã nhận tiền" },
    );
    if (!ok) return;
  }

  try {
    await confirmPayment(order.id);
    toast(`Đơn ${order.code}: đã thanh toán.`, "success");
    closeModal("order-modal");
    await reloadTable();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function handleDelete() {
  if (!activeOrder) return;
  if (!can("order:delete")) {
    toast("Chỉ Quản lý mới được xoá đơn hàng.", "error");
    return;
  }
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

/* ---------------- Tài khoản ngân hàng nhận tiền (chỉ Quản lý) ---------------- */
async function openBankSettings() {
  bankForm.reset();
  clearFormErrors(bankForm);
  try {
    const bank = await getBankSettings();
    bankForm.elements.bankId.value = bank.bankId;
    bankForm.elements.accountNumber.value = bank.accountNumber;
    bankForm.elements.accountName.value = bank.accountName;
    openModal("bank-modal");
  } catch (err) {
    toast(err.message, "error");
  }
}

bankForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const { isValid, data } = validateForm(bankForm);
  if (!isValid) return;

  const restoreButton = setButtonLoading(bankSubmitBtn, "Đang lưu...");
  try {
    const saved = await saveBankSettings(data);
    toast(`Đã đổi tài khoản nhận tiền: ${saved.bankId} - ${saved.accountNumber} (${saved.accountName}).`, "success");
    closeModal("bank-modal");
  } catch (err) {
    toast(err.message, "error");
  } finally {
    restoreButton();
  }
});

function bindEvents() {
  const debouncedRender = debounce(() => { currentPage = 1; renderTable(); }, 250);
  keywordInput.addEventListener("input", debouncedRender);
  [statusSelect, paymentSelect, sortSelect].forEach((el) => el.addEventListener("change", () => { currentPage = 1; renderTable(); }));

  document.getElementById("order-modal-close").addEventListener("click", () => closeModal("order-modal"));
  // Nhân viên đưa mã QR cho khách quét tại quầy; thu ngân xác nhận ngay trong hộp QR khi tiền về
  qrBtn.addEventListener("click", () => {
    if (!activeOrder) return;
    const order = activeOrder;
    openVietQRPaymentModal(order, can("order:payment")
      ? { confirmLabel: "Xác Nhận Đã Nhận Tiền", onConfirm: () => handleConfirmPayment(order, false) }
      : {});
  });
  paidBtn.addEventListener("click", () => handleConfirmPayment());
  saveStatusBtn.addEventListener("click", handleSaveStatus);
  deleteBtn.addEventListener("click", handleDelete);

  if (can("settings:bank")) {
    bankBtn.hidden = false;
    bankBtn.addEventListener("click", openBankSettings);
    document.getElementById("bank-form-bank").innerHTML = VIETNAM_BANKS
      .map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("");
    document.getElementById("bank-modal-close").addEventListener("click", () => closeModal("bank-modal"));
    document.getElementById("bank-form-cancel").addEventListener("click", () => closeModal("bank-modal"));
  }
}

if (initAdminLayout("Quản Lý Đơn Hàng")) {
  bindEvents();
  bodyEl.innerHTML = emptyRow("Đang tải đơn hàng...");
  reloadTable();
}

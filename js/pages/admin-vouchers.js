/* =========================================================
   ADMIN-VOUCHERS.JS - Quản lý mã giảm giá (CRUD qua API /vouchers)
   Chỉ quản lý/admin được vào (quyền "page:vouchers" - xem auth.js).
   ========================================================= */

import { initAdminLayout } from "../modules/adminLayout.js";
import { getAllVouchers, addVoucher, updateVoucher, deleteVoucher, VOUCHER_TYPES } from "../modules/vouchersService.js";
import { formatMoney, formatDate, debounce, paginate, renderPagination, escapeHtml } from "../modules/utils.js";
import { validateForm, clearFormErrors } from "../modules/validation.js";
import { toast, confirmDialog, openModal, closeModal, setButtonLoading } from "../modules/ui.js";

const bodyEl = document.getElementById("vouchers-body");
const paginationEl = document.getElementById("pagination");
const keywordInput = document.getElementById("f-keyword");
const statusSelect = document.getElementById("f-status");
const formEl = document.getElementById("voucher-form");
const typeSelect = document.getElementById("voucher-type");
const submitBtn = document.getElementById("voucher-form-submit");
const modalTitle = document.getElementById("voucher-modal-title");

let vouchers = [];
let currentPage = 1;

/** Tình trạng thực tế của mã: off (tắt) | expired (hết hạn / hết lượt) | live (dùng được) */
function stateOf(v) {
  if (v.active === false) return "off";
  const expired = v.expiresAt && new Date(v.expiresAt).getTime() < Date.now();
  const used = Number(v.usageLimit) > 0 && Number(v.usedCount) >= Number(v.usageLimit);
  return expired || used ? "expired" : "live";
}

const STATE_BADGE = {
  live: `<span class="badge badge-success">Đang dùng được</span>`,
  off: `<span class="badge badge-muted">Đã tắt</span>`,
  expired: `<span class="badge badge-danger">Hết hạn / hết lượt</span>`,
};

function offerText(v) {
  if (v.type === "percent") return `Giảm ${v.value}%${v.maxDiscount > 0 ? ` (tối đa ${formatMoney(v.maxDiscount)})` : ""}`;
  return `Giảm ${formatMoney(v.value)}`;
}

function rowHtml(v) {
  return `
    <tr data-id="${escapeHtml(v.id)}">
      <td style="max-width: 230px;"><strong class="text-amber">${escapeHtml(v.code)}</strong>${v.description ? `<div class="text-xs text-muted">${escapeHtml(v.description)}</div>` : ""}</td>
      <td class="text-sm">${offerText(v)}</td>
      <td class="text-sm">${v.minOrder > 0 ? `Đơn từ ${formatMoney(v.minOrder)}` : "Mọi đơn"}<div class="text-xs text-muted">Mỗi SĐT dùng 1 lần</div></td>
      <td class="text-sm">${v.expiresAt ? formatDate(v.expiresAt) : "Không hết hạn"}</td>
      <td class="text-sm">${v.usedCount || 0}${v.usageLimit > 0 ? ` / ${v.usageLimit}` : ""}</td>
      <td>${STATE_BADGE[stateOf(v)]}</td>
      <td class="cell-actions" style="text-align: right;">
        <button type="button" class="btn btn-ghost btn-sm" data-action="edit">Sửa</button>
        <button type="button" class="btn btn-danger btn-sm" data-action="delete">Xoá</button>
      </td>
    </tr>`;
}

function filtered() {
  const kw = keywordInput.value.trim().toLowerCase();
  return vouchers.filter((v) => {
    if (statusSelect.value !== "all" && stateOf(v) !== statusSelect.value) return false;
    return !kw || `${v.code} ${v.description}`.toLowerCase().includes(kw);
  });
}

function renderTable() {
  const { items, page, totalPages } = paginate(filtered(), currentPage, 8);
  currentPage = page;
  bodyEl.innerHTML = items.length ? items.map(rowHtml).join("")
    : `<tr><td colspan="7" class="table-empty py-4 text-center text-muted">${vouchers.length ? "Không có mã phù hợp bộ lọc." : "Chưa có mã giảm giá nào - bấm \"Tạo mã giảm giá\"."}</td></tr>`;
  renderPagination(paginationEl, page, totalPages, (p) => { currentPage = p; renderTable(); });
}

async function reload() {
  try {
    vouchers = await getAllVouchers();
    renderTable();
  } catch (err) {
    bodyEl.innerHTML = `<tr><td colspan="7" class="table-empty py-4 text-center text-muted">${escapeHtml(err.message)}</td></tr>`;
  }
}

/** Ô "Trần giảm" chỉ có nghĩa với loại giảm theo % */
function syncTypeFields() {
  const isPercent = typeSelect.value === "percent";
  document.getElementById("voucher-cap-group").hidden = !isPercent;
  document.getElementById("voucher-value-label").innerHTML = `${isPercent ? "Phần trăm giảm (%)" : "Số tiền giảm (VNĐ)"} <span class="req">*</span>`;
}

const toDateInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

function openForm(voucher = null) {
  formEl.reset();
  clearFormErrors(formEl);
  formEl.elements.id.value = voucher?.id || "";
  formEl.elements.code.value = voucher?.code || "";
  typeSelect.value = voucher?.type || "percent";
  formEl.elements.value.value = voucher?.value ?? "";
  formEl.elements.maxDiscount.value = voucher?.maxDiscount ?? 0;
  formEl.elements.minOrder.value = voucher?.minOrder ?? 0;
  formEl.elements.usageLimit.value = voucher?.usageLimit ?? 0;
  formEl.elements.expiresAt.value = toDateInput(voucher?.expiresAt);
  formEl.elements.active.checked = voucher ? voucher.active !== false : true;
  formEl.elements.description.value = voucher?.description || "";
  syncTypeFields();
  modalTitle.textContent = voucher ? `Sửa mã ${voucher.code}` : "Tạo mã giảm giá";
  openModal("voucher-modal");
}

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  const { isValid, data } = validateForm(formEl);
  if (!isValid) return;

  // Hạn dùng tính đến HẾT ngày đã chọn (23:59)
  const payload = {
    ...data,
    active: formEl.elements.active.checked,
    expiresAt: data.expiresAt ? new Date(`${data.expiresAt}T23:59:00`).toISOString() : "",
  };
  const existing = data.id ? vouchers.find((v) => v.id === data.id) : null;
  if (existing) payload.usedCount = existing.usedCount;

  const restore = setButtonLoading(submitBtn, "Đang lưu...");
  try {
    if (data.id) await updateVoucher(data.id, payload);
    else await addVoucher(payload);
    toast(`Đã lưu mã ${String(data.code).toUpperCase()}.`, "success");
    closeModal("voucher-modal");
    await reload();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    restore();
  }
});

bodyEl.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const voucher = vouchers.find((v) => v.id === btn.closest("tr").dataset.id);
  if (!voucher) return;

  if (btn.dataset.action === "edit") openForm(voucher);
  if (btn.dataset.action === "delete") {
    const ok = await confirmDialog(`Xoá mã "${voucher.code}"? Các đơn đã dùng mã này vẫn giữ nguyên mức giảm đã áp.`, { title: "Xoá mã giảm giá", okText: "Xoá mã" });
    if (!ok) return;
    try {
      await deleteVoucher(voucher.id);
      toast(`Đã xoá mã ${voucher.code}.`, "success");
      await reload();
    } catch (err) {
      toast(err.message, "error");
    }
  }
});

if (initAdminLayout("Mã Giảm Giá")) {
  typeSelect.innerHTML = Object.entries(VOUCHER_TYPES).map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  typeSelect.addEventListener("change", syncTypeFields);
  keywordInput.addEventListener("input", debounce(() => { currentPage = 1; renderTable(); }, 250));
  statusSelect.addEventListener("change", () => { currentPage = 1; renderTable(); });
  document.getElementById("add-voucher-btn").addEventListener("click", () => openForm());
  document.getElementById("voucher-modal-close").addEventListener("click", () => closeModal("voucher-modal"));
  document.getElementById("voucher-form-cancel").addEventListener("click", () => closeModal("voucher-modal"));
  bodyEl.innerHTML = `<tr><td colspan="7" class="table-empty py-4 text-center text-muted">Đang tải mã giảm giá...</td></tr>`;
  reload();
}

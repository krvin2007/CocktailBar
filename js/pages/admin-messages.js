/* =========================================================
   ADMIN-MESSAGES.JS - Hộp thư liên hệ của khách (qua API /messages)
   Đọc GET /messages, đánh dấu đã xử lý PATCH, xoá DELETE.
   ========================================================= */

import { initAdminLayout, refreshUnreadBadge } from "../modules/adminLayout.js";
import {
  getAllMessages, filterMessages, setMessageRead, deleteMessage,
} from "../modules/messagesService.js";
import { formatDateTime, debounce, paginate, renderPagination, escapeHtml, truncate } from "../modules/utils.js";
import { toast, confirmDialog, openModal, closeModal, setButtonLoading } from "../modules/ui.js";
import { ICONS } from "../modules/icons.js";

const bodyEl = document.getElementById("messages-body");
const paginationEl = document.getElementById("pagination");
const keywordInput = document.getElementById("f-keyword");
const readFilter = document.getElementById("f-read");

const modalTitle = document.getElementById("message-modal-title");
const modalBody = document.getElementById("message-modal-body");
const toggleBtn = document.getElementById("message-toggle-btn");
const deleteBtn = document.getElementById("message-delete-btn");

let allMessages = [];
let currentPage = 1;
let activeMessage = null;

function rowHtml(m) {
  return `
    <tr data-id="${escapeHtml(m.id)}" class="${m.read ? "" : "row-unread"}">
      <td>
        <strong>${escapeHtml(m.name)}</strong>
        <div class="text-xs text-muted">${escapeHtml(m.phone)}${m.email ? ` · ${escapeHtml(m.email)}` : ""}</div>
      </td>
      <td><span class="text-sm">${escapeHtml(m.subject || "—")}</span></td>
      <td class="text-sm text-muted">${escapeHtml(truncate(m.message || "", 60))}</td>
      <td class="text-sm text-muted">${formatDateTime(m.createdAt)}</td>
      <td>
        <span class="badge ${m.read ? "badge-muted" : "badge-warning"}">${m.read ? "Đã xử lý" : "Chưa xử lý"}</span>
      </td>
      <td class="cell-actions" style="text-align: right;">
        <button type="button" class="btn btn-ghost btn-sm" data-action="view">${ICONS.mail(14)} Đọc</button>
      </td>
    </tr>`;
}

function renderTable() {
  const list = filterMessages(allMessages, { keyword: keywordInput.value, readState: readFilter.value });
  const { items, page, totalPages } = paginate(list, currentPage, 8);
  currentPage = page;

  bodyEl.innerHTML = items.length
    ? items.map(rowHtml).join("")
    : `<tr><td colspan="6" class="table-empty py-4 text-center text-muted">
        ${allMessages.length ? "Không có tin nhắn phù hợp với bộ lọc." : "Hộp thư đang trống - chưa có khách nào gửi liên hệ."}
       </td></tr>`;

  renderPagination(paginationEl, page, totalPages, (p) => { currentPage = p; renderTable(); });
}

async function reloadTable() {
  try {
    allMessages = await getAllMessages();
    renderTable();
    refreshUnreadBadge();
  } catch (err) {
    bodyEl.innerHTML = `<tr><td colspan="6" class="table-empty py-4 text-center text-muted">${escapeHtml(err.message)}</td></tr>`;
  }
}

function openMessage(m) {
  activeMessage = m;
  modalTitle.textContent = m.subject || "Chi tiết tin nhắn";
  toggleBtn.textContent = m.read ? "Đánh dấu chưa xử lý" : "Đánh dấu đã xử lý";

  modalBody.innerHTML = `
    <div class="order-detail-row"><span>Người gửi</span><strong>${escapeHtml(m.name)}</strong></div>
    <div class="order-detail-row"><span>Số điện thoại</span><strong><a href="tel:${escapeHtml(m.phone)}">${escapeHtml(m.phone)}</a></strong></div>
    ${m.email ? `<div class="order-detail-row"><span>Email</span><strong><a href="mailto:${escapeHtml(m.email)}">${escapeHtml(m.email)}</a></strong></div>` : ""}
    <div class="order-detail-row"><span>Gửi lúc</span><strong>${formatDateTime(m.createdAt)}</strong></div>
    <div class="message-full-text">${escapeHtml(m.message || "")}</div>`;

  openModal("message-modal");
}

bodyEl.addEventListener("click", (e) => {
  const btn = e.target.closest('button[data-action="view"]');
  if (!btn) return;
  const message = allMessages.find((m) => m.id === btn.closest("tr").dataset.id);
  if (message) openMessage(message);
});

async function handleToggleRead() {
  if (!activeMessage) return;
  const restoreButton = setButtonLoading(toggleBtn, "Đang lưu...");
  try {
    await setMessageRead(activeMessage.id, !activeMessage.read);
    toast(activeMessage.read ? "Đã chuyển về \"Chưa xử lý\"." : "Đã đánh dấu tin nhắn là đã xử lý.", "success");
    closeModal("message-modal");
    await reloadTable();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    restoreButton();
  }
}

async function handleDelete() {
  if (!activeMessage) return;
  const ok = await confirmDialog(`Xoá tin nhắn của "${activeMessage.name}"? Hành động này không thể hoàn tác.`, {
    title: "Xoá tin nhắn",
    okText: "Xoá",
  });
  if (!ok) return;

  try {
    await deleteMessage(activeMessage.id);
    toast("Đã xoá tin nhắn.", "success");
    closeModal("message-modal");
    await reloadTable();
  } catch (err) {
    toast(err.message, "error");
  }
}

function bindEvents() {
  const debouncedRender = debounce(() => { currentPage = 1; renderTable(); }, 250);
  keywordInput.addEventListener("input", debouncedRender);
  readFilter.addEventListener("change", () => { currentPage = 1; renderTable(); });

  document.getElementById("message-modal-close").addEventListener("click", () => closeModal("message-modal"));
  toggleBtn.addEventListener("click", handleToggleRead);
  deleteBtn.addEventListener("click", handleDelete);
}

if (initAdminLayout("Hộp Thư Liên Hệ")) {
  bindEvents();
  bodyEl.innerHTML = `<tr><td colspan="6" class="table-empty py-4 text-center text-muted">Đang tải hộp thư...</td></tr>`;
  reloadTable();
}

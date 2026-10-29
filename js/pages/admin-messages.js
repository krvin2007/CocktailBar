/* =========================================================
   ADMIN-MESSAGES.JS - Hộp thư liên hệ của khách (qua API /messages)
   Đọc GET /messages, đánh dấu đã xử lý PATCH, xoá DELETE,
   và phản hồi (reply) trực tiếp câu hỏi/góp ý của khách hàng.
   ========================================================= */

import { initAdminLayout, refreshUnreadBadge } from "../modules/adminLayout.js";
import {
  getAllMessages, filterMessages, setMessageRead, deleteMessage, replyToMessage,
} from "../modules/messagesService.js";
import { currentAdmin } from "../modules/auth.js";
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
  let badgeHtml;
  if (m.reply) {
    badgeHtml = '<span class="badge badge-success">Đã phản hồi</span>';
  } else if (m.read) {
    badgeHtml = '<span class="badge badge-muted">Đã xử lý</span>';
  } else {
    badgeHtml = '<span class="badge badge-warning">Chưa xử lý</span>';
  }

  return `
    <tr data-id="${escapeHtml(m.id)}" class="${m.read ? "" : "row-unread"}">
      <td>
        <strong>${escapeHtml(m.name)}</strong>
        <div class="text-xs text-muted">${escapeHtml(m.phone)}${m.email ? ` · ${escapeHtml(m.email)}` : ""}</div>
      </td>
      <td><span class="text-sm">${escapeHtml(m.subject || "—")}</span></td>
      <td class="text-sm">
        <div class="text-muted">${escapeHtml(truncate(m.message || "", 60))}</div>
        ${m.reply ? `<div class="text-xs text-success mt-1" style="color: #4ade80;">↳ <em>Trả lời: ${escapeHtml(truncate(m.reply, 40))}</em></div>` : ""}
      </td>
      <td class="text-sm text-muted">${formatDateTime(m.createdAt)}</td>
      <td>${badgeHtml}</td>
      <td class="cell-actions" style="text-align: right;">
        <button type="button" class="btn btn-ghost btn-sm" data-action="view">${ICONS.mail(14)} ${m.reply ? "Xem & Trả lời" : "Đọc & Phản hồi"}</button>
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

async function handleSubmitReply() {
  if (!activeMessage) return;
  const replyInput = document.getElementById("admin-reply-input");
  const replyText = replyInput ? replyInput.value.trim() : "";
  if (!replyText) {
    toast("Vui lòng nhập nội dung phản hồi cho khách hàng.", "error");
    if (replyInput) replyInput.focus();
    return;
  }

  const submitReplyBtn = document.getElementById("btn-submit-reply");
  const restoreBtn = setButtonLoading(submitReplyBtn, "Đang gửi...");

  try {
    const admin = currentAdmin();
    const adminName = admin?.name || admin?.displayName || "Lê Thành Tài";
    const updated = await replyToMessage(activeMessage.id, replyText, adminName);

    // Cập nhật ngay trong bộ nhớ để giao diện phản ánh tức thì
    activeMessage.reply = updated.reply || replyText;
    activeMessage.repliedAt = updated.repliedAt || new Date().toISOString();
    activeMessage.repliedBy = updated.repliedBy || adminName;
    activeMessage.read = true;

    toast(`Đã gửi phản hồi thành công đến ${activeMessage.name}!`, "success");
    closeModal("message-modal");
    await reloadTable();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    restoreBtn();
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
    <div class="order-detail-row"><span>Chủ đề</span><strong>${escapeHtml(m.subject || "Khác")}</strong></div>
    <div class="order-detail-row"><span>Trạng thái</span><strong>${m.reply ? '<span class="badge badge-success">Đã phản hồi</span>' : (m.read ? '<span class="badge badge-muted">Đã xử lý</span>' : '<span class="badge badge-warning">Chưa xử lý</span>')}</strong></div>

    <div style="margin-top: 14px;">
      <label style="display: block; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--amber-soft); font-weight: 600; margin-bottom: 6px;">Nội dung tin nhắn của khách:</label>
      <div class="message-full-text" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; line-height: 1.6; color: var(--cream); font-size: 0.95rem;">${escapeHtml(m.message || "")}</div>
    </div>

    ${m.reply ? `
    <div class="admin-reply-box" style="margin-top: 16px; background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.28); border-radius: 8px; padding: 12px 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <strong style="color: #4ade80; font-size: 0.85rem; display: flex; align-items: center; gap: 6px;">
          ✓ Phản hồi từ quán (${escapeHtml(m.repliedBy || "Quản trị viên")})
        </strong>
        <span class="text-xs text-muted">${m.repliedAt ? formatDateTime(m.repliedAt) : ""}</span>
      </div>
      <div style="color: var(--cream); white-space: pre-wrap; font-size: 0.95rem; line-height: 1.5;">${escapeHtml(m.reply)}</div>
    </div>
    ` : ""}

    <div class="admin-reply-composer" style="margin-top: 18px; border-top: 1px dashed rgba(197,152,67,0.3); padding-top: 14px;">
      <label for="admin-reply-input" style="display: block; font-weight: 600; color: var(--amber-soft); margin-bottom: 6px;">
        ${m.reply ? "Cập nhật / Gửi lại phản hồi cho khách:" : "Soạn câu trả lời / phản hồi khách hàng:"}
      </label>

      <div class="quick-reply-chips" style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">
        <span class="text-xs text-muted" style="align-self: center;">Mẫu nhanh:</span>
        <button type="button" class="btn btn-ghost btn-sm btn-quick-reply" data-text="Chào bạn, Quán Bar Đêm đã ghi nhận thông tin và rất hân hạnh được phục vụ bạn!">Chào & đón tiếp</button>
        <button type="button" class="btn btn-ghost btn-sm btn-quick-reply" data-text="Chào bạn, cảm ơn bạn đã đóng góp ý kiến. Quán sẽ cải thiện dịch vụ để mang đến trải nghiệm tốt nhất!">Cảm ơn góp ý</button>
        <button type="button" class="btn btn-ghost btn-sm btn-quick-reply" data-text="Chào bạn, quán mở cửa từ 18:00 - 02:00 mỗi đêm. Rất vui được hẹn gặp bạn tối nay!">Hẹn tối nay</button>
        <button type="button" class="btn btn-ghost btn-sm btn-quick-reply" data-text="Chào bạn, quán đã kiểm tra và giải quyết xong yêu cầu của bạn. Chúc bạn một buổi tối thư giãn!">Đã giải quyết</button>
      </div>

      <textarea id="admin-reply-input" rows="3" placeholder="Nhập nội dung câu trả lời để phản hồi tới khách hàng..." style="width: 100%; border-radius: 8px; padding: 10px; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.15); color: #fff; font-family: inherit; resize: vertical; box-sizing: border-box;">${escapeHtml(m.reply || "")}</textarea>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; gap: 6px;">
          ${m.email ? `<a href="mailto:${escapeHtml(m.email)}?subject=${encodeURIComponent("Phản hồi từ Quán Bar Đêm: " + (m.subject || "Liên hệ"))}" class="btn btn-ghost btn-sm" style="font-size: 0.75rem; padding: 4px 8px;">✉ Gửi Email</a>` : ""}
          ${m.phone ? `<a href="tel:${escapeHtml(m.phone)}" class="btn btn-ghost btn-sm" style="font-size: 0.75rem; padding: 4px 8px;">📞 Gọi điện</a>` : ""}
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="btn-submit-reply" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          <span>${m.reply ? "Lưu lại phản hồi" : "Gửi phản hồi cho khách"}</span>
        </button>
      </div>
    </div>`;

  modalBody.querySelectorAll(".btn-quick-reply").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById("admin-reply-input");
      if (input) {
        input.value = btn.dataset.text || "";
        input.focus();
      }
    });
  });

  const submitReplyBtn = document.getElementById("btn-submit-reply");
  if (submitReplyBtn) {
    submitReplyBtn.addEventListener("click", handleSubmitReply);
  }

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

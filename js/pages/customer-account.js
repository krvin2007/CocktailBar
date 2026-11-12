/* =========================================================
   CUSTOMER-ACCOUNT.JS - Trang "Hạng thành viên & Điểm thưởng" của khách
   Đọc hồ sơ khách từ máy chủ (GET /customers/:id) rồi hiện:
   - hạng hiện tại + tổng điểm
   - thanh tiến độ tới hạng kế tiếp
   - bậc thang các hạng
   - lịch sử điểm (mỗi đơn hoàn tất = 1 dòng)
   - danh sách đơn hàng & trạng thái thanh toán
   - tin nhắn liên hệ & phản hồi chính thức từ quán
   ========================================================= */

import "../modules/navbar.js";
import { api } from "../modules/api.js";
import { getCurrentCustomer, MEMBER_RANKS, rankProgress, lifetimeOf, POINT_VALUE_VND, updateCustomerAvatar, updateCustomerProfile } from "../modules/customerAuth.js";
import { POINT_REDEEM_VND, MIN_POINT_REDEEM, MAX_POINT_REDEEM_SHARE } from "../modules/promotions.js";
import { loadingHtml, errorHtml, toast, confirmDialog } from "../modules/ui.js";
import { escapeHtml, formatMoney, formatDate, formatDateTime } from "../modules/utils.js";
import { t } from "../modules/i18n.js";
import { openVietQRPaymentModal } from "../modules/vietqrService.js";
import { reportTransferSent, cancelByCustomer } from "../modules/ordersService.js";
import { openCinemaTicketModal, openWelcomeVoucherModal, getEmailsByRecipient, sendOrderConfirmationEmail, describeMailDelivery } from "../modules/emailService.js";
import { openChangePasswordModal } from "../modules/changePasswordModal.js";
import { openForgotPasswordModal } from "../modules/forgotPasswordModal.js";
import { printOrderInvoice } from "../modules/exportService.js";
import { getFavoriteDrinks, toggleFavorite } from "../modules/favoritesService.js";
import { ageProblem } from "../modules/age.js";

const bodyEl = document.getElementById("account-body");
let currentCustomerOrders = [];
let activeCustomer = null;

/** Tên hạng theo ngôn ngữ đang chọn (khoá dịch rank_<key>) */
const rankName = (rank) => t(`rank_${rank.key}`, rank.label);

/**
 * Lịch sử điểm của khách, mới nhất trước. Khách cũ chưa có lịch sử (điểm có sẵn từ trước khi có
 * tính năng này) thì thêm một dòng "điểm khởi tạo" bằng phần chênh để tổng dòng luôn khớp tổng điểm.
 */
function buildHistory(customer) {
  const entries = Array.isArray(customer.pointHistory) ? [...customer.pointHistory] : [];
  const recorded = entries.reduce((sum, e) => sum + (Number(e.points) || 0), 0);
  const baseline = (Number(customer.points) || 0) - recorded;
  const rows = entries.sort((a, b) => new Date(b.at) - new Date(a.at));
  if (baseline > 0) rows.push({ type: "opening", points: baseline, at: customer.createdAt || "" });
  return rows;
}

function historyRowHtml(entry) {
  const code = escapeHtml(entry.orderCode || "");
  const label = entry.type === "order"
    ? `${t("acc_h_order", "Đơn")} ${code} · ${formatMoney(entry.total || 0)}`
    : entry.type === "redeem" ? `${t("acc_h_redeem", "Dùng điểm giảm giá cho đơn")} ${code}`
      : entry.type === "refund" ? `${t("acc_h_refund", "Hoàn điểm do huỷ đơn")} ${code}`
        : entry.type === "welcome" ? t("acc_h_welcome", "Điểm chào mừng thành viên mới")
          : t("acc_h_opening", "Điểm có sẵn từ trước");
  const pts = Number(entry.points) || 0;
  return `
    <tr>
      <td class="text-sm">${entry.at ? formatDateTime(entry.at) : "—"}</td>
      <td class="text-sm">${label}</td>
      <td class="${pts < 0 ? "account-points-minus" : "account-points-plus"}">${pts < 0 ? "−" : "+"}${Math.abs(pts)}</td>
    </tr>`;
}

function orderRowHtml(o) {
  const code = escapeHtml(o.code || "");
  const total = formatMoney(o.total || 0);
  const itemsHtml = Array.isArray(o.items) && o.items.length
    ? o.items.map((i) => `<div style="line-height: 1.4;"><strong style="color: var(--cream);">${escapeHtml(i.name)}</strong> <span style="color: var(--amber-soft); font-weight: 600;">x${i.qty}</span></div>`).join("")
    : `<span class="text-muted font-italic">Đặt bàn</span>`;

  const statusBadges = {
    pending: `<span class="badge badge-warning">Chờ xử lý</span>`,
    preparing: `<span class="badge badge-warning" style="background: rgba(197,152,67,0.15); color: var(--amber-soft);">Đang pha chế</span>`,
    completed: `<span class="badge badge-success">Hoàn tất</span>`,
    cancelled: `<span class="badge badge-muted">Đã huỷ</span>`,
  };
  const statusHtml = statusBadges[o.status] || `<span class="badge badge-muted">${escapeHtml(o.status || "")}</span>`;

  let paymentBadgeHtml;
  let payBtnHtml = "";
  if (o.paymentStatus === "paid") {
    paymentBadgeHtml = `<span class="badge badge-success">Đã thanh toán</span>`;
  } else if (o.paymentStatus === "awaiting") {
    paymentBadgeHtml = `<span class="badge badge-warning" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24;">Chờ xác nhận CK</span>`;
  } else {
    paymentBadgeHtml = `<span class="badge badge-danger" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3);">Chưa thanh toán</span>`;
    if (o.status !== "cancelled" && Number(o.total) > 0) {
      payBtnHtml = `
        <button type="button" class="btn btn-primary btn-sm btn-pay-account-order" data-id="${escapeHtml(o.id)}" style="font-size: 0.75rem; padding: 3px 8px; white-space: nowrap;">
          Thanh toán MBBank
        </button>`;
    }
  }

  const printInvoiceBtnHtml = `
    <button type="button" class="btn btn-ghost btn-sm btn-print-account-order" data-id="${escapeHtml(o.id)}" style="font-size: 0.75rem; padding: 3px 8px; white-space: nowrap; color: var(--cream); margin-right: 4px; border: 1px solid rgba(255,255,255,0.15);" title="In hoá đơn thanh toán (PDF)">
      🧾 Hóa đơn
    </button>`;

  const ticketBtnHtml = `
    <button type="button" class="btn btn-ghost btn-sm btn-view-account-ticket" data-id="${escapeHtml(o.id)}" style="font-size: 0.75rem; padding: 3px 8px; white-space: nowrap; color: var(--amber-soft); margin-right: 4px;" title="Xem vé điện tử giống vé xem phim">
      🎟️ Vé điện tử
    </button>`;

  const cancelBtnHtml = o.status === "pending" ? `
    <button type="button" class="btn btn-ghost btn-sm btn-cancel-account-order" data-id="${escapeHtml(o.id)}" data-code="${escapeHtml(o.code)}" data-phone="${escapeHtml(o.phone || '')}" style="font-size: 0.75rem; padding: 3px 8px; white-space: nowrap; color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35); margin-right: 4px;" title="Huỷ đơn đặt này (hoàn lại kho)">
      Huỷ đơn
    </button>` : "";

  return `
    <tr>
      <td class="text-sm font-mono"><strong class="text-amber">${code}</strong></td>
      <td class="text-sm">${o.createdAt ? formatDateTime(o.createdAt) : "—"}</td>
      <td class="text-sm" style="min-width: 180px;">${itemsHtml}</td>
      <td class="text-sm font-bold text-amber">${total}</td>
      <td>${statusHtml}</td>
      <td>${paymentBadgeHtml}</td>
      <td style="text-align: right; white-space: nowrap;">${printInvoiceBtnHtml}${ticketBtnHtml}${cancelBtnHtml}${payBtnHtml}</td>
    </tr>`;
}

function messageCardHtml(m) {
  const replyHtml = m.reply ? `
    <div style="margin-top: 10px; background: rgba(34, 197, 94, 0.08); border-left: 3px solid #22c55e; padding: 10px 14px; border-radius: 4px;">
      <div style="font-size: 0.8rem; color: #4ade80; font-weight: 600; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
        <span>✓ Phản hồi từ quán (${escapeHtml(m.repliedBy || "Quản trị viên")}):</span>
        <span class="text-muted" style="font-weight: normal; font-size: 0.75rem;">${m.repliedAt ? formatDateTime(m.repliedAt) : ""}</span>
      </div>
      <div style="color: var(--cream); font-size: 0.92rem; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(m.reply)}</div>
    </div>` : `
    <div style="margin-top: 8px; font-size: 0.8rem; color: var(--amber-soft); display: flex; align-items: center; gap: 6px;">
      <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--amber);"></span>
      Quán đã tiếp nhận lời nhắn của bạn và đang chuẩn bị phản hồi.
    </div>`;

  return `
    <div class="account-message-card" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 14px; margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
        <div>
          <strong style="color: var(--cream); font-size: 0.95rem;">${escapeHtml(m.subject || "Liên hệ & Góp ý")}</strong>
          <span class="text-xs text-muted" style="margin-left: 8px;">${m.createdAt ? formatDateTime(m.createdAt) : ""}</span>
        </div>
        <div>
          ${m.reply ? '<span class="badge badge-success">Đã có phản hồi</span>' : '<span class="badge badge-warning">Đang xử lý</span>'}
        </div>
      </div>
      <div style="color: rgba(255,255,255,0.78); font-size: 0.9rem; line-height: 1.5; background: rgba(0,0,0,0.2); padding: 8px 12px; border-radius: 6px;">
        "${escapeHtml(m.message || "")}"
      </div>
      ${replyHtml}
    </div>`;
}

function render(customer, myOrders = [], myMessages = [], myFavDrinks = [], myEmails = []) {
  activeCustomer = customer;
  currentCustomerOrders = myOrders;
  window.__myEmails = myEmails;
  const points = Number(customer.points) || 0;       // số dư dùng được
  const lifetime = lifetimeOf(customer);              // tích luỹ trọn đời - dùng để xét hạng (không giảm khi dùng điểm)
  const { current, next, toNext, percent } = rankProgress(lifetime);
  const history = buildHistory(customer);

  const progressText = next
    ? t("acc_to_next", "Còn {n} điểm nữa để lên hạng {rank}").replace("{n}", toNext).replace("{rank}", rankName(next))
    : t("acc_top_rank", "Bạn đã đạt hạng cao nhất. Cảm ơn bạn đã đồng hành cùng quán!");

  const ladder = MEMBER_RANKS.map((rank) => `
    <li class="rank-step ${rank.key === current.key ? "is-current" : ""} ${lifetime >= rank.min ? "is-reached" : ""}" style="--rank-color: ${rank.color}">
      <span class="rank-step-dot"></span>
      <strong>${escapeHtml(rankName(rank))}</strong>
      <span class="text-xs text-muted">${t("acc_from", "từ")} ${rank.min} ${t("acc_pts", "điểm")}</span>
      <span class="text-xs text-amber">${rank.discountPercent > 0 ? t("acc_rank_discount", "Giảm {p}% mọi đơn").replace("{p}", rank.discountPercent) : t("acc_rank_nodiscount", "Chưa có giảm giá")}</span>
    </li>`).join("");

  bodyEl.innerHTML = `
    <!-- KHỐI HỒ SƠ TÀI KHOẢN VÀ ẢNH ĐẠI DIỆN -->
    <div class="account-profile-card">
      <div class="account-profile-main">
        <div class="account-avatar-wrapper">
          <div class="account-avatar-frame">
            ${customer.avatar
              ? `<img src="${escapeHtml(customer.avatar)}" alt="${escapeHtml(customer.name)}" class="account-avatar-img">`
              : `<div class="account-avatar-initial">${escapeHtml((customer.name || "K").charAt(0).toUpperCase())}</div>`}
          </div>
          <div class="account-avatar-actions">
            <label for="input-account-avatar" class="account-avatar-btn-upload" title="Tải ảnh từ máy tính">
              📷 <span>Đổi ảnh</span>
            </label>
            <input type="file" id="input-account-avatar" accept="image/png, image/jpeg, image/webp, image/gif" style="display: none;">
            ${customer.avatar ? `
              <button type="button" class="account-avatar-btn-remove" id="btn-account-avatar-remove" title="Xoá ảnh đại diện">Xoá ảnh</button>
            ` : ""}
          </div>
        </div>

        <div class="account-profile-details">
          <div class="account-profile-chips">
            <h2 class="account-profile-name">${escapeHtml(customer.name)}</h2>
            <span class="account-chip-verified">✓ Đủ 18+</span>
          </div>
          <div class="account-profile-meta">
            <span><strong>SĐT:</strong> ${escapeHtml(customer.phone || "—")}</span>
            <span><strong>Email:</strong> ${escapeHtml(customer.email || "Chưa cập nhật")}</span>
            <span><strong>Ngày sinh:</strong> ${customer.birthDate ? formatDate(customer.birthDate) : "—"}</span>
          </div>
        </div>
      </div>

      <div class="account-profile-actions">
        <button type="button" class="btn btn-ghost btn-sm" id="btn-open-edit-profile" style="border: 1px solid rgba(255,255,255,0.2); color: var(--cream); display: inline-flex; align-items: center; gap: 6px;">
          ✏️ <span>Chỉnh sửa hồ sơ</span>
        </button>
        <button type="button" class="btn btn-ghost btn-sm" id="btn-open-change-pass" style="border: 1px solid rgba(212,175,55,0.4); color: var(--gold-light); display: inline-flex; align-items: center; gap: 6px;">
          🔑 <span>Đổi mật khẩu</span>
        </button>
        <button type="button" class="btn btn-link text-xs" id="btn-open-forgot-pass" style="text-decoration: underline; background: none; border: none; cursor: pointer; padding: 2px 4px; color: var(--amber-soft);">
          Quên mật khẩu?
        </button>
      </div>
    </div>

    <div class="rank-card" style="--rank-color: ${current.color}">
      <div class="rank-card-top">
        <div>
          <span class="rank-card-label">${t("acc_current_rank", "Hạng hiện tại")}</span>
          <h3 class="rank-card-name">${escapeHtml(rankName(current))}</h3>
          <p class="text-sm text-muted">${escapeHtml(customer.name)} · ${escapeHtml(customer.phone || "")}</p>
        </div>
        <div class="rank-card-points">
          <strong>${points}</strong>
          <span>${t("acc_pts_balance", "điểm đang có")}</span>
        </div>
      </div>
      <p class="text-xs text-muted">${t("acc_lifetime", "Điểm tích luỹ xét hạng: {n}").replace("{n}", lifetime)}</p>
      <div class="rank-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
        <div class="rank-progress-fill" style="width: ${percent}%"></div>
      </div>
      <p class="rank-progress-text">${progressText}</p>
    </div>

    <!-- KHỐI ĐƠN HÀNG CỦA KHÁCH: LƯU RÕ TRẠNG THÁI CHƯA THANH TOÁN -->
    <h4 class="account-subtitle" style="display: flex; align-items: center; justify-content: space-between;">
      <span>${t("acc_my_orders", "Đơn hàng của tôi")}</span>
      <span class="text-xs text-muted" style="font-weight: normal;">${myOrders.length} đơn</span>
    </h4>
    ${myOrders.length ? `
    <div class="table-wrap account-orders" style="margin-bottom: 28px;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Mã đơn</th>
            <th>Thời gian</th>
            <th>Món đã gọi</th>
            <th>Tổng tiền</th>
            <th>Trạng thái đơn</th>
            <th>Thanh toán</th>
            <th style="text-align: right;">Thao tác</th>
          </tr>
        </thead>
        <tbody>${myOrders.map(orderRowHtml).join("")}</tbody>
      </table>
    </div>` : `<p class="text-muted" style="margin-bottom: 28px;">Bạn chưa có đơn đặt hàng nào.</p>`}

    
    <!-- KHỐI MÓN UỐNG YÊU THÍCH (WISHLIST) -->
    <h4 class="account-subtitle" style="display: flex; align-items: center; justify-content: space-between;">
      <span>❤️ Món Uống Yêu Thích Của Tôi</span>
      <span class="text-xs text-muted" style="font-weight: normal;">${myFavDrinks.length} món</span>
    </h4>
    ${myFavDrinks.length ? `
    <div class="favorite-drinks-grid account-favorites-wrap" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; margin-bottom: 28px;">
      ${myFavDrinks.map((d) => `
        <div style="display: flex; gap: 12px; align-items: center; padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);">
          <img src="${escapeHtml(d.image || 'img/cocktails/placeholder.jpg')}" alt="${escapeHtml(d.name)}" style="width: 58px; height: 58px; border-radius: 6px; object-fit: cover;">
          <div style="flex: 1; min-width: 0;">
            <h5 style="margin: 0 0 3px 0; font-size: 0.92rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              <a href="detail.html?id=${escapeHtml(d.id)}" style="color: var(--cream); text-decoration: none;">${escapeHtml(d.name)}</a>
            </h5>
            <div style="font-size: 0.8rem; color: var(--amber-soft); font-weight: 600; margin-bottom: 2px;">${formatMoney(d.price)}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(d.category || '')} · ${d.abv || 0}% ABV</div>
          </div>
          <button type="button" class="btn btn-ghost btn-sm btn-remove-account-fav" data-id="${escapeHtml(d.id)}" title="Bỏ yêu thích" style="color: #ef4444; font-size: 1.1rem; padding: 4px 6px;">
            ❤️
          </button>
        </div>
      `).join("")}
    </div>` : `
    <div style="margin-bottom: 28px; padding: 14px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px dashed rgba(255,255,255,0.1);">
      <p class="text-muted text-sm" style="margin-bottom: 6px;">Bạn chưa lưu món cocktail nào vào danh sách yêu thích.</p>
      <a href="menu.html" style="color: var(--amber); font-size: 0.85rem; text-decoration: underline;">Khám phá Thực Đơn &amp; thả tim món bạn thích</a>
    </div>`}
  
    
    <!-- KHỐI HÒM THƯ VÉ ĐIỆN TỬ (CINEMA E-TICKET MAILBOX) -->
    <h4 class="account-subtitle" style="display: flex; align-items: center; justify-content: space-between;">
      <span>✉️ Hòm Thư Vé Điện Tử (Cinema E-Ticket Mailbox)</span>
      <span class="text-xs text-muted" style="font-weight: normal;">${myEmails.length} thư</span>
    </h4>
    ${myEmails.length ? `
    <div class="account-emails-wrap" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 28px;">
      ${myEmails.map((m) => {
        const isWelcome = m.type === "welcome_voucher";
        const icon = isWelcome ? "🎁" : "🎟️";
        const actionBtn = isWelcome ? `
          <button type="button" class="btn btn-primary btn-sm btn-view-welcome-voucher" data-id="${escapeHtml(m.id)}" data-code="${escapeHtml(m.voucherCode || '')}" style="font-size: 0.8rem; padding: 4px 12px; background: linear-gradient(135deg, #d4af37, #b8860b); border: none; color: #000; font-weight: 600;">
            🎁 Xem Mã Giảm 50%
          </button>` : `
          <button type="button" class="btn btn-primary btn-sm btn-view-mailbox-ticket" data-order-code="${escapeHtml(m.orderCode || '')}" data-order-id="${escapeHtml(m.orderId || '')}" style="font-size: 0.8rem; padding: 4px 12px;">
            🎟️ Mở Vé Điện Tử
          </button>`;

        return `
        <div class="account-email-card" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(212,175,55,0.3); border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="font-size: 1.2rem;">${icon}</span>
              <strong style="color: var(--cream); font-size: 0.95rem;">${escapeHtml(m.subject || "Thông báo từ Quán Bar Đêm")}</strong>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; gap: 14px; flex-wrap: wrap;">
              <span>Gửi lúc: <strong>${m.sentAt ? formatDateTime(m.sentAt) : "—"}</strong></span>
              <span>Đến: <strong style="color: #4ade80;">${escapeHtml(m.to || "")}</strong></span>
              ${isWelcome ? `<span style="color: #facc15; font-weight: 600;">Mã ưu đãi: ${escapeHtml(m.voucherCode || 'WELCOME50')} (Giảm 50% tổng bill)</span>` : (m.orderSummary ? `<span>Tổng tiền: <strong class="text-amber">${formatMoney(m.orderSummary.total || 0)}</strong></span>` : "")}
            </div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            ${actionBtn}
            <a href="mailto:${escapeHtml(m.to || '')}?subject=${encodeURIComponent(m.subject || '')}" class="btn btn-outline btn-sm" style="font-size: 0.8rem; padding: 4px 10px;">
              Hòm thư Gmail
            </a>
          </div>
        </div>`;
      }).join("")}
    </div>` : `
    <div style="margin-bottom: 28px; padding: 14px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px dashed rgba(255,255,255,0.1);">
      <p class="text-muted text-sm" style="margin-bottom: 6px;">Chưa có thư vé điện tử nào. Khi bạn đặt bàn hoặc thanh toán chuyển khoản, vé điện tử và email xác nhận sẽ được tự động lưu tại đây.</p>
    </div>`}
  
    <!-- KHỐI TIN NHẮN & PHẢN HỒI TỪ QUÁN -->
    <h4 class="account-subtitle" style="display: flex; align-items: center; justify-content: space-between;">
      <span>Ý kiến &amp; Phản hồi từ Quán Bar</span>
      <span class="text-xs text-muted" style="font-weight: normal;">${myMessages.length} tin nhắn</span>
    </h4>
    ${myMessages.length ? `
    <div class="account-messages-wrap" style="margin-bottom: 28px;">
      ${myMessages.map(messageCardHtml).join("")}
      <div style="text-align: right; margin-top: 8px;">
        <a href="contact.html" class="btn btn-ghost btn-sm" style="font-size: 0.8rem;">+ Gửi thêm ý kiến / góp ý mới</a>
      </div>
    </div>` : `
    <div style="margin-bottom: 28px; padding: 14px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px dashed rgba(255,255,255,0.1);">
      <p class="text-muted text-sm" style="margin-bottom: 6px;">Bạn chưa gửi câu hỏi hoặc ý kiến đóng góp nào tới quán.</p>
      <a href="contact.html" style="color: var(--amber); font-size: 0.85rem; text-decoration: underline;">Gửi lời nhắn / đóng góp ý kiến ngay</a>
    </div>`}

    <h4 class="account-subtitle">${t("acc_ladder", "Các hạng thành viên")}</h4>
    <ol class="rank-ladder">${ladder}</ol>
    <p class="text-xs text-muted account-rule">${t("acc_rule", "Quy đổi: mỗi {vnd} của đơn hoàn tất = 1 điểm. Điểm chỉ được cộng khi quán xác nhận đơn Hoàn tất; đơn bị huỷ không được tính.").replace("{vnd}", formatMoney(POINT_VALUE_VND))}</p>
    <p class="text-xs text-muted account-rule">${t("acc_rule_redeem", "Dùng điểm: 1 điểm = {vnd} khi đặt món, từ {min} điểm mỗi lần và tối đa {share}% giá trị đơn. Dùng điểm không làm tụt hạng; đơn huỷ sẽ được hoàn điểm.").replace("{vnd}", formatMoney(POINT_REDEEM_VND)).replace("{min}", MIN_POINT_REDEEM).replace("{share}", MAX_POINT_REDEEM_SHARE * 100)}</p>

    <h4 class="account-subtitle">${t("acc_history", "Lịch sử điểm")}</h4>
    ${history.length ? `
    <div class="table-wrap account-history">
      <table class="data-table">
        <thead><tr><th>${t("acc_h_time", "Thời gian")}</th><th>${t("acc_h_desc", "Nội dung")}</th><th>${t("acc_h_pts", "Điểm")}</th></tr></thead>
        <tbody>${history.map(historyRowHtml).join("")}</tbody>
      </table>
    </div>` : `<p class="text-muted">${t("acc_no_history", "Chưa có lịch sử điểm. Hãy đặt món để bắt đầu tích điểm!")}</p>`}

    <div class="account-actions">
      <a href="order.html" class="btn btn-primary">${t("acc_order_now", "Đặt bàn & gọi món")}</a>
    </div>`;
}

function openEditProfileModal(customer, onSuccess) {
  const existing = document.getElementById("modal-edit-profile");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "modal-edit-profile";
  modal.className = "modal-overlay is-open";
  modal.innerHTML = `
    <div class="modal-dialog" style="max-width: 440px;">
      <div class="modal-head" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.08);">
        <h3 class="modal-title" style="margin: 0; font-size: 1.1rem; color: var(--cream);">✏️ Chỉnh sửa thông tin cá nhân</h3>
        <button type="button" class="modal-close" id="btn-close-edit-profile" aria-label="Đóng" style="background: none; border: none; color: var(--text-muted); font-size: 1.4rem; cursor: pointer;">&times;</button>
      </div>
      <form id="form-edit-profile" style="padding: 16px 20px;">
        <div class="form-group" style="margin-bottom: 14px;">
          <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 5px;">Họ và tên *</label>
          <input type="text" id="edit-profile-name" class="form-control" value="${escapeHtml(customer.name || '')}" required style="width: 100%;">
        </div>
        <div class="form-group" style="margin-bottom: 14px;">
          <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 5px;">Email nhận vé &amp; thông báo</label>
          <input type="email" id="edit-profile-email" class="form-control" value="${escapeHtml(customer.email || '')}" style="width: 100%;">
        </div>
        <div class="form-group" style="margin-bottom: 14px;">
          <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 5px;">Ngày sinh (Yêu cầu đủ 18+)</label>
          <input type="date" id="edit-profile-birth" class="form-control" value="${escapeHtml(customer.birthDate || '')}" style="width: 100%;">
          <div id="edit-profile-age-error" class="text-xs" style="color: #f87171; margin-top: 4px; display: none;"></div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
          <button type="button" class="btn btn-ghost" id="btn-cancel-edit-profile">Huỷ</button>
          <button type="submit" class="btn btn-primary" id="btn-submit-edit-profile">Lưu thay đổi</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector("#btn-close-edit-profile").addEventListener("click", close);
  modal.querySelector("#btn-cancel-edit-profile").addEventListener("click", close);

  const form = modal.querySelector("#form-edit-profile");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = modal.querySelector("#edit-profile-name").value.trim();
    const email = modal.querySelector("#edit-profile-email").value.trim();
    const birthDate = modal.querySelector("#edit-profile-birth").value.trim();

    if (!name) {
      toast("Vui lòng nhập họ và tên.", "warning");
      return;
    }

    if (birthDate) {
      const problem = ageProblem(birthDate);
      if (problem) {
        const errEl = modal.querySelector("#edit-profile-age-error");
        errEl.textContent = problem;
        errEl.style.display = "block";
        return;
      }
    }

    const submitBtn = modal.querySelector("#btn-submit-edit-profile");
    submitBtn.disabled = true;
    submitBtn.textContent = "Đang lưu...";

    try {
      await updateCustomerProfile(customer.id, { name, email, birthDate });
      toast("Cập nhật thông tin thành công!", "success");
      close();
      if (typeof onSuccess === "function") onSuccess();
    } catch (err) {
      toast(err.message || "Lỗi khi cập nhật thông tin.", "danger");
      submitBtn.disabled = false;
      submitBtn.textContent = "Lưu thay đổi";
    }
  });
}

async function init() {
  const session = getCurrentCustomer();
  if (!session) {
    window.location.href = "customer-auth.html";
    return;
  }

  bodyEl.innerHTML = loadingHtml(t("acc_loading", "Đang tải thông tin thành viên..."));
  try {
    const [customer, rawOrders, rawMessages, rawDrinks, rawEmails] = await Promise.all([
      api.get(`/customers/${encodeURIComponent(session.id)}`),
      api.get("/orders").catch(() => []),
      api.get("/messages").catch(() => []),
      api.get("/drinks").catch(() => []),
      getEmailsByRecipient(session.email).catch(() => []),
    ]);
    const orders = (Array.isArray(rawOrders) ? rawOrders : [])
      .filter((o) => (o.customerId && String(o.customerId) === String(customer.id)) || (o.phone && o.phone === customer.phone))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const messages = (Array.isArray(rawMessages) ? rawMessages : [])
      .filter((m) => {
        const matchPhone = m.phone && customer.phone && String(m.phone).trim() === String(customer.phone).trim();
        const matchEmail = m.email && customer.email && String(m.email).trim().toLowerCase() === String(customer.email).trim().toLowerCase();
        return matchPhone || matchEmail;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const favDrinks = getFavoriteDrinks(Array.isArray(rawDrinks) ? rawDrinks : []);
    const emails = Array.isArray(rawEmails) ? rawEmails : [];
    render(customer, orders, messages, favDrinks, emails);
  } catch (err) {
    bodyEl.innerHTML = err.status === 404
      ? errorHtml(t("acc_not_found", "Không tìm thấy hồ sơ thành viên. Vui lòng đăng nhập lại."))
      : errorHtml(err.message);
  }
}

bodyEl.addEventListener("change", (e) => {
  if (e.target && e.target.id === "input-account-avatar") {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast("Vui lòng chọn file hình ảnh (PNG, JPG, WebP, GIF).", "warning");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast("Dung lượng ảnh tối đa là 2MB. Vui lòng chọn ảnh nhỏ hơn.", "warning");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      try {
        await updateCustomerAvatar(activeCustomer.id, dataUrl);
        toast("Cập nhật ảnh đại diện thành công!", "success");
        init();
      } catch (err) {
        toast(err.message || "Không thể lưu ảnh đại diện.", "danger");
      }
    };
    reader.readAsDataURL(file);
  }
});

bodyEl.addEventListener("click", async (e) => {
  // In hoá đơn PDF
  const printBtn = e.target.closest(".btn-print-account-order");
  if (printBtn) {
    const orderId = printBtn.dataset.id;
    const order = currentCustomerOrders.find((o) => String(o.id) === String(orderId));
    if (order) {
      printOrderInvoice(order);
    } else {
      toast("Không tìm thấy thông tin đơn hàng để in.", "error");
    }
    return;
  }

  // Xoá món khỏi danh sách yêu thích
  const removeFavBtn = e.target.closest(".btn-remove-account-fav");
  if (removeFavBtn) {
    const drinkId = removeFavBtn.dataset.id;
    toggleFavorite(drinkId);
    toast("Đã bỏ món khỏi danh sách yêu thích.", "info");
    init();
    return;
  }

  // Chỉnh sửa hồ sơ
  const editProfileBtn = e.target.closest("#btn-open-edit-profile");
  if (editProfileBtn) {
    openEditProfileModal(activeCustomer, () => {
      init();
    });
    return;
  }

  // Huỷ đơn đặt hàng
  const cancelOrderBtn = e.target.closest(".btn-cancel-account-order");
  if (cancelOrderBtn) {
    const code = cancelOrderBtn.dataset.code;
    const phone = cancelOrderBtn.dataset.phone || activeCustomer?.phone;
    const ok = await confirmDialog(`Bạn có chắc chắn muốn huỷ đơn ${code}? Quán sẽ tự động hoàn lại tồn kho ly và cập nhật trạng thái đơn.`, {
      title: "Xác nhận huỷ đơn",
      okText: "Huỷ đơn",
      danger: true,
    });
    if (!ok) return;
    try {
      await cancelByCustomer(code, phone);
      toast(`Đã huỷ đơn ${code} thành công và hoàn trả kho.`, "info");
      init();
    } catch (err) {
      toast(err.message || "Không thể huỷ đơn lúc này.", "danger");
    }
    return;
  }

  // Đổi mật khẩu
  const changePassBtn = e.target.closest("#btn-open-change-pass");
  if (changePassBtn) {
    openChangePasswordModal(activeCustomer, () => {
      init();
    });
    return;
  }

  // Quên mật khẩu
  const forgotPassBtn = e.target.closest("#btn-open-forgot-pass");
  if (forgotPassBtn) {
    openForgotPasswordModal(activeCustomer?.phone || activeCustomer?.email || "", () => {
      init();
    });
    return;
  }

  // Xoá ảnh đại diện
  const removeAvatarBtn = e.target.closest("#btn-account-avatar-remove");
  if (removeAvatarBtn) {
    const ok = await confirmDialog("Bạn có chắc chắn muốn gỡ bỏ ảnh đại diện hiện tại?", {
      title: "Gỡ ảnh đại diện",
      okText: "Gỡ ảnh",
    });
    if (!ok) return;
    try {
      await updateCustomerAvatar(activeCustomer.id, "");
      toast("Đã gỡ bỏ ảnh đại diện.", "info");
      init();
    } catch (err) {
      toast(err.message || "Lỗi khi gỡ ảnh đại diện.", "danger");
    }
    return;
  }

  // Xem thư quà tặng chào mừng giảm 50%
  const welcomeVoucherBtn = e.target.closest(".btn-view-welcome-voucher");
  if (welcomeVoucherBtn) {
    const emailId = welcomeVoucherBtn.dataset.id;
    const emailRec = (window.__myEmails || []).find((em) => em.id === emailId) || {
      to: activeCustomer?.email,
      voucherCode: welcomeVoucherBtn.dataset.code || "WELCOME50",
      discountPercent: 50,
    };
    openWelcomeVoucherModal(emailRec);
    return;
  }

  // Mở vé điện tử từ hòm thư
  const mailboxTicketBtn = e.target.closest(".btn-view-mailbox-ticket");
  if (mailboxTicketBtn) {
    const orderCode = mailboxTicketBtn.dataset.orderCode;
    const orderId = mailboxTicketBtn.dataset.orderId;
    const order = currentCustomerOrders.find((o) => o.code === orderCode || o.id === orderId);
    if (order) {
      openCinemaTicketModal(order, { toEmail: activeCustomer?.email || order.email });
    } else {
      toast("Không tìm thấy thông tin đơn vé này.", "warning");
    }
    return;
  }

  const ticketBtn = e.target.closest(".btn-view-account-ticket");
  if (ticketBtn) {
    const orderId = ticketBtn.dataset.id;
    const order = currentCustomerOrders.find((o) => o.id === orderId);
    if (order) {
      const session = getCurrentCustomer();
      openCinemaTicketModal(order, { toEmail: session?.email || order.email });
    }
    return;
  }

  const btn = e.target.closest(".btn-pay-account-order");
  if (!btn) return;
  const orderId = btn.dataset.id;
  const order = currentCustomerOrders.find((o) => o.id === orderId);
  if (!order) return;

  openVietQRPaymentModal(order, {
    confirmLabel: "Tôi Đã Chuyển Khoản Xong",
    onConfirm: async () => {
      await reportTransferSent(order.id);
      const session = getCurrentCustomer();
      const freshOrder = await api.get(`/orders/${encodeURIComponent(order.id)}`).catch(() => ({ ...order, paymentStatus: "awaiting" }));
      const mail = await sendOrderConfirmationEmail(freshOrder, session);
      const targetEmail = freshOrder.email || session?.email || "";
      toast(`Đã ghi nhận chuyển khoản cho đơn ${order.code} - quán sẽ đối chiếu và xác nhận sớm.`, "success");
      const note = describeMailDelivery(mail, freshOrder);
      toast(note.message, note.type);
      openCinemaTicketModal(freshOrder, { toEmail: targetEmail });
      init();
    },
  });
});

init();
window.addEventListener("languagechange", init);

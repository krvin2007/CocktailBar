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
import { getCurrentCustomer, MEMBER_RANKS, rankProgress, lifetimeOf, POINT_VALUE_VND } from "../modules/customerAuth.js";
import { POINT_REDEEM_VND, MIN_POINT_REDEEM, MAX_POINT_REDEEM_SHARE } from "../modules/promotions.js";
import { loadingHtml, errorHtml, toast } from "../modules/ui.js";
import { escapeHtml, formatMoney, formatDateTime } from "../modules/utils.js";
import { t } from "../modules/i18n.js";
import { openVietQRPaymentModal } from "../modules/vietqrService.js";
import { reportTransferSent } from "../modules/ordersService.js";

const bodyEl = document.getElementById("account-body");
let currentCustomerOrders = [];

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

  return `
    <tr>
      <td class="text-sm font-mono"><strong class="text-amber">${code}</strong></td>
      <td class="text-sm">${o.createdAt ? formatDateTime(o.createdAt) : "—"}</td>
      <td class="text-sm" style="min-width: 180px;">${itemsHtml}</td>
      <td class="text-sm font-bold text-amber">${total}</td>
      <td>${statusHtml}</td>
      <td>${paymentBadgeHtml}</td>
      <td style="text-align: right; white-space: nowrap;">${payBtnHtml || "—"}</td>
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

function render(customer, myOrders = [], myMessages = []) {
  currentCustomerOrders = myOrders;
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

async function init() {
  const session = getCurrentCustomer();
  if (!session) {
    window.location.href = "customer-auth.html";
    return;
  }

  bodyEl.innerHTML = loadingHtml(t("acc_loading", "Đang tải thông tin thành viên..."));
  try {
    const [customer, rawOrders, rawMessages] = await Promise.all([
      api.get(`/customers/${encodeURIComponent(session.id)}`),
      api.get("/orders").catch(() => []),
      api.get("/messages").catch(() => []),
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

    render(customer, orders, messages);
  } catch (err) {
    bodyEl.innerHTML = err.status === 404
      ? errorHtml(t("acc_not_found", "Không tìm thấy hồ sơ thành viên. Vui lòng đăng nhập lại."))
      : errorHtml(err.message);
  }
}

bodyEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".btn-pay-account-order");
  if (!btn) return;
  const orderId = btn.dataset.id;
  const order = currentCustomerOrders.find((o) => o.id === orderId);
  if (!order) return;

  openVietQRPaymentModal(order, {
    confirmLabel: "Tôi Đã Chuyển Khoản Xong",
    onConfirm: async () => {
      await reportTransferSent(order.id);
      toast(`Đã gửi báo cáo chuyển khoản cho đơn ${order.code}. Quán sẽ kiểm tra và xác nhận sớm!`, "success");
      init();
    },
  });
});

init();
window.addEventListener("languagechange", init);

/* =========================================================
   CUSTOMER-ACCOUNT.JS - Trang "Hạng thành viên & Điểm thưởng" của khách
   Đọc hồ sơ khách từ máy chủ (GET /customers/:id) rồi hiện:
   - hạng hiện tại + tổng điểm
   - thanh tiến độ tới hạng kế tiếp
   - bậc thang các hạng
   - lịch sử điểm (mỗi đơn hoàn tất = 1 dòng)
   ========================================================= */

import "../modules/navbar.js";
import { api } from "../modules/api.js";
import { getCurrentCustomer, MEMBER_RANKS, rankProgress, lifetimeOf, POINT_VALUE_VND } from "../modules/customerAuth.js";
import { POINT_REDEEM_VND, MIN_POINT_REDEEM, MAX_POINT_REDEEM_SHARE } from "../modules/promotions.js";
import { loadingHtml, errorHtml } from "../modules/ui.js";
import { escapeHtml, formatMoney, formatDateTime } from "../modules/utils.js";
import { t } from "../modules/i18n.js";

const bodyEl = document.getElementById("account-body");

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

function render(customer) {
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
    const customer = await api.get(`/customers/${encodeURIComponent(session.id)}`);
    render(customer);
  } catch (err) {
    bodyEl.innerHTML = err.status === 404
      ? errorHtml(t("acc_not_found", "Không tìm thấy hồ sơ thành viên. Vui lòng đăng nhập lại."))
      : errorHtml(err.message);
  }
}

init();
window.addEventListener("languagechange", init);

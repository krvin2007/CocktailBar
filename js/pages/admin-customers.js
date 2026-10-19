/* =========================================================
   ADMIN-CUSTOMERS.JS - Danh sách khách hàng thành viên: hạng, điểm, chi tiêu
   Đọc GET /customers + GET /orders (Promise.all). Chỉ XEM - điểm do hệ thống tự cộng khi
   đơn Hoàn tất (ordersService.updateOrderStatus), không sửa tay để sổ điểm luôn khớp đơn hàng.
   ========================================================= */

import { initAdminLayout } from "../modules/adminLayout.js";
import { getAllCustomers, MEMBER_RANKS, rankForPoints, lifetimeOf } from "../modules/customerAuth.js";
import { getAllOrders } from "../modules/ordersService.js";
import { normalizePhone, formatMoney, formatDate, formatDateTime, debounce, paginate, renderPagination, escapeHtml } from "../modules/utils.js";
import { openModal, closeModal } from "../modules/ui.js";

const bodyEl = document.getElementById("customers-body");
const paginationEl = document.getElementById("pagination");
const keywordInput = document.getElementById("f-keyword");
const rankSelect = document.getElementById("f-rank");
const sortSelect = document.getElementById("f-sort");

let rows = [];
let currentPage = 1;

const rankBadge = (rank) => `<span class="rank-badge" style="--rank-color: ${rank.color}">${escapeHtml(rank.label)}</span>`;

/** Gắn thống kê đơn vào từng khách: khớp theo customerId hoặc số điện thoại, chỉ tính đơn Hoàn tất */
function buildRows(customers, orders) {
  const completed = orders.filter((o) => o.status === "completed");
  return customers.map((customer) => {
    const phone = normalizePhone(customer.phone);
    const mine = completed.filter((o) => o.customerId === customer.id || (phone && normalizePhone(o.phone) === phone));
    return {
      customer,
      rank: rankForPoints(lifetimeOf(customer)),
      orderCount: mine.length,
      spent: mine.reduce((sum, o) => sum + o.total, 0),
    };
  });
}

function filtered() {
  const kw = keywordInput.value.trim().toLowerCase();
  let list = rows.filter(({ customer, rank }) => {
    if (rankSelect.value !== "all" && rank.key !== rankSelect.value) return false;
    if (!kw) return true;
    return [customer.name, customer.phone, customer.email].some((v) => String(v || "").toLowerCase().includes(kw));
  });
  const sorters = {
    "points-desc": (a, b) => (b.customer.points || 0) - (a.customer.points || 0),
    "spent-desc": (a, b) => b.spent - a.spent,
    newest: (a, b) => new Date(b.customer.createdAt || 0) - new Date(a.customer.createdAt || 0),
    "name-asc": (a, b) => String(a.customer.name).localeCompare(String(b.customer.name), "vi"),
  };
  list = [...list].sort(sorters[sortSelect.value] || sorters["points-desc"]);
  return list;
}

function rowHtml({ customer, rank, orderCount, spent }) {
  return `
    <tr data-id="${escapeHtml(customer.id)}">
      <td>
        <strong>${escapeHtml(customer.name)}</strong>
        <div class="text-xs text-muted">${customer.createdAt ? `Tham gia ${formatDate(customer.createdAt)}` : ""}</div>
      </td>
      <td class="text-sm">${escapeHtml(customer.phone || "")}${customer.email ? `<div class="text-xs text-muted">${escapeHtml(customer.email)}</div>` : ""}</td>
      <td>${rankBadge(rank)}</td>
      <td><strong>${Number(customer.points) || 0}</strong></td>
      <td>${orderCount}</td>
      <td><strong>${formatMoney(spent)}</strong></td>
      <td class="cell-actions" style="text-align: right;">
        <button type="button" class="btn btn-ghost btn-sm" data-action="history">Lịch sử điểm</button>
      </td>
    </tr>`;
}

function renderTable() {
  const list = filtered();
  const { items, page, totalPages } = paginate(list, currentPage, 8);
  currentPage = page;
  bodyEl.innerHTML = items.length ? items.map(rowHtml).join("")
    : `<tr><td colspan="7" class="table-empty py-4 text-center text-muted">${rows.length ? "Không có khách phù hợp với bộ lọc." : "Chưa có khách hàng thành viên nào."}</td></tr>`;
  renderPagination(paginationEl, page, totalPages, (p) => { currentPage = p; renderTable(); });
}

/** Nội dung một dòng lịch sử điểm theo loại giao dịch */
function historyLabel(e) {
  if (e.type === "order") return `Đơn ${escapeHtml(e.orderCode || "")} · ${formatMoney(e.total || 0)}`;
  if (e.type === "redeem") return `Dùng điểm giảm giá cho đơn ${escapeHtml(e.orderCode || "")}`;
  if (e.type === "refund") return `Hoàn điểm do đơn ${escapeHtml(e.orderCode || "")} bị huỷ`;
  if (e.type === "welcome") return "Điểm chào mừng thành viên mới";
  return "Điểm có sẵn từ trước";
}

function openHistory({ customer, rank }) {
  const entries = [...(Array.isArray(customer.pointHistory) ? customer.pointHistory : [])].sort((a, b) => new Date(b.at) - new Date(a.at));
  const recorded = entries.reduce((sum, e) => sum + (Number(e.points) || 0), 0);
  const baseline = (Number(customer.points) || 0) - recorded;
  const line = (e) => `
    <tr>
      <td class="text-sm">${e.at ? formatDateTime(e.at) : "—"}</td>
      <td class="text-sm">${historyLabel(e)}</td>
      <td class="${Number(e.points) < 0 ? "account-points-minus" : "account-points-plus"}">${Number(e.points) < 0 ? "−" : "+"}${Math.abs(Number(e.points) || 0)}</td>
    </tr>`;
  const all = baseline > 0 ? [...entries.map(line), line({ type: "opening", points: baseline, at: customer.createdAt })] : entries.map(line);

  document.getElementById("customer-modal-title").textContent = `${customer.name} — ${rank.label} · ${customer.points || 0} điểm`;
  document.getElementById("customer-modal-body").innerHTML = all.length
    ? `<table class="data-table"><thead><tr><th>Thời gian</th><th>Nội dung</th><th>Điểm</th></tr></thead><tbody>${all.join("")}</tbody></table>`
    : `<p class="text-muted">Chưa có điểm nào được ghi nhận.</p>`;
  openModal("customer-modal");
}

async function reload() {
  try {
    const [customers, orders] = await Promise.all([getAllCustomers(), getAllOrders()]);
    rows = buildRows(customers, orders);
    renderTable();
  } catch (err) {
    bodyEl.innerHTML = `<tr><td colspan="7" class="table-empty py-4 text-center text-muted">${escapeHtml(err.message)}</td></tr>`;
  }
}

bodyEl.addEventListener("click", (e) => {
  const btn = e.target.closest('button[data-action="history"]');
  if (!btn) return;
  const row = rows.find((r) => r.customer.id === btn.closest("tr").dataset.id);
  if (row) openHistory(row);
});

if (initAdminLayout("Khách Hàng Thành Viên")) {
  MEMBER_RANKS.forEach((rank) => rankSelect.insertAdjacentHTML("beforeend", `<option value="${rank.key}">${escapeHtml(rank.label)}</option>`));
  const debounced = debounce(() => { currentPage = 1; renderTable(); }, 250);
  keywordInput.addEventListener("input", debounced);
  [rankSelect, sortSelect].forEach((el) => el.addEventListener("change", () => { currentPage = 1; renderTable(); }));
  document.getElementById("customer-modal-close").addEventListener("click", () => closeModal("customer-modal"));
  bodyEl.innerHTML = `<tr><td colspan="7" class="table-empty py-4 text-center text-muted">Đang tải danh sách khách hàng...</td></tr>`;
  reload();
}

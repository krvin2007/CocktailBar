/* =========================================================
   ADMIN-DASHBOARD.JS - Trang thống kê tổng quan
   ========================================================= */

import { initAdminLayout } from "../modules/adminLayout.js";
import { getAllDrinks } from "../modules/drinksService.js";
import { getAllOrders } from "../modules/ordersService.js";
import { formatMoney, formatDateTime, escapeHtml } from "../modules/utils.js";
import { ICONS } from "../modules/icons.js";
import { errorHtml } from "../modules/ui.js";

/* Dữ liệu tải từ API trong init() */
let drinks = [];
let orders = [];
let activeOrders = [];

/* ---------------- Thẻ thống kê tổng quan ---------------- */
function renderStatCards() {
  const totalRevenue = orders
    .filter((o) => o.status === "completed")
    .reduce((sum, o) => sum + o.total, 0);

  const pendingCount = orders.filter((o) => o.status === "pending").length;

  const cards = [
    { icon: ICONS.cocktail(22), value: drinks.length, label: "Thức uống trong Menu" },
    { icon: ICONS.receipt(22), value: orders.length, label: "Tổng lượt đặt chỗ" },
    { icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`, value: formatMoney(totalRevenue), label: "Doanh thu thực thu" },
    { icon: ICONS.clock(22), value: pendingCount, label: "Đơn cần xử lý ngay" },
  ];

  const host = document.getElementById("stat-cards");
  if (!host) return;

  host.innerHTML = cards.map((c) => `
    <div class="stat-card">
      <div class="stat-icon-wrapper">${c.icon}</div>
      <div class="stat-details">
        <strong class="stat-value">${c.value}</strong>
        <span class="stat-label">${c.label}</span>
      </div>
    </div>`).join("");
}

/* ---------------- Biểu đồ doanh thu 7 ngày gần nhất ---------------- */
function renderRevenueChart() {
  const chartEl = document.getElementById("revenue-chart");
  if (!chartEl) return;

  const completedOrders = orders.filter((o) => o.status === "completed");

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d);
  }

  const revenueByDay = days.map((d) => {
    const key = d.toDateString();
    const total = completedOrders
      .filter((o) => new Date(o.createdAt).toDateString() === key)
      .reduce((sum, o) => sum + o.total, 0);
    return { date: d, total };
  });

  const maxTotal = Math.max(...revenueByDay.map((r) => r.total), 1);

  chartEl.innerHTML = revenueByDay.map((r) => `
    <div class="bar-chart-col">
      <span class="bar-chart-value">${r.total > 0 ? Math.round(r.total / 1000) + "k" : "0"}</span>
      <div class="bar-chart-bar-wrap">
        <div class="bar-chart-bar" style="height:${Math.max(6, (r.total / maxTotal) * 100)}%"></div>
      </div>
      <span class="bar-chart-label">${r.date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}</span>
    </div>`).join("");
}

/* ---------------- Top món bán chạy ---------------- */
function renderTopDrinks() {
  const host = document.getElementById("top-drinks");
  if (!host) return;

  // Gộp theo drinkId (không theo tên): đổi tên món thì lịch sử bán vẫn liền mạch
  const soldMap = activeOrders
    .flatMap((o) => o.items)
    .reduce((map, item) => {
      const prev = map.get(item.drinkId) || { name: item.name, qty: 0 };
      map.set(item.drinkId, { name: prev.name, qty: prev.qty + item.qty });
      return map;
    }, new Map());

  // Ưu tiên tên hiện tại trong thực đơn, món đã bị xoá thì dùng tên lúc bán
  const currentNames = new Map(drinks.map((d) => [d.id, d.name]));
  const ranked = [...soldMap.entries()]
    .map(([id, info]) => [currentNames.get(id) || info.name, info.qty])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  host.innerHTML = ranked.length ? ranked.map(([name, qty], i) => `
    <div class="rank-item">
      <span class="rank-num ${i === 0 ? 'rank-first' : ''}">0${i + 1}</span>
      <div class="rank-info">
        <p class="rank-name">${escapeHtml(name)}</p>
        <p class="rank-sub">Thức uống Signature</p>
      </div>
      <span class="rank-count"><strong>${qty}</strong> ly</span>
    </div>`).join("") : '<p class="text-muted p-3">Chưa có dữ liệu bán hàng.</p>';
}

/* ---------------- Đơn hàng gần đây ---------------- */

function renderRecentOrders() {
  const tbody = document.getElementById("recent-orders-body");
  if (!tbody) return;

  const recent = [...orders]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);

  tbody.innerHTML = recent.length ? recent.map((o) => `
    <tr>
      <td><strong class="text-amber">${escapeHtml(o.code)}</strong></td>
      <td>
        <div><strong>${escapeHtml(o.name)}</strong></div>
        <div class="text-muted text-xs">${escapeHtml(o.phone)}</div>
      </td>
      <td><span class="text-sm">${o.serviceLabel}</span></td>
      <td><strong>${formatMoney(o.total)}</strong></td>
      <td><span class="badge ${o.statusBadge}">${o.statusLabel}</span></td>
      <td class="text-muted text-sm">${formatDateTime(o.createdAt)}</td>
    </tr>`).join("") : '<tr><td colspan="6" class="text-center text-muted py-4">Chưa có đơn hàng nào phát sinh.</td></tr>';
}

/** Tải đồng thời đồ uống + đơn hàng (2 request song song bằng Promise.all) */
async function init() {
  try {
    [drinks, orders] = await Promise.all([getAllDrinks(), getAllOrders()]);
    activeOrders = orders.filter((o) => o.status !== "cancelled");

    renderStatCards();
    renderRevenueChart();
    renderTopDrinks();
    renderRecentOrders();
  } catch (err) {
    const host = document.getElementById("stat-cards");
    if (host) host.innerHTML = errorHtml(err.message);
  }
}

if (initAdminLayout("Bảng Điều Hành")) {
  init();
}

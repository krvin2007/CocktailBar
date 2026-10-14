/* =========================================================
   ADMIN-DASHBOARD.JS - Trang thống kê tổng quan
   Ngoài doanh thu & đơn hàng, bảng điều hành theo dõi chương trình
   giá: số món đang sale theo món, số món mới (tự giảm 10%), tổng tiền
   đã giảm theo mã giảm giá, và danh sách món đang có giá ưu đãi.
   Top bán chạy dùng chung rankBestSellers() với trang chủ & trợ lý AI.
   ========================================================= */

import { initAdminLayout } from "../modules/adminLayout.js";
import {
  getAllDrinks, getCategoryLabel, getDrinkPricing, rankBestSellers, normalizeSalePercent,
  NEW_DRINK_DAYS,
} from "../modules/drinksService.js";
import { getAllOrders } from "../modules/ordersService.js";
import { formatMoney, formatDateTime, escapeHtml } from "../modules/utils.js";
import { ICONS } from "../modules/icons.js";
import { errorHtml } from "../modules/ui.js";

/* Dữ liệu tải từ API trong init() */
let drinks = [];
let orders = [];

/** Biểu tượng phiếu giảm giá (vé có răng cưa) cho thẻ KPI giảm theo mã */
const TICKET_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9a3 3 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a3 3 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z"/><line x1="9" y1="9" x2="15" y2="15"/><circle cx="9.5" cy="14.5" r="0.6"/><circle cx="14.5" cy="9.5" r="0.6"/></svg>`;

/* ---------------- Thẻ thống kê tổng quan ---------------- */
function renderStatCards() {
  const completedOrders = orders.filter((o) => o.status === "completed");
  const totalRevenue = completedOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  const pendingCount = orders.filter((o) => o.status === "pending").length;

  // Chương trình giá: sale theo món (quản trị chọn) và món mới (tự động theo ngày tạo)
  const saleCount = drinks.filter((d) => normalizeSalePercent(d.salePercent) > 0).length;
  const newCount = drinks.filter((d) => getDrinkPricing(d).isNew).length;

  const cards = [
    { icon: ICONS.cocktail(22), value: drinks.length, label: "Thức uống trong Menu" },
    { icon: ICONS.receipt(22), value: orders.length, label: "Tổng lượt đặt chỗ" },
    { icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`, value: formatMoney(totalRevenue), label: "Doanh thu thực thu" },
    { icon: ICONS.clock(22), value: pendingCount, label: "Đơn cần xử lý ngay" },
    { icon: ICONS.flame(22), value: saleCount, label: "Món đang sale", accent: "sale" },
    { icon: ICONS.sparkle(22), value: newCount, label: `Món mới (${NEW_DRINK_DAYS} ngày)`, accent: "new" },
  ];

  // Đơn tạo từ khi có mã giảm giá mới mang trường "discount"; dữ liệu cũ
  // chưa có trường này thì ẩn thẻ, tránh hiển thị con số 0đ gây hiểu lầm
  const hasVoucherData = orders.some((o) => o && o.discount !== undefined && o.discount !== null);
  if (hasVoucherData) {
    const voucherDiscount = completedOrders.reduce((sum, o) => sum + (Number(o.discount) || 0), 0);
    cards.push({ icon: TICKET_ICON, value: formatMoney(voucherDiscount), label: "Tổng giảm giá theo mã", accent: "voucher" });
  }

  const host = document.getElementById("stat-cards");
  if (!host) return;

  host.innerHTML = cards.map((c) => `
    <div class="stat-card${c.accent ? ` stat-card-${c.accent}` : ""}">
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

  // rankBestSellers tự bỏ đơn đã huỷ, gộp theo drinkId (đổi tên món vẫn liền mạch)
  // và chỉ giữ món còn trong thực đơn - cùng một quy tắc với trang chủ
  const ranked = rankBestSellers(drinks, orders, 5);

  host.innerHTML = ranked.length ? ranked.map(({ drink, sold }, i) => {
    const pricing = getDrinkPricing(drink);
    return `
    <div class="rank-item">
      <span class="rank-num ${i === 0 ? "rank-first" : ""}">0${i + 1}</span>
      <div class="rank-info">
        <p class="rank-name">${escapeHtml(drink.name)}</p>
        <p class="rank-sub">
          ${escapeHtml(getCategoryLabel(drink.category))} · ${formatMoney(pricing.finalPrice)}
          ${pricing.onSale ? `<span class="pricing-badge pricing-badge-sale">-${pricing.percent}%</span>` : ""}
          ${pricing.isNew ? `<span class="pricing-badge pricing-badge-new">Mới</span>` : ""}
        </p>
      </div>
      <span class="rank-count"><strong>${sold}</strong> ly</span>
    </div>`;
  }).join("") : '<p class="text-muted p-3">Chưa có dữ liệu bán hàng.</p>';
}

/* ---------------- Món đang có giá ưu đãi ---------------- */
function renderPromoDrinks() {
  const tbody = document.getElementById("promo-drinks-body");
  if (!tbody) return;

  // Giảm sâu nhất lên đầu; cùng mức thì món tiết kiệm nhiều tiền hơn đứng trước
  const promo = drinks
    .map((drink) => ({ drink, pricing: getDrinkPricing(drink) }))
    .filter(({ pricing }) => pricing.onSale)
    .sort((a, b) => b.pricing.percent - a.pricing.percent
      || (b.pricing.originalPrice - b.pricing.finalPrice) - (a.pricing.originalPrice - a.pricing.finalPrice));

  const countEl = document.getElementById("promo-drinks-count");
  if (countEl) countEl.textContent = `${promo.length} món`;

  tbody.innerHTML = promo.length ? promo.map(({ drink, pricing }) => `
    <tr>
      <td><strong>${escapeHtml(drink.name)}</strong>
        <div class="text-muted text-xs">${escapeHtml(getCategoryLabel(drink.category))}</div></td>
      <td>${pricing.reason === "new"
        ? `<span class="pricing-badge pricing-badge-new">Món mới -${pricing.percent}%</span>`
        : `<span class="pricing-badge pricing-badge-sale">Sale ${pricing.percent}%</span>`}</td>
      <td><s class="admin-price-old">${formatMoney(pricing.originalPrice)}</s></td>
      <td><strong class="text-amber">${formatMoney(pricing.finalPrice)}</strong></td>
      <td class="text-sm">${formatMoney(pricing.originalPrice - pricing.finalPrice)}</td>
    </tr>`).join("")
    : '<tr><td colspan="5" class="text-center text-muted py-4">Chưa có món nào đang giảm giá. Vào "Quản lý thực đơn" để chọn mức sale.</td></tr>';
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
      <td>
        <strong>${formatMoney(o.total)}</strong>
        ${Number(o.discount) > 0 ? `<div class="text-muted text-xs">Mã ${escapeHtml(o.voucherCode || "")}: -${formatMoney(o.discount)}</div>` : ""}
      </td>
      <td><span class="badge ${o.statusBadge}">${o.statusLabel}</span></td>
      <td class="text-muted text-sm">${formatDateTime(o.createdAt)}</td>
    </tr>`).join("") : '<tr><td colspan="6" class="text-center text-muted py-4">Chưa có đơn hàng nào phát sinh.</td></tr>';
}

/** Tải đồng thời đồ uống + đơn hàng (2 request song song bằng Promise.all) */
async function init() {
  try {
    [drinks, orders] = await Promise.all([getAllDrinks(), getAllOrders()]);

    renderStatCards();
    renderRevenueChart();
    renderTopDrinks();
    renderPromoDrinks();
    renderRecentOrders();
  } catch (err) {
    const host = document.getElementById("stat-cards");
    if (host) host.innerHTML = errorHtml(err.message);
  }
}

if (initAdminLayout("Bảng Điều Hành")) {
  init();
}

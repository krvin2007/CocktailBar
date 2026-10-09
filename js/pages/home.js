/* =========================================================
   HOME.JS - Logic riêng cho trang chủ (index.html)
   ========================================================= */

import "../modules/navbar.js";
import { getAllDrinks, CATEGORY_LABELS, getCategoryLabel } from "../modules/drinksService.js";
import { getAllOrders } from "../modules/ordersService.js";
import { drinkCardHtml } from "../modules/drinkCard.js";
import { ICONS } from "../modules/icons.js";
import { loadingHtml, errorHtml } from "../modules/ui.js";
import { initLounge3D } from "../modules/lounge3d.js";
import { t } from "../modules/i18n.js";

const CATEGORY_ICONS = {
  classic: ICONS.cocktail(20),
  signature: ICONS.sparkle(20),
  "sour-fizz": `<svg class="ui-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 2h8l-1.5 18a2 2 0 0 1-2 2H9.5a2 2 0 0 1-2-2L6 2zM5 7h14M12 2v5"/></svg>`,
  aperitivo: ICONS.wine(20),
  spirits: `<svg class="ui-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4h14l-1.5 15a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8L5 4zM6 9h12"/><circle cx="12" cy="14" r="2"/></svg>`,
};

let cachedDrinks = null;

/** Dải danh mục dẫn sang trang thực đơn có sẵn bộ lọc */
function renderCategoryStrip() {
  const host = document.getElementById("category-strip");
  if (!host) return;

  host.innerHTML = Object.keys(CATEGORY_LABELS).map((key) => `
    <a class="category-chip" href="menu.html?category=${key}">
      <span class="category-chip-icon">${CATEGORY_ICONS[key] || ICONS.cocktail(20)}</span>
      <span class="category-chip-label">${getCategoryLabel(key)}</span>
      <span class="category-chip-arrow">${ICONS.arrowRight(13)}</span>
    </a>`).join("");
}

function renderFeatured(drinks) {
  const host = document.getElementById("featured-grid");
  if (!host) return;

  const items = drinks.filter((d) => d.featured).slice(0, 4);
  host.innerHTML = items.length
    ? items.map(drinkCardHtml).join("")
    : `<div class="empty-state">
        <div class="empty-icon">${ICONS.cocktail(32)}</div>
        <p>${t("empty_featured", "Danh sách món nổi bật đang được cập nhật.")}</p>
       </div>`;
}

function renderStats(drinks, orders) {
  const drinksEl = document.getElementById("stat-drinks");
  const ordersEl = document.getElementById("stat-orders");

  if (drinksEl) drinksEl.textContent = drinks.length;
  if (ordersEl) {
    // Số liệu thật từ máy chủ, không cộng thêm số "trang trí"
    const servedCount = orders.filter((o) => o.status === "completed").length;
    ordersEl.textContent = servedCount;
  }
}

/** Tải đồng thời đồ uống + đơn hàng bằng Promise.all (2 request chạy song song) */
async function loadHomeData() {
  const featuredHost = document.getElementById("featured-grid");
  if (featuredHost) featuredHost.innerHTML = loadingHtml();

  try {
    const [drinks, orders] = await Promise.all([getAllDrinks(), getAllOrders()]);
    cachedDrinks = drinks;
    renderFeatured(drinks);
    renderStats(drinks, orders);
  } catch (err) {
    if (featuredHost) featuredHost.innerHTML = errorHtml(err.message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderCategoryStrip();
  loadHomeData();
  initLounge3D("lounge-3d-mount");

  window.addEventListener("languagechange", () => {
    renderCategoryStrip();
    if (cachedDrinks) {
      renderFeatured(cachedDrinks);
    }
  });
});

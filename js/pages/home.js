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
import { t, getCurrentLang } from "../modules/i18n.js";
import { VENUE, OPENING_HOURS, localized, mapsSearchUrl } from "../modules/venue.js";
import { renderVenueMap } from "../modules/venueMap.js";
import { escapeHtml } from "../modules/utils.js";

const CATEGORY_ICONS = {
  classic: ICONS.cocktail(20),
  signature: ICONS.sparkle(20),
  "sour-fizz": `<svg class="ui-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 2h8l-1.5 18a2 2 0 0 1-2 2H9.5a2 2 0 0 1-2-2L6 2zM5 7h14M12 2v5"/></svg>`,
  aperitivo: ICONS.wine(20),
  "zero-proof": `<svg class="ui-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`,
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

/**
 * Mục "Địa điểm": vẽ toàn bộ từ dữ liệu VENUE / OPENING_HOURS (venue.js).
 * Bản đồ là iframe nhúng Google Maps (không cần API key); nút "Mở Google
 * Maps" mở chỉ đường ở tab mới.
 */
function renderLocation() {
  const host = document.getElementById("location");
  if (!host) return;
  const lang = getCurrentLang();
  const en = lang === "en";

  host.innerHTML = `
    <img class="location-bg" src="${VENUE.image}" alt="" loading="lazy">
    <div class="location-index" aria-hidden="true">
      <span>${VENUE.index}</span><span class="location-index-line"></span><span>${VENUE.city}</span>
    </div>
    <div class="location-inner">
      <div class="location-info">
        <span class="location-eyebrow">Location</span>
        <h2 class="location-title" id="location-title">${escapeHtml(localized(VENUE.title, lang))}</h2>
        <p class="location-tagline">${escapeHtml(localized(VENUE.tagline, lang))}</p>
        <span class="location-accent"></span>

        <dl class="location-details">
          <div class="location-item">
            <dt>${en ? "Address" : "Địa chỉ"}</dt>
            <dd class="location-address">${escapeHtml(VENUE.address)}</dd>
          </div>
          <div class="location-item">
            <dt>${en ? "Opening hours" : "Giờ mở cửa"}</dt>
            <dd class="location-hours">
              ${OPENING_HOURS.map((r) => `<span>${escapeHtml(localized(r.label, lang))}: ${r.open} – ${r.close}</span>`).join("")}
            </dd>
          </div>
          <div class="location-item">
            <dt>Hotline</dt>
            <dd><a class="location-hotline" href="tel:${VENUE.hotline.replace(/\s/g, "")}">${escapeHtml(VENUE.hotline)}</a></dd>
          </div>
        </dl>

        <a class="location-maps-btn" href="${mapsSearchUrl()}" target="_blank" rel="noopener">
          ${en ? "Open Google Maps" : "Mở Google Maps"}
        </a>
      </div>

      <div class="location-map">
        <div class="venue-map" id="location-map-canvas" role="img" aria-label="${en ? "Map" : "Bản đồ"}: ${escapeHtml(VENUE.address)}"></div>
      </div>
    </div>`;

  renderVenueMap(document.getElementById("location-map-canvas"), { lang });
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
  renderLocation();
  loadHomeData();
  initLounge3D("lounge-3d-mount");

  window.addEventListener("languagechange", () => {
    renderCategoryStrip();
    renderLocation();
    if (cachedDrinks) {
      renderFeatured(cachedDrinks);
    }
  });
});

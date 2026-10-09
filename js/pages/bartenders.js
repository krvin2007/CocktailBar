/* =========================================================
   BARTENDERS.JS - Logic for Master Bartenders Exhibition Page
   Handles category filtering, instant search, and full
   career chronicle modal dialogs.
   ========================================================= */

import "../modules/navbar.js";
import { BARTENDERS_COLLECTION, BARTENDER_CATEGORIES } from "../modules/bartendersData.js";
import { getCollection } from "../modules/api.js";
import { loadingHtml, errorHtml } from "../modules/ui.js";
import { ICONS } from "../modules/icons.js";
import { escapeHtml } from "../modules/utils.js";
import { portraitHtml } from "../modules/portrait.js";

let currentCategory = "all";
/** Dữ liệu tải từ API (GET /bartenders); máy chủ chưa chạy thì dùng dữ liệu đóng gói sẵn */
let collection = [];
let currentSearch = "";

/** Khởi tạo tabs bộ lọc */
function renderFilterTabs() {
  const tabsHost = document.getElementById("bartender-tabs");
  if (!tabsHost) return;

  tabsHost.innerHTML = Object.entries(BARTENDER_CATEGORIES).map(([key, label]) => `
    <button type="button" class="legend-tab-btn ${key === currentCategory ? 'active' : ''}" data-cat="${key}">
      ${label}
    </button>`).join("");

  tabsHost.querySelectorAll(".legend-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      tabsHost.querySelectorAll(".legend-tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentCategory = btn.getAttribute("data-cat") || "all";
      renderBartendersGrid();
    });
  });
}

/** Tạo HTML cho thẻ Master Bartender */
function bartenderCardHtml(item) {
  const drinksHtml = (item.signatureDrinks || []).map((d) => `
    <div class="legend-item-pill">
      <div class="legend-item-head">
        <span class="legend-item-name">${escapeHtml(d.name)} (${d.year})</span>
        ${d.onMenu ? `
          <a href="order.html" class="crafted-badge-inmenu" title="Có phục vụ tại quán - Bấm để gọi món">
            ${ICONS.checkCircle(12)}
            <span>Có trong Menu 🍸</span>
          </a>
        ` : `
          <span class="legend-item-sub">${escapeHtml(d.glass)}</span>
        `}
      </div>
      <p class="legend-item-desc">${escapeHtml(d.desc)}</p>
      <div style="font-size: 0.76rem; color: var(--amber-dark); margin-top: 4px; font-family: monospace;">
        <strong>Công thức:</strong> ${escapeHtml(d.recipe)}
      </div>
    </div>
  `).join("");

  const accoladesHtml = (item.accolades || []).map((acc) => `
    <span class="legend-accolade-chip">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      <span>${escapeHtml(acc)}</span>
    </span>
  `).join("");

  return `
    <article class="legend-card" id="card-${item.id}">
      <div class="legend-portrait-wrap">
        ${portraitHtml(item)}
        <div class="legend-portrait-overlay"></div>
        <div class="legend-tag-row">
          <span class="legend-badge">“${escapeHtml(item.nickname)}”</span>
          <span class="legend-era-badge">${escapeHtml(item.categoryLabel)}</span>
        </div>
      </div>

      <div class="legend-card-body">
        <div class="legend-header">
          <h3 class="legend-name">${escapeHtml(item.name)}</h3>
          <p class="legend-subtitle">${escapeHtml(item.origin)} • ${escapeHtml(item.currentBase)}</p>
        </div>

        <div class="legend-meta-grid">
          <div class="legend-meta-item">
            <span class="legend-meta-k">Niên đại hoạt động</span>
            <span class="legend-meta-v">${escapeHtml(item.yearsActive)}</span>
          </div>
          <div class="legend-meta-item">
            <span class="legend-meta-k">Thánh đường biểu tượng</span>
            <span class="legend-meta-v">${escapeHtml(item.venues[0])}</span>
          </div>
        </div>

        <p class="legend-quote">${escapeHtml(item.philosophy)}</p>

        <div class="legend-highlights-box">
          <h4 class="legend-highlights-title">
            ${ICONS.cocktail(15)}
            <span>Signature Serves &amp; Công Thức Bất Hủ</span>
          </h4>
          <div class="legend-items-list">
            ${drinksHtml}
          </div>
        </div>

        <div class="legend-accolades">
          ${accoladesHtml}
        </div>

        <div class="legend-card-foot">
          <button type="button" class="btn btn-outline btn-sm open-dossier-btn" data-id="${item.id}">
            Xem Tiểu Sử &amp; Giai Thoại
          </button>
          <a href="order.html" class="btn btn-primary btn-sm">
            Thưởng thức tại Bar
          </a>
        </div>
      </div>
    </article>`;
}

/** Render danh sách Bartenders */
function renderBartendersGrid() {
  const host = document.getElementById("bartenders-grid");
  const countEl = document.getElementById("bartenders-count");
  if (!host) return;

  const query = currentSearch.trim().toLowerCase();

  const filtered = collection.filter((item) => {
    const matchCat = currentCategory === "all" || item.category === currentCategory;
    if (!matchCat) return false;

    if (!query) return true;

    const haystack = [
      item.name,
      item.nickname,
      item.origin,
      item.currentBase,
      item.philosophy,
      item.biography,
      item.categoryLabel,
      ...(item.venues || []),
      ...(item.accolades || []),
      ...(item.signatureDrinks || []).map((d) => `${d.name} ${d.desc} ${d.recipe}`)
    ].join(" ").toLowerCase();

    return haystack.includes(query);
  });

  if (countEl) {
    countEl.innerHTML = `Hiển thị <strong>${filtered.length}</strong> / ${collection.length} Master Bartenders`;
  }

  if (filtered.length === 0) {
    host.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 60px 20px; text-align: center;">
        <div class="empty-icon" style="margin-bottom: 16px;">${ICONS.search(36)}</div>
        <h3>Không tìm thấy Master Bartender phù hợp</h3>
        <p class="text-muted">Vui lòng thử từ khóa khác (ví dụ: Savoy, Martini, Ueno, DeGroff, London, Paris)...</p>
      </div>`;
    return;
  }

  host.innerHTML = filtered.map(bartenderCardHtml).join("");

  // Gắn sự kiện modal
  host.querySelectorAll(".open-dossier-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const found = collection.find((b) => b.id === id);
      if (found) openBartenderModal(found);
    });
  });
}

/** Mở modal chi tiết Bartender */
function openBartenderModal(bartender) {
  const modal = document.getElementById("bartender-modal");
  if (!modal) return;

  const titleEl = document.getElementById("modal-name");
  const subEl = document.getElementById("modal-subtitle");
  const quoteEl = document.getElementById("modal-quote");
  const bioEl = document.getElementById("modal-bio");
  const venuesEl = document.getElementById("modal-venues");
  const drinksEl = document.getElementById("modal-drinks");
  const accoladesEl = document.getElementById("modal-accolades");

  if (titleEl) titleEl.textContent = `${bartender.name} “${bartender.nickname}”`;
  if (subEl) subEl.textContent = `${bartender.categoryLabel} • ${bartender.origin} • Hoạt động: ${bartender.yearsActive}`;
  if (quoteEl) quoteEl.textContent = bartender.philosophy;
  if (bioEl) bioEl.innerHTML = bartender.biography.split("\n\n").map((p) => `<p style="margin-bottom: 12px; line-height: 1.7; color: var(--text-muted);">${escapeHtml(p)}</p>`).join("");

  if (venuesEl) {
    venuesEl.innerHTML = (bartender.venues || []).map((v) => `
      <li style="color: var(--text-main); font-size: 0.9rem; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
        <span style="color: var(--amber); font-size: 1rem;">✦</span>
        <span>${escapeHtml(v)}</span>
      </li>
    `).join("");
  }

  if (drinksEl) {
    drinksEl.innerHTML = (bartender.signatureDrinks || []).map((d) => `
      <div style="background: rgba(197, 152, 67, 0.08); border: 1px solid var(--border-soft); border-radius: var(--radius-sm); padding: 12px 16px; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-wrap: wrap; gap: 8px;">
          <strong style="color: var(--amber-soft); font-size: 0.95rem;">${escapeHtml(d.name)} (${d.year})</strong>
          <span style="font-size: 0.75rem; color: var(--text-dim);">${escapeHtml(d.glass)}</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px; line-height: 1.5;">${escapeHtml(d.desc)}</p>
        <div style="font-size: 0.8rem; color: var(--amber-dark); font-family: monospace;">Công thức: ${escapeHtml(d.recipe)}</div>
      </div>
    `).join("");
  }

  if (accoladesEl) {
    accoladesEl.innerHTML = (bartender.accolades || []).map((acc) => `
      <span class="legend-accolade-chip" style="font-size: 0.82rem; padding: 6px 12px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        <span>${escapeHtml(acc)}</span>
      </span>
    `).join("");
  }

  modal.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeBartenderModal() {
  const modal = document.getElementById("bartender-modal");
  if (!modal) return;
  modal.classList.remove("open");
  document.body.style.overflow = "";
}

/** Lắng nghe DOMContentLoaded */
document.addEventListener("DOMContentLoaded", async () => {
  renderFilterTabs();

  const host = document.getElementById("bartenders-grid");
  if (host) host.innerHTML = loadingHtml("Đang tải danh sách Master Bartenders...");
  try {
    collection = await getCollection("bartenders", BARTENDERS_COLLECTION);
    renderBartendersGrid();
  } catch (err) {
    if (host) host.innerHTML = errorHtml(err.message);
  }

  const searchInput = document.getElementById("bartenders-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearch = e.target.value;
      renderBartendersGrid();
    });
  }

  const modal = document.getElementById("bartender-modal");
  const closeBtn = document.getElementById("modal-close-btn");
  if (closeBtn) closeBtn.addEventListener("click", closeBartenderModal);
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeBartenderModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeBartenderModal();
  });
});

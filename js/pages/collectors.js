/* =========================================================
   COLLECTORS.JS - Logic for Legendary Spirits & Wine Collectors Page
   Handles category filtering, instant search, and full
   vault chronicle modal dialogs.
   ========================================================= */

import "../modules/navbar.js";
import { COLLECTORS_COLLECTION, COLLECTOR_CATEGORIES } from "../modules/collectorsData.js";
import { COLLECTOR_CATEGORIES_EN, COLLECTORS_EN } from "../modules/collectorsEn.js";
import { localizeItem, localizeLabels } from "../modules/contentLang.js";
import { getCurrentLang, t } from "../modules/i18n.js";
import { getCollection } from "../modules/api.js";
import { loadingHtml, errorHtml } from "../modules/ui.js";
import { ICONS } from "../modules/icons.js";
import { escapeHtml } from "../modules/utils.js";
import { portraitHtml } from "../modules/portrait.js";

let currentCategory = "all";
/** Dữ liệu tải từ API (GET /collectors); máy chủ chưa chạy thì dùng dữ liệu đóng gói sẵn */
let collection = [];

/** Danh sách theo ngôn ngữ đang chọn: bản tiếng Anh ghép đè lên dữ liệu gốc (xem contentLang.js) */
const localized = () => collection.map((item) => localizeItem(item, COLLECTORS_EN, getCurrentLang()));
let currentSearch = "";

/** Render các tab bộ lọc danh mục */
function renderFilterTabs() {
  const tabsHost = document.getElementById("collector-tabs");
  if (!tabsHost) return;

  tabsHost.innerHTML = Object.entries(localizeLabels(COLLECTOR_CATEGORIES, COLLECTOR_CATEGORIES_EN, getCurrentLang())).map(([key, label]) => `
    <button type="button" class="legend-tab-btn ${key === currentCategory ? 'active' : ''}" data-cat="${key}">
      ${label}
    </button>`).join("");

  tabsHost.querySelectorAll(".legend-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      tabsHost.querySelectorAll(".legend-tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentCategory = btn.getAttribute("data-cat") || "all";
      renderCollectorsGrid();
    });
  });
}

/** Tạo HTML cho thẻ Collector */
function collectorCardHtml(item) {
  const crownJewelsHtml = (item.crownJewels || []).map((cj) => `
    <div class="legend-item-pill">
      <div class="legend-item-head">
        <span class="legend-item-name">${escapeHtml(cj.bottle)}</span>
        <span class="legend-item-sub">${escapeHtml(cj.highlight)}</span>
      </div>
      <p class="legend-item-desc">${escapeHtml(cj.detail)}</p>
    </div>
  `).join("");

  return `
    <article class="legend-card" id="card-${item.id}">
      <div class="legend-portrait-wrap">
        ${portraitHtml(item)}
        <div class="legend-portrait-overlay"></div>
        <div class="legend-tag-row">
          <span class="legend-badge">${escapeHtml(item.country)}</span>
          <span class="legend-era-badge">${escapeHtml(item.categoryLabel)}</span>
        </div>
      </div>

      <div class="legend-card-body">
        <div class="legend-header">
          <h3 class="legend-name">${escapeHtml(item.name)}</h3>
          <p class="legend-subtitle">${escapeHtml(item.title)}</p>
        </div>

        <div class="legend-meta-grid">
          <div class="legend-meta-item">
            <span class="legend-meta-k">${t("col_meta_vault", "Hầm lưu trữ")}</span>
            <span class="legend-meta-v">${escapeHtml(item.vaultName)}</span>
          </div>
          <div class="legend-meta-item">
            <span class="legend-meta-k">${t("col_meta_scale", "Quy mô bộ sưu tập")}</span>
            <span class="legend-meta-v" style="color: var(--amber-soft);">${escapeHtml(item.collectionScale)}</span>
          </div>
          <div class="legend-meta-item">
            <span class="legend-meta-k">${t("col_meta_value", "Định giá ước tính")}</span>
            <span class="legend-meta-v">${escapeHtml(item.estimatedValue)}</span>
          </div>
          <div class="legend-meta-item">
            <span class="legend-meta-k">${t("col_meta_specialty", "Trọng tâm sưu tầm")}</span>
            <span class="legend-meta-v">${escapeHtml(item.specialty)}</span>
          </div>
        </div>

        <p class="legend-quote">${escapeHtml(item.philosophy)}</p>

        <div class="legend-highlights-box">
          <h4 class="legend-highlights-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            <span>${t("col_jewels_title", "Báu Vật Độc Bản trong Hầm Rượu")}</span>
          </h4>
          <div class="legend-items-list">
            ${crownJewelsHtml}
          </div>
        </div>

        <div class="legend-card-foot">
          <button type="button" class="btn btn-outline btn-sm open-dossier-btn" data-id="${item.id}">
            ${t("col_view_vault", "Xem Hồ Sơ Hầm Rượu")}
          </button>
          <a href="spirits.html" class="btn btn-primary btn-sm">
            ${t("col_view_spirits", "Xem Rượu Tại Hầm Bar 🥃")}
          </a>
        </div>
      </div>
    </article>`;
}

/** Render danh sách Collectors */
function renderCollectorsGrid() {
  const host = document.getElementById("collectors-grid");
  const countEl = document.getElementById("collectors-count");
  if (!host) return;

  const query = currentSearch.trim().toLowerCase();

  const view = localized();
  const filtered = view.filter((item) => {
    const matchCat = currentCategory === "all" || item.category === currentCategory;
    if (!matchCat) return false;

    if (!query) return true;

    const haystack = [
      item.name,
      item.title,
      item.country,
      item.vaultName,
      item.collectionScale,
      item.specialty,
      item.philosophy,
      item.biography,
      item.categoryLabel,
      ...(item.crownJewels || []).map((cj) => `${cj.bottle} ${cj.detail} ${cj.highlight}`)
    ].join(" ").toLowerCase();

    return haystack.includes(query);
  });

  if (countEl) {
    countEl.innerHTML = t("col_count", "Hiển thị <strong>{n}</strong> / {total} nhà sưu tầm huyền thoại")
      .replace("{n}", filtered.length).replace("{total}", view.length);
  }

  if (filtered.length === 0) {
    host.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 60px 20px; text-align: center;">
        <div class="empty-icon" style="margin-bottom: 16px;">${ICONS.search(36)}</div>
        <h3>${t("col_empty_title", "Không tìm thấy nhà sưu tầm phù hợp")}</h3>
        <p class="text-muted">${t("col_empty_hint", "Vui lòng thử từ khóa khác (ví dụ: Macallan 1926, France, Islay, Karuizawa, Chasseuil, Gooding)...")}</p>
      </div>`;
    return;
  }

  host.innerHTML = filtered.map(collectorCardHtml).join("");

  // Gắn sự kiện modal
  host.querySelectorAll(".open-dossier-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const found = localized().find((c) => c.id === id);
      if (found) openCollectorModal(found);
    });
  });
}

/** Mở modal chi tiết Collector */
function openCollectorModal(collector) {
  const modal = document.getElementById("collector-modal");
  if (!modal) return;

  const titleEl = document.getElementById("modal-name");
  const subEl = document.getElementById("modal-subtitle");
  const quoteEl = document.getElementById("modal-quote");
  const bioEl = document.getElementById("modal-bio");
  const vaultEl = document.getElementById("modal-vault-info");
  const jewelsEl = document.getElementById("modal-crown-jewels");

  if (titleEl) titleEl.textContent = collector.name;
  if (subEl) subEl.textContent = `${collector.title} • ${collector.country} • ${t("col_collecting_time", "Thời gian sưu tầm:")} ${collector.yearsCollecting}`;
  if (quoteEl) quoteEl.textContent = collector.philosophy;
  if (bioEl) bioEl.innerHTML = collector.biography.split("\n\n").map((p) => `<p style="margin-bottom: 12px; line-height: 1.7; color: var(--text-muted);">${escapeHtml(p)}</p>`).join("");

  if (vaultEl) {
    vaultEl.innerHTML = `
      <div style="background: rgba(19, 15, 12, 0.8); border: 1px solid var(--border-soft); border-radius: var(--radius-sm); padding: 14px 18px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
        <div>
          <span style="font-size: 0.75rem; color: var(--text-dim); text-transform: uppercase;">${t("col_modal_vault", "Hầm Lưu Trữ")}</span>
          <div style="font-size: 0.92rem; color: var(--text-main); font-weight: 500; margin-top: 2px;">${escapeHtml(collector.vaultName)}</div>
        </div>
        <div>
          <span style="font-size: 0.75rem; color: var(--text-dim); text-transform: uppercase;">${t("col_modal_scale", "Quy Mô & Định Giá").replace("&", "&amp;")}</span>
          <div style="font-size: 0.92rem; color: var(--amber-soft); font-weight: 600; margin-top: 2px;">${escapeHtml(collector.collectionScale)} (${escapeHtml(collector.estimatedValue)})</div>
        </div>
      </div>
    `;
  }

  if (jewelsEl) {
    jewelsEl.innerHTML = (collector.crownJewels || []).map((cj) => `
      <div style="background: rgba(197, 152, 67, 0.08); border: 1px solid var(--border-soft); border-radius: var(--radius-sm); padding: 12px 16px; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-wrap: wrap; gap: 8px;">
          <strong style="color: var(--amber-soft); font-size: 0.95rem;">${escapeHtml(cj.bottle)}</strong>
          <span style="font-size: 0.75rem; color: var(--text-dim);">${escapeHtml(cj.highlight)}</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5;">${escapeHtml(cj.detail)}</p>
      </div>
    `).join("");
  }

  modal.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeCollectorModal() {
  const modal = document.getElementById("collector-modal");
  if (!modal) return;
  modal.classList.remove("open");
  document.body.style.overflow = "";
}

// Đổi VI/EN: vẽ lại thẻ + bộ lọc bằng bản dịch tương ứng (chữ tĩnh trong HTML do applyI18n lo)
window.addEventListener("languagechange", () => {
  renderFilterTabs();
  if (collection.length) renderCollectorsGrid();
});

/** Lắng nghe DOMContentLoaded */
document.addEventListener("DOMContentLoaded", async () => {
  renderFilterTabs();

  const host = document.getElementById("collectors-grid");
  const countBox = document.getElementById("collectors-count");
  if (countBox) countBox.textContent = t("col_loading_count", "Đang tải dữ liệu hầm rượu sưu tầm...");
  if (host) host.innerHTML = loadingHtml(t("col_loading", "Đang tải danh sách nhà sưu tầm..."));
  try {
    collection = await getCollection("collectors", COLLECTORS_COLLECTION);
    renderCollectorsGrid();
  } catch (err) {
    if (host) host.innerHTML = errorHtml(err.message);
  }

  const searchInput = document.getElementById("collectors-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearch = e.target.value;
      renderCollectorsGrid();
    });
  }

  const modal = document.getElementById("collector-modal");
  const closeBtn = document.getElementById("modal-close-btn");
  if (closeBtn) closeBtn.addEventListener("click", closeCollectorModal);
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeCollectorModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCollectorModal();
  });
});

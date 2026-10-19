/* =========================================================
   SPIRITS.JS - Logic hiển thị phòng trưng bày chai rượu & hương vị
   Quản lý bộ lọc theo dòng rượu, tìm kiếm theo hương vị/tên,
   kích hoạt modal hồ sơ di sản chuẩn Sommelier.
   ========================================================= */

import "../modules/navbar.js";
import { SPIRITS_COLLECTION, SPIRIT_FAMILIES } from "../modules/spiritsData.js";
import { SPIRIT_FAMILIES_EN, SPIRITS_EN } from "../modules/spiritsEn.js";
import { localizeItem, localizeLabels } from "../modules/contentLang.js";
import { getCurrentLang, t } from "../modules/i18n.js";
import { getCollection } from "../modules/api.js";
import { loadingHtml, errorHtml } from "../modules/ui.js";
import { ICONS } from "../modules/icons.js";
import { escapeHtml } from "../modules/utils.js";

let currentFamily = "all";
/** Dữ liệu tải từ API (GET /spirits); máy chủ chưa chạy thì dùng dữ liệu đóng gói sẵn */
let collection = [];

/** Danh sách theo ngôn ngữ đang chọn: bản tiếng Anh ghép đè lên dữ liệu gốc (xem contentLang.js) */
const localized = () => collection.map((item) => localizeItem(item, SPIRITS_EN, getCurrentLang()));
let currentSearch = "";

/** Khởi tạo các tab phân loại dòng rượu */
function renderFilterTabs() {
  const tabsHost = document.getElementById("spirits-tabs");
  if (!tabsHost) return;

  tabsHost.innerHTML = Object.entries(localizeLabels(SPIRIT_FAMILIES, SPIRIT_FAMILIES_EN, getCurrentLang())).map(([key, label]) => `
    <button type="button" class="spirit-tab-btn ${key === currentFamily ? 'active' : ''}" data-family="${key}">
      ${label}
    </button>`).join("");

  tabsHost.querySelectorAll(".spirit-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      tabsHost.querySelectorAll(".spirit-tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFamily = btn.getAttribute("data-family") || "all";
      renderSpiritsGrid();
    });
  });
}

/** Tạo HTML cho một thẻ chai rượu di sản */
function spiritCardHtml(item) {
  const craftedList = (item.craftedCocktails || []).map((c) => `
    <div class="crafted-item">
      <div class="crafted-item-head">
        <span class="crafted-name">
          ${escapeHtml(c.name)}
          <span class="crafted-cat-tag">(${escapeHtml(c.category)})</span>
        </span>
        ${c.inMenu ? `
          <a href="order.html" class="crafted-badge-inmenu" title="${t("sp_in_menu_title", "Có phục vụ tại quán - Bấm để gọi món hoặc đặt bàn")}">
            ${ICONS.checkCircle(13)}
            <span>${t("bt_in_menu", "Có trong Menu 🍸")}</span>
          </a>
        ` : `
          <span style="font-size: 0.72rem; color: var(--text-dim);">Classic Standard</span>
        `}
      </div>
      <p class="crafted-desc">${escapeHtml(c.desc)}</p>
      <div class="crafted-recipe-row">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span><strong>${t("bt_recipe", "Công thức:")}</strong> ${escapeHtml(c.recipe)}</span>
      </div>
    </div>
  `).join("");

  return `
    <article class="spirit-card" id="card-${item.id}">
      <div class="spirit-showcase-header">
        <div class="spirit-bottle-real-wrap" title="${escapeHtml(item.fullName)}">
          ${item.image
            ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" class="real-bottle-img" loading="lazy">`
            : `<div class="bottle-missing">${ICONS.wine(34)}<span>${t("sp_no_photo", "Chưa có ảnh đúng chai")}</span></div>`}
        </div>

        <div class="spirit-header-content">
          <div class="spirit-badge-row">
            <span class="spirit-family-badge">${item.familyLabel}</span>
            <span class="spirit-seal-chip">${item.badgeLabel}</span>
            <span class="spirit-seal-chip">${item.abv}% ABV</span>
          </div>
          <h3 class="spirit-title">${escapeHtml(item.name)}</h3>
          <p class="spirit-tagline">“${escapeHtml(item.tagline)}”</p>
        </div>
      </div>

      <div class="spirit-specs-grid">
        <div class="spirit-spec-item">
          <span class="spirit-spec-title">${t("sp_spec_origin", "Xuất xứ & Nhà chưng cất").replace(/&/g, "&amp;")}</span>
          <span class="spirit-spec-val">${escapeHtml(item.origin)}</span>
        </div>
        <div class="spirit-spec-item">
          <span class="spirit-spec-title">${t("sp_spec_history", "Lịch sử & Nồng độ (Proof)").replace(/&/g, "&amp;")}</span>
          <span class="spirit-spec-val">Est. ${escapeHtml(item.established)} • ${item.proof}</span>
        </div>
        <div class="spirit-spec-item">
          <span class="spirit-spec-title">${t("sp_spec_cask", "Kỹ nghệ ủ thùng (Cask Maturation)")}</span>
          <span class="spirit-spec-val">${escapeHtml(item.caskType)}</span>
        </div>
        <div class="spirit-spec-item">
          <span class="spirit-spec-title">${t("sp_spec_glass", "Ly phục vụ chuẩn")}</span>
          <span class="spirit-spec-val">${escapeHtml(item.glassType)}</span>
        </div>
      </div>

      <div class="spirit-tasting-matrix">
        <div class="tasting-tier-item">
          <span class="tasting-tier-tag tier-nose">Nose</span>
          <p class="tasting-tier-desc">${escapeHtml(item.tastingNotes.nose)}</p>
        </div>
        <div class="tasting-tier-item">
          <span class="tasting-tier-tag tier-palate">Palate</span>
          <p class="tasting-tier-desc">${escapeHtml(item.tastingNotes.palate)}</p>
        </div>
        <div class="tasting-tier-item">
          <span class="tasting-tier-tag tier-finish">Finish</span>
          <p class="tasting-tier-desc">${escapeHtml(item.tastingNotes.finish)}</p>
        </div>
      </div>

      <div class="spirit-radar-box">
        <div class="spirit-radar-head">
          <span>${t("sp_radar_title", "Hồ sơ cảm quan hương vị")}</span>
          <span>${item.colorName}</span>
        </div>
        <div class="radar-bars-list">
          <div class="radar-bar-row">
            <div class="radar-bar-meta">
              <span>${t("sp_radar_body", "Độ Đậm & Độ Sánh (Body)").replace(/&/g, "&amp;")}</span>
              <span>${item.sensoryScores.richness}%</span>
            </div>
            <div class="radar-bar-track">
              <div class="radar-bar-fill" style="width: ${item.sensoryScores.richness}%;"></div>
            </div>
          </div>
          <div class="radar-bar-row">
            <div class="radar-bar-meta">
              <span>${t("sp_radar_oak", "Gỗ Sồi & Gia Vị (Oak & Spice)").replace(/&/g, "&amp;")}</span>
              <span>${item.sensoryScores.oakSpice}%</span>
            </div>
            <div class="radar-bar-track">
              <div class="radar-bar-fill" style="width: ${item.sensoryScores.oakSpice}%;"></div>
            </div>
          </div>
          <div class="radar-bar-row">
            <div class="radar-bar-meta">
              <span>${t("sp_radar_smoke", "Khói & Than Bùn (Smoke & Peat)").replace(/&/g, "&amp;")}</span>
              <span>${item.sensoryScores.smoke}%</span>
            </div>
            <div class="radar-bar-track">
              <div class="radar-bar-fill" style="width: ${item.sensoryScores.smoke}%;"></div>
            </div>
          </div>
          <div class="radar-bar-row">
            <div class="radar-bar-meta">
              <span>${t("sp_radar_botanical", "Thảo Mộc & Hương Hoa (Botanical)").replace(/&/g, "&amp;")}</span>
              <span>${item.sensoryScores.botanical}%</span>
            </div>
            <div class="radar-bar-track">
              <div class="radar-bar-fill" style="width: ${item.sensoryScores.botanical}%;"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Khối các thức uống pha chế từ chai rượu này -->
      <div class="spirit-crafted-section">
        <div class="crafted-header">
          <h4 class="crafted-title">
            ${ICONS.cocktail(16)}
            <span>${t("sp_crafted_title", "Cocktail Kinh Điển & Thưởng Thức Signature").replace(/&/g, "&amp;")}</span>
          </h4>
          <span class="crafted-sub-badge">${item.craftedCocktails ? item.craftedCocktails.length : 0} ${t("sp_crafted_count", "Công thức pha chế")}</span>
        </div>
        <div class="crafted-list">
          ${craftedList}
        </div>
      </div>

      <div class="spirit-card-footer">
        <div class="spirit-footer-glass">
          ${ICONS.cocktail(16)}
          <span>${escapeHtml(item.priceRange)}</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn btn-outline btn-sm open-dossier-btn" data-id="${item.id}">
            ${t("sp_view_dossier", "Hồ sơ di sản")}
          </button>
          <a href="order.html" class="btn btn-primary btn-sm">
            ${t("sp_book_bar", "Đặt bàn tại Bar")}
          </a>
        </div>
      </div>
    </article>`;
}

/** Render danh sách chai rượu theo bộ lọc & tìm kiếm */
function renderSpiritsGrid() {
  const host = document.getElementById("spirits-grid");
  const countEl = document.getElementById("spirits-count");
  if (!host) return;

  const query = currentSearch.trim().toLowerCase();

  const view = localized();
  const filtered = view.filter((item) => {
    const matchFamily = currentFamily === "all" || item.family === currentFamily;
    if (!matchFamily) return false;

    if (!query) return true;

    const haystack = [
      item.name,
      item.fullName,
      item.origin,
      item.distillery,
      item.familyLabel,
      item.mashBill,
      item.caskType,
      item.tastingNotes.nose,
      item.tastingNotes.palate,
      item.tastingNotes.finish,
      item.biography,
      item.sommelierQuote,
    ].join(" ").toLowerCase();

    return haystack.includes(query);
  });

  if (countEl) {
    countEl.innerHTML = t("sp_count", "Hiển thị <strong>{n}</strong> / {total} chai rượu di sản")
      .replace("{n}", filtered.length).replace("{total}", view.length);
  }

  if (filtered.length === 0) {
    host.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 60px 20px; text-align: center;">
        <div class="empty-icon" style="margin-bottom: 16px;">${ICONS.search(36)}</div>
        <h3>${t("sp_empty_title", "Không tìm thấy chai rượu phù hợp")}</h3>
        <p class="text-muted">${t("sp_empty_hint", "Vui lòng thử từ khóa khác (ví dụ: Speyside, Peat, Sherry, Cognac, Tequila, Gin)...")}</p>
      </div>`;
    return;
  }

  host.innerHTML = filtered.map(spiritCardHtml).join("");

  // Gắn sự kiện mở modal hồ sơ
  host.querySelectorAll(".open-dossier-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const found = localized().find((s) => s.id === id);
      if (found) openDossierModal(found);
    });
  });
}

/** Mở Modal Hồ Sơ Di Sản Chi Tiết */
function openDossierModal(spirit) {
  const modal = document.getElementById("spirit-dossier-modal");
  if (!modal) return;

  const titleEl = document.getElementById("dossier-title");
  const subEl = document.getElementById("dossier-sub");
  const quoteEl = document.getElementById("dossier-quote");
  const bioEl = document.getElementById("dossier-bio");
  const ritualEl = document.getElementById("dossier-ritual");
  const pairingsEl = document.getElementById("dossier-pairings");
  const specsEl = document.getElementById("dossier-specs");

  if (titleEl) titleEl.textContent = spirit.fullName;
  if (subEl) subEl.textContent = `${spirit.familyLabel} • ${spirit.origin} • Est. ${spirit.established}`;
  if (quoteEl) quoteEl.textContent = `“${spirit.sommelierQuote}”`;
  if (bioEl) bioEl.textContent = spirit.biography;
  if (ritualEl) ritualEl.textContent = spirit.servingRitual;

  if (pairingsEl) {
    pairingsEl.innerHTML = (spirit.craftedCocktails || []).map((c) => `
      <div style="background: rgba(197, 152, 67, 0.08); border: 1px solid var(--border-soft); border-radius: var(--radius-sm); padding: 12px 16px; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-wrap: wrap; gap: 8px;">
          <strong style="color: var(--amber-soft); font-size: 0.95rem;">${escapeHtml(c.name)}</strong>
          ${c.inMenu ? `<span class="crafted-badge-inmenu">${ICONS.checkCircle(13)} ${t("bt_in_menu", "Có trong Menu 🍸")}</span>` : `<span style="font-size: 0.75rem; color: var(--text-dim);">${escapeHtml(c.category)}</span>`}
        </div>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px; line-height: 1.5;">${escapeHtml(c.desc)}</p>
        <div style="font-size: 0.8rem; color: var(--amber-dark); font-family: monospace;">${t("sp_recipe_spec", "Công thức (Spec):")} ${escapeHtml(c.recipe)}</div>
      </div>`).join("");
  }

  if (specsEl) {
    specsEl.innerHTML = `
      <div class="spirit-spec-item">
        <span class="spirit-spec-title">${t("sp_dist_title", "Nhà chưng cất / Lãnh địa")}</span>
        <span class="spirit-spec-val">${escapeHtml(spirit.distillery)}</span>
      </div>
      <div class="spirit-spec-item">
        <span class="spirit-spec-title">${t("sp_master_title", "Bậc thầy chưng cất (Master Distiller)")}</span>
        <span class="spirit-spec-val">${escapeHtml(spirit.masterBlender)}</span>
      </div>
      <div class="spirit-spec-item">
        <span class="spirit-spec-title">${t("sp_mash_title", "Nguyên liệu (Mash Bill) & Thảo mộc").replace(/&/g, "&amp;")}</span>
        <span class="spirit-spec-val">${escapeHtml(spirit.mashBill)}</span>
      </div>
      <div class="spirit-spec-item">
        <span class="spirit-spec-title">${t("sp_cask_title", "Kỹ nghệ ủ thùng & Độ tuổi").replace(/&/g, "&amp;")}</span>
        <span class="spirit-spec-val">${escapeHtml(spirit.caskType)}</span>
      </div>`;
  }

  modal.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeDossierModal() {
  const modal = document.getElementById("spirit-dossier-modal");
  if (!modal) return;
  modal.classList.remove("open");
  document.body.style.overflow = "";
}

// Đổi VI/EN: vẽ lại thẻ + bộ lọc bằng bản dịch tương ứng (chữ tĩnh trong HTML do applyI18n lo)
window.addEventListener("languagechange", () => {
  renderFilterTabs();
  if (collection.length) renderSpiritsGrid();
});

/** Lắng nghe tìm kiếm & Modal */
document.addEventListener("DOMContentLoaded", async () => {
  renderFilterTabs();

  const host = document.getElementById("spirits-grid");
  const countBox = document.getElementById("spirits-count");
  if (countBox) countBox.textContent = t("sp_loading_count", "Đang tải dữ liệu hầm rượu...");
  if (host) host.innerHTML = loadingHtml(t("sp_loading", "Đang tải hầm rượu..."));
  try {
    collection = await getCollection("spirits", SPIRITS_COLLECTION);
    renderSpiritsGrid();
  } catch (err) {
    if (host) host.innerHTML = errorHtml(err.message);
  }

  const searchInput = document.getElementById("spirits-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearch = e.target.value;
      renderSpiritsGrid();
    });
  }

  const modal = document.getElementById("spirit-dossier-modal");
  const closeBtn = document.getElementById("dossier-close-btn");
  if (closeBtn) closeBtn.addEventListener("click", closeDossierModal);
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeDossierModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDossierModal();
  });
});

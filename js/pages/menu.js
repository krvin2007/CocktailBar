/* =========================================================
   MENU.JS - Trang thực đơn: tìm kiếm + lọc + sắp xếp
   Tải danh sách đồ uống từ API MỘT LẦN khi mở trang, sau đó mọi
   thao tác lọc/sắp xếp chạy trên mảng trong bộ nhớ bằng
   filter()/sort() - nhanh, không gọi API lại mỗi lần gõ phím.
   Hỗ trợ lọc "Chỉ món đang giảm giá" (sale theo món + món mới) và
   sắp xếp "Mới nhất" / "Giảm giá nhiều nhất". Đường dẫn có sẵn bộ lọc:
     menu.html?sale=1          -> mở lưới, chỉ món đang giảm giá
     menu.html?sort=newest     -> mở lưới, món mới lên trước
     menu.html?category=classic -> mở lưới theo danh mục (như trước)
   ========================================================= */

import "../modules/navbar.js";
import {
  getAllDrinks, filterDrinks, getDrinkPricing, CATEGORY_LABELS, getCategoryLabel,
  NEW_DRINK_DAYS, NEW_DRINK_DISCOUNT,
} from "../modules/drinksService.js";
import { getCurrentLang } from "../modules/i18n.js";
import { qs, debounce, getQueryParam } from "../modules/utils.js";
import { drinkCardHtml } from "../modules/drinkCard.js";
import { ICONS } from "../modules/icons.js";
import { loadingHtml, errorHtml } from "../modules/ui.js";
import { initMenuBook } from "../modules/menuBook.js";

const gridEl = qs("#drink-grid");
const countEl = qs("#result-count");
const promoStripEl = qs("#menu-promo-strip");
const saleCountEl = qs("#f-sale-count");

const filters = {
  keyword: qs("#f-keyword"),
  category: qs("#f-category"),
  min: qs("#f-min"),
  max: qs("#f-max"),
  available: qs("#f-available"),
  sale: qs("#f-sale"),
  sort: qs("#f-sort"),
};

/** Toàn bộ đồ uống tải từ API - nguồn để lọc */
let allDrinks = [];

/** Nạp danh mục vào select từ dữ liệu dùng chung */
function fillCategoryOptions() {
  if (!filters.category) return;
  const currentVal = filters.category.value || getQueryParam("category") || "all";
  const isEn = getCurrentLang() === "en";

  filters.category.innerHTML = `<option value="all">${isEn ? "All Categories" : "Tất cả danh mục"}</option>`;
  Object.keys(CATEGORY_LABELS).forEach((value) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = getCategoryLabel(value);
    filters.category.appendChild(opt);
  });

  if (currentVal && (currentVal === "all" || CATEGORY_LABELS[currentVal])) {
    filters.category.value = currentVal;
  }
}

/** Đọc giá trị bộ lọc; ô giá để trống hoặc nhập sai thì coi như không giới hạn */
function readFilters() {
  const min = Number(filters.min?.value);
  const max = Number(filters.max?.value);
  return {
    keyword: filters.keyword ? filters.keyword.value : "",
    category: filters.category ? filters.category.value : "all",
    minPrice: filters.min?.value && min >= 0 ? min : 0,
    maxPrice: filters.max?.value && max > 0 ? max : Infinity,
    onlyAvailable: filters.available ? filters.available.checked : false,
    onlySale: filters.sale ? filters.sale.checked : false,
    sortBy: filters.sort ? filters.sort.value : "default",
  };
}

/** Thống kê ưu đãi hiện có trên toàn thực đơn (không phụ thuộc bộ lọc) */
function promoStats() {
  const priced = allDrinks.map((d) => getDrinkPricing(d));
  return {
    saleCount: priced.filter((p) => p.onSale).length,
    newCount: priced.filter((p) => p.isNew).length,
    maxPercent: priced.reduce((max, p) => Math.max(max, p.percent), 0),
  };
}

function render() {
  if (!gridEl) return;

  const opts = readFilters();
  if (opts.minPrice > opts.maxPrice) {
    if (countEl) countEl.textContent = "Khoảng giá không hợp lệ";
    gridEl.innerHTML = `<div class="empty-state">
         <div class="empty-icon">${ICONS.alertCircle(36)}</div>
         <h4>Giá "từ" đang lớn hơn giá "đến"</h4>
         <p class="text-muted">Vui lòng nhập lại khoảng giá.</p>
       </div>`;
    return;
  }

  const list = filterDrinks(allDrinks, opts);
  const saleInList = list.filter((d) => getDrinkPricing(d).onSale).length;

  if (countEl) {
    countEl.textContent = saleInList > 0 && !opts.onlySale
      ? `${list.length} món thức uống · ${saleInList} món đang ưu đãi`
      : `${list.length} món thức uống`;
  }

  gridEl.innerHTML = list.length
    ? list.map(drinkCardHtml).join("")
    : `<div class="empty-state">
         <div class="empty-icon">${ICONS.search(36)}</div>
         <h4>${opts.onlySale ? "Chưa có món giảm giá phù hợp" : "Không tìm thấy đồ uống phù hợp"}</h4>
         <p class="text-muted">${opts.onlySale
           ? "Hãy bỏ chọn \"Chỉ món đang giảm giá\" hoặc nới rộng bộ lọc để xem thêm món."
           : "Vui lòng điều chỉnh lại từ khóa hoặc giảm tiêu chí trong bộ lọc giá."}</p>
       </div>`;
}

const debouncedRender = debounce(render, 250);

/** Đồng bộ ?sale=1 trên thanh địa chỉ để khách sao chép/chia sẻ đúng bộ lọc đang xem */
function syncSaleParam() {
  if (!filters.sale || !window.history?.replaceState) return;
  const url = new URL(window.location.href);
  if (filters.sale.checked) {
    url.searchParams.set("sale", "1");
  } else {
    url.searchParams.delete("sale");
  }
  window.history.replaceState(null, "", url);
}

function bindFilterEvents() {
  if (filters.keyword) filters.keyword.addEventListener("input", debouncedRender);
  [filters.category, filters.min, filters.max, filters.available, filters.sale, filters.sort]
    .filter(Boolean)
    .forEach((el) => el.addEventListener("change", render));

  if (filters.sale) filters.sale.addEventListener("change", syncSaleParam);

  const resetBtn = qs("#f-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (filters.keyword) filters.keyword.value = "";
      if (filters.category) filters.category.value = "all";
      if (filters.min) filters.min.value = "";
      if (filters.max) filters.max.value = "";
      if (filters.available) filters.available.checked = false;
      if (filters.sale) filters.sale.checked = false;
      if (filters.sort) filters.sort.value = "default";
      syncSaleParam();
      render();
    });
  }
}

/* ---------------- Chế độ xem: Quyển sách 3D / Lưới bộ lọc ---------------- */

/** Chuyển giữa quyển menu lật 3D và lưới có bộ lọc */
function setViewMode(mode) {
  const bookRoot = qs("#menu-book-root");
  const gridSection = qs("#menu-grid-section");
  const btnBook = qs("#btn-mode-book");
  const btnGrid = qs("#btn-mode-grid");

  if (mode === "grid") {
    if (bookRoot) bookRoot.style.display = "none";
    if (gridSection) gridSection.style.display = "grid";
    btnGrid?.classList.add("active");
    btnBook?.classList.remove("active");
  } else {
    if (bookRoot) bookRoot.style.display = "block";
    if (gridSection) gridSection.style.display = "none";
    btnBook?.classList.add("active");
    btnGrid?.classList.remove("active");
  }
}

/**
 * Áp bộ lọc có sẵn trên URL (?sale=1, ?sort=newest) vào form.
 * @returns {boolean} true nếu URL có bộ lọc -> nên mở thẳng giao diện lưới
 */
function applyUrlPresets() {
  let hasPreset = Boolean(getQueryParam("category"));

  if (filters.sale && ["1", "true", "yes"].includes(String(getQueryParam("sale")).toLowerCase())) {
    filters.sale.checked = true;
    hasPreset = true;
  }

  // Chỉ nhận giá trị sắp xếp có thật trong <select>, tránh tham số rác trên URL
  const presetSort = getQueryParam("sort");
  if (filters.sort && presetSort && [...filters.sort.options].some((o) => o.value === presetSort)) {
    filters.sort.value = presetSort;
    hasPreset = true;
  }

  return hasPreset;
}

function bindViewModeEvents() {
  qs("#btn-mode-book")?.addEventListener("click", () => setViewMode("book"));
  qs("#btn-mode-grid")?.addEventListener("click", () => setViewMode("grid"));

  // Vào từ liên kết có sẵn bộ lọc (?category=, ?sale=1, ?sort=) -> ưu tiên mở giao diện lưới
  setViewMode(applyUrlPresets() ? "grid" : "book");
}

/* ---------------- Dải thông báo ưu đãi ---------------- */

/** Vẽ dải "Đang có X món giảm giá" phía trên quyển menu; không có ưu đãi thì ẩn */
function renderPromoStrip() {
  const { saleCount, newCount, maxPercent } = promoStats();

  if (saleCountEl) saleCountEl.textContent = saleCount > 0 ? `(${saleCount})` : "";
  if (!promoStripEl) return;

  if (saleCount === 0) {
    promoStripEl.hidden = true;
    promoStripEl.innerHTML = "";
    return;
  }

  const isEn = getCurrentLang() === "en";
  const headline = isEn
    ? `${saleCount} drinks on offer today — up to ${maxPercent}% off`
    : `Hôm nay có ${saleCount} món đang ưu đãi — giảm đến ${maxPercent}%`;
  const sub = newCount > 0
    ? (isEn
      ? `Including ${newCount} new arrivals at ${NEW_DRINK_DISCOUNT}% off during their first ${NEW_DRINK_DAYS} days.`
      : `Trong đó có ${newCount} món mới ra mắt tự động giảm ${NEW_DRINK_DISCOUNT}% trong ${NEW_DRINK_DAYS} ngày đầu.`)
    : (isEn ? "Prices shown already include the discount." : "Giá hiển thị đã trừ ưu đãi, không cần nhập mã.");

  promoStripEl.innerHTML = `
    <span class="menu-promo-icon">${ICONS.flame(20)}</span>
    <div class="menu-promo-text">
      <strong>${headline}</strong>
      <span>${sub}</span>
    </div>
    <div class="menu-promo-actions">
      <button type="button" class="btn btn-primary btn-sm" id="menu-promo-sale">
        <span>${isEn ? "View offers" : "Xem món đang giảm giá"}</span>
      </button>
      ${newCount > 0 ? `
        <button type="button" class="btn btn-ghost btn-sm" id="menu-promo-new">
          <span>${isEn ? "Newest first" : "Món mới nhất"}</span>
        </button>` : ""}
    </div>`;
  promoStripEl.hidden = false;

  /** Mở lưới với bộ lọc tương ứng rồi cuộn tới kết quả */
  const openGrid = (applyFilter) => {
    applyFilter();
    syncSaleParam();
    setViewMode("grid");
    render();
    qs("#menu-grid-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  qs("#menu-promo-sale")?.addEventListener("click", () => openGrid(() => {
    if (filters.sale) filters.sale.checked = true;
    if (filters.sort) filters.sort.value = "sale-desc";
  }));
  qs("#menu-promo-new")?.addEventListener("click", () => openGrid(() => {
    if (filters.sale) filters.sale.checked = false;
    if (filters.sort) filters.sort.value = "newest";
  }));
}

async function init() {
  fillCategoryOptions();
  bindFilterEvents();
  bindViewModeEvents();

  if (gridEl) gridEl.innerHTML = loadingHtml("Đang tải menu...");
  try {
    allDrinks = await getAllDrinks();
    initMenuBook("menu-book-root", allDrinks);
    renderPromoStrip();
    render();
  } catch (err) {
    if (gridEl) gridEl.innerHTML = errorHtml(err.message);
  }

  window.addEventListener("languagechange", () => {
    fillCategoryOptions();
    renderPromoStrip();
    render();
  });
}

init();

/* =========================================================
   MENU.JS - Trang thực đơn: tìm kiếm + lọc + sắp xếp
   Tải danh sách đồ uống từ API MỘT LẦN khi mở trang, sau đó mọi
   thao tác lọc/sắp xếp chạy trên mảng trong bộ nhớ bằng
   filter()/sort() - nhanh, không gọi API lại mỗi lần gõ phím.
   ========================================================= */

import "../modules/navbar.js";
import { getAllDrinks, filterDrinks, CATEGORY_LABELS, getCategoryLabel } from "../modules/drinksService.js";
import { getCurrentLang } from "../modules/i18n.js";
import { qs, debounce, getQueryParam } from "../modules/utils.js";
import { drinkCardHtml } from "../modules/drinkCard.js";
import { ICONS } from "../modules/icons.js";
import { loadingHtml, errorHtml } from "../modules/ui.js";
import { initMenuBook } from "../modules/menuBook.js";

const gridEl = qs("#drink-grid");
const countEl = qs("#result-count");

const filters = {
  keyword: qs("#f-keyword"),
  category: qs("#f-category"),
  min: qs("#f-min"),
  max: qs("#f-max"),
  available: qs("#f-available"),
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
    sortBy: filters.sort ? filters.sort.value : "default",
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

  if (countEl) countEl.textContent = `${list.length} món thức uống`;

  gridEl.innerHTML = list.length
    ? list.map(drinkCardHtml).join("")
    : `<div class="empty-state">
         <div class="empty-icon">${ICONS.search(36)}</div>
         <h4>Không tìm thấy đồ uống phù hợp</h4>
         <p class="text-muted">Vui lòng điều chỉnh lại từ khóa hoặc giảm tiêu chí trong bộ lọc giá.</p>
       </div>`;
}

const debouncedRender = debounce(render, 250);

function bindFilterEvents() {
  if (filters.keyword) filters.keyword.addEventListener("input", debouncedRender);
  [filters.category, filters.min, filters.max, filters.available, filters.sort]
    .filter(Boolean)
    .forEach((el) => el.addEventListener("change", render));

  const resetBtn = qs("#f-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (filters.keyword) filters.keyword.value = "";
      if (filters.category) filters.category.value = "all";
      if (filters.min) filters.min.value = "";
      if (filters.max) filters.max.value = "";
      if (filters.available) filters.available.checked = false;
      if (filters.sort) filters.sort.value = "default";
      render();
    });
  }
}

function bindViewModeEvents() {
  const bookRoot = qs("#menu-book-root");
  const gridSection = qs("#menu-grid-section");
  const btnBook = qs("#btn-mode-book");
  const btnGrid = qs("#btn-mode-grid");

  function setMode(mode) {
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

  btnBook?.addEventListener("click", () => setMode("book"));
  btnGrid?.addEventListener("click", () => setMode("grid"));

  // Nếu người dùng vào từ liên kết có sẵn bộ lọc ?category=, ưu tiên mở giao diện lưới
  const presetCategory = getQueryParam("category");
  if (presetCategory) {
    setMode("grid");
  } else {
    setMode("book");
  }
}

async function init() {
  fillCategoryOptions();
  bindFilterEvents();
  bindViewModeEvents();

  if (gridEl) gridEl.innerHTML = loadingHtml("Đang tải menu...");
  try {
    allDrinks = await getAllDrinks();
    initMenuBook("menu-book-root", allDrinks);
    render();
  } catch (err) {
    if (gridEl) gridEl.innerHTML = errorHtml(err.message);
  }

  window.addEventListener("languagechange", () => {
    fillCategoryOptions();
    render();
  });
}

init();

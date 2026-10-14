/* =========================================================
   ADMIN-MENU.JS - CRUD quản lý thực đơn đồ uống (qua API)
     Đọc   : GET    /drinks
     Thêm  : POST   /drinks
     Sửa   : PATCH  /drinks/:id
     Xoá   : DELETE /drinks/:id
   Quản lý giá bán: mỗi món chọn một "Mức sale (%)" trong SALE_TIERS
   (0 = không sale). Món mới (tạo trong NEW_DRINK_DAYS ngày) tự giảm
   NEW_DRINK_DISCOUNT% - hệ thống lấy mức CAO HƠN, không cộng dồn.
   Bảng hiển thị giá sau ưu đãi + giá gốc gạch + huy hiệu Mới / -X%.
   ========================================================= */

import { initAdminLayout } from "../modules/adminLayout.js";
import {
  getAllDrinks, filterDrinks, addDrink, updateDrink, deleteDrink, CATEGORY_LABELS,
  SALE_TIERS, NEW_DRINK_DAYS, NEW_DRINK_DISCOUNT, getDrinkPricing, normalizeSalePercent,
} from "../modules/drinksService.js";
import { formatMoney, debounce, paginate, renderPagination, escapeHtml } from "../modules/utils.js";
import { validateForm, clearFormErrors, setFieldError } from "../modules/validation.js";
import { toast, confirmDialog, openModal, closeModal, setButtonLoading } from "../modules/ui.js";
import { ICONS } from "../modules/icons.js";

const bodyEl = document.getElementById("drinks-body");
const paginationEl = document.getElementById("pagination");
const keywordInput = document.getElementById("f-keyword");
const categorySelect = document.getElementById("f-category");
const pricingSelect = document.getElementById("f-pricing");

const formEl = document.getElementById("drink-form");
const formCategorySelect = document.getElementById("drink-form-category");
const formSaleSelect = document.getElementById("drink-form-sale");
const salePreviewEl = document.getElementById("drink-sale-preview");
const modalTitle = document.getElementById("drink-modal-title");
const submitBtn = document.getElementById("drink-form-submit");

/** Danh sách đồ uống tải từ API - tải lại sau mỗi lần thêm/sửa/xoá */
let allDrinks = [];
let currentPage = 1;

/** Món đang mở trong form Sửa (null = form Thêm) - cần createdAt để xem trước giá món mới */
let editingDrink = null;

/* ---------------- Nạp danh mục cho 2 select ---------------- */
function fillCategorySelects() {
  Object.entries(CATEGORY_LABELS).forEach(([value, label]) => {
    categorySelect.insertAdjacentHTML("beforeend", `<option value="${value}">${label}</option>`);
    formCategorySelect.insertAdjacentHTML("beforeend", `<option value="${value}">${label}</option>`);
  });
}

/** Nạp các mức sale cho form từ SALE_TIERS - một nguồn duy nhất, không gõ tay trong HTML */
function fillSaleSelect() {
  if (!formSaleSelect) return;
  formSaleSelect.innerHTML = SALE_TIERS
    .map((p) => `<option value="${p}">${p === 0 ? "0% — Không sale" : `Giảm ${p}%`}</option>`)
    .join("");
}

/* ---------------- Hiển thị giá & chương trình ưu đãi ---------------- */

/** Ô "Giá bán" trong bảng: giá sau ưu đãi, giá gốc gạch, huy hiệu Mới / -X% */
function priceCellHtml(d) {
  const pricing = getDrinkPricing(d);
  const saleTitle = pricing.reason === "new"
    ? `Ưu đãi món mới tự động ${pricing.percent}% (${NEW_DRINK_DAYS} ngày đầu)`
    : `Sale theo món ${pricing.percent}%`;

  return `
    <div class="admin-price-cell">
      <strong class="text-amber">${formatMoney(pricing.finalPrice)}</strong>
      ${pricing.onSale ? `<s class="admin-price-old">${formatMoney(pricing.originalPrice)}</s>` : ""}
      ${pricing.isNew || pricing.onSale ? `
        <div class="pricing-badges">
          ${pricing.isNew ? `<span class="pricing-badge pricing-badge-new">Mới</span>` : ""}
          ${pricing.onSale ? `<span class="pricing-badge pricing-badge-sale" title="${escapeHtml(saleTitle)}">-${pricing.percent}%</span>` : ""}
        </div>` : ""}
    </div>`;
}

/** Lọc theo chương trình giá đang chọn ở thanh công cụ */
function matchesPricingFilter(d) {
  const mode = pricingSelect ? pricingSelect.value : "all";
  if (mode === "all") return true;
  const pricing = getDrinkPricing(d);
  if (mode === "discounted") return pricing.onSale;
  if (mode === "sale") return normalizeSalePercent(d.salePercent) > 0;
  if (mode === "new") return pricing.isNew;
  if (mode === "regular") return !pricing.onSale;
  return true;
}

/**
 * Xem trước giá khách trả ngay trong form (khi đổi giá hoặc mức sale).
 * Form Thêm: món sẽ được tạo "bây giờ" -> chắc chắn là món mới, tự giảm 10%.
 */
function updateSalePreview() {
  if (!salePreviewEl) return;
  const price = Number(formEl.elements.price.value) || 0;
  const salePercent = normalizeSalePercent(formSaleSelect?.value);
  if (price <= 0) {
    salePreviewEl.textContent = "Nhập giá bán để xem giá khách trả sau ưu đãi.";
    salePreviewEl.classList.remove("is-active");
    return;
  }

  const preview = {
    price,
    salePercent,
    createdAt: editingDrink ? editingDrink.createdAt : new Date().toISOString(),
  };
  const pricing = getDrinkPricing(preview);

  let text = pricing.onSale
    ? `Giá khách trả: ${formatMoney(pricing.finalPrice)} (-${pricing.percent}%, tiết kiệm ${formatMoney(pricing.originalPrice - pricing.finalPrice)}).`
    : `Giá khách trả: ${formatMoney(pricing.finalPrice)} (không ưu đãi).`;

  if (pricing.isNew && pricing.reason === "new") {
    text += ` Món mới đang tự giảm ${NEW_DRINK_DISCOUNT}% trong ${NEW_DRINK_DAYS} ngày đầu.`;
  } else if (pricing.isNew && salePercent > NEW_DRINK_DISCOUNT) {
    text += ` Món mới (giảm ${NEW_DRINK_DISCOUNT}%) nhưng mức sale ${salePercent}% cao hơn nên được áp dụng - không cộng dồn.`;
  } else if (pricing.isNew) {
    text += ` Mức sale ${salePercent}% trùng ưu đãi món mới - không cộng dồn.`;
  }
  salePreviewEl.textContent = text;
  salePreviewEl.classList.toggle("is-active", pricing.onSale);
}

/* ---------------- Bảng danh sách ---------------- */
function rowHtml(d) {
  const isImage = d.image && (d.image.includes("/") || d.image.startsWith("http"));
  const thumbHtml = isImage
    ? `<img src="${escapeHtml(d.image)}" alt="${escapeHtml(d.name)}" class="admin-table-thumb">`
    : `<div class="admin-table-icon-fallback">${ICONS.cocktail(16)}</div>`;

  return `
    <tr data-id="${escapeHtml(d.id)}">
      <td>${thumbHtml}</td>
      <td>
        <strong>${escapeHtml(d.name)}</strong>
        ${d.baseSpirit ? `<div class="text-xs text-muted">${escapeHtml(d.baseSpirit)}</div>` : ""}
      </td>
      <td><span class="text-sm">${CATEGORY_LABELS[d.category] || d.category}</span></td>
      <td>${priceCellHtml(d)}</td>
      <td>
        <span class="badge ${d.status === "available" ? "badge-success" : "badge-danger"}">
          ${d.status === "available" ? "Đang phục vụ" : "Tạm ngưng"}
        </span>
      </td>
      <td>${d.featured ? `<span class="text-amber">${ICONS.star(14)}</span>` : "—"}</td>
      <td class="cell-actions" style="text-align: right;">
        <button type="button" class="btn btn-ghost btn-sm" data-action="edit" title="Chỉnh sửa">${ICONS.edit(14)} Sửa</button>
        <button type="button" class="btn btn-danger btn-sm" data-action="delete" title="Xoá món">${ICONS.trash(14)} Xoá</button>
      </td>
    </tr>`;
}

function renderTable() {
  const list = filterDrinks(allDrinks, { keyword: keywordInput.value, category: categorySelect.value, sortBy: "name-asc" })
    .filter(matchesPricingFilter);
  const { items, page, totalPages } = paginate(list, currentPage, 8);
  currentPage = page;

  bodyEl.innerHTML = items.length
    ? items.map(rowHtml).join("")
    : `<tr><td colspan="7" class="table-empty py-4 text-center text-muted">
        ${allDrinks.length ? "Không tìm thấy đồ uống phù hợp với bộ lọc." : "Thực đơn đang trống - bấm \"Thêm đồ uống\" để tạo món đầu tiên."}
       </td></tr>`;

  renderPagination(paginationEl, page, totalPages, (p) => { currentPage = p; renderTable(); });
}

/** Tải lại dữ liệu mới nhất từ máy chủ rồi vẽ lại bảng */
async function reloadTable() {
  try {
    allDrinks = await getAllDrinks();
    renderTable();
  } catch (err) {
    bodyEl.innerHTML = `<tr><td colspan="7" class="table-empty py-4 text-center text-muted">${escapeHtml(err.message)}</td></tr>`;
  }
}

/* ---------------- Thêm / sửa ---------------- */
function openForCreate() {
  formEl.reset();
  clearFormErrors(formEl);
  formEl.elements.id.value = "";
  formEl.elements.rating.value = "4.8";
  formEl.elements.stock.value = "20";
  formEl.elements.abv.value = "0";
  formEl.elements.status.value = "available";
  formEl.elements.image.value = "";
  formEl.elements.salePercent.value = "0";
  editingDrink = null;
  updateSalePreview();
  modalTitle.textContent = "Thêm đồ uống mới";
  openModal("drink-modal");
}

function openForEdit(drink) {
  formEl.reset();
  clearFormErrors(formEl);
  formEl.elements.id.value = drink.id;
  formEl.elements.name.value = drink.name;
  formEl.elements.category.value = drink.category;
  formEl.elements.image.value = drink.image || "";
  formEl.elements.price.value = drink.price;
  formEl.elements.stock.value = drink.stock;
  formEl.elements.abv.value = drink.abv;
  formEl.elements.rating.value = drink.rating;
  formEl.elements.status.value = drink.status;
  formEl.elements.featured.checked = drink.featured;
  formEl.elements.baseSpirit.value = drink.baseSpirit || "";
  formEl.elements.glassType.value = drink.glassType || "";
  formEl.elements.ingredients.value = (drink.ingredients || []).join(", ");
  formEl.elements.description.value = drink.description;
  formEl.elements.salePercent.value = String(normalizeSalePercent(drink.salePercent));
  editingDrink = drink;
  updateSalePreview();

  modalTitle.textContent = `Chỉnh sửa: ${drink.name}`;
  openModal("drink-modal");
}

/** Tên món không được trùng với món khác (không phân biệt hoa/thường) */
function isNameTaken(name, exceptId) {
  const normalized = name.trim().toLowerCase();
  return allDrinks.some((d) => d.id !== exceptId && d.name.trim().toLowerCase() === normalized);
}

async function handleDelete(drink) {
  const ok = await confirmDialog(`Xác nhận xoá món "${drink.name}" khỏi thực đơn quán?`, {
    title: "Xác nhận xoá đồ uống",
    okText: "Xoá món",
  });
  if (!ok) return;

  try {
    await deleteDrink(drink.id);
    toast(`Đã xoá món "${drink.name}".`, "success");
    await reloadTable();
  } catch (err) {
    toast(err.message, "error");
  }
}

bodyEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const drink = allDrinks.find((d) => d.id === btn.closest("tr").dataset.id);
  if (!drink) return;

  if (btn.dataset.action === "edit") openForEdit(drink);
  if (btn.dataset.action === "delete") handleDelete(drink);
});

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();

  const { isValid, data } = validateForm(formEl);
  if (!isValid) return;

  if (isNameTaken(data.name, data.id)) {
    setFieldError(formEl.elements.name, "Thực đơn đã có món trùng tên này");
    formEl.elements.name.focus();
    return;
  }

  const payload = {
    name: data.name,
    category: data.category,
    image: data.image || "", // để trống -> biểu tượng mặc định, không mượn ảnh món khác
    price: Number(data.price),
    salePercent: normalizeSalePercent(data.salePercent), // 0 = không sale; sai mức -> 0
    stock: data.status === "soldout" ? 0 : (Number(data.stock) || 50),
    abv: Number(data.abv) || 0,
    rating: Number(data.rating) || 4.5,
    status: data.status,
    featured: formEl.elements.featured.checked,
    baseSpirit: data.baseSpirit || "",
    glassType: data.glassType || "",
    ingredients: data.ingredients ? data.ingredients.split(",").map((s) => s.trim()).filter(Boolean) : [],
    description: data.description,
  };

  const restoreButton = setButtonLoading(submitBtn, "Đang lưu...");
  try {
    if (data.id) {
      await updateDrink(data.id, payload);
      toast(`Đã cập nhật món "${payload.name}"${payload.salePercent ? ` (sale ${payload.salePercent}%)` : ""}.`, "success");
    } else {
      await addDrink(payload);
      // Món vừa tạo là "món mới": tự giảm NEW_DRINK_DISCOUNT%, trừ khi mức sale chọn cao hơn
      const promoNote = payload.salePercent > NEW_DRINK_DISCOUNT
        ? `đang sale ${payload.salePercent}%`
        : `món mới tự giảm ${NEW_DRINK_DISCOUNT}% trong ${NEW_DRINK_DAYS} ngày đầu`;
      toast(`Đã thêm món "${payload.name}" vào thực đơn (${promoNote}).`, "success");
    }
    closeModal("drink-modal");
    await reloadTable();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    restoreButton();
  }
});

/* ---------------- Khởi động ---------------- */
function bindEvents() {
  const debouncedRender = debounce(() => { currentPage = 1; renderTable(); }, 250);
  keywordInput.addEventListener("input", debouncedRender);
  categorySelect.addEventListener("change", () => { currentPage = 1; renderTable(); });
  if (pricingSelect) pricingSelect.addEventListener("change", () => { currentPage = 1; renderTable(); });

  // Xem trước giá sau ưu đãi ngay khi quản trị viên đổi giá hoặc mức sale
  formEl.elements.price.addEventListener("input", updateSalePreview);
  if (formSaleSelect) formSaleSelect.addEventListener("change", updateSalePreview);

  document.getElementById("add-drink-btn").addEventListener("click", openForCreate);
  document.getElementById("drink-modal-close").addEventListener("click", () => closeModal("drink-modal"));
  document.getElementById("drink-form-cancel").addEventListener("click", () => closeModal("drink-modal"));
}

// Chưa đăng nhập -> initAdminLayout chuyển hướng và trả false: dừng, không gọi API
if (initAdminLayout("Quản Lý Thực Đơn")) {
  fillCategorySelects();
  fillSaleSelect();
  bindEvents();
  bodyEl.innerHTML = `<tr><td colspan="8" class="table-empty py-4 text-center text-muted">Đang tải thực đơn từ máy chủ...</td></tr>`;
  reloadTable();
}

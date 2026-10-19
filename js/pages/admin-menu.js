/* =========================================================
   ADMIN-MENU.JS - CRUD quản lý thực đơn đồ uống (qua API)
     Đọc   : GET    /drinks
     Thêm  : POST   /drinks
     Sửa   : PATCH  /drinks/:id
     Xoá   : DELETE /drinks/:id
   ========================================================= */

import { initAdminLayout } from "../modules/adminLayout.js";
import {
  getAllDrinks, filterDrinks, addDrink, updateDrink, deleteDrink, CATEGORY_LABELS,
  stockLevel, stockPatch, tracksStock, LOW_STOCK_THRESHOLD,
} from "../modules/drinksService.js";
import { formatMoney, debounce, paginate, renderPagination, escapeHtml } from "../modules/utils.js";
import { validateForm, clearFormErrors, setFieldError } from "../modules/validation.js";
import { toast, confirmDialog, openModal, closeModal, setButtonLoading } from "../modules/ui.js";
import { ICONS } from "../modules/icons.js";

const bodyEl = document.getElementById("drinks-body");
const paginationEl = document.getElementById("pagination");
const keywordInput = document.getElementById("f-keyword");
const categorySelect = document.getElementById("f-category");
const stockSelect = document.getElementById("f-stock");

/** Huy hiệu cảnh báo theo mức tồn kho (stockLevel trả về "out" | "low" | "ok") */
const STOCK_BADGE = {
  out: `<span class="badge badge-danger">Hết hàng</span>`,
  low: `<span class="badge badge-warning">Sắp hết</span>`,
  ok: "",
};

const formEl = document.getElementById("drink-form");
const formCategorySelect = document.getElementById("drink-form-category");
const modalTitle = document.getElementById("drink-modal-title");
const submitBtn = document.getElementById("drink-form-submit");

/** Danh sách đồ uống tải từ API - tải lại sau mỗi lần thêm/sửa/xoá */
let allDrinks = [];
let currentPage = 1;

/* ---------------- Nạp danh mục cho 2 select ---------------- */
function fillCategorySelects() {
  stockSelect.querySelector('option[value="low"]').textContent = `Sắp hết (≤ ${LOW_STOCK_THRESHOLD} ly)`;
  Object.entries(CATEGORY_LABELS).forEach(([value, label]) => {
    categorySelect.insertAdjacentHTML("beforeend", `<option value="${value}">${label}</option>`);
    formCategorySelect.insertAdjacentHTML("beforeend", `<option value="${value}">${label}</option>`);
  });
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
      <td><strong class="text-amber">${formatMoney(d.price)}</strong>${d.servingMl ? ` <span class="text-xs text-muted">/ ${d.servingMl}ml</span>` : ""}</td>
      <td>
        ${tracksStock(d)
          ? `<strong>${d.stock}</strong> <span class="text-xs text-muted">ly</span>
             <div>${STOCK_BADGE[stockLevel(d)]}</div>`
          : `<span class="text-xs text-muted">Không giới hạn</span>`}
      </td>
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
  let list = filterDrinks(allDrinks, { keyword: keywordInput.value, category: categorySelect.value, sortBy: "name-asc" });
  // Lọc theo mức tồn kho: "low" = sắp hết, "out" = đã hết
  if (stockSelect.value !== "all") {
    list = list.filter((d) => stockLevel(d) === stockSelect.value);
  }
  const { items, page, totalPages } = paginate(list, currentPage, 8);
  currentPage = page;

  bodyEl.innerHTML = items.length
    ? items.map(rowHtml).join("")
    : `<tr><td colspan="8" class="table-empty py-4 text-center text-muted">
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
    bodyEl.innerHTML = `<tr><td colspan="8" class="table-empty py-4 text-center text-muted">${escapeHtml(err.message)}</td></tr>`;
  }
}

/* ---------------- Thêm / sửa ---------------- */
const STOCK_RULE = "required|integer|minval:0|maxval:999";

/**
 * Ô "Tồn kho" chỉ hiện với chai rượu (nhóm "Rượu mạnh"). Cocktail/mocktail pha từ nhiều nguyên liệu
 * nên không giới hạn số ly - ẩn ô và bỏ luật bắt buộc nhập để không chặn lưu form.
 */
function syncStockField() {
  const tracked = tracksStock({ category: formCategorySelect.value });
  document.getElementById("stock-group").hidden = !tracked;
  if (tracked) formEl.elements.stock.dataset.rule = STOCK_RULE;
  else delete formEl.elements.stock.dataset.rule;
}

function openForCreate() {
  formEl.reset();
  clearFormErrors(formEl);
  formEl.elements.id.value = "";
  formEl.elements.rating.value = "4.8";
  formEl.elements.stock.value = "20";
  formEl.elements.abv.value = "0";
  formEl.elements.servingMl.value = "0";
  formEl.elements.paused.checked = false;
  formEl.elements.stock.dataset.initial = "20";
  formEl.elements.image.value = "";
  syncStockField();
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
  formEl.elements.servingMl.value = drink.servingMl || 0;
  formEl.elements.rating.value = drink.rating;
  formEl.elements.paused.checked = drink.status !== "available"; // ô tích "Tạm ngưng phục vụ"
  formEl.elements.stock.dataset.initial = String(drink.stock || 0);
  formEl.elements.featured.checked = drink.featured;
  formEl.elements.baseSpirit.value = drink.baseSpirit || "";
  formEl.elements.glassType.value = drink.glassType || "";
  formEl.elements.ingredients.value = (drink.ingredients || []).join(", ");
  formEl.elements.description.value = drink.description;
  syncStockField();

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

  // Tồn kho lấy đúng số quản lý nhập (0 là 0 - không tự đổi thành số khác).
  // Hết hàng thì bắt buộc "Tạm ngưng"; còn hàng thì quản lý vẫn được chủ động
  // tạm ngưng mà KHÔNG mất số tồn kho đang có.
  const tracked = tracksStock({ category: data.category });
  const stock = Number(data.stock);
  // Ô tích "Tạm ngưng phục vụ" -> trạng thái kinh doanh của món
  const status = formEl.elements.paused.checked ? "soldout" : "available";
  if (tracked && stock === 0 && status === "available") {
    toast("Tồn kho bằng 0 nên món được chuyển sang \"Tạm ngưng phục vụ\".", "info");
  }
  // Sửa món: chỉ gửi kho/trạng thái nếu quản lý đổi - tránh ghi đè số lần rót khách vừa đặt (xem stockPatch).
  // Món pha chế không có tồn kho: chỉ có "Đang phục vụ" / "Tạm ngưng" do quản lý chọn.
  const original = data.id ? allDrinks.find((d) => d.id === data.id) : null;
  let stockFields;
  if (!tracked) stockFields = { stock: 0, status };
  else if (original) stockFields = stockPatch(original, stock, status);
  else stockFields = { stock, status: stock === 0 ? "soldout" : status };

  const payload = {
    name: data.name,
    category: data.category,
    image: data.image || "", // để trống -> biểu tượng mặc định, không mượn ảnh món khác
    price: Number(data.price),
    ...stockFields,
    abv: Number(data.abv) || 0,
    servingMl: Number(data.servingMl) || 0,
    rating: Number(data.rating) || 4.5,
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
      toast(`Đã cập nhật món "${payload.name}".`, "success");
    } else {
      await addDrink(payload);
      toast(`Đã thêm món "${payload.name}" vào thực đơn.`, "success");
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
  [categorySelect, stockSelect].forEach((el) => el.addEventListener("change", () => { currentPage = 1; renderTable(); }));
  formCategorySelect.addEventListener("change", syncStockField);
  // Chai đang hết (kho 0, đang bị tạm ngưng) mà quản lý nhập thêm hàng -> tự bỏ tích để mở bán lại
  formEl.elements.stock.addEventListener("input", () => {
    const stockInput = formEl.elements.stock;
    if (Number(stockInput.dataset.initial) === 0 && Number(stockInput.value) > 0) formEl.elements.paused.checked = false;
  });

  document.getElementById("add-drink-btn").addEventListener("click", openForCreate);
  document.getElementById("drink-modal-close").addEventListener("click", () => closeModal("drink-modal"));
  document.getElementById("drink-form-cancel").addEventListener("click", () => closeModal("drink-modal"));
}

// Chưa đăng nhập -> initAdminLayout chuyển hướng và trả false: dừng, không gọi API
if (initAdminLayout("Quản Lý Thực Đơn")) {
  fillCategorySelects();
  bindEvents();
  bodyEl.innerHTML = `<tr><td colspan="8" class="table-empty py-4 text-center text-muted">Đang tải thực đơn từ máy chủ...</td></tr>`;
  reloadTable();
}

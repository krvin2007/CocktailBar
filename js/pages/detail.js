/* =========================================================
   DETAIL.JS - Trang chi tiết một món đồ uống chuẩn Bar cao cấp
   ========================================================= */

import "../modules/navbar.js";
import { refreshCartBadge } from "../modules/navbar.js";
import { getDrinkById, queryDrinks, CATEGORY_LABELS, getCategoryLabel, servingLabel, isSoldOut } from "../modules/drinksService.js";
import { addToCart, checkCanAdd } from "../modules/ordersService.js";
import { drinkCardHtml } from "../modules/drinkCard.js";
import { formatMoney, escapeHtml, getQueryParam, clamp } from "../modules/utils.js";
import { toast, loadingHtml, errorHtml, setButtonLoading } from "../modules/ui.js";
import { ICONS } from "../modules/icons.js";
import { t } from "../modules/i18n.js";
import { getCurrentCustomer, getCustomerDiscountPercent } from "../modules/customerAuth.js";

const container = document.getElementById("detail-container");
const relatedSection = document.getElementById("related-section");
const relatedGrid = document.getElementById("related-grid");

const drinkId = getQueryParam("id");

/** Món đang xem - tải từ API trong init() */
let drink = null;

function renderNotFound() {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">${ICONS.cocktail(40)}</div>
      <h2>${t("detail_not_found", "Không tìm thấy đồ uống này")}</h2>
      <p class="text-muted">${t("detail_not_found_desc", "Món này có thể đã được gỡ khỏi danh sách phục vụ hoặc đường dẫn không chính xác.")}</p>
      <a href="menu.html" class="btn btn-primary mt-2">
        ${ICONS.arrowLeft(14)} <span>${t("detail_back_menu", "Quay lại thực đơn")}</span>
      </a>
    </div>`;
}

function renderDetail() {
  const soldout = isSoldOut(drink);
  const maxQty = 20;
  const customer = getCurrentCustomer();
  const discountPercent = getCustomerDiscountPercent(customer);
  const hasDiscount = discountPercent > 0;
  const discountedPrice = hasDiscount ? Math.floor((drink.price * (100 - discountPercent)) / 100) : drink.price;

  const isImagePath = typeof drink.image === "string" && (drink.image.includes("/") || drink.image.startsWith("http"));
  const imageHtml = isImagePath
    ? `<img src="${escapeHtml(drink.image)}" alt="${escapeHtml(drink.name)}" class="detail-main-img">`
    : `<div class="detail-fallback-icon">${ICONS.cocktail(80)}</div>`;

  const tasteTags = Array.isArray(drink.tasteNotes) && drink.tasteNotes.length > 0
    ? `<div class="detail-taste-strip">
        <span class="taste-label">${t("detail_taste", "Hương vị đặc trưng:")}</span>
        <div class="taste-pills">
          ${drink.tasteNotes.map((note) => `<span class="taste-tag-large">${escapeHtml(note)}</span>`).join("")}
        </div>
       </div>`
    : "";

  container.innerHTML = `
    <div class="detail-breadcrumb">
      <a href="index.html">${t("detail_crumb_home", "Trang chủ")}</a>
      <span class="sep">/</span>
      <a href="menu.html">${t("detail_crumb_menu", "Thực đơn")}</a>
      <span class="sep">/</span>
      <span class="curr">${escapeHtml(drink.name)}</span>
    </div>

    <div class="detail-grid">
      <div class="detail-image-panel">
        <div class="detail-image-card">
          ${imageHtml}
          ${drink.featured ? `<span class="detail-badge-featured">${ICONS.sparkle(13)} Signature Drink</span>` : ""}
        </div>
      </div>

      <div class="detail-info-panel">
        <div class="detail-header-meta">
          <span class="detail-cat-badge">${getCategoryLabel(drink.category) || CATEGORY_LABELS[drink.category] || drink.category}</span>
          <div class="detail-rating-pill">
            ${ICONS.star(14)}
            <span>${drink.rating} / 5</span>
          </div>
        </div>

        <h1 class="detail-name">${escapeHtml(drink.name)}</h1>
        <div class="detail-price-row">
          ${hasDiscount
            ? `<span class="detail-price">
                 <span style="text-decoration: line-through; opacity: 0.55; font-size: 0.85em; margin-right: 6px;">${formatMoney(drink.price)}</span>
                 <span class="text-amber">${formatMoney(discountedPrice)}</span>
                 <span class="badge badge-warning" style="font-size: 0.72rem; margin-left: 6px;">Ưu đãi -${discountPercent}%</span>
                 ${drink.servingMl ? ` <small class="price-serving">${servingLabel(drink)}</small>` : ""}
               </span>`
            : `<span class="detail-price">${formatMoney(drink.price)}${drink.servingMl ? ` <small class="price-serving">${servingLabel(drink)}</small>` : ""}</span>`}
          <span class="detail-price-note">${t("detail_price_note", "Giá đã bao gồm phí phục vụ")}</span>
        </div>

        <p class="detail-desc">${escapeHtml(drink.description)}</p>

        ${tasteTags}

        <!-- Bảng thông số chi tiết chuẩn quầy Bar -->
        <div class="detail-spec-grid">
          <div class="spec-item">
            <span class="spec-label">${t("detail_abv", "Nồng độ cồn")}</span>
            <span class="spec-val">${drink.abv > 0 ? `${drink.abv}% ABV` : t("detail_zero_abv", "Không cồn (0%)")}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">${t("detail_base", "Rượu nền")}</span>
            <span class="spec-val">${escapeHtml(drink.baseSpirit || t("detail_handcrafted", "Pha chế thủ công"))}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">${t("detail_glass", "Ly phục vụ")}</span>
            <span class="spec-val">${escapeHtml(drink.glassType || t("detail_std_glass", "Ly tiêu chuẩn"))}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">${t("detail_status", "Trạng thái")}</span>
            <span class="spec-val ${soldout ? 'text-danger' : 'text-success'}">
              ${soldout ? t("detail_soldout", "Tạm ngưng phục vụ") : t("detail_available", "Đang phục vụ")}
            </span>
          </div>
        </div>

        <!-- Thành phần nguyên liệu -->
        <div class="detail-ingredients-wrap">
          <span class="ingredients-title">${t("detail_ingredients", "Thành phần phối trộn:")}</span>
          <div class="ingredient-tags">
            ${drink.ingredients.map((i) => `<span>${escapeHtml(i)}</span>`).join("")}
          </div>
        </div>

        ${soldout ? `
          <div class="alert-box alert-warning">
            ${ICONS.alertCircle(18)}
            <span>${t("detail_soldout_msg", "Món này hiện đang tạm ngưng phục vụ. Bạn vui lòng chọn một hương vị khác nhé!")}</span>
          </div>
          <button class="btn btn-primary btn-block btn-lg" disabled>${t("detail_soldout", "Tạm ngưng phục vụ")}</button>
        ` : `
          <div class="detail-action-bar">
            <div class="qty-control">
              <button type="button" id="qty-minus" aria-label="Giảm">−</button>
              <input type="number" id="qty-input" value="1" min="1" max="${maxQty}">
              <button type="button" id="qty-plus" aria-label="Tăng">+</button>
            </div>

            <button class="btn btn-primary btn-lg" id="add-cart-btn">
              ${ICONS.shoppingBag(18)}
              <span>${t("detail_add", "Thêm Vào Danh Sách")}</span>
            </button>

            <a href="order.html" class="btn btn-ghost btn-lg">
              <span>${t("detail_view_cart", "Xem Giỏ Hàng")}</span>
            </a>
          </div>
        `}

        ${drink.abv > 0 ? `
          <div class="detail-responsibility-note">
            ${ICONS.info(15)}
            <span>${t("detail_age_note", "Đồ uống có nồng độ cồn chỉ phục vụ khách hàng trên 18 tuổi. Hãy thưởng thức có trách nhiệm.")}</span>
          </div>` : ""}
      </div>
    </div>`;

  if (!soldout) bindQuantityControls(maxQty);
}

function bindQuantityControls(maxQty) {
  const qtyInput = document.getElementById("qty-input");
  const minusBtn = document.getElementById("qty-minus");
  const plusBtn = document.getElementById("qty-plus");
  const addBtn = document.getElementById("add-cart-btn");

  if (minusBtn && qtyInput) {
    minusBtn.addEventListener("click", () => {
      qtyInput.value = clamp(Number(qtyInput.value) - 1, 1, maxQty);
    });
  }

  if (plusBtn && qtyInput) {
    plusBtn.addEventListener("click", () => {
      qtyInput.value = clamp(Number(qtyInput.value) + 1, 1, maxQty);
    });
  }

  if (qtyInput) {
    qtyInput.addEventListener("change", () => {
      qtyInput.value = clamp(Number(qtyInput.value) || 1, 1, maxQty);
    });
  }

  if (addBtn) {
    addBtn.addEventListener("click", async () => {
      const qty = Number(qtyInput.value);
      const restoreButton = setButtonLoading(addBtn, "Đang thêm vào danh sách...");

      try {
        const freshDrink = await getDrinkById(drink.id);
        const check = checkCanAdd(freshDrink, qty);
        if (!check.ok) {
          toast(check.reason === "soldout"
            ? `"${drink.name}" hiện đang tạm ngưng phục vụ.`
            : `"${drink.name}" chỉ còn ${check.available} ly (danh sách của bạn đã có ${check.inCart} ly).`, "error");
          return;
        }

        // Truyền CẢ ĐỐI TƯỢNG món (không phải chỉ id) - giỏ hàng cần tên/giá/ảnh
        addToCart(freshDrink, qty);
        refreshCartBadge();
        toast(`Đã thêm ${qty} ly "${drink.name}" vào danh sách gọi món.`, "success");
      } catch (err) {
        toast(err.message, "error");
      } finally {
        restoreButton();
      }
    });
  }
}

async function renderRelated() {
  if (!drink || !relatedSection || !relatedGrid) return;

  const related = (await queryDrinks({ category: drink.category }))
    .filter((d) => d.id !== drink.id)
    .slice(0, 3);

  if (!related.length) return;

  relatedGrid.innerHTML = related.map(drinkCardHtml).join("");
  relatedSection.hidden = false;
}

async function init() {
  if (!drinkId) {
    renderNotFound();
    return;
  }

  container.innerHTML = loadingHtml("Đang tải thông tin đồ uống...");
  try {
    drink = await getDrinkById(drinkId);
    if (!drink) {
      renderNotFound();
      return;
    }
    renderDetail();
    await renderRelated();
  } catch (err) {
    container.innerHTML = errorHtml(err.message);
  }

  window.addEventListener("languagechange", () => {
    if (drink) {
      renderDetail();
      renderRelated();
    }
  });
}

init();

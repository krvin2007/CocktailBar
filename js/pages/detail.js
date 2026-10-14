/* =========================================================
   DETAIL.JS - Trang chi tiết một món đồ uống chuẩn Bar cao cấp
   Hiển thị đầy đủ chương trình giá đang áp dụng cho món:
   giá sau ưu đãi, giá gốc gạch ngang, nhãn chương trình (Sale X% /
   Món mới giảm 10%), số tiền tiết kiệm mỗi ly và theo số lượng chọn.
   Giỏ hàng tự lưu giá sau ưu đãi khi addToCart (ordersService.js).
   ========================================================= */

import "../modules/navbar.js";
import { refreshCartBadge } from "../modules/navbar.js";
import {
  getDrinkById, queryDrinks, CATEGORY_LABELS, getCategoryLabel,
  getDrinkPricing, NEW_DRINK_DAYS, NEW_DRINK_DISCOUNT,
} from "../modules/drinksService.js";
import { addToCart, getCart } from "../modules/ordersService.js";
import { drinkCardHtml, drinkFlagsHtml } from "../modules/drinkCard.js";
import { formatMoney, formatDate, escapeHtml, getQueryParam, clamp } from "../modules/utils.js";
import { toast, loadingHtml, errorHtml, setButtonLoading } from "../modules/ui.js";
import { ICONS } from "../modules/icons.js";

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
      <h2>Không tìm thấy đồ uống này</h2>
      <p class="text-muted">Món này có thể đã được gỡ khỏi danh sách phục vụ hoặc đường dẫn không chính xác.</p>
      <a href="menu.html" class="btn btn-primary mt-2">
        ${ICONS.arrowLeft(14)} <span>Quay lại thực đơn</span>
      </a>
    </div>`;
}

/** Ngày cuối cùng món còn được tính là "món mới" (ngày tạo + NEW_DRINK_DAYS) */
function newDrinkEndDate(createdAt) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return "";
  created.setDate(created.getDate() + NEW_DRINK_DAYS);
  return formatDate(created.toISOString());
}

/**
 * Khối giá: giá sau ưu đãi + giá gốc gạch + chip "-X%", và hộp mô tả
 * chương trình (Sale theo món / Món mới) kèm số tiền tiết kiệm mỗi ly.
 */
function priceBlockHtml(pricing) {
  if (!pricing.onSale) {
    return `
      <div class="detail-price-row">
        <span class="detail-price">${formatMoney(pricing.originalPrice)}</span>
        <span class="detail-price-note">Giá đã bao gồm phí phục vụ</span>
      </div>`;
  }

  const savings = pricing.originalPrice - pricing.finalPrice;
  const programLabel = pricing.reason === "new"
    ? `Món mới giảm ${pricing.percent}%`
    : `Sale ${pricing.percent}%`;

  let programNote;
  if (pricing.reason === "new") {
    const endDate = newDrinkEndDate(drink.createdAt);
    programNote = `Chương trình "Sale sản phẩm mới" áp dụng trong ${NEW_DRINK_DAYS} ngày đầu ra mắt${endDate ? ` (kết thúc ngày ${endDate})` : ""}.`;
  } else if (pricing.isNew) {
    // Món mới nhưng đang sale sâu hơn -> áp mức cao hơn, KHÔNG cộng dồn hai ưu đãi
    programNote = `Món mới ra mắt đang được áp mức sale ${pricing.percent}% (${pricing.percent > NEW_DRINK_DISCOUNT ? "cao hơn" : "bằng"} ưu đãi món mới ${NEW_DRINK_DISCOUNT}%, không cộng dồn).`;
  } else {
    programNote = "Giá ưu đãi theo món do quán áp dụng, không cần nhập mã giảm giá.";
  }

  return `
    <div class="detail-price-row detail-price-row-sale">
      <span class="detail-price is-sale">${formatMoney(pricing.finalPrice)}</span>
      <s class="detail-price-old">${formatMoney(pricing.originalPrice)}</s>
      <span class="detail-sale-chip">-${pricing.percent}%</span>
      <span class="detail-price-note">Giá đã bao gồm phí phục vụ</span>
    </div>

    <div class="detail-promo-box ${pricing.reason === "new" ? "is-new" : ""}">
      <span class="detail-promo-icon">${pricing.reason === "new" ? ICONS.sparkle(18) : ICONS.flame(18)}</span>
      <div class="detail-promo-text">
        <strong>${programLabel}</strong>
        <span>Tiết kiệm <b>${formatMoney(savings)}</b> mỗi ly. ${programNote}</span>
      </div>
    </div>`;
}

/** Dòng "Thành tiền" theo số lượng đang chọn - cập nhật mỗi khi đổi số ly */
function lineTotalHtml(pricing, qty) {
  const total = pricing.finalPrice * qty;
  const saved = (pricing.originalPrice - pricing.finalPrice) * qty;
  return `
    <span class="detail-line-label">Thành tiền ${qty} ly:</span>
    <strong class="detail-line-value">${formatMoney(total)}</strong>
    ${saved > 0 ? `<span class="detail-line-saved">Tiết kiệm ${formatMoney(saved)}</span>` : ""}`;
}

function renderDetail() {
  const soldout = drink.status === "soldout" || drink.stock <= 0;
  const maxQty = 20;
  const pricing = getDrinkPricing(drink);

  const isImagePath = typeof drink.image === "string" && (drink.image.includes("/") || drink.image.startsWith("http"));
  const imageHtml = isImagePath
    ? `<img src="${escapeHtml(drink.image)}" alt="${escapeHtml(drink.name)}" class="detail-main-img">`
    : `<div class="detail-fallback-icon">${ICONS.cocktail(80)}</div>`;

  const tasteTags = Array.isArray(drink.tasteNotes) && drink.tasteNotes.length > 0
    ? `<div class="detail-taste-strip">
        <span class="taste-label">Hương vị đặc trưng:</span>
        <div class="taste-pills">
          ${drink.tasteNotes.map((t) => `<span class="taste-tag-large">${escapeHtml(t)}</span>`).join("")}
        </div>
       </div>`
    : "";

  container.innerHTML = `
    <div class="detail-breadcrumb">
      <a href="index.html">Trang chủ</a>
      <span class="sep">/</span>
      <a href="menu.html">Thực đơn</a>
      <span class="sep">/</span>
      <span class="curr">${escapeHtml(drink.name)}</span>
    </div>

    <div class="detail-grid">
      <div class="detail-image-panel">
        <div class="detail-image-card">
          ${imageHtml}
          ${drink.featured ? `<span class="detail-badge-featured">${ICONS.sparkle(13)} Signature Drink</span>` : ""}
          ${drinkFlagsHtml(drink, pricing)}
        </div>
      </div>

      <div class="detail-info-panel">
        <div class="detail-header-meta">
          <span class="detail-cat-badge">${escapeHtml(getCategoryLabel(drink.category) || CATEGORY_LABELS[drink.category] || drink.category)}</span>
          <div class="detail-rating-pill">
            ${ICONS.star(14)}
            <span>${drink.rating} / 5</span>
          </div>
        </div>

        <h1 class="detail-name">${escapeHtml(drink.name)}</h1>
        ${priceBlockHtml(pricing)}

        <p class="detail-desc">${escapeHtml(drink.description)}</p>

        ${tasteTags}

        <!-- Bảng thông số chi tiết chuẩn quầy Bar -->
        <div class="detail-spec-grid">
          <div class="spec-item">
            <span class="spec-label">Nồng độ cồn</span>
            <span class="spec-val">${drink.abv > 0 ? `${drink.abv}% ABV` : "Không cồn (0%)"}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Rượu nền</span>
            <span class="spec-val">${escapeHtml(drink.baseSpirit || "Pha chế thủ công")}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Ly phục vụ</span>
            <span class="spec-val">${escapeHtml(drink.glassType || "Ly tiêu chuẩn")}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Trạng thái</span>
            <span class="spec-val ${soldout ? 'text-danger' : 'text-success'}">
              ${soldout ? "Tạm ngưng phục vụ" : "Đang phục vụ"}
            </span>
          </div>
        </div>

        <!-- Thành phần nguyên liệu -->
        <div class="detail-ingredients-wrap">
          <span class="ingredients-title">Thành phần phối trộn:</span>
          <div class="ingredient-tags">
            ${drink.ingredients.map((i) => `<span>${escapeHtml(i)}</span>`).join("")}
          </div>
        </div>

        ${soldout ? `
          <div class="alert-box alert-warning">
            ${ICONS.alertCircle(18)}
            <span>Món này hiện đang tạm ngưng phục vụ. Bạn vui lòng chọn một hương vị khác nhé!</span>
          </div>
          <button class="btn btn-primary btn-block btn-lg" disabled>Tạm ngưng phục vụ</button>
        ` : `
          <div class="detail-action-bar">
            <div class="qty-control">
              <button type="button" id="qty-minus" aria-label="Giảm">−</button>
              <input type="number" id="qty-input" value="1" min="1" max="${maxQty}">
              <button type="button" id="qty-plus" aria-label="Tăng">+</button>
            </div>

            <button class="btn btn-primary btn-lg" id="add-cart-btn">
              ${ICONS.shoppingBag(18)}
              <span>Thêm Vào Danh Sách</span>
            </button>

            <a href="order.html" class="btn btn-ghost btn-lg">
              <span>Xem Giỏ Hàng</span>
            </a>
          </div>
          <div class="detail-line-total" id="detail-line-total" aria-live="polite">${lineTotalHtml(pricing, 1)}</div>
        `}

        ${drink.abv > 0 ? `
          <div class="detail-responsibility-note">
            ${ICONS.info(15)}
            <span>Đồ uống có nồng độ cồn chỉ phục vụ khách hàng trên 18 tuổi. Hãy thưởng thức có trách nhiệm.</span>
          </div>` : ""}
      </div>
    </div>`;

  if (!soldout) bindQuantityControls(maxQty, pricing);
}

function bindQuantityControls(maxQty, pricing) {
  const qtyInput = document.getElementById("qty-input");
  const minusBtn = document.getElementById("qty-minus");
  const plusBtn = document.getElementById("qty-plus");
  const addBtn = document.getElementById("add-cart-btn");
  const lineTotalEl = document.getElementById("detail-line-total");

  /** Ghi số lượng hợp lệ vào ô và cập nhật dòng thành tiền theo giá ưu đãi */
  const setQty = (value) => {
    if (!qtyInput) return;
    qtyInput.value = clamp(Number(value) || 1, 1, maxQty);
    if (lineTotalEl) lineTotalEl.innerHTML = lineTotalHtml(pricing, Number(qtyInput.value));
  };

  if (minusBtn && qtyInput) {
    minusBtn.addEventListener("click", () => setQty(Number(qtyInput.value) - 1));
  }

  if (plusBtn && qtyInput) {
    plusBtn.addEventListener("click", () => setQty(Number(qtyInput.value) + 1));
  }

  if (qtyInput) {
    qtyInput.addEventListener("change", () => setQty(qtyInput.value));
    qtyInput.addEventListener("input", () => {
      // Đang gõ dở (ô trống) thì chưa ép giá trị, chỉ cập nhật khi là số hợp lệ
      const typed = Number(qtyInput.value);
      if (typed >= 1 && typed <= maxQty && lineTotalEl) {
        lineTotalEl.innerHTML = lineTotalHtml(pricing, Math.floor(typed));
      }
    });
  }

  if (addBtn) {
    addBtn.addEventListener("click", async () => {
      const qty = Number(qtyInput.value);
      const restoreButton = setButtonLoading(addBtn, "Đang thêm vào danh sách...");

      try {
        const freshDrink = await getDrinkById(drink.id);
        const inCart = getCart().find((item) => item.drinkId === drink.id)?.qty || 0;
        const available = freshDrink && freshDrink.status === "available" ? freshDrink.stock : 0;

        if (!freshDrink || freshDrink.status !== "available" || freshDrink.stock <= 0) {
          toast(`"${drink.name}" hiện đang tạm ngưng phục vụ.`, "error");
          return;
        }

        if (inCart + qty > available) {
          toast(`"${drink.name}" hiện đang tạm ngưng phục vụ thêm cho ca này.`, "error");
          return;
        }

        // Truyền CẢ ĐỐI TƯỢNG món (không phải chỉ id) - giỏ hàng cần tên/giá/ảnh;
        // ordersService tự lưu giá SAU ƯU ĐÃI (getDrinkPricing) vào giỏ
        addToCart(freshDrink, qty);
        refreshCartBadge();

        const freshPricing = getDrinkPricing(freshDrink);
        const priceText = freshPricing.onSale
          ? ` với giá ưu đãi ${formatMoney(freshPricing.finalPrice)}/ly (-${freshPricing.percent}%)`
          : "";
        toast(`Đã thêm ${qty} ly "${freshDrink.name}" vào danh sách gọi món${priceText}.`, "success");

        // Quản trị viên vừa đổi giá / bật-tắt sale khi khách đang xem trang
        // -> vẽ lại để giá trên màn hình khớp đúng giá đã vào giỏ
        if (freshPricing.finalPrice !== pricing.finalPrice || freshPricing.percent !== pricing.percent) {
          drink = freshDrink;
          toast(`Giá "${freshDrink.name}" vừa được quán cập nhật: ${formatMoney(freshPricing.finalPrice)}/ly.`, "info");
          renderDetail();
        }
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

/* =========================================================
   DRINK-CARD.JS - Hàm dựng "thẻ đồ uống" chuẩn Menu Bar quốc tế
   Sử dụng hình ảnh chụp thực tế, thông số pha chế (ABV, Tasting Notes,
   Ly phục vụ) và biểu tượng nét mảnh, loại bỏ hoàn toàn Emoji thô.
   ========================================================= */

import { CATEGORY_LABELS, getCategoryLabel, servingLabel } from "./drinksService.js";
import { formatMoney, escapeHtml } from "./utils.js";
import { ICONS } from "./icons.js";
import { t } from "./i18n.js";
import { isSoldOut } from "./drinksService.js";
import { getCurrentCustomer, getCustomerDiscountPercent } from "./customerAuth.js";
import { isFavorite, toggleFavorite } from "./favoritesService.js";

// Gắn sự kiện toggle tim yêu thích toàn cục
if (typeof document !== "undefined") {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-drink-favorite");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const id = btn.dataset.id;
    const isNowFav = toggleFavorite(id);
    btn.classList.toggle("is-favorite", isNowFav);
    btn.setAttribute("title", isNowFav ? "Bỏ yêu thích" : "Thêm vào yêu thích");
    const svg = btn.querySelector("svg");
    if (svg) {
      svg.setAttribute("fill", isNowFav ? "#ef4444" : "none");
      svg.setAttribute("stroke", isNowFav ? "#ef4444" : "currentColor");
    }
  });
}

export function drinkCardHtml(drink) {
  const soldout = isSoldOut(drink);
  const customer = getCurrentCustomer();
  const discountPercent = getCustomerDiscountPercent(customer);
  const hasDiscount = discountPercent > 0;
  const discountedPrice = hasDiscount ? Math.floor((drink.price * (100 - discountPercent)) / 100) : drink.price;
  const fav = isFavorite(drink.id);

  const favBtnHtml = `
    <button type="button" class="btn-drink-favorite ${fav ? "is-favorite" : ""}" data-id="${drink.id}" aria-label="Yêu thích món này" title="${fav ? "Bỏ yêu thích" : "Thêm vào yêu thích"}">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="${fav ? "#ef4444" : "none"}" stroke="${fav ? "#ef4444" : "currentColor"}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
    </button>`;

  const isImagePath = typeof drink.image === "string" && (drink.image.includes("/") || drink.image.startsWith("http"));
  const imageHtml = isImagePath
    ? `<img src="${escapeHtml(drink.image)}" alt="${escapeHtml(drink.name)}" loading="lazy" class="drink-card-img">`
    : `<div class="drink-card-fallback">${ICONS.cocktail(40)}</div>`;

  const tasteTags = Array.isArray(drink.tasteNotes) && drink.tasteNotes.length > 0
    ? `<div class="drink-card-tastes">
        ${drink.tasteNotes.slice(0, 3).map((tag) => `<span class="taste-pill">${escapeHtml(tag)}</span>`).join("")}
       </div>`
    : "";

  const priceHtml = hasDiscount
    ? `<span class="drink-card-price">
         <span style="text-decoration: line-through; opacity: 0.55; font-size: 0.82em; margin-right: 4px;">${formatMoney(drink.price)}</span>
         <span class="text-amber font-bold">${formatMoney(discountedPrice)}</span>
         <span class="badge badge-warning" style="font-size: 0.65rem; padding: 1px 4px; vertical-align: middle;">-${discountPercent}%</span>
         ${drink.servingMl ? ` <small class="price-serving">${servingLabel(drink)}</small>` : ""}
       </span>`
    : `<span class="drink-card-price">${formatMoney(drink.price)}${drink.servingMl ? ` <small class="price-serving">${servingLabel(drink)}</small>` : ""}</span>`;

  return `
    <a class="drink-card" href="detail.html?id=${drink.id}">
      <div class="drink-card-image-wrap">
        ${favBtnHtml}
        ${soldout ? `<span class="drink-badge badge-soldout">${t("badge_soldout", "Tạm hết món")}</span>` : ""}
        ${drink.featured ? `<span class="drink-badge badge-featured">${ICONS.sparkle(12)} Signature</span>` : ""}
        ${imageHtml}
        <div class="drink-card-overlay"></div>
      </div>

      <div class="drink-card-body">
        <div class="drink-card-meta">
          <span class="drink-card-cat">${getCategoryLabel(drink.category) || CATEGORY_LABELS[drink.category] || drink.category}</span>
          ${drink.glassType ? `<span class="drink-card-glass">${escapeHtml(drink.glassType)}</span>` : ""}
        </div>

        <h3 class="drink-card-name">${escapeHtml(drink.name)}</h3>
        <p class="drink-card-desc">${escapeHtml(drink.description)}</p>

        ${tasteTags}

        <div class="drink-card-footer">
          ${priceHtml}
          <div class="drink-card-badges">
            ${drink.abv > 0 ? `<span class="badge-abv" title="${t("abv_tooltip", "Nồng độ cồn")}">${drink.abv}% ABV</span>` : `<span class="badge-zero">0% ABV</span>`}
            <span class="drink-card-rating" title="${t("rating_tooltip", "Đánh giá")}">${ICONS.star(13)} ${drink.rating}</span>
          </div>
        </div>
      </div>
    </a>`;
}

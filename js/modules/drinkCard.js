/* =========================================================
   DRINK-CARD.JS - Hàm dựng "thẻ đồ uống" chuẩn Menu Bar quốc tế
   Sử dụng hình ảnh chụp thực tế, thông số pha chế (ABV, Tasting Notes,
   Ly phục vụ) và biểu tượng nét mảnh, loại bỏ hoàn toàn Emoji thô.
   ========================================================= */

import { CATEGORY_LABELS, getCategoryLabel } from "./drinksService.js";
import { formatMoney, escapeHtml } from "./utils.js";
import { ICONS } from "./icons.js";
import { t } from "./i18n.js";

export function drinkCardHtml(drink) {
  const soldout = drink.status === "soldout" || drink.stock <= 0;

  const isImagePath = typeof drink.image === "string" && (drink.image.includes("/") || drink.image.startsWith("http"));
  const imageHtml = isImagePath
    ? `<img src="${escapeHtml(drink.image)}" alt="${escapeHtml(drink.name)}" loading="lazy" class="drink-card-img">`
    : `<div class="drink-card-fallback">${ICONS.cocktail(40)}</div>`;

  const tasteTags = Array.isArray(drink.tasteNotes) && drink.tasteNotes.length > 0
    ? `<div class="drink-card-tastes">
        ${drink.tasteNotes.slice(0, 3).map((t) => `<span class="taste-pill">${escapeHtml(t)}</span>`).join("")}
       </div>`
    : "";

  return `
    <a class="drink-card" href="detail.html?id=${drink.id}">
      <div class="drink-card-image-wrap">
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
          <span class="drink-card-price">${formatMoney(drink.price)}</span>
          <div class="drink-card-badges">
            ${drink.abv > 0 ? `<span class="badge-abv" title="${t("abv_tooltip", "Nồng độ cồn")}">${drink.abv}% ABV</span>` : `<span class="badge-zero">0% ABV</span>`}
            <span class="drink-card-rating" title="${t("rating_tooltip", "Đánh giá")}">${ICONS.star(13)} ${drink.rating}</span>
          </div>
        </div>
      </div>
    </a>`;
}

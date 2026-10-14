/* =========================================================
   DRINK-CARD.JS - Hàm dựng "thẻ đồ uống" chuẩn Menu Bar quốc tế
   Sử dụng hình ảnh chụp thực tế, thông số pha chế (ABV, Tasting Notes,
   Ly phục vụ) và biểu tượng nét mảnh, loại bỏ hoàn toàn Emoji thô.
   Thẻ tự hiển thị chương trình giá đang áp dụng cho món:
   - huy hiệu "Mới" (món lên thực đơn trong NEW_DRINK_DAYS ngày gần nhất),
   - huy hiệu "-X%" (sale theo món hoặc ưu đãi món mới),
   - giá gốc gạch ngang + giá sau giảm (getDrinkPricing - drinksService.js).
   ========================================================= */

import { CATEGORY_LABELS, getCategoryLabel, getDrinkPricing } from "./drinksService.js";
import { formatMoney, escapeHtml } from "./utils.js";
import { ICONS } from "./icons.js";
import { t, getCurrentLang } from "./i18n.js";

/** Chuỗi song ngữ: ưu tiên bản dịch trong i18n.js, chưa có key thì dùng chuỗi theo ngôn ngữ hiện hành */
function label(key, vi, en) {
  return t(key, getCurrentLang() === "en" ? en : vi);
}

/**
 * Cụm huy hiệu khuyến mãi góc phải ảnh: "Mới" và/hoặc "-X%".
 * Trả "" nếu món không mới và không giảm giá. Dùng chung cho mọi nơi
 * hiển thị thẻ món (thực đơn, trang chủ, trang khuyến mãi, món liên quan).
 */
export function drinkFlagsHtml(drink, pricing = getDrinkPricing(drink)) {
  if (!pricing.isNew && !pricing.onSale) return "";

  const saleTitle = pricing.reason === "new"
    ? label("promo_new_title", `Ưu đãi món mới: giảm ${pricing.percent}%`, `New arrival offer: ${pricing.percent}% off`)
    : label("promo_sale_title", `Đang sale ${pricing.percent}%`, `${pricing.percent}% off`);

  return `
    <div class="drink-flags">
      ${pricing.isNew ? `<span class="drink-flag flag-new">${ICONS.sparkle(11)} ${label("badge_new", "Mới", "New")}</span>` : ""}
      ${pricing.onSale ? `<span class="drink-flag flag-sale" title="${escapeHtml(saleTitle)}">-${pricing.percent}%</span>` : ""}
    </div>`;
}

/**
 * Cụm giá của thẻ món: món có ưu đãi -> giá sau giảm nổi bật + giá gốc
 * gạch ngang; món thường -> chỉ một giá như trước đây.
 */
export function drinkPriceHtml(drink, pricing = getDrinkPricing(drink)) {
  if (!pricing.onSale) {
    return `<span class="drink-card-price">${formatMoney(pricing.originalPrice)}</span>`;
  }
  return `
    <span class="drink-card-price-group">
      <span class="drink-card-price is-sale">${formatMoney(pricing.finalPrice)}</span>
      <s class="drink-card-price-old" aria-label="${escapeHtml(label("price_original", "Giá gốc", "Original price"))}">${formatMoney(pricing.originalPrice)}</s>
    </span>`;
}

export function drinkCardHtml(drink) {
  const soldout = drink.status === "soldout" || drink.stock <= 0;
  const pricing = getDrinkPricing(drink);

  const isImagePath = typeof drink.image === "string" && (drink.image.includes("/") || drink.image.startsWith("http"));
  const imageHtml = isImagePath
    ? `<img src="${escapeHtml(drink.image)}" alt="${escapeHtml(drink.name)}" loading="lazy" class="drink-card-img">`
    : `<div class="drink-card-fallback">${ICONS.cocktail(40)}</div>`;

  const tasteTags = Array.isArray(drink.tasteNotes) && drink.tasteNotes.length > 0
    ? `<div class="drink-card-tastes">
        ${drink.tasteNotes.slice(0, 3).map((note) => `<span class="taste-pill">${escapeHtml(note)}</span>`).join("")}
       </div>`
    : "";

  return `
    <a class="drink-card${pricing.onSale ? " drink-card-on-sale" : ""}" href="detail.html?id=${encodeURIComponent(drink.id)}">
      <div class="drink-card-image-wrap">
        ${soldout ? `<span class="drink-badge badge-soldout">${t("badge_soldout", "Tạm hết món")}</span>` : ""}
        ${drink.featured && !soldout ? `<span class="drink-badge badge-featured">${ICONS.sparkle(12)} Signature</span>` : ""}
        ${drinkFlagsHtml(drink, pricing)}
        ${imageHtml}
        <div class="drink-card-overlay"></div>
      </div>

      <div class="drink-card-body">
        <div class="drink-card-meta">
          <span class="drink-card-cat">${escapeHtml(getCategoryLabel(drink.category) || CATEGORY_LABELS[drink.category] || drink.category)}</span>
          ${drink.glassType ? `<span class="drink-card-glass">${escapeHtml(drink.glassType)}</span>` : ""}
        </div>

        <h3 class="drink-card-name">${escapeHtml(drink.name)}</h3>
        <p class="drink-card-desc">${escapeHtml(drink.description)}</p>

        ${tasteTags}

        <div class="drink-card-footer">
          ${drinkPriceHtml(drink, pricing)}
          <div class="drink-card-badges">
            ${drink.abv > 0 ? `<span class="badge-abv" title="${t("abv_tooltip", "Nồng độ cồn")}">${drink.abv}% ABV</span>` : `<span class="badge-zero">0% ABV</span>`}
            <span class="drink-card-rating" title="${t("rating_tooltip", "Đánh giá")}">${ICONS.star(13)} ${drink.rating}</span>
          </div>
        </div>
      </div>
    </a>`;
}

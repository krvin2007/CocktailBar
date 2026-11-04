/* =========================================================
   DETAIL.JS - Trang chi tiết một món đồ uống chuẩn Bar cao cấp
   ========================================================= */

import "../modules/navbar.js";
import { refreshCartBadge } from "../modules/navbar.js";
import { getDrinkById, queryDrinks, CATEGORY_LABELS, getCategoryLabel, servingLabel, isSoldOut } from "../modules/drinksService.js";
import { addToCart, checkCanAdd } from "../modules/ordersService.js";
import { drinkCardHtml } from "../modules/drinkCard.js";
import { formatMoney, formatDateTime, escapeHtml, getQueryParam, clamp } from "../modules/utils.js";
import { toast, loadingHtml, errorHtml, setButtonLoading } from "../modules/ui.js";
import { ICONS } from "../modules/icons.js";
import { t } from "../modules/i18n.js";
import { getCurrentCustomer, getCustomerDiscountPercent } from "../modules/customerAuth.js";
import { isFavorite, toggleFavorite } from "../modules/favoritesService.js";
import { getDrinkReviews, addDrinkReview } from "../modules/reviewsService.js";

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
  const fav = isFavorite(drink.id);

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
        <div class="detail-header-meta" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <span class="detail-cat-badge">${getCategoryLabel(drink.category) || CATEGORY_LABELS[drink.category] || drink.category}</span>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="detail-rating-pill">
              ${ICONS.star(14)}
              <span>${drink.rating} / 5</span>
            </div>
            <button type="button" class="btn btn-ghost btn-sm ${fav ? "is-favorite" : ""}" id="btn-detail-fav" title="${fav ? "Bỏ yêu thích" : "Lưu vào yêu thích"}" style="padding: 5px 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.18); display: inline-flex; align-items: center; gap: 6px; color: ${fav ? "#ef4444" : "var(--cream)"}; background: ${fav ? "rgba(239,68,68,0.15)" : "rgba(0,0,0,0.3)"};">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="${fav ? "#ef4444" : "none"}" stroke="${fav ? "#ef4444" : "currentColor"}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              <span>${fav ? "Đã thích" : "Yêu thích"}</span>
            </button>
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
    </div>

    <!-- KHỐI ĐÁNH GIÁ & BÌNH LUẬN KHÁCH HÀNG -->
    <div class="detail-reviews-wrapper" id="detail-reviews-box" style="margin-top: 48px; padding-top: 32px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
        <div>
          <h2 style="font-family: var(--font-heading); font-size: 1.8rem; color: var(--cream); margin: 0 0 6px 0;">Đánh Giá &amp; Bình Luận</h2>
          <p class="text-xs text-muted" style="margin: 0;">Nhận xét thực tế từ những vị khách đã từng thưởng thức ly cocktail này tại quầy bar.</p>
        </div>
      </div>

      <!-- FORM GỬI ĐÁNH GIÁ -->
      <div class="review-form-card" style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(212, 175, 55, 0.25); border-radius: var(--radius-md); padding: 20px 22px; margin-bottom: 30px;">
        <h4 style="font-size: 1.05rem; color: var(--gold-light); margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">
          <span>✍️</span> <span>Gửi Cảm Nhận Của Bạn Về Hương Vị Này</span>
        </h4>

        <form id="drink-review-form" novalidate>
          <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 14px; flex-wrap: wrap;">
            <label style="font-size: 0.85rem; color: var(--cream); font-weight: 600;">Mức độ hài lòng:</label>
            <div id="star-rating-picker" style="display: flex; gap: 6px; cursor: pointer;">
              <span class="star-pick" data-val="1" style="font-size: 1.4rem; color: #f59e0b;">★</span>
              <span class="star-pick" data-val="2" style="font-size: 1.4rem; color: #f59e0b;">★</span>
              <span class="star-pick" data-val="3" style="font-size: 1.4rem; color: #f59e0b;">★</span>
              <span class="star-pick" data-val="4" style="font-size: 1.4rem; color: #f59e0b;">★</span>
              <span class="star-pick" data-val="5" style="font-size: 1.4rem; color: #f59e0b;">★</span>
            </div>
            <span id="star-text-display" style="font-size: 0.85rem; color: var(--amber-soft); font-weight: 600;">Tuyệt hảo (5/5)</span>
          </div>

          <div class="form-group mb-3">
            <textarea id="review-comment-input" rows="3" placeholder="Chia sẻ cảm nhận về hương thơm, hậu vị hoặc trải nghiệm thưởng thức ly cocktail này..." style="width: 100%; padding: 12px 14px; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; font-size: 0.92rem; line-height: 1.5; resize: vertical;" required></textarea>
          </div>

          <div style="display: flex; justify-content: flex-end;">
            <button type="submit" class="btn btn-primary" id="btn-submit-review">
              <span>Gửi đánh giá</span>
              ${ICONS.arrowRight(14)}
            </button>
          </div>
        </form>
      </div>

      <!-- DANH SÁCH BÌNH LUẬN -->
      <div id="drink-reviews-list">
        <p class="text-muted text-sm">Đang tải nhận xét...</p>
      </div>
    </div>`;

  // Gắn sự kiện tim yêu thích
  const favBtn = document.getElementById("btn-detail-fav");
  if (favBtn) {
    favBtn.addEventListener("click", () => {
      const isNowFav = toggleFavorite(drink.id);
      favBtn.classList.toggle("is-favorite", isNowFav);
      favBtn.style.color = isNowFav ? "#ef4444" : "var(--cream)";
      favBtn.style.background = isNowFav ? "rgba(239,68,68,0.15)" : "rgba(0,0,0,0.3)";
      const svg = favBtn.querySelector("svg");
      if (svg) {
        svg.setAttribute("fill", isNowFav ? "#ef4444" : "none");
        svg.setAttribute("stroke", isNowFav ? "#ef4444" : "currentColor");
      }
      favBtn.querySelector("span").textContent = isNowFav ? "Đã thích" : "Yêu thích";
      toast(isNowFav ? `Đã lưu "${drink.name}" vào danh sách yêu thích!` : `Đã bỏ lưu "${drink.name}".`, "info");
    });
  }

  // Khởi tạo khối đánh giá & bình luận
  initReviewSection();

  if (!soldout) bindQuantityControls(maxQty);
}

let selectedRating = 5;

async function initReviewSection() {
  const listEl = document.getElementById("drink-reviews-list");
  const starPicker = document.getElementById("star-rating-picker");
  const starText = document.getElementById("star-text-display");
  const form = document.getElementById("drink-review-form");
  const commentInput = document.getElementById("review-comment-input");
  const submitBtn = document.getElementById("btn-submit-review");

  const ratingLabels = {
    1: "Chưa hài lòng (1/5)",
    2: "Bình thường (2/5)",
    3: "Khá ổn (3/5)",
    4: "Rất ngon (4/5)",
    5: "Tuyệt hảo (5/5)",
  };

  if (starPicker) {
    starPicker.querySelectorAll(".star-pick").forEach((star) => {
      star.addEventListener("click", () => {
        const val = Number(star.dataset.val);
        selectedRating = val;
        starText.textContent = ratingLabels[val] || `${val}/5`;
        starPicker.querySelectorAll(".star-pick").forEach((s) => {
          const sVal = Number(s.dataset.val);
          s.style.color = sVal <= val ? "#f59e0b" : "rgba(255,255,255,0.2)";
        });
      });
    });
  }

  async function loadReviews() {
    try {
      const reviews = await getDrinkReviews(drink.id);
      if (!reviews.length) {
        listEl.innerHTML = `
          <div style="padding: 24px; text-align: center; background: rgba(255,255,255,0.015); border-radius: 8px; border: 1px dashed rgba(255,255,255,0.1);">
            <p class="text-muted" style="margin: 0;">Chưa có bình luận nào cho món này. Hãy là người đầu tiên chia sẻ cảm nhận!</p>
          </div>`;
        return;
      }

      listEl.innerHTML = reviews.map((r) => {
        const starsHtml = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
        const avatarHtml = r.customerAvatar
          ? `<img src="${escapeHtml(r.customerAvatar)}" alt="${escapeHtml(r.customerName)}" style="width: 42px; height: 42px; border-radius: 50%; object-fit: cover; border: 1.5px solid var(--amber-soft); flex-shrink: 0;">`
          : `<div style="width: 42px; height: 42px; border-radius: 50%; background: rgba(212,175,55,0.2); border: 1px solid rgba(212,175,55,0.4); color: var(--gold-light); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.1rem; flex-shrink: 0;">${escapeHtml((r.customerName || "K").charAt(0).toUpperCase())}</div>`;

        return `
          <div class="review-item-card" style="display: flex; gap: 14px; padding: 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; margin-bottom: 12px;">
            ${avatarHtml}
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-wrap: wrap; gap: 6px;">
                <strong style="color: var(--cream); font-size: 0.95rem;">${escapeHtml(r.customerName)}</strong>
                <span class="text-xs text-muted">${r.createdAt ? formatDateTime(r.createdAt) : ""}</span>
              </div>
              <div style="color: #f59e0b; font-size: 0.95rem; margin-bottom: 6px; letter-spacing: 2px;">
                ${starsHtml}
              </div>
              <div style="color: rgba(255,255,255,0.85); font-size: 0.9rem; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(r.comment)}</div>
            </div>
          </div>`;
      }).join("");
    } catch (err) {
      listEl.innerHTML = `<p class="text-danger">Không thể tải nhận xét: ${escapeHtml(err.message)}</p>`;
    }
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const comment = commentInput.value.trim();
    if (!comment) {
      toast("Vui lòng nhập nhận xét của bạn.", "warning");
      commentInput.focus();
      return;
    }

    const restore = setButtonLoading(submitBtn, "Đang gửi...");
    try {
      await addDrinkReview({
        drinkId: drink.id,
        drinkName: drink.name,
        rating: selectedRating,
        comment,
      });
      toast("Cảm ơn bạn đã gửi đánh giá!", "success");
      commentInput.value = "";
      await loadReviews();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      restore();
    }
  });

  loadReviews();
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

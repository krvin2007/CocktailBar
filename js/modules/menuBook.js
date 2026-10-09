/* =========================================================
   MENU-BOOK.JS - Quyển Menu Cocktail Bìa Da Lật Trang 3D Chân Thực
   - 100% Vanilla JS & CSS 3D Transforms (preserve-3d, rotateY, perspective)
   - Trải nghiệm lật từng trang sách ngoài đời thực: Bìa da dập nhũ vàng,
     gáy sách đổ bóng, mép cong lật giấy, âm thanh lật giấy qua Web Audio API.
   - Khổ sách rộng lớn 1140px, bố cục chống tràn nội dung, tích hợp
     không gian quầy bar bàn da & phụ kiện ly pha lê, nến hổ phách 2 bên.
   ========================================================= */

import { formatMoney, escapeHtml } from "./utils.js";
import { ICONS } from "./icons.js";
import { addToCart } from "./ordersService.js";
import { toast } from "./ui.js";
import { refreshCartBadge } from "./navbar.js";
import { getCurrentLang, t } from "./i18n.js";
import { getCategoryLabel } from "./drinksService.js";

let soundEnabled = true;

/** Phát âm thanh lật trang chân thực qua Web Audio API (không cần file âm thanh ngoài) */
function playPageFlipSound() {
  if (!soundEnabled) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const duration = 0.16; // 160ms
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      // White noise với độ suy giảm tự nhiên
      data[i] = (Math.random() * 2 - 1) * Math.exp(-3 * (i / bufferSize));
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;

    // Bộ lọc Bandpass mô phỏng tiếng sột soạt cọ xát của trang giấy mỹ thuật
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1100, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + duration);
    filter.Q.setValueAtTime(2.5, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.09, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noiseSource.start();
  } catch {
    // Tự động bỏ qua nếu trình duyệt chặn autoplay trước khi tương tác
  }
}

export class MenuBookController {
  constructor(containerEl, drinks) {
    this.container = containerEl;
    this.drinks = drinks || [];
    this.currentSheet = 0; // 0 = đóng ở bìa trước; 1 = mở trang 1-2; ...; totalSheets = đóng ở bìa sau
    this.totalSheets = 6;
    this.touchStartX = 0;

    this.render();
    this.bindEvents();
    this.updateSheets();
  }

  /** Lọc đồ uống theo danh mục */
  getByCategory(cat) {
    return this.drinks.filter((d) => d.category === cat);
  }

  /** Thẻ đồ uống tiêu chuẩn (Trang Signature - 3 món/trang) */
  renderSignatureCard(drink) {
    const isEn = getCurrentLang() === "en";
    const soldout = drink.status === "soldout" || drink.stock <= 0;
    const catLabel = getCategoryLabel(drink.category);

    const tastePills = Array.isArray(drink.tasteNotes) && drink.tasteNotes.length
      ? drink.tasteNotes.slice(0, 3).map((tNote) => `<span class="book-taste-pill">${escapeHtml(tNote)}</span>`).join("")
      : "";

    return `
      <div class="book-drink-card" data-drink-id="${drink.id}">
        <div class="book-drink-thumb-wrap">
          ${drink.image
            ? `<img src="${escapeHtml(drink.image)}" alt="${escapeHtml(drink.name)}" loading="lazy" class="book-drink-img">`
            : `<div class="book-drink-fallback">${ICONS.cocktail(28)}</div>`}
          ${drink.featured ? `<span class="book-drink-star" title="Signature">${ICONS.sparkle(12)}</span>` : ""}
          ${soldout ? `<span class="book-drink-soldout">${isEn ? "Sold Out" : "Tạm hết"}</span>` : ""}
        </div>
        <div class="book-drink-info">
          <div class="book-drink-header">
            <h4 class="book-drink-name">${escapeHtml(drink.name)}</h4>
            <span class="book-drink-price">${formatMoney(drink.price)}</span>
          </div>
          <div class="book-drink-meta">
            <span class="book-drink-cat">${catLabel}</span>
            <span class="meta-sep">•</span>
            <span class="book-drink-abv">${drink.abv > 0 ? `${drink.abv}% ABV` : "0% ABV"}</span>
            ${drink.glassType ? `<span class="meta-sep">•</span><span class="book-drink-glass">${escapeHtml(drink.glassType)}</span>` : ""}
          </div>
          <p class="book-drink-desc">${escapeHtml(drink.description || "")}</p>
          <div class="book-drink-bottom-row">
            <div class="book-drink-tastes">${tastePills}</div>
            <div class="book-drink-actions">
              <a href="detail.html?id=${drink.id}" class="book-btn-detail" title="${isEn ? "View details" : "Xem chi tiết"}">
                <span>${isEn ? "Details" : "Chi tiết"}</span>
                ${ICONS.arrowRight(11)}
              </a>
              <button type="button" class="book-btn-order" data-order-id="${drink.id}" ${soldout ? "disabled" : ""}>
                ${ICONS.plus(12)}
                <span>${soldout ? (isEn ? "Sold Out" : "Hết") : (isEn ? "Add" : "Thêm")}</span>
              </button>
            </div>
          </div>
        </div>
      </div>`;
  }

  /** Thẻ dạng hàng ngang tinh gọn (Trang Classic - 4 món/trang) */
  renderClassicRow(drink) {
    const isEn = getCurrentLang() === "en";
    const soldout = drink.status === "soldout" || drink.stock <= 0;

    return `
      <div class="book-drink-row" data-drink-id="${drink.id}">
        <div class="book-row-thumb">
          ${drink.image
            ? `<img src="${escapeHtml(drink.image)}" alt="${escapeHtml(drink.name)}" loading="lazy">`
            : `<div class="book-row-fallback">${ICONS.cocktail(20)}</div>`}
        </div>
        <div class="book-row-main">
          <div class="book-row-header">
            <h4 class="book-row-name">${escapeHtml(drink.name)}</h4>
            <span class="book-row-price">${formatMoney(drink.price)}</span>
          </div>
          <div class="book-row-meta">
            <span>${drink.abv > 0 ? `${drink.abv}% ABV` : "0% ABV"}</span>
            ${drink.glassType ? `<span>• ${escapeHtml(drink.glassType)}</span>` : ""}
            ${Array.isArray(drink.tasteNotes) && drink.tasteNotes.length ? `<span>• ${escapeHtml(drink.tasteNotes.slice(0, 2).join(", "))}</span>` : ""}
          </div>
          <p class="book-row-desc">${escapeHtml(drink.description || "")}</p>
        </div>
        <div class="book-row-actions">
          <a href="detail.html?id=${drink.id}" class="book-row-link" title="${isEn ? "View details" : "Xem chi tiết"}">${ICONS.arrowRight(12)}</a>
          <button type="button" class="book-btn-order" data-order-id="${drink.id}" ${soldout ? "disabled" : ""} title="${isEn ? "Add to cart" : "Thêm vào giỏ"}">
            ${ICONS.plus(12)}
            <span>${isEn ? "Add" : "Thêm"}</span>
          </button>
        </div>
      </div>`;
  }

  /** Thẻ dạng lưới 2 cột (Trang Sour & Fizz 6 món, Khai vị 5 món, Rượu di sản 5 chai) */
  renderGridCard(drink) {
    const isEn = getCurrentLang() === "en";
    const soldout = drink.status === "soldout" || drink.stock <= 0;

    return `
      <div class="book-grid-card" data-drink-id="${drink.id}">
        <div class="book-grid-card-head">
          <div class="book-grid-thumb">
            ${drink.image
              ? `<img src="${escapeHtml(drink.image)}" alt="${escapeHtml(drink.name)}" loading="lazy">`
              : `<div class="book-grid-fallback">${ICONS.cocktail(18)}</div>`}
          </div>
          <div class="book-grid-titles">
            <h5 class="book-grid-name">${escapeHtml(drink.name)}</h5>
            <span class="book-grid-price">${formatMoney(drink.price)}</span>
          </div>
        </div>
        <div class="book-grid-meta">
          <span>${drink.abv > 0 ? `${drink.abv}% ABV` : "0% ABV"}</span>
          ${drink.glassType ? `<span>• ${escapeHtml(drink.glassType)}</span>` : ""}
        </div>
        <p class="book-grid-desc">${escapeHtml(drink.description || "")}</p>
        <div class="book-grid-actions">
          <a href="detail.html?id=${drink.id}" class="book-grid-link">
            <span>${isEn ? "Details" : "Chi tiết"}</span>
            ${ICONS.arrowRight(10)}
          </a>
          <button type="button" class="book-btn-order-sm" data-order-id="${drink.id}" ${soldout ? "disabled" : ""}>
            ${ICONS.plus(11)}
            <span>${soldout ? (isEn ? "Sold Out" : "Hết") : (isEn ? "Add" : "Thêm")}</span>
          </button>
        </div>
      </div>`;
  }

  /** Thẻ Rượu Di Sản 2x2 chuyên biệt cho Hầm Rượu (4 chai/trang) */
  renderSpiritCard(drink) {
    const isEn = getCurrentLang() === "en";
    const soldout = drink.status === "soldout" || drink.stock <= 0;
    const tastePills = Array.isArray(drink.tasteNotes) && drink.tasteNotes.length
      ? drink.tasteNotes.slice(0, 3).map((tNote) => `<span class="book-taste-pill">${escapeHtml(tNote)}</span>`).join("")
      : "";

    return `
      <div class="book-spirit-card" data-drink-id="${drink.id}">
        <div class="book-spirit-card-head">
          <div class="book-spirit-thumb">
            ${drink.image
              ? `<img src="${escapeHtml(drink.image)}" alt="${escapeHtml(drink.name)}" loading="lazy">`
              : `<div class="book-grid-fallback">${ICONS.cocktail(20)}</div>`}
          </div>
          <div class="book-spirit-titles">
            <h5 class="book-spirit-name">${escapeHtml(drink.name)}</h5>
            <span class="book-spirit-price">${formatMoney(drink.price)}</span>
          </div>
        </div>
        <div class="book-spirit-meta">
          <span>${drink.abv > 0 ? `${drink.abv}% ABV` : ""}</span>
          ${drink.baseSpirit ? `<span> • ${escapeHtml(drink.baseSpirit)}</span>` : ""}
          ${drink.glassType ? `<span> • ${escapeHtml(drink.glassType)}</span>` : ""}
        </div>
        <p class="book-spirit-desc">${escapeHtml(drink.description || "")}</p>
        ${tastePills ? `<div class="book-spirit-tastes">${tastePills}</div>` : ""}
        <div class="book-spirit-actions">
          <a href="detail.html?id=${drink.id}" class="book-grid-link">
            <span>${isEn ? "Details" : "Chi tiết"}</span>
            ${ICONS.arrowRight(10)}
          </a>
          <button type="button" class="book-btn-order-sm" data-order-id="${drink.id}" ${soldout ? "disabled" : ""}>
            ${ICONS.plus(11)}
            <span>${soldout ? (isEn ? "Sold Out" : "Hết") : (isEn ? "Add" : "Thêm")}</span>
          </button>
        </div>
      </div>`;
  }

  render() {
    const isEn = getCurrentLang() === "en";
    const signatures = this.getByCategory("signature");
    const classics = this.getByCategory("classic");
    const sourFizz = this.getByCategory("sour-fizz");
    const aperitivos = this.getByCategory("aperitivo");
    const spirits = this.getByCategory("spirits");
    const sourAndSpritz = [...sourFizz, ...aperitivos];

    this.container.innerHTML = `
      <div class="book-viewport-wrapper">
        <div class="book-ambient-glow"></div>

        <!-- Khu vực Cuốn sách Menu 3D Lật Trang chính -->
        <div class="book-stage" id="book-stage">
          <div class="book-container ${this.currentSheet === 0 ? "book-closed-front" : this.currentSheet === this.totalSheets ? "book-closed-back" : "book-opened"}" id="book-container">
            <div class="book-spine"></div>
            <div class="book-bookmark-ribbon"></div>

              <!-- SHEET 0: Bìa trước (Front Cover) & Lời ngỏ (Page 1) -->
              <div class="book-sheet" data-sheet-index="0" style="z-index: 6;">
                <div class="sheet-side sheet-front sheet-cover sheet-cover-front" data-action="flip-next">
                  <div class="cover-leather-texture"></div>
                  <div class="cover-stitch-border">
                    <div class="cover-ornament-top">
                      <span class="cover-stars">✦ ✦ ✦</span>
                    </div>
                    <div class="cover-emblem">
                      <div class="cover-emblem-ring">
                        ${ICONS.cocktail(46)}
                      </div>
                    </div>
                    <div class="cover-titles">
                      <span class="cover-kicker">${isEn ? "ESTABLISHED 2019 · SAIGON" : "ESTABLISHED 2019 · SÀI GÒN"}</span>
                      <h1 class="cover-main-title">QUÁN BAR ĐÊM</h1>
                      <span class="cover-sub-title">${isEn ? "THE ARTISAN COCKTAIL & SPIRITS MENU" : "THỰC ĐƠN COCKTAIL & RƯỢU DI SẢN"}</span>
                      <div class="cover-divider-flourish">❖</div>
                      <p class="cover-caption">${isEn ? "Handcrafted Cocktails · Hand-Carved Ice · Heritage Spirits Vault" : "Pha chế thủ công · Khối đá cắt tay · Hầm rượu di sản"}</p>
                    </div>
                    <div class="cover-actions">
                      <button type="button" class="btn-cover-open" id="btn-cover-open">
                        <span>${isEn ? "Open Cocktail Menu" : "Chạm Mở Quyển Menu"}</span>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      </button>
                      <span class="cover-hint">${isEn ? "Or click the page edge to turn" : "Hoặc nhấp mép sách để lật"}</span>
                    </div>
                  </div>
                  <div class="sheet-dogear sheet-dogear-br" title="${isEn ? "Turn page" : "Lật trang"}"></div>
                </div>

                <div class="sheet-side sheet-back sheet-page page-left" data-action="flip-prev">
                  <div class="page-inner">
                    <div class="page-header">
                      <span class="page-kicker">${isEn ? "PROLOGUE & PHILOSOPHY" : "CHƯƠNG ĐẦU · LỜI TỰA"}</span>
                      <span class="page-folio">Trang 1</span>
                    </div>
                    <div class="page-ornament">❖ ❖ ❖</div>
                    <h3 class="page-title">${isEn ? "The Symphony of Night" : "Bản Giao Hưởng Của Màn Đêm"}</h3>
                    <blockquote class="page-quote">
                      "${isEn ? "A fine cocktail is not just alcohol; it is temperature, the clarity of hand-carved ice, and the whisper of midnight botanicals." : "Một ly cocktail hảo hạng không đơn thuần là rượu, đó là nhiệt độ, độ trong suốt của khối đá cắt tay và hơi thở thảo mộc giữa đêm đô thị."}"
                    </blockquote>
                    <div class="page-text-content">
                      <p>${isEn ? "Welcome to Night Bar Lounge. Behind our discreet speakeasy entrance, our mixologists curate balance with natural juices, artisanal bitters, and small-batch spirits sourced worldwide." : "Chào mừng quý khách đến với Quán Bar Đêm. Bước qua cánh cửa bí mật, mỗi công thức được các bartender chăm chút từ nguyên liệu hữu cơ, siro tự nấu đến rượu nền chính ngạch."}</p>
                      <p>${isEn ? "Take your time to turn each leather page, discover our curated collections, and allow our team to craft your bespoke libation." : "Mời quý khách thong thả lật từng trang menu, khám phá các hương vị độc bản và gửi yêu cầu để chúng tôi phục vụ ly rượu hoàn hảo nhất cho đêm nay."}</p>
                    </div>
                    <div class="page-signature-wrap">
                      <div class="page-wax-seal">
                        <span>QBD</span>
                      </div>
                      <div class="page-signature-text">
                        <span class="sig-name">Head Bartender &amp; Mixologist</span>
                        <span class="sig-bar">Quán Bar Đêm · Sài Gòn</span>
                      </div>
                    </div>
                    <div class="page-footer">
                      <span>Night Bar Lounge Speakeasy</span>
                    </div>
                  </div>
                  <div class="sheet-dogear sheet-dogear-bl" title="${isEn ? "Previous page" : "Trang trước"}"></div>
                </div>
              </div>

              <!-- SHEET 1: Mục Lục (Page 2) & Signature Part 1 (Page 3) -->
              <div class="book-sheet" data-sheet-index="1" style="z-index: 5;">
                <div class="sheet-side sheet-front sheet-page page-right" data-action="flip-next">
                  <div class="page-inner">
                    <div class="page-header">
                      <span class="page-kicker">${isEn ? "TABLE OF CONTENTS" : "MỤC LỤC MENU"}</span>
                      <span class="page-folio">Trang 2</span>
                    </div>
                    <h3 class="page-title">${isEn ? "Curated Index & Chapters" : "Danh Mục & Bản Đồ Hương Vị"}</h3>
                    <ul class="book-toc-list">
                      <li class="toc-item" data-jump-sheet="1">
                        <span class="toc-ch">I</span>
                        <span class="toc-name">${isEn ? "Artisan Signature Cocktails" : "Tuyển Tập Cocktail Signature Độc Bản"}</span>
                        <span class="toc-dots"></span>
                        <span class="toc-pg">Tr. 3 – 4</span>
                      </li>
                      <li class="toc-item" data-jump-sheet="2">
                        <span class="toc-ch">II</span>
                        <span class="toc-name">${isEn ? "World Classic Cocktails" : "Cocktail Cổ Điển Huyền Thoại"}</span>
                        <span class="toc-dots"></span>
                        <span class="toc-pg">Tr. 5 – 6</span>
                      </li>
                      <li class="toc-item" data-jump-sheet="3">
                        <span class="toc-ch">III</span>
                        <span class="toc-name">${isEn ? "Sour, Highball & Italian Spritz" : "Sour, Highball & Khai Vị Phong Cách Ý"}</span>
                        <span class="toc-dots"></span>
                        <span class="toc-pg">Tr. 7</span>
                      </li>
                      <li class="toc-item" data-jump-sheet="4">
                        <span class="toc-ch">IV</span>
                        <span class="toc-name">${isEn ? "Heritage Spirits · Whiskies & Bourbon" : "Hầm Rượu Di Sản · Single Malt & Bourbon"}</span>
                        <span class="toc-dots"></span>
                        <span class="toc-pg">Tr. 8</span>
                      </li>
                      <li class="toc-item" data-jump-sheet="4">
                        <span class="toc-ch">V</span>
                        <span class="toc-name">${isEn ? "Heritage Spirits · Cognac, Tequila & Rum" : "Hầm Rượu Di Sản · Cognac, Agave & Rum"}</span>
                        <span class="toc-dots"></span>
                        <span class="toc-pg">Tr. 9</span>
                      </li>
                      <li class="toc-item" data-jump-sheet="5">
                        <span class="toc-ch">VI</span>
                        <span class="toc-name">${isEn ? "Hospitality & VIP Reservations" : "Nghệ Thuật Thưởng Thức & Đặt Bàn VIP"}</span>
                        <span class="toc-dots"></span>
                        <span class="toc-pg">Tr. 10</span>
                      </li>
                    </ul>
                    <div class="toc-flavor-note">
                      <span class="flavor-title">${isEn ? "Taste Profiles Guide:" : "Chỉ dẫn gu thưởng thức:"}</span>
                      <div class="flavor-tags">
                        <span class="ftag">✦ Bitter (Đắng thanh)</span>
                        <span class="ftag">✦ Citrus (Chua tươi)</span>
                        <span class="ftag">✦ Herbal (Thảo mộc)</span>
                        <span class="ftag">✦ Smoky (Khói sồi)</span>
                      </div>
                    </div>
                    <div class="page-footer">
                      <span>${isEn ? "Click items above or flip page to explore" : "Bấm mục lục để lật ngay đến trang cần xem"}</span>
                    </div>
                  </div>
                  <div class="sheet-dogear sheet-dogear-br"></div>
                </div>

                <div class="sheet-side sheet-back sheet-page page-left" data-action="flip-prev">
                  <div class="page-inner">
                    <div class="page-header">
                      <span class="page-kicker">CHAPTER I · SIGNATURE COCKTAILS</span>
                      <span class="page-folio">Trang 3</span>
                    </div>
                    <h3 class="page-title">${isEn ? "Artisan Signatures (I)" : "Tuyển Tập Độc Bản (I)"}</h3>
                    <div class="book-drinks-stack">
                      ${signatures.slice(0, 3).map((d) => this.renderSignatureCard(d)).join("")}
                    </div>
                    <div class="page-footer">
                      <span>Night Bar Lounge · Signature Collection</span>
                    </div>
                  </div>
                  <div class="sheet-dogear sheet-dogear-bl"></div>
                </div>
              </div>

              <!-- SHEET 2: Signature Part 2 (Page 4) & Classic Part 1 (Page 5) -->
              <div class="book-sheet" data-sheet-index="2" style="z-index: 4;">
                <div class="sheet-side sheet-front sheet-page page-right" data-action="flip-next">
                  <div class="page-inner">
                    <div class="page-header">
                      <span class="page-kicker">CHAPTER I · SIGNATURE COCKTAILS</span>
                      <span class="page-folio">Trang 4</span>
                    </div>
                    <h3 class="page-title">${isEn ? "Artisan Signatures (II)" : "Tuyển Tập Độc Bản (II)"}</h3>
                    <div class="book-drinks-stack-4">
                      ${signatures.slice(3, 7).map((d) => this.renderSignatureCard(d)).join("")}
                    </div>
                    <div class="page-footer">
                      <span>Green Park Basil · Serendipity Ritz · Blue Blazer 1862 · Diamond Ice</span>
                    </div>
                  </div>
                  <div class="sheet-dogear sheet-dogear-br"></div>
                </div>

                <div class="sheet-side sheet-back sheet-page page-left" data-action="flip-prev">
                  <div class="page-inner">
                    <div class="page-header">
                      <span class="page-kicker">CHAPTER II · WORLD CLASSICS</span>
                      <span class="page-folio">Trang 5</span>
                    </div>
                    <h3 class="page-title">${isEn ? "Timeless Classics (I)" : "Kinh Điển Vượt Thời Gian (I)"}</h3>
                    <div class="book-drinks-rows">
                      ${classics.slice(0, 5).map((d) => this.renderClassicRow(d)).join("")}
                    </div>
                    <div class="page-footer">
                      <span>Negroni Classico · Smoked Old Fashioned · Dry Martini · Manhattan · Sazerac</span>
                    </div>
                  </div>
                  <div class="sheet-dogear sheet-dogear-bl"></div>
                </div>
              </div>

              <!-- SHEET 3: Classic Part 2 (Page 6) & Sour & Spritz (Page 7) -->
              <div class="book-sheet" data-sheet-index="3" style="z-index: 3;">
                <div class="sheet-side sheet-front sheet-page page-right" data-action="flip-next">
                  <div class="page-inner">
                    <div class="page-header">
                      <span class="page-kicker">CHAPTER II · WORLD CLASSICS</span>
                      <span class="page-folio">Trang 6</span>
                    </div>
                    <h3 class="page-title">${isEn ? "Timeless Classics (II)" : "Kinh Điển Vượt Thời Gian (II)"}</h3>
                    <div class="book-drinks-rows">
                      ${classics.slice(5, 10).map((d) => this.renderClassicRow(d)).join("")}
                    </div>
                    <div class="page-footer">
                      <span>Daiquiri · Boulevardier Parisien · French 75 · Hanky Panky · White Lady</span>
                    </div>
                  </div>
                  <div class="sheet-dogear sheet-dogear-br"></div>
                </div>

                <div class="sheet-side sheet-back sheet-page page-left" data-action="flip-prev">
                  <div class="page-inner">
                    <div class="page-header">
                      <span class="page-kicker">CHAPTER III · SOUR, HIGHBALL & SPRITZ</span>
                      <span class="page-folio">Trang 7</span>
                    </div>
                    <h3 class="page-title">${isEn ? "Sour, Highball & Spritz" : "Sour, Highball & Khai Vị Ý"}</h3>
                    <div class="book-drinks-grid-2col">
                      ${sourAndSpritz.map((d) => this.renderGridCard(d)).join("")}
                      <div class="book-grid-card book-grid-card-feature">
                        <div class="book-grid-card-head">
                          <div class="book-grid-thumb book-feature-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                          </div>
                          <div class="book-grid-titles">
                            <h5 class="book-grid-name">${isEn ? "Bespoke Bartender Choice" : "Gợi Ý Pha Chế Theo Gu"}</h5>
                            <span class="book-grid-price">${isEn ? "Complimentary" : "Tùy Chọn"}</span>
                          </div>
                        </div>
                        <div class="book-grid-meta">
                          <span>${isEn ? "Hand-carved Ice · Citrus Oils" : "Đá Cắt Tay · Tinh Dầu Cam Tươi"}</span>
                        </div>
                        <p class="book-grid-desc">${isEn ? "Craving a tailored fizz or highball? Our bartender will customize sweetness, spirit strength, and artisanal soda for your table." : "Bạn thích một ly Highball thanh mát hay Sour đậm vị hơn? Bartender sẵn sàng gia giảm độ ngọt, rượu nền và soda thủ công theo yêu cầu."}</p>
                        <div class="book-grid-actions">
                          <a href="order.html" class="book-grid-link">
                            <span>${isEn ? "Table Note" : "Yêu cầu phục vụ"}</span>
                            ${ICONS.arrowRight(10)}
                          </a>
                        </div>
                      </div>
                    </div>
                    <div class="page-footer">
                      <span>Bourbon Sour · Margarita · Mojito · Aperol Spritz · Campari Cask</span>
                    </div>
                  </div>
                  <div class="sheet-dogear sheet-dogear-bl"></div>
                </div>
              </div>

              <!-- SHEET 4: Heritage Spirits I (Page 8) & Spirits II (Page 9) -->
              <div class="book-sheet" data-sheet-index="4" style="z-index: 2;">
                <div class="sheet-side sheet-front sheet-page page-right" data-action="flip-next">
                  <div class="page-inner">
                    <div class="page-header">
                      <span class="page-kicker">CHAPTER IV · HERITAGE VAULT (I)</span>
                      <span class="page-folio">Trang 8</span>
                    </div>
                    <h3 class="page-title">${isEn ? "Whiskies & Bourbon Vault" : "Hầm Rượu Di Sản · Whiskies"}</h3>
                    <div class="book-spirits-grid-2x2">
                      ${spirits.slice(0, 4).map((d) => this.renderSpiritCard(d)).join("")}
                    </div>
                    <div class="page-footer">
                      <span>The Macallan 12 · The Macallan 18 · Lagavulin 16 · Bulleit Bourbon 10Y</span>
                    </div>
                  </div>
                  <div class="sheet-dogear sheet-dogear-br"></div>
                </div>

                <div class="sheet-side sheet-back sheet-page page-left" data-action="flip-prev">
                  <div class="page-inner">
                    <div class="page-header">
                      <span class="page-kicker">CHAPTER V · HERITAGE VAULT (II)</span>
                      <span class="page-folio">Trang 9</span>
                    </div>
                    <h3 class="page-title">${isEn ? "Cognac, Agave & Sipping Rum" : "Hầm Rượu Di Sản · Độc Bản"}</h3>
                    <div class="book-spirits-grid-2x2">
                      ${spirits.slice(4, 8).map((d) => this.renderSpiritCard(d)).join("")}
                    </div>
                    <div class="page-footer">
                      <span>Hennessy X.O · Don Julio 1942 · Monkey 47 · Diplomático Rum</span>
                    </div>
                  </div>
                  <div class="sheet-dogear sheet-dogear-bl"></div>
                </div>
              </div>

              <!-- SHEET 5: Tasting Guide & Đặt bàn (Page 10) & Bìa Sau (Back Cover) -->
              <div class="book-sheet" data-sheet-index="5" style="z-index: 1;">
                <div class="sheet-side sheet-front sheet-page page-right" data-action="flip-next">
                  <div class="page-inner">
                    <div class="page-header">
                      <span class="page-kicker">${isEn ? "HOSPITALITY & RESERVATIONS" : "ĐẶT BÀN & THƯỞNG THỨC"}</span>
                      <span class="page-folio">Trang 10</span>
                    </div>
                    <h3 class="page-title">${isEn ? "A Night Well Spent" : "Trải Nghiệm Trọn Vẹn"}</h3>
                    <div class="book-guide-box">
                      <h4>✦ ${isEn ? "The Craft of Tasting" : "Nghệ thuật thưởng thức:"}</h4>
                      <p>${isEn ? "Sip slowly to perceive layers from crisp botanicals down to the warm oak finish. Feel free to request our bartender adjust sweetness or dilution." : "Hãy nhấp từng ngụm nhỏ để cảm nhận trọn vẹn 3 tầng hương vị. Bạn luôn có thể yêu cầu bartender gia giảm độ ngọt hoặc đá thủ công theo gu riêng."}</p>
                    </div>
                    <div class="book-cta-card">
                      <span class="book-cta-badge">${isEn ? "EXCLUSIVE LOUNGE" : "KHÔNG GIAN RIÊNG TƯ"}</span>
                      <p class="book-cta-title">${isEn ? "Book your preferred seat for tonight" : "Giữ vị trí đẹp nhất cho buổi hẹn tối nay"}</p>
                      <a href="order.html" class="btn btn-primary btn-block">
                        <span>${isEn ? "Reserve a Table Tonight" : "Đặt Bàn Giữ Chỗ Tối Nay"}</span>
                        ${ICONS.arrowRight(14)}
                      </a>
                    </div>
                    <div class="book-contact-note">
                      <span>Hotline VIP: <strong>0901 234 567</strong></span>
                      <span>18:00 – 02:00 Mỗi đêm</span>
                    </div>
                    <div class="page-footer">
                      <span>Night Bar Lounge · 123 Nguyễn Huệ, Quận 1</span>
                    </div>
                  </div>
                  <div class="sheet-dogear sheet-dogear-br"></div>
                </div>

                <div class="sheet-side sheet-back sheet-cover sheet-cover-back" data-action="flip-prev">
                  <div class="cover-leather-texture"></div>
                  <div class="cover-stitch-border">
                    <div class="cover-back-emblem">
                      <div class="cover-wax-badge">
                        <span>QBD</span>
                      </div>
                    </div>
                    <h3 class="cover-back-title">QUÁN BAR ĐÊM</h3>
                    <p class="cover-back-quote">
                      "${isEn ? "The night is still young, and the finest drink is the one in your hand." : "Màn đêm luôn còn dài, và ly rượu ngon nhất là ly đang ở trên tay bạn."}"
                    </p>
                    <div class="cover-back-info">
                      <span>123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM</span>
                      <span>Phục vụ từ 18:00 đến 02:00 sáng</span>
                    </div>
                    <div class="cover-back-actions">
                      <button type="button" class="btn-cover-reopen" id="btn-cover-reopen">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                        <span>${isEn ? "Close & Return to Cover" : "Gấp Menu / Về Bìa Trước"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        <!-- Thanh điều khiển lật trang chuyên nghiệp -->
        <div class="book-controls-bar">
          <div class="book-controls-nav">
            <button type="button" class="book-nav-btn" id="book-btn-prev" title="${t("book_prev_page", "Trang trước")}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
              <span>${t("book_prev_page", "Trang trước")}</span>
            </button>

            <div class="book-indicator" id="book-indicator">
              <span class="book-indicator-dot"></span>
              <span id="book-indicator-text">Bìa Trước</span>
            </div>

            <button type="button" class="book-nav-btn" id="book-btn-next" title="${t("book_next_page", "Trang sau")}">
              <span>${t("book_next_page", "Trang sau")}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          <!-- Nhảy nhanh theo chương -->
          <div class="book-chapters-jump">
            <button type="button" class="chapter-jump-btn active" data-jump-sheet="0">${t("book_jump_cover", "Bìa")}</button>
            <button type="button" class="chapter-jump-btn" data-jump-sheet="1">${t("book_jump_toc", "Mục lục")}</button>
            <button type="button" class="chapter-jump-btn" data-jump-sheet="2">${t("book_jump_signature", "Signature")}</button>
            <button type="button" class="chapter-jump-btn" data-jump-sheet="3">${t("book_jump_classic", "Classic")}</button>
            <button type="button" class="chapter-jump-btn" data-jump-sheet="4">${t("book_jump_sour", "Sour & Spritz")}</button>
            <button type="button" class="chapter-jump-btn" data-jump-sheet="5">${t("book_jump_spirits", "Hầm Rượu")}</button>
            <button type="button" class="chapter-jump-btn" data-jump-sheet="6">${t("book_jump_back", "Bìa Sau")}</button>
          </div>

          <!-- Tiện ích phụ: Âm thanh lật giấy -->
          <div class="book-tools-row">
            <button type="button" class="book-tool-btn" id="book-sound-toggle">
              <span id="book-sound-icon">${soundEnabled ? ICONS.sparkle(14) : ICONS.sparkle(14)}</span>
              <span id="book-sound-label">${soundEnabled ? t("book_sound_on", "Âm thanh lật giấy: Bật") : t("book_sound_off", "Âm thanh lật giấy: Tắt")}</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Nút lật trước / sau
    this.container.querySelector("#book-btn-prev")?.addEventListener("click", () => this.flipPrev());
    this.container.querySelector("#book-btn-next")?.addEventListener("click", () => this.flipNext());

    // Nút mở bìa & đóng bìa
    this.container.querySelector("#btn-cover-open")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.flipNext();
    });
    this.container.querySelector("#btn-cover-reopen")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.jumpToSheet(0);
    });

    // Bấm các nút nhảy nhanh chương
    this.container.querySelectorAll("[data-jump-sheet]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const sheetIdx = Number(btn.getAttribute("data-jump-sheet"));
        if (!isNaN(sheetIdx)) {
          this.jumpToSheet(sheetIdx);
        }
      });
    });

    // Bấm trực tiếp vào các mép trang sách để lật
    this.container.querySelectorAll(".book-sheet").forEach((sheet) => {
      sheet.addEventListener("click", (e) => {
        // Tránh lật khi click vào nút chi tiết / thêm giỏ
        if (e.target.closest("button, a, input, select")) return;

        const side = e.target.closest(".sheet-side");
        if (!side) return;

        if (side.dataset.action === "flip-next") {
          this.flipNext();
        } else if (side.dataset.action === "flip-prev") {
          this.flipPrev();
        }
      });
    });

    // Thêm món vào giỏ hàng ngay trong sách (hỗ trợ cả .book-btn-order và .book-btn-order-sm)
    this.container.addEventListener("click", (e) => {
      const orderBtn = e.target.closest(".book-btn-order, .book-btn-order-sm");
      if (!orderBtn) return;
      e.stopPropagation();
      const drinkId = orderBtn.getAttribute("data-order-id");
      const drink = this.drinks.find((d) => d.id === drinkId);
      if (drink) {
        addToCart(drink, 1);
        refreshCartBadge();
        const isEn = getCurrentLang() === "en";
        toast(isEn ? `Added "${drink.name}" to cart` : `Đã thêm "${drink.name}" vào giỏ hàng`, "success");
      }
    });

    // Nút bật/tắt âm thanh
    const soundBtn = this.container.querySelector("#book-sound-toggle");
    if (soundBtn) {
      soundBtn.addEventListener("click", () => {
        soundEnabled = !soundEnabled;
        const lbl = this.container.querySelector("#book-sound-label");
        if (lbl) {
          lbl.textContent = soundEnabled
            ? t("book_sound_on", "Âm thanh lật giấy: Bật")
            : t("book_sound_off", "Âm thanh lật giấy: Tắt");
        }
      });
    }

    // Điều hướng bằng phím mũi tên ← và →
    this.onKeydown = (e) => {
      if (e.target.closest("input, textarea, select")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        this.flipNext();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        this.flipPrev();
      }
    };
    window.addEventListener("keydown", this.onKeydown);

    // Cảm ứng vuốt trên di động (Touch swipe)
    const stage = this.container.querySelector("#book-stage");
    if (stage) {
      stage.addEventListener("touchstart", (e) => {
        this.touchStartX = e.touches[0].clientX;
      }, { passive: true });

      stage.addEventListener("touchend", (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const diff = touchEndX - this.touchStartX;
        if (Math.abs(diff) > 40) {
          if (diff < 0) {
            this.flipNext();
          } else {
            this.flipPrev();
          }
        }
      }, { passive: true });
    }

    // Phản hồi chuyển đổi ngôn ngữ
    this.onLanguageChange = () => {
      this.render();
      this.bindEvents();
      this.updateSheets();
    };
    window.addEventListener("languagechange", this.onLanguageChange);
  }

  destroy() {
    if (this.onKeydown) window.removeEventListener("keydown", this.onKeydown);
    if (this.onLanguageChange) window.removeEventListener("languagechange", this.onLanguageChange);
  }

  flipNext() {
    if (this.currentSheet >= this.totalSheets) return;
    this.currentSheet++;
    playPageFlipSound();
    this.updateSheets();
  }

  flipPrev() {
    if (this.currentSheet <= 0) return;
    this.currentSheet--;
    playPageFlipSound();
    this.updateSheets();
  }

  jumpToSheet(targetIdx) {
    const clamped = Math.max(0, Math.min(this.totalSheets, targetIdx));
    if (clamped !== this.currentSheet) {
      this.currentSheet = clamped;
      playPageFlipSound();
      this.updateSheets();
    }
  }

  updateSheets() {
    const sheets = this.container.querySelectorAll(".book-sheet");
    const bookContainer = this.container.querySelector("#book-container");

    // Quản lý tư thế mở sách (căn giữa khi đóng bìa trước hoặc sau)
    if (bookContainer) {
      bookContainer.classList.remove("book-closed-front", "book-closed-back", "book-opened");
      if (this.currentSheet === 0) {
        bookContainer.classList.add("book-closed-front");
      } else if (this.currentSheet === this.totalSheets) {
        bookContainer.classList.add("book-closed-back");
      } else {
        bookContainer.classList.add("book-opened");
      }
    }

    sheets.forEach((sheet, index) => {
      if (index < this.currentSheet) {
        // Đã lật sang trái
        sheet.classList.add("flipped");
        sheet.style.zIndex = index + 1;
      } else {
        // Vẫn nằm bên phải
        sheet.classList.remove("flipped");
        sheet.style.zIndex = this.totalSheets - index + 1;
      }
    });

    this.updateIndicators();
  }

  updateIndicators() {
    const isEn = getCurrentLang() === "en";
    const textEl = this.container.querySelector("#book-indicator-text");
    const prevBtn = this.container.querySelector("#book-btn-prev");
    const nextBtn = this.container.querySelector("#book-btn-next");

    if (prevBtn) prevBtn.disabled = this.currentSheet === 0;
    if (nextBtn) nextBtn.disabled = this.currentSheet === this.totalSheets;

    let label = "";
    if (this.currentSheet === 0) {
      label = isEn ? "Front Cover" : "Bìa Trước";
    } else if (this.currentSheet === 1) {
      label = isEn ? "Page 1 – 2 / 10" : "Trang 1 – 2 / 10";
    } else if (this.currentSheet === 2) {
      label = isEn ? "Page 3 – 4 / 10" : "Trang 3 – 4 / 10";
    } else if (this.currentSheet === 3) {
      label = isEn ? "Page 5 – 6 / 10" : "Trang 5 – 6 / 10";
    } else if (this.currentSheet === 4) {
      label = isEn ? "Page 7 – 8 / 10" : "Trang 7 – 8 / 10";
    } else if (this.currentSheet === 5) {
      label = isEn ? "Page 9 – 10 / 10" : "Trang 9 – 10 / 10";
    } else if (this.currentSheet === this.totalSheets) {
      label = isEn ? "Back Cover" : "Bìa Sau";
    }

    if (textEl) textEl.textContent = label;

    // Đánh dấu active trên dải nút chương
    this.container.querySelectorAll(".chapter-jump-btn").forEach((btn) => {
      const idx = Number(btn.getAttribute("data-jump-sheet"));
      if (idx === this.currentSheet) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }
}

/** Khởi tạo quyển menu 3D lật trang */
export function initMenuBook(containerId, drinks) {
  const host = typeof containerId === "string" ? document.getElementById(containerId) : containerId;
  if (!host) return null;
  return new MenuBookController(host, drinks);
}

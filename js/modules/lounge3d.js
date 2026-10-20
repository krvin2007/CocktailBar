/* =========================================================
   LOUNGE3D.JS - Không Gian 3D Lướt Chuyển Động Quán Bar Đêm
   Trải nghiệm lướt cảnh 3D chân thực qua từng phân khu đẳng cấp
   Công nghệ: 100% Thuần HTML5, CSS 3D Transforms & Vanilla JS
   Hỗ trợ chuyển đổi đa ngôn ngữ Tiếng Việt (VI) & English (EN)
   ========================================================= */

import { escapeHtml } from "./utils.js";
import { VENUE } from "./venue.js";
import { ICONS } from "./icons.js";
import { getCurrentLang, t } from "./i18n.js";

export const LOUNGE_ZONES = [
  {
    id: "bar-counter",
    name: "Quầy Bar Mixology Trung Tâm",
    subName: "Central Mixology Bar Counter",
    tag: "Trải nghiệm cận cảnh",
    tagEn: "Close-up Mixology",
    image: "img/lounge/bar-counter.jpg",
    capacity: "10 Ghế Bar Stool",
    capacityEn: "10 Luxury Bar Stools",
    ambience: "Ánh sáng vàng hổ phách, gần Bartender",
    ambienceEn: "Warm amber glow, direct interaction with Bartender",
    music: "Acoustic Jazz & Soul (18:00 - 21:00)",
    lighting: "Amber 2200K Hổ Phách Cổ Điển",
    bestFor: "Thực khách đi 1-2 người, cặp đôi, người yêu nghệ thuật pha chế thủ công",
    bestForEn: "Solo guests, couples, artisanal cocktail enthusiasts",
    description: "Tọa lạc tại vị trí trung tâm quán bar với mặt quầy đá cẩm thạch đen chỉ vàng Nero Portoro. Phía sau là kệ rượu di sản 3 tầng với hàng trăm chai rượu pha lê rực rỡ dưới ánh đèn ấm áp.",
    descriptionEn: "Centered with Nero Portoro gold-veined marble bar top. Backbar features 3 illuminated tiers of rare crystal spirit bottles under vintage ambient lighting.",
    targetTable: "Quầy Bar Pha Chế Trung Tâm (Bar Counter)",
    hotspots: [
      { x: 26, y: 56, label: "Mặt đá Nero Portoro Ý", labelEn: "Nero Portoro Marble" },
      { x: 74, y: 32, label: "Kệ rượu di sản 3 tầng", labelEn: "3-Tier Spirit Vault" },
      { x: 50, y: 70, label: "10 Ghế Bar da Cognac", labelEn: "10 Luxury Stools" },
    ],
  },
  {
    id: "vip-sofa",
    name: "Khu Bàn Sofa VIP Hoàng Gia",
    subName: "Royal VIP Leather Lounge",
    tag: "Sang trọng & Riêng tư",
    tagEn: "Luxury & Privacy",
    image: "img/lounge/vip-sofa.jpg",
    capacity: "4 – 8 Khách / Bàn",
    capacityEn: "4 – 8 Guests / Booth",
    ambience: "Đèn chùm pha lê ấm cúng, sofa da Chesterfield Ý",
    ambienceEn: "Warm crystal chandelier, Italian Chesterfield leather sofa",
    music: "Smooth R&B & Nu-Disco thư giãn",
    lighting: "Crystal Warm Glow 2400K",
    bestFor: "Tiệc sinh nhật, tiếp đón đối tác cao cấp, nhóm bạn tụ họp cuối tuần",
    bestForEn: "Birthday celebrations, VIP business entertaining, weekend gatherings",
    description: "Bộ ghế sofa bọc da Cognac êm ái bao quanh bàn kính viền vàng kim hổ phách. Góc nhìn bao quát trọn vẹn toàn bộ quán bar nhưng vẫn giữ trọn không gian trò chuyện ấm cúng, đẳng cấp.",
    descriptionEn: "Deep cognac leather Chesterfield sofa enclosing an amber-rimmed marble table. Offers a panoramic vantage of the entire bar while retaining private intimacy.",
    targetTable: "Bàn Sofa VIP 01 - VIP 04",
    hotspots: [
      { x: 28, y: 58, label: "Sofa Chesterfield Ý", labelEn: "Chesterfield Sofa" },
      { x: 72, y: 62, label: "Bàn đá viền vàng hổ phách", labelEn: "Amber-rimmed Table" },
      { x: 50, y: 24, label: "Đèn chùm pha lê hoàng gia", labelEn: "Crystal Chandelier" },
    ],
  },
  {
    id: "dj-stage",
    name: "Sân Khấu DJ & Âm Nhạc Đêm",
    subName: "Acoustic Stage & DJ Booth",
    tag: "Tâm điểm nhịp điệu",
    tagEn: "Rhythm Epicenter",
    image: "img/lounge/dj-stage.jpg",
    capacity: "Khu vực giao lưu chung",
    capacityEn: "Social & Dancing Area",
    ambience: "Đèn LED neon tím khói & vàng gold, âm thanh vòm",
    ambienceEn: "Neon violet & warm gold LED glow, surround acoustic panels",
    music: "Deep House & Live DJ Sets (20:30 - 02:00)",
    lighting: "Neon Violet & Gold Glow huyền ảo",
    bestFor: "Thực khách yêu thích giai điệu House, Jazz, Nu-Disco và không khí sôi động",
    bestForEn: "Fans of Deep House, Nu-Disco, Jazz and energetic nightlife",
    description: "Nơi các nghệ sĩ và DJ biểu diễn những set nhạc thăng hoa từ 18:00 đến 02:00 sáng. Bàn DJ hiện đại kết hợp ánh sáng hắt tạo nên nguồn năng lượng cuồng nhiệt của một speakeasy bar đích thực.",
    descriptionEn: "Where DJs and live performers showcase curated sets from 18:00 to 02:00. State-of-the-art turntables create the electric pulse of an authentic speakeasy.",
    targetTable: "Bàn Sát Sân Khấu DJ (Stage Front)",
    hotspots: [
      { x: 50, y: 56, label: "Bàn Mixer Pioneer DJ", labelEn: "Pioneer DJ Console" },
      { x: 26, y: 26, label: "Đèn LED Neon Tím Khói", labelEn: "Neon Violet Light" },
      { x: 76, y: 40, label: "Âm thanh vòm Acoustic", labelEn: "Surround Acoustics" },
    ],
  },
  {
    id: "high-tables",
    name: "Khu Bàn Cao Cocktail Chill",
    subName: "High-Top Cocktail Stools",
    tag: "Năng động & Phóng khoáng",
    tagEn: "Vibrant & Skyline",
    image: "img/lounge/high-tables.jpg",
    capacity: "2 – 4 Khách / Bàn",
    capacityEn: "2 – 4 Guests / Table",
    ambience: "Bàn đứng thanh mảnh, view kính ngắm trọn thành phố đêm",
    ambienceEn: "Sleek brass-rimmed high tops, floor-to-ceiling panoramic city lights",
    music: "Chillout Lounge & Lo-fi Beats",
    lighting: "Ánh sáng đèn thả kết hợp view phố đêm",
    bestFor: "Hẹn hò lãng mạn, chill nhẹ nhàng sau giờ làm việc, thưởng thức nhanh cocktail",
    bestForEn: "Romantic date nights, after-work drinks, casual cocktail sipping",
    description: "Thiết kế bàn cao mặt đá marble đen chân kim loại mạ đồng thau, tạo cảm giác thoáng đãng, phóng khoáng để khách vừa nhâm nhi ly Negroni vừa ngắm nhìn ánh đèn thành phố.",
    descriptionEn: "Minimalist Nero marble top tables with brushed brass pedestals overlooking Saigon's glittering night skyline.",
    targetTable: "Bàn Cao Cocktail C01 - C06",
    hotspots: [
      { x: 72, y: 28, label: "View trọn skyline Sài Gòn", labelEn: "Saigon Skyline View" },
      { x: 34, y: 62, label: "Bàn cao đá chân đồng", labelEn: "Brass-leg High Top" },
      { x: 52, y: 48, label: "Không gian chillout thoáng", labelEn: "Vibrant Chillout" },
    ],
  },
  {
    id: "cellar-display",
    name: "Tủ Trưng Bày Rượu Hiếm & Di Sản",
    subName: "Connoisseur Spirits Vault",
    tag: "Bộ sưu tập quý giá",
    tagEn: "Heritage Vault",
    image: "img/lounge/cellar-display.jpg",
    capacity: "Khu vực thưởng lãm",
    capacityEn: "Sommelier Tasting Area",
    ambience: "Ánh sáng bảo quản chuyên dụng, nhiệt độ tiêu chuẩn",
    ambienceEn: "Museum-grade amber LED illumination, climate-controlled cabinets",
    music: "Classical Instrumental Ambient",
    lighting: "Museum Grade Warm 2700K",
    bestFor: "Những tín đồ sành rượu tìm hiểu về xuất xứ, niên đại và kỹ nghệ chưng cất",
    bestForEn: "Connoisseurs exploring vintage provenance, age, and distillation lore",
    description: "Vách tủ kính trưng bày các tuyệt tác rượu mạch nha đơn cất Single Malt Whisky lâu năm, Cognac quý hiếm cùng các phiên bản giới hạn của các nhà sưu tầm hàng đầu thế giới.",
    descriptionEn: "Floor-to-ceiling glass cabinets showcasing rare Single Malt Scotch whiskies, heritage Cognacs, and private collector limited editions.",
    targetTable: "Bàn Thưởng Rượu Cạnh Hầm Di Sản",
    hotspots: [
      { x: 34, y: 42, label: "Single Malt Whisky lâu năm", labelEn: "Rare Single Malts" },
      { x: 68, y: 26, label: "Tủ kính bảo quản 2400K", labelEn: "Climate Glass Vault" },
      { x: 52, y: 68, label: "Bộ sưu tập rượu di sản", labelEn: "Heritage Collection" },
    ],
  },
];

class Lounge3DController {
  constructor(containerEl) {
    this.container = containerEl;
    this.currentIndex = 0;
    this.activeZoneId = LOUNGE_ZONES[0].id;
    this.autoGlide = true;
    this.glideDuration = 4500; // ms mỗi chu kỳ lướt
    this.lastGlideTime = performance.now();
    this.isHovering = false;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragCurrentX = 0;
    this.dragOffset = 0;
    this.animFrameId = null;

    this.onLangChange = () => {
      this.render();
    };
    window.addEventListener("languagechange", this.onLangChange);

    this.render();
    this.bindEvents();
    this.startAutoGlideLoop();
  }

  render() {
    const isEn = getCurrentLang() === "en";

    this.container.innerHTML = `
      <div class="lounge3d-wrapper">
        <div class="lounge3d-header">
          <div class="lounge3d-title-group">
            <span class="section-kicker">${t("lounge_kicker", "3D VIRTUAL EXPERIENCE")}</span>
            <h2 class="lounge3d-heading">${isEn ? "3D Gliding Atmosphere" : "Không Gian 3D Lướt Chuyển Động"} <em class="lounge3d-highlight">${t("lounge_heading_em", "Quán Bar Đêm")}</em></h2>
            <p class="lounge3d-subtitle">${isEn ? "Experience cinematic 3D gliding across every premium lounge zone: Mixology Bar, Royal VIP Lounge, DJ Stage, High-Tops and Heritage Spirits Vault." : "Trải nghiệm lướt chuyển động 3D chân thực qua từng phân khu đẳng cấp của quán bar: Quầy Mixology, Sofa VIP, Sân khấu DJ, Bàn cao view đêm và Hầm rượu di sản."}</p>
          </div>
          <div class="lounge3d-toolbar">
            <div class="lounge3d-presets" id="lounge3d-presets">
              <button type="button" class="lounge-btn-preset ${this.currentIndex === 0 ? "active" : ""}" data-zone="bar-counter">
                ${ICONS.cocktail(14)}
                <span>${t("preset_bar", "Quầy Bar")}</span>
              </button>
              <button type="button" class="lounge-btn-preset ${this.currentIndex === 1 ? "active" : ""}" data-zone="vip-sofa">
                ${ICONS.sparkle(14)}
                <span>${t("preset_vip", "Sofa VIP")}</span>
              </button>
              <button type="button" class="lounge-btn-preset ${this.currentIndex === 2 ? "active" : ""}" data-zone="dj-stage">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                <span>${t("preset_dj", "Sân Khấu DJ")}</span>
              </button>
              <button type="button" class="lounge-btn-preset ${this.currentIndex === 3 ? "active" : ""}" data-zone="high-tables">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M8 6h8M6 22h12"/></svg>
                <span>${t("preset_high", "Bàn Cao")}</span>
              </button>
              <button type="button" class="lounge-btn-preset ${this.currentIndex === 4 ? "active" : ""}" data-zone="cellar-display">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
                <span>${t("preset_cellar", "Hầm Rượu")}</span>
              </button>
            </div>
            <div class="lounge3d-tool-actions">
              <button type="button" class="lounge-btn-tool" id="btn-toggle-orbit" title="${isEn ? "Toggle auto-glide motion" : "Bật/Tắt chế độ tự động lướt chuyển động 3D"}">
                <span class="orbit-status-dot ${this.autoGlide ? "active" : ""}" id="orbit-dot"></span>
                <span id="orbit-text">${this.autoGlide ? (isEn ? "Auto Glide: On" : "Tự động lướt: Bật") : (isEn ? "Auto Glide: Off" : "Tự động lướt: Tắt")}</span>
              </button>
              <button type="button" class="lounge-btn-tool" id="btn-reset-view" title="${isEn ? "Return to central Mixology Bar" : "Trở về Quầy Bar Mixology trung tâm"}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                <span>${isEn ? "Reset View" : "Góc chuẩn"}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="lounge3d-body">
          <!-- KHUNG VIEWPORT 3D LƯỚT CHUYỂN ĐỘNG CÁC PHÂN KHU -->
          <div class="lounge3d-viewport-box lounge-glider-viewport" id="lounge3d-viewport">
            <!-- Ánh sáng môi trường Speakeasy huyền ảo -->
            <div class="glider-ambient-stage">
              <div class="glider-glow glow-amber"></div>
              <div class="glider-glow glow-violet"></div>
              <div class="glider-grid-floor"></div>
            </div>

            <!-- Sân khấu 3D chứa 5 cảnh lướt không gian -->
            <div class="lounge-glider-stage" id="lounge-glider-stage">
              ${LOUNGE_ZONES.map((zone, idx) => `
                <div class="glider-scene-card ${idx === this.currentIndex ? "is-active" : ""}" data-zone="${zone.id}" data-index="${idx}">
                  <div class="scene-card-frame">
                    <img src="${zone.image}" alt="${escapeHtml(isEn ? zone.subName : zone.name)}" class="scene-card-image" loading="${idx === 0 ? "eager" : "lazy"}">
                    <div class="scene-card-overlay"></div>
                    <div class="scene-card-glare"></div>

                    <!-- Điểm ghim 3D Hotspots nổi trên ảnh -->
                    <div class="scene-hotspots-layer">
                      ${zone.hotspots.map((hs) => `
                        <div class="scene-hotspot" style="left: ${hs.x}%; top: ${hs.y}%;">
                          <span class="hotspot-pulse"></span>
                          <span class="hotspot-dot"></span>
                          <span class="hotspot-label">${escapeHtml(isEn ? hs.labelEn : hs.label)}</span>
                        </div>
                      `).join("")}
                    </div>

                    <!-- Header nhãn khu vực trên thẻ -->
                    <div class="scene-card-top">
                      <span class="scene-zone-badge">
                        <span class="badge-icon">${zone.id === "bar-counter" ? "🍸" : zone.id === "vip-sofa" ? "🛋️" : zone.id === "dj-stage" ? "🎧" : zone.id === "high-tables" ? "🥂" : "🥃"}</span>
                        <span>${escapeHtml(isEn ? zone.subName : zone.name)}</span>
                      </span>
                      <span class="scene-index-badge">${String(idx + 1).padStart(2, "0")} / 05</span>
                    </div>

                    <!-- Footer thông tin và nút thao tác nhanh -->
                    <div class="scene-card-bottom">
                      <div class="scene-card-meta">
                        <h3 class="scene-card-title">${escapeHtml(isEn ? zone.subName : zone.name)}</h3>
                        <p class="scene-card-tagline">${escapeHtml(isEn ? zone.tagEn : zone.tag)} · ${escapeHtml(isEn ? zone.capacityEn : zone.capacity)}</p>
                      </div>
                      <div class="scene-card-quick-actions">
                        <button type="button" class="btn-scene-zoom" data-zone="${zone.id}" title="${isEn ? "View 8K photo fullscreen" : "Phóng to toàn màn hình"}">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                          <span>8K</span>
                        </button>
                        <a href="order.html?table=${encodeURIComponent(zone.targetTable)}" class="btn-scene-reserve" title="${isEn ? "Reserve this area" : "Đặt bàn tại khu vực này"}">
                          <span>${isEn ? "Book" : "Đặt Chỗ"}</span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              `).join("")}
            </div>

            <!-- Nút điều hướng 3D trái / phải -->
            <button type="button" class="glider-nav-btn glider-nav-prev" id="btn-glider-prev" aria-label="${isEn ? "Previous space" : "Không gian trước"}" title="${isEn ? "Previous space" : "Không gian trước"}">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button type="button" class="glider-nav-btn glider-nav-next" id="btn-glider-next" aria-label="${isEn ? "Next space" : "Không gian tiếp theo"}" title="${isEn ? "Next space" : "Không gian tiếp theo"}">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            <!-- Thanh tiến trình tự động lướt cảnh -->
            <div class="glider-progress-track">
              <div class="glider-progress-fill" id="glider-progress-fill"></div>
            </div>

            <!-- Gợi ý tương tác lướt chuyển động 3D -->
            <div class="lounge3d-hint" id="lounge3d-hint">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/><path d="M9 18l6-6-6-6"/></svg>
              <span>${isEn ? "Drag / Swipe or click cards to glide through 3D bar spaces" : "Kéo chuột / Vuốt hoặc click vào cảnh để lướt chuyển động 3D qua các không gian quán"}</span>
            </div>
          </div>

          <!-- BẢNG THÔNG TIN CHI TIẾT KHU VỰC ĐƯỢC CHỌN (INFO PANEL) -->
          <div class="lounge3d-info-panel" id="lounge3d-info-panel">
            <div class="info-card-header">
              <span class="info-badge-tag" id="zone-tag">Sang trọng &amp; Riêng tư</span>
              <div class="info-live-status">
                <span class="status-pulse-dot"></span>
                <span>${t("live_status", "Đang phục vụ tối nay")}</span>
              </div>
            </div>

            <!-- Ảnh đại diện phân khu sắc nét trong bảng info -->
            <div class="info-zone-media" id="zone-media-wrap" title="${isEn ? "Click to view full 8K photo" : "Bấm vào để phóng to toàn màn hình"}">
              <img src="img/lounge/bar-counter.jpg" alt="Quầy Bar Mixology Trung Tâm" class="info-zone-img" id="zone-image" loading="lazy">
              <div class="info-zone-media-overlay">
                <span class="media-live-tag">${isEn ? "Authentic Atmosphere" : "Ảnh thực tế không gian"}</span>
                <button type="button" class="btn-zoom-photo" id="btn-zoom-photo" title="${isEn ? "Zoom wide photo" : "Phóng to ảnh toàn cảnh"}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                  <span>${t("btn_zoom_photo", "Xem ảnh lớn")}</span>
                </button>
              </div>
            </div>

            <h3 class="info-zone-title" id="zone-title">Quầy Bar Mixology Trung Tâm</h3>
            <p class="info-zone-subtitle" id="zone-subtitle">Central Mixology Bar Counter</p>

            <div class="info-specs-grid">
              <div class="info-spec-item">
                <span class="spec-label">${t("spec_capacity", "Sức Chứa")}</span>
                <strong class="spec-val" id="zone-capacity">10 Ghế Bar Stool</strong>
              </div>
              <div class="info-spec-item">
                <span class="spec-label">${t("spec_ambience", "Phong Cách")}</span>
                <strong class="spec-val" id="zone-ambience">Ánh sáng vàng hổ phách, gần Bartender</strong>
              </div>
              <div class="info-spec-item">
                <span class="spec-label">${t("spec_music", "Âm Nhạc")}</span>
                <strong class="spec-val" id="zone-music">Acoustic Jazz &amp; Soul</strong>
              </div>
              <div class="info-spec-item">
                <span class="spec-label">${t("spec_lighting", "Ánh Sáng")}</span>
                <strong class="spec-val" id="zone-lighting">Amber 2200K Hổ Phách</strong>
              </div>
            </div>

            <p class="info-desc" id="zone-desc">
              Tọa lạc tại vị trí trung tâm quán bar với mặt quầy đá cẩm thạch đen chỉ vàng Nero Portoro. Phía sau là kệ rượu di sản 3 tầng với hàng trăm chai rượu pha lê rực rỡ dưới ánh đèn ấm áp.
            </p>

            <div class="info-recommend">
              <span class="rec-title">${t("ideal_experience", "Trải nghiệm lý tưởng:")}</span>
              <span class="rec-text" id="zone-best-for">Thực khách đi 1-2 người, cặp đôi, người yêu nghệ thuật pha chế</span>
            </div>

            <div class="info-actions">
              <a href="order.html" class="btn btn-primary btn-block" id="btn-book-zone">
                <span>${t("btn_book_zone", "Đặt Chỗ Tại Khu Vực Này")}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </a>
              <div class="info-contact-hint">
                <span class="text-xs text-muted">${t("hotline_vip", "Hotline tư vấn vị trí VIP:")} <strong>${escapeHtml(VENUE.hotline)}</strong></span>
              </div>
            </div>
          </div>
        </div>

        <!-- THANH DUYỆT NHANH 5 PHÂN KHU KHÔNG GIAN DƯỚI ĐÁY -->
        <div class="lounge-zone-strip" id="lounge-zone-strip">
          ${LOUNGE_ZONES.map((zone, idx) => `
            <button type="button" class="zone-strip-card ${idx === this.currentIndex ? "active" : ""}" data-zone="${zone.id}" data-index="${idx}">
              <div class="zone-strip-media">
                <img src="${zone.image}" alt="${escapeHtml(isEn ? zone.subName : zone.name)}" class="zone-strip-thumb" loading="lazy">
                <span class="zone-strip-icon-tag">${zone.id === "bar-counter" ? "🍸 Bar" : zone.id === "vip-sofa" ? "🛋️ VIP" : zone.id === "dj-stage" ? "🎧 DJ" : zone.id === "high-tables" ? (isEn ? "🥂 Skyline" : "🥂 View Đêm") : (isEn ? "🥃 Vault" : "🥃 Hầm Rượu")}</span>
              </div>
              <div class="zone-strip-info">
                <strong class="zone-strip-name">${escapeHtml(isEn ? zone.subName : zone.name)}</strong>
                <span class="zone-strip-tag">${escapeHtml(isEn ? zone.tagEn : zone.tag)}</span>
              </div>
            </button>
          `).join("")}
        </div>
      </div>

      <!-- Lightbox Modal phóng to ảnh không gian 8K -->
      <div class="lounge-lightbox-modal" id="lounge-lightbox" hidden>
        <div class="lightbox-backdrop" id="lightbox-backdrop"></div>
        <div class="lightbox-dialog">
          <button type="button" class="lightbox-close" id="lightbox-close" aria-label="Đóng">&times;</button>
          <img src="" alt="" id="lightbox-img" class="lightbox-image">
          <div class="lightbox-caption">
            <h4 id="lightbox-title">Quầy Bar Mixology Trung Tâm</h4>
            <p id="lightbox-desc">Không gian thực tế quán bar về đêm</p>
          </div>
        </div>
      </div>
    `;

    this.viewportEl = this.container.querySelector("#lounge3d-viewport");
    this.stageEl = this.container.querySelector("#lounge-glider-stage");
    this.progressFillEl = this.container.querySelector("#glider-progress-fill");
    this.lightboxEl = this.container.querySelector("#lounge-lightbox");

    this.updateGliderTransforms(false);
    this.updateInfoPanel();
  }

  updateGliderTransforms(animated = true) {
    if (!this.stageEl) return;
    const cards = this.stageEl.querySelectorAll(".glider-scene-card");
    const total = LOUNGE_ZONES.length;

    cards.forEach((card) => {
      const idx = parseInt(card.dataset.index, 10);
      let diff = idx - this.currentIndex;

      // Xử lý vòng lặp khoảng cách tròn [-2, 2]
      if (diff > 2) diff -= total;
      if (diff < -2) diff += total;

      const effectiveDiff = diff + this.dragOffset / 320;

      // Tính toạ độ 3D theo khoảng cách
      const absDiff = Math.abs(effectiveDiff);
      const ty = 0;
      let tx;
      let tz;
      let ry;
      let scale;
      let opacity;
      let zIndex;

      if (effectiveDiff === 0) {
        tx = 0;
        tz = 95;
        ry = 0;
        scale = 1;
        opacity = 1;
        zIndex = 20;
      } else if (effectiveDiff > 0) {
        // Cánh bên phải
        tx = Math.min(560, effectiveDiff * 310);
        tz = -effectiveDiff * 95;
        ry = -Math.min(46, effectiveDiff * 26);
        scale = Math.max(0.68, 1 - absDiff * 0.15);
        opacity = Math.max(0.28, 1 - absDiff * 0.32);
        zIndex = Math.max(1, 10 - Math.round(absDiff * 3));
      } else {
        // Cánh bên trái
        tx = Math.max(-560, effectiveDiff * 310);
        tz = effectiveDiff * -95;
        ry = Math.min(46, -effectiveDiff * 26);
        scale = Math.max(0.68, 1 - absDiff * 0.15);
        opacity = Math.max(0.28, 1 - absDiff * 0.32);
        zIndex = Math.max(1, 10 - Math.round(absDiff * 3));
      }

      card.style.transition = animated ? "transform 0.68s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease" : "none";
      card.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, ${tz.toFixed(1)}px) rotateY(${ry.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
      card.style.opacity = opacity.toFixed(2);
      card.style.zIndex = zIndex;

      const isActive = absDiff < 0.35;
      card.classList.toggle("is-active", isActive);
      card.setAttribute("aria-hidden", !isActive);
    });

    // Cập nhật preset buttons
    this.container.querySelectorAll(".lounge-btn-preset").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.zone === this.activeZoneId);
    });

    // Cập nhật thanh zone strip
    this.container.querySelectorAll(".zone-strip-card").forEach((card) => {
      card.classList.toggle("active", card.dataset.zone === this.activeZoneId);
    });
  }

  selectZoneByIndex(idx, animated = true) {
    const total = LOUNGE_ZONES.length;
    this.currentIndex = ((idx % total) + total) % total;
    this.activeZoneId = LOUNGE_ZONES[this.currentIndex].id;
    this.dragOffset = 0;
    this.lastGlideTime = performance.now();

    this.updateGliderTransforms(animated);
    this.updateInfoPanel();
  }

  goToZone(zoneId) {
    const idx = LOUNGE_ZONES.findIndex((z) => z.id === zoneId);
    if (idx !== -1) {
      this.selectZoneByIndex(idx, true);
    }
  }

  next() {
    this.selectZoneByIndex(this.currentIndex + 1, true);
  }

  prev() {
    this.selectZoneByIndex(this.currentIndex - 1, true);
  }

  updateInfoPanel() {
    const zone = LOUNGE_ZONES[this.currentIndex];
    if (!zone) return;

    const isEn = getCurrentLang() === "en";
    const tagEl = this.container.querySelector("#zone-tag");
    const titleEl = this.container.querySelector("#zone-title");
    const subTitleEl = this.container.querySelector("#zone-subtitle");
    const capEl = this.container.querySelector("#zone-capacity");
    const ambEl = this.container.querySelector("#zone-ambience");
    const musicEl = this.container.querySelector("#zone-music");
    const lightingEl = this.container.querySelector("#zone-lighting");
    const descEl = this.container.querySelector("#zone-desc");
    const bestEl = this.container.querySelector("#zone-best-for");
    const bookBtn = this.container.querySelector("#btn-book-zone");
    const imgEl = this.container.querySelector("#zone-image");

    if (tagEl) tagEl.textContent = isEn ? zone.tagEn : zone.tag;
    if (titleEl) titleEl.textContent = isEn ? zone.subName : zone.name;
    if (subTitleEl) subTitleEl.textContent = isEn ? zone.name : zone.subName;
    if (capEl) capEl.textContent = isEn ? zone.capacityEn : zone.capacity;
    if (ambEl) ambEl.textContent = isEn ? zone.ambienceEn : zone.ambience;
    if (musicEl) musicEl.textContent = zone.music || "Curated Midnight Sets";
    if (lightingEl) lightingEl.textContent = zone.lighting || "Bar Lounge Standard";
    if (descEl) descEl.textContent = isEn ? zone.descriptionEn : zone.description;
    if (bestEl) bestEl.textContent = isEn ? zone.bestForEn : zone.bestFor;
    if (imgEl) {
      imgEl.src = zone.image;
      imgEl.alt = isEn ? zone.subName : zone.name;
    }

    if (bookBtn) {
      bookBtn.href = `order.html?table=${encodeURIComponent(zone.targetTable)}`;
      const zoneLabel = isEn ? zone.subName : zone.name;
      bookBtn.querySelector("span").textContent = isEn ? `Reserve ${zoneLabel}` : `Đặt Chỗ Tại ${zoneLabel}`;
    }
  }

  openLightbox(zone) {
    if (!this.lightboxEl || !zone) return;
    const isEn = getCurrentLang() === "en";
    const img = this.lightboxEl.querySelector("#lightbox-img");
    const title = this.lightboxEl.querySelector("#lightbox-title");
    const desc = this.lightboxEl.querySelector("#lightbox-desc");

    if (img) img.src = zone.image;
    if (title) title.textContent = isEn ? zone.subName : zone.name;
    if (desc) desc.textContent = isEn ? zone.descriptionEn : zone.description;

    this.lightboxEl.hidden = false;
    this.lightboxEl.classList.add("show");
  }

  closeLightbox() {
    if (!this.lightboxEl) return;
    this.lightboxEl.classList.remove("show");
    setTimeout(() => {
      this.lightboxEl.hidden = true;
    }, 200);
  }

  bindEvents() {
    // 1. Điều hướng Next / Prev 3D
    const prevBtn = this.container.querySelector("#btn-glider-prev");
    const nextBtn = this.container.querySelector("#btn-glider-next");
    if (prevBtn) prevBtn.addEventListener("click", () => this.prev());
    if (nextBtn) nextBtn.addEventListener("click", () => this.next());

    // 2. Kéo thả chuột / Vuốt màn hình cảm ứng để lướt 3D
    const onDragStart = (clientX) => {
      this.isDragging = true;
      this.dragStartX = clientX;
      this.dragCurrentX = clientX;
      this.dragOffset = 0;
    };

    const onDragMove = (clientX) => {
      if (!this.isDragging) return;
      this.dragCurrentX = clientX;
      this.dragOffset = this.dragCurrentX - this.dragStartX;
      this.updateGliderTransforms(false);
    };

    const onDragEnd = () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      const threshold = 60;
      if (this.dragOffset < -threshold) {
        this.next();
      } else if (this.dragOffset > threshold) {
        this.prev();
      } else {
        this.dragOffset = 0;
        this.updateGliderTransforms(true);
      }
    };

    if (this.viewportEl) {
      this.viewportEl.addEventListener("mousedown", (e) => {
        if (e.target.closest(".glider-nav-btn") || e.target.closest(".btn-scene-zoom") || e.target.closest(".btn-scene-reserve")) return;
        onDragStart(e.clientX);
      });

      window.addEventListener("mousemove", (e) => {
        if (this.isDragging) onDragMove(e.clientX);
      });

      window.addEventListener("mouseup", () => {
        if (this.isDragging) onDragEnd();
      });

      this.viewportEl.addEventListener("touchstart", (e) => {
        if (e.touches.length === 1 && !e.target.closest(".glider-nav-btn") && !e.target.closest(".btn-scene-zoom") && !e.target.closest(".btn-scene-reserve")) {
          onDragStart(e.touches[0].clientX);
        }
      }, { passive: true });

      window.addEventListener("touchmove", (e) => {
        if (this.isDragging && e.touches.length === 1) {
          onDragMove(e.touches[0].clientX);
        }
      }, { passive: true });

      window.addEventListener("touchend", () => {
        if (this.isDragging) onDragEnd();
      });

      // Hiệu ứng nghiêng 3D Parallax khi di chuột trên cảnh đang chọn
      this.viewportEl.addEventListener("mousemove", (e) => {
        if (this.isDragging) return;
        const activeCard = this.viewportEl.querySelector(".glider-scene-card.is-active");
        if (!activeCard) return;

        const rect = activeCard.getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          const mouseX = (e.clientX - rect.left) / rect.width - 0.5;
          const mouseY = (e.clientY - rect.top) / rect.height - 0.5;
          const frame = activeCard.querySelector(".scene-card-frame");
          const glare = activeCard.querySelector(".scene-card-glare");
          const hotspots = activeCard.querySelector(".scene-hotspots-layer");

          if (frame) {
            frame.style.transform = `rotateX(${(-mouseY * 14).toFixed(1)}deg) rotateY(${(mouseX * 16).toFixed(1)}deg)`;
          }
          if (glare) {
            const gx = ((mouseX + 0.5) * 100).toFixed(1);
            const gy = ((mouseY + 0.5) * 100).toFixed(1);
            glare.style.background = `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.22) 0%, transparent 60%)`;
          }
          if (hotspots) {
            hotspots.style.transform = `translateZ(30px) translate3d(${(mouseX * 12).toFixed(1)}px, ${(mouseY * 10).toFixed(1)}px, 0)`;
          }
        }
      });

      this.viewportEl.addEventListener("mouseleave", () => {
        const activeCard = this.viewportEl.querySelector(".glider-scene-card.is-active");
        if (!activeCard) return;
        const frame = activeCard.querySelector(".scene-card-frame");
        const glare = activeCard.querySelector(".scene-card-glare");
        const hotspots = activeCard.querySelector(".scene-hotspots-layer");
        if (frame) frame.style.transform = "rotateX(0deg) rotateY(0deg)";
        if (glare) glare.style.background = "none";
        if (hotspots) hotspots.style.transform = "translateZ(25px)";
      });

      // Tạm dừng auto-glide khi rê chuột vào viewport
      this.viewportEl.addEventListener("mouseenter", () => {
        this.isHovering = true;
      });
      this.viewportEl.addEventListener("mouseleave", () => {
        this.isHovering = false;
        this.lastGlideTime = performance.now();
      });
    }

    // 3. Phím mũi tên lướt cảnh
    window.addEventListener("keydown", (e) => {
      if (this.lightboxEl && !this.lightboxEl.hidden) {
        if (e.key === "Escape") this.closeLightbox();
        return;
      }
      if (document.activeElement && ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;

      if (e.key === "ArrowLeft") {
        this.prev();
      } else if (e.key === "ArrowRight") {
        this.next();
      }
    });

    // 4. Click các cảnh 3D nền, Presets, Thẻ phân khu, và Nút Zoom 8K
    this.container.addEventListener("click", (e) => {
      // Zoom 8K từ scene card
      const zoomBtn = e.target.closest(".btn-scene-zoom");
      if (zoomBtn) {
        const zone = LOUNGE_ZONES.find((z) => z.id === zoomBtn.dataset.zone);
        if (zone) this.openLightbox(zone);
        return;
      }

      // Click vào card ở 2 bên để lướt nó về chính diện
      const sceneCard = e.target.closest(".glider-scene-card");
      if (sceneCard && !e.target.closest(".btn-scene-reserve") && !e.target.closest(".btn-scene-zoom")) {
        const idx = parseInt(sceneCard.dataset.index, 10);
        if (idx !== this.currentIndex) {
          this.selectZoneByIndex(idx, true);
          return;
        }
      }

      // Click preset buttons
      const presetBtn = e.target.closest(".lounge-btn-preset");
      if (presetBtn) {
        const zoneId = presetBtn.dataset.zone;
        if (zoneId) this.goToZone(zoneId);
        return;
      }

      // Click thẻ dưới thanh Zone Strip
      const stripCard = e.target.closest(".zone-strip-card");
      if (stripCard) {
        const zoneId = stripCard.dataset.zone;
        if (zoneId) this.goToZone(zoneId);
        return;
      }

      // Phóng to ảnh từ Info Panel
      if (e.target.closest("#btn-zoom-photo") || e.target.closest("#zone-media-wrap")) {
        const zone = LOUNGE_ZONES[this.currentIndex];
        if (zone) this.openLightbox(zone);
      }
    });

    // 5. Đóng lightbox
    const closeBtn = this.container.querySelector("#lightbox-close");
    const backdrop = this.container.querySelector("#lightbox-backdrop");
    if (closeBtn) closeBtn.addEventListener("click", () => this.closeLightbox());
    if (backdrop) backdrop.addEventListener("click", () => this.closeLightbox());

    // 6. Bật / Tắt chế độ tự động lướt chuyển động
    const orbitBtn = this.container.querySelector("#btn-toggle-orbit");
    if (orbitBtn) {
      orbitBtn.addEventListener("click", () => {
        this.autoGlide = !this.autoGlide;
        const isEn = getCurrentLang() === "en";
        const dot = this.container.querySelector("#orbit-dot");
        const text = this.container.querySelector("#orbit-text");
        if (dot) dot.classList.toggle("active", this.autoGlide);
        if (text) {
          text.textContent = this.autoGlide ? (isEn ? "Auto Glide: On" : "Tự động lướt: Bật") : (isEn ? "Auto Glide: Off" : "Tự động lướt: Tắt");
        }
        if (this.autoGlide) {
          this.lastGlideTime = performance.now();
        }
      });
    }

    // 7. Reset góc chuẩn về Quầy Bar Mixology
    const resetBtn = this.container.querySelector("#btn-reset-view");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        this.selectZoneByIndex(0, true);
      });
    }
  }

  startAutoGlideLoop() {
    const loop = (time) => {
      if (this.autoGlide && !this.isHovering && !this.isDragging) {
        const elapsed = time - this.lastGlideTime;
        const progress = Math.min(1, elapsed / this.glideDuration);

        if (this.progressFillEl) {
          this.progressFillEl.style.width = `${(progress * 100).toFixed(1)}%`;
        }

        if (elapsed >= this.glideDuration) {
          this.next();
          this.lastGlideTime = time;
        }
      } else if (this.progressFillEl && (this.isHovering || this.isDragging || !this.autoGlide)) {
        this.progressFillEl.style.width = "0%";
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  destroy() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.onLangChange) window.removeEventListener("languagechange", this.onLangChange);
  }
}

export function initLounge3D(containerId = "lounge-3d-mount") {
  const mountEl = document.getElementById(containerId);
  if (!mountEl) return null;
  return new Lounge3DController(mountEl);
}

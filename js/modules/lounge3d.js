/* =========================================================
   LOUNGE3D.JS - Mô hình không gian quán bar 3D tương tác
   Tích hợp ảnh thực tế không gian 8K sắc nét từng phân khu
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
    coords: { x: 0, y: -20, z: 25 },
    camera: { rx: 55, ry: 0, zoom: 1.15 },
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
    coords: { x: -140, y: 50, z: 25 },
    camera: { rx: 50, ry: -25, zoom: 1.1 },
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
    coords: { x: 140, y: -90, z: 30 },
    camera: { rx: 52, ry: 25, zoom: 1.1 },
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
    coords: { x: 60, y: 80, z: 20 },
    camera: { rx: 58, ry: 12, zoom: 1.05 },
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
    coords: { x: -80, y: -120, z: 30 },
    camera: { rx: 48, ry: -15, zoom: 1.1 },
  },
];

class Lounge3DController {
  constructor(containerEl) {
    this.container = containerEl;
    this.rotX = 55;
    this.rotY = -15;
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;
    this.startRotX = 55;
    this.startRotY = -15;
    this.autoRotate = true;
    this.activeZoneId = "bar-counter";
    this.viewMode = "3d"; // "3d" hoặc "real"
    this.animFrameId = null;

    this.onLangChange = () => {
      this.render();
    };
    window.addEventListener("languagechange", this.onLangChange);

    this.render();
    this.bindEvents();
    this.startAutoRotateLoop();
  }

  render() {
    const isEn = getCurrentLang() === "en";

    this.container.innerHTML = `
      <div class="lounge3d-wrapper">
        <div class="lounge3d-header">
          <div class="lounge3d-title-group">
            <span class="section-kicker">${t("lounge_kicker", "3D VIRTUAL EXPERIENCE")}</span>
            <h2 class="lounge3d-heading">${t("lounge_heading", "Mô Hình Không Gian 3D")} <em class="lounge3d-highlight">${t("lounge_heading_em", "Quán Bar Đêm")}</em></h2>
            <p class="lounge3d-subtitle">${t("lounge_sub")}</p>
          </div>
          <div class="lounge3d-toolbar">
            <div class="lounge3d-presets" id="lounge3d-presets">
              <button type="button" class="lounge-btn-preset active" data-view="all" title="${isEn ? "View entire 3D space" : "Xem toàn bộ mô hình không gian quán"}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                <span>${t("preset_all", "Toàn Cảnh 3D")}</span>
              </button>
              <button type="button" class="lounge-btn-preset" data-zone="bar-counter">
                ${ICONS.cocktail(14)}
                <span>${t("preset_bar", "Quầy Bar")}</span>
              </button>
              <button type="button" class="lounge-btn-preset" data-zone="vip-sofa">
                ${ICONS.sparkle(14)}
                <span>${t("preset_vip", "Sofa VIP")}</span>
              </button>
              <button type="button" class="lounge-btn-preset" data-zone="dj-stage">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                <span>${t("preset_dj", "Sân Khấu DJ")}</span>
              </button>
              <button type="button" class="lounge-btn-preset" data-zone="high-tables">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M8 6h8M6 22h12"/></svg>
                <span>${t("preset_high", "Bàn Cao")}</span>
              </button>
              <button type="button" class="lounge-btn-preset" data-zone="cellar-display">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
                <span>${t("preset_cellar", "Hầm Rượu")}</span>
              </button>
            </div>
            <div class="lounge3d-tool-actions">
              <button type="button" class="lounge-btn-tool" id="btn-toggle-orbit" title="${isEn ? "Toggle auto orbit rotation" : "Bật/Tắt chế độ tự động xoay góc nhìn"}">
                <span class="orbit-status-dot active" id="orbit-dot"></span>
                <span id="orbit-text">${this.autoRotate ? t("orbit_on", "Tự động xoay: Bật") : t("orbit_off", "Tự động xoay: Tắt")}</span>
              </button>
              <button type="button" class="lounge-btn-tool" id="btn-reset-view" title="${isEn ? "Reset camera to standard angle" : "Khôi phục góc nhìn mặc định"}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                <span>${t("btn_reset_cam", "Góc chuẩn")}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="lounge3d-body">
          <div class="lounge3d-viewport-box" id="lounge3d-viewport">
            <!-- Nút chuyển đổi View Mode: 3D Scene ↔ Ảnh Thực Tế Không Gian -->
            <div class="lounge-mode-switch">
              <button type="button" class="mode-switch-btn active" id="btn-mode-3d">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                <span>${t("btn_orbit_mode", "Mô hình 3D xoay")}</span>
              </button>
              <button type="button" class="mode-switch-btn" id="btn-mode-real">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>${t("btn_real_mode", "Ảnh không gian thực tế")}</span>
              </button>
            </div>

            <!-- Khung chiếu 3D Scene -->
            <div class="lounge3d-scene" id="lounge3d-scene">
              <!-- Sàn chính quán bar 3D -->
              <div class="lounge-floor">
                <!-- Lưới ánh sáng sàn club phản chiếu -->
                <div class="lounge-floor-grid"></div>
                <div class="lounge-ambient-light ambient-center"></div>
                <div class="lounge-ambient-light ambient-stage"></div>
                <div class="lounge-ambient-light ambient-vip"></div>

                <!-- 1. Quầy Bar Trung Tâm (L-Shape Bar Counter) -->
                <div class="obj-3d obj-bar-counter zone-interactive" data-zone="bar-counter">
                  <div class="bar-top"></div>
                  <div class="bar-front"></div>
                  <div class="bar-side"></div>
                  <div class="bar-glow-strip"></div>
                  <!-- Hàng ghế bar stools -->
                  <div class="stool stool-1"></div>
                  <div class="stool stool-2"></div>
                  <div class="stool stool-3"></div>
                  <div class="stool stool-4"></div>
                  <div class="stool stool-5"></div>
                </div>

                <!-- 2. Kệ Rượu Sau Quầy Bar (Backbar Display) -->
                <div class="obj-3d obj-backbar-shelves">
                  <div class="shelf shelf-1"><div class="bottles-row"></div></div>
                  <div class="shelf shelf-2"><div class="bottles-row"></div></div>
                  <div class="shelf shelf-3"><div class="bottles-row"></div></div>
                  <div class="backbar-halo"></div>
                </div>

                <!-- 3. Khu Bàn Sofa VIP 01 & 02 -->
                <div class="obj-3d obj-vip-sofa zone-interactive" data-zone="vip-sofa">
                  <div class="sofa-body sofa-left"></div>
                  <div class="sofa-body sofa-back"></div>
                  <div class="vip-table">
                    <div class="table-candle"></div>
                    <div class="table-champagne-bucket"></div>
                  </div>
                  <div class="vip-rug"></div>
                  <div class="vip-chandelier-light"></div>
                </div>

                <!-- 4. Sân Khấu DJ & Âm Nhạc -->
                <div class="obj-3d obj-dj-stage zone-interactive" data-zone="dj-stage">
                  <div class="stage-podium"></div>
                  <div class="dj-console">
                    <div class="vinyl-turntable left"></div>
                    <div class="vinyl-turntable right"></div>
                    <div class="dj-mixer"></div>
                  </div>
                  <div class="stage-light-bar"></div>
                  <div class="speaker-column col-left"></div>
                  <div class="speaker-column col-right"></div>
                </div>

                <!-- 5. Khu Bàn Cao Cocktail Chill -->
                <div class="obj-3d obj-high-tables zone-interactive" data-zone="high-tables">
                  <div class="high-table table-a">
                    <div class="ht-pole"></div>
                    <div class="ht-top"></div>
                    <div class="ht-glass"></div>
                  </div>
                  <div class="high-table table-b">
                    <div class="ht-pole"></div>
                    <div class="ht-top"></div>
                    <div class="ht-glass"></div>
                  </div>
                </div>

                <!-- 6. Tủ Kính Rượu Sưu Tầm Cổ Điển -->
                <div class="obj-3d obj-spirits-vault zone-interactive" data-zone="cellar-display">
                  <div class="vault-cabinet"></div>
                  <div class="vault-glass-door"></div>
                  <div class="vault-inner-glow"></div>
                </div>

                <!-- Các điểm ghim 3D (Floating Hotspot Pins) -->
                ${LOUNGE_ZONES.map((zone) => `
                  <div class="lounge-pin pin-${zone.id}" data-zone="${zone.id}" title="${escapeHtml(isEn ? zone.subName : zone.name)}">
                    <div class="pin-pulse"></div>
                    <div class="pin-head">
                      <span class="pin-icon">${zone.id === "bar-counter" ? "🍸" : zone.id === "vip-sofa" ? "🛋️" : zone.id === "dj-stage" ? "🎧" : zone.id === "high-tables" ? "🥂" : "🥃"}</span>
                    </div>
                    <div class="pin-label-tag">${escapeHtml(isEn ? zone.subName : zone.name)}</div>
                  </div>
                `).join("")}
              </div>
            </div>

            <!-- Khung hiển thị Ảnh Thực Tế Toàn Cảnh (Real View Stage) -->
            <div class="lounge-real-view" id="lounge-real-view" hidden>
              <img src="img/lounge/bar-counter.jpg" alt="Không gian quán bar" id="real-view-img" class="real-view-image">
              <div class="real-view-overlay">
                <div class="real-view-top-bar">
                  <div class="real-view-badge" id="real-view-badge">Quầy Bar Mixology Trung Tâm</div>
                  <span class="real-view-live-indicator">
                    <span class="live-dot"></span>
                    <span>${t("real_view_live", "Ảnh thực tế tại quán")}</span>
                  </span>
                </div>
                <div class="real-view-bottom-bar">
                  <p class="real-view-desc-text" id="real-view-desc">Mặt quầy đá cẩm thạch đen Nero Portoro và kệ rượu di sản 3 tầng rực rỡ</p>
                  <button type="button" class="btn-zoom-main" id="btn-zoom-main" title="${isEn ? "View wide 8K resolution photo" : "Phóng to ảnh góc rộng"}">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                    <span>${t("btn_zoom_main", "Xem Cận Cảnh Toàn Màn Hình")}</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Hint hướng dẫn điều khiển góc nhìn 3D -->
            <div class="lounge3d-hint" id="lounge3d-hint">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/><path d="M9 18l6-6-6-6"/></svg>
              <span>${t("lounge_hint")}</span>
            </div>
          </div>

          <!-- Bảng thông tin chi tiết khu vực được chọn (Info Panel) -->
          <div class="lounge3d-info-panel" id="lounge3d-info-panel">
            <div class="info-card-header">
              <span class="info-badge-tag" id="zone-tag">Sang trọng &amp; Riêng tư</span>
              <div class="info-live-status">
                <span class="status-pulse-dot"></span>
                <span>${t("live_status", "Đang phục vụ tối nay")}</span>
              </div>
            </div>

            <!-- Khung ảnh không gian thực tế sắc nét -->
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

        <!-- Thanh duyệt trực quan 5 phân khu không gian thực tế (Zone Selector Strip) -->
        <div class="lounge-zone-strip" id="lounge-zone-strip">
          ${LOUNGE_ZONES.map((zone) => `
            <button type="button" class="zone-strip-card ${zone.id === this.activeZoneId ? "active" : ""}" data-zone="${zone.id}">
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

      <!-- Lightbox Modal phóng to ảnh không gian -->
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

    this.sceneEl = this.container.querySelector("#lounge3d-scene");
    this.viewportEl = this.container.querySelector("#lounge3d-viewport");
    this.realViewEl = this.container.querySelector("#lounge-real-view");
    this.hintEl = this.container.querySelector("#lounge3d-hint");
    this.lightboxEl = this.container.querySelector("#lounge-lightbox");

    this.updateSceneTransform();
    this.selectZone(this.activeZoneId);
  }

  updateSceneTransform() {
    if (!this.sceneEl) return;
    this.sceneEl.style.transform = `rotateX(${this.rotX}deg) rotateZ(${this.rotY}deg)`;
  }

  setViewMode(mode) {
    this.viewMode = mode;
    const isReal = mode === "real";
    const isEn = getCurrentLang() === "en";

    if (this.sceneEl) this.sceneEl.hidden = isReal;
    if (this.realViewEl) this.realViewEl.hidden = !isReal;
    if (this.hintEl) this.hintEl.hidden = isReal;

    const btn3d = this.container.querySelector("#btn-mode-3d");
    const btnReal = this.container.querySelector("#btn-mode-real");
    if (btn3d) btn3d.classList.toggle("active", !isReal);
    if (btnReal) btnReal.classList.toggle("active", isReal);

    // Cập nhật ảnh của chế độ real view
    const zone = LOUNGE_ZONES.find((z) => z.id === this.activeZoneId);
    if (zone && isReal) {
      const realImg = this.container.querySelector("#real-view-img");
      const realBadge = this.container.querySelector("#real-view-badge");
      const realDesc = this.container.querySelector("#real-view-desc");
      if (realImg) realImg.src = zone.image;
      if (realBadge) realBadge.textContent = isEn ? zone.subName : zone.name;
      if (realDesc) realDesc.textContent = isEn ? zone.descriptionEn : zone.description;
    }
  }

  selectZone(zoneId) {
    const zone = LOUNGE_ZONES.find((z) => z.id === zoneId);
    if (!zone) return;

    this.activeZoneId = zoneId;
    const isEn = getCurrentLang() === "en";

    // Cập nhật thông tin card
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
    const realImg = this.container.querySelector("#real-view-img");
    const realBadge = this.container.querySelector("#real-view-badge");
    const realDesc = this.container.querySelector("#real-view-desc");

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
    if (realImg) {
      realImg.src = zone.image;
      realImg.alt = isEn ? zone.subName : zone.name;
    }
    if (realBadge) realBadge.textContent = isEn ? zone.subName : zone.name;
    if (realDesc) realDesc.textContent = isEn ? zone.descriptionEn : zone.description;

    if (bookBtn) {
      bookBtn.href = `order.html?table=${encodeURIComponent(zone.targetTable)}`;
      const zoneLabel = isEn ? zone.subName : zone.name;
      bookBtn.querySelector("span").textContent = isEn ? `Reserve ${zoneLabel}` : `Đặt Chỗ Tại ${zoneLabel}`;
    }

    // Highlight các pin & khối 3D
    this.container.querySelectorAll(".lounge-pin").forEach((pin) => {
      pin.classList.toggle("active", pin.dataset.zone === zoneId);
    });

    this.container.querySelectorAll(".zone-interactive").forEach((obj) => {
      obj.classList.toggle("highlight", obj.dataset.zone === zoneId);
    });

    // Highlight preset tab nếu khớp
    this.container.querySelectorAll(".lounge-btn-preset").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.zone === zoneId);
    });

    // Highlight thẻ trong Zone Strip
    this.container.querySelectorAll(".zone-strip-card").forEach((card) => {
      card.classList.toggle("active", card.dataset.zone === zoneId);
    });
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
    // 1. Kéo chuột / Vuốt xoay không gian 3D
    const startDrag = (clientX, clientY) => {
      if (this.viewMode === "real") return;
      this.isDragging = true;
      this.startX = clientX;
      this.startY = clientY;
      this.startRotX = this.rotX;
      this.startRotY = this.rotY;
      this.autoRotate = false;
      this.updateOrbitButton();
    };

    const doDrag = (clientX, clientY) => {
      if (!this.isDragging || this.viewMode === "real") return;
      const dx = clientX - this.startX;
      const dy = clientY - this.startY;

      let newRotX = this.startRotX - dy * 0.35;
      if (newRotX < 35) newRotX = 35;
      if (newRotX > 75) newRotX = 75;

      const newRotY = this.startRotY + dx * 0.4;
      this.rotX = newRotX;
      this.rotY = newRotY;
      this.updateSceneTransform();
    };

    const endDrag = () => {
      this.isDragging = false;
    };

    if (this.viewportEl) {
      this.viewportEl.addEventListener("mousedown", (e) => {
        if (e.target.closest(".lounge-pin") || e.target.closest(".lounge-mode-switch") || e.target.closest(".btn-zoom-main")) return;
        startDrag(e.clientX, e.clientY);
      });
      window.addEventListener("mousemove", (e) => doDrag(e.clientX, e.clientY));
      window.addEventListener("mouseup", endDrag);

      this.viewportEl.addEventListener("touchstart", (e) => {
        if (e.touches.length === 1 && !e.target.closest(".lounge-pin") && !e.target.closest(".lounge-mode-switch")) {
          startDrag(e.touches[0].clientX, e.touches[0].clientY);
        }
      }, { passive: true });

      window.addEventListener("touchmove", (e) => {
        if (e.touches.length === 1) {
          doDrag(e.touches[0].clientX, e.touches[0].clientY);
        }
      }, { passive: true });

      window.addEventListener("touchend", endDrag);
    }

    // 2. Chuyển đổi View Mode
    const btn3d = this.container.querySelector("#btn-mode-3d");
    const btnReal = this.container.querySelector("#btn-mode-real");
    if (btn3d) btn3d.addEventListener("click", () => this.setViewMode("3d"));
    if (btnReal) btnReal.addEventListener("click", () => this.setViewMode("real"));

    // 3. Phóng to ảnh không gian
    const zoomBtn = this.container.querySelector("#btn-zoom-photo");
    const zoomMainBtn = this.container.querySelector("#btn-zoom-main");
    const mediaWrap = this.container.querySelector("#zone-media-wrap");
    const triggerZoom = () => {
      const zone = LOUNGE_ZONES.find((z) => z.id === this.activeZoneId);
      if (zone) this.openLightbox(zone);
    };
    if (zoomBtn) zoomBtn.addEventListener("click", triggerZoom);
    if (zoomMainBtn) zoomMainBtn.addEventListener("click", triggerZoom);
    if (mediaWrap) {
      mediaWrap.addEventListener("click", (e) => {
        if (!e.target.closest("#btn-zoom-photo")) {
          triggerZoom();
        }
      });
    }

    // Đóng lightbox
    const closeBtn = this.container.querySelector("#lightbox-close");
    const backdrop = this.container.querySelector("#lightbox-backdrop");
    if (closeBtn) closeBtn.addEventListener("click", () => this.closeLightbox());
    if (backdrop) backdrop.addEventListener("click", () => this.closeLightbox());

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.lightboxEl && !this.lightboxEl.hidden) {
        this.closeLightbox();
      }
    });

    // 4. Click các Hotspot Pin, Khối 3D, Thẻ phân khu & Presets
    this.container.addEventListener("click", (e) => {
      const pin = e.target.closest(".lounge-pin");
      if (pin) {
        this.selectZone(pin.dataset.zone);
        return;
      }

      const obj = e.target.closest(".zone-interactive");
      if (obj) {
        this.selectZone(obj.dataset.zone);
        return;
      }

      const stripCard = e.target.closest(".zone-strip-card");
      if (stripCard) {
        const zoneId = stripCard.dataset.zone;
        if (zoneId) {
          this.selectZone(zoneId);
          const zone = LOUNGE_ZONES.find((z) => z.id === zoneId);
          if (zone && zone.camera) {
            this.rotX = zone.camera.rx;
            this.rotY = zone.camera.ry;
            this.updateSceneTransform();
          }
        }
        return;
      }

      const presetBtn = e.target.closest(".lounge-btn-preset");
      if (presetBtn) {
        const zoneId = presetBtn.dataset.zone;
        if (zoneId) {
          this.selectZone(zoneId);
          const zone = LOUNGE_ZONES.find((z) => z.id === zoneId);
          if (zone && zone.camera) {
            this.rotX = zone.camera.rx;
            this.rotY = zone.camera.ry;
            this.updateSceneTransform();
          }
        } else if (presetBtn.dataset.view === "all") {
          this.rotX = 55;
          this.rotY = -15;
          this.updateSceneTransform();
          this.container.querySelectorAll(".lounge-btn-preset").forEach((b) => b.classList.remove("active"));
          presetBtn.classList.add("active");
        }
      }
    });

    // 5. Nút bật tắt xoay tự động
    const orbitBtn = this.container.querySelector("#btn-toggle-orbit");
    if (orbitBtn) {
      orbitBtn.addEventListener("click", () => {
        this.autoRotate = !this.autoRotate;
        this.updateOrbitButton();
      });
    }

    // 6. Nút reset góc nhìn
    const resetBtn = this.container.querySelector("#btn-reset-view");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        this.rotX = 55;
        this.rotY = -15;
        this.updateSceneTransform();
        this.selectZone("bar-counter");
      });
    }
  }

  updateOrbitButton() {
    const dot = this.container.querySelector("#orbit-dot");
    const text = this.container.querySelector("#orbit-text");
    if (dot) dot.classList.toggle("active", this.autoRotate);
    if (text) {
      text.textContent = this.autoRotate ? t("orbit_on", "Tự động xoay: Bật") : t("orbit_off", "Tự động xoay: Tắt");
    }
  }

  startAutoRotateLoop() {
    const loop = () => {
      if (this.autoRotate && !this.isDragging && this.viewMode === "3d") {
        this.rotY = (this.rotY + 0.15) % 360;
        this.updateSceneTransform();
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

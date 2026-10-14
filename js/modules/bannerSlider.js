/* =========================================================
   BANNER-SLIDER.JS - Slider banner quảng cáo trên trang chủ
   Đọc bảng banner (id, tenbanner, hinhbanner) qua bannersService
   rồi dựng slider toàn chiều ngang:
     - Ảnh nền = hinhbanner, tiêu đề lớn = tenbanner, nút "Xem ưu đãi"
       dẫn tới trang khuyến mãi sale.html (cả banner bấm được).
     - Nút trước/sau, chấm điều hướng, tự chạy mỗi 5 giây.
     - Dừng khi rê chuột / khi dùng bàn phím bên trong slider,
       vuốt trái/phải trên điện thoại, phím ← → Home End khi đang focus.
     - Tôn trọng "giảm chuyển động" (prefers-reduced-motion): KHÔNG tự chạy.
     - Không có banner hợp lệ nào -> ẩn luôn cả section.
   Chuẩn trợ năng theo mẫu Carousel của WAI-ARIA:
     aria-roledescription="carousel"/"slide", nút có aria-label,
     vùng aria-live chỉ bật "polite" khi slider KHÔNG tự chạy.
   ========================================================= */

import { getAllBanners, SEED_BANNERS, Banner } from "./bannersService.js";
import { escapeHtml } from "./utils.js";
import { ICONS } from "./icons.js";
import { getCurrentLang, t } from "./i18n.js";

/** Thời gian mỗi banner hiển thị khi tự chạy (ms) */
const AUTOPLAY_MS = 5000;
/** Quãng vuốt ngang tối thiểu (px) để tính là một lần vuốt chuyển banner */
const SWIPE_THRESHOLD = 45;
/** Trang đích của mọi banner quảng cáo */
const PROMO_PAGE = "sale.html";

/** Chuỗi giao diện song ngữ - i18n.js có key "banner_*" thì ưu tiên dùng key đó */
const TEXT = {
  vi: {
    region: "Ưu đãi nổi bật của quán",
    kicker: "Ưu đãi tại Quán Bar Đêm",
    cta: "Xem ưu đãi",
    slide: "Banner {n} / {total}",
    prev: "Xem banner trước",
    next: "Xem banner tiếp theo",
    dots: "Chọn banner",
    goTo: "Chuyển tới banner {n}: {name}",
    pause: "Tạm dừng tự chuyển banner",
    play: "Bật tự chuyển banner",
    loading: "Đang tải ưu đãi...",
  },
  en: {
    region: "Featured offers",
    kicker: "Offers at Night Bar Lounge",
    cta: "View offers",
    slide: "Banner {n} of {total}",
    prev: "Previous banner",
    next: "Next banner",
    dots: "Choose a banner",
    goTo: "Go to banner {n}: {name}",
    pause: "Pause auto-rotation",
    play: "Start auto-rotation",
    loading: "Loading offers...",
  },
};

/** Lấy chuỗi theo ngôn ngữ hiện tại, thay {biến} bằng giá trị thật */
function tx(key, vars = {}) {
  const dict = TEXT[getCurrentLang()] || TEXT.vi;
  const template = t(`banner_${key}`, dict[key] ?? TEXT.vi[key] ?? "");
  return template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ""));
}

const ICON_PAUSE = `<svg class="ui-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`;
const ICON_PLAY = `<svg class="ui-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>`;

/** Mỗi host chỉ có 1 slider: gọi init lần nữa thì huỷ slider cũ (tránh nhân đôi bộ hẹn giờ) */
const instances = new WeakMap();
/** Lượt tải mới nhất của từng host - lượt tải cũ về muộn thì bỏ qua */
const pendingLoads = new WeakMap();

function prefersReducedMotion() {
  return typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Tải banner đủ điều kiện hiển thị (có tên + ảnh thuộc 3 dạng an toàn).
 * API lỗi (chưa có bảng banners, máy chủ báo lỗi...) -> dùng banner mẫu
 * đóng gói sẵn để trang chủ không bị khoảng trống.
 */
async function loadDisplayableBanners() {
  let banners;
  try {
    banners = await getAllBanners();
  } catch (err) {
    console.warn("[bannerSlider] Không tải được /banners, dùng banner mẫu:", err.message);
    banners = SEED_BANNERS.map((data) => Banner.from(data));
  }
  return banners.filter((banner) => banner.isDisplayable);
}

/** HTML một slide - mọi dữ liệu từ máy chủ đều qua escapeHtml trước khi chèn */
function slideHtml(banner, i, total, baseId) {
  const isFirst = i === 0;
  return `
    <div class="banner-slide${isFirst ? " is-active" : ""}" id="${baseId}-slide-${i}"
         role="group" aria-roledescription="slide" data-index="${i}"
         aria-label="${escapeHtml(tx("slide", { n: i + 1, total }))}"
         ${isFirst ? "" : 'aria-hidden="true" inert'}>
      <img class="banner-slide-img" src="${escapeHtml(banner.hinhbanner)}" alt=""
           decoding="async" ${isFirst ? 'fetchpriority="high"' : 'loading="lazy"'}>
      <div class="banner-slide-shade" aria-hidden="true"></div>
      <div class="container banner-slide-content">
        <span class="banner-slide-kicker">${ICONS.sparkle(13)}<span data-banner-text="kicker">${escapeHtml(tx("kicker"))}</span></span>
        <h2 class="banner-slide-title">${escapeHtml(banner.tenbanner)}</h2>
        <a class="btn btn-primary banner-slide-cta" href="${PROMO_PAGE}">
          <span data-banner-text="cta">${escapeHtml(tx("cta"))}</span>
          ${ICONS.arrowRight(15)}
        </a>
      </div>
    </div>`;
}

function dotHtml(banner, i) {
  return `
    <button type="button" class="banner-dot${i === 0 ? " is-active" : ""}" data-index="${i}"
            ${i === 0 ? 'aria-current="true"' : ""}
            aria-label="${escapeHtml(tx("goTo", { n: i + 1, name: banner.tenbanner }))}">
      <span class="banner-dot-fill" aria-hidden="true"></span>
    </button>`;
}

/**
 * Dựng slider vào host và gắn toàn bộ hành vi.
 * @returns {object} bộ điều khiển: next(), prev(), goTo(i), play(), pause(), destroy()
 */
function createSlider(host, banners) {
  const count = banners.length;
  const baseId = `${host.id || "banner"}-carousel`;
  const multi = count > 1;

  host.innerHTML = `
    <div class="banner-slider${multi ? "" : " is-single"}" role="region" aria-roledescription="carousel"
         aria-label="${escapeHtml(tx("region"))}" style="--banner-interval: ${AUTOPLAY_MS}ms">
      ${multi ? `
        <button type="button" class="banner-toggle" aria-controls="${baseId}-viewport">
          <span class="banner-toggle-icon" data-icon="pause">${ICON_PAUSE}</span>
          <span class="banner-toggle-icon" data-icon="play" hidden>${ICON_PLAY}</span>
        </button>` : ""}
      <div class="banner-viewport" id="${baseId}-viewport" aria-live="${multi ? "off" : "polite"}">
        ${banners.map((banner, i) => slideHtml(banner, i, count, baseId)).join("")}
      </div>
      ${multi ? `
        <button type="button" class="banner-arrow banner-arrow-prev" aria-controls="${baseId}-viewport"
                aria-label="${escapeHtml(tx("prev"))}">${ICONS.arrowLeft(18)}</button>
        <button type="button" class="banner-arrow banner-arrow-next" aria-controls="${baseId}-viewport"
                aria-label="${escapeHtml(tx("next"))}">${ICONS.arrowRight(18)}</button>
        <div class="banner-dots" role="group" aria-label="${escapeHtml(tx("dots"))}">
          ${banners.map(dotHtml).join("")}
        </div>` : ""}
    </div>`;

  const root = host.querySelector(".banner-slider");
  const viewport = root.querySelector(".banner-viewport");
  const slides = [...root.querySelectorAll(".banner-slide")];
  const dots = [...root.querySelectorAll(".banner-dot")];
  const toggleBtn = root.querySelector(".banner-toggle");

  // Ảnh hỏng (đường dẫn sai, URL chết) -> ẩn ảnh, hiện nền vân vàng đồng thay thế
  slides.forEach((slide) => {
    const img = slide.querySelector(".banner-slide-img");
    img.addEventListener("error", () => slide.classList.add("is-broken"), { once: true });
  });

  /* ---------- Trạng thái tự chạy ---------- */
  let index = 0;
  let userStopped = prefersReducedMotion(); // giảm chuyển động -> mặc định KHÔNG tự chạy
  let hoverPaused = false;
  let focusPaused = false;
  let timer = null;
  let startedAt = 0;
  let remaining = AUTOPLAY_MS;

  const isRunning = () => multi && !userStopped && !hoverPaused && !focusPaused && !document.hidden;

  /** Dừng bộ hẹn giờ, ghi nhớ thời gian còn lại để chạy tiếp đúng chỗ (khớp thanh tiến trình) */
  function halt() {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
    remaining = Math.max(0, remaining - (Date.now() - startedAt));
  }

  function schedule() {
    if (timer || !isRunning()) return;
    startedAt = Date.now();
    timer = setTimeout(() => {
      timer = null;
      goTo(index + 1);
    }, remaining);
  }

  /** Chạy lại hiệu ứng thanh tiến trình trên chấm đang chọn */
  function restartProgress() {
    const fill = dots[index]?.querySelector(".banner-dot-fill");
    if (!fill) return;
    fill.style.animation = "none";
    void fill.offsetWidth; // ép trình duyệt tính lại bố cục để animation bắt đầu lại từ đầu
    fill.style.animation = "";
  }

  /** Đồng bộ giao diện với trạng thái tự chạy (class, aria-live, nút tạm dừng) */
  function sync() {
    root.classList.toggle("is-paused", !isRunning());
    root.classList.toggle("is-stopped", userStopped);
    // Đang tự chạy -> tắt đọc tự động (tránh trình đọc màn hình bị làm phiền mỗi 5 giây)
    viewport.setAttribute("aria-live", isRunning() ? "off" : "polite");

    if (toggleBtn) {
      // Chỉ bật/tắt biểu tượng có sẵn, KHÔNG thay innerHTML: thay nút con giữa lúc nhấn chuột
      // (focusin -> sync) làm trình duyệt "lạc" mục tiêu và nuốt mất sự kiện click
      toggleBtn.querySelector('[data-icon="pause"]').hidden = userStopped;
      toggleBtn.querySelector('[data-icon="play"]').hidden = !userStopped;
      toggleBtn.setAttribute("aria-label", tx(userStopped ? "play" : "pause"));
      toggleBtn.title = tx(userStopped ? "play" : "pause");
    }

    if (isRunning()) schedule();
    else halt();
  }

  /** Chuyển tới banner số target (vòng tròn: sau banner cuối là banner đầu) */
  function goTo(target) {
    if (!multi) return;
    const next = ((target % count) + count) % count;

    if (next !== index) {
      const current = slides[index];
      current.classList.remove("is-active");
      current.setAttribute("aria-hidden", "true");
      current.inert = true;
      dots[index]?.classList.remove("is-active");
      dots[index]?.removeAttribute("aria-current");

      const incoming = slides[next];
      incoming.classList.add("is-active");
      incoming.removeAttribute("aria-hidden");
      incoming.inert = false;
      dots[next]?.classList.add("is-active");
      dots[next]?.setAttribute("aria-current", "true");

      index = next;
    }

    // Mỗi lần đổi banner: đếm lại trọn 5 giây
    clearTimeout(timer);
    timer = null;
    remaining = AUTOPLAY_MS;
    restartProgress();
    sync();
  }

  const next = () => goTo(index + 1);
  const prev = () => goTo(index - 1);

  /* ---------- Sự kiện: nút bấm ---------- */
  root.querySelector(".banner-arrow-prev")?.addEventListener("click", prev);
  root.querySelector(".banner-arrow-next")?.addEventListener("click", next);
  dots.forEach((dot) => dot.addEventListener("click", () => goTo(Number(dot.dataset.index))));

  toggleBtn?.addEventListener("click", () => {
    userStopped = !userStopped;
    if (!userStopped) {
      remaining = AUTOPLAY_MS;
      restartProgress();
    }
    sync();
  });

  /* ---------- Bàn phím: ← → Home End khi focus nằm trong slider ---------- */
  root.addEventListener("keydown", (e) => {
    if (!multi) return;
    const keyMap = { ArrowLeft: () => index - 1, ArrowRight: () => index + 1, Home: () => 0, End: () => count - 1 };
    const getTarget = keyMap[e.key];
    if (!getTarget) return;

    e.preventDefault();
    const onDot = e.target.classList?.contains("banner-dot");
    const inSlide = Boolean(e.target.closest?.(".banner-slide"));
    goTo(getTarget());
    // Giữ focus không bị "rơi" khi banner cũ bị ẩn (inert): đi theo chấm / nút của banner mới
    if (onDot) dots[index].focus();
    else if (inSlide) slides[index].querySelector(".banner-slide-cta")?.focus();
  });

  /* ---------- Rê chuột (chỉ chuột thật, không tính chạm tay) ---------- */
  root.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "mouse") return;
    hoverPaused = true;
    sync();
  });
  root.addEventListener("pointerleave", (e) => {
    if (e.pointerType !== "mouse") return;
    hoverPaused = false;
    sync();
  });

  /* ---------- Focus bằng bàn phím bên trong slider -> tạm dừng ---------- */
  const isKeyboardFocus = (el) => {
    try {
      return el.matches(":focus-visible");
    } catch {
      return true; // trình duyệt cũ không hỗ trợ :focus-visible -> coi như dùng bàn phím
    }
  };
  root.addEventListener("focusin", (e) => {
    focusPaused = isKeyboardFocus(e.target);
    sync();
  });
  root.addEventListener("focusout", (e) => {
    if (root.contains(e.relatedTarget)) return;
    focusPaused = false;
    sync();
  });

  /* ---------- Vuốt trên điện thoại ---------- */
  let touchStart = null;
  let suppressClick = false;

  viewport.addEventListener("touchstart", (e) => {
    if (!multi || e.touches.length !== 1) return;
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });

  viewport.addEventListener("touchend", (e) => {
    if (!touchStart) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;

    // Chỉ tính vuốt NGANG đủ dài - vuốt dọc là người dùng đang cuộn trang
    if (Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.2) {
      suppressClick = true; // vuốt xong không được tính là bấm vào banner
      setTimeout(() => { suppressClick = false; }, 350);
      if (dx < 0) next();
      else prev();
    }
  }, { passive: true });

  viewport.addEventListener("touchcancel", () => { touchStart = null; }, { passive: true });

  viewport.addEventListener("click", (e) => {
    if (!suppressClick) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  /* ---------- Sự kiện toàn trang (gỡ ra khi destroy) ---------- */
  const onVisibility = () => {
    if (!document.hidden) {
      remaining = AUTOPLAY_MS; // quay lại tab: đếm lại từ đầu cho khớp thanh tiến trình
      restartProgress();
    }
    sync();
  };

  /** Đổi ngôn ngữ: chỉ cập nhật chữ giao diện, giữ nguyên banner đang xem */
  const onLanguageChange = () => {
    root.setAttribute("aria-label", tx("region"));
    slides.forEach((slide, i) => slide.setAttribute("aria-label", tx("slide", { n: i + 1, total: count })));
    root.querySelectorAll("[data-banner-text]").forEach((el) => { el.textContent = tx(el.dataset.bannerText); });
    root.querySelector(".banner-arrow-prev")?.setAttribute("aria-label", tx("prev"));
    root.querySelector(".banner-arrow-next")?.setAttribute("aria-label", tx("next"));
    root.querySelector(".banner-dots")?.setAttribute("aria-label", tx("dots"));
    dots.forEach((dot, i) => dot.setAttribute("aria-label", tx("goTo", { n: i + 1, name: banners[i].tenbanner })));
    sync();
  };

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("languagechange", onLanguageChange);

  sync();

  return {
    get index() { return index; },
    get count() { return count; },
    goTo,
    next,
    prev,
    play() { userStopped = false; remaining = AUTOPLAY_MS; restartProgress(); sync(); },
    pause() { userStopped = true; sync(); },
    destroy() {
      clearTimeout(timer);
      timer = null;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("languagechange", onLanguageChange);
      instances.delete(host);
    },
  };
}

/**
 * Khởi tạo slider banner trong phần tử có id = hostId.
 * Section bao quanh (VD #banner-section) bị ẩn nếu không có banner nào hợp lệ.
 * @param {string} hostId
 * @returns {Promise<object|null>} bộ điều khiển slider, hoặc null nếu không dựng được
 */
export function initBannerSlider(hostId) {
  const host = document.getElementById(hostId);
  if (!host) return Promise.resolve(null);

  instances.get(host)?.destroy();
  const section = host.closest("section") || host;
  const loadToken = Symbol("banner-load");
  pendingLoads.set(host, loadToken);

  host.setAttribute("aria-busy", "true");
  host.innerHTML = `
    <div class="banner-slider banner-slider-loading" role="status">
      <span class="btn-spinner btn-spinner-lg" aria-hidden="true"></span>
      <span>${escapeHtml(tx("loading"))}</span>
    </div>`;

  return loadDisplayableBanners().then((banners) => {
    if (pendingLoads.get(host) !== loadToken) return null; // đã có lượt init mới hơn
    pendingLoads.delete(host);
    host.removeAttribute("aria-busy");

    if (banners.length === 0) {
      host.innerHTML = "";
      section.hidden = true;
      return null;
    }

    section.hidden = false;
    const controller = createSlider(host, banners);
    instances.set(host, controller);
    return controller;
  });
}

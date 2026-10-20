/* =========================================================
   MOTION3D.JS - Hệ thống chuyển động 3D tương tác toàn diện
   Công nghệ: 100% Vanilla JS ES6+ và CSS 3D Transforms
   (perspective, preserve-3d, rotateX, rotateY, translateZ)
   Tuân thủ nghiêm ngặt đề tài cuối khóa môn JavaScript:
   - Không sử dụng thư viện cấm (không React, không Three.js, không jQuery)
   - Tối ưu 60 FPS với requestAnimationFrame và will-change
   - Thân thiện thiết bị di động và tôn trọng prefers-reduced-motion
   ========================================================= */

const TILT_MAX_DEG = 14; // Góc nghiêng tối đa
const HERO_TILT_MAX = 8;  // Góc nghiêng Hero
const PARTICLES_COUNT = 45; // Số hạt bụi ánh sáng 3D

let isTouchDevice = false;
let prefersReducedMotion = false;
let particlesRunning = false;
let particleCanvas = null;
let particleCtx = null;
let particlesList = [];
let animFrameId = null;

const mouseGlobal = { x: 0, y: 0, targetX: 0, targetY: 0 };

/**
 * Kiểm tra thiết bị và tùy chọn giảm chuyển động
 */
function checkEnvironment() {
  isTouchDevice = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* =========================================================
   1. INTERACTIVE 3D CARD TILT & GLARE (Nghiêng 3D theo chuột)
   ========================================================= */

/**
 * Gắn hiệu ứng nghiêng 3D và vệt phản chiếu ánh sáng cho thẻ
 */
function bindCardTilt(card) {
  if (card.dataset.tiltBound) return;
  card.dataset.tiltBound = "true";

  card.classList.add("card-3d-tilt-target");

  // Tạo lớp phản chiếu ánh sáng (glare reflection)
  let glare = card.querySelector(".card-3d-glare");
  if (!glare) {
    glare = document.createElement("div");
    glare.className = "card-3d-glare";
    card.appendChild(glare);
  }

  let rafId = null;
  let targetRotX = 0;
  let targetRotY = 0;
  let currentRotX = 0;
  let currentRotY = 0;
  let glareX = 50;
  let glareY = 50;
  let glareOpacity = 0;
  let isHovered = false;

  function updateTransform() {
    if (!isHovered && Math.abs(currentRotX) < 0.05 && Math.abs(currentRotY) < 0.05) {
      card.style.transform = "";
      glare.style.opacity = "0";
      rafId = null;
      return;
    }

    currentRotX += (targetRotX - currentRotX) * 0.15;
    currentRotY += (targetRotY - currentRotY) * 0.15;

    card.style.transform = `perspective(1000px) rotateX(${currentRotX.toFixed(2)}deg) rotateY(${currentRotY.toFixed(2)}deg) translateZ(${isHovered ? 14 : 0}px) scale3d(${isHovered ? 1.025 : 1}, ${isHovered ? 1.025 : 1}, 1)`;
    glare.style.opacity = String(glareOpacity);
    glare.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 235, 190, 0.28) 0%, rgba(255, 255, 255, 0) 65%)`;

    rafId = requestAnimationFrame(updateTransform);
  }

  card.addEventListener("mouseenter", () => {
    if (prefersReducedMotion || isTouchDevice) return;
    isHovered = true;
    glareOpacity = 1;
    if (!rafId) rafId = requestAnimationFrame(updateTransform);
  });

  card.addEventListener("mousemove", (e) => {
    if (prefersReducedMotion || isTouchDevice) return;
    const rect = card.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const normX = (e.clientX - rect.left) / rect.width - 0.5;
    const normY = (e.clientY - rect.top) / rect.height - 0.5;

    targetRotY = normX * TILT_MAX_DEG;
    targetRotX = -normY * TILT_MAX_DEG;

    glareX = Math.round((normX + 0.5) * 100);
    glareY = Math.round((normY + 0.5) * 100);

    if (!rafId) rafId = requestAnimationFrame(updateTransform);
  });

  card.addEventListener("mouseleave", () => {
    isHovered = false;
    targetRotX = 0;
    targetRotY = 0;
    glareOpacity = 0;
    if (!rafId) rafId = requestAnimationFrame(updateTransform);
  });
}

/**
 * Quét và gắn hiệu ứng 3D Tilt cho các thẻ hiện có và thẻ tải động
 */
export function initCardTiltObserver() {
  if (prefersReducedMotion || isTouchDevice) return;

  const SELECTORS = [
    ".drink-card",
    ".spirit-card",
    ".bartender-card",
    ".collector-card",
    ".category-item",
    ".hero-stat",
    ".venue-feature-card",
    ".rank-card",
    ".contact-card",
    ".collector-bottle-item",
    ".spirit-bottle-card",
  ];

  function scanAndBind() {
    const selectorStr = SELECTORS.join(", ");
    document.querySelectorAll(selectorStr).forEach(bindCardTilt);
  }

  scanAndBind();

  // Theo dõi DOM khi có sản phẩm hoặc thẻ mới nạp qua API
  const observer = new MutationObserver(() => {
    scanAndBind();
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

/* =========================================================
   2. HERO 3D PARALLAX DEPTH (Chiều sâu 3D đa tầng tại Hero)
   ========================================================= */

export function initHero3DParallax() {
  if (prefersReducedMotion || isTouchDevice) return;

  const heroSections = document.querySelectorAll(".hero, .page-hero, .hero-cinematic");
  if (!heroSections.length) return;

  heroSections.forEach((hero) => {
    const backdrop = hero.querySelector(".hero-backdrop, .hero-bg");
    const tag = hero.querySelector(".hero-tag, .section-kicker");
    const title = hero.querySelector(".hero-title, .page-title, h1");
    const lead = hero.querySelector(".hero-lead, .page-lead");
    const actions = hero.querySelector(".hero-actions");
    const stats = hero.querySelector(".hero-stats");

    hero.classList.add("hero-3d-scene");

    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;
    let isMoving = false;
    let animId = null;

    function renderHero() {
      currentX += (targetX - currentX) * 0.1;
      currentY += (targetY - currentY) * 0.1;

      if (backdrop) {
        backdrop.style.transform = `scale(1.08) translate3d(${(-currentX * 16).toFixed(1)}px, ${(-currentY * 16).toFixed(1)}px, -30px)`;
      }
      if (tag) {
        tag.style.transform = `translate3d(${(currentX * 12).toFixed(1)}px, ${(currentY * 12).toFixed(1)}px, 15px)`;
      }
      if (title) {
        title.style.transform = `translate3d(${(currentX * 24).toFixed(1)}px, ${(currentY * 24).toFixed(1)}px, 35px) rotateY(${(currentX * HERO_TILT_MAX).toFixed(1)}deg) rotateX(${(-currentY * HERO_TILT_MAX).toFixed(1)}deg)`;
      }
      if (lead) {
        lead.style.transform = `translate3d(${(currentX * 16).toFixed(1)}px, ${(currentY * 16).toFixed(1)}px, 20px)`;
      }
      if (actions) {
        actions.style.transform = `translate3d(${(currentX * 28).toFixed(1)}px, ${(currentY * 28).toFixed(1)}px, 45px)`;
      }
      if (stats) {
        stats.style.transform = `perspective(1000px) rotateX(${(-currentY * 6).toFixed(1)}deg) rotateY(${(currentX * 6).toFixed(1)}deg) translateZ(25px)`;
      }

      if (isMoving || Math.abs(currentX) > 0.01 || Math.abs(currentY) > 0.01) {
        animId = requestAnimationFrame(renderHero);
      } else {
        animId = null;
      }
    }

    hero.addEventListener("mousemove", (e) => {
      const rect = hero.getBoundingClientRect();
      targetX = (e.clientX - rect.left) / rect.width - 0.5;
      targetY = (e.clientY - rect.top) / rect.height - 0.5;
      isMoving = true;
      if (!animId) animId = requestAnimationFrame(renderHero);
    });

    hero.addEventListener("mouseleave", () => {
      targetX = 0;
      targetY = 0;
      isMoving = false;
      if (!animId) animId = requestAnimationFrame(renderHero);
    });
  });
}

/* =========================================================
   3. AMBIENT 3D AMBER DUST PARTICLES (Hạt bụi vàng 3D lơ lửng)
   ========================================================= */

function createParticle(w, h, zMax) {
  return {
    x: (Math.random() - 0.5) * w * 1.5,
    y: (Math.random() - 0.5) * h * 1.5,
    z: Math.random() * zMax,
    vx: (Math.random() - 0.5) * 0.4,
    vy: -Math.random() * 0.5 - 0.2, // Bay lơ lửng hướng lên nhẹ
    vz: (Math.random() - 0.5) * 0.3,
    size: Math.random() * 2 + 1,
    alpha: Math.random() * 0.6 + 0.2,
    color: Math.random() > 0.3 ? "#e8c682" : "#c59843",
  };
}

export function initAmbient3DParticles() {
  if (prefersReducedMotion || document.getElementById("ambient-3d-canvas")) return;

  particleCanvas = document.createElement("canvas");
  particleCanvas.id = "ambient-3d-canvas";
  particleCanvas.className = "ambient-3d-canvas";
  particleCanvas.setAttribute("aria-hidden", "true");
  document.body.prepend(particleCanvas);

  particleCtx = particleCanvas.getContext("2d");
  if (!particleCtx) return;

  let width = (particleCanvas.width = window.innerWidth);
  let height = (particleCanvas.height = window.innerHeight);
  const zMax = 800;
  const fov = 400;

  function resize() {
    width = particleCanvas.width = window.innerWidth;
    height = particleCanvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize, { passive: true });

  particlesList = [];
  const count = isTouchDevice ? 20 : PARTICLES_COUNT;
  for (let i = 0; i < count; i++) {
    particlesList.push(createParticle(width, height, zMax));
  }

  particlesRunning = true;

  function draw() {
    if (!particlesRunning) return;

    particleCtx.clearRect(0, 0, width, height);

    mouseGlobal.x += (mouseGlobal.targetX - mouseGlobal.x) * 0.05;
    mouseGlobal.y += (mouseGlobal.targetY - mouseGlobal.y) * 0.05;

    const centerX = width / 2;
    const centerY = height / 2;

    for (let i = 0; i < particlesList.length; i++) {
      const p = particlesList[i];

      p.x += p.vx + mouseGlobal.x * 0.3;
      p.y += p.vy;
      p.z += p.vz;

      // Giới hạn không gian lặp lại
      if (p.y < -height * 0.75) p.y = height * 0.75;
      if (p.z <= 0) p.z = zMax;
      if (p.z > zMax) p.z = 1;

      // Chiếu phối cảnh 3D (3D Perspective Projection)
      const scale = fov / (fov + p.z);
      const projX = centerX + p.x * scale;
      const projY = centerY + p.y * scale;
      const projR = Math.max(0.6, p.size * scale);

      if (projX > -20 && projX < width + 20 && projY > -20 && projY < height + 20) {
        particleCtx.beginPath();
        particleCtx.arc(projX, projY, projR, 0, Math.PI * 2);
        particleCtx.fillStyle = p.color;
        particleCtx.globalAlpha = p.alpha * scale;
        particleCtx.shadowBlur = 8 * scale;
        particleCtx.shadowColor = p.color;
        particleCtx.fill();
      }
    }

    particleCtx.globalAlpha = 1;
    particleCtx.shadowBlur = 0;

    animFrameId = requestAnimationFrame(draw);
  }

  animFrameId = requestAnimationFrame(draw);

  // Lắng nghe di chuyển chuột toàn trang để tạo luồng khí 3D
  window.addEventListener("mousemove", (e) => {
    mouseGlobal.targetX = (e.clientX / width - 0.5) * 1.5;
    mouseGlobal.targetY = (e.clientY / height - 0.5) * 1.5;
  }, { passive: true });

  // Tạm dừng khi tab bị ẩn để tiết kiệm pin/CPU
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      particlesRunning = false;
      if (animFrameId) cancelAnimationFrame(animFrameId);
    } else {
      particlesRunning = true;
      animFrameId = requestAnimationFrame(draw);
    }
  });
}

/* =========================================================
   4. SCROLL 3D REVEAL (Hiệu ứng cuộn trang 3D nổi khối)
   ========================================================= */

export function initScroll3DReveal() {
  if (prefersReducedMotion) return;

  const TARGET_SELECTORS = [
    ".section-head",
    ".drink-grid",
    ".category-strip",
    ".lounge3d-wrapper",
    ".section-craft",
    ".section-bartenders",
    ".bartender-grid",
    ".collector-grid",
    ".spirits-grid",
    ".venue-features",
    ".booking-form-box",
    ".order-summary-box",
    ".contact-grid",
    ".faq-accordion",
    ".about-split",
  ];

  const observerOptions = {
    root: null,
    rootMargin: "0px 0px -60px 0px",
    threshold: 0.1,
  };

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view-3d");
        obs.unobserve(entry.target);
      }
    });
  }, observerOptions);

  function applyScrollTargets() {
    TARGET_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (!el.classList.contains("scroll-3d-item")) {
          el.classList.add("scroll-3d-item");
          observer.observe(el);
        }
      });
    });
  }

  applyScrollTargets();

  // Kiểm tra thêm các phần tử nạp động
  const domObs = new MutationObserver(() => {
    applyScrollTargets();
  });
  domObs.observe(document.body, { childList: true, subtree: true });
}

/* =========================================================
   5. KHỞI TẠO TỔNG THỂ HỆ THỐNG 3D MOTION
   ========================================================= */

export function init3DMotion() {
  checkEnvironment();
  initAmbient3DParticles();
  initHero3DParallax();
  initCardTiltObserver();
  initScroll3DReveal();
}

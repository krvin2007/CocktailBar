/* =========================================================
   NAVBAR.JS - Header + Footer dùng chung cho các trang khách
   Render thanh điều hướng tối giản, cao cấp theo chuẩn nhà hàng & lounge.
   Tích hợp nút chuyển đổi ngôn ngữ VI (Tiếng Việt) & EN (English).
   ========================================================= */

import "./ui.js"; // đăng ký banner cảnh báo khi máy chủ API chưa chạy
import "./chatWidget.js"; // Trợ lý AI dạng khung chat nổi - tự khởi tạo trên mọi trang khách
import { getCartSummary } from "./ordersService.js";
import { getCurrentCustomer } from "./customerAuth.js";
import { ICONS } from "./icons.js";
import { escapeHtml } from "./utils.js";
import { getCurrentLang, setLanguage, toggleLanguage, t, applyI18n } from "./i18n.js";

function getNavLinks() {
  return [
    { href: "index.html", label: t("nav_home", "Trang chủ") },
    { href: "menu.html", label: t("nav_menu", "Menu") },
    { href: "sale.html", label: t("nav_sale", "Khuyến mãi") },
    { href: "spirits.html", label: t("nav_spirits", "Hầm Rượu") },
    { href: "bartenders.html", label: t("nav_bartenders", "Master Bartenders") },
    { href: "collectors.html", label: t("nav_collectors", "Nhà Sưu Tầm") },
    { href: "order.html", label: t("nav_order", "Đặt bàn & Gọi món") },
    { href: "contact.html", label: t("nav_contact", "Liên hệ") },
  ];
}

function currentPage() {
  const path = window.location.pathname.split("/").pop() || "index.html";
  return path;
}

export function renderHeader() {
  const header = document.getElementById("site-header");
  if (!header) return;

  const page = currentPage();
  const { count } = getCartSummary();
  const currentLang = getCurrentLang();
  const navLinks = getNavLinks();
  const customer = getCurrentCustomer();
  // Tên hiển thị ngắn gọn: chỉ lấy tên gọi (từ cuối) để nút không bị tràn
  const customerShortName = customer ? String(customer.name || "").trim().split(/\s+/).pop() : "";

  const linksHtml = navLinks.map((link) => `
    <li>
      <a href="${link.href}" class="${link.href === page ? "active" : ""}">
        ${link.label}
        ${link.href === "order.html" && count > 0 ? `<span class="nav-badge">${count}</span>` : ""}
      </a>
    </li>`).join("");

  header.innerHTML = `
    <div class="header-inner">
      <a href="index.html" class="brand">
        <span class="brand-icon">${ICONS.cocktail(22)}</span>
        <div class="brand-text">
          <span class="brand-title">${t("brand_title", "Quán Bar Đêm")}</span>
          <span class="brand-subtitle">${t("brand_subtitle", "Artisan Cocktail Lounge")}</span>
        </div>
      </a>

      <div class="header-mobile-tools">
        <div class="lang-switcher">
          <button type="button" class="lang-toggle-btn" id="lang-toggle-mobile" aria-label="Đổi ngôn ngữ VI / EN" title="${currentLang === "vi" ? "Switch to English (EN)" : "Chuyển sang Tiếng Việt (VI)"}">
            <span class="lang-code ${currentLang === "vi" ? "active" : ""}" data-lang="vi">VI</span>
            <span class="lang-divider">/</span>
            <span class="lang-code ${currentLang === "en" ? "active" : ""}" data-lang="en">EN</span>
          </button>
        </div>
        <button type="button" class="nav-toggle" id="nav-toggle" aria-label="Mở menu">
          <span></span><span></span>
        </button>
      </div>

      <nav class="main-nav" id="main-nav">
        <ul>${linksHtml}</ul>
        <div class="nav-actions">
          <!-- Nút đổi ngôn ngữ VI & EN -->
          <div class="lang-switcher">
            <button type="button" class="lang-toggle-btn" id="lang-toggle-btn" aria-label="Đổi ngôn ngữ VI / EN" title="${currentLang === "vi" ? "Switch to English (EN)" : "Chuyển sang Tiếng Việt (VI)"}">
              <span class="lang-code ${currentLang === "vi" ? "active" : ""}" data-lang="vi">VI</span>
              <span class="lang-divider">/</span>
              <span class="lang-code ${currentLang === "en" ? "active" : ""}" data-lang="en">EN</span>
            </button>
          </div>

          <a href="order.html" class="btn btn-cart" title="${t("cart_title", "Xem giỏ hàng")}">
            ${ICONS.shoppingBag(17)}
            ${count > 0 ? `<span class="cart-count-dot">${count}</span>` : ""}
          </a>
          <a href="account.html" class="btn btn-ghost btn-sm nav-account-link ${page === "account.html" ? "active" : ""}"
             title="${customer ? escapeHtml(customer.name) : t("nav_account_title", "Đăng nhập / Đăng ký thành viên")}">
            ${ICONS.user(14)}
            <span>${customer ? escapeHtml(customerShortName) : t("nav_account", "Thành viên")}</span>
          </a>
          <a href="admin-login.html" class="btn btn-ghost btn-sm nav-admin-link">${t("nav_admin", "Quản trị")}</a>
        </div>
      </nav>
    </div>`;

  // Sự kiện toggle mobile menu
  const toggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("main-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      nav.classList.toggle("open");
      toggle.classList.toggle("open");
    });
  }

  // Sự kiện chuyển đổi ngôn ngữ
  header.querySelectorAll(".lang-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const targetLang = e.target.closest("[data-lang]")?.dataset?.lang;
      if (targetLang) {
        setLanguage(targetLang);
      } else {
        toggleLanguage();
      }
    });
  });
}

export function renderFooter() {
  const footer = document.getElementById("site-footer");
  if (!footer) return;

  const currentLang = getCurrentLang();

  footer.innerHTML = `
    <div class="footer-inner">
      <div class="footer-brand">
        <div class="brand">
          <span class="brand-icon">${ICONS.cocktail(24)}</span>
          <span class="brand-title">${t("brand_title", "Quán Bar Đêm")}</span>
        </div>
        <p class="footer-desc">
          ${t("footer_desc")}
        </p>
        <div class="footer-badges">
          <span class="footer-badge">${t("footer_badge_speakeasy")}</span>
          <span class="footer-badge">${t("footer_badge_cocktails")}</span>
          <span class="footer-badge">${t("footer_badge_jazz")}</span>
        </div>
      </div>

      <div class="footer-col">
        <h4>${t("footer_col_experience")}</h4>
        <a href="menu.html">${t("footer_link_menu")}</a>
        <a href="sale.html">${t("footer_link_sale", "Khuyến mãi & Mã giảm giá")}</a>
        <a href="account.html">${t("footer_link_account", "Thành viên & Quà sinh nhật")}</a>
        <a href="spirits.html">${t("footer_link_spirits")}</a>
        <a href="bartenders.html">${t("footer_link_bartenders")}</a>
        <a href="collectors.html">${t("footer_link_collectors")}</a>
        <a href="order.html">${t("footer_link_order")}</a>
        <a href="contact.html">${t("footer_link_contact")}</a>
      </div>

      <div class="footer-col">
        <h4>${t("footer_col_info")}</h4>
        <p class="footer-info-row">
          <span class="info-icon">${ICONS.mapPin(15)}</span>
          <span>${t("footer_address")}</span>
        </p>
        <p class="footer-info-row">
          <span class="info-icon">${ICONS.phone(15)}</span>
          <span>(028) 1234 5678 · 090 123 4567</span>
        </p>
        <p class="footer-info-row">
          <span class="info-icon">${ICONS.clock(15)}</span>
          <span>${t("footer_hours")}</span>
        </p>
      </div>
    </div>

    <div class="footer-bottom">
      <p class="footer-warning">
        ${currentLang === "en" ? "Please Drink Responsibly — Alcoholic beverages are strictly for guests aged 18 and older. Never drive under the influence of alcohol." : "Uống có trách nhiệm — Đồ uống có cồn chỉ phục vụ khách từ 18 tuổi trở lên. Tuyệt đối không lái xe sau khi đã uống rượu bia."}
      </p>
      <p class="footer-credits">
        ${currentLang === "en" ? "Visual credits: all drink, bottle, lounge and portrait images were generated with Google AI. Portraits of real people are illustrations only, not actual photos of them. Trademarks belong to their respective owners, used for educational demonstration." : "Nguồn hình ảnh: toàn bộ ảnh đồ uống, chai rượu, không gian quán và chân dung nhân vật được tạo bằng AI (Google). Chân dung các nhân vật có thật chỉ là ảnh minh hoạ, không phải ảnh thật của họ. Tên thương hiệu thuộc về chủ sở hữu, chỉ dùng cho mục đích học tập. Thông tin về các nhân vật và thương hiệu có thật được tổng hợp để minh hoạ cho đồ án, có thể chưa chính xác tuyệt đối."}
      </p>
      <div class="footer-copy-wrap">
        <span>© 2026 ${t("brand_title", "Quán Bar Đêm")} · ${t("footer_tagline")}</span>
        <a href="admin-login.html" class="footer-admin-link">${t("footer_admin")}</a>
      </div>
    </div>`;
}

/** Cập nhật lại số huy hiệu giỏ hàng */
export function refreshCartBadge() {
  const badge = document.querySelector('a[href="order.html"] .nav-badge');
  const cartDot = document.querySelector(".cart-count-dot");
  const { count } = getCartSummary();

  if (badge) {
    if (count > 0) badge.textContent = count;
    else badge.remove();
  }

  if (cartDot) {
    if (count > 0) cartDot.textContent = count;
    else cartDot.remove();
  } else if (count > 0) {
    renderHeader();
  }
}

// Giỏ hàng đổi ở bất kỳ đâu (trang món, khung chat AI...) -> cập nhật huy hiệu số ly
window.addEventListener("cartchange", () => refreshCartBadge());

// Khách đăng nhập / đăng xuất / đăng ký -> vẽ lại header để đổi nút "Thành viên"
window.addEventListener("customerchange", () => {
  renderHeader();
  applyI18n();
});

// Lắng nghe sự kiện thay đổi ngôn ngữ từ bất kỳ đâu trên trang
window.addEventListener("languagechange", () => {
  renderHeader();
  renderFooter();
  applyI18n();
});

document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  renderFooter();
  applyI18n();
});

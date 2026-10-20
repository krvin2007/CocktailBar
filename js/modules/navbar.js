/* =========================================================
   NAVBAR.JS - Header + Footer dùng chung cho các trang khách
   Render thanh điều hướng tối giản, cao cấp theo chuẩn nhà hàng & lounge.
   Tích hợp nút chuyển đổi ngôn ngữ VI (Tiếng Việt) & EN (English).
   ========================================================= */

import "./ui.js"; // đăng ký banner cảnh báo khi máy chủ API chưa chạy
import { openModal, closeModal, toast } from "./ui.js";
import { getCartSummary } from "./ordersService.js";
import { ICONS } from "./icons.js";
import { getCurrentLang, setLanguage, toggleLanguage, t, applyI18n } from "./i18n.js";
import { escapeHtml } from "./utils.js";
import {
  getCurrentCustomer, customerLogout, customerRegister, syncCustomerSession,
} from "./customerAuth.js";
import { passwordProblem, PASSWORD_RULE_TEXT } from "./passwords.js";
import { rankForPoints, lifetimeOf } from "./customerAuth.js";
import { ageProblem } from "./age.js";
import { signIn, currentAdmin, logout as staffLogout, homePageFor } from "./auth.js";
import { renderChatbotWidget } from "./chatbot.js";
import { initAgeGate } from "./ageGate.js";

function getNavLinks() {
  return [
    { href: "index.html", label: t("nav_home", "Trang chủ") },
    { href: "menu.html", label: t("nav_menu", "Menu") },
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
  // Mỗi trình duyệt chỉ giữ một danh tính: nhân sự/quản trị (phiên admin) hoặc khách hàng
  const staff = currentAdmin();
  const customer = staff ? null : getCurrentCustomer();
  const account = staff || customer;

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
        <!-- Nút tài khoản trên mobile -->
        <button type="button" class="btn btn-ghost btn-sm mobile-auth-btn" id="mobile-auth-btn" aria-label="Tài khoản" title="${account ? `Tài khoản: ${escapeHtml(account.name)}` : "Đăng nhập / Đăng ký"}">
          ${ICONS.user(18)}
          ${account ? `<span class="user-active-dot"></span>` : ""}
        </button>

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

          <!-- Nút giỏ hàng -->
          <a href="order.html" class="btn btn-cart" title="${t("cart_title", "Xem giỏ hàng")}">
            ${ICONS.shoppingBag(17)}
            ${count > 0 ? `<span class="cart-count-dot">${count}</span>` : ""}
          </a>

          <!-- Nút Tài khoản: nhân sự / khách hàng / chưa đăng nhập -->
          ${staff ? `
            <div class="customer-nav-dropdown" id="customer-nav-dropdown">
              <button type="button" class="btn btn-customer-account" id="btn-customer-menu-toggle" aria-expanded="false" title="${escapeHtml(staff.roleLabel || "Quản trị")}: ${escapeHtml(staff.name)}">
                ${ICONS.user(15)}
                <span class="customer-nav-name">${escapeHtml(staff.name.split(" ").slice(-2).join(" "))}</span>
                <svg class="dropdown-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div class="customer-dropdown-menu" id="customer-dropdown-menu" hidden>
                <div class="customer-dropdown-header">
                  <div class="customer-dropdown-name">${escapeHtml(staff.name)}</div>
                  <div class="customer-dropdown-tier">${escapeHtml(staff.roleLabel || "Quản trị viên")}</div>
                </div>
                <div class="customer-dropdown-divider"></div>
                <a href="${homePageFor(staff)}" class="customer-dropdown-item">
                  ${ICONS.user(14)}
                  <span>Vào trang quản trị</span>
                </a>
                <button type="button" class="customer-dropdown-item btn-customer-logout" id="btn-logout-staff">
                  ${ICONS.arrowRight(14)}
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          ` : customer ? `
            <div class="customer-nav-dropdown" id="customer-nav-dropdown">
              <button type="button" class="btn btn-customer-account" id="btn-customer-menu-toggle" aria-expanded="false" title="Khách hàng: ${escapeHtml(customer.name)}">
                ${ICONS.user(15)}
                <span class="customer-nav-name">${escapeHtml(customer.name.split(" ").slice(-2).join(" "))}</span>
                <svg class="dropdown-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div class="customer-dropdown-menu" id="customer-dropdown-menu" hidden>
                <div class="customer-dropdown-header">
                  <div class="customer-dropdown-name">${escapeHtml(customer.name)}</div>
                  <div class="customer-dropdown-tier">${escapeHtml(t("rank_" + rankForPoints(lifetimeOf(customer)).key, customer.tier))} · ${customer.points || 0} ${t("acc_pts", "điểm")}</div>
                  ${customer.phone ? `<div class="customer-dropdown-phone text-xs text-muted">${escapeHtml(customer.phone)}</div>` : ""}
                </div>
                <div class="customer-dropdown-divider"></div>
                <a href="customer-account.html" class="customer-dropdown-item">
                  ${ICONS.sparkle(14)}
                  <span>${t("acc_menu_link", "Hạng & điểm thưởng").replace("&", "&amp;")}</span>
                </a>
                <a href="order.html" class="customer-dropdown-item">
                  ${ICONS.shoppingBag(14)}
                  <span>Đặt bàn &amp; Gọi món</span>
                </a>
                <button type="button" class="customer-dropdown-item btn-customer-logout" id="btn-logout-customer">
                  ${ICONS.arrowRight(14)}
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          ` : `
            <button type="button" class="btn btn-ghost btn-sm nav-customer-btn" id="open-customer-auth-btn" title="Đăng nhập hoặc đăng ký thành viên khách hàng">
              ${ICONS.user(15)}
              <span>${t("nav_login", "Đăng nhập")}</span>
            </button>
          `}

        </div>
      </nav>
    </div>`;

  // Gắn sự kiện modal auth khách hàng
  ensureCustomerAuthModal();

  // Sự kiện mở modal đăng nhập khách hàng
  const openAuthBtn = document.getElementById("open-customer-auth-btn");
  if (openAuthBtn) {
    openAuthBtn.addEventListener("click", () => {
      openCustomerAuthModal("login");
    });
  }

  // Sự kiện nút tài khoản trên mobile
  const mobileAuthBtn = document.getElementById("mobile-auth-btn");
  if (mobileAuthBtn) {
    mobileAuthBtn.addEventListener("click", () => {
      if (account) {
        // Toggle dropdown hoặc mở order
        const dropdown = document.getElementById("customer-dropdown-menu");
        if (dropdown) dropdown.hidden = !dropdown.hidden;
        else openCustomerAuthModal("login");
      } else {
        openCustomerAuthModal("login");
      }
    });
  }

  // Sự kiện toggle dropdown tài khoản khách hàng
  const menuToggle = document.getElementById("btn-customer-menu-toggle");
  const dropdownMenu = document.getElementById("customer-dropdown-menu");
  if (menuToggle && dropdownMenu) {
    menuToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = dropdownMenu.hidden;
      dropdownMenu.hidden = !isHidden;
      menuToggle.setAttribute("aria-expanded", String(isHidden));
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest("#customer-nav-dropdown")) {
        dropdownMenu.hidden = true;
        menuToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  // Sự kiện đăng xuất khách hàng
  const logoutBtn = document.getElementById("btn-logout-customer");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      customerLogout();
      toast("Đã đăng xuất tài khoản khách hàng.", "info");
      renderHeader();
    });
  }

  // Sự kiện đăng xuất nhân sự / quản trị
  const logoutStaffBtn = document.getElementById("btn-logout-staff");
  if (logoutStaffBtn) {
    logoutStaffBtn.addEventListener("click", () => {
      staffLogout();
      toast("Đã đăng xuất.", "info");
      renderHeader();
    });
  }

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

/** Đảm bảo modal đăng nhập / đăng ký khách hàng tồn tại trong DOM */
export function ensureCustomerAuthModal() {
  if (typeof document === "undefined" || !document.body) return;

  let modal = document.getElementById("customer-auth-modal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "customer-auth-modal";
  modal.className = "modal-overlay";
  modal.hidden = true;

  modal.innerHTML = `
    <div class="modal-box modal-customer-auth">
      <div class="modal-head">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--gold-primary);">${ICONS.cocktail(20)}</span>
          <h3 id="customer-modal-title" style="margin: 0;" data-i18n="auth_popup_title">Khách Hàng Thân Thiết</h3>
        </div>
        <button type="button" class="modal-close-x" id="btn-close-customer-auth" aria-label="Đóng cửa sổ">✕</button>
      </div>

      <div class="modal-body" style="padding: 16px 20px 24px;">
        <!-- Tabs chuyển đổi Đăng nhập / Đăng ký -->
        <div class="cust-auth-tabs">
          <button type="button" class="cust-tab-btn active" data-target="login" data-i18n="auth_tab_login">Đăng Nhập</button>
          <button type="button" class="cust-tab-btn" data-target="register" data-i18n="auth_tab_register">Đăng Ký Mới</button>
        </div>

        <!-- TAB 1: FORM ĐĂNG NHẬP KHÁCH HÀNG -->
        <div id="cust-pane-login" class="cust-pane active">
          <p class="text-xs text-muted mb-2" data-i18n="auth_popup_hint_login">Một form cho tất cả: hệ thống tự nhận biết bạn là khách hàng hay nhân viên quán.</p>
          <form id="cust-form-login" novalidate>
            <div class="form-group mb-2">
              <label><span data-i18n="auth_lbl_ident">Tên đăng nhập, Số điện thoại hoặc Email</span> <span class="req">*</span></label>
              <input type="text" id="cust-login-ident" placeholder="Tên đăng nhập, SĐT hoặc email" data-i18n-placeholder="auth_ph_ident" autocomplete="username">
            </div>
            <div class="form-group mb-2">
              <label><span data-i18n="auth_lbl_regpass">Mật khẩu</span> <span class="req">*</span></label>
              <div class="pw-input-wrap">
                <input type="password" id="cust-login-pass" placeholder="••••••••" autocomplete="current-password">
                <button type="button" class="pw-toggle-btn" data-target="cust-login-pass" aria-label="Hiện hoặc ẩn mật khẩu">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
            </div>
            <button type="submit" class="btn btn-primary btn-block btn-lg mt-2" id="btn-submit-cust-login">
              <span data-i18n="auth_btn_login">Đăng nhập</span>
              ${ICONS.arrowRight(16)}
            </button>
          </form>
        </div>

        <!-- TAB 2: FORM ĐĂNG KÝ THÀNH VIÊN KHÁCH HÀNG -->
        <div id="cust-pane-register" class="cust-pane" hidden>
          <p class="text-xs text-muted mb-2" data-i18n="auth_popup_hint_register">Trở thành thành viên Quán Bar Đêm — Nhận ngay 20 điểm tích luỹ chào mừng.</p>
          <form id="cust-form-register" novalidate>
            <div class="form-group mb-2">
              <label><span data-i18n="auth_lbl_name">Họ và tên quý khách</span> <span class="req">*</span></label>
              <input type="text" id="cust-reg-name" placeholder="VD: Trần Thị Mai" data-i18n-placeholder="auth_ph_name" autocomplete="name">
            </div>
            <div class="form-group mb-2">
              <label><span data-i18n="auth_lbl_phone">Số điện thoại liên lạc</span> <span class="req">*</span></label>
              <input type="tel" id="cust-reg-phone" placeholder="VD: 0987 654 321" autocomplete="tel">
              <small class="text-xs text-muted" data-i18n="auth_phone_hint">Dùng để nhận diện đặt bàn và tích điểm</small>
            </div>
            <div class="form-group mb-2">
              <label data-i18n="auth_lbl_email">Email liên hệ</label>
              <input type="email" id="cust-reg-email" placeholder="nam.nguyen@gmail.com" autocomplete="email">
            </div>
            <div class="form-group mb-2">
              <label for="cust-reg-birth"><span data-i18n="auth_lbl_birth">Ngày sinh</span> <span class="req">*</span></label>
              <input type="date" id="cust-reg-birth" autocomplete="bday">
              <small class="text-xs text-muted" data-i18n="auth_birth_hint">Thành viên phải từ 18 tuổi trở lên. Quán sẽ đối chiếu CCCD khi quý khách đến.</small>
            </div>
            <div class="form-group mb-2">
              <label><span data-i18n="auth_lbl_regpass">Mật khẩu</span> <span class="req">*</span></label>
              <div class="pw-input-wrap">
                <input type="password" id="cust-reg-pass" placeholder="Tối thiểu 8 ký tự, chữ đầu viết hoa, có ký tự đặc biệt" data-i18n-placeholder="auth_ph_regpass" autocomplete="new-password">
                <button type="button" class="pw-toggle-btn" data-target="cust-reg-pass" aria-label="Hiện hoặc ẩn mật khẩu">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
            </div>
            <div class="form-group mb-2">
              <label><span data-i18n="auth_lbl_confirm">Nhập lại mật khẩu</span> <span class="req">*</span></label>
              <div class="pw-input-wrap">
                <input type="password" id="cust-reg-pass-confirm" placeholder="Nhập lại mật khẩu trên" data-i18n-placeholder="auth_ph_confirm" autocomplete="new-password">
                <button type="button" class="pw-toggle-btn" data-target="cust-reg-pass-confirm" aria-label="Hiện hoặc ẩn mật khẩu">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
            </div>
            <button type="submit" class="btn btn-primary btn-block btn-lg mt-2" id="btn-submit-cust-reg">
              <span data-i18n="auth_btn_register">Tạo tài khoản thành viên</span>
              ${ICONS.arrowRight(16)}
            </button>
          </form>
        </div>
      </div>
    </div>`;

  document.body.appendChild(modal);

  // Gắn sự kiện đóng modal
  const closeBtn = modal.querySelector("#btn-close-customer-auth");
  if (closeBtn) closeBtn.onclick = () => closeModal("customer-auth-modal");

  // Sự kiện chuyển tab
  modal.querySelectorAll(".cust-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.target;
      modal.querySelectorAll(".cust-tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const paneLogin = modal.querySelector("#cust-pane-login");
      const paneReg = modal.querySelector("#cust-pane-register");
      if (target === "login") {
        paneLogin.hidden = false;
        paneLogin.classList.add("active");
        paneReg.hidden = true;
        paneReg.classList.remove("active");
      } else {
        paneReg.hidden = false;
        paneReg.classList.add("active");
        paneLogin.hidden = true;
        paneLogin.classList.remove("active");
      }
    });
  });

  // Sự kiện ẩn/hiện mật khẩu
  modal.querySelectorAll(".pw-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const input = modal.querySelector(`#${targetId}`);
      if (input) {
        input.type = input.type === "password" ? "text" : "password";
      }
    });
  });

  // Xử lý submit Login
  const loginForm = modal.querySelector("#cust-form-login");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const ident = modal.querySelector("#cust-login-ident")?.value?.trim();
      const pass = modal.querySelector("#cust-login-pass")?.value;

      if (!ident) {
        toast("Vui lòng nhập Tên đăng nhập, Số điện thoại hoặc Email.", "warning");
        return;
      }
      if (!pass) {
        toast("Vui lòng nhập Mật khẩu.", "warning");
        return;
      }

      const res = await signIn(ident, pass);
      if (res.success && res.kind === "staff") {
        // Hệ thống nhận ra đây là tài khoản nhân sự/quản trị -> vào trang quản trị đúng vai trò
        toast(`Chào mừng ${res.user.name} (${res.user.roleLabel})! Đang chuyển đến trang quản trị...`, "success");
        closeModal("customer-auth-modal");
        setTimeout(() => { window.location.href = homePageFor(res.user); }, 500);
      } else if (res.success) {
        toast(`Chào mừng ${res.user.name}! Đăng nhập thành công.`, "success");
        closeModal("customer-auth-modal");
        renderHeader();
      } else {
        toast(res.message, "danger");
      }
    });
  }

  // Xử lý submit Register
  const regForm = modal.querySelector("#cust-form-register");
  if (regForm) {
    regForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = modal.querySelector("#cust-reg-name")?.value?.trim();
      const phone = modal.querySelector("#cust-reg-phone")?.value?.trim();
      const email = modal.querySelector("#cust-reg-email")?.value?.trim();
      const pass = modal.querySelector("#cust-reg-pass")?.value;
      const passConfirm = modal.querySelector("#cust-reg-pass-confirm")?.value;
      const birthDate = modal.querySelector("#cust-reg-birth")?.value;

      if (!name || name.length < 2) {
        toast("Vui lòng nhập Họ và tên (ít nhất 2 ký tự).", "warning");
        return;
      }
      if (!phone) {
        toast("Vui lòng nhập Số điện thoại liên lạc.", "warning");
        return;
      }
      if (ageProblem(birthDate)) {
        toast(ageProblem(birthDate), "warning");
        return;
      }
      if (!pass || passwordProblem(pass)) {
        toast(PASSWORD_RULE_TEXT, "warning");
        return;
      }
      if (pass !== passConfirm) {
        toast("Mật khẩu xác nhận không trùng khớp.", "warning");
        return;
      }

      const res = await customerRegister({ name, phone, email, password: pass, birthDate });
      if (res.success) {
        toast(`Đăng ký thành công! Chào mừng quý khách ${res.customer.name}.`, "success");
        closeModal("customer-auth-modal");
        renderHeader();
      } else {
        toast(res.message, "danger");
      }
    });
  }

  return modal;
}

/** Mở modal auth khách hàng và kích hoạt tab mong muốn ('login' hoặc 'register') */
export function openCustomerAuthModal(tab = "login") {
  ensureCustomerAuthModal();
  const modal = document.getElementById("customer-auth-modal");
  if (modal) {
    const tabBtn = modal.querySelector(`.cust-tab-btn[data-target="${tab}"]`);
    if (tabBtn) tabBtn.click();
    openModal("customer-auth-modal");
  }
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
          <a href="tel:0397062429" style="color: inherit; text-decoration: none;">(028) 1234 5678 · 0397 062 429</a>
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
      </div>
    </div>`;
}

/** Cuộn xuống quá ngưỡng này (px) thì mới hiện nút "Lên đầu trang" */
const BACK_TO_TOP_THRESHOLD = 300;

/** Bật/tắt nút "Lên đầu trang" theo vị trí cuộn hiện tại */
function updateBackToTopVisibility() {
  const btn = document.getElementById("floating-btn-back-to-top");
  if (btn) btn.classList.toggle("is-visible", window.scrollY > BACK_TO_TOP_THRESHOLD);
}

let backToTopListenerBound = false;

/** Render thanh nút liên hệ nhanh nổi (Messenger, Phone, Zalo, Back-to-top) */
export function renderFloatingContactWidget() {
  if (typeof document === "undefined" || !document.body) return;

  let widget = document.getElementById("floating-contact-widget");
  if (!widget) {
    widget = document.createElement("div");
    widget.id = "floating-contact-widget";
    widget.className = "floating-contact-widget";
    document.body.appendChild(widget);
  }

  const isEn = getCurrentLang() === "en";

  widget.innerHTML = `
    <!-- 1. Nút Chatbot Bartender ảo -->
    <button type="button"
            class="floating-contact-btn floating-btn-chatbot"
            id="bar-chatbot-toggle-btn"
            aria-label="${isEn ? "Chat with Virtual Bartender" : "Trò chuyện với Bartender ảo"}"
            title="${isEn ? "Virtual Bartender" : "Trợ lý Bartender ảo"}">
      <span class="floating-btn-pulse"></span>
      <span class="floating-btn-tooltip">${isEn ? "Virtual Bartender" : "Trợ lý Bartender ảo"}</span>
      <span class="floating-chatbot-icon">🍸</span>
    </button>

    <!-- 2. Nút Facebook / Messenger -->
    <a href="https://www.facebook.com/jayz0904?locale=vi_VN"
       target="_blank"
       rel="noopener noreferrer"
       class="floating-contact-btn floating-btn-fb"
       aria-label="${isEn ? "Facebook / Messenger" : "Chat Facebook / Messenger"}"
       title="Facebook: jayz0904">
      <span class="floating-btn-tooltip">${isEn ? "Facebook / Messenger" : "Facebook: jayz0904"}</span>
      <svg class="floating-btn-icon" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.13 2 11.22c0 2.9 1.45 5.49 3.73 7.18v3.6l3.43-1.88c.9.25 1.86.39 2.84.39 5.52 0 10-4.13 10-9.22S17.52 2 12 2zm1.05 12.39l-2.67-2.85-5.21 2.85 5.73-6.09 2.73 2.85 5.15-2.85-5.73 6.09z"/>
      </svg>
    </a>

    <!-- 2. Nút Gọi điện thoại -->
    <a href="tel:0397062429"
       class="floating-contact-btn floating-btn-phone"
       aria-label="${isEn ? "Call Hotline: 0397 062 429" : "Gọi Hotline: 0397 062 429"}"
       title="Hotline: 0397 062 429">
      <span class="floating-btn-pulse"></span>
      <span class="floating-btn-tooltip">${isEn ? "Hotline: 0397 062 429" : "Hotline: 0397 062 429"}</span>
      <svg class="floating-btn-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
      </svg>
    </a>

    <!-- 3. Nút Zalo -->
    <a href="https://zalo.me/0397062429"
       target="_blank"
       rel="noopener noreferrer"
       class="floating-contact-btn floating-btn-zalo"
       aria-label="${isEn ? "Chat Zalo: 0397 062 429" : "Chat Zalo: 0397 062 429"}"
       title="Zalo: 0397 062 429">
      <span class="floating-btn-tooltip">${isEn ? "Zalo: 0397 062 429" : "Zalo: 0397 062 429"}</span>
      <span class="floating-btn-zalo-text">Zalo</span>
    </a>

    <!-- 4. Nút Cuộn lên đầu trang -->
    <button type="button"
            class="floating-contact-btn floating-btn-top"
            id="floating-btn-back-to-top"
            aria-label="${isEn ? "Scroll to top" : "Lên đầu trang"}"
            title="${isEn ? "Scroll to top" : "Lên đầu trang"}">
      <span class="floating-btn-tooltip">${isEn ? "Back to top" : "Lên đầu trang"}</span>
      <svg class="floating-btn-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="18 15 12 9 6 15"/>
      </svg>
    </button>
  `;

  const topBtn = widget.querySelector("#floating-btn-back-to-top");
  if (topBtn) {
    topBtn.onclick = (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  }

  // Widget được vẽ lại khi đổi ngôn ngữ -> áp lại trạng thái ẩn/hiện; chỉ gắn listener cuộn một lần
  updateBackToTopVisibility();
  if (!backToTopListenerBound) {
    backToTopListenerBound = true;
    window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });
  }
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

// Lắng nghe sự kiện thay đổi ngôn ngữ từ bất kỳ đâu trên trang
window.addEventListener("languagechange", () => {
  renderHeader();
  renderFooter();
  renderFloatingContactWidget();
  applyI18n();
});

// Lắng nghe sự kiện đăng nhập / đăng xuất của khách hàng
window.addEventListener("customer-auth-change", () => {
  renderHeader();
});

document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  renderFooter();
  renderFloatingContactWidget();
  renderChatbotWidget();
  initAgeGate();
  applyI18n();
  // Điểm thưởng / hạng đổi sau mỗi đơn hoàn tất: đối chiếu lại với máy chủ (đổi thì tự vẽ lại menu)
  syncCustomerSession();
});

if (document.readyState !== "loading") {
  renderFloatingContactWidget();
  renderChatbotWidget();
  initAgeGate();
}

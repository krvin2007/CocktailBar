/* =========================================================
   ADMIN-LAYOUT.JS - Sidebar + topbar dùng chung khu quản trị
   Giao diện quản lý nghiệp vụ chuẩn POS/Operational Dashboard,
   sử dụng toàn bộ SVG Icons nét mảnh, loại bỏ Emoji.
   Tích hợp nút chuyển đổi ngôn ngữ VI & EN.
   ========================================================= */

import { toast } from "./ui.js"; // (nạp ui.js cũng đăng ký banner cảnh báo khi máy chủ API chưa chạy)
import { requireAuth, currentAdmin, logout, can, canAccessPage, homePageFor, refreshSession, LOGIN_PAGE } from "./auth.js";
import { countUnreadMessages } from "./messagesService.js";
import { ICONS } from "./icons.js";
import { escapeHtml } from "./utils.js";
import { getCurrentLang, setLanguage, toggleLanguage, t, applyI18n } from "./i18n.js";

function getAdminMenu() {
  return [
    { href: "admin-dashboard.html", label: t("admin_menu_dash", "Tổng quan & Thống kê"), icon: ICONS.chart(17) },
    { href: "admin-menu.html", label: t("admin_menu_drinks", "Quản lý thực đơn"), icon: ICONS.cocktail(17) },
    { href: "admin-orders.html", label: t("admin_menu_orders", "Quản lý đơn hàng"), icon: ICONS.receipt(17) },
    { href: "admin-customers.html", label: t("admin_menu_customers", "Khách hàng thành viên"), icon: ICONS.user(17) },
    { href: "admin-vouchers.html", label: t("admin_menu_vouchers", "Mã giảm giá"), icon: ICONS.sparkle(17) },
    { href: "admin-staff.html", label: t("admin_menu_staff", "Quản lý nhân viên"), icon: ICONS.users(17) },
    { href: "admin-messages.html", label: t("admin_menu_messages", "Hộp thư liên hệ"), icon: ICONS.mail(17), badgeId: "nav-unread-badge" },
  ].filter((item) => canAccessPage(item.href)); // chỉ hiện mục mà vai trò hiện tại được vào
}

function currentPage() {
  return window.location.pathname.split("/").pop() || "admin-dashboard.html";
}

/** Lấy số tin nhắn chưa đọc từ API rồi gắn huy hiệu - không chặn việc vẽ giao diện */
export async function refreshUnreadBadge() {
  if (!can("page:messages")) return; // vai trò không xem hộp thư thì không hiện số tin
  let unread;
  try {
    unread = await countUnreadMessages();
  } catch {
    return; // lỗi đếm tin nhắn không quan trọng bằng nội dung chính của trang
  }

  const navBadge = document.getElementById("nav-unread-badge");
  if (navBadge) {
    navBadge.textContent = unread;
    navBadge.hidden = unread === 0;
  }

  const inbox = document.getElementById("admin-inbox-badge");
  if (inbox) {
    inbox.hidden = unread === 0;
    inbox.innerHTML = `${ICONS.mail(14)} ${unread} ${t("admin_new_messages", "tin nhắn mới")}`;
  }
}

let sessionChecked = false;

/**
 * Mỗi lần mở trang đối chiếu phiên với danh sách nhân sự trên máy chủ: nhân viên bị khoá/xoá
 * thì đăng xuất ngay, bị đổi vai trò thì tải lại trang để áp quyền mới (không giữ quyền cũ).
 */
async function revalidateSessionOnce(admin) {
  if (sessionChecked) return;
  sessionChecked = true;
  const fresh = await refreshSession();
  if (!fresh) {
    toast("Tài khoản của bạn không còn hiệu lực. Vui lòng đăng nhập lại.", "warning");
    setTimeout(() => { window.location.href = LOGIN_PAGE; }, 1200);
  } else if (fresh.role !== admin.role) {
    window.location.reload();
  }
}

/**
 * Dựng khung giao diện quản trị.
 * @returns {boolean} false nếu chưa đăng nhập (đang chuyển về trang
 *   đăng nhập) - trang gọi phải dừng lại, không tải dữ liệu nữa.
 */
export function initAdminLayout(pageTitle = "") {
  requireAuth();
  const admin = currentAdmin();
  if (!admin) return false;

  const page = currentPage();

  // Gõ thẳng địa chỉ trang không thuộc quyền (VD pha chế mở admin-staff.html)
  // -> chuyển về trang của vai trò đó, không tải dữ liệu trang này.
  if (!canAccessPage(page, admin)) {
    window.location.href = homePageFor(admin);
    return false;
  }
  const currentLang = getCurrentLang();
  const menu = getAdminMenu();

  const sidebar = document.getElementById("admin-sidebar");
  if (sidebar) {
    sidebar.innerHTML = `
      <div class="admin-brand">
        <span class="admin-brand-icon">${ICONS.cocktail(20)}</span>
        <div>
          <div class="admin-brand-name">${t("brand_title", "Quán Bar Đêm")}</div>
          <div class="admin-brand-badge">${t("admin_brand_badge", "Bảng điều hành")}</div>
        </div>
      </div>

      <nav class="admin-nav">
        ${menu.map((item) => `
          <a href="${item.href}" class="${item.href === page ? "active" : ""}">
            <span class="admin-nav-icon">${item.icon}</span>
            <span>${item.label}</span>
            ${item.badgeId ? `<span class="admin-nav-badge" id="${item.badgeId}" hidden></span>` : ""}
          </a>`).join("")}
      </nav>

      <div class="admin-sidebar-footer">
        <a href="index.html" class="admin-back-link">
          ${ICONS.arrowLeft(14)} <span>${t("admin_back_link", "Về trang khách hàng")}</span>
        </a>
      </div>`;
  }

  const topbar = document.getElementById("admin-topbar");
  if (topbar) {
    topbar.innerHTML = `
      <div class="admin-title-wrap">
        <h1 class="admin-page-title">${pageTitle}</h1>
        <p class="admin-page-subtitle">${currentLang === "en" ? "Bar Lounge Operations & POS Management" : "Hệ thống quản lý vận hành nội bộ quán bar"}</p>
      </div>
      <div class="admin-topbar-actions">
        <!-- Nút đổi ngôn ngữ VI & EN -->
        <div class="lang-switcher">
          <button type="button" class="lang-toggle-btn admin-lang-btn" id="admin-lang-btn" aria-label="Đổi ngôn ngữ VI / EN" title="${currentLang === "vi" ? "Switch to English (EN)" : "Chuyển sang Tiếng Việt (VI)"}">
            <span class="lang-code ${currentLang === "vi" ? "active" : ""}" data-lang="vi">VI</span>
            <span class="lang-divider">/</span>
            <span class="lang-code ${currentLang === "en" ? "active" : ""}" data-lang="en">EN</span>
          </button>
        </div>

        <a href="admin-messages.html" class="admin-inbox-badge" id="admin-inbox-badge" hidden
           title="${currentLang === "en" ? "View Inbox" : "Xem hộp thư liên hệ"}"></a>
        <div class="admin-user-pill" title="${escapeHtml(admin.name || admin.username)} - ${escapeHtml(admin.roleLabel || "Nhân sự")} ${admin.staffCode ? `(${escapeHtml(admin.staffCode)})` : ""}">
          ${ICONS.user(14)}
          <span class="admin-username">${escapeHtml(admin.name || admin.username)}</span>
          <span class="admin-user-role-badge">${escapeHtml(admin.roleLabel || "Quản trị")}</span>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" id="admin-logout-btn">
          ${ICONS.logout(14)} ${t("admin_logout", "Đăng xuất")}
        </button>
      </div>`;

    document.getElementById("admin-logout-btn").addEventListener("click", () => {
      logout();
      window.location.href = LOGIN_PAGE;
    });

    const langBtn = document.getElementById("admin-lang-btn");
    if (langBtn) {
      langBtn.addEventListener("click", (e) => {
        const targetLang = e.target.closest("[data-lang]")?.dataset?.lang;
        if (targetLang) {
          setLanguage(targetLang);
        } else {
          toggleLanguage();
        }
        initAdminLayout(pageTitle);
      });
    }
  }

  const mobileToggle = document.getElementById("admin-sidebar-toggle");
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener("click", () => sidebar.classList.toggle("open"));
  }

  refreshUnreadBadge();
  revalidateSessionOnce(admin);
  applyI18n();
  return true;
}

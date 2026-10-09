/* =========================================================
   ADMIN-LOGIN.JS - Xử lý đăng nhập khu quản trị
   Hỗ trợ tài khoản Quản trị tối cao + Tài khoản nhân sự
   ========================================================= */

import { login, isLoggedIn } from "../modules/auth.js";
import { validateForm } from "../modules/validation.js";
import { toast, setButtonLoading } from "../modules/ui.js";

// Đã đăng nhập từ trước (sessionStorage còn hiệu lực) -> vào thẳng dashboard
if (isLoggedIn()) {
  window.location.href = "admin-dashboard.html";
}

const formEl = document.getElementById("login-form");
const loginBtn = document.getElementById("login-btn");
const usernameInput = document.getElementById("login-username");
const passwordInput = document.getElementById("login-password");

/** Tự động nhận diện tài khoản vừa đăng ký từ trang register */
function checkRegisteredParam() {
  const params = new URLSearchParams(window.location.search);
  const registered = params.get("registered");
  const username = params.get("username");

  if (username && usernameInput) {
    usernameInput.value = username;
  }

  if (registered === "1") {
    toast("Đăng ký tài khoản thành công! Vui lòng nhập mật khẩu để đăng nhập hệ thống.", "success");
    if (passwordInput) passwordInput.focus();
  }
}

/** Xử lý ẩn/hiện mật khẩu cho nút mắt */
function bindPasswordToggles() {
  document.querySelectorAll(".pw-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (!input) return;

      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";

      btn.innerHTML = isPassword
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    });
  });
}

/** Xử lý nút 1-Click điền nhanh tài khoản demo */
function bindQuickFill() {
  document.querySelectorAll(".quick-fill-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const u = btn.dataset.user;
      const p = btn.dataset.pass;
      if (usernameInput) usernameInput.value = u;
      if (passwordInput) passwordInput.value = p;
      toast(`Đã chọn tài khoản: ${u}`, "info");
    });
  });
}

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();

  const { isValid, data } = validateForm(formEl);
  if (!isValid) return;

  // Mật khẩu lấy nguyên văn, không cắt khoảng trắng
  const password = passwordInput.value;
  const restoreButton = setButtonLoading(loginBtn, "Đang xác thực...");

  const result = await login(data.username, password);

  if (result && result.success) {
    const greeting = result.user?.name ? `${result.user.name} (${result.user.roleLabel})` : "Quản trị viên";
    toast(`Đăng nhập thành công! Xin chào ${greeting}`, "success");
    setTimeout(() => {
      window.location.href = "admin-dashboard.html";
    }, 400);
  } else {
    toast(result?.message || "Sai tài khoản hoặc mật khẩu.", "error");
    restoreButton();
  }
});

// Khởi chạy
checkRegisteredParam();
bindPasswordToggles();
bindQuickFill();

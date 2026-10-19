/* =========================================================
   CUSTOMER-AUTH.JS - Xử lý đăng nhập / đăng ký trang khách hàng
   ========================================================= */

import {
  customerRegister, isCustomerLoggedIn,
  getCurrentCustomer,
} from "../modules/customerAuth.js";
import { signIn, isLoggedIn, homePageFor } from "../modules/auth.js";
import { toast, setButtonLoading } from "../modules/ui.js";
import { applyI18n } from "../modules/i18n.js";
import { passwordProblem, PASSWORD_RULE_TEXT } from "../modules/passwords.js";
import { ageProblem } from "../modules/age.js";

applyI18n(); // trang đăng nhập không có thanh menu: tự áp ngôn ngữ đã chọn ở các trang khác

// Đã đăng nhập từ trước: nhân sự -> trang quản trị đúng vai trò; khách -> trang đặt bàn
if (isLoggedIn()) {
  window.location.href = homePageFor();
} else if (isCustomerLoggedIn()) {
  const current = getCurrentCustomer();
  toast(`Chào mừng ${current?.name || "quý khách"} đã quay trở lại!`, "info");
  setTimeout(() => {
    window.location.href = "order.html";
  }, 1000);
}

const tabLogin = document.getElementById("tab-btn-login");
const tabReg = document.getElementById("tab-btn-register");
const paneLogin = document.getElementById("page-pane-login");
const paneReg = document.getElementById("page-pane-register");

// Kiểm tra query parameter ?tab=register
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get("tab") === "register" && tabReg) {
  tabReg.click();
}

// Vừa đăng ký tài khoản nhân sự xong (chuyển từ admin-register.html sang)
if (urlParams.get("registered") === "1") {
  const registeredUser = urlParams.get("username");
  const identInput = document.getElementById("page-login-ident");
  if (registeredUser && identInput) identInput.value = registeredUser;
  toast("Đã gửi đăng ký. Bạn đăng nhập được sau khi quản lý duyệt tài khoản.", "info");
}

// Chuyển tab
if (tabLogin && tabReg && paneLogin && paneReg) {
  tabLogin.addEventListener("click", () => {
    tabLogin.classList.add("active");
    tabReg.classList.remove("active");
    paneLogin.hidden = false;
    paneLogin.classList.add("active");
    paneReg.hidden = true;
    paneReg.classList.remove("active");
  });

  tabReg.addEventListener("click", () => {
    tabReg.classList.add("active");
    tabLogin.classList.remove("active");
    paneReg.hidden = false;
    paneReg.classList.add("active");
    paneLogin.hidden = true;
    paneLogin.classList.remove("active");
  });
}

// Ẩn / hiện mật khẩu
document.querySelectorAll(".pw-toggle-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetId = btn.dataset.target;
    const input = document.getElementById(targetId);
    if (input) {
      input.type = input.type === "password" ? "text" : "password";
    }
  });
});

// Xử lý submit Login
const loginForm = document.getElementById("page-form-login");
const loginBtn = document.getElementById("page-btn-login");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ident = document.getElementById("page-login-ident")?.value?.trim();
    const pass = document.getElementById("page-login-pass")?.value;

    if (!ident) {
      toast("Vui lòng nhập Tên đăng nhập, Số điện thoại hoặc Email.", "warning");
      return;
    }
    if (!pass) {
      toast("Vui lòng nhập Mật khẩu.", "warning");
      return;
    }

    const restoreBtn = setButtonLoading(loginBtn, "Đang xác thực...");
    try {
      const res = await signIn(ident, pass);
      if (res.success) {
        const isStaff = res.kind === "staff";
        const greeting = isStaff ? `${res.user.name} (${res.user.roleLabel})` : res.user.name;
        toast(`Chào mừng ${greeting}! Đăng nhập thành công.`, "success");
        setTimeout(() => {
          // Hệ thống tự nhận biết: nhân sự vào trang quản trị đúng vai trò, khách vào trang đặt bàn
          window.location.href = isStaff ? homePageFor(res.user) : "order.html";
        }, 600);
      } else {
        toast(res.message, "danger");
      }
    } finally {
      restoreBtn();
    }
  });
}

// Xử lý submit Register
const regForm = document.getElementById("page-form-register");
const regBtn = document.getElementById("page-btn-reg");
if (regForm) {
  regForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("page-reg-name")?.value?.trim();
    const phone = document.getElementById("page-reg-phone")?.value?.trim();
    const email = document.getElementById("page-reg-email")?.value?.trim();
    const pass = document.getElementById("page-reg-pass")?.value;
    const passConfirm = document.getElementById("page-reg-pass-confirm")?.value;
    const birthDate = document.getElementById("page-reg-birth")?.value;

    if (!name || name.length < 2) {
      toast("Vui lòng nhập Họ và tên (tối thiểu 2 ký tự).", "warning");
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

    const restoreBtn = setButtonLoading(regBtn, "Đang đăng ký...");
    try {
      const res = await customerRegister({ name, phone, email, password: pass, birthDate });
      if (res.success) {
        toast(`Đăng ký thành công! Chào mừng quý khách ${res.customer.name}.`, "success");
        setTimeout(() => {
          window.location.href = "order.html";
        }, 700);
      } else {
        toast(res.message, "danger");
      }
    } finally {
      restoreBtn();
    }
  });
}

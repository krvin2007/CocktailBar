/* =========================================================
   ADMIN-REGISTER.JS - Xử lý đăng ký tài khoản nhân sự
   Ràng buộc nghiệp vụ chuẩn:
   - Tên đăng nhập: 4-20 ký tự (chữ, số, gạch dưới), không trùng
   - SĐT: Chuẩn di động VN 10 số (đầu 03, 05, 07, 08, 09), không trùng
   - Email: Định dạng RFC, không trùng
   - Mật khẩu: 8-32 ký tự, đủ hoa, thường, số, ký tự đặc biệt
   - Đo độ mạnh mật khẩu và checklist thời gian thực
   ========================================================= */

import { isLoggedIn, homePageFor } from "../modules/auth.js";
import {
  getAllStaff, generateStaffCode, isUsernameTaken, isPhoneTaken, isEmailTaken, registerStaff,
} from "../modules/staffService.js";
import { validateForm, setFieldError, checkPasswordStrength } from "../modules/validation.js";
import { toast, setButtonLoading } from "../modules/ui.js";

// Nếu đã đăng nhập từ trước -> vào thẳng bảng điều hành
if (isLoggedIn()) {
  window.location.href = homePageFor();
}

const formEl = document.getElementById("register-form");
const staffCodeInput = document.getElementById("reg-staff-code");
const startDateInput = document.getElementById("reg-start-date");
const passwordInput = document.getElementById("reg-password");
const confirmPasswordInput = document.getElementById("reg-confirm-password");
const agreementCheckbox = document.getElementById("reg-agreement");
const registerBtn = document.getElementById("register-btn");

const strengthFill = document.getElementById("strength-fill");
const strengthLabel = document.getElementById("strength-label");
const chkLen = document.getElementById("chk-len");
const chkUpper = document.getElementById("chk-upper");
const chkSpec = document.getElementById("chk-spec");

let allStaff = [];

/** Khởi tạo dữ liệu form ban đầu */
async function initForm() {
  // Điền ngày hiện tại dạng YYYY-MM-DD
  const today = new Date().toISOString().split("T")[0];
  if (startDateInput) startDateInput.value = today;

  try {
    allStaff = await getAllStaff();
    if (staffCodeInput) {
      staffCodeInput.value = generateStaffCode(allStaff);
    }
  } catch {
    if (staffCodeInput) staffCodeInput.value = "NV001";
  }
}

/** Cập nhật thanh đo độ mạnh mật khẩu và danh sách tiêu chuẩn */
function updateStrengthMeter(password) {
  const result = checkPasswordStrength(password);

  strengthFill.style.width = `${result.percent}%`;
  strengthFill.style.background = result.color;
  strengthLabel.textContent = result.label;
  strengthLabel.style.color = result.color;

  chkLen.classList.toggle("valid", result.checks.length);
  chkUpper.classList.toggle("valid", result.checks.firstUpper);
  chkSpec.classList.toggle("valid", result.checks.special);
}

/** Xử lý ẩn/hiện mật khẩu cho các nút mắt */
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

// Lắng nghe thay đổi mật khẩu
passwordInput.addEventListener("input", (e) => {
  updateStrengthMeter(e.target.value);
});

// Xử lý gửi biểu mẫu đăng ký
formEl.addEventListener("submit", async (e) => {
  e.preventDefault();

  const { isValid, data } = validateForm(formEl);
  if (!isValid) return;

  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  // 1. Kiểm tra xác nhận mật khẩu
  if (password !== confirmPassword) {
    setFieldError(confirmPasswordInput, "Mật khẩu xác thực không trùng khớp");
    confirmPasswordInput.focus();
    return;
  }
  setFieldError(confirmPasswordInput, "");

  // 2. Kiểm tra cam kết nội quy
  if (!agreementCheckbox.checked) {
    toast("Vui lòng tích chọn xác nhận cam kết nội quy và bảo mật của Quán Bar Đêm.", "warning");
    agreementCheckbox.focus();
    return;
  }

  // Tải lại danh sách nhân sự mới nhất để kiểm tra trùng lặp thời gian thực
  try {
    allStaff = await getAllStaff();
  } catch {
    // Nếu API lỗi tạm thời, vẫn tiếp tục với allStaff hiện có
  }

  // 3. Ràng buộc duy nhất: Tên đăng nhập
  if (isUsernameTaken(allStaff, data.username)) {
    setFieldError(formEl.elements.username, "Tên đăng nhập này đã được sử dụng hoặc là tài khoản bảo lưu hệ thống");
    formEl.elements.username.focus();
    return;
  }

  // 4. Ràng buộc duy nhất: Số điện thoại
  if (isPhoneTaken(allStaff, data.phone)) {
    setFieldError(formEl.elements.phone, "Số điện thoại này đã được đăng ký bởi một nhân viên khác");
    formEl.elements.phone.focus();
    return;
  }

  // 5. Ràng buộc duy nhất: Email
  if (isEmailTaken(allStaff, data.email)) {
    setFieldError(formEl.elements.email, "Địa chỉ email này đã tồn tại trong danh sách nhân sự");
    formEl.elements.email.focus();
    return;
  }

  const staffCode = staffCodeInput.value || generateStaffCode(allStaff);

  const payload = {
    staffCode,
    name: data.name,
    username: data.username,
    password,
    phone: data.phone,
    email: data.email,
    role: data.role,
    startDate: data.startDate,
    // Không gửi status: registerStaff() luôn đặt "pending" (chờ quản lý duyệt)
  };

  const restoreButton = setButtonLoading(registerBtn, "Đang đăng ký tài khoản...");

  try {
    const newStaff = await registerStaff(payload);
    toast(`Đã gửi đăng ký! Mã nhân sự: ${newStaff.displayStaffCode} - vui lòng chờ quản lý duyệt.`, "success");

    // Đợi 1.6s rồi chuyển sang trang đăng nhập (tài khoản chưa đăng nhập được cho tới khi được duyệt)
    setTimeout(() => {
      window.location.href = `customer-auth.html?registered=1&username=${encodeURIComponent(data.username)}`;
    }, 1600);
  } catch (err) {
    toast(`Đăng ký thất bại: ${err.message}`, "error");
    restoreButton();
  }
});

// Khởi chạy
initForm();
bindPasswordToggles();

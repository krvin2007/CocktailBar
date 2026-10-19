/* =========================================================
   VALIDATION.JS - Bộ kiểm tra dữ liệu form dùng chung
   Cách dùng:
     1. Trong HTML, mỗi input cần kiểm tra thêm thuộc tính
        data-rule="required|email" (nhiều luật cách nhau bằng "|")
     2. Gọi validateForm(formElement) khi submit
     3. Hàm tự chèn thông báo lỗi dưới từng ô, trả về true/false
   ========================================================= */

import { checkPassword, passwordProblem } from "./passwords.js";
import { ageProblem } from "./age.js";

/** Từng luật nhận vào chuỗi giá trị, trả về true (hợp lệ) hoặc chuỗi lỗi */
const RULES = {
  required: (v) => v.trim().length > 0 || "Không được bỏ trống",

  email: (v) => !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
    || "Email không đúng định dạng",

  phone: (v) => !v.trim() || /^(0|\+84)\d{9}$/.test(v.trim().replace(/[\s.-]/g, ""))
    || "Số điện thoại không hợp lệ (VD: 0912345678)",

  vnphone: (v) => !v.trim() || /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/.test(v.trim().replace(/[\s.-]/g, ""))
    || "Số điện thoại di động không hợp lệ (10 số, đầu 03, 05, 07, 08, 09)",

  username: (v) => !v.trim() || /^[a-zA-Z0-9_]{4,20}$/.test(v.trim())
    || "Tên đăng nhập từ 4-20 ký tự, chỉ gồm chữ cái, số và dấu gạch dưới (_)",

  password: (v) => !v || passwordProblem(v) === "" || passwordProblem(v),

  number: (v) => !v.trim() || !Number.isNaN(Number(v))
    || "Giá trị phải là số",

  positive: (v) => !v.trim() || Number(v) > 0
    || "Giá trị phải lớn hơn 0",

  integer: (v) => !v.trim() || Number.isInteger(Number(v))
    || "Giá trị phải là số nguyên",

  date: (v) => !v.trim() || !Number.isNaN(new Date(v).getTime())
    || "Ngày không hợp lệ",

  // Ngày sinh phải đủ tuổi được phục vụ đồ uống có cồn (age.js); để trống thì luật "required" lo
  adult: (v) => !v.trim() || ageProblem(v) === "" || ageProblem(v),
};

/** Luật có tham số, ví dụ "min:2", "max:100" */
function paramRule(name, param, value) {
  const n = Number(param);
  const trimmed = value.trim();
  if (name === "min") {
    return trimmed.length === 0 || trimmed.length >= n || `Tối thiểu ${n} ký tự`;
  }
  if (name === "max") {
    return trimmed.length === 0 || trimmed.length <= n || `Tối đa ${n} ký tự`;
  }
  if (name === "minval") {
    return trimmed.length === 0 || Number(trimmed) >= n || `Giá trị tối thiểu là ${n}`;
  }
  if (name === "maxval") {
    return trimmed.length === 0 || Number(trimmed) <= n || `Giá trị tối đa là ${n}`;
  }
  return true;
}

/**
 * Hiện / ẩn thông báo lỗi ngay dưới một field.
 * Export ra ngoài để trang nào cần validate thêm luật riêng (không
 * khai báo được bằng data-rule, ví dụ "giờ đặt bàn phải trong giờ mở
 * cửa") vẫn hiển thị lỗi theo đúng kiểu giao diện dùng chung.
 */
export function setFieldError(field, message) {
  field.classList.toggle("invalid", Boolean(message));

  let errorEl = field.parentElement.querySelector(".field-error");
  if (!errorEl) {
    errorEl = document.createElement("span");
    errorEl.className = "field-error";
    field.insertAdjacentElement("afterend", errorEl);
  }
  errorEl.textContent = message || "";
}

/** Kiểm tra một field đơn lẻ, trả về true nếu hợp lệ */
function validateField(field) {
  const ruleAttr = field.dataset.rule;
  if (!ruleAttr) return true;

  const value = field.value ?? "";
  const rules = ruleAttr.split("|");

  for (const rule of rules) {
    const [name, param] = rule.split(":");
    let result;

    if (name in RULES) {
      result = RULES[name](value);
    } else if (["min", "max", "minval", "maxval"].includes(name)) {
      result = paramRule(name, param, value);
    } else {
      continue; // luật không xác định thì bỏ qua, không chặn submit
    }

    if (result !== true) {
      setFieldError(field, result);
      return false;
    }
  }

  setFieldError(field, "");
  return true;
}

/**
 * Đọc toàn bộ dữ liệu form thành object { tênField: giáTrị },
 * tự cắt khoảng trắng thừa ở đầu/cuối mọi giá trị chữ.
 */
export function readFormData(formEl) {
  const data = {};
  new FormData(formEl).forEach((value, key) => {
    data[key] = typeof value === "string" ? value.trim() : value;
  });
  return data;
}

/**
 * Kiểm tra toàn bộ form.
 * @returns {{ isValid: boolean, data: object }} isValid = mọi field hợp lệ,
 *   data = dữ liệu form đã đọc sẵn (dùng luôn khi isValid = true).
 * Tự động gắn sự kiện "input"/"change" lần đầu gọi để lỗi biến mất
 * ngay khi người dùng sửa lại (trải nghiệm tốt hơn là chỉ báo lỗi lúc submit).
 */
export function validateForm(formEl) {
  const fields = [...formEl.querySelectorAll("[data-rule]")];
  let isValid = true;

  fields.forEach((field) => {
    if (!field.dataset.liveBound) {
      field.dataset.liveBound = "1";
      const evt = field.tagName === "SELECT" || field.type === "checkbox" ? "change" : "input";
      field.addEventListener(evt, () => validateField(field));
    }
    if (!validateField(field)) isValid = false;
  });

  // Đưa con trỏ tới ô lỗi đầu tiên để người dùng sửa ngay
  if (!isValid) {
    const firstInvalid = formEl.querySelector(".invalid");
    if (firstInvalid) firstInvalid.focus();
  }

  return { isValid, data: readFormData(formEl) };
}

/** Xoá sạch trạng thái lỗi hiển thị (dùng khi mở lại form để thêm mới) */
export function clearFormErrors(formEl) {
  formEl.querySelectorAll(".invalid").forEach((f) => f.classList.remove("invalid"));
  formEl.querySelectorAll(".field-error").forEach((e) => { e.textContent = ""; });
}

/**
 * Đánh giá độ mạnh mật khẩu theo tiêu chuẩn bảo mật doanh nghiệp:
 * - Độ dài >= 8 ký tự
 * - Có chữ hoa (A-Z)
 * - Có chữ thường (a-z)
 * - Có chữ số (0-9)
 * - Có ký tự đặc biệt (!@#$%...)
 */
export function checkPasswordStrength(password = "") {
  const p = String(password || "");
  const checks = checkPassword(p);
  const passed = [checks.length, checks.firstUpper, checks.special].filter(Boolean).length;

  if (!p) return { score: 0, label: "Chưa nhập", color: "var(--border-soft)", percent: 0, checks };
  if (passed === 3) return { score: 3, label: "Đạt yêu cầu", color: "var(--success)", percent: 100, checks };
  if (passed === 2) return { score: 2, label: "Gần đạt", color: "#f59e0b", percent: 66, checks };
  return { score: 1, label: "Chưa đạt", color: "var(--danger)", percent: 33, checks };
}


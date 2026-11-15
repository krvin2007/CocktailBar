/* =========================================================
   ACCOUNTFIELDS.JS - Điền & khoá thông tin khách từ TÀI KHOẢN ĐÃ ĐĂNG KÝ
   Khách đã đăng nhập thì các ô Họ tên / SĐT / Email / Ngày sinh trong form phải ghi đúng thông tin
   tài khoản (không để nhập lệch). Ô nào tài khoản chưa có thì vẫn cho nhập.
   Muốn đổi thông tin: vào trang Tài khoản (đơn cũ giữ nguyên thông tin lúc đặt).
   ========================================================= */

const FIELDS = ["name", "phone", "email", "birthDate"];

/**
 * Ghi thông tin tài khoản vào form và khoá các ô đó (readonly).
 * @returns {string[]} danh sách ô đã khoá
 */
export function lockFieldsFromAccount(form, customer, fields = FIELDS) {
  const locked = [];
  if (!form || !customer) return locked;
  for (const key of fields) {
    const input = form.elements[key];
    const value = String(customer[key] ?? "").trim();
    if (!input || !value) continue; // tài khoản chưa có (vd email) -> để khách tự nhập
    input.value = value;
    input.readOnly = true;
    input.dataset.fromAccount = "1";
    input.title = "Thông tin lấy từ tài khoản đã đăng ký - muốn đổi hãy vào trang Tài khoản";
    locked.push(key);
  }
  return locked;
}

/** Đăng xuất: mở khoá và xoá thông tin tài khoản vừa điền (không để lộ dữ liệu người trước) */
export function releaseAccountFields(form) {
  if (!form) return;
  form.querySelectorAll("[data-from-account]").forEach((input) => {
    input.readOnly = false;
    input.value = "";
    input.removeAttribute("title");
    delete input.dataset.fromAccount;
  });
}

/** Giá trị khách đã đăng nhập luôn lấy từ tài khoản (chống sửa DOM/ô bị bỏ trống); chưa đăng nhập thì giữ nguyên */
export function accountValue(customer, key, fallback = "") {
  const value = String(customer?.[key] ?? "").trim();
  return value || fallback;
}

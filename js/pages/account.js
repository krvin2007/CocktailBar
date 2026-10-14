/* =========================================================
   ACCOUNT.JS - Trang "Tài khoản thành viên" (account.html)
   Trang có hai trạng thái:

   1. KHÁCH CHƯA ĐĂNG NHẬP - 2 tab "Đăng nhập" / "Đăng ký thành viên"
      - Đăng nhập bằng SĐT + mật khẩu. Đang trong tuần sinh nhật
        (± 7 ngày) -> toast chúc mừng kèm mã quà sinh nhật.
      - Đăng ký: kiểm tra form bằng data-rule (validation.js) + luật
        riêng của quán bar: đủ 18 tuổi, ngày sinh không ở tương lai,
        mật khẩu nhập lại phải khớp. Thành công -> modal chúc mừng
        hiển thị MÃ CHÀO MỪNG cá nhân (giảm WELCOME_DISCOUNT %).
      - Lỗi nghiệp vụ (trùng SĐT, sai mật khẩu...) do customerAuth.js
        trả về được hiện nguyên văn ở khung cảnh báo trên form.

   2. THÀNH VIÊN ĐÃ ĐĂNG NHẬP
      - Thẻ hồ sơ: tên, SĐT, email, sinh nhật, tuổi, ngày tham gia,
        nhãn "Thành viên mới" (đăng ký trong 30 ngày gần nhất).
      - Khối "Sinh nhật": đếm ngược số ngày / lời chúc + mã quà. Mỗi
        lần tải trang gọi ensureBirthdayVoucher: đang trong cửa sổ
        ± 7 ngày mà chưa có mã của năm nay thì máy chủ phát mã mới.
      - "Ví mã giảm giá của tôi": mã cá nhân + mã công khai còn dùng
        được; mỗi mã có nút Sao chép và "Dùng ngay" (sang order.html
        kèm ?voucher=MÃ để trang đặt món tự điền mã).

   Phiên đăng nhập do customerAuth.js quản lý (localStorage). Trang
   nghe sự kiện "customerchange" (và "storage" khi đăng nhập/đăng xuất
   ở tab khác) để tự vẽ lại đúng trạng thái.
   ========================================================= */

import "../modules/navbar.js";
import { getCurrentCustomer, loginCustomer, registerAndLogin, logoutCustomer } from "../modules/customerAuth.js";
import { Customer, birthdayInYear } from "../modules/customersService.js";
import {
  getPublicVouchers, getCustomerVouchers, ensureBirthdayVoucher,
  VOUCHER_AUDIENCES, BIRTHDAY_DISCOUNT, WELCOME_DISCOUNT,
} from "../modules/vouchersService.js";
import { validateForm, setFieldError, clearFormErrors } from "../modules/validation.js";
import { toast, confirmDialog, openModal, closeModal, setButtonLoading, loadingHtml, errorHtml } from "../modules/ui.js";
import { ICONS } from "../modules/icons.js";
import { escapeHtml, formatMoney, formatDate, getQueryParam } from "../modules/utils.js";

/* =========================================================
   HẰNG SỐ NGHIỆP VỤ & BIỂU TƯỢNG
   ========================================================= */

/** Quán bar chỉ nhận thành viên từ 18 tuổi (khớp kiểm tra phía customersService) */
const ADULT_AGE = 18;
/** Cửa sổ quà sinh nhật: từ 7 ngày trước đến 7 ngày sau sinh nhật */
const BIRTHDAY_WINDOW = 7;
/** Mã chào mừng có hạn 30 ngày kể từ lúc đăng ký (theo đặc tả vouchersService) */
const WELCOME_VALID_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_BIRTHDAY_HINT = "Quán bar chỉ phục vụ khách từ 18 tuổi trở lên. Ngày sinh dùng để gửi quà sinh nhật - không thể đổi sau khi đăng ký.";

const svgIcon = (size, body) => `<svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICON_GIFT = (size = 18) => svgIcon(size, `<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>`);
const ICON_COPY = (size = 14) => svgIcon(size, `<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>`);
const ICON_CAKE = (size = 18) => svgIcon(size, `<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3M12 8v3M17 8v3"/><path d="M7 4h.01M12 4h.01M17 4h.01"/>`);

/* =========================================================
   PHẦN TỬ GIAO DIỆN & TRẠNG THÁI TRANG
   ========================================================= */

const els = {
  loading: document.getElementById("account-loading"),
  guest: document.getElementById("account-guest"),
  member: document.getElementById("account-member"),
  loginForm: document.getElementById("login-form"),
  loginAlert: document.getElementById("login-alert"),
  loginBtn: document.getElementById("login-submit"),
  registerForm: document.getElementById("register-form"),
  registerAlert: document.getElementById("register-alert"),
  registerBtn: document.getElementById("register-submit"),
  birthdayInput: document.getElementById("reg-birthday"),
  birthdayHint: document.getElementById("birthday-hint"),
  welcomeBody: document.getElementById("welcome-modal-body"),
};

/** Mỗi lần vẽ lại tăng số hiệu: kết quả API của lần vẽ CŨ (VD vừa đăng xuất) sẽ bị bỏ qua */
let renderToken = 0;
/** id thành viên đang hiển thị ("" = đang hiện form đăng nhập) - để biết phiên có thật sự đổi không */
let renderedCustomerId = null;
/** Đang đăng nhập/đăng ký/đăng xuất: bỏ qua sự kiện "customerchange" do chính trang này gây ra */
let authBusy = false;
/** Gộp các lần gọi ensureBirthdayVoucher cho cùng một khách -> không bao giờ tạo trùng 2 mã */
const birthdayRequests = new Map();

/* =========================================================
   TIỆN ÍCH NGÀY THÁNG (theo lịch địa phương, bỏ phần giờ)
   ========================================================= */

const pad2 = (n) => String(n).padStart(2, "0");

/** Số thứ tự ngày theo lịch địa phương - hiệu hai ngày luôn là số nguyên */
function dayNumber(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return NaN;
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

/** "1998-10-14" -> Date 00:00 giờ địa phương; sai định dạng / ngày không tồn tại -> null */
function parseDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

const toInputDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const formatDay = (d) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
const formatDayMonth = (d) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;

/** Tuổi tròn của ngày sinh "YYYY-MM-DD" (người sinh 29/02 tính sinh nhật 28/02 năm không nhuận) */
function ageOf(birthday, now = new Date()) {
  const born = parseDay(birthday);
  if (!born) return null;
  const thisYear = birthdayInYear(birthday, now.getFullYear());
  const hadBirthday = thisYear ? dayNumber(now) >= dayNumber(thisYear) : true;
  return now.getFullYear() - born.getFullYear() - (hadBirthday ? 0 : 1);
}

/** Kiểm tra ngày sinh khi đăng ký; trả câu lỗi tiếng Việt hoặc null nếu hợp lệ */
function birthdayProblem(birthday, now = new Date()) {
  const born = parseDay(birthday);
  if (!born) return "Ngày sinh không hợp lệ - vui lòng chọn đúng ngày/tháng/năm.";
  if (dayNumber(born) > dayNumber(now)) return "Ngày sinh không được ở tương lai.";
  const age = ageOf(birthday, now);
  if (age > 120) return "Năm sinh không hợp lệ - vui lòng kiểm tra lại.";
  if (age < ADULT_AGE) {
    return `Quán bar chỉ phục vụ khách từ ${ADULT_AGE} tuổi trở lên - bạn chưa đủ tuổi đăng ký thành viên.`;
  }
  return null;
}

/** Số ngày kể từ lần sinh nhật gần nhất đã qua (dùng khi sinh nhật vừa qua nhưng còn trong cửa sổ) */
function daysSinceLastBirthday(birthday, now = new Date()) {
  const today = dayNumber(now);
  let last = birthdayInYear(birthday, now.getFullYear());
  if (!last || dayNumber(last) > today) last = birthdayInYear(birthday, now.getFullYear() - 1);
  return last ? today - dayNumber(last) : null;
}

/* =========================================================
   TIỆN ÍCH HIỂN THỊ
   ========================================================= */

/** Tên gọi (từ cuối của họ tên) - "Nguyễn Hoàng Anh" -> "Anh" */
function shortName(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "bạn";
}

/** Chữ cái đầu cho ảnh đại diện - "Nguyễn Hoàng Anh" -> "HA" */
function initialsOf(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(-2).map((p) => p.charAt(0)).join("").toUpperCase();
}

/** "0981234567" -> "0981 234 567" cho dễ đọc */
function formatPhone(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  return digits.length === 10 ? `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}` : String(phone);
}

/** Lấy phiên hiện tại an toàn (localStorage bị chặn / dữ liệu hỏng -> coi như chưa đăng nhập) */
function safeCurrentCustomer() {
  try {
    return getCurrentCustomer() || null;
  } catch (err) {
    console.warn("[account] Không đọc được phiên thành viên:", err);
    return null;
  }
}

/** Chỉ cho phép quay lại trang nội bộ dạng "order.html?..." (chống chuyển hướng sang site lạ) */
function safeNextPage(raw) {
  const value = String(raw ?? "").trim();
  return /^[a-z0-9-]+\.html(?:[?#][^\s<>"']*)?$/i.test(value) ? value : "";
}

/* ---------------- Mã giảm giá ---------------- */

/** Thời điểm hết hạn của mã; chuỗi "YYYY-MM-DD" hiểu là hết ngày đó; không có hạn -> null */
function voucherEnd(voucher) {
  if (!voucher?.endDate) return null;
  const plain = parseDay(voucher.endDate);
  if (plain) {
    plain.setHours(23, 59, 59, 999);
    return plain;
  }
  const d = new Date(voucher.endDate);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "HSD 12/11/2026 · còn 29 ngày" / "Không thời hạn" */
function expiryText(voucher, now = new Date()) {
  const end = voucherEnd(voucher);
  if (!end) return "Không thời hạn";
  const daysLeft = dayNumber(end) - dayNumber(now);
  if (daysLeft < 0) return `Đã hết hạn ngày ${formatDay(end)}`;
  if (daysLeft === 0) return `HSD ${formatDay(end)} · hết hạn hôm nay`;
  return `HSD ${formatDay(end)} · còn ${daysLeft} ngày`;
}

/** Số lượt còn lại; Infinity nếu mã không giới hạn lượt */
function remainingUses(voucher) {
  const limit = Number(voucher?.usageLimit) || 0;
  return limit > 0 ? Math.max(0, limit - (Number(voucher.usedCount) || 0)) : Infinity;
}

/** Trạng thái hiển thị của một mã: "usable" | "used" | "expired" | "unavailable" */
function voucherState(voucher) {
  if (!voucher) return "unavailable";
  if (voucher.isUsedUp === true || remainingUses(voucher) === 0) return "used";
  if (voucher.isExpired === true) return "expired";
  if (voucher.isUsable === false) return "unavailable";
  return "usable";
}

/** Điều kiện áp dụng dạng các ý ngắn */
function voucherConditions(voucher) {
  const parts = [Number(voucher.minOrder) > 0 ? `Đơn từ ${formatMoney(voucher.minOrder)}` : "Mọi giá trị đơn"];
  if (Number(voucher.maxDiscount) > 0) parts.push(`Giảm tối đa ${formatMoney(voucher.maxDiscount)}`);
  if (voucher.audience === "new-customer") parts.push("Chỉ cho đơn đầu tiên");
  return parts;
}

/** Nhãn nhóm của mã trong ví */
function voucherTag(voucher, personal) {
  if (personal) {
    if (voucher.audience === "birthday") return "Quà sinh nhật";
    if (voucher.audience === "new-customer") return "Quà chào mừng";
    return "Mã riêng của bạn";
  }
  return VOUCHER_AUDIENCES[voucher.audience] || VOUCHER_AUDIENCES.all || "Mọi khách hàng";
}

/** Đường dẫn "Dùng ngay": trang đặt món tự điền mã từ tham số ?voucher= */
const orderLink = (code) => `order.html?voucher=${encodeURIComponent(code)}`;

/** Thẻ mã dạng "vé" thu gọn dùng trong ví và khối sinh nhật */
function voucherTicketHtml(voucher, { personal = false } = {}) {
  const code = escapeHtml(voucher.code);
  const left = remainingUses(voucher);
  const usesText = !personal && Number.isFinite(left) ? `Còn ${left} lượt` : "";

  return `
    <article class="coupon coupon-compact" data-audience="${escapeHtml(voucher.audience || "all")}">
      <div class="coupon-stub">
        <span class="coupon-percent">${Number(voucher.percent) || 0}<small>%</small></span>
        <span class="coupon-off">Giảm</span>
      </div>
      <div class="coupon-body">
        <div class="coupon-top">
          <span class="coupon-tag">${escapeHtml(voucherTag(voucher, personal))}</span>
          ${usesText ? `<span class="coupon-uses">${usesText}</span>` : ""}
        </div>
        <h4 class="coupon-name">${escapeHtml(voucher.name || `Giảm ${voucher.percent}%`)}</h4>
        <p class="coupon-terms">${voucherConditions(voucher).map((text) => escapeHtml(text)).join(" · ")}</p>
        <p class="coupon-expiry">${ICONS.clock(13)} <span>${escapeHtml(expiryText(voucher))}</span></p>
        <div class="coupon-actions">
          <code class="coupon-code">${code}</code>
          <button type="button" class="btn btn-ghost btn-sm" data-copy-code="${code}" aria-label="Sao chép mã ${code}">
            ${ICON_COPY()} <span>Sao chép</span>
          </button>
          <a class="btn btn-primary btn-sm" href="${orderLink(voucher.code)}">Dùng ngay</a>
        </div>
      </div>
    </article>`;
}

/* ---------------- Sao chép mã ---------------- */

/**
 * Chép chữ vào bộ nhớ tạm. navigator.clipboard chỉ có ở "ngữ cảnh an toàn"
 * (https / localhost) và có thể bị trình duyệt từ chối -> bọc try/catch,
 * thất bại thì thử cách cũ bằng ô textarea ẩn.
 * @returns {Promise<boolean>} true nếu chép thành công
 */
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn("[account] Clipboard API bị từ chối, thử cách dự phòng:", err.message);
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

async function handleCopy(button) {
  const code = button.dataset.copyCode || "";
  if (!code) return;
  const ok = await copyText(code);
  if (!ok) {
    toast(`Trình duyệt không cho sao chép tự động - hãy chép thủ công mã <strong>${escapeHtml(code)}</strong>.`, "info");
    return;
  }
  toast(`Đã sao chép mã <strong>${escapeHtml(code)}</strong> - dán vào ô "Mã giảm giá" khi đặt món.`, "success");

  // Đổi nhãn nút trong chốc lát để khách thấy phản hồi ngay tại chỗ
  const label = button.querySelector("span");
  if (!label || button.classList.contains("is-copied")) return;
  const original = label.textContent;
  button.classList.add("is-copied");
  label.textContent = "Đã chép";
  setTimeout(() => {
    button.classList.remove("is-copied");
    label.textContent = original;
  }, 1600);
}

/* =========================================================
   KHU VỰC KHÁCH CHƯA ĐĂNG NHẬP
   ========================================================= */

function showAlert(el, message, type = "error") {
  const icon = type === "error" ? ICONS.alertCircle(16) : ICONS.info(16);
  el.className = `auth-alert is-${type}`;
  el.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
  el.hidden = false;
}

function hideAlert(el) {
  el.hidden = true;
  el.innerHTML = "";
}

/** Chuyển tab Đăng nhập / Đăng ký; ghi lại lên URL để tải lại trang vẫn đúng tab */
function switchTab(name, { focus = false, updateUrl = true } = {}) {
  const target = name === "register" ? "register" : "login";
  document.querySelectorAll(".auth-tab").forEach((tab) => {
    const active = tab.dataset.tab === target;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active && focus) tab.focus();
  });
  document.getElementById("panel-login").hidden = target !== "login";
  document.getElementById("panel-register").hidden = target !== "register";

  if (updateUrl) {
    const url = new URL(window.location.href);
    if (target === "register") url.searchParams.set("tab", "register");
    else url.searchParams.delete("tab");
    history.replaceState(null, "", url);
  }
}

function setupTabs() {
  const tabs = [...document.querySelectorAll(".auth-tab")];
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    // Bàn phím: ← → chuyển tab, Home/End về tab đầu/cuối (chuẩn WAI-ARIA tablist)
    tab.addEventListener("keydown", (e) => {
      const moves = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
      if (!(e.key in moves)) return;
      e.preventDefault();
      const next = tabs[(moves[e.key] + tabs.length) % tabs.length];
      switchTab(next.dataset.tab, { focus: true });
    });
  });

  document.querySelectorAll("[data-go-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.goTab, { focus: true });
      els.guest.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

/** Ô "Hiện mật khẩu": đổi kiểu input của mọi ô mật khẩu trong form tương ứng */
function setupPasswordToggles() {
  document.querySelectorAll("[data-show-password]").forEach((box) => {
    const form = document.getElementById(box.dataset.showPassword);
    if (!form) return;
    const setVisible = (visible) => {
      form.querySelectorAll('input[name="password"], input[name="confirmPassword"]').forEach((input) => {
        input.type = visible ? "text" : "password";
      });
    };
    box.addEventListener("change", () => setVisible(box.checked));
    // form.reset() bỏ chọn ô nhưng không tự đổi lại kiểu input -> đồng bộ sau khi reset
    form.addEventListener("reset", () => setTimeout(() => setVisible(false), 0));
  });
}

/* ---------------- Đăng ký ---------------- */

/** Gợi ý trực tiếp dưới ô ngày sinh: tuổi hiện tại / cảnh báo chưa đủ 18 tuổi */
function updateBirthdayHint() {
  const hint = els.birthdayHint;
  const value = els.birthdayInput.value;
  if (!value) {
    hint.className = "field-hint is-warning";
    hint.textContent = DEFAULT_BIRTHDAY_HINT;
    return;
  }
  const problem = birthdayProblem(value);
  if (problem) {
    hint.className = "field-hint is-danger";
    hint.textContent = problem;
    return;
  }
  const next = birthdayInYear(value, new Date().getFullYear());
  hint.className = "field-hint is-ok";
  hint.textContent = `Bạn ${ageOf(value)} tuổi - đủ điều kiện trở thành thành viên. `
    + `Quà sinh nhật ${BIRTHDAY_DISCOUNT}% sẽ tự vào ví quanh ngày ${next ? formatDayMonth(next) : "sinh nhật"} mỗi năm.`;
}

/** Mật khẩu nhập lại phải khớp; trả true nếu hợp lệ */
function checkPasswordMatch() {
  const form = els.registerForm;
  const password = form.elements.namedItem("password");
  const confirm = form.elements.namedItem("confirmPassword");
  if (confirm.value && password.value !== confirm.value) {
    setFieldError(confirm, "Mật khẩu nhập lại không khớp.");
    return false;
  }
  if (confirm.value) setFieldError(confirm, "");
  return true;
}

/** Thông báo lỗi từ máy chủ nhắc tới ô nào thì tô đỏ ô đó cho khách dễ sửa */
const MESSAGE_FIELDS = [
  [/điện thoại|SĐT/i, "phone"],
  [/tuổi|ngày sinh|năm sinh/i, "birthday"],
  [/mật khẩu/i, "password"],
  [/email/i, "email"],
  [/họ tên|họ và tên/i, "name"],
];

function markFieldFromMessage(form, message) {
  const hit = MESSAGE_FIELDS.find(([pattern]) => pattern.test(message));
  const field = hit ? form.elements.namedItem(hit[1]) : null;
  if (field) {
    setFieldError(field, message);
    field.focus();
  }
}

async function handleRegister(e) {
  e.preventDefault();
  hideAlert(els.registerAlert);

  const form = els.registerForm;
  const { isValid, data } = validateForm(form);
  let ok = isValid;

  // Luật riêng không khai báo được bằng data-rule: đủ 18 tuổi, mật khẩu nhập lại khớp
  const birthdayField = form.elements.namedItem("birthday");
  if (data.birthday) {
    const problem = birthdayProblem(data.birthday);
    if (problem) {
      setFieldError(birthdayField, problem);
      ok = false;
    }
  }
  if (data.password && data.confirmPassword && !checkPasswordMatch()) ok = false;

  if (!ok) {
    const firstInvalid = form.querySelector(".invalid");
    if (firstInvalid) firstInvalid.focus();
    toast("Vui lòng kiểm tra lại thông tin đăng ký.", "error");
    return;
  }

  const restore = setButtonLoading(els.registerBtn, "Đang tạo tài khoản...");
  authBusy = true;
  try {
    const result = await registerAndLogin({
      name: data.name,
      phone: data.phone,
      email: data.email || "",
      birthday: data.birthday,
      password: data.password,
    });

    if (!result?.success) {
      const message = result?.message || "Đăng ký không thành công, vui lòng thử lại.";
      showAlert(els.registerAlert, message);
      markFieldFromMessage(form, message);
      return;
    }

    form.reset();
    clearFormErrors(form);
    updateBirthdayHint();

    const customer = result.customer || safeCurrentCustomer();
    toast(`Đăng ký thành công! Chào mừng ${escapeHtml(shortName(customer?.name || data.name))} đến với Quán Bar Đêm.`, "success");
    renderAccount();
    showWelcomeModal(customer || { name: data.name }, result.welcomeVoucher, result.birthdayVoucher);
  } catch (err) {
    const message = err?.message || "Đăng ký không thành công, vui lòng thử lại.";
    showAlert(els.registerAlert, message);
    markFieldFromMessage(form, message);
  } finally {
    authBusy = false;
    restore();
  }
}

/** Modal chúc mừng: hiển thị mã chào mừng (và mã sinh nhật nếu đăng ký đúng dịp) */
function showWelcomeModal(customer, welcomeVoucher, birthdayVoucher) {
  const code = welcomeVoucher?.code ? String(welcomeVoucher.code) : "";
  const percent = Number(welcomeVoucher?.percent) || WELCOME_DISCOUNT;
  const safeCode = escapeHtml(code);

  const codeBlock = code
    ? `
      <div class="welcome-code-card">
        <span class="welcome-code-label">Mã chào mừng của bạn</span>
        <code class="welcome-code">${safeCode}</code>
        <div class="welcome-code-meta">
          <span><strong>-${percent}%</strong> đơn đầu tiên</span>
          <span>${escapeHtml(expiryText(welcomeVoucher))}</span>
          <span>Dùng 1 lần</span>
        </div>
      </div>`
    : `
      <p class="auth-alert is-info">${ICONS.info(16)}<span>Mã chào mừng giảm ${percent}% (hạn ${WELCOME_VALID_DAYS} ngày)
        đang được chuẩn bị - bạn sẽ thấy mã trong "Ví mã giảm giá của tôi".</span></p>`;

  const birthdayBlock = birthdayVoucher?.code
    ? `<p class="welcome-bday">${ICON_GIFT(18)}<span>Thật đúng dịp sinh nhật! Ví của bạn có thêm mã
        <strong>${escapeHtml(birthdayVoucher.code)}</strong> giảm ${Number(birthdayVoucher.percent) || BIRTHDAY_DISCOUNT}%.</span></p>`
    : "";

  els.welcomeBody.innerHTML = `
    <div class="welcome-head">
      <div class="welcome-burst" aria-hidden="true">${ICON_GIFT(30)}</div>
      <span class="panel-kicker">WELCOME TO THE CLUB</span>
      <h3 id="welcome-title">Chúc mừng ${escapeHtml(customer?.name || "bạn")} đã trở thành thành viên!</h3>
      <p class="text-muted">Quán Bar Đêm gửi tặng bạn món quà chào mừng - hãy dùng cho lần đặt bàn &amp; gọi món đầu tiên.</p>
    </div>
    ${codeBlock}
    ${birthdayBlock}
    <div class="welcome-actions">
      ${code ? `
        <button type="button" class="btn btn-ghost" data-copy-code="${safeCode}">${ICON_COPY(16)} <span>Sao chép mã</span></button>
        <a class="btn btn-primary" href="${orderLink(code)}">${ICONS.shoppingBag(16)} Dùng ngay</a>` : ""}
      <button type="button" class="btn btn-outline" data-close-modal="welcome-modal" data-scroll-to="wallet">Xem ví của tôi</button>
    </div>`;

  openModal("welcome-modal");
  const focusTarget = els.welcomeBody.querySelector("[data-copy-code], [data-close-modal]");
  if (focusTarget) setTimeout(() => focusTarget.focus(), 50);
}

/* ---------------- Đăng nhập ---------------- */

/** Toast chúc mừng khi thành viên đăng nhập trong tuần sinh nhật */
function announceBirthday(customer, birthdayVoucher) {
  if (!customer) return;
  const member = new Customer(customer);
  if (!member.isInBirthdayWindow && !birthdayVoucher) return;

  const greeting = member.isBirthdayToday ? "Chúc mừng sinh nhật" : "Chúc bạn một tuần sinh nhật thật vui";
  const name = escapeHtml(shortName(member.name));
  if (birthdayVoucher?.code && voucherState(birthdayVoucher) === "usable") {
    const percent = Number(birthdayVoucher.percent) || BIRTHDAY_DISCOUNT;
    toast(`${greeting}, ${name}! Quà của bạn: mã <strong>${escapeHtml(birthdayVoucher.code)}</strong> giảm ${percent}%.`, "success");
  } else if (member.isBirthdayToday) {
    toast(`${greeting}, ${name}! Cảm ơn bạn đã ghé Quán Bar Đêm trong ngày đặc biệt này.`, "success");
  }
}

async function handleLogin(e) {
  e.preventDefault();
  hideAlert(els.loginAlert);

  const { isValid, data } = validateForm(els.loginForm);
  if (!isValid) return;

  const restore = setButtonLoading(els.loginBtn, "Đang đăng nhập...");
  authBusy = true;
  try {
    const result = await loginCustomer(data.phone, data.password);
    if (!result?.success) {
      showAlert(els.loginAlert, result?.message || "Số điện thoại hoặc mật khẩu không đúng.");
      const passwordField = els.loginForm.elements.namedItem("password");
      passwordField.value = "";
      passwordField.focus();
      return;
    }

    els.loginForm.reset();
    clearFormErrors(els.loginForm);

    const customer = result.customer || safeCurrentCustomer();
    toast(`Chào mừng trở lại, ${escapeHtml(shortName(customer?.name))}!`, "success");
    announceBirthday(customer, result.birthdayVoucher);
    renderAccount();

    // Được gửi sang từ trang khác (VD account.html?next=order.html) -> đưa khách quay lại
    const next = safeNextPage(getQueryParam("next"));
    if (next) setTimeout(() => window.location.assign(next), 1200);
  } catch (err) {
    showAlert(els.loginAlert, err?.message || "Không đăng nhập được, vui lòng thử lại.");
  } finally {
    authBusy = false;
    restore();
  }
}

function setupForms() {
  els.loginForm.addEventListener("submit", handleLogin);
  els.registerForm.addEventListener("submit", handleRegister);

  // Ô ngày sinh: không cho chọn ngày làm khách chưa đủ 18 tuổi trên bộ chọn ngày
  const latest = new Date();
  latest.setFullYear(latest.getFullYear() - ADULT_AGE);
  els.birthdayInput.max = toInputDate(latest);
  ["input", "change"].forEach((evt) => els.birthdayInput.addEventListener(evt, updateBirthdayHint));

  // Kiểm tra mật khẩu nhập lại NGAY KHI GÕ (không đợi rời ô: báo lỗi lúc blur làm nút
  // "Tạo tài khoản" bị đẩy xuống đúng lúc khách bấm -> cú bấm trượt khỏi nút).
  // setTimeout 0: chạy SAU bộ kiểm tra data-rule của validation.js (nó xoá lỗi khi luật "required" đạt).
  const confirm = els.registerForm.elements.namedItem("confirmPassword");
  const password = els.registerForm.elements.namedItem("password");
  const liveMatch = () => setTimeout(() => {
    // Chỉ báo "không khớp" khi khách đã gõ đủ độ dài, tránh báo lỗi giữa chừng từng ký tự
    if (confirm.value.length >= password.value.length || !confirm.value) checkPasswordMatch();
    else setFieldError(confirm, "");
  }, 0);
  confirm.addEventListener("input", liveMatch);
  password.addEventListener("input", () => { if (confirm.value) liveMatch(); });

  // Điền sẵn tài khoản demo cho buổi chấm đồ án
  const demoBtn = document.getElementById("fill-demo-btn");
  if (demoBtn) {
    demoBtn.addEventListener("click", () => {
      els.loginForm.elements.namedItem("phone").value = "0981234567";
      els.loginForm.elements.namedItem("password").value = "123456";
      clearFormErrors(els.loginForm);
      els.loginBtn.focus();
    });
  }

  setupPasswordToggles();
}

/** Điền mức % thật từ vouchersService vào các chỗ ghi sẵn trong HTML */
function fillPromoNumbers() {
  document.querySelectorAll('[data-promo="welcome-pct"]').forEach((el) => { el.textContent = `${WELCOME_DISCOUNT}%`; });
  document.querySelectorAll('[data-promo="birthday-pct"]').forEach((el) => { el.textContent = `${BIRTHDAY_DISCOUNT}%`; });
}

/* =========================================================
   KHU VỰC THÀNH VIÊN ĐÃ ĐĂNG NHẬP
   ========================================================= */

function profileCardHtml(member) {
  const born = parseDay(member.birthday);
  const age = member.age;
  const joinedDays = dayNumber(new Date()) - dayNumber(member.createdAt);
  const joinedText = Number.isNaN(joinedDays)
    ? "—"
    : `${formatDate(member.createdAt)} · ${joinedDays <= 0 ? "hôm nay" : `${joinedDays} ngày`}`;

  const badges = [
    member.isNewMember
      ? `<span class="member-badge is-new">${ICONS.sparkle(12)} Thành viên mới</span>`
      : `<span class="member-badge">${ICONS.star(12)} Thành viên</span>`,
    member.isInBirthdayWindow ? `<span class="member-badge is-birthday">${ICON_CAKE(12)} Tuần sinh nhật</span>` : "",
  ].join("");

  return `
    <aside class="member-card" aria-label="Hồ sơ thành viên">
      <div class="member-avatar" aria-hidden="true">${escapeHtml(initialsOf(member.name))}</div>
      <span class="member-hello">Xin chào,</span>
      <h2 class="member-name">${escapeHtml(member.name || "Thành viên")}</h2>
      <div class="member-badges">${badges}</div>

      <dl class="member-info">
        <div>
          <dt>${ICONS.phone(14)} Số điện thoại</dt>
          <dd>${escapeHtml(formatPhone(member.phone))}</dd>
        </div>
        <div>
          <dt>${ICONS.mail(14)} Email</dt>
          <dd>${member.email ? escapeHtml(member.email) : '<span class="text-dim">Chưa cập nhật</span>'}</dd>
        </div>
        <div>
          <dt>${ICON_CAKE(14)} Sinh nhật</dt>
          <dd>${born ? formatDay(born) : "—"}</dd>
        </div>
        <div>
          <dt>${ICONS.user(14)} Tuổi</dt>
          <dd>${Number.isFinite(age) ? `${age} tuổi` : "—"}</dd>
        </div>
        <div>
          <dt>${ICONS.calendar(14)} Ngày tham gia</dt>
          <dd>${escapeHtml(joinedText)}</dd>
        </div>
      </dl>

      <div class="member-actions">
        <a href="order.html" class="btn btn-primary btn-block">${ICONS.shoppingBag(16)} Đặt bàn &amp; gọi món</a>
        <a href="sale.html" class="btn btn-outline btn-block">${ICONS.sparkle(15)} Xem khuyến mãi</a>
        <button type="button" class="btn btn-ghost btn-block" data-action="logout">${ICONS.logout(16)} Đăng xuất</button>
      </div>
    </aside>`;
}

/**
 * Phân loại tình trạng sinh nhật hôm nay:
 *  today   - đúng ngày sinh nhật
 *  soon    - sắp tới (còn 1..7 ngày, đã trong cửa sổ nhận quà)
 *  after   - vừa qua (đã qua 1..7 ngày, quà vẫn còn hiệu lực)
 *  waiting - còn xa, chưa tới cửa sổ nhận quà
 *  invalid - ngày sinh lỗi
 */
function birthdayStatus(member) {
  const days = member.daysUntilBirthday;
  if (days === null || days === undefined || Number.isNaN(Number(days))) return { kind: "invalid" };
  if (days === 0) return { kind: "today", days: 0 };
  if (member.isInBirthdayWindow) {
    if (days <= BIRTHDAY_WINDOW) return { kind: "soon", days };
    return { kind: "after", days, since: daysSinceLastBirthday(member.birthday) ?? 0 };
  }
  return { kind: "waiting", days };
}

/** Phần quà bên dưới lời chúc (chỉ khi đang trong cửa sổ sinh nhật) */
function birthdayGiftHtml(state, voucher) {
  if (state === "loading") {
    return `<div class="bday-gift is-loading"><span class="btn-spinner" aria-hidden="true"></span> Đang chuẩn bị quà sinh nhật cho bạn...</div>`;
  }
  if (state === "error" || !voucher) {
    return `
      <div class="bday-gift is-error">
        ${ICONS.alertCircle(16)}
        <span>Chưa nhận được mã quà sinh nhật (máy chủ chưa phản hồi).</span>
        <button type="button" class="link-button" data-action="retry-birthday">Thử lại</button>
      </div>`;
  }

  const status = voucherState(voucher);
  const code = `<strong>${escapeHtml(voucher.code)}</strong>`;
  if (status === "used") {
    return `<div class="bday-gift is-done">${ICONS.checkCircle(16)} <span>Bạn đã dùng mã ${code} - cảm ơn bạn đã đón sinh nhật cùng quán!</span></div>`;
  }
  if (status === "expired" || status === "unavailable") {
    return `<div class="bday-gift is-done">${ICONS.info(16)} <span>Mã ${code} đã hết hiệu lực. Hẹn gặp lại bạn vào sinh nhật năm sau!</span></div>`;
  }
  return `<div class="bday-gift">${voucherTicketHtml(voucher, { personal: true })}</div>`;
}

function birthdayPanelHtml(member, { state = "ready", voucher = null } = {}) {
  const status = birthdayStatus(member);
  const firstName = escapeHtml(shortName(member.name));

  if (status.kind === "invalid") {
    return `
      <div class="bday-layout is-invalid">
        <div class="bday-content">
          <span class="panel-kicker">SINH NHẬT</span>
          <h3 id="birthday-title">Chưa có ngày sinh hợp lệ</h3>
          <p class="bday-desc">Liên hệ quán để cập nhật ngày sinh và nhận quà sinh nhật giảm ${BIRTHDAY_DISCOUNT}% mỗi năm.</p>
        </div>
      </div>`;
  }

  const next = member.nextBirthday;
  const nextText = next ? formatDayMonth(next) : "";
  let title;
  let desc;
  let center;
  let progress;

  if (status.kind === "today") {
    title = `Chúc mừng sinh nhật, ${firstName}!`;
    desc = `Cả quầy bar nâng ly chúc bạn tuổi mới rực rỡ. Quà tặng: giảm ${BIRTHDAY_DISCOUNT}% cho một đơn bất kỳ, dùng tới hết 7 ngày sau sinh nhật.`;
    center = `${ICON_GIFT(30)}<span>Hôm nay</span>`;
    progress = 100;
  } else if (status.kind === "soon") {
    title = `Còn ${status.days} ngày nữa là sinh nhật bạn`;
    desc = `Sinh nhật ${nextText} sắp tới - quà giảm ${BIRTHDAY_DISCOUNT}% đã sẵn sàng, dùng được ngay từ hôm nay đến hết 7 ngày sau sinh nhật.`;
    center = `<strong>${status.days}</strong><span>ngày nữa</span>`;
    progress = Math.round(((BIRTHDAY_WINDOW - status.days + 1) / (BIRTHDAY_WINDOW + 1)) * 100);
  } else if (status.kind === "after") {
    title = `Sinh nhật vừa qua ${status.since} ngày`;
    desc = `Chúc ${firstName} tuổi mới thật nhiều niềm vui! Quà sinh nhật giảm ${BIRTHDAY_DISCOUNT}% vẫn còn hiệu lực trong ví của bạn.`;
    center = `<strong>${status.since}</strong><span>ngày trước</span>`;
    progress = 100;
  } else {
    const opensOn = next ? new Date(next.getFullYear(), next.getMonth(), next.getDate() - BIRTHDAY_WINDOW) : null;
    title = `Còn ${status.days} ngày tới sinh nhật`;
    desc = `Sinh nhật của bạn: ${nextText}. Từ ${opensOn ? formatDay(opensOn) : "7 ngày trước sinh nhật"}, `
      + `mã quà giảm ${BIRTHDAY_DISCOUNT}% sẽ tự vào ví khi bạn đăng nhập hoặc mở trang này.`;
    center = `<strong>${status.days}</strong><span>ngày nữa</span>`;
    progress = Math.max(2, Math.round((1 - status.days / 366) * 100));
  }

  const inWindow = status.kind !== "waiting";
  return `
    <div class="bday-layout is-${status.kind}">
      <div class="bday-ring" style="--progress: ${progress}" role="img" aria-label="${escapeHtml(title)}">
        <div class="bday-ring-inner">${center}</div>
      </div>
      <div class="bday-content">
        <span class="panel-kicker">${ICON_CAKE(13)} SINH NHẬT</span>
        <h3 id="birthday-title">${title}</h3>
        <p class="bday-desc">${desc}</p>
        ${inWindow ? birthdayGiftHtml(state, voucher) : ""}
      </div>
    </div>`;
}

/** Một nhóm mã trong ví (mã cá nhân / mã công khai) */
function walletGroupHtml({ title, hint, list, personal, failed, emptyHtml }) {
  let content;
  if (failed) {
    content = `
      <p class="wallet-empty is-error">${ICONS.alertCircle(16)} <span>Chưa tải được danh sách này.</span>
        <button type="button" class="link-button" data-action="retry-wallet">Thử lại</button></p>`;
  } else if (!list.length) {
    content = `<p class="wallet-empty">${emptyHtml}</p>`;
  } else {
    content = `<div class="wallet-list">${list.map((v) => voucherTicketHtml(v, { personal })).join("")}</div>`;
  }
  return `
    <div class="wallet-group">
      <div class="wallet-group-head">
        <h4>${title}</h4>
        <span>${hint}</span>
      </div>
      ${content}
    </div>`;
}

function renderWallet(personalResult, publicResult) {
  const body = document.getElementById("wallet-body");
  const countEl = document.getElementById("wallet-count");
  if (!body) return;

  if (personalResult.status === "rejected" && publicResult.status === "rejected") {
    const reason = publicResult.reason?.message || "Máy chủ chưa phản hồi.";
    body.innerHTML = `
      ${errorHtml(escapeHtml(reason))}
      <div class="text-center"><button type="button" class="btn btn-ghost btn-sm" data-action="retry-wallet">${ICONS.refresh(14)} Thử lại</button></div>`;
    if (countEl) countEl.hidden = true;
    return;
  }

  const personal = personalResult.status === "fulfilled" ? personalResult.value || [] : [];
  const publicList = publicResult.status === "fulfilled" ? publicResult.value || [] : [];
  const total = personal.length + publicList.length;
  if (countEl) {
    countEl.hidden = false;
    countEl.textContent = `${total} mã khả dụng`;
  }

  body.innerHTML = [
    walletGroupHtml({
      title: `${ICON_GIFT(16)} Quà tặng riêng cho bạn`,
      hint: "Chỉ tài khoản của bạn dùng được",
      list: personal,
      personal: true,
      failed: personalResult.status === "rejected",
      emptyHtml: `Chưa có mã cá nhân nào còn hiệu lực. Mã quà sinh nhật giảm ${BIRTHDAY_DISCOUNT}% sẽ tự vào ví trong tuần sinh nhật của bạn.`,
    }),
    walletGroupHtml({
      title: `${ICONS.sparkle(16)} Mã công khai đang phát hành`,
      hint: "Ai cũng dùng được khi đủ điều kiện",
      list: publicList,
      personal: false,
      failed: publicResult.status === "rejected",
      emptyHtml: 'Hiện chưa có mã công khai nào. Ghé <a href="sale.html">trang Khuyến mãi</a> để cập nhật ưu đãi mới nhất.',
    }),
  ].join("");
}

/** Gọi ensureBirthdayVoucher tối đa 1 lần đồng thời cho mỗi khách (chống tạo trùng mã) */
function ensureBirthdayOnce(customer, { fresh = false } = {}) {
  const key = String(customer.id);
  if (fresh) birthdayRequests.delete(key);
  if (!birthdayRequests.has(key)) {
    const request = Promise.resolve(ensureBirthdayVoucher(customer)).catch((err) => {
      birthdayRequests.delete(key); // lỗi -> lần sau được thử lại
      throw err;
    });
    birthdayRequests.set(key, request);
  }
  return birthdayRequests.get(key);
}

async function loadBirthday(customer, member, token, { fresh = false } = {}) {
  const panel = document.getElementById("birthday-panel");
  if (panel && fresh) panel.innerHTML = birthdayPanelHtml(member, { state: "loading" });

  let state = "ready";
  let voucher = null;
  try {
    voucher = await ensureBirthdayOnce(customer, { fresh });
  } catch (err) {
    state = "error";
    console.warn("[account] Không phát/đọc được mã sinh nhật:", err);
  }
  if (token !== renderToken) return;
  const target = document.getElementById("birthday-panel");
  if (target) target.innerHTML = birthdayPanelHtml(member, { state, voucher });
}

async function loadWallet(customer, token) {
  const body = document.getElementById("wallet-body");
  if (!body) return;
  body.innerHTML = loadingHtml("Đang mở ví mã giảm giá...");

  const [personalResult, publicResult] = await Promise.allSettled([
    getCustomerVouchers(customer.id),
    getPublicVouchers(),
  ]);
  if (token !== renderToken) return;
  renderWallet(personalResult, publicResult);
}

/**
 * Tải phần cần gọi API của trang thành viên.
 * Mã sinh nhật phải phát XONG trước khi đọc ví - để mã vừa tạo xuất hiện ngay trong ví.
 */
async function loadMemberExtras(customer, member, token) {
  await loadBirthday(customer, member, token);
  if (token !== renderToken) return;
  await loadWallet(customer, token);
}

function showMember(customer, token) {
  const member = new Customer(customer);
  els.guest.hidden = true;
  els.member.hidden = false;
  els.member.innerHTML = `
    <div class="account-dashboard">
      ${profileCardHtml(member)}
      <div class="member-main">
        <section class="member-panel birthday-panel" id="birthday-panel" aria-labelledby="birthday-title" aria-live="polite">
          ${birthdayPanelHtml(member, { state: "loading" })}
        </section>

        <section class="member-panel wallet-panel" id="wallet" aria-labelledby="wallet-title">
          <div class="panel-head">
            <div>
              <span class="panel-kicker">MY WALLET</span>
              <h3 id="wallet-title">Ví mã giảm giá của tôi</h3>
            </div>
            <span class="wallet-count" id="wallet-count" hidden></span>
          </div>
          <div id="wallet-body" aria-live="polite">${loadingHtml("Đang mở ví mã giảm giá...")}</div>
          <p class="wallet-note">${ICONS.info(14)} <span>Mỗi đơn áp dụng 1 mã. Mức giảm tính trên tạm tính
            (giá món đã trừ sale theo món); mã có "Giảm tối đa" sẽ không vượt quá số tiền đó.</span></p>
        </section>
      </div>
    </div>`;

  if (window.location.hash === "#wallet") {
    requestAnimationFrame(() => document.getElementById("wallet")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  loadMemberExtras(customer, member, token);
}

/* =========================================================
   ĐIỀU PHỐI TRẠNG THÁI TRANG
   ========================================================= */

/** Vẽ đúng giao diện theo phiên đăng nhập hiện tại */
function renderAccount() {
  const customer = safeCurrentCustomer();
  renderedCustomerId = customer ? String(customer.id) : "";
  renderToken += 1;
  els.loading.hidden = true;

  if (!customer) {
    els.member.hidden = true;
    els.member.innerHTML = "";
    els.guest.hidden = false;
    return;
  }
  showMember(customer, renderToken);
}

/** Phiên đổi từ nơi khác (navbar, tab khác...) -> vẽ lại nếu thật sự khác người đang hiển thị */
function syncWithSession() {
  if (authBusy) return;
  const id = safeCurrentCustomer()?.id;
  if (String(id ?? "") !== renderedCustomerId) renderAccount();
}

async function handleLogout() {
  const ok = await confirmDialog("Bạn muốn đăng xuất khỏi tài khoản thành viên trên trình duyệt này?", {
    title: "Đăng xuất",
    okText: "Đăng xuất",
    danger: false,
  });
  if (!ok) return;

  authBusy = true;
  try {
    await logoutCustomer();
  } catch (err) {
    console.warn("[account] Lỗi khi đăng xuất:", err);
  } finally {
    authBusy = false;
  }
  birthdayRequests.clear();
  toast("Bạn đã đăng xuất. Hẹn gặp lại tại Quán Bar Đêm!", "info");
  switchTab("login");
  renderAccount();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/** Sự kiện dùng chung cho toàn trang (gắn 1 lần, nội dung vẽ lại vẫn nhận được) */
function setupDelegatedEvents() {
  document.addEventListener("click", (e) => {
    const copyBtn = e.target.closest("[data-copy-code]");
    if (copyBtn) {
      handleCopy(copyBtn);
      return;
    }

    const closeBtn = e.target.closest("[data-close-modal]");
    if (closeBtn) {
      closeModal(closeBtn.dataset.closeModal);
      const scrollId = closeBtn.dataset.scrollTo;
      if (scrollId) {
        setTimeout(() => document.getElementById(scrollId)?.scrollIntoView({ behavior: "smooth", block: "start" }), 220);
      }
      return;
    }

    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    const customer = safeCurrentCustomer();

    if (action === "logout") {
      handleLogout();
    } else if (action === "retry-wallet" && customer) {
      loadWallet(customer, renderToken);
    } else if (action === "retry-birthday" && customer) {
      const token = renderToken;
      loadBirthday(customer, new Customer(customer), token, { fresh: true })
        .then(() => (token === renderToken ? loadWallet(customer, token) : null));
    }
  });
}

/* =========================================================
   KHỞI ĐỘNG TRANG
   ========================================================= */

function init() {
  fillPromoNumbers();
  setupTabs();
  setupForms();
  setupDelegatedEvents();
  switchTab(getQueryParam("tab") === "register" ? "register" : "login", { updateUrl: false });
  renderAccount();

  window.addEventListener("customerchange", syncWithSession);
  // Đăng nhập / đăng xuất ở tab khác -> localStorage đổi -> trình duyệt phát "storage" cho tab này
  window.addEventListener("storage", (e) => {
    if (!e.key || e.key.endsWith("customer_session")) syncWithSession();
  });
}

init();

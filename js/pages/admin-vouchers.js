/* =========================================================
   ADMIN-VOUCHERS.JS - Quản lý mã giảm giá & chương trình Sale
     Đọc   : GET    /vouchers   (+ /customers để biết mã cá nhân của ai,
                                  + /drinks để đếm món mới đang được giảm)
     Thêm  : POST   /vouchers
     Sửa   : PATCH  /vouchers/:id   (cả nút Bật / Tắt)
     Xoá   : DELETE /vouchers/:id
   Mức giảm chỉ chọn trong các "loại sale" cố định (10, 15, 20, 25,
   30, 35, 40, 50%) - đúng yêu cầu "sale loại 10, 15, 25, 30, 35...".
   ========================================================= */

import { initAdminLayout } from "../modules/adminLayout.js";
import {
  getAllVouchers, addVoucher, updateVoucher, deleteVoucher, filterVouchers, generateVoucherCode,
  describeTimeLeft, normalizeCode, Voucher, DISCOUNT_TIERS, VOUCHER_AUDIENCES, VOUCHER_STATUS,
  VOUCHER_CODE_PATTERN, BIRTHDAY_DISCOUNT, WELCOME_DISCOUNT, WELCOME_VALID_DAYS,
} from "../modules/vouchersService.js";
import { getAllCustomers, toDateKey, BIRTHDAY_WINDOW_DAYS } from "../modules/customersService.js";
import { getAllDrinks, isNewDrink, NEW_DRINK_DAYS, NEW_DRINK_DISCOUNT } from "../modules/drinksService.js";
import { formatMoney, formatDate, debounce, paginate, renderPagination, escapeHtml, truncate } from "../modules/utils.js";
import { validateForm, clearFormErrors, setFieldError } from "../modules/validation.js";
import { toast, confirmDialog, openModal, closeModal, setButtonLoading, errorHtml } from "../modules/ui.js";
import { ICONS } from "../modules/icons.js";

/* ---------------- Biểu tượng riêng của trang (icons.js chưa có) ---------------- */
const svg = (paths, size = 18) => `
  <svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const TICKET_ICON = (s) => svg('<path d="M3 9a3 3 0 0 0 0 6v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a3 3 0 0 0 0-6V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"/><path d="M14 4v2m0 4v4m0 4v2"/>', s);
const GIFT_ICON = (s) => svg('<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>', s);
const POWER_ICON = (s) => svg('<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>', s);
const USER_PLUS_ICON = (s) => svg('<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>', s);

const PER_PAGE = 8;
const TABLE_COLUMNS = 9;

/* ---------------- Phần tử giao diện ---------------- */
const statsEl = document.getElementById("voucher-stats");
const autoGridEl = document.getElementById("promo-auto-grid");
const bodyEl = document.getElementById("vouchers-body");
const paginationEl = document.getElementById("pagination");
const resultCountEl = document.getElementById("result-count");
const keywordInput = document.getElementById("f-keyword");
const audienceSelect = document.getElementById("f-audience");
const statusSelect = document.getElementById("f-status");
const percentSelect = document.getElementById("f-percent");

const formEl = document.getElementById("voucher-form");
const modalTitle = document.getElementById("voucher-modal-title");
const submitBtn = document.getElementById("voucher-form-submit");
const previewEl = document.getElementById("vf-preview");
const limitHintEl = document.getElementById("vf-limit-hint");

/* ---------------- Trạng thái trang ---------------- */
let allVouchers = [];
/** id khách -> tên khách (hiển thị chủ của mã cá nhân, tìm theo tên khách) */
let customerNames = new Map();
let customers = [];
/** Số món mới đang được giảm tự động; null = chưa tải được thực đơn */
let newDrinkCount = null;
let currentPage = 1;
/** Mã đang sửa (null = đang tạo mới) */
let editing = null;

/* =========================================================
   CHUYỂN ĐỔI NGÀY: ô <input type="date"> <-> ISO
   Ngày bắt đầu tính từ 00:00, ngày kết thúc tới 23:59:59 giờ địa phương.
   ========================================================= */
function dateKeyToIso(key, endOfDay = false) {
  const [y, m, d] = key.split("-").map(Number);
  const date = endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d, 0, 0, 0, 0);
  return date.toISOString();
}

function isoToDateKey(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : toDateKey(d);
}

/* =========================================================
   THỐNG KÊ + CHƯƠNG TRÌNH TỰ ĐỘNG
   ========================================================= */
function renderStats() {
  const year = new Date().getFullYear();
  const cards = [
    { icon: TICKET_ICON(22), value: allVouchers.length, label: "Tổng số mã" },
    { icon: ICONS.checkCircle(22), value: allVouchers.filter((v) => v.isUsable).length, label: "Đang hiệu lực", accent: "success" },
    { icon: ICONS.receipt(22), value: allVouchers.reduce((sum, v) => sum + v.usedCount, 0), label: "Tổng lượt đã dùng" },
    {
      icon: GIFT_ICON(22),
      value: allVouchers.filter((v) => v.audience === "birthday" && v.birthdayYear === year).length,
      label: `Mã sinh nhật năm ${year}`,
      accent: "birthday",
    },
  ];

  statsEl.innerHTML = cards.map((c) => `
    <div class="stat-card${c.accent ? ` promo-stat-${c.accent}` : ""}">
      <div class="stat-icon-wrapper">${c.icon}</div>
      <div class="stat-details">
        <strong class="stat-value">${c.value}</strong>
        <span class="stat-label">${c.label}</span>
      </div>
    </div>`).join("");
}

function renderAutoPrograms() {
  const year = new Date().getFullYear();
  const welcome = allVouchers.filter((v) => v.isPersonal && v.audience === "new-customer");
  const birthdayThisYear = allVouchers.filter((v) => v.audience === "birthday" && v.birthdayYear === year);
  const publicNewCodes = allVouchers
    .filter((v) => !v.isPersonal && v.audience === "new-customer" && v.isUsable)
    .map((v) => `<span class="voucher-code voucher-code-sm">${escapeHtml(v.code)}</span>`);
  const inWindow = customers.filter((c) => c.isInBirthdayWindow).length;

  const programs = [
    {
      icon: ICONS.sparkle(18),
      percent: NEW_DRINK_DISCOUNT,
      title: "Sale món mới",
      desc: `Món ra mắt trong ${NEW_DRINK_DAYS} ngày đầu tự động giảm ${NEW_DRINK_DISCOUNT}% trên thực đơn
             (món đang có sale riêng thì lấy mức giảm cao hơn).`,
      meta: newDrinkCount === null ? "Chưa tải được thực đơn" : `${newDrinkCount} món đang được giảm`,
      link: { href: "admin-menu.html", text: "Quản lý thực đơn" },
    },
    {
      icon: USER_PLUS_ICON(18),
      percent: WELCOME_DISCOUNT,
      title: "Khách hàng mới",
      desc: `Đăng ký thành viên nhận ngay mã cá nhân <strong>CHAO••••</strong> giảm ${WELCOME_DISCOUNT}% cho đơn đầu tiên
             (hạn ${WELCOME_VALID_DAYS} ngày, dùng 1 lần). Khách vãng lai dùng mã công khai
             ${publicNewCodes.length ? publicNewCodes.join(" ") : "<em>(chưa có mã nào đang bật)</em>"}.`,
      meta: `${welcome.length} mã chào mừng đã phát · ${welcome.filter((v) => v.usedCount > 0).length} đã dùng`,
      link: { href: "admin-customers.html?group=new", text: "Thành viên mới" },
    },
    {
      icon: GIFT_ICON(18),
      percent: BIRTHDAY_DISCOUNT,
      title: "Quà sinh nhật",
      desc: `Thành viên đăng nhập trong khoảng ${BIRTHDAY_WINDOW_DAYS} ngày trước / sau sinh nhật tự nhận mã
             <strong>SN${String(year).slice(-2)}••••</strong> giảm ${BIRTHDAY_DISCOUNT}%, dùng 1 lần, hạn tới
             ${BIRTHDAY_WINDOW_DAYS} ngày sau sinh nhật. Mỗi năm mỗi khách 1 mã.`,
      meta: `${birthdayThisYear.length} mã năm ${year} · ${inWindow} khách đang trong tuần sinh nhật`,
      link: { href: "admin-customers.html?group=birthday-soon", text: "Khách sắp sinh nhật" },
    },
  ];

  autoGridEl.innerHTML = programs.map((p) => `
    <article class="promo-program">
      <div class="promo-program-head">
        <span class="promo-program-icon">${p.icon}</span>
        <span class="promo-program-percent">-${p.percent}%</span>
      </div>
      <h4 class="promo-program-title">${p.title}</h4>
      <p class="promo-program-desc">${p.desc}</p>
      <div class="promo-program-foot">
        <span class="promo-program-meta">${p.meta}</span>
        <a class="panel-link" href="${p.link.href}">${p.link.text} ${ICONS.arrowRight(12)}</a>
      </div>
    </article>`).join("");
}

/* =========================================================
   BẢNG DANH SÁCH MÃ
   ========================================================= */
function usageHtml(v) {
  if (!v.usageLimit) {
    return `<span class="promo-usage"><strong>${v.usedCount}</strong> / ∞</span>`;
  }
  const ratio = Math.min(100, Math.round((v.usedCount / v.usageLimit) * 100));
  return `
    <span class="promo-usage"><strong>${v.usedCount}</strong> / ${v.usageLimit}</span>
    <span class="promo-meter${ratio >= 100 ? " is-full" : ratio >= 80 ? " is-high" : ""}" role="img"
          aria-label="Đã dùng ${ratio}%"><span style="width: ${ratio}%"></span></span>`;
}

/** Date -> "dd/mm", "dd/mm/yy" hoặc "dd/mm/yyyy" (tự ghép, không phụ thuộc định dạng của trình duyệt) */
function shortDate(date, year = "full") {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  if (year === "none") return `${dd}/${mm}`;
  return `${dd}/${mm}/${year === "short" ? String(date.getFullYear()).slice(-2) : date.getFullYear()}`;
}

/**
 * Thời hạn gọn cho bảng: cùng năm -> "14/10 → 21/10/2026";
 * khác năm -> "24/09/26 → 13/01/27"; không có ngày kết thúc -> "14/10/2026 → Không hạn".
 */
function periodHtml(v) {
  const start = v.startTime;
  const end = v.endTime;
  const sameYear = start && end && start.getFullYear() === end.getFullYear();
  const startText = start ? shortDate(start, !end ? "full" : sameYear ? "none" : "short") : "Ngay";
  const endText = end ? shortDate(end, sameYear || !start ? "full" : "short") : "Không hạn";
  const sub = v.status === "upcoming" ? `Bắt đầu ${formatDate(v.startDate)}` : describeTimeLeft(v);
  return `<div>${startText} → ${endText}</div><div class="text-xs text-muted">${sub}</div>`;
}

function rowHtml(v) {
  const owner = v.isPersonal ? customerNames.get(v.customerId) : "";
  const ownerHtml = v.isPersonal
    ? `<div class="promo-owner text-xs">${ICONS.user(11)} ${owner ? escapeHtml(owner) : "<em>Khách đã xoá</em>"}</div>`
    : "";

  return `
    <tr data-id="${escapeHtml(v.id)}" class="${v.isUsable ? "" : "promo-row-muted"}">
      <td>
        <span class="voucher-code">${escapeHtml(v.code)}</span>
        ${v.isPersonal ? `<div class="text-xs text-muted">Mã cá nhân</div>` : ""}
      </td>
      <td class="promo-name-cell">
        <strong>${escapeHtml(v.name)}</strong>
        ${v.description ? `<div class="text-xs text-muted" title="${escapeHtml(v.description)}">${escapeHtml(truncate(v.description, 46))}</div>` : ""}
      </td>
      <td><span class="percent-pill">-${v.percent}%</span></td>
      <td>
        <div>${v.minOrder > 0 ? `Đơn từ ${formatMoney(v.minOrder)}` : "Mọi giá trị đơn"}</div>
        <div class="text-xs text-muted">${v.maxDiscount > 0 ? `Tối đa ${formatMoney(v.maxDiscount)}` : "Tối đa: không giới hạn"}</div>
      </td>
      <td class="promo-audience-cell">
        <span class="audience-tag audience-${escapeHtml(v.audience)}">${escapeHtml(v.audienceLabel)}</span>
        ${ownerHtml}
      </td>
      <td>${periodHtml(v)}</td>
      <td>${usageHtml(v)}</td>
      <td><span class="badge ${v.statusBadge}">${v.statusLabel}</span></td>
      <td class="promo-actions-cell">
        <div class="promo-actions">
        <button type="button" class="btn btn-ghost btn-sm promo-icon-btn" data-action="edit"
                title="Sửa mã ${escapeHtml(v.code)}" aria-label="Sửa mã ${escapeHtml(v.code)}">${ICONS.edit(15)}</button>
        <button type="button" class="btn btn-sm promo-icon-btn promo-toggle${v.active ? " is-on" : ""}" data-action="toggle"
                title="${v.active ? "Đang bật - bấm để tắt mã" : "Đang tắt - bấm để bật lại mã"}"
                aria-label="${v.active ? "Tắt" : "Bật"} mã ${escapeHtml(v.code)}" aria-pressed="${v.active}">${POWER_ICON(15)}</button>
        <button type="button" class="btn btn-danger btn-sm promo-icon-btn" data-action="delete"
                title="Xoá mã ${escapeHtml(v.code)}" aria-label="Xoá mã ${escapeHtml(v.code)}">${ICONS.trash(15)}</button>
        </div>
      </td>
    </tr>`;
}

function currentFilters() {
  return {
    keyword: keywordInput.value,
    audience: audienceSelect.value,
    status: statusSelect.value,
    percent: percentSelect.value,
    customerNames,
  };
}

function renderTable() {
  const list = filterVouchers(allVouchers, currentFilters());
  const { items, page, totalPages } = paginate(list, currentPage, PER_PAGE);
  currentPage = page;

  resultCountEl.textContent = allVouchers.length
    ? `Hiển thị ${list.length} / ${allVouchers.length} mã giảm giá`
    : "";

  bodyEl.innerHTML = items.length
    ? items.map(rowHtml).join("")
    : `<tr><td colspan="${TABLE_COLUMNS}" class="py-4 text-center text-muted">
        ${allVouchers.length ? "Không có mã nào phù hợp với bộ lọc." : "Chưa có mã giảm giá - bấm \"Tạo mã giảm giá\" để bắt đầu."}
       </td></tr>`;

  renderPagination(paginationEl, page, totalPages, (p) => { currentPage = p; renderTable(); });
}

function renderAll() {
  renderStats();
  renderAutoPrograms();
  renderTable();
}

/**
 * Tải dữ liệu mới nhất. Mã giảm giá là bắt buộc; khách hàng & thực đơn chỉ
 * để hiển thị thêm - lỗi ở đó không làm hỏng cả trang (Promise.allSettled).
 */
async function reloadData() {
  const [vouchersResult, customersResult, drinksResult] = await Promise.allSettled([
    getAllVouchers(), getAllCustomers(), getAllDrinks(),
  ]);

  if (vouchersResult.status === "rejected") {
    statsEl.innerHTML = "";
    bodyEl.innerHTML = `<tr><td colspan="${TABLE_COLUMNS}">${errorHtml(escapeHtml(vouchersResult.reason.message))}</td></tr>`;
    return;
  }

  allVouchers = vouchersResult.value;
  if (customersResult.status === "fulfilled") {
    customers = customersResult.value;
    customerNames = new Map(customers.map((c) => [String(c.id), c.name]));
  }
  if (drinksResult.status === "fulfilled") {
    const now = Date.now();
    newDrinkCount = drinksResult.value.filter((d) => isNewDrink(d, now)).length;
  }
  renderAll();
}

/* =========================================================
   THÊM / SỬA MÃ (modal)
   ========================================================= */

/** Bỏ dấu tiếng Việt, IN HOA, chỉ giữ A-Z 0-9 (gõ "Tết 2027" -> "TET2027") */
function sanitizeCodeInput(value) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "D")
    .toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
}

/** Bản xem trước: khách mua đơn X được giảm bao nhiêu */
function renderPreview() {
  const { percent, minOrder, maxDiscount } = formEl.elements;
  const pct = Number(percent.value);
  if (!DISCOUNT_TIERS.includes(pct)) { previewEl.innerHTML = ""; return; }

  const sample = new Voucher({
    code: "XEMTRUOC",
    percent: pct,
    minOrder: Math.max(0, Number(minOrder.value) || 0),
    maxDiscount: Math.max(0, Number(maxDiscount.value) || 0),
  });
  const amount = Math.max(sample.minOrder, 500000);
  const discount = sample.computeDiscount(amount);
  const capFrom = sample.maxDiscount > 0 ? Math.ceil((sample.maxDiscount * 100) / pct / 1000) * 1000 : 0;

  previewEl.innerHTML = `
    <span class="promo-preview-label">${TICKET_ICON(15)} Xem trước</span>
    <span>Đơn <strong>${formatMoney(amount)}</strong> → giảm <strong class="text-amber">${formatMoney(discount)}</strong>,
      khách trả <strong>${formatMoney(amount - discount)}</strong>.</span>
    ${capFrom > amount ? `<span class="text-xs text-muted">Chạm mức trần ${formatMoney(sample.maxDiscount)} khi đơn từ ${formatMoney(capFrom)}.</span>` : ""}`;
}

function fillFormSelects() {
  const tierOptions = DISCOUNT_TIERS.map((p) => `<option value="${p}">Giảm ${p}%</option>`).join("");
  formEl.elements.percent.innerHTML = tierOptions;
  percentSelect.insertAdjacentHTML("beforeend", tierOptions);

  const audienceOptions = Object.entries(VOUCHER_AUDIENCES)
    .map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  formEl.elements.audience.innerHTML = audienceOptions;
  audienceSelect.insertAdjacentHTML("beforeend", audienceOptions);

  statusSelect.insertAdjacentHTML("beforeend", Object.entries(VOUCHER_STATUS)
    .map(([value, { label }]) => `<option value="${value}">${label}</option>`).join(""));
}

function openForCreate() {
  editing = null;
  formEl.reset();
  clearFormErrors(formEl);
  const today = new Date();
  const in30Days = new Date(today);
  in30Days.setDate(in30Days.getDate() + 30);

  const f = formEl.elements;
  f.id.value = "";
  f.percent.value = String(DISCOUNT_TIERS[0]);
  f.audience.value = "all";
  f.audience.disabled = false;
  f.minOrder.value = "0";
  f.maxDiscount.value = "0";
  f.usageLimit.value = "0";
  f.startDate.value = toDateKey(today);
  f.endDate.value = toDateKey(in30Days);
  f.active.checked = true;
  limitHintEl.textContent = "0 = không giới hạn.";
  modalTitle.textContent = "Tạo mã giảm giá";
  renderPreview();
  openModal("voucher-modal");
  f.code.focus();
}

function openForEdit(voucher) {
  editing = voucher;
  formEl.reset();
  clearFormErrors(formEl);

  const f = formEl.elements;
  f.id.value = voucher.id;
  f.code.value = voucher.code;
  f.name.value = voucher.name;
  f.description.value = voucher.description;
  f.percent.value = String(voucher.percent);
  f.audience.value = voucher.audience;
  // Mã cá nhân (chào mừng / sinh nhật) gắn chặt với 1 khách -> không đổi đối tượng
  f.audience.disabled = voucher.isPersonal;
  f.minOrder.value = String(voucher.minOrder);
  f.maxDiscount.value = String(voucher.maxDiscount);
  f.usageLimit.value = String(voucher.usageLimit);
  f.startDate.value = isoToDateKey(voucher.startDate);
  f.endDate.value = isoToDateKey(voucher.endDate);
  f.active.checked = voucher.active;
  limitHintEl.textContent = `0 = không giới hạn. Mã này đã được dùng ${voucher.usedCount} lượt.`;

  modalTitle.textContent = `Chỉnh sửa mã ${voucher.code}`;
  renderPreview();
  openModal("voucher-modal");
}

/** Kiểm tra các luật không khai báo được bằng data-rule. Trả true nếu hợp lệ */
function validateBusinessRules(data) {
  const f = formEl.elements;
  let ok = true;
  const fail = (field, message) => {
    setFieldError(field, message);
    if (ok) field.focus();
    ok = false;
  };

  const code = normalizeCode(data.code);
  if (!VOUCHER_CODE_PATTERN.test(code)) {
    fail(f.code, "Chỉ gồm 4-16 ký tự A-Z và 0-9");
  } else if (allVouchers.some((v) => v.code === code && v.id !== editing?.id)) {
    fail(f.code, `Mã "${code}" đã tồn tại`);
  }

  if (data.endDate && data.startDate && data.endDate < data.startDate) {
    fail(f.endDate, "Ngày kết thúc phải sau hoặc trùng ngày bắt đầu");
  }

  const limit = Number(data.usageLimit) || 0;
  if (editing && limit > 0 && limit < editing.usedCount) {
    fail(f.usageLimit, `Không được nhỏ hơn số lượt đã dùng (${editing.usedCount})`);
  }
  return ok;
}

function buildPayload(data) {
  const f = formEl.elements;
  // Giữ nguyên thời điểm gốc nếu admin không đổi ngày (mã tự động có giờ phút cụ thể)
  const sameStart = editing && isoToDateKey(editing.startDate) === data.startDate;
  const sameEnd = editing && isoToDateKey(editing.endDate) === data.endDate;

  return {
    code: normalizeCode(data.code),
    name: data.name,
    description: data.description || "",
    percent: Number(data.percent),
    minOrder: Number(data.minOrder) || 0,
    maxDiscount: Number(data.maxDiscount) || 0,
    startDate: sameStart ? editing.startDate : dateKeyToIso(data.startDate),
    endDate: data.endDate ? (sameEnd ? editing.endDate : dateKeyToIso(data.endDate, true)) : "",
    usageLimit: Number(data.usageLimit) || 0,
    audience: f.audience.disabled ? editing.audience : data.audience,
    active: f.active.checked,
  };
}

async function handleSubmit(e) {
  e.preventDefault();
  const { isValid, data } = validateForm(formEl);
  if (!isValid || !validateBusinessRules(data)) return;

  const payload = buildPayload(data);
  const restoreButton = setButtonLoading(submitBtn, "Đang lưu...");
  try {
    if (editing) {
      await updateVoucher(editing.id, payload);
      toast(`Đã cập nhật mã ${escapeHtml(payload.code)}.`, "success");
    } else {
      await addVoucher(payload);
      toast(`Đã tạo mã ${escapeHtml(payload.code)} - giảm ${payload.percent}%.`, "success");
    }
    closeModal("voucher-modal");
    await reloadData();
  } catch (err) {
    toast(escapeHtml(err.message), "error");
  } finally {
    restoreButton();
  }
}

/* =========================================================
   BẬT / TẮT, XOÁ
   ========================================================= */
async function handleToggle(voucher, button) {
  const restore = setButtonLoading(button, ""); // nút chỉ có biểu tượng -> chỉ hiện vòng xoay
  try {
    await updateVoucher(voucher.id, { active: !voucher.active });
    const code = escapeHtml(voucher.code);
    toast(voucher.active ? `Đã tắt mã ${code}.` : `Đã bật lại mã ${code}.`, "success");
    await reloadData();
  } catch (err) {
    restore();
    toast(escapeHtml(err.message), "error");
  }
}

async function handleDelete(voucher) {
  const notes = [];
  if (voucher.usedCount > 0) {
    notes.push(`Mã đã được dùng ${voucher.usedCount} lượt - nên bấm "Tắt" thay vì xoá để giữ nguyên lịch sử đơn hàng đã áp dụng mã.`);
  }
  if (voucher.isPersonal) {
    notes.push(`Đây là mã cá nhân của ${customerNames.get(voucher.customerId) || "một khách hàng"}, khách sẽ mất quà tặng này.`);
  }

  const ok = await confirmDialog(`Xoá mã "${voucher.code}" (${voucher.name})? ${notes.join(" ")}`, {
    title: "Xác nhận xoá mã giảm giá",
    okText: "Xoá mã",
  });
  if (!ok) return;

  try {
    await deleteVoucher(voucher.id);
    toast(`Đã xoá mã ${escapeHtml(voucher.code)}.`, "success");
    await reloadData();
  } catch (err) {
    toast(escapeHtml(err.message), "error");
  }
}

/* =========================================================
   GẮN SỰ KIỆN & KHỞI ĐỘNG
   ========================================================= */
function bindEvents() {
  const resetAndRender = () => { currentPage = 1; renderTable(); };
  keywordInput.addEventListener("input", debounce(resetAndRender, 250));
  [audienceSelect, statusSelect, percentSelect].forEach((el) => el.addEventListener("change", resetAndRender));

  bodyEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const voucher = allVouchers.find((v) => String(v.id) === btn.closest("tr").dataset.id);
    if (!voucher) return;

    if (btn.dataset.action === "edit") openForEdit(voucher);
    if (btn.dataset.action === "toggle") handleToggle(voucher, btn);
    if (btn.dataset.action === "delete") handleDelete(voucher);
  });

  // Ô mã: tự IN HOA, bỏ dấu và ký tự lạ ngay khi gõ (giữ vị trí con trỏ)
  const codeInput = formEl.elements.code;
  codeInput.addEventListener("input", () => {
    const before = codeInput.value;
    const cleaned = sanitizeCodeInput(before);
    if (cleaned === before) return;
    const caret = Math.max(0, (codeInput.selectionStart ?? cleaned.length) - (before.length - cleaned.length));
    codeInput.value = cleaned;
    codeInput.setSelectionRange(caret, caret);
  });

  document.getElementById("vf-generate").addEventListener("click", () => {
    const prefix = `SALE${formEl.elements.percent.value}`;
    codeInput.value = generateVoucherCode(prefix, 4, allVouchers.map((v) => v.code));
    setFieldError(codeInput, "");
  });

  ["percent", "minOrder", "maxDiscount"].forEach((name) => {
    formEl.elements[name].addEventListener("input", renderPreview);
    formEl.elements[name].addEventListener("change", renderPreview);
  });

  formEl.addEventListener("submit", handleSubmit);
  document.getElementById("add-voucher-btn").addEventListener("click", openForCreate);
  document.getElementById("voucher-modal-close").addEventListener("click", () => closeModal("voucher-modal"));
  document.getElementById("voucher-form-cancel").addEventListener("click", () => closeModal("voucher-modal"));
}

// Chưa đăng nhập -> initAdminLayout chuyển hướng và trả false: dừng, không gọi API
if (initAdminLayout("Mã Giảm Giá & Sale")) {
  fillFormSelects();
  bindEvents();
  bodyEl.innerHTML = `<tr><td colspan="${TABLE_COLUMNS}" class="py-4 text-center text-muted">Đang tải mã giảm giá từ máy chủ...</td></tr>`;
  reloadData();
}

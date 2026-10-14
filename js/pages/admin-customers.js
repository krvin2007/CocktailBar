/* =========================================================
   ADMIN-CUSTOMERS.JS - Quản lý khách hàng thành viên
     Đọc   : GET    /customers  (+ /vouchers để đếm mã cá nhân)
     Phát mã sinh nhật: POST /vouchers (ensureBirthdayVoucher, force)
     Xoá   : DELETE /customers/:id  (+ thu hồi mã cá nhân của khách)

   Nghiệp vụ "Phát mã sinh nhật":
   - Chỉ cho phép khi khách đang trong THÁNG sinh nhật hoặc trong
     khoảng ± 7 ngày quanh sinh nhật (kể cả vắt qua năm mới).
   - Mỗi năm mỗi khách chỉ 1 mã: đã có thì báo lại mã đó, không tạo thêm.
   Bảng KHÔNG hiển thị chuỗi băm mật khẩu (passwordHash).
   ========================================================= */

import { initAdminLayout } from "../modules/adminLayout.js";
import {
  getAllCustomers, deleteCustomer, filterCustomers, findBirthdayInWindow, parseBirthday,
  CUSTOMER_FILTERS, NEW_MEMBER_DAYS, BIRTHDAY_WINDOW_DAYS,
} from "../modules/customersService.js";
import { getAllVouchers, deleteVoucher, ensureBirthdayVoucher, BIRTHDAY_DISCOUNT } from "../modules/vouchersService.js";
import { formatDate, debounce, paginate, renderPagination, escapeHtml, getQueryParam } from "../modules/utils.js";
import { toast, confirmDialog, openModal, closeModal, setButtonLoading, errorHtml } from "../modules/ui.js";
import { ICONS } from "../modules/icons.js";

const GIFT_ICON = (size = 14) => `
  <svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/>
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
  </svg>`;

const PER_PAGE = 8;
const TABLE_COLUMNS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const statsEl = document.getElementById("customer-stats");
const bodyEl = document.getElementById("customers-body");
const paginationEl = document.getElementById("pagination");
const resultCountEl = document.getElementById("result-count");
const keywordInput = document.getElementById("f-keyword");
const groupSelect = document.getElementById("f-group");
const cvTitle = document.getElementById("cv-modal-title");
const cvBody = document.getElementById("cv-modal-body");

let allCustomers = [];
let allVouchers = [];
let currentPage = 1;

/* =========================================================
   HÀM HỖ TRỢ HIỂN THỊ
   ========================================================= */

/** Các mã cá nhân của một khách (mọi trạng thái) */
const vouchersOf = (customer) => allVouchers.filter((v) => v.customerId === String(customer.id));

/** "Ngày 14/10" từ chuỗi ngày sinh */
function birthdayText(birthday) {
  const parts = parseBirthday(birthday);
  return parts ? `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}` : "—";
}

/** Khách có được phát mã sinh nhật bằng tay lúc này không */
const canIssueBirthday = (c) => c.isBirthdayMonth || c.isInBirthdayWindow;

/**
 * Ô "Sinh nhật": hôm nay -> huy hiệu nổi bật; trong cửa sổ ± 7 ngày -> huy hiệu
 * vàng (sắp tới / vừa qua); còn lại -> số ngày còn lại.
 */
function birthdayCellHtml(c) {
  const days = c.daysUntilBirthday;
  if (days === null) return `<span class="text-muted">Ngày sinh lỗi</span>`;
  const nextText = `<div class="text-xs text-muted">${birthdayText(c.birthday)} · ${c.nextBirthday.getFullYear()}</div>`;

  if (days === 0) {
    return `<span class="badge badge-birthday is-today">${GIFT_ICON(12)} Sinh nhật hôm nay</span>`;
  }
  if (days <= BIRTHDAY_WINDOW_DAYS) {
    return `<span class="badge badge-birthday">${GIFT_ICON(12)} Còn ${days} ngày</span>${nextText}`;
  }
  const occurrence = findBirthdayInWindow(c.birthday);
  if (occurrence) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ago = Math.round((today - occurrence) / DAY_MS);
    return `<span class="badge badge-birthday is-past">${GIFT_ICON(12)} Vừa qua ${ago} ngày</span>
      <div class="text-xs text-muted">Vẫn trong tuần sinh nhật</div>`;
  }
  return `<span class="promo-countdown">Còn <strong>${days}</strong> ngày</span>${nextText}`;
}

function voucherCountHtml(c) {
  const usable = vouchersOf(c).filter((v) => v.isUsable).length;
  const total = vouchersOf(c).length;
  if (!total) return `<span class="text-muted">0</span>`;
  return `
    <button type="button" class="promo-count-btn" data-action="vouchers" title="Xem các mã của khách">
      <strong>${usable}</strong> <span class="text-xs">/ ${total} mã</span>
    </button>`;
}

function rowHtml(c) {
  const issueAllowed = canIssueBirthday(c);
  const issueTitle = issueAllowed
    ? `Phát mã giảm ${BIRTHDAY_DISCOUNT}% quà sinh nhật năm nay`
    : `Chỉ phát được trong tháng sinh nhật (tháng ${parseBirthday(c.birthday)?.month ?? "?"}) hoặc ± ${BIRTHDAY_WINDOW_DAYS} ngày quanh sinh nhật`;
  const age = c.age;

  return `
    <tr data-id="${escapeHtml(c.id)}" class="${c.isBirthdayToday ? "promo-row-birthday" : ""}">
      <td>
        <div class="promo-member">
          <span class="promo-avatar" aria-hidden="true">${escapeHtml((c.name.trim().split(/\s+/).pop() || "?").charAt(0).toUpperCase())}</span>
          <strong>${escapeHtml(c.name)}</strong>
        </div>
      </td>
      <td class="promo-contact-cell">
        <div class="promo-phone">${escapeHtml(c.phone)}</div>
        <div class="text-xs text-muted">${c.email ? escapeHtml(c.email) : "Chưa có email"}</div>
      </td>
      <td>
        <div>${formatDate(`${c.birthday}T00:00:00`)}</div>
        <div class="text-xs text-muted">${age === null ? "—" : `${age} tuổi`}</div>
      </td>
      <td>
        <div>${formatDate(c.createdAt)}</div>
        ${c.isNewMember ? `<span class="badge badge-info">Thành viên mới</span>` : ""}
      </td>
      <td>${birthdayCellHtml(c)}</td>
      <td>${voucherCountHtml(c)}</td>
      <td class="promo-actions-cell">
        <div class="promo-actions">
        <button type="button" class="btn btn-outline btn-sm" data-action="birthday" title="${issueTitle}"
                aria-label="Phát mã sinh nhật cho ${escapeHtml(c.name)}" ${issueAllowed ? "" : "disabled"}>${GIFT_ICON(14)} Phát mã sinh nhật</button>
        <button type="button" class="btn btn-danger btn-sm promo-icon-btn" data-action="delete"
                title="Xoá thành viên ${escapeHtml(c.name)}" aria-label="Xoá thành viên ${escapeHtml(c.name)}">${ICONS.trash(15)}</button>
        </div>
      </td>
    </tr>`;
}

/* =========================================================
   VẼ TRANG
   ========================================================= */
function renderStats() {
  const month = new Date().getMonth() + 1;
  const cards = [
    { icon: ICONS.users(22), value: allCustomers.length, label: "Tổng thành viên" },
    { icon: ICONS.user(22), value: allCustomers.filter((c) => c.isNewMember).length, label: `Mới trong ${NEW_MEMBER_DAYS} ngày` },
    { icon: ICONS.calendar(22), value: allCustomers.filter((c) => c.isBirthdayMonth).length, label: `Sinh nhật tháng ${month}` },
    { icon: GIFT_ICON(22), value: allCustomers.filter((c) => c.isInBirthdayWindow).length, label: "Trong tuần sinh nhật", accent: "birthday" },
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

function renderTable() {
  const list = filterCustomers(allCustomers, { keyword: keywordInput.value, group: groupSelect.value });
  const { items, page, totalPages } = paginate(list, currentPage, PER_PAGE);
  currentPage = page;

  resultCountEl.textContent = allCustomers.length
    ? `Hiển thị ${list.length} / ${allCustomers.length} thành viên · sắp xếp theo ngày sinh nhật gần nhất`
    : "";

  bodyEl.innerHTML = items.length
    ? items.map(rowHtml).join("")
    : `<tr><td colspan="${TABLE_COLUMNS}" class="py-4 text-center text-muted">
        ${allCustomers.length ? "Không có thành viên nào phù hợp với bộ lọc." : "Chưa có khách hàng nào đăng ký thành viên."}
       </td></tr>`;

  renderPagination(paginationEl, page, totalPages, (p) => { currentPage = p; renderTable(); });
}

/** Tải khách hàng (bắt buộc) + mã giảm giá (không bắt buộc) rồi vẽ lại */
async function reloadData() {
  const [customersResult, vouchersResult] = await Promise.allSettled([getAllCustomers(), getAllVouchers()]);
  if (customersResult.status === "rejected") {
    statsEl.innerHTML = "";
    bodyEl.innerHTML = `<tr><td colspan="${TABLE_COLUMNS}">${errorHtml(escapeHtml(customersResult.reason.message))}</td></tr>`;
    return;
  }
  allCustomers = customersResult.value;
  allVouchers = vouchersResult.status === "fulfilled" ? vouchersResult.value : [];
  renderStats();
  renderTable();
}

/* =========================================================
   THAO TÁC
   ========================================================= */

async function handleIssueBirthday(customer, button) {
  if (!canIssueBirthday(customer)) {
    toast("Chỉ phát mã sinh nhật trong tháng sinh nhật hoặc ± 7 ngày quanh sinh nhật của khách.", "info");
    return;
  }
  const knownIds = new Set(allVouchers.map((v) => String(v.id)));
  const restore = setButtonLoading(button, "Đang phát...");
  try {
    const voucher = await ensureBirthdayVoucher(customer, new Date(), { force: true });
    if (!voucher) {
      toast("Chưa tới dịp sinh nhật của khách - không phát mã.", "info");
    } else if (knownIds.has(String(voucher.id))) {
      toast(`${escapeHtml(customer.name)} đã có mã sinh nhật năm ${voucher.birthdayYear}: `
        + `<strong>${escapeHtml(voucher.code)}</strong> (${voucher.statusLabel.toLowerCase()}).`, "info");
    } else {
      toast(`Đã phát mã <strong>${escapeHtml(voucher.code)}</strong> giảm ${voucher.percent}% cho ${escapeHtml(customer.name)}`
        + ` - dùng đến ${formatDate(voucher.endDate)}.`, "success");
    }
    await reloadData();
  } catch (err) {
    restore();
    toast(escapeHtml(err.message), "error");
  }
}

async function handleDelete(customer) {
  const personal = vouchersOf(customer);
  const extra = personal.length
    ? ` ${personal.length} mã cá nhân của khách (chào mừng / sinh nhật) cũng sẽ bị thu hồi.`
    : "";
  const ok = await confirmDialog(`Xoá thành viên "${customer.name}" (${customer.phone})?${extra} Các đơn hàng cũ vẫn được giữ nguyên.`, {
    title: "Xác nhận xoá thành viên",
    okText: "Xoá thành viên",
  });
  if (!ok) return;

  try {
    // Thu hồi mã cá nhân TRƯỚC (mã không còn chủ thì không ai dùng được nữa),
    // lỗi lẻ tẻ ở bước này không chặn việc xoá khách
    const results = await Promise.allSettled(personal.map((v) => deleteVoucher(v.id)));
    const failed = results.filter((r) => r.status === "rejected").length;
    await deleteCustomer(customer.id);
    toast(`Đã xoá thành viên ${escapeHtml(customer.name)}${failed ? ` (còn ${failed} mã chưa thu hồi được)` : ""}.`, failed ? "info" : "success");
    await reloadData();
  } catch (err) {
    toast(escapeHtml(err.message), "error");
  }
}

function showCustomerVouchers(customer) {
  const list = vouchersOf(customer).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  cvTitle.textContent = `Mã giảm giá của ${customer.name}`;
  cvBody.innerHTML = list.length
    ? `<ul class="promo-voucher-list">
        ${list.map((v) => `
          <li class="promo-voucher-item">
            <span class="voucher-code">${escapeHtml(v.code)}</span>
            <div class="promo-voucher-info">
              <strong>${escapeHtml(v.name)}</strong>
              <span class="text-xs text-muted">${escapeHtml(v.audienceLabel)} · hạn ${v.endDate ? formatDate(v.endDate) : "không giới hạn"}
                · đã dùng ${v.usedCount}/${v.usageLimit || "∞"}</span>
            </div>
            <span class="percent-pill">-${v.percent}%</span>
            <span class="badge ${v.statusBadge}">${v.statusLabel}</span>
          </li>`).join("")}
      </ul>`
    : `<p class="text-muted">Khách chưa có mã cá nhân nào.</p>`;
  openModal("customer-vouchers-modal");
}

/* =========================================================
   GẮN SỰ KIỆN & KHỞI ĐỘNG
   ========================================================= */
function fillGroupSelect() {
  groupSelect.innerHTML = Object.entries(CUSTOMER_FILTERS)
    .map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  // Cho phép mở thẳng một nhóm từ trang khác: admin-customers.html?group=birthday-soon
  const fromUrl = getQueryParam("group");
  if (fromUrl && Object.hasOwn(CUSTOMER_FILTERS, fromUrl)) groupSelect.value = fromUrl;
}

function bindEvents() {
  const resetAndRender = () => { currentPage = 1; renderTable(); };
  keywordInput.addEventListener("input", debounce(resetAndRender, 250));
  groupSelect.addEventListener("change", resetAndRender);

  const reloadBtn = document.getElementById("reload-btn");
  reloadBtn.addEventListener("click", async () => {
    const restore = setButtonLoading(reloadBtn, "Đang tải...");
    await reloadData();
    restore();
  });

  bodyEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const customer = allCustomers.find((c) => String(c.id) === btn.closest("tr").dataset.id);
    if (!customer) return;

    if (btn.dataset.action === "birthday") handleIssueBirthday(customer, btn);
    if (btn.dataset.action === "delete") handleDelete(customer);
    if (btn.dataset.action === "vouchers") showCustomerVouchers(customer);
  });

  document.getElementById("cv-modal-close").addEventListener("click", () => closeModal("customer-vouchers-modal"));
  document.getElementById("cv-modal-ok").addEventListener("click", () => closeModal("customer-vouchers-modal"));
}

// Chưa đăng nhập -> initAdminLayout chuyển hướng và trả false: dừng, không gọi API
if (initAdminLayout("Khách Hàng Thành Viên")) {
  fillGroupSelect();
  bindEvents();
  bodyEl.innerHTML = `<tr><td colspan="${TABLE_COLUMNS}" class="py-4 text-center text-muted">Đang tải danh sách thành viên...</td></tr>`;
  reloadData();
}

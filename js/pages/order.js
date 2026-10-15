/* =========================================================
   ORDER.JS - Trang giỏ hàng + đặt bàn/đặt món + tra cứu đơn
   - Giỏ hàng: đọc/ghi localStorage (thao tác tức thì). Giá trong giỏ
     là giá SAU sale món; giá gốc hiển thị gạch ngang bên cạnh.
   - Mã giảm giá: khách nhập tay, bấm chip "Mã dành cho bạn" hoặc mở
     trang với ?voucher=MÃ (từ trang Khuyến mãi). Mã được kiểm tra NGAY
     bằng validateVoucher với tạm tính + SĐT hiện tại, và kiểm tra lại
     mỗi khi giỏ đổi / SĐT đổi - hết điều kiện thì tự gỡ và báo khách.
     Khi đặt, ordersService kiểm tra mã lần cuối trên máy chủ.
   - Khách đã đăng nhập thành viên: tự điền họ tên / SĐT / email và gửi
     kèm customerId để dùng được mã cá nhân (chào mừng, sinh nhật).
   - Đặt hàng, tra cứu: gọi API json-server bằng async/await.
   ========================================================= */

import "../modules/navbar.js";
import { refreshCartBadge } from "../modules/navbar.js";
import {
  getCart, updateCartQty, removeFromCart, getCartSummary, createOrder,
  syncCartWithCatalog, findOrderByCodeAndPhone,
} from "../modules/ordersService.js";
import {
  validateVoucher, getPublicVouchers, getCustomerVouchers, normalizeCode,
} from "../modules/vouchersService.js";
import { getCurrentCustomer } from "../modules/customerAuth.js";
import { formatMoney, formatDateTime, escapeHtml, debounce, getQueryParam } from "../modules/utils.js";
import { validateForm, clearFormErrors, setFieldError } from "../modules/validation.js";
import { toast, confirmDialog, setButtonLoading, loadingHtml, errorHtml } from "../modules/ui.js";
import { ICONS } from "../modules/icons.js";
import { openVietQRPaymentModal } from "../modules/vietqrService.js";

const cartListEl = document.getElementById("cart-list");
const sumCountEl = document.getElementById("sum-count");
const sumOriginalEl = document.getElementById("sum-original");
const rowSavingsEl = document.getElementById("row-savings");
const sumSavingsEl = document.getElementById("sum-savings");
const rowDiscountEl = document.getElementById("row-discount");
const sumDiscountEl = document.getElementById("sum-discount");
const sumVoucherCodeEl = document.getElementById("sum-voucher-code");
const sumTotalEl = document.getElementById("sum-total");
const formEl = document.getElementById("order-form");
const submitBtn = document.getElementById("submit-order-btn");
const bookingTimeInput = document.getElementById("booking-time-input");
const guestCountInput = formEl.elements.guestCount;
const phoneInput = formEl.elements.phone;
const memberNoteEl = document.getElementById("member-note");

const voucherInput = document.getElementById("voucher-input");
const voucherApplyBtn = document.getElementById("voucher-apply-btn");
const voucherRemoveBtn = document.getElementById("voucher-remove-btn");
const voucherMessageEl = document.getElementById("voucher-message");
const voucherSuggestEl = document.getElementById("voucher-suggest");
const voucherChipsEl = document.getElementById("voucher-chips");

/** Tồn kho mới nhất của từng món (id -> stock), cập nhật mỗi lần đối chiếu với API */
let stockById = new Map();

/**
 * Trạng thái mã giảm giá của phiếu đặt chỗ:
 * - applied: mã ĐANG áp dụng { code, voucher } (voucher là đối tượng Voucher
 *   để tính lại số tiền giảm tức thì khi giỏ đổi) hoặc null.
 * - pendingCode: mã lấy từ URL khi giỏ còn trống - tự áp khi giỏ có món.
 * - lastFailedCode: mã vừa kiểm tra bị từ chối (để thử lại khi khách nhập SĐT).
 * - checkSeq: số thứ tự lần kiểm tra - kết quả của lần cũ về muộn thì bỏ qua.
 * - submitting: đang gửi đơn -> tạm ngừng kiểm tra lại (clearCart giữa chừng
 *   sẽ làm giỏ = 0đ, không được coi đó là "mã hết điều kiện").
 */
const voucherState = {
  applied: null,
  pendingCode: "",
  lastFailedCode: "",
  checkSeq: 0,
  submitting: false,
};

/** Các mã gợi ý đã tải (để vẽ lại chip khi tạm tính đổi mà không gọi API lại) */
let suggestedVouchers = [];

/* ---------------- Giỏ hàng ---------------- */

/** Giá một dòng giỏ: có sale món -> giá gốc gạch ngang + giá sau giảm + nhãn % */
function cartPriceHtml(item) {
  const price = Number(item.price) || 0;
  const original = Number(item.originalPrice) || 0;
  if (original <= price) return `<p class="cart-item-price">${formatMoney(price)}</p>`;

  const percent = Math.round((1 - price / original) * 100);
  return `
    <p class="cart-item-price is-sale">
      <span class="cart-price-old">${formatMoney(original)}</span>
      <span class="cart-price-now">${formatMoney(price)}</span>
      <span class="cart-sale-tag">−${percent}%</span>
    </p>`;
}

function cartItemHtml(item) {
  const maxQty = stockById.get(item.drinkId) ?? item.qty;
  const isImage = item.image && (item.image.includes("/") || item.image.startsWith("http"));
  const imageHtml = isImage
    ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" class="cart-item-img">`
    : `<div class="cart-fallback-icon">${ICONS.cocktail(20)}</div>`;

  return `
    <div class="cart-item" data-id="${item.drinkId}" data-max="${maxQty}">
      <div class="cart-item-thumb">${imageHtml}</div>
      <div class="cart-item-info">
        <p class="cart-item-name">${escapeHtml(item.name)}</p>
        ${cartPriceHtml(item)}
      </div>
      <div class="cart-item-qty">
        <button type="button" data-action="minus" aria-label="Giảm số lượng">−</button>
        <span class="qty-num">${item.qty}</span>
        <button type="button" data-action="plus" ${item.qty >= maxQty ? "disabled title=\"Đã đạt giới hạn có sẵn\"" : ""} aria-label="Tăng số lượng">+</button>
      </div>
      <button type="button" class="cart-item-remove" data-action="remove" title="Xoá món này khỏi danh sách">
        ${ICONS.trash(15)}
      </button>
    </div>`;
}

/** Vẽ giỏ hàng từ localStorage (không gọi API - dùng sau mỗi lần +/-) */
function renderCart() {
  const cart = getCart();

  cartListEl.innerHTML = cart.length ? cart.map(cartItemHtml).join("") : `
    <div class="empty-state cart-empty">
      <div class="empty-icon">${ICONS.shoppingBag(36)}</div>
      <h4>Danh sách thức uống đang trống</h4>
      <p class="text-muted">Hãy chọn ly cocktail yêu thích của bạn từ thực đơn để tiếp tục đặt bàn.</p>
      <a href="menu.html" class="btn btn-primary mt-2">
        ${ICONS.arrowRight(14)} <span>Khám phá thực đơn</span>
      </a>
    </div>`;

  renderTotals();
  if (submitBtn) submitBtn.disabled = cart.length === 0 || voucherState.submitting;
}

/** Số tiền giảm của mã đang áp dụng, tính lại ngay theo tạm tính hiện tại */
function currentDiscount(subtotal) {
  const { applied } = voucherState;
  return applied ? applied.voucher.computeDiscount(subtotal) : 0;
}

/**
 * Bảng tổng: số ly, tạm tính theo giá gốc, tiết kiệm từ sale món,
 * giảm theo mã, TỔNG THANH TOÁN = tạm tính (giá sale) - giảm theo mã.
 */
function renderTotals() {
  const { total, count, originalTotal, savings } = getCartSummary();
  const discount = currentDiscount(total);
  const grandTotal = Math.max(0, total - discount);

  sumCountEl.textContent = `${count} ly`;
  sumOriginalEl.textContent = formatMoney(originalTotal);

  rowSavingsEl.hidden = savings <= 0;
  sumSavingsEl.textContent = `−${formatMoney(savings)}`;

  rowDiscountEl.hidden = discount <= 0;
  sumDiscountEl.textContent = `−${formatMoney(discount)}`;
  sumVoucherCodeEl.textContent = voucherState.applied ? voucherState.applied.code : "";

  sumTotalEl.textContent = formatMoney(grandTotal);
  renderVoucherChips();
}

/** Thông báo cho khách biết vì sao giỏ hàng vừa tự thay đổi */
function announceChanges(changes) {
  changes.forEach((c) => {
    if (c.type === "removed") toast(`"${c.name}" đã bị bỏ khỏi danh sách: ${c.reason}.`, "error");
    if (c.type === "reduced") toast(`"${c.name}" đã được điều chỉnh về ${c.to} ly theo khả năng phục vụ.`, "error");
    if (c.type === "price") {
      const saleNote = c.percent > 0 ? ` (đang giảm ${c.percent}% so với giá gốc ${formatMoney(c.originalPrice)})` : "";
      toast(`Giá "${c.name}" vừa được cập nhật: ${formatMoney(c.to)}${saleNote}.`, "info");
    }
  });
}

/**
 * Đối chiếu giỏ với thực đơn MỚI NHẤT trên máy chủ (async) rồi vẽ lại.
 * @returns {Promise<boolean>} true nếu đối chiếu được với máy chủ
 */
async function syncAndRenderCart() {
  try {
    const { changes, drinkMap } = await syncCartWithCatalog();
    stockById = new Map([...drinkMap].map(([id, d]) => [id, d.status === "available" ? d.stock : 0]));
    announceChanges(changes);
    renderCart();
    return true;
  } catch (err) {
    renderCart();
    toast(err.message, "error");
    return false;
  }
}

cartListEl.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const row = btn.closest(".cart-item");
  const id = row.dataset.id;
  const maxQty = Number(row.dataset.max);
  const item = getCart().find((i) => i.drinkId === id);
  if (!item) return;

  if (btn.dataset.action === "plus") {
    if (item.qty >= maxQty) {
      toast(`"${item.name}" đã đạt số lượng tối đa cho một lượt gọi.`, "error");
      return;
    }
    updateCartQty(id, item.qty + 1);
  }

  if (btn.dataset.action === "minus") {
    if (item.qty <= 1) {
      const ok = await confirmDialog(`Bạn có muốn bỏ "${item.name}" khỏi danh sách gọi món?`, { okText: "Bỏ món" });
      if (!ok) return;
      removeFromCart(id);
    } else {
      updateCartQty(id, item.qty - 1);
    }
  }

  if (btn.dataset.action === "remove") {
    const ok = await confirmDialog(`Bỏ "${item.name}" khỏi danh sách gọi món?`, { okText: "Xác nhận xoá" });
    if (!ok) return;
    removeFromCart(id);
  }

  // updateCartQty / removeFromCart phát "cartchange" -> listener bên dưới
  // vẽ lại giỏ + kiểm tra lại mã; gọi thêm ở đây cho chắc khi trình duyệt cũ
  refreshCartBadge();
  renderCart();
});

/* ---------------- Mã giảm giá ---------------- */

/** Hiện thông báo ngay dưới ô mã: type = "success" | "error" | "info" | "" (xoá) */
function showVoucherMessage(message = "", type = "") {
  voucherMessageEl.textContent = message;
  voucherMessageEl.className = `voucher-message${type ? ` is-${type}` : ""}`;
  voucherInput.classList.toggle("invalid", type === "error");
  voucherInput.setAttribute("aria-invalid", type === "error" ? "true" : "false");
}

/** Đồng bộ giao diện ô mã với trạng thái áp dụng */
function syncVoucherControls() {
  const { applied } = voucherState;
  voucherRemoveBtn.hidden = !applied && !voucherInput.value;
  voucherInput.classList.toggle("is-applied", Boolean(applied));
  voucherApplyBtn.textContent = applied ? "Đã áp dụng" : "Áp dụng";
  voucherApplyBtn.classList.toggle("is-applied", Boolean(applied));
}

/** Thông tin dùng để kiểm tra mã: tạm tính theo giá sale + SĐT đang nhập + thành viên */
function voucherContext() {
  return {
    subtotal: getCartSummary().total,
    phone: phoneInput.value.trim(),
    customerId: getCurrentCustomer()?.id || "",
  };
}

/**
 * Kiểm tra + áp dụng một mã (khách bấm "Áp dụng", bấm chip, mã trên URL).
 * @returns {Promise<boolean>} true nếu mã hợp lệ và đã được áp dụng
 */
async function applyVoucher(rawCode) {
  const code = normalizeCode(rawCode);
  voucherInput.value = code;
  if (!code) {
    showVoucherMessage("Vui lòng nhập mã giảm giá.", "error");
    voucherInput.focus();
    return false;
  }
  if (getCart().length === 0) {
    // Giỏ trống: giữ mã lại, tự áp khi khách chọn món
    voucherState.pendingCode = code;
    voucherState.applied = null;
    showVoucherMessage(`Đã ghi nhận mã ${code} - mã sẽ được kiểm tra khi bạn chọn món.`, "info");
    syncVoucherControls();
    renderTotals();
    return false;
  }

  const seq = ++voucherState.checkSeq;
  const restoreButton = setButtonLoading(voucherApplyBtn, "Đang kiểm tra...");
  voucherInput.setAttribute("aria-busy", "true");
  try {
    const result = await validateVoucher(code, voucherContext());
    if (seq !== voucherState.checkSeq) return false; // đã có lần kiểm tra mới hơn

    voucherState.pendingCode = "";
    if (result.valid) {
      voucherState.applied = { code: result.voucher.code, voucher: result.voucher };
      voucherState.lastFailedCode = "";
      showVoucherMessage(result.message, "success");
    } else {
      voucherState.applied = null;
      voucherState.lastFailedCode = code;
      showVoucherMessage(result.message, "error");
    }
    return result.valid;
  } finally {
    restoreButton();
    voucherInput.removeAttribute("aria-busy");
    // Vẽ lại theo trạng thái MỚI NHẤT (kể cả khi kết quả này đã cũ) để nút
    // không bị kẹt chữ "Đang kiểm tra..." khi khách bấm liên tục nhiều chip
    syncVoucherControls();
    renderTotals();
  }
}

/** Khách bấm "×": bỏ mã, tổng tiền trở lại như chưa giảm */
function removeVoucher({ silent = false } = {}) {
  const hadCode = voucherState.applied?.code;
  voucherState.checkSeq++; // huỷ kết quả của lần kiểm tra đang chạy (nếu có)
  voucherState.applied = null;
  voucherState.pendingCode = "";
  voucherState.lastFailedCode = "";
  voucherInput.value = "";
  showVoucherMessage(hadCode && !silent ? `Đã bỏ mã ${hadCode}.` : "", hadCode && !silent ? "info" : "");
  syncVoucherControls();
  renderTotals();
}

/**
 * Kiểm tra LẠI mã đang áp dụng sau khi giỏ hàng / SĐT / tài khoản đổi.
 * - Vẫn hợp lệ: cập nhật số tiền giảm + câu thông báo.
 * - Hết điều kiện (VD bớt món nên chưa đủ đơn tối thiểu, SĐT đã từng đặt
 *   với mã khách mới...): tự gỡ mã, giữ chữ trong ô để khách thấy và báo lý do.
 * - Chưa có mã áp dụng nhưng còn mã chờ (từ URL) / mã vừa bị từ chối:
 *   thử lại - VD khách vừa nhập SĐT cho mã "khách hàng mới".
 */
async function recheckVoucher(trigger = "cart") {
  if (voucherState.submitting) return;
  const { applied, pendingCode, lastFailedCode } = voucherState;

  if (!applied) {
    if (pendingCode && getCart().length > 0) await applyVoucher(pendingCode);
    else if (trigger !== "cart" && lastFailedCode && lastFailedCode === normalizeCode(voucherInput.value)) {
      await applyVoucher(lastFailedCode);
    }
    return;
  }

  const seq = ++voucherState.checkSeq;
  const result = await validateVoucher(applied.code, voucherContext());
  if (seq !== voucherState.checkSeq || voucherState.submitting) return;

  if (result.valid) {
    voucherState.applied = { code: result.voucher.code, voucher: result.voucher };
    showVoucherMessage(result.message, "success");
  } else {
    voucherState.applied = null;
    voucherState.lastFailedCode = applied.code;
    showVoucherMessage(`Mã ${applied.code} đã được gỡ: ${result.message}`, "error");
    toast(`Mã ${applied.code} không còn đủ điều kiện nên đã được gỡ khỏi đơn.`, "info");
  }
  syncVoucherControls();
  renderTotals();
}

const recheckVoucherSoon = debounce((trigger) => recheckVoucher(trigger), 350);

/* ----- Chip "Mã dành cho bạn" ----- */

/** Một chip mã: mã cá nhân có nhãn "Của bạn"; chưa đủ đơn tối thiểu thì làm mờ + ghi số tiền còn thiếu */
function voucherChipHtml(voucher, subtotal) {
  const isActive = voucherState.applied?.code === voucher.code;
  const shortfall = voucher.minOrder > subtotal ? voucher.minOrder - subtotal : 0;
  const condition = shortfall > 0 ? `Thêm ${formatMoney(shortfall)}` : voucher.conditionLabel;
  const kind = voucher.audience === "birthday" ? "is-birthday" : (voucher.isPersonal ? "is-personal" : "");

  return `
    <button type="button" class="voucher-chip ${kind} ${isActive ? "is-active" : ""} ${shortfall > 0 ? "is-locked" : ""}"
            data-code="${escapeHtml(voucher.code)}" aria-pressed="${isActive}"
            title="${escapeHtml(voucher.name)} - ${escapeHtml(voucher.description || voucher.conditionLabel)}">
      <span class="voucher-chip-top">
        <strong class="voucher-chip-code">${escapeHtml(voucher.code)}</strong>
        <span class="voucher-chip-percent">−${voucher.percent}%</span>
      </span>
      <span class="voucher-chip-cond">${voucher.isPersonal ? '<em class="voucher-chip-own">Của bạn</em> ' : ""}${escapeHtml(condition)}</span>
    </button>`;
}

function renderVoucherChips() {
  if (!voucherChipsEl) return;
  voucherSuggestEl.hidden = suggestedVouchers.length === 0;
  if (suggestedVouchers.length === 0) return;
  const { total } = getCartSummary();
  voucherChipsEl.innerHTML = suggestedVouchers.map((v) => voucherChipHtml(v, total)).join("");
}

/**
 * Tải danh sách mã gợi ý: mã cá nhân của khách đang đăng nhập (đứng trước)
 * + mã công khai đang hiệu lực. Máy chủ lỗi -> ẩn khối gợi ý, không làm phiền khách.
 */
async function loadVoucherSuggestions() {
  const customer = getCurrentCustomer();
  try {
    const [personal, publicList] = await Promise.all([
      customer ? getCustomerVouchers(customer.id) : [],
      getPublicVouchers(),
    ]);
    const seen = new Set();
    suggestedVouchers = [...personal, ...publicList]
      .filter((v) => !seen.has(v.code) && seen.add(v.code))
      .slice(0, 8);
  } catch (err) {
    console.warn("[order] Không tải được mã gợi ý:", err.message);
    suggestedVouchers = [];
  }
  renderVoucherChips();
}

voucherChipsEl.addEventListener("click", (e) => {
  const chip = e.target.closest(".voucher-chip");
  if (!chip) return;
  if (voucherState.applied?.code === chip.dataset.code) {
    removeVoucher();
    return;
  }
  applyVoucher(chip.dataset.code);
});

voucherApplyBtn.addEventListener("click", () => {
  if (voucherState.applied && voucherState.applied.code === normalizeCode(voucherInput.value)) return;
  applyVoucher(voucherInput.value);
});

voucherRemoveBtn.addEventListener("click", () => {
  removeVoucher();
  voucherInput.focus();
});

// Ô mã luôn IN HOA, không dấu cách; sửa chữ khác mã đang áp dụng -> coi như chưa áp dụng
voucherInput.addEventListener("input", () => {
  const caret = voucherInput.selectionStart;
  const cleaned = voucherInput.value.toUpperCase().replace(/\s+/g, "");
  if (cleaned !== voucherInput.value) {
    const removed = voucherInput.value.length - cleaned.length;
    voucherInput.value = cleaned;
    voucherInput.setSelectionRange(Math.max(0, caret - removed), Math.max(0, caret - removed));
  }
  if (voucherState.applied && voucherState.applied.code !== cleaned) {
    voucherState.applied = null;
    voucherState.checkSeq++;
    showVoucherMessage("Mã đã thay đổi - bấm \"Áp dụng\" để kiểm tra mã mới.", "info");
    renderTotals();
  } else if (!voucherState.applied && voucherMessageEl.classList.contains("is-error")) {
    showVoucherMessage();
  }
  syncVoucherControls();
});

voucherInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    voucherApplyBtn.click();
  }
});

// SĐT ảnh hưởng mã "khách hàng mới" -> kiểm tra lại khi khách sửa xong (blur/change)
phoneInput.addEventListener("change", () => recheckVoucherSoon("phone"));

// Giỏ đổi ở bất kỳ đâu (nút +/- trang này, khung chat AI...) -> vẽ lại + kiểm tra lại mã
window.addEventListener("cartchange", () => {
  if (voucherState.submitting) return;
  renderCart();
  recheckVoucherSoon("cart");
});

/* ---------------- Thông tin thành viên ---------------- */

/**
 * Khách đã đăng nhập: điền sẵn họ tên / SĐT / email vào các ô CÒN TRỐNG
 * (không ghi đè chữ khách đã gõ) và hiện lời chào.
 */
function prefillMemberInfo() {
  const customer = getCurrentCustomer();
  memberNoteEl.hidden = !customer;
  if (!customer) {
    memberNoteEl.textContent = "";
    return;
  }

  const fields = { name: customer.name, phone: customer.phone, email: customer.email };
  Object.entries(fields).forEach(([key, value]) => {
    const input = formEl.elements[key];
    if (input && !input.value.trim() && value) input.value = value;
  });
  memberNoteEl.innerHTML = `${ICONS.user(14)} <span>Xin chào <strong>${escapeHtml(customer.name || "thành viên")}</strong> -
    thông tin đã được điền sẵn từ tài khoản thành viên, bạn vẫn có thể chỉnh sửa.</span>`;
}

// Đăng nhập / đăng xuất (navbar hoặc tab khác) -> điền lại form, tải lại mã cá nhân, kiểm tra lại mã
window.addEventListener("customerchange", () => {
  prefillMemberInfo();
  loadVoucherSuggestions();
  recheckVoucherSoon("customer");
});

/* ---------------- Form đặt bàn / gọi món ---------------- */

/** "YYYY-MM-DDTHH:mm" theo giờ địa phương (toISOString() quy về UTC nên không dùng được) */
function toLocalDatetimeValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Không cho chọn giờ quá khứ hoặc sát giờ ngay ở bộ chọn ngày giờ của trình duyệt */
function setMinBookingTime() {
  if (!bookingTimeInput) return;
  bookingTimeInput.min = toLocalDatetimeValue(new Date(Date.now() + 60 * 60 * 1000));
}

/** Hiện/ẩn các ô theo hình thức phục vụ, và chỉ bắt buộc nhập những ô đang hiện */
function updateConditionalFields() {
  const currentType = formEl.elements.serviceType.value;
  formEl.querySelectorAll(".conditional-fields").forEach((group) => {
    group.hidden = group.dataset.for !== currentType;
  });

  const isBooking = currentType === "booking";
  bookingTimeInput.dataset.rule = isBooking ? "required" : "";
  guestCountInput.dataset.rule = isBooking ? "required|integer|minval:1|maxval:50" : "";
  if (isBooking) setMinBookingTime();
}

formEl.elements.serviceType.forEach((radio) => {
  radio.addEventListener("change", () => {
    clearFormErrors(formEl);
    updateConditionalFields();
  });
});

/**
 * Luật nghiệp vụ của giờ đặt bàn (không khai báo được bằng data-rule):
 * - phải cách hiện tại tối thiểu 1 tiếng để quán kịp chuẩn bị bàn
 * - phải nằm trong giờ mở cửa 18:00 - 02:00 (vắt qua nửa đêm nên so
 *   theo số phút trong ngày: từ 18:00 trở đi HOẶC trước/bằng 02:00)
 */
function validateBookingTime() {
  if (formEl.elements.serviceType.value !== "booking" || !bookingTimeInput.value) return true;

  const chosen = new Date(bookingTimeInput.value);
  const minutesOfDay = chosen.getHours() * 60 + chosen.getMinutes();
  const withinHours = minutesOfDay >= 18 * 60 || minutesOfDay <= 2 * 60;
  const farEnough = chosen.getTime() >= Date.now() + 60 * 60 * 1000;

  let message = "";
  if (!farEnough) message = "Vui lòng đặt bàn trước tối thiểu 1 tiếng.";
  else if (!withinHours) message = "Quán chỉ mở cửa 18:00 - 02:00, vui lòng chọn giờ trong khung này.";

  setFieldError(bookingTimeInput, message);
  return !message;
}

if (bookingTimeInput) bookingTimeInput.addEventListener("change", validateBookingTime);

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (getCart().length === 0) {
    toast("Danh sách món đang trống. Vui lòng chọn món trước.", "error");
    return;
  }

  const { isValid, data } = validateForm(formEl);
  const bookingOk = validateBookingTime();
  if (!isValid || !bookingOk) {
    toast("Vui lòng kiểm tra lại thông tin trong form.", "error");
    return;
  }

  // Khách gõ mã nhưng chưa bấm "Áp dụng" (hoặc sửa mã) -> kiểm tra trước khi gửi,
  // để tổng tiền khách nhìn thấy luôn khớp với đơn được tạo
  const typedCode = normalizeCode(voucherInput.value);
  if (typedCode && voucherState.applied?.code !== typedCode) {
    const ok = await applyVoucher(typedCode);
    if (!ok) {
      toast("Mã giảm giá chưa hợp lệ - vui lòng sửa lại hoặc bấm × để bỏ mã trước khi đặt.", "error");
      voucherInput.focus();
      return;
    }
  }

  const customer = getCurrentCustomer();
  const voucherCode = voucherState.applied?.code || "";
  const restoreButton = setButtonLoading(submitBtn, "Đang gửi đơn đến quán...");
  voucherState.submitting = true;
  try {
    const result = await createOrder({
      name: data.name,
      phone: data.phone,
      email: data.email || "",
      serviceType: data.serviceType,
      tableNumber: data.serviceType === "dine-in" ? data.tableNumber || "" : "",
      bookingTime: data.serviceType === "booking" ? data.bookingTime : "",
      guestCount: data.serviceType === "booking" ? Number(data.guestCount) : null,
      note: data.note || "",
      voucherCode,
      customerId: customer?.id || "",
    });

    // Máy chủ báo giỏ hàng có thay đổi (hết hàng/đổi giá) -> báo khách, không đặt
    announceChanges(result.changes || []);

    // Mã bị từ chối ở bước kiểm tra cuối (VD vừa hết lượt) -> báo tại ô mã,
    // giữ nguyên form + giỏ để khách bỏ mã / đổi mã rồi đặt lại
    if (result.voucherError) {
      voucherState.submitting = false;
      voucherState.applied = null;
      voucherState.lastFailedCode = voucherCode;
      showVoucherMessage(result.voucherError, "error");
      syncVoucherControls();
      renderCart();
      toast("Không thể dùng mã giảm giá cho đơn này - vui lòng xem thông báo tại ô mã.", "error");
      voucherInput.focus();
      voucherInput.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (!result.success) {
      voucherState.submitting = false;
      toast("Các món trong giỏ đã hết hàng hoặc không còn phục vụ, vui lòng chọn món khác.", "error");
      await syncAndRenderCart();
      return;
    }

    // Thành công: bỏ mã đã dùng, xoá form rồi điền lại thông tin thành viên
    voucherState.submitting = false;
    removeVoucher({ silent: true });
    refreshCartBadge();
    renderCart();
    formEl.reset();
    clearFormErrors(formEl);
    updateConditionalFields();
    prefillMemberInfo();
    loadVoucherSuggestions(); // mã cá nhân vừa dùng hết lượt sẽ biến mất khỏi gợi ý
    showOrderSuccessModal(result.order);
  } catch (err) {
    toast(err.message, "error");
  } finally {
    voucherState.submitting = false;
    restoreButton();
    if (getCart().length === 0) submitBtn.disabled = true;
  }
});

/** Các dòng tiền của một đơn đã lưu: tạm tính, tiết kiệm sale món, giảm theo mã */
function orderMoneyRows(order, rowHtml) {
  const rows = [];
  if (order.productSavings > 0) {
    rows.push(rowHtml("Tạm tính theo giá gốc", formatMoney(order.originalSubtotal)));
    rows.push(rowHtml("Tiết kiệm từ sale món", `−${formatMoney(order.productSavings)}`, "is-saving"));
  }
  if (order.discount > 0 || order.voucherCode) {
    rows.push(rowHtml("Tạm tính", formatMoney(order.subtotal)));
    rows.push(rowHtml(
      `Mã giảm giá <span class="summary-code">${escapeHtml(order.voucherCode || "")}</span>`,
      `−${formatMoney(order.discount)}`,
      "is-discount",
    ));
  }
  return rows.join("");
}

function showOrderSuccessModal(order) {
  const host = document.createElement("div");
  host.className = "modal-overlay show";
  host.innerHTML = `
    <div class="modal-box modal-success-order" role="dialog" aria-modal="true">
      <div class="success-icon-wrap">${ICONS.checkCircle(40)}</div>
      <h3 class="modal-success-title">Đặt chỗ thành công!</h3>
      <p class="modal-success-sub">Hãy lưu lại mã đơn - cần mã này cùng số điện thoại để tra cứu.</p>

      <div class="order-receipt-card">
        <div class="receipt-row"><span>Mã đặt chỗ:</span><strong class="receipt-code">${escapeHtml(order.code)}</strong></div>
        <div class="receipt-row"><span>Khách hàng:</span><span>${escapeHtml(order.name)}</span></div>
        <div class="receipt-row"><span>Hình thức:</span><span>${order.serviceLabel}</span></div>
        ${order.serviceDetails().map(([label, value]) => `
          <div class="receipt-row"><span>${label}:</span><span>${escapeHtml(value)}</span></div>`).join("")}
        ${orderMoneyRows(order, (label, value, cls = "") => `
          <div class="receipt-row ${cls}"><span>${label}:</span><span>${value}</span></div>`)}
        <div class="receipt-row receipt-total"><span>Tổng thanh toán:</span><strong class="text-amber">${formatMoney(order.total)}</strong></div>
      </div>

      <div class="modal-actions-stacked" style="display: flex; flex-direction: column; gap: 10px;">
        <button type="button" class="btn btn-primary btn-block btn-vqr-pay" id="success-open-vietqr-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          <span>Quét Mã VietQR Chuyển Khoản Ngay (${formatMoney(order.total)})</span>
        </button>
        <button type="button" class="btn btn-ghost btn-block" id="success-close-btn">Đã hiểu &amp; Đóng</button>
      </div>
    </div>`;

  document.body.appendChild(host);
  const close = () => host.remove();
  host.querySelector("#success-close-btn").addEventListener("click", close);
  host.querySelector("#success-open-vietqr-btn").addEventListener("click", () => {
    close();
    openVietQRPaymentModal(order);
  });
  host.addEventListener("click", (e) => { if (e.target === host) close(); });
}

/* ---------------- Tra cứu đơn hàng ---------------- */

const lookupForm = document.getElementById("lookup-form");
const lookupBtn = document.getElementById("lookup-btn");
const lookupResultsEl = document.getElementById("lookup-results");
let lastLookedUpOrder = null;

function lookupResultHtml(o) {
  const items = (o.items || []).map((i) => `${escapeHtml(i.name)} × ${i.qty}`).join(", ");
  const showQrBtn = o.status !== "cancelled";

  return `
    <div class="lookup-item">
      <div class="lookup-item-header">
        <span class="lookup-code">${escapeHtml(o.code)}</span>
        <span class="badge ${o.statusBadge}">${o.statusLabel}</span>
      </div>
      <div class="lookup-item-body">
        <p><strong>Khách hàng:</strong> ${escapeHtml(o.name)}</p>
        <p><strong>Hình thức:</strong> ${o.serviceLabel}</p>
        ${o.serviceDetails().map(([label, value]) => `<p><strong>${label}:</strong> ${escapeHtml(value)}</p>`).join("")}
        <p><strong>Món đã gọi:</strong> ${items}</p>
        <p><strong>Đặt lúc:</strong> ${formatDateTime(o.createdAt)}</p>
        ${orderMoneyRows(o, (label, value, cls = "") => `<p class="${cls}"><strong>${label}:</strong> ${value}</p>`)}
        <p><strong>Tổng thanh toán:</strong> <strong class="text-amber">${formatMoney(o.total)}</strong></p>
        ${showQrBtn ? `
          <div class="mt-3">
            <button type="button" class="btn btn-primary btn-sm btn-vqr-pay" id="lookup-qr-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              <span>Mở Mã VietQR Chuyển Khoản (${formatMoney(o.total)})</span>
            </button>
          </div>` : ""}
      </div>
    </div>`;
}

if (lookupResultsEl) {
  lookupResultsEl.addEventListener("click", (e) => {
    const qrBtn = e.target.closest("#lookup-qr-btn");
    if (qrBtn && lastLookedUpOrder) {
      openVietQRPaymentModal(lastLookedUpOrder);
    }
  });
}

if (lookupForm) {
  lookupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { isValid, data } = validateForm(lookupForm);
    if (!isValid) return;

    lookupResultsEl.hidden = false;
    lookupResultsEl.innerHTML = loadingHtml("Đang tra cứu...");
    const restoreButton = setButtonLoading(lookupBtn, "Đang tra cứu...");

    try {
      const order = await findOrderByCodeAndPhone(data.code, data.phone);
      lastLookedUpOrder = order;
      lookupResultsEl.innerHTML = order ? lookupResultHtml(order) : `
        <div class="lookup-empty">
          <p>Không tìm thấy đơn nào khớp với mã <strong>${escapeHtml(data.code)}</strong> và số điện thoại đã nhập.
             Vui lòng kiểm tra lại cả hai thông tin.</p>
        </div>`;
    } catch (err) {
      lookupResultsEl.innerHTML = errorHtml(err.message);
    } finally {
      restoreButton();
    }
  });
}

/* ---------------- Khởi động ---------------- */

function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const table = params.get("table");
  if (table) {
    const dineInRadio = formEl.querySelector('input[name="serviceType"][value="dine-in"]');
    if (dineInRadio) {
      dineInRadio.checked = true;
      updateConditionalFields();
    }
    const tableInput = formEl.elements.tableNumber;
    if (tableInput) {
      tableInput.value = table;
    }
    toast(`Đã chọn vị trí: "${table}" từ mô hình 3D!`, "info");
    const orderBox = document.querySelector(".order-summary-box") || formEl;
    if (orderBox) {
      setTimeout(() => orderBox.scrollIntoView({ behavior: "smooth", block: "start" }), 350);
    }
  }
}

/**
 * Mở trang với ?voucher=MÃ (nút "Dùng ngay" ở trang Khuyến mãi / tài khoản):
 * điền sẵn mã và áp dụng sau khi giỏ đã đối chiếu xong với thực đơn
 * (để kiểm tra đơn tối thiểu trên giá mới nhất).
 */
async function applyVoucherFromUrl() {
  const code = normalizeCode(getQueryParam("voucher") || "");
  if (!code) return;
  voucherInput.value = code;
  const ok = await applyVoucher(code);
  if (ok) toast(`Đã áp dụng mã ${code} cho phiếu đặt chỗ.`, "success");
}

async function init() {
  updateConditionalFields();
  prefillMemberInfo();
  checkUrlParams();
  syncVoucherControls();
  cartListEl.innerHTML = loadingHtml("Đang kiểm tra danh sách món đã chọn...");
  await syncAndRenderCart();
  await Promise.all([loadVoucherSuggestions(), applyVoucherFromUrl()]);
}

init();

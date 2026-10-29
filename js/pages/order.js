/* =========================================================
   ORDER.JS - Trang giỏ hàng + đặt bàn/đặt món + tra cứu đơn
   - Giỏ hàng: đọc/ghi localStorage (thao tác tức thì).
   - Đặt hàng, tra cứu: gọi API json-server bằng async/await.
   ========================================================= */

import "../modules/navbar.js";
import { refreshCartBadge } from "../modules/navbar.js";
import {
  getCart, updateCartQty, removeFromCart, getCartSummary, createOrder,
  syncCartWithCatalog, findOrderByCodeAndPhone, reportTransferSent,
  getRemainingSeats, cancelByCustomer, getAllOrders,
} from "../modules/ordersService.js";
import { availableQty } from "../modules/drinksService.js";
import { formatMoney, formatDateTime, escapeHtml, debounce } from "../modules/utils.js";
import { validateForm, clearFormErrors, setFieldError } from "../modules/validation.js";
import { toast, confirmDialog, setButtonLoading, loadingHtml, errorHtml } from "../modules/ui.js";
import { ICONS } from "../modules/icons.js";
import { openVietQRPaymentModal } from "../modules/vietqrService.js";
import { isWithinOpeningHours, openingHoursText, BOOKING_RULES } from "../modules/venue.js";
import { getCurrentLang, t } from "../modules/i18n.js";
import { getCurrentCustomer, syncCustomerSession } from "../modules/customerAuth.js";
import { resolvePricing, POINT_REDEEM_VND, MIN_POINT_REDEEM } from "../modules/promotions.js";
import { getItem, setItem, removeItem } from "../modules/storage.js";

const APPLIED_VOUCHER_KEY = "applied_voucher";

const cartListEl = document.getElementById("cart-list");
const sumCountEl = document.getElementById("sum-count");
const sumTotalEl = document.getElementById("sum-total");
const sumFinalEl = document.getElementById("sum-final");
const promoLinesEl = document.getElementById("promo-lines");
const voucherInput = document.getElementById("voucher-input");
const voucherMsgEl = document.getElementById("voucher-msg");
const pointsBoxEl = document.getElementById("points-box");
const pointsInput = document.getElementById("points-input");
const pointsMsgEl = document.getElementById("points-msg");
const pointsBalanceEl = document.getElementById("points-balance");
const loginHintEl = document.getElementById("promo-login-hint");
const formEl = document.getElementById("order-form");
const submitBtn = document.getElementById("submit-order-btn");
const bookingTimeInput = document.getElementById("booking-time-input");
const guestCountInput = formEl.elements.guestCount;
const capacityHint = document.getElementById("capacity-hint");
const ageCheckbox = document.getElementById("age-confirm");

const MINUTE = 60 * 1000;
const isBooking = () => formEl.elements.serviceType.value === "booking";

/** fmt("Còn {left} chỗ", { left: 5 }) -> "Còn 5 chỗ" - chèn số liệu vào câu đã dịch */
const fmt = (text, vars) => text.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");

/** Nhãn trạng thái / hình thức / thanh toán của đơn theo ngôn ngữ đang chọn */
const statusText = (o) => t(`order_status_${o.status}`, o.statusLabel);
const serviceText = (o) => t(`order_service_${o.serviceType.replace("-", "_")}`, o.serviceLabel);
const paymentText = (o) => t(`order_payment_${o.paymentStatus}`, o.paymentLabel);

/**
 * Nút gửi đổi theo tình huống:
 * - Gọi món tại bàn: phải có món -> giỏ trống thì khoá nút.
 * - Đặt bàn trước: luôn gửi được (gọi món trước là tuỳ chọn).
 */
function updateSubmitState() {
  const hasItems = getCart().length > 0;
  submitBtn.disabled = !hasItems && !isBooking();
  // Tìm lại mỗi lần: setButtonLoading() thay innerHTML của nút nên phần tử cũ không còn trên trang
  const submitLabel = document.getElementById("submit-order-label");
  if (!submitLabel) return;
  submitLabel.textContent = !isBooking()
    ? t("order_btn_order", "Xác Nhận Gọi Món")
    : hasItems ? t("order_btn_book_order", "Xác Nhận Đặt Bàn & Gọi Món") : t("order_btn_book", "Xác Nhận Giữ Bàn");
}

/** Tồn kho mới nhất của từng món (id -> stock), cập nhật mỗi lần đối chiếu với API */
let stockById = new Map();

/**
 * Mở mã QR cho khách. Bấm "Tôi đã chuyển khoản" chỉ BÁO cho quán
 * (paymentStatus -> "awaiting"); thu ngân đối chiếu sao kê rồi mới xác nhận.
 */
function openCustomerPayment(order, afterReport) {
  openVietQRPaymentModal(order, {
    confirmLabel: "Tôi Đã Chuyển Khoản Xong",
    onConfirm: async () => {
      const updated = await reportTransferSent(order.id);
      toast(`Đã báo quán! Thu ngân sẽ đối chiếu khoản chuyển cho đơn ${order.code}.`, "success");
      if (afterReport) afterReport(updated);
    },
  });
}

const unpaidBannerWrap = document.getElementById("active-unpaid-banner-wrap");
const LATEST_ORDER_KEY = "quanbar_latest_order";

async function checkAndRenderUnpaidOrderBanner() {
  if (!unpaidBannerWrap) return;
  try {
    const customer = getCurrentCustomer();
    const storedRef = getItem(LATEST_ORDER_KEY, null);
    const all = await getAllOrders();

    // Tìm đơn mới nhất của khách hàng mà chưa thanh toán và chưa huỷ
    let unpaidOrder = null;
    if (customer) {
      unpaidOrder = all.find((o) => (o.customerId === customer.id || o.phone === customer.phone) && o.status !== "cancelled" && o.paymentStatus === "unpaid" && o.total > 0);
    }
    if (!unpaidOrder && storedRef) {
      unpaidOrder = all.find((o) => o.id === storedRef.id && o.status !== "cancelled" && o.paymentStatus === "unpaid" && o.total > 0);
    }

    if (!unpaidOrder) {
      unpaidBannerWrap.innerHTML = "";
      unpaidBannerWrap.hidden = true;
      return;
    }

    unpaidBannerWrap.hidden = false;
    unpaidBannerWrap.innerHTML = `
      <div class="active-unpaid-order-banner" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: var(--radius-sm); gap: 16px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 38px; height: 38px; border-radius: 50%; background: rgba(239, 68, 68, 0.15); display: flex; align-items: center; justify-content: center; color: #ef4444; flex-shrink: 0;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span style="font-size: 0.85rem; color: var(--cream); font-weight: 500;">Bạn có đơn hàng đang chờ thanh toán:</span>
              <strong class="text-amber font-mono" style="font-size: 0.95rem;">${escapeHtml(unpaidOrder.code)}</strong>
              <span class="badge badge-danger" style="font-size: 0.72rem;">Chưa thanh toán</span>
            </div>
            <p class="text-xs text-muted" style="margin: 3px 0 0 0;">
              Tổng tiền: <strong class="text-amber">${formatMoney(unpaidOrder.total)}</strong> · ${escapeHtml(unpaidOrder.serviceLabel || "")} · Quý khách vui lòng thanh toán để quán chuẩn bị phục vụ chu đáo nhất.
            </p>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button type="button" class="btn btn-primary btn-sm btn-vqr-pay" id="banner-pay-btn" style="white-space: nowrap; font-size: 0.8rem;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            <span>Quét mã VietQR thanh toán</span>
          </button>
          <button type="button" class="btn btn-ghost btn-sm" id="banner-dismiss-btn" title="Đóng thông báo" style="padding: 4px 8px;">✕</button>
        </div>
      </div>`;

    document.getElementById("banner-pay-btn")?.addEventListener("click", () => {
      openCustomerPayment(unpaidOrder, () => {
        checkAndRenderUnpaidOrderBanner();
      });
    });

    document.getElementById("banner-dismiss-btn")?.addEventListener("click", () => {
      unpaidBannerWrap.innerHTML = "";
      unpaidBannerWrap.hidden = true;
    });
  } catch (err) {
    console.error("Không thể tải thông tin đơn chờ thanh toán:", err);
  }
}

/* ---------------- Giỏ hàng ---------------- */

function cartItemHtml(item, currentPricing = pricing) {
  const maxQty = stockById.get(item.drinkId) ?? item.qty;
  const isImage = item.image && (item.image.includes("/") || item.image.startsWith("http"));
  const imageHtml = isImage
    ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" class="cart-item-img">`
    : `<div class="cart-fallback-icon">${ICONS.cocktail(20)}</div>`;

  let priceHtml = `<p class="cart-item-price">${formatMoney(item.price)}</p>`;
  if (currentPricing && currentPricing.subtotal > 0 && Array.isArray(currentPricing.discounts) && currentPricing.discounts.length > 0) {
    const productDiscounts = currentPricing.discounts
      .filter((d) => d.type === "rank" || d.type === "voucher")
      .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const rate = productDiscounts / currentPricing.subtotal;
    if (rate > 0) {
      const discountedUnit = Math.max(0, Math.round(item.price * (1 - rate)));
      const percentTag = Math.round(rate * 100);
      priceHtml = `
        <div class="cart-item-price-wrap" style="display: flex; flex-direction: column; gap: 2px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="cart-item-orig-price" style="text-decoration: line-through; opacity: 0.55; font-size: 0.8rem;">${formatMoney(item.price)}</span>
            <span class="cart-item-price text-amber font-bold" style="font-size: 0.95rem;">${formatMoney(discountedUnit)}</span>
            <span class="badge badge-warning" style="font-size: 0.65rem; padding: 1px 5px;">-${percentTag}%</span>
          </div>
          ${item.qty > 1 ? `<div class="text-xs text-muted">Thành tiền: <strong class="text-amber">${formatMoney(discountedUnit * item.qty)}</strong></div>` : ""}
        </div>`;
    }
  }

  return `
    <div class="cart-item" data-id="${item.drinkId}" data-max="${maxQty}">
      <div class="cart-item-thumb">${imageHtml}</div>
      <div class="cart-item-info">
        <p class="cart-item-name">${escapeHtml(item.name)}</p>
        ${priceHtml}
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

  const emptyText = isBooking()
    ? t("order_empty_booking", "Chưa chọn món nào - không sao, quý khách vẫn có thể chỉ giữ bàn. Muốn quầy bar chuẩn bị sẵn khi đến? Hãy chọn món từ thực đơn.")
    : t("order_empty_dinein", "Hãy chọn ly cocktail yêu thích từ thực đơn để gọi món tại bàn.");

  cartListEl.innerHTML = cart.length ? cart.map((i) => cartItemHtml(i, pricing)).join("") : `
    <div class="empty-state cart-empty">
      <div class="empty-icon">${ICONS.shoppingBag(36)}</div>
      <h4>${t("order_empty_title", "Danh sách thức uống đang trống")}</h4>
      <p class="text-muted">${emptyText}</p>
      <a href="menu.html" class="btn btn-primary mt-2">
        ${ICONS.arrowRight(14)} <span>${t("order_empty_btn", "Khám phá thực đơn")}</span>
      </a>
    </div>`;

  const { total, count } = getCartSummary();
  if (sumCountEl) sumCountEl.textContent = `${count} ly`;
  if (sumTotalEl) sumTotalEl.textContent = formatMoney(total);
  if (sumFinalEl && !pricing) sumFinalEl.textContent = formatMoney(total); // tạm hiện bằng tạm tính, ngay sau đó refreshPricing() cập nhật
  updateSubmitState();
  refreshPricing();
}

/* ---------------- Ưu đãi: giảm theo hạng, mã giảm giá, dùng điểm ---------------- */

const savedVoucher = getItem(APPLIED_VOUCHER_KEY, "");
const promo = { voucher: savedVoucher || "", points: 0 }; // khách đang nhập gì (chưa chắc hợp lệ)
if (voucherInput && savedVoucher) {
  voucherInput.value = savedVoucher;
}
let pricing = null;                       // kết quả tính giá mới nhất (promotions.resolvePricing)
let pricingRequestId = 0;

const discountLineHtml = (d) =>
  `<div class="summary-row promo-line promo-${d.type}"><span>${escapeHtml(d.label)}</span><span>−${formatMoney(d.amount)}</span></div>`;

function setPromoMessage(el, text, kind = "") {
  el.textContent = text;
  el.classList.toggle("is-error", kind === "error");
  el.classList.toggle("is-ok", kind === "ok");
}

/** Vẽ phần ưu đãi từ kết quả tính giá */
function renderPricing(result, customer) {
  sumFinalEl.textContent = formatMoney(result.total);
  promoLinesEl.innerHTML = result.discounts.map(discountLineHtml).join("");

  // Cập nhật giá trên từng món theo mức giảm mới nhất ("giá theo")
  const cart = getCart();
  if (cart.length && cartListEl) {
    cartListEl.innerHTML = cart.map((i) => cartItemHtml(i, result)).join("");
  }

  const voucherAmount = result.discounts.find((d) => d.type === "voucher")?.amount || 0;
  if (result.voucherError) setPromoMessage(voucherMsgEl, result.voucherError, "error");
  else if (result.voucherCode) setPromoMessage(voucherMsgEl, fmt(t("order_voucher_ok", "Đã áp mã {code}: giảm {amount}."), { code: result.voucherCode, amount: formatMoney(voucherAmount) }), "ok");
  else setPromoMessage(voucherMsgEl, "");

  pointsBoxEl.hidden = !customer;
  loginHintEl.hidden = Boolean(customer);
  if (!customer) return;

  const balance = Number(result.customer?.points ?? customer.points) || 0;
  pointsBalanceEl.textContent = fmt(t("order_points_info", "({points} điểm · 1 điểm = {value})"), { points: balance, value: formatMoney(POINT_REDEEM_VND) });
  pointsInput.max = result.maxPoints;
  if (result.pointsError) setPromoMessage(pointsMsgEl, result.pointsError, "error");
  else if (result.pointsUsed > 0) setPromoMessage(pointsMsgEl, fmt(t("order_points_ok", "Dùng {points} điểm: giảm {amount}."), { points: result.pointsUsed, amount: formatMoney(result.pointsUsed * POINT_REDEEM_VND) }), "ok");
  else if (result.maxPoints >= MIN_POINT_REDEEM) setPromoMessage(pointsMsgEl, fmt(t("order_points_hint", "Dùng từ {min} điểm, tối đa {max} điểm cho đơn này."), { min: MIN_POINT_REDEEM, max: result.maxPoints }));
  else setPromoMessage(pointsMsgEl, t("order_points_none", "Đơn này chưa dùng được điểm thưởng."));
}

/**
 * Tính lại giá theo giỏ + khách + mã + điểm đang nhập. Gõ/đổi nhanh nhiều lần thì chỉ kết quả
 * của lần hỏi MỚI NHẤT được hiện (requestId). Lỗi mạng -> hiện giá chưa giảm, không chặn việc gọi món.
 * @returns {Promise<object|null>} kết quả tính giá (null nếu không tính được hoặc đã có lần hỏi mới hơn)
 */
async function refreshPricing() {
  const requestId = ++pricingRequestId;
  const subtotal = getCartSummary().total;
  const customer = getCurrentCustomer();
  try {
    const code = promo.voucher.trim();
    const orders = code ? await getAllOrders() : [];
    const result = await resolvePricing({
      subtotal,
      customerId: customer?.id || "",
      voucherCode: code,
      pointsToUse: promo.points,
      phone: formEl.elements.phone.value,
      orders,
    });
    if (requestId !== pricingRequestId) return null;
    pricing = result;
    renderPricing(result, customer);
    return result;
  } catch {
    if (requestId !== pricingRequestId) return null;
    pricing = null;
    promoLinesEl.innerHTML = "";
    sumFinalEl.textContent = formatMoney(subtotal);
    return null;
  }
}

function resetPromo() {
  promo.voucher = "";
  promo.points = 0;
  voucherInput.value = "";
  pointsInput.value = "";
  pricing = null;
  removeItem(APPLIED_VOUCHER_KEY);
}

function applyVoucherInput() {
  promo.voucher = voucherInput.value.trim();
  if (promo.voucher) {
    setItem(APPLIED_VOUCHER_KEY, promo.voucher);
  } else {
    removeItem(APPLIED_VOUCHER_KEY);
  }
  refreshPricing();
}

document.getElementById("voucher-apply-btn").addEventListener("click", applyVoucherInput);
voucherInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  applyVoucherInput();
});
pointsInput.addEventListener("input", debounce(() => {
  promo.points = Math.max(0, Math.floor(Number(pointsInput.value) || 0));
  refreshPricing();
}, 300));
document.getElementById("points-max-btn").addEventListener("click", () => {
  promo.points = pricing?.maxPoints || 0;
  pointsInput.value = promo.points || "";
  refreshPricing();
});
// Mã chỉ dùng 1 lần / số điện thoại -> đổi số thì kiểm tra lại mã
formEl.elements.phone.addEventListener("input", debounce(() => { if (promo.voucher) refreshPricing(); }, 400));

/** Thông báo cho khách biết vì sao giỏ hàng vừa tự thay đổi */
function announceChanges(changes) {
  changes.forEach((c) => {
    if (c.type === "removed") toast(`"${c.name}" đã bị bỏ khỏi danh sách: ${c.reason}.`, "error");
    if (c.type === "reduced") toast(`"${c.name}" đã được điều chỉnh về ${c.to} ly theo khả năng phục vụ.`, "error");
    if (c.type === "price") toast(`Giá "${c.name}" vừa được cập nhật: ${formatMoney(c.to)}.`, "info");
  });
}

/**
 * Đối chiếu giỏ với thực đơn MỚI NHẤT trên máy chủ (async) rồi vẽ lại.
 * @returns {Promise<boolean>} true nếu đối chiếu được với máy chủ
 */
async function syncAndRenderCart() {
  try {
    const { changes, drinkMap } = await syncCartWithCatalog();
    stockById = new Map([...drinkMap].map(([id, d]) => [id, availableQty(d)]));
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

  refreshCartBadge();
  renderCart();
});

/* ---------------- Form đặt bàn / gọi món ---------------- */

/** "YYYY-MM-DDTHH:mm" theo giờ địa phương (toISOString() quy về UTC nên không dùng được) */
function toLocalDatetimeValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Bộ chọn ngày giờ của trình duyệt chỉ cho chọn trong khoảng hợp lệ:
 * sớm nhất = bây giờ + minLeadMinutes, xa nhất = bây giờ + maxDaysAhead ngày.
 */
function setBookingTimeRange() {
  if (!bookingTimeInput) return;
  bookingTimeInput.min = toLocalDatetimeValue(new Date(Date.now() + BOOKING_RULES.minLeadMinutes * MINUTE));
  bookingTimeInput.max = toLocalDatetimeValue(new Date(Date.now() + BOOKING_RULES.maxDaysAhead * 24 * 60 * MINUTE));
}

/** Hiện/ẩn các ô theo hình thức phục vụ, và chỉ bắt buộc nhập những ô đang hiện */
function updateConditionalFields() {
  const currentType = formEl.elements.serviceType.value;
  formEl.querySelectorAll(".conditional-fields").forEach((group) => {
    group.hidden = group.dataset.for !== currentType;
  });

  const booking = currentType === "booking";
  bookingTimeInput.dataset.rule = booking ? "required" : "";
  guestCountInput.dataset.rule = booking ? "required|integer|minval:1|maxval:50" : "";
  if (booking) setBookingTimeRange();
  renderCart(); // chữ trong giỏ trống + nút gửi khác nhau giữa 2 hình thức
}

formEl.elements.serviceType.forEach((radio) => {
  radio.addEventListener("change", () => {
    clearFormErrors(formEl);
    updateConditionalFields();
    updateCapacityHint();
  });
});

/**
 * Luật nghiệp vụ của giờ đặt bàn (không khai báo được bằng data-rule),
 * tất cả lấy từ venue.js (cùng dữ liệu với mục "Địa điểm" trên trang chủ):
 * - cách hiện tại tối thiểu minLeadMinutes để quán kịp chuẩn bị bàn
 * - không xa quá maxDaysAhead ngày
 * - nằm trong giờ mở cửa OPENING_HOURS
 */
function validateBookingTime() {
  if (!isBooking() || !bookingTimeInput.value) return true;

  const chosen = new Date(bookingTimeInput.value).getTime();
  const earliest = Date.now() + BOOKING_RULES.minLeadMinutes * MINUTE;
  const latest = Date.now() + BOOKING_RULES.maxDaysAhead * 24 * 60 * MINUTE;

  let message = "";
  if (chosen < earliest) message = fmt(t("order_err_lead", "Vui lòng đặt bàn trước tối thiểu {lead} phút."), { lead: BOOKING_RULES.minLeadMinutes });
  else if (chosen > latest) message = fmt(t("order_err_ahead", "Quán nhận đặt bàn trước tối đa {days} ngày."), { days: BOOKING_RULES.maxDaysAhead });
  else if (!isWithinOpeningHours(new Date(chosen))) message = fmt(t("order_err_hours", "Giờ mở cửa {hours}. Vui lòng chọn giờ trong khung này."), { hours: openingHoursText(getCurrentLang()) });

  setFieldError(bookingTimeInput, message);
  return !message;
}

/* ---------------- Số chỗ còn trống (sức chứa theo khung giờ) ---------------- */

let capacityRequestId = 0;

/**
 * Hỏi máy chủ số chỗ còn trống quanh giờ khách chọn rồi báo ngay dưới ô
 * "Số lượng khách". Gõ/đổi nhanh nhiều lần thì chỉ hiện kết quả của lần
 * hỏi MỚI NHẤT (requestId) - kết quả cũ về muộn sẽ bị bỏ qua.
 */
async function updateCapacityHint() {
  if (!capacityHint) return;
  if (!isBooking() || !bookingTimeInput.value || !validateBookingTime()) {
    capacityHint.textContent = "";
    return;
  }

  const requestId = ++capacityRequestId;
  try {
    const remaining = await getRemainingSeats(new Date(bookingTimeInput.value).toISOString());
    if (requestId !== capacityRequestId) return;

    const guests = Number(guestCountInput.value) || 0;
    capacityHint.classList.toggle("is-full", remaining === 0 || guests > remaining);
    capacityHint.textContent = remaining === 0
      ? t("order_cap_full", "Khung giờ này đã kín chỗ - vui lòng chọn giờ khác.")
      : guests > remaining
        ? fmt(t("order_cap_short", "Khung giờ này chỉ còn {left} chỗ, không đủ cho {guests} khách."), { left: remaining, guests })
        : fmt(t("order_cap_ok", "Còn {left}/{cap} chỗ trong khung giờ này."), { left: remaining, cap: BOOKING_RULES.capacity });
  } catch {
    if (requestId === capacityRequestId) capacityHint.textContent = "";
  }
}

const debouncedCapacityHint = debounce(updateCapacityHint, 300);

if (bookingTimeInput) bookingTimeInput.addEventListener("change", updateCapacityHint);
guestCountInput.addEventListener("input", debouncedCapacityHint);

/* ---------------- Xác nhận đủ 18 tuổi ---------------- */

function validateAge() {
  const label = ageCheckbox.closest(".age-confirm");
  const message = ageCheckbox.checked ? "" : t("order_age_error", "Vui lòng xác nhận quý khách đã đủ 18 tuổi.");
  setFieldError(label, message);
  return !message;
}

ageCheckbox.addEventListener("change", validateAge);

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Gọi món tại bàn bắt buộc có món; đặt bàn trước thì gọi món là tuỳ chọn
  if (getCart().length === 0 && !isBooking()) {
    toast(t("order_err_empty_dinein", "Danh sách món đang trống. Vui lòng chọn món để gọi tại bàn."), "error");
    return;
  }

  const { isValid, data } = validateForm(formEl);
  const bookingOk = validateBookingTime();
  const ageOk = validateAge();
  if (!isValid || !bookingOk || !ageOk) {
    toast(t("order_err_form", "Vui lòng kiểm tra lại thông tin trong form."), "error");
    return;
  }

  // Chốt lại ưu đãi theo dữ liệu mới nhất; mã/điểm đang báo lỗi thì dừng để khách sửa, không âm thầm bỏ ưu đãi
  const latest = await refreshPricing();
  if (latest && (latest.voucherError || latest.pointsError)) {
    toast(latest.voucherError || latest.pointsError, "error");
    return;
  }

  const restoreButton = setButtonLoading(submitBtn, "Đang gửi đơn đến quán...");
  try {
    const result = await createOrder({
      birthDate: data.birthDate,
      voucherCode: latest?.voucherCode || "",
      pointsToUse: latest?.pointsUsed || 0,
      name: data.name,
      phone: data.phone,
      email: data.email || "",
      serviceType: data.serviceType,
      customerId: getCurrentCustomer()?.id || "", // khách đã đăng nhập -> được tích điểm khi đơn hoàn tất
      tableNumber: data.serviceType === "dine-in" ? data.tableNumber || "" : "",
      bookingTime: data.serviceType === "booking" ? data.bookingTime : "",
      guestCount: data.serviceType === "booking" ? Number(data.guestCount) : null,
      note: data.note || "",
    });

    // Máy chủ báo giỏ hàng có thay đổi (hết hàng/đổi giá) -> báo khách, không đặt
    announceChanges(result.changes || []);
    if (!result.success) {
      toast(t("order_err_soldout", "Các món trong giỏ đã hết hàng hoặc không còn phục vụ, vui lòng chọn món khác."), "error");
      await syncAndRenderCart();
      return;
    }

    refreshCartBadge();
    formEl.reset();
    clearFormErrors(formEl);
    capacityHint.textContent = "";
    resetPromo();
    syncCustomerSession().catch(() => {}); // điểm vừa trừ -> cập nhật số dư trên thanh menu
    updateConditionalFields();
    fillCustomerInfo(); // reset() vừa xoá form - khách đã đăng nhập thì điền lại tên/SĐT cho lần đặt sau
    setItem(LATEST_ORDER_KEY, { id: result.order.id, code: result.order.code, phone: result.order.phone });
    checkAndRenderUnpaidOrderBanner();
    showOrderSuccessModal(result.order);
  } catch (err) {
    toast(err.message, "error");
    updateCapacityHint(); // VD vừa có người đặt kín chỗ -> cập nhật số chỗ còn lại
    refreshPricing();     // VD mã vừa hết lượt -> hiện lý do ngay dưới ô nhập mã
  } finally {
    restoreButton();
    updateSubmitState();
  }
});

function showOrderSuccessModal(order) {
  const host = document.createElement("div");
  host.className = "modal-overlay show";
  host.innerHTML = `
    <div class="modal-box modal-success-order" role="dialog" aria-modal="true">
      <div class="success-icon-wrap">${ICONS.checkCircle(40)}</div>
      <h3 class="modal-success-title">${order.isTableOnly ? t("order_success_table", "Giữ bàn thành công!") : t("order_success", "Đặt chỗ thành công!")}</h3>
      <p class="modal-success-sub">${t("order_success_sub", "Hãy lưu lại mã đơn - cần mã này cùng số điện thoại để tra cứu hoặc huỷ đặt chỗ.")}</p>

      <div class="order-receipt-card">
        <div class="receipt-row"><span>${t("order_rc_code", "Mã đặt chỗ")}:</span><strong class="receipt-code">${escapeHtml(order.code)}</strong></div>
        <div class="receipt-row"><span>${t("order_rc_customer", "Khách hàng")}:</span><span>${escapeHtml(order.name)}</span></div>
        <div class="receipt-row"><span>${t("order_rc_service", "Hình thức")}:</span><span>${serviceText(order)}</span></div>
        ${order.serviceDetails().map(([label, value]) => `
          <div class="receipt-row"><span>${label}:</span><span>${escapeHtml(value)}</span></div>`).join("")}
        ${order.discountTotal > 0 ? `
          <div class="receipt-row"><span>${t("order_subtotal", "Tổng tạm tính")}:</span><span>${formatMoney(order.subtotal)}</span></div>
          ${order.discounts.map((d) => `<div class="receipt-row"><span>${escapeHtml(d.label)}:</span><span>−${formatMoney(d.amount)}</span></div>`).join("")}` : ""}
        <div class="receipt-row"><span>${t("order_rc_total", "Tổng thanh toán")}:</span><strong class="text-amber">${formatMoney(order.total)}</strong></div>
      </div>

      <div class="door-host-notice-card" style="margin: 16px 0; text-align: left;">
        <div class="notice-icon">🛡️</div>
        <div class="notice-content">
          <div class="notice-title">QUY ĐỊNH CHECK-IN TẠI CỬA (DOOR HOST)</div>
          <p class="notice-text">Quý khách vui lòng mang theo <strong>CCCD hoặc mở ứng dụng VNeID chính chủ</strong> để đối chiếu độ tuổi trước khi nhận bàn. Mọi trường hợp dưới 18 tuổi hoặc khai báo sai lệch sẽ bị từ chối phục vụ và hủy bàn theo quy định pháp luật.</p>
        </div>
      </div>

      <div class="modal-actions-stacked" style="display: flex; flex-direction: column; gap: 10px;">
        ${order.needsPayment ? `
        <button type="button" class="btn btn-primary btn-block btn-vqr-pay" id="success-open-vietqr-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          <span>${t("order_qr_now", "Quét Mã VietQR Chuyển Khoản Ngay")} (${formatMoney(order.total)})</span>
        </button>` : ""}
        <button type="button" class="btn btn-ghost btn-block" id="success-close-btn">${t("order_close", "Đã hiểu & Đóng")}</button>
      </div>
    </div>`;

  document.body.appendChild(host);
  const close = () => host.remove();
  host.querySelector("#success-close-btn").addEventListener("click", close);
  host.querySelector("#success-open-vietqr-btn")?.addEventListener("click", () => {
    close();
    openCustomerPayment(order);
  });
  host.addEventListener("click", (e) => { if (e.target === host) close(); });
}

/* ---------------- Tra cứu đơn hàng ---------------- */

const lookupForm = document.getElementById("lookup-form");
const lookupBtn = document.getElementById("lookup-btn");
const lookupResultsEl = document.getElementById("lookup-results");
let lastLookedUpOrder = null;
let lastLookupPhone = ""; // huỷ đơn phải gửi lại đúng SĐT đã dùng khi tra cứu

function lookupResultHtml(o) {
  const items = o.items.map((i) => `${escapeHtml(i.name)} × ${i.qty}`).join(", ");
  const showQrBtn = o.needsPayment; // chưa huỷ, chưa được xác nhận đã trả, có tiền phải trả

  // Khách tự huỷ được không - quy tắc nằm trong chính đối tượng đơn (đa hình theo loại đơn)
  const cancel = o.customerCancelCheck();
  const cancelHtml = cancel.ok
    ? `<button type="button" class="btn btn-ghost btn-sm" id="lookup-cancel-btn">
         ${ICONS.trash(14)} <span>${o.serviceType === "booking" ? t("order_cancel_booking", "Huỷ đặt bàn") : t("order_cancel_order", "Huỷ đơn")}</span>
       </button>`
    : (o.status === "pending" || o.status === "preparing")
      ? `<p class="lookup-cancel-note">${escapeHtml(cancel.reason)}</p>`
      : "";

  return `
    <div class="lookup-item">
      <div class="lookup-item-header">
        <span class="lookup-code">${escapeHtml(o.code)}</span>
        <span class="badge ${o.statusBadge}">${statusText(o)}</span>
      </div>
      <div class="lookup-item-body">
        <p><strong>${t("order_rc_customer", "Khách hàng")}:</strong> ${escapeHtml(o.name)}</p>
        <p><strong>${t("order_rc_service", "Hình thức")}:</strong> ${serviceText(o)}</p>
        ${o.serviceDetails().map(([label, value]) => `<p><strong>${label}:</strong> ${escapeHtml(value)}</p>`).join("")}
        ${o.isTableOnly ? "" : `<p><strong>${t("order_rc_items", "Món đã gọi")}:</strong> ${items}</p>`}
        <p><strong>${t("order_rc_created", "Đặt lúc")}:</strong> ${formatDateTime(o.createdAt)}</p>
        ${o.isTableOnly ? "" : `
        <p><strong>${t("order_rc_amount", "Tổng tiền")}:</strong> <strong class="text-amber">${formatMoney(o.total)}</strong></p>
        <p><strong>${t("order_rc_payment", "Thanh toán")}:</strong> <span class="badge ${o.paymentBadge}">${paymentText(o)}</span></p>`}
        ${o.holdsStock ? `
        <div class="door-host-notice-card" style="margin: 14px 0; text-align: left;">
          <div class="notice-icon">🛡️</div>
          <div class="notice-content">
            <div class="notice-title">QUY ĐỊNH CHECK-IN TẠI CỬA (DOOR HOST)</div>
            <p class="notice-text">Quý khách vui lòng mang theo <strong>CCCD hoặc mở ứng dụng VNeID chính chủ</strong> để đối chiếu độ tuổi trước khi nhận bàn. Mọi trường hợp dưới 18 tuổi hoặc thông tin sai lệch sẽ bị từ chối phục vụ.</p>
          </div>
        </div>` : ""}
        <div class="lookup-actions mt-3">
          ${showQrBtn ? `
            <button type="button" class="btn btn-primary btn-sm btn-vqr-pay" id="lookup-qr-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              <span>${t("order_lookup_qr", "Mở Mã VietQR Chuyển Khoản")} (${formatMoney(o.total)})</span>
            </button>` : ""}
          ${cancelHtml}
        </div>
      </div>
    </div>`;
}

/** Khách tự huỷ đơn / đặt bàn ngay trong kết quả tra cứu */
async function handleCustomerCancel(button) {
  const order = lastLookedUpOrder;
  const what = order.serviceType === "booking" ? "đặt bàn" : "đơn";
  const ok = await confirmDialog(
    `Huỷ ${what} ${order.code}? ${order.isTableOnly ? "" : "Các món đã gọi sẽ được huỷ theo. "}Thao tác này không thể hoàn tác.`,
    { title: `Xác nhận huỷ ${what}`, okText: `Huỷ ${what}` },
  );
  if (!ok) return;

  const restoreButton = setButtonLoading(button, "Đang huỷ...");
  try {
    const updated = await cancelByCustomer(order.code, lastLookupPhone);
    lastLookedUpOrder = updated;
    lookupResultsEl.innerHTML = lookupResultHtml(updated);
    toast(`Đã huỷ ${what} ${order.code}. Hẹn gặp lại quý khách!`, "success");
  } catch (err) {
    restoreButton();
    toast(err.message, "error");
  }
}

if (lookupResultsEl) {
  lookupResultsEl.addEventListener("click", (e) => {
    const qrBtn = e.target.closest("#lookup-qr-btn");
    if (qrBtn && lastLookedUpOrder) {
      // Báo xong thì vẽ lại kết quả tra cứu để khách thấy "Chờ xác nhận CK"
      openCustomerPayment(lastLookedUpOrder, (updated) => {
        lastLookedUpOrder = updated;
        lookupResultsEl.innerHTML = lookupResultHtml(updated);
      });
    }

    const cancelBtn = e.target.closest("#lookup-cancel-btn");
    if (cancelBtn && lastLookedUpOrder) handleCustomerCancel(cancelBtn);
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
      lastLookupPhone = data.phone;
      lookupResultsEl.innerHTML = order ? lookupResultHtml(order) : `
        <div class="lookup-empty">
          <p>${fmt(t("order_lookup_notfound", "Không tìm thấy đơn nào khớp với mã <strong>{code}</strong> và số điện thoại đã nhập. Vui lòng kiểm tra lại cả hai thông tin."), { code: escapeHtml(data.code) })}</p>
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

// Dòng gợi ý dưới ô "Thời gian đến" lấy từ venue.js (không viết cứng giờ mở cửa trong HTML)
function renderHoursHint() {
  document.getElementById("booking-hours-hint").textContent =
  fmt(t("order_hours_hint", "Giờ mở cửa {hours}. Đặt trước tối thiểu {lead} phút, tối đa {days} ngày."), {
    hours: openingHoursText(getCurrentLang()), lead: BOOKING_RULES.minLeadMinutes, days: BOOKING_RULES.maxDaysAhead,
  });
}
renderHoursHint();
formEl.elements.birthDate.max = toLocalDatetimeValue(new Date()).slice(0, 10); // ngày sinh không ở tương lai

updateConditionalFields();
checkUrlParams();

// Tự động điền thông tin và huy hiệu khách hàng nếu đã đăng nhập
function fillCustomerInfo() {
  const customer = getCurrentCustomer();
  let banner = document.getElementById("customer-order-banner");
  if (!customer) {
    if (banner) banner.remove();
    return;
  }

  if (formEl) {
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "customer-order-banner";
      banner.className = "customer-order-banner mb-3";
      formEl.prepend(banner);
    }
    banner.innerHTML = `
      <div style="background: rgba(212, 175, 55, 0.08); border: 1px solid rgba(212, 175, 55, 0.35); border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
        <div style="font-size: 0.82rem; color: var(--gold-light); line-height: 1.4;">
          ✨ Chào mừng quý khách <strong>${escapeHtml(customer.name)}</strong> (${escapeHtml(customer.tier || "Thành viên Thân thiết")})! Thông tin đặt bàn đã được điền tự động.
        </div>
        <span style="font-size: 0.74rem; background: var(--gold-primary); color: #0b0907; padding: 3px 8px; border-radius: 999px; font-weight: 700; white-space: nowrap;">
          ${customer.points || 0} điểm thưởng
        </span>
      </div>`;

    if (formEl.elements.name && !formEl.elements.name.value) {
      formEl.elements.name.value = customer.name;
    }
    if (formEl.elements.phone && !formEl.elements.phone.value) {
      formEl.elements.phone.value = customer.phone;
    }
    if (formEl.elements.email && !formEl.elements.email.value && customer.email) {
      formEl.elements.email.value = customer.email;
    }
    if (formEl.elements.birthDate && !formEl.elements.birthDate.value && customer.birthDate) {
      formEl.elements.birthDate.value = customer.birthDate; // thành viên đã khai lúc đăng ký -> khỏi nhập lại
    }
  }
}

fillCustomerInfo();

window.addEventListener("customer-auth-change", () => {
  fillCustomerInfo();
  if (!getCurrentCustomer()) promo.points = 0; // đăng xuất thì bỏ điểm đang định dùng
  refreshPricing();
});

// Đổi VI/EN: chữ tĩnh trong HTML do applyI18n() lo; phần do JS vẽ thì vẽ lại ở đây
window.addEventListener("languagechange", () => {
  renderHoursHint();
  renderCart();
  updateCapacityHint();
  if (lastLookedUpOrder && !lookupResultsEl.hidden) lookupResultsEl.innerHTML = lookupResultHtml(lastLookedUpOrder);
});
cartListEl.innerHTML = loadingHtml("Đang kiểm tra danh sách món đã chọn...");
syncAndRenderCart();
checkAndRenderUnpaidOrderBanner();

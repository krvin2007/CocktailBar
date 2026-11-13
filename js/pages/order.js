import { api } from "../modules/api.js";
/* =========================================================
   ORDER.JS - Trang giỏ hàng + đặt bàn/đặt món + tra cứu đơn
   - Giỏ hàng: đọc/ghi localStorage (thao tác tức thì).
   - Đặt hàng, tra cứu: gọi API json-server bằng async/await.
   ========================================================= */

import "../modules/navbar.js";
import { refreshCartBadge } from "../modules/navbar.js";
import {
  getCart, updateCartQty, removeFromCart, createOrder, clearCart,
  syncCartWithCatalog, findOrderByCodeAndPhone, reportTransferSent,
  getRemainingSeats, cancelByCustomer, getAllOrders, getOccupiedTableSet,
} from "../modules/ordersService.js";
import { availableQty } from "../modules/drinksService.js";
import { formatMoney, formatDateTime, escapeHtml, debounce } from "../modules/utils.js";
import { validateForm, clearFormErrors, setFieldError } from "../modules/validation.js";
import { toast, confirmDialog, setButtonLoading, loadingHtml, errorHtml } from "../modules/ui.js";
import { ICONS } from "../modules/icons.js";
import { allocateOrderTotal, openVietQRPaymentModal } from "../modules/vietqrService.js";
import {
  isWithinOpeningHours, openingHoursText, BOOKING_RULES,
  BAR_RULES, BAR_SEATING_ZONES, ALL_BAR_TABLES, calcPrepayAmount, calcRemainingAmount,
} from "../modules/venue.js";
import { getCurrentLang, t } from "../modules/i18n.js";
import { getCurrentCustomer, syncCustomerSession } from "../modules/customerAuth.js";
import { canCustomer, syncRolePermissions } from "../modules/auth.js";
import { resolvePricing, POINT_REDEEM_VND, MIN_POINT_REDEEM } from "../modules/promotions.js";
import { getItem, setItem, removeItem } from "../modules/storage.js";
import { sendOrderConfirmationEmail, describeMailDelivery, openCinemaTicketModal } from "../modules/emailService.js";

const APPLIED_VOUCHER_KEY = "applied_voucher";

const cartListEl = document.getElementById("cart-list");
const sumCountEl = document.getElementById("sum-count");
const sumTotalEl = document.getElementById("sum-total");
const sumFinalEl = document.getElementById("sum-final");
const sumPrepayEl = document.getElementById("sum-prepay");
const sumRemainingEl = document.getElementById("sum-remaining");
const slipPayBtn = document.getElementById("slip-pay-btn");
const slipPayVal = document.getElementById("slip-pay-val");
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
const bookingDatePicker = document.getElementById("booking-date-picker");
const bookingTimePicker = document.getElementById("booking-time-picker");
const guestCountInput = formEl.elements.guestCount;
const capacityHint = document.getElementById("capacity-hint");
const tableNumberInput = document.getElementById("table-number-input") || formEl.elements.tableNumber;
const seatingMapZonesEl = document.getElementById("seating-map-zones");
const seatingCapacityHint = document.getElementById("seating-capacity-hint");
const seatingAvailabilityEl = document.getElementById("seating-availability");
const sumBookingRowEl = document.getElementById("sum-booking-row");
const sumBookingEl = document.getElementById("sum-booking");
const sumSeatRowEl = document.getElementById("sum-seat-row");
const sumSeatEl = document.getElementById("sum-seat");
const ageCheckbox = document.getElementById("age-confirm");

const MINUTE = 60 * 1000;
const isBooking = () => formEl.elements.serviceType.value === "booking";

/** fmt("Còn {left} chỗ", { left: 5 }) -> "Còn 5 chỗ" - chèn số liệu vào câu đã dịch */
const fmt = (text, vars) => text.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");

/** Nhãn trạng thái / hình thức / thanh toán của đơn theo ngôn ngữ đang chọn */
const statusText = (o) => t(`order_status_${o.status}`, o.statusLabel);
const serviceText = (o) => t(`order_service_${o.serviceType.replace("-", "_")}`, o.serviceLabel);
const paymentText = (o) => t(`order_payment_${o.paymentStatus}`, o.paymentLabel);

/** Tồn kho mới nhất của từng món (id -> stock), cập nhật mỗi lần đối chiếu với API */
let stockById = new Map();
let currentUnpaidOrders = [];
let currentUnpaidOrder = null;

/** Tập hợp các key món bị bỏ tích chọn (mặc định tất cả món đều checked) */
const uncheckedItemKeys = new Set();

/**
 * Lấy danh sách kết hợp gồm cả món của các đơn trước chưa thanh toán
 * và các món mới được chọn thêm vào giỏ hàng.
 */
function getCombinedItems() {
  const list = [];

  // 1. Món từ TẤT CẢ các đơn cũ chưa thanh toán của khách
  const unpaidList = currentUnpaidOrders.length > 0 ? currentUnpaidOrders : (currentUnpaidOrder ? [currentUnpaidOrder] : []);
  unpaidList.forEach((order) => {
    if (!Array.isArray(order.items)) return;
    const allocated = allocateOrderTotal(order.items, order.total); // tổng các món = đúng tổng đơn

    order.items.forEach((it, idx) => {
      const key = `unpaid_${order.id}_${it.drinkId || it.id || idx}`;
      const qty = Number(it.qty) || 1;
      const basePrice = Number(it.price) || 0;
      const finalPrice = allocated[idx];
      const isChecked = !uncheckedItemKeys.has(key);

      list.push({
        key,
        drinkId: it.drinkId || it.id || `unpaid_drink_${idx}`,
        name: it.name || "Cocktail",
        qty,
        price: basePrice,
        finalPrice,
        image: it.image || "",
        isUnpaid: true,
        orderCode: order.code,
        orderId: order.id,
        sourceTag: `Đơn cũ ${order.code}`,
        checked: isChecked,
      });
    });
  });

  // 2. Món mới trong giỏ hàng
  const cart = getCart();
  cart.forEach((it) => {
    const key = `cart_${it.drinkId}`;
    const qty = Number(it.qty) || 1;
    const price = Number(it.price) || 0;
    const isChecked = !uncheckedItemKeys.has(key);

    list.push({
      key,
      drinkId: it.drinkId,
      name: it.name,
      qty,
      price,
      finalPrice: price * qty,
      image: it.image || "",
      isUnpaid: false,
      sourceTag: "Món mới chọn",
      checked: isChecked,
    });
  });

  return list;
}

/**
 * Tính toán tổng số ly, tạm tính và thành tiền của tất cả các món đang được tích chọn
 */
function getActiveCheckoutSummary() {
  const allItems = getCombinedItems();
  const checked = allItems.filter((it) => it.checked);
  const count = checked.reduce((sum, it) => sum + (Number(it.qty) || 1), 0);
  const subtotal = checked.reduce((sum, it) => sum + ((Number(it.price) || 0) * (Number(it.qty) || 1)), 0);
  // Món mới trong giỏ: ưu đãi (hạng / mã / điểm) chỉ tính trên các món này. Đơn cũ chưa trả đã được chốt giá khi đặt
  // nên giữ nguyên tổng của đơn, KHÔNG giảm giá lần nữa.
  const cartSubtotal = checked.filter((it) => !it.isUnpaid).reduce((sum, it) => sum + ((Number(it.price) || 0) * (Number(it.qty) || 1)), 0);
  const unpaidTotal = checked.filter((it) => it.isUnpaid).reduce((sum, it) => sum + it.finalPrice, 0);
  const cartPayable = pricing && pricing.subtotal === cartSubtotal ? pricing.total : cartSubtotal;
  const total = unpaidTotal + cartPayable;
  const prepayAmount = calcPrepayAmount(total);
  const remainingAmount = calcRemainingAmount(total);
  return { allItems, checked, count, subtotal, cartSubtotal, unpaidTotal, total, prepayAmount, remainingAmount };
}

function renderSlipTotals(count, total) {
  const prepayAmount = calcPrepayAmount(total);
  const remainingAmount = calcRemainingAmount(total);
  if (sumFinalEl) sumFinalEl.textContent = formatMoney(total);
  if (sumPrepayEl) sumPrepayEl.textContent = formatMoney(prepayAmount);
  if (sumRemainingEl) sumRemainingEl.textContent = formatMoney(remainingAmount);
  if (slipPayBtn) {
    if (count > 0 && prepayAmount > 0) {
      slipPayBtn.style.display = "flex";
      if (slipPayVal) slipPayVal.textContent = formatMoney(prepayAmount);
    } else {
      slipPayBtn.style.display = "none";
    }
  }
}

/**
 * Cập nhật trạng thái và nhãn nút bấm xác nhận/thanh toán
 */
/**
 * Quyền "Đặt bàn & gọi món online" bị tắt thì chặn tạo ĐƠN MỚI, nhưng vẫn cho thanh toán đơn cũ đang chờ
 * (khách đã gọi món trước đó, không nên bị kẹt không trả được tiền).
 */
function newOrderBlocked() {
  if (canCustomer("self:order")) return false;
  const { checked } = getActiveCheckoutSummary();
  const onlyPayingOldOrder = checked.some((i) => i.isUnpaid) && !checked.some((i) => !i.isUnpaid);
  return !onlyPayingOldOrder;
}

function updateSubmitState() {
  const { checked, count, prepayAmount } = getActiveCheckoutSummary();
  const hasItems = count > 0;
  submitBtn.disabled = (!hasItems && !isBooking()) || newOrderBlocked();

  const submitLabel = document.getElementById("submit-order-label");
  if (!submitLabel) return;

  const hasUnpaid = checked.some((i) => i.isUnpaid);
  const hasCart = checked.some((i) => !i.isUnpaid);

  if (hasUnpaid && hasCart) {
    submitLabel.textContent = `Xác Nhận & Trả Trước 70% (${formatMoney(prepayAmount)})`;
  } else if (hasUnpaid) {
    const codes = [...new Set(checked.filter((i) => i.isUnpaid).map((i) => i.orderCode))].join(", ");
    submitLabel.textContent = `Trả Trước 70% Đơn Chờ ${codes} (${formatMoney(prepayAmount)})`;
  } else if (hasCart) {
    submitLabel.textContent = isBooking()
      ? `${t("order_btn_book_order", "Xác Nhận Đặt Bàn & Gọi Món")} (Trả trước 70%: ${formatMoney(prepayAmount)})`
      : `Xác Nhận Gọi Món (Trả trước 70%: ${formatMoney(prepayAmount)})`;
  } else {
    submitLabel.textContent = isBooking()
      ? t("order_btn_book", "Xác Nhận Giữ Bàn")
      : t("order_btn_order", "Xác Nhận Gọi Món");
  }
}

/**
 * Mở mã QR cho khách thanh toán MBBank. Hỗ trợ hiển thị toàn bộ món
 * (bao gồm món từ các đơn trước chưa thanh toán và món mới trong giỏ)
 * kèm ô tích chọn (checkbox) để khách chọn món thanh toán tùy ý.
 */
function openCustomerPayment(order, afterReport, allItems = null) {
  const targetOrder = order || currentUnpaidOrder || currentUnpaidOrders[0] || null;
  // Mã QR chỉ thanh toán các ĐƠN ĐÃ LƯU (số tiền = tổng tiền thật của đơn). Món còn trong giỏ chưa là đơn nên không
  // đưa vào đây - phải gửi form (kiểm tra tuổi, áp ưu đãi) để thành đơn rồi mới có QR đúng số tiền.
  const itemsToPass = allItems || getCombinedItems().filter((i) => i.isUnpaid);

  openVietQRPaymentModal(targetOrder, {
    confirmLabel: "Tôi Đã Chuyển Khoản Xong",
    allItems: itemsToPass,
    onConfirm: async (payload) => {
      const selectedItems = payload?.selectedItems || itemsToPass.filter((i) => i.checked);
      const customer = getCurrentCustomer();
      let confirmedOrderForTicket = null;
      let lastMail = null;

      // Báo "đã chuyển khoản" cho từng đơn được tích chọn (cả đơn, không trả một phần đơn)
      const orderIds = [...new Set(selectedItems.map((i) => i.orderId).filter(Boolean))];
      if (orderIds.length === 0 && targetOrder?.id) orderIds.push(targetOrder.id);
      for (const oId of orderIds) {
        try {
          await reportTransferSent(oId);
          const freshOrder = await api.get(`/orders/${encodeURIComponent(oId)}`).catch(() => null);
          const orderToEmail = freshOrder || (targetOrder?.id === oId ? targetOrder : null);
          if (orderToEmail) {
            const updatedStatusOrder = { ...orderToEmail, paymentStatus: "awaiting" };
            lastMail = await sendOrderConfirmationEmail(updatedStatusOrder, customer);
            if (!confirmedOrderForTicket) confirmedOrderForTicket = updatedStatusOrder;
          }
        } catch (err) {
          console.warn("Không thể cập nhật báo chuyển khoản cho đơn:", err);
        }
      }

      const finalOrder = confirmedOrderForTicket || targetOrder || currentUnpaidOrder;
      const targetEmail = finalOrder?.email || customer?.email || "";
      toast("Đã ghi nhận bạn chuyển khoản - quán sẽ đối chiếu và xác nhận sớm.", "success");
      if (lastMail) { const note = describeMailDelivery(lastMail, finalOrder); toast(note.message, note.type); }
      
      if (finalOrder) {
        openCinemaTicketModal(finalOrder, { toEmail: targetEmail });
      }

      await checkAndRenderUnpaidOrderBanner();
      renderCart();
      if (afterReport) afterReport(targetOrder);
    },
  });
}

const unpaidBannerWrap = document.getElementById("active-unpaid-banner-wrap");
const LATEST_ORDER_KEY = "quanbar_latest_order";

async function checkAndRenderUnpaidOrderBanner() {
  if (!unpaidBannerWrap) return;
  const customer = getCurrentCustomer();
  // Nếu chưa đăng nhập tài khoản: KHÔNG bao giờ hiển thị đơn hàng
  if (!customer) {
    currentUnpaidOrders = [];
    currentUnpaidOrder = null;
    unpaidBannerWrap.innerHTML = "";
    unpaidBannerWrap.hidden = true;
    return;
  }

  try {
    const all = await getAllOrders();
    // Chỉ tìm đơn của CHÍNH tài khoản đang đăng nhập
    const unpaidOrders = all.filter((o) => (o.customerId === customer.id || o.phone === customer.phone) && o.status !== "cancelled" && o.paymentStatus === "unpaid" && o.total > 0);

    currentUnpaidOrders = unpaidOrders;
    currentUnpaidOrder = unpaidOrders[0] || null;

    if (unpaidOrders.length === 0) {
      unpaidBannerWrap.innerHTML = "";
      unpaidBannerWrap.hidden = true;
      return;
    }

    const allUnpaidItems = unpaidOrders.flatMap((o) => Array.isArray(o.items) ? o.items.map((it) => ({ ...it, orderCode: o.code })) : []);
    const totalAmount = unpaidOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const totalDiscounts = unpaidOrders.reduce((sum, o) => {
      const dSum = Array.isArray(o.discounts) ? o.discounts.reduce((s, d) => s + (Number(d.amount) || 0), 0) : 0;
      return sum + dSum;
    }, 0);
    const codesText = unpaidOrders.map((o) => o.code).join(", ");

    const cart = getCart();
    const hasCartItems = cart.length > 0;

    const itemsHtml = allUnpaidItems.length > 0
      ? allUnpaidItems.map((it) => {
        const itemTotal = (Number(it.price) || 0) * (Number(it.qty) || 1);
        const hasImg = it.image && (it.image.includes("/") || it.image.startsWith("http"));
        return `
          <div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: var(--radius-sm);">
            ${hasImg ? `<img src="${escapeHtml(it.image)}" alt="${escapeHtml(it.name)}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(197, 152, 67, 0.35); flex-shrink: 0;" onerror="this.onerror=null;this.replaceWith(document.createElement('div'))">` : `<div style="width: 44px; height: 44px; border-radius: 6px; background: rgba(197, 152, 67, 0.15); display: flex; align-items: center; justify-content: center; color: var(--amber-soft); flex-shrink: 0;">${ICONS.cocktail(20)}</div>`}
            <div style="min-width: 0; flex: 1;">
              <div style="font-size: 0.88rem; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(it.name)}">
                ${escapeHtml(it.name)}
              </div>
              <div style="font-size: 0.76rem; color: var(--muted); margin-top: 2px; display: flex; align-items: center; justify-content: space-between;">
                <span>Số lượng: <strong style="color: var(--amber-soft); font-weight: 600;">x${it.qty || 1}</strong> <span style="font-size: 0.68rem; opacity: 0.7;">(${escapeHtml(it.orderCode)})</span></span>
                <strong style="color: var(--cream); font-weight: 600;">${formatMoney(itemTotal)}</strong>
              </div>
            </div>
          </div>
        `;
      }).join("")
      : `<div style="font-size: 0.82rem; color: var(--muted); font-style: italic;">Đơn giữ chỗ đặt bàn trước (không gọi trước món).</div>`;

    unpaidBannerWrap.hidden = false;
    unpaidBannerWrap.innerHTML = `
      <div class="active-unpaid-order-banner" style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: var(--radius-sm); padding: 16px 18px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
          <div style="display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 260px;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: rgba(239, 68, 68, 0.18); display: flex; align-items: center; justify-content: center; color: #ef4444; flex-shrink: 0; margin-top: 2px;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-size: 0.92rem; color: var(--cream); font-weight: 600;">Bạn có ${unpaidOrders.length > 1 ? `${unpaidOrders.length} đơn hàng` : "đơn hàng"} đang chờ thanh toán:</span>
                <strong class="text-amber font-mono" style="font-size: 1.05rem; letter-spacing: 0.5px;">${escapeHtml(codesText)}</strong>
                <span class="badge badge-danger" style="font-size: 0.72rem; padding: 2px 8px; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4);">Chưa thanh toán</span>
              </div>
              <p class="text-xs text-muted" style="margin: 4px 0 0 0;">
                Tổng đơn: <strong>${formatMoney(totalAmount)}</strong> · Cần trả trước 70%: <strong class="text-amber" style="font-size: 0.95rem;">${formatMoney(calcPrepayAmount(totalAmount))}</strong> <span style="opacity: 0.85;">(còn lại 30%: ${formatMoney(calcRemainingAmount(totalAmount))} tại quán)</span>
                ${totalDiscounts > 0 ? `<span style="color: var(--amber-soft); margin-left: 6px;">(Đã giảm ${formatMoney(totalDiscounts)})</span>` : ""}
                · Vui lòng cọc 70% để Bartender bắt đầu pha chế món cho quý khách.
              </p>
              ${hasCartItems ? `
              <div style="margin-top: 6px; padding: 5px 10px; background: rgba(197, 152, 67, 0.15); border-radius: 6px; border: 1px solid rgba(197, 152, 67, 0.3); font-size: 0.78rem; color: var(--amber-soft);">
                ⭐ Bạn đang chọn thêm <strong>${cart.length} món mới</strong> trong giỏ hàng. Khi thanh toán sẽ hiện đầy đủ cả món cũ và món mới kèm mục tích chọn món!
              </div>` : ""}
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-left: auto;">
            <button type="button" class="btn btn-primary btn-sm btn-vqr-pay" id="banner-pay-btn" style="white-space: nowrap; font-size: 0.82rem; font-weight: 600; padding: 7px 14px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              <span>Quét mã QR MBBank trả trước 70% (${formatMoney(calcPrepayAmount(totalAmount))})</span>
            </button>
            <button type="button" class="btn btn-outline btn-sm" id="banner-cancel-btn" style="font-size: 0.78rem; padding: 6px 10px; color: #f87171; border-color: rgba(239,68,68,0.4);" title="Huỷ đơn hàng này">
              Huỷ đơn
            </button>
            <button type="button" class="btn btn-ghost btn-sm" id="banner-dismiss-btn" title="Đóng thông báo" style="padding: 4px 8px; color: var(--muted);">✕</button>
          </div>
        </div>

        <!-- DANH SÁCH MÓN CHƯA THANH TOÁN (HIỂN THỊ RÕ RÀNG CHI TIẾT MÓN CHO KHÁCH BIẾT) -->
        <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed rgba(239, 68, 68, 0.28);">
          <div style="font-size: 0.78rem; color: #fca5a5; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
            <span>Danh sách món chưa thanh toán (${allUnpaidItems.length} món):</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 8px;">
            ${itemsHtml}
          </div>
        </div>
      </div>`;

    document.getElementById("banner-pay-btn")?.addEventListener("click", () => {
      openCustomerPayment(unpaidOrders[0], () => {
        checkAndRenderUnpaidOrderBanner();
      });
    });

    document.getElementById("banner-cancel-btn")?.addEventListener("click", async () => {
      const msg = unpaidOrders.length > 1
        ? `Quý khách có chắc chắn muốn huỷ ${unpaidOrders.length} đơn hàng chưa thanh toán (${codesText})?`
        : `Quý khách có chắc chắn muốn huỷ đơn hàng ${unpaidOrders[0].code}?`;
      const ok = await confirmDialog(msg);
      if (!ok) return;
      try {
        for (const o of unpaidOrders) {
          await cancelByCustomer(o.code, o.phone);
        }
        toast(`Đã huỷ đơn hàng chưa thanh toán.`, "info");
        await checkAndRenderUnpaidOrderBanner();
        renderCart();
      } catch (err) {
        toast(err.message, "error");
      }
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

function unpaidCartItemHtml(it, idx, order, isChecked = true) {
  const o = order || currentUnpaidOrder || {};
  const itemKey = `unpaid_${o.id || "0"}_${it.drinkId || it.id || idx}`;
  const qty = Number(it.qty) || 1;
  const basePrice = Number(it.price) || 0;
  const itemSubtotal = basePrice * qty;

  const unpaidSub = Number(o.subtotal) || Number(o.total) || 1;
  const unpaidTot = Number(o.total) || unpaidSub;
  const ratio = unpaidTot / unpaidSub;
  const finalPrice = Math.round(itemSubtotal * ratio);

  const hasImg = it.image && (it.image.includes("/") || it.image.startsWith("http"));
  const imageHtml = hasImg
    ? `<img src="${escapeHtml(it.image)}" alt="${escapeHtml(it.name)}" class="cart-item-img">`
    : `<div class="cart-fallback-icon">${ICONS.cocktail(20)}</div>`;

  return `
    <div class="cart-item cart-item-unpaid" data-key="${itemKey}" style="display: flex; align-items: center; gap: 10px; background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.28); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px;">
      <label style="display: flex; align-items: center; margin: 0; cursor: pointer;" title="Tích chọn để thanh toán món này">
        <input type="checkbox" class="item-select-checkbox" data-key="${itemKey}" ${isChecked ? "checked" : ""} style="accent-color: var(--amber); width: 18px; height: 18px; cursor: pointer; flex-shrink: 0;">
      </label>
      <div class="cart-item-thumb">${imageHtml}</div>
      <div class="cart-item-info" style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <p class="cart-item-name" style="margin: 0; font-weight: 700; color: #fff;">${escapeHtml(it.name)}</p>
          <span class="badge badge-danger" style="font-size: 0.65rem; padding: 1px 6px;">Đơn trước ${escapeHtml(o.code || "")}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 3px;">
          <span class="text-amber font-bold" style="font-size: 0.95rem;">${formatMoney(finalPrice)}</span>
          ${finalPrice < itemSubtotal ? `<span style="font-size: 0.75rem; text-decoration: line-through; opacity: 0.5;">${formatMoney(itemSubtotal)}</span>` : ""}
          <span class="text-xs text-muted">(Đang chờ thanh toán)</span>
        </div>
      </div>
      <div class="cart-item-qty" style="padding: 4px 10px; font-weight: 700; color: var(--amber-soft); background: rgba(0, 0, 0, 0.3); border-radius: 6px;">
        x${qty}
      </div>
    </div>`;
}

function cartItemHtml(item, currentPricing = pricing, isChecked = true) {
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

  const itemKey = `cart_${item.drinkId}`;

  return `
    <div class="cart-item" data-id="${item.drinkId}" data-key="${itemKey}" data-max="${maxQty}" style="display: flex; align-items: center; gap: 10px;">
      <label style="display: flex; align-items: center; margin: 0; cursor: pointer;" title="Tích chọn để thanh toán món này">
        <input type="checkbox" class="item-select-checkbox" data-key="${itemKey}" ${isChecked ? "checked" : ""} style="accent-color: var(--amber); width: 18px; height: 18px; cursor: pointer; flex-shrink: 0;">
      </label>
      <div class="cart-item-thumb">${imageHtml}</div>
      <div class="cart-item-info" style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <p class="cart-item-name" style="margin: 0;">${escapeHtml(item.name)}</p>
          <span class="badge badge-info" style="font-size: 0.62rem; padding: 1px 5px; width: fit-content;">Món mới</span>
        </div>
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

/** Vẽ giỏ hàng kết hợp cả món đơn trước chưa thanh toán và món mới trong giỏ */
function renderCart() {
  const combined = getCombinedItems();
  const unpaidItems = combined.filter((i) => i.isUnpaid);
  const cartItems = combined.filter((i) => !i.isUnpaid);
  const checkedItems = combined.filter((i) => i.checked);

  if (combined.length === 0) {
    const emptyText = isBooking()
      ? t("order_empty_booking", "Chưa chọn món nào - không sao, quý khách vẫn có thể chỉ giữ bàn. Muốn quầy bar chuẩn bị sẵn khi đến? Hãy chọn món từ thực đơn.")
      : t("order_empty_dinein", "Hãy chọn ly cocktail yêu thích từ thực đơn để gọi món tại bàn.");

    cartListEl.innerHTML = `
      <div class="empty-state cart-empty">
        <div class="empty-icon">${ICONS.shoppingBag(36)}</div>
        <h4>${t("order_empty_title", "Danh sách thức uống đang trống")}</h4>
        <p class="text-muted">${emptyText}</p>
        <a href="menu.html" class="btn btn-primary mt-2">
          ${ICONS.arrowRight(14)} <span>${t("order_empty_btn", "Khám phá thực đơn")}</span>
        </a>
      </div>`;

    if (sumCountEl) sumCountEl.textContent = "0 ly";
    if (sumTotalEl) sumTotalEl.textContent = "0₫";
    renderSlipTotals(0, 0);
    updateSubmitState();
    return;
  }

  // Thanh checklist trên đầu
  const allChecked = checkedItems.length === combined.length && combined.length > 0;
  const checklistHeaderHtml = `
    <div class="cart-checklist-header" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(212, 175, 55, 0.08); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 8px; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
      <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--amber-soft); font-weight: 700; font-size: 0.82rem; text-transform: uppercase; margin: 0;">
        <input type="checkbox" id="cart-toggle-all" ${allChecked ? "checked" : ""} style="accent-color: var(--amber); width: 17px; height: 17px; cursor: pointer;">
        <span>Tích chọn món để thanh toán (<span id="cart-checked-count">${checkedItems.length}</span>/${combined.length})</span>
      </label>
      <span class="text-xs text-muted">Bỏ tích món chưa muốn trả đợt này</span>
    </div>`;

  let unpaidSectionHtml = "";
  if (unpaidItems.length > 0) {
    const unpaidList = currentUnpaidOrders.length > 0 ? currentUnpaidOrders : (currentUnpaidOrder ? [currentUnpaidOrder] : []);
    const unpaidCodes = unpaidList.map((o) => o.code).join(", ");
    unpaidSectionHtml = `
      <div class="unpaid-cart-group" style="margin-bottom: 16px;">
        <div style="font-size: 0.8rem; font-weight: 700; color: #fca5a5; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
          <span>MÓN TỪ ĐƠN CHƯA THANH TOÁN (${escapeHtml(unpaidCodes)}):</span>
          <span style="font-size: 0.75rem; color: var(--muted); font-weight: normal;">${unpaidItems.length} món</span>
        </div>
        ${unpaidList.map((order) => {
          const items = Array.isArray(order.items) ? order.items : [];
          return items.map((it, idx) => unpaidCartItemHtml(it, idx, order, !uncheckedItemKeys.has(`unpaid_${order.id}_${it.drinkId || it.id || idx}`))).join("");
        }).join("")}
      </div>`;
  }

  let cartSectionHtml = "";
  if (cartItems.length > 0) {
    const cartHeader = unpaidItems.length > 0
      ? `<div style="font-size: 0.8rem; font-weight: 700; color: var(--amber-soft); margin-bottom: 8px; text-transform: uppercase;">Món mới chọn từ thực đơn:</div>`
      : "";
    const cart = getCart();
    cartSectionHtml = `
      <div class="new-cart-group">
        ${cartHeader}
        ${cart.map((it) => cartItemHtml(it, pricing, !uncheckedItemKeys.has(`cart_${it.drinkId}`))).join("")}
      </div>`;
  } else if (unpaidItems.length > 0) {
    cartSectionHtml = `
      <div style="padding: 12px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px; text-align: center; margin-top: 8px;">
        <span class="text-xs text-muted">Bạn có thể chọn thêm món mới từ thực đơn để thanh toán chung cùng đơn này!</span>
        <div style="margin-top: 6px;">
          <a href="menu.html" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 4px 10px;">+ Chọn thêm món mới</a>
        </div>
      </div>`;
  }

  cartListEl.innerHTML = checklistHeaderHtml + unpaidSectionHtml + cartSectionHtml;

  // Cập nhật số liệu trên Phiếu đặt chỗ (Reservation Slip)
  const { count, subtotal, total } = getActiveCheckoutSummary();
  if (sumCountEl) sumCountEl.textContent = `${count} ly`;
  if (sumTotalEl) sumTotalEl.textContent = formatMoney(subtotal);
  renderSlipTotals(count, total);

  // Tính lại giảm giá theo hạng/mã/điểm mỗi khi giỏ đổi (kể cả lần tải trang đầu) - trước đây chỉ tính khi
  // khách đổi mã/điểm hoặc bấm gửi đơn, nên khách đã đăng nhập không thấy ô "Dùng điểm" và giá giảm khi vào trang
  refreshPricing();
  updateSubmitState();
}

/* ---------------- Ưu đãi: giảm theo hạng, mã giảm giá, dùng điểm ---------------- */

const urlVoucher = new URLSearchParams(window.location.search).get("voucher");
const savedVoucher = urlVoucher || getItem(APPLIED_VOUCHER_KEY, "");
const promo = { voucher: savedVoucher || "", points: 0 }; // khách đang nhập gì (chưa chắc hợp lệ)
if (voucherInput && savedVoucher) {
  voucherInput.value = savedVoucher;
  if (urlVoucher) setItem(APPLIED_VOUCHER_KEY, urlVoucher);
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
  pricing = result;

  const { total, count } = getActiveCheckoutSummary(); // pricing vừa được gán = result -> total đã gồm ưu đãi của món mới
  promoLinesEl.innerHTML = result.discounts.map(discountLineHtml).join("");
  renderSlipTotals(count, total);

  const voucherAmount = result.discounts.find((d) => d.type === "voucher")?.amount || 0;
  if (result.voucherError) setPromoMessage(voucherMsgEl, result.voucherError, "error");
  else if (result.voucherCode) setPromoMessage(voucherMsgEl, fmt(t("order_voucher_ok", "Đã áp mã {code}: giảm {amount}."), { code: result.voucherCode, amount: formatMoney(voucherAmount) }), "ok");
  else setPromoMessage(voucherMsgEl, "");

  pointsBoxEl.hidden = !customer || !canCustomer("self:redeem");
  loginHintEl.hidden = Boolean(customer);
  if (!customer || !canCustomer("self:redeem")) return;

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
  const { cartSubtotal: subtotal } = getActiveCheckoutSummary(); // ưu đãi chỉ tính trên món MỚI trong giỏ
  const customer = getCurrentCustomer();
  // Quyền của khách (ma trận phân quyền): bị tắt thì bỏ mã / điểm đang nhập và ẩn ô tương ứng
  const voucherAllowed = canCustomer("self:voucher");
  const redeemAllowed = canCustomer("self:redeem");
  if (!voucherAllowed) promo.voucher = "";
  if (!redeemAllowed) promo.points = 0;
  // dùng style.display (không dùng thuộc tính hidden) vì .promo-row có display:flex đè lên [hidden]
  const voucherRow = voucherInput?.closest(".promo-row");
  if (voucherRow) voucherRow.style.display = voucherAllowed ? "" : "none";
  const voucherMsg = document.getElementById("voucher-msg");
  if (voucherMsg) voucherMsg.style.display = voucherAllowed ? "" : "none";
  try {
    const code = promo.voucher.trim();
    const orders = code ? await getAllOrders() : [];
    const result = await resolvePricing({
      subtotal,
      customerId: customer?.id || "",
      voucherCode: code,
      pointsToUse: promo.points,
      phone: formEl.elements.phone?.value || "",
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
    const fallback = getActiveCheckoutSummary();
    renderSlipTotals(fallback.count, fallback.total);
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

cartListEl.addEventListener("change", (e) => {
  if (e.target.matches("#cart-toggle-all")) {
    const isChecked = e.target.checked;
    const all = getCombinedItems();
    all.forEach((it) => {
      if (isChecked) uncheckedItemKeys.delete(it.key);
      else uncheckedItemKeys.add(it.key);
    });
    renderCart();
    return;
  }

  if (e.target.matches(".item-select-checkbox")) {
    const key = e.target.dataset.key;
    if (e.target.checked) uncheckedItemKeys.delete(key);
    else uncheckedItemKeys.add(key);
    renderCart();
  }
});

if (slipPayBtn) {
  slipPayBtn.addEventListener("click", () => {
    const { checked } = getActiveCheckoutSummary();
    if (checked.length === 0) {
      toast("Vui lòng tích chọn ít nhất 1 món để thanh toán.", "warning");
      return;
    }
    // Có món MỚI trong giỏ: phải qua form (kiểm tra tuổi 18+, áp ưu đãi) để thành đơn rồi mới có QR đúng số tiền
    if (checked.some((i) => !i.isUnpaid)) {
      formEl.requestSubmit();
      return;
    }
    openCustomerPayment(currentUnpaidOrder, () => {
      checkAndRenderUnpaidOrderBanner();
    });
  });
}

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
function syncBookingTime() {
  if (!bookingDatePicker || !bookingTimePicker || !bookingTimeInput) return;
  const dateVal = bookingDatePicker.value;
  const timeVal = bookingTimePicker.value;

  if (dateVal && timeVal) {
    bookingTimeInput.value = `${dateVal}T${timeVal}`;
  } else {
    bookingTimeInput.value = "";
  }

  // Cập nhật trạng thái active cho các nút chọn nhanh
  document.querySelectorAll(".btn-time-slot").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.time === timeVal);
  });
}

function setBookingTimeRange() {
  const minDate = new Date(Date.now() + BOOKING_RULES.minLeadMinutes * MINUTE);
  const maxDate = new Date(Date.now() + BOOKING_RULES.maxDaysAhead * 24 * 60 * MINUTE);

  const minDayStr = toLocalDatetimeValue(minDate).slice(0, 10);
  const maxDayStr = toLocalDatetimeValue(maxDate).slice(0, 10);

  if (bookingDatePicker) {
    bookingDatePicker.min = minDayStr;
    bookingDatePicker.max = maxDayStr;
    if (!bookingDatePicker.value) {
      bookingDatePicker.value = minDayStr;
    }
  }

  if (bookingTimePicker && !bookingTimePicker.value) {
    // Khung giờ gợi ý ban đầu
    const curHour = new Date().getHours();
    if (curHour >= 21) {
      bookingTimePicker.value = "22:00";
    } else if (curHour >= 18) {
      bookingTimePicker.value = "20:00";
    } else {
      bookingTimePicker.value = "19:00";
    }
  }

  if (bookingTimeInput) {
    bookingTimeInput.min = toLocalDatetimeValue(minDate);
    bookingTimeInput.max = toLocalDatetimeValue(maxDate);
  }

  syncBookingTime();
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
  renderSeatingMap();
  renderCart(); // chữ trong giỏ trống + nút gửi khác nhau giữa 2 hình thức
}

formEl.elements.serviceType.forEach((radio) => {
  radio.addEventListener("change", () => {
    clearFormErrors(formEl);
    updateConditionalFields();
    updateCapacityHint();
  });
});

let seatingRequestId = 0;

/** Phiếu Đặt Chỗ luôn hiện giờ hẹn + bàn đã chọn để khách thấy chỗ mình giữ mà không phải cuộn xuống sơ đồ */
function updateBookingSummary() {
  if (!sumBookingRowEl || !sumSeatRowEl) return;
  const booking = isBooking();
  const guests = Number(guestCountInput?.value) || 0;
  const when = booking && bookingTimeInput?.value ? new Date(bookingTimeInput.value) : null;
  const whenOk = when && !Number.isNaN(when.getTime());
  sumBookingRowEl.hidden = !booking;
  if (booking) sumBookingEl.textContent = whenOk ? `${formatDateTime(when)}${guests ? ` · ${guests} khách` : ""}` : "Chưa chọn ngày giờ";
  const chosen = String(tableNumberInput?.value || "").trim();
  sumSeatRowEl.hidden = !booking && !chosen;
  sumSeatEl.textContent = chosen || "Chưa chọn bàn (quán sẽ xếp chỗ)";
}

function updateSeatingHint() {
  updateBookingSummary();
  if (!seatingCapacityHint || !tableNumberInput) return;
  const chosen = tableNumberInput.value.trim();
  if (!chosen) {
    seatingCapacityHint.textContent = isBooking()
      ? "Bấm vào bàn còn trống trên sơ đồ để giữ đúng vị trí mong muốn (tuỳ chọn)."
      : "Bấm chọn bàn bạn đang ngồi hoặc khu vực mong muốn.";
    return;
  }
  const matched = ALL_BAR_TABLES.find((tb) => tb.label.toLowerCase() === chosen.toLowerCase());
  const guests = isBooking() ? Number(guestCountInput?.value) || 0 : 0;
  if (matched && guests > matched.seats) {
    seatingCapacityHint.textContent = `Đã chọn: ${matched.label} (${matched.seats} chỗ). Lưu ý: nhóm ${guests} khách lớn hơn sức chứa tiêu chuẩn — quán sẽ hỗ trợ ghép bàn hoặc bạn chọn Sofa VIP lớn hơn.`;
  } else if (matched) {
    seatingCapacityHint.textContent = `Đã chọn: ${matched.label} (${matched.zoneName} · tối đa ${matched.seats} chỗ).`;
  } else {
    seatingCapacityHint.textContent = `Vị trí đã chọn: ${chosen}.`;
  }
}

async function renderSeatingMap() {
  if (!seatingMapZonesEl) return;
  const requestId = ++seatingRequestId;
  const currentType = formEl.elements.serviceType.value;
  let bookingIso = "";
  if (currentType === "booking" && bookingTimeInput?.value) {
    const d = new Date(bookingTimeInput.value);
    if (!Number.isNaN(d.getTime())) bookingIso = d.toISOString();
  }

  let occupied = new Set();
  try {
    const ordersList = await getAllOrders();
    if (requestId !== seatingRequestId) return;
    occupied = getOccupiedTableSet(ordersList, { serviceType: currentType, bookingTime: bookingIso });
  } catch {
    if (requestId !== seatingRequestId) return;
  }

  if (seatingAvailabilityEl) {
    const total = ALL_BAR_TABLES.length;
    const free = ALL_BAR_TABLES.filter((tb) => !occupied.has(tb.label.toLowerCase()) && !occupied.has(tb.id.toLowerCase())).length;
    if (currentType === "booking" && !bookingIso) {
      seatingAvailabilityEl.textContent = "Chọn ngày và giờ nhận bàn để xem bàn nào còn trống vào lúc đó.";
    } else if (currentType === "booking") {
      seatingAvailabilityEl.textContent = `Lúc ${formatDateTime(bookingIso)}: còn ${free}/${total} bàn trống (bàn màu đỏ đã có khách giữ).`;
    } else {
      seatingAvailabilityEl.textContent = `Hiện còn ${free}/${total} bàn trống tại quán (bàn màu đỏ đang có khách).`;
    }
  }

  const selectedRaw = String(tableNumberInput?.value || "").trim().toLowerCase();
  if (selectedRaw && occupied.has(selectedRaw)) {
    tableNumberInput.value = "";
    toast("Vị trí bạn chọn trước đó đã có khách đặt trong khung giờ này. Vui lòng chọn bàn khác!", "warning");
  }

  const currentSelected = String(tableNumberInput?.value || "").trim().toLowerCase();
  seatingMapZonesEl.innerHTML = BAR_SEATING_ZONES.map((zone) => `
    <div class="seating-zone-block">
      <div class="seating-zone-header">
        <span class="seating-zone-name">${zone.icon} ${escapeHtml(zone.name)}</span>
        <span class="seating-zone-sub">${escapeHtml(zone.subtitle)}</span>
      </div>
      <div class="seating-table-grid">
        ${zone.tables.map((tb) => {
          const isBooked = occupied.has(tb.label.toLowerCase()) || occupied.has(tb.id.toLowerCase());
          const isSelected = !isBooked && currentSelected === tb.label.toLowerCase();
          return `
            <button type="button" class="seat-card${isSelected ? " is-selected" : ""}${isBooked ? " is-booked" : ""}" data-table-label="${escapeHtml(tb.label)}" ${isBooked ? "disabled title=\"Đã có khách đặt trong khung giờ này\"" : ""}>
              <span class="seat-card-title">${escapeHtml(tb.label)}</span>
              <span class="seat-card-meta">${tb.seats} chỗ · ${isBooked ? "Đã đặt" : isSelected ? "Đang chọn" : "Còn trống"}</span>
            </button>`;
        }).join("")}
      </div>
    </div>
  `).join("");

  updateSeatingHint();
}

if (seatingMapZonesEl) {
  seatingMapZonesEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".seat-card");
    if (!btn || btn.disabled) return;
    const label = btn.dataset.tableLabel || "";
    if (!tableNumberInput) return;
    const isSame = tableNumberInput.value.trim().toLowerCase() === label.toLowerCase();
    tableNumberInput.value = isSame ? "" : label;
    renderSeatingMap();
  });
}

if (tableNumberInput) {
  tableNumberInput.addEventListener("input", () => {
    const cur = tableNumberInput.value.trim().toLowerCase();
    seatingMapZonesEl?.querySelectorAll(".seat-card").forEach((btn) => {
      const label = String(btn.dataset.tableLabel || "").toLowerCase();
      btn.classList.toggle("is-selected", !btn.disabled && cur === label);
    });
    updateSeatingHint();
  });
}

/**
 * Luật nghiệp vụ của giờ đặt bàn (không khai báo được bằng data-rule),
 * tất cả lấy từ venue.js (cùng dữ liệu với mục "Địa điểm" trên trang chủ):
 * - cách hiện tại tối thiểu minLeadMinutes để quán kịp chuẩn bị bàn
 * - không xa quá maxDaysAhead ngày
 * - nằm trong giờ mở cửa OPENING_HOURS
 */
function validateBookingTime() {
  if (!isBooking()) return true;

  syncBookingTime();

  if (!bookingTimeInput.value) {
    setFieldError(bookingTimePicker || bookingTimeInput, t("order_err_time_required", "Vui lòng chọn ngày và giờ đến."));
    return false;
  }

  const chosen = new Date(bookingTimeInput.value).getTime();
  const earliest = Date.now() + BOOKING_RULES.minLeadMinutes * MINUTE;
  const latest = Date.now() + BOOKING_RULES.maxDaysAhead * 24 * 60 * MINUTE;

  let message = "";
  if (chosen < earliest) {
    message = fmt(t("order_err_lead", "Vui lòng đặt bàn trước tối thiểu {lead} phút."), { lead: BOOKING_RULES.minLeadMinutes });
  } else if (chosen > latest) {
    message = fmt(t("order_err_ahead", "Quán nhận đặt bàn trước tối đa {days} ngày."), { days: BOOKING_RULES.maxDaysAhead });
  } else if (!isWithinOpeningHours(new Date(chosen))) {
    message = fmt(t("order_err_hours", "Giờ mở cửa {hours}. Vui lòng chọn giờ trong khung này."), { hours: openingHoursText(getCurrentLang()) });
  }

  setFieldError(bookingTimePicker || bookingTimeInput, message);
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

if (bookingTimeInput) bookingTimeInput.addEventListener("change", () => {
  updateCapacityHint();
  renderSeatingMap();
});

if (bookingDatePicker) {
  bookingDatePicker.addEventListener("change", () => {
    syncBookingTime();
    validateBookingTime();
    updateCapacityHint();
    renderSeatingMap();
  });
}

if (bookingTimePicker) {
  bookingTimePicker.addEventListener("change", () => {
    syncBookingTime();
    validateBookingTime();
    updateCapacityHint();
    renderSeatingMap();
  });
}

document.querySelectorAll(".btn-time-slot").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (bookingTimePicker) {
      bookingTimePicker.value = btn.dataset.time;
      syncBookingTime();
      validateBookingTime();
      updateCapacityHint();
      renderSeatingMap();
    }
  });
});
guestCountInput.addEventListener("input", () => {
  debouncedCapacityHint();
  updateSeatingHint();
});

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

  const { checked, count } = getActiveCheckoutSummary();
  const hasUnpaid = checked.some((i) => i.isUnpaid);
  const checkedCart = checked.filter((i) => !i.isUnpaid);

  // Gọi món tại bàn bắt buộc có món (cũ hoặc mới); đặt bàn trước thì gọi món là tuỳ chọn
  if (count === 0 && !isBooking()) {
    toast(t("order_err_empty_dinein", "Danh sách món đang trống. Vui lòng chọn món để gọi tại bàn."), "error");
    return;
  }

  // Chỉ chọn món của đơn cũ chưa thanh toán -> mở QR thanh toán các đơn đó.
  // Có cả món mới: tạo đơn mới như bình thường (đủ kiểm tra), xong mới có QR gộp đúng tổng tiền.
  if (hasUnpaid && checkedCart.length === 0) {
    openCustomerPayment(currentUnpaidOrder, () => {
      checkAndRenderUnpaidOrderBanner();
    });
    return;
  }

  if (newOrderBlocked()) {
    toast("Quán đang tạm tắt chức năng đặt bàn / gọi món online. Vui lòng gọi hotline để được hỗ trợ.", "error");
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
    const customer = getCurrentCustomer();
    // Khách bỏ tích một số món mới -> chỉ đặt các món đang tích (giá + tồn kho lấy mới nhất từ thực đơn), món còn lại giữ trong giỏ
    let subsetItems;
    if (checkedCart.length > 0 && checkedCart.length < getCart().length) {
      const synced = await syncCartWithCatalog();
      const keep = new Set(checkedCart.map((i) => i.drinkId));
      subsetItems = synced.cart.filter((i) => keep.has(i.drinkId));
    }
    const result = await createOrder({
      ...(subsetItems ? { items: subsetItems } : {}),
      birthDate: data.birthDate,
      voucherCode: latest?.voucherCode || "",
      pointsToUse: latest?.pointsUsed || 0,
      name: data.name,
      phone: data.phone,
      email: String(data.email || customer?.email || "").trim(),
      serviceType: data.serviceType,
      customerId: customer?.id || "", // khách đã đăng nhập -> được tích điểm khi đơn hoàn tất
      tableNumber: String(data.tableNumber || "").trim(),
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

    if (!subsetItems) clearCart(); // đặt một phần giỏ thì createOrder đã tự bỏ đúng các món vừa đặt
    renderCart();
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

    // Tự động gửi Vé Điện Tử (Cinema E-Ticket) về Email tài khoản khách đã đăng ký
    try {
      const mail = await sendOrderConfirmationEmail(result.order, customer);
      const note = describeMailDelivery(mail, result.order);
      toast(note.message, note.type);
    } catch (eMailErr) {
      console.warn("Không thể gửi email vé điện tử:", eMailErr);
    }

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
  const customer = getCurrentCustomer();
  const ticketEmail = order.email || customer?.email || "Email tài khoản";

  host.innerHTML = `
    <div class="modal-box modal-success-order" role="dialog" aria-modal="true">
      <div class="success-icon-wrap">${ICONS.checkCircle(40)}</div>
      <h3 class="modal-success-title">${order.isTableOnly ? t("order_success_table", "Giữ bàn thành công!") : t("order_success", "Đặt chỗ thành công!")}</h3>
      <p class="modal-success-sub">${t("order_success_sub", "Hãy lưu lại mã đơn - cần mã này cùng số điện thoại để tra cứu hoặc huỷ đặt chỗ.")}</p>

      <!-- THÔNG BÁO VÉ ĐIỆN TỬ GỬI VỀ MAIL NHƯ VÉ XEM PHIM -->
      <div class="ticket-email-alert" style="margin: 14px 0; background: rgba(212, 175, 55, 0.08); border: 1px solid rgba(212, 175, 55, 0.35); border-radius: 8px; padding: 12px 14px; text-align: left;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.5rem;">🎟️</span>
            <div>
              <div style="font-size: 0.88rem; font-weight: 700; color: #f7d794;">Vé Điện Tử (Cinema E-Ticket) đã gửi về mail:</div>
              <div style="font-size: 0.82rem; color: #4ade80; font-family: monospace;">${escapeHtml(ticketEmail)}</div>
            </div>
          </div>
          <button type="button" class="btn btn-primary btn-sm" id="btn-success-view-ticket" style="white-space: nowrap; font-size: 0.78rem; padding: 6px 12px;">
            🎟️ Mở Vé Điện Tử
          </button>
        </div>
      </div>

      <div class="order-receipt-card">
        <div class="receipt-row"><span>${t("order_rc_code", "Mã đặt chỗ")}:</span><strong class="receipt-code">${escapeHtml(order.code)}</strong></div>
        <div class="receipt-row"><span>${t("order_rc_customer", "Khách hàng")}:</span><span>${escapeHtml(order.name)}</span></div>
        <div class="receipt-row"><span>${t("order_rc_service", "Hình thức")}:</span><span>${serviceText(order)}</span></div>
        ${order.serviceDetails().map(([label, value]) => `
          <div class="receipt-row"><span>${label}:</span><span>${escapeHtml(value)}</span></div>`).join("")}
        ${order.discountTotal > 0 ? `
          <div class="receipt-row"><span>${t("order_subtotal", "Tổng tạm tính")}:</span><span>${formatMoney(order.subtotal)}</span></div>
          ${order.discounts.map((d) => `<div class="receipt-row"><span>${escapeHtml(d.label)}:</span><span>−${formatMoney(d.amount)}</span></div>`).join("")}` : ""}
        <div class="receipt-row"><span>${t("order_rc_total", "Tổng giá trị đơn")}:</span><strong>${formatMoney(order.total)}</strong></div>
        ${order.total > 0 ? `
          <div class="receipt-row"><span>${t("order_prepay_70", "Cần trả trước khi đặt (70%)")}:</span><strong class="text-amber">${formatMoney(order.prepayAmount)}</strong></div>
          <div class="receipt-row"><span>${t("order_remaining_30", "Còn lại trả tại quán (30%)")}:</span><span class="text-muted">${formatMoney(order.remainingAmount)}</span></div>` : ""}
      </div>

      <div class="door-host-notice-card bar-rules-notice-card" style="margin: 16px 0; text-align: left;">
        <div class="notice-icon">📜</div>
        <div class="notice-content">
          <div class="notice-title">NỘI QUY &amp; QUY ĐỊNH QUÁN BAR ĐÊM</div>
          <ul class="bar-rules-list">
            ${BAR_RULES.map((r) => `<li><strong>${escapeHtml(r.title)}:</strong> ${escapeHtml(r.text)}</li>`).join("")}
          </ul>
        </div>
      </div>

      <div class="modal-actions-stacked" style="display: flex; flex-direction: column; gap: 10px;">
        ${order.needsDeposit ? `
        <button type="button" class="btn btn-primary btn-block btn-vqr-pay" id="success-open-vietqr-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          <span>${t("order_qr_now", "Quét Mã QR MBBank Trả Trước 70%")} (${formatMoney(order.prepayAmount)})</span>
        </button>` : ""}
        <button type="button" class="btn btn-ghost btn-block" id="success-close-btn">${t("order_close", "Đã hiểu & Đóng")}</button>
      </div>
    </div>`;

  document.body.appendChild(host);
  const close = () => host.remove();
  host.querySelector("#success-close-btn").addEventListener("click", close);
  host.querySelector("#btn-success-view-ticket")?.addEventListener("click", () => {
    openCinemaTicketModal(order, { toEmail: ticketEmail });
  });
  host.querySelector("#success-open-vietqr-btn")?.addEventListener("click", () => {
    close();
    // Các đơn chưa trả khác của khách (không tính đơn vừa tạo) được gộp chung vào một mã QR; khách tự bỏ tích đơn chưa muốn trả
    const others = (currentUnpaidOrders || []).filter((o) => o.id !== order.id && Array.isArray(o.items) && o.items.length > 0);
    if (others.length > 0) {
      const itemsOf = (o, tag) => {
        const allocated = allocateOrderTotal(o.items, o.total); // tổng các món = đúng tổng đơn
        return o.items.map((it, idx) => ({
          ...it,
          isUnpaid: true, // đơn ĐÃ LƯU - nếu đánh dấu là món giỏ hàng, nút "Tôi đã chuyển khoản" sẽ tạo thêm đơn TRÙNG
          orderCode: o.code,
          orderId: o.id,
          sourceTag: `${tag} ${o.code}`,
          finalPrice: allocated[idx],
          checked: true,
        }));
      };
      openCustomerPayment(order, null, [...others.flatMap((o) => itemsOf(o, "Đơn cũ")), ...itemsOf(order, "Đơn mới")]);
    } else {
      openCustomerPayment(order);
    }
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
  const showQrBtn = o.needsDeposit; // chưa huỷ, chưa có cọc/đã trả được xác nhận, có tiền phải trả

  // Khách tự huỷ được không - quy tắc nằm trong chính đối tượng đơn (đa hình theo loại đơn)
  const cancel = o.customerCancelCheck();
  const cancelHtml = cancel.ok && !canCustomer("self:cancel")
    ? `<p class="lookup-cancel-note">${escapeHtml(t("order_cancel_disabled", "Quán đang tắt chức năng tự huỷ đơn online - vui lòng gọi hotline để được hỗ trợ."))}</p>`
    : cancel.ok
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
        <p><strong>${t("order_rc_amount", "Tổng tiền")}:</strong> <strong>${formatMoney(o.total)}</strong> <span class="text-muted text-xs">(Trả trước 70%: <strong class="text-amber">${formatMoney(o.prepayAmount)}</strong> · Tại quán 30%: ${formatMoney(o.remainingAmount)})</span></p>
        <p><strong>${t("order_rc_payment", "Thanh toán")}:</strong> <span class="badge ${o.paymentBadge}">${paymentText(o)}</span>${o.hasDeposit ? ` <span class="text-muted text-xs">(còn ${formatMoney(o.remainingAmount)} thanh toán tại quán)</span>` : ""}${o.forfeitedDeposit > 0 ? ` <span class="text-muted text-xs">(đã huỷ - cọc ${formatMoney(o.forfeitedDeposit)} không hoàn${o.refundDue > 0 ? `, quán hoàn lại ${formatMoney(o.refundDue)}` : ""})</span>` : ""}</p>`}
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
              <span>${t("order_lookup_qr", "Mở Mã QR MBBank Trả Trước 70%")} (${formatMoney(o.prepayAmount)})</span>
            </button>` : ""}
          <button type="button" class="btn btn-secondary btn-sm" id="lookup-ticket-btn" style="display: inline-flex; align-items: center; gap: 5px;">
            <span>🎟️</span> <span>Xem Vé Điện Tử</span>
          </button>
          ${cancelHtml}
        </div>
      </div>
    </div>`;
}

/** Khách tự huỷ đơn / đặt bàn ngay trong kết quả tra cứu */
async function handleCustomerCancel(button) {
  const order = lastLookedUpOrder;
  const what = order.serviceType === "booking" ? "đặt bàn" : "đơn";
  const forfeitNote = order.hasDeposit ? ` Bạn sẽ MẤT TIỀN CỌC ${formatMoney(order.prepayAmount)} (quán không hoàn lại).` : "";
  const ok = await confirmDialog(
    `Huỷ ${what} ${order.code}? ${order.isTableOnly ? "" : "Các món đã gọi sẽ được huỷ theo. "}${forfeitNote} Thao tác này không thể hoàn tác.`,
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

    const ticketBtn = e.target.closest("#lookup-ticket-btn");
    if (ticketBtn && lastLookedUpOrder) {
      openCinemaTicketModal(lastLookedUpOrder);
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
    renderSeatingMap();
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

window.addEventListener("customer-auth-change", async () => {
  fillCustomerInfo();
  if (!getCurrentCustomer()) {
    promo.points = 0; // đăng xuất thì bỏ điểm đang định dùng
    removeItem(LATEST_ORDER_KEY);
    if (unpaidBannerWrap) {
      unpaidBannerWrap.innerHTML = "";
      unpaidBannerWrap.hidden = true;
    }
  }
  await checkAndRenderUnpaidOrderBanner();
  await syncAndRenderCart();
  await refreshPricing();
  refreshCartBadge();
});

// Đổi VI/EN: chữ tĩnh trong HTML do applyI18n() lo; phần do JS vẽ thì vẽ lại ở đây
window.addEventListener("languagechange", () => {
  renderHoursHint();
  renderCart();
  updateCapacityHint();
  if (lastLookedUpOrder && !lookupResultsEl.hidden) lookupResultsEl.innerHTML = lookupResultHtml(lastLookedUpOrder);
});
cartListEl.innerHTML = loadingHtml("Đang kiểm tra danh sách món đã chọn...");

async function initOrderPage() {
  await syncRolePermissions(); // lấy phân quyền khách hàng mới nhất từ máy chủ
  if (!canCustomer("self:order")) {
    const notice = document.createElement("div");
    notice.className = "unpaid-banner";
    notice.setAttribute("role", "alert");
    notice.style.cssText = "margin: 0 0 16px; padding: 14px 18px; border: 1px solid rgba(239,68,68,0.4); border-radius: 8px; background: rgba(239,68,68,0.08); color: #fca5a5;";
    notice.textContent = "Quán đang tạm tắt chức năng đặt bàn / gọi món online. Vui lòng gọi hotline để được hỗ trợ.";
    formEl.prepend(notice);
  }
  await checkAndRenderUnpaidOrderBanner();
  await syncAndRenderCart();
  await refreshPricing();
}

initOrderPage();

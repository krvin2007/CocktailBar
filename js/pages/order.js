/* =========================================================
   ORDER.JS - Trang giỏ hàng + đặt bàn/đặt món + tra cứu đơn
   - Giỏ hàng: đọc/ghi localStorage (thao tác tức thì).
   - Đặt hàng, tra cứu: gọi API json-server bằng async/await.
   ========================================================= */

import "../modules/navbar.js";
import { refreshCartBadge } from "../modules/navbar.js";
import {
  getCart, updateCartQty, removeFromCart, getCartSummary, createOrder,
  syncCartWithCatalog, findOrderByCodeAndPhone,
} from "../modules/ordersService.js";
import { formatMoney, formatDateTime, escapeHtml } from "../modules/utils.js";
import { validateForm, clearFormErrors, setFieldError } from "../modules/validation.js";
import { toast, confirmDialog, setButtonLoading, loadingHtml, errorHtml } from "../modules/ui.js";
import { ICONS } from "../modules/icons.js";
import { openVietQRPaymentModal } from "../modules/vietqrService.js";

const cartListEl = document.getElementById("cart-list");
const sumCountEl = document.getElementById("sum-count");
const sumTotalEl = document.getElementById("sum-total");
const formEl = document.getElementById("order-form");
const submitBtn = document.getElementById("submit-order-btn");
const bookingTimeInput = document.getElementById("booking-time-input");
const guestCountInput = formEl.elements.guestCount;

/** Tồn kho mới nhất của từng món (id -> stock), cập nhật mỗi lần đối chiếu với API */
let stockById = new Map();

/* ---------------- Giỏ hàng ---------------- */

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
        <p class="cart-item-price">${formatMoney(item.price)}</p>
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

  const { total, count } = getCartSummary();
  if (sumCountEl) sumCountEl.textContent = `${count} ly`;
  if (sumTotalEl) sumTotalEl.textContent = formatMoney(total);
  if (submitBtn) submitBtn.disabled = cart.length === 0;
}

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

  refreshCartBadge();
  renderCart();
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

  const restoreButton = setButtonLoading(submitBtn, "Đang gửi đơn đến quán...");
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
    });

    // Máy chủ báo giỏ hàng có thay đổi (hết hàng/đổi giá) -> báo khách, không đặt
    announceChanges(result.changes || []);
    if (!result.success) {
      toast("Các món trong giỏ đã hết hàng hoặc không còn phục vụ, vui lòng chọn món khác.", "error");
      await syncAndRenderCart();
      return;
    }

    refreshCartBadge();
    renderCart();
    formEl.reset();
    clearFormErrors(formEl);
    updateConditionalFields();
    showOrderSuccessModal(result.order);
  } catch (err) {
    toast(err.message, "error");
  } finally {
    restoreButton();
    if (getCart().length === 0) submitBtn.disabled = true;
  }
});

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
        <div class="receipt-row"><span>Tổng thanh toán:</span><strong class="text-amber">${formatMoney(order.total)}</strong></div>
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
        <p><strong>Tổng tiền:</strong> <strong class="text-amber">${formatMoney(o.total)}</strong></p>
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

updateConditionalFields();
checkUrlParams();
cartListEl.innerHTML = loadingHtml("Đang kiểm tra danh sách món đã chọn...");
syncAndRenderCart();

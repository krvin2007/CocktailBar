/* =========================================================
   CONTACT.JS - Trang liên hệ: form gửi tin nhắn tới quán
   Gửi dữ liệu lên máy chủ bằng POST /messages (async/await).
   Tự động điền thông tin và liên kết phản hồi nếu khách đã đăng nhập.
   ========================================================= */

import "../modules/navbar.js";
import { addMessage } from "../modules/messagesService.js";
import { getCurrentCustomer } from "../modules/customerAuth.js";
import { validateForm, clearFormErrors } from "../modules/validation.js";
import { toast, setButtonLoading } from "../modules/ui.js";
import { getCurrentLang } from "../modules/i18n.js";
import { VENUE, mapsSearchUrl } from "../modules/venue.js";
import { renderVenueMap as drawVenueMap } from "../modules/venueMap.js";
import { escapeHtml } from "../modules/utils.js";

/** Địa chỉ + bản đồ lấy từ VENUE (cùng nguồn với mục "Địa điểm" ở trang chủ) */
function renderVenueMap() {
  const addressEl = document.getElementById("contact-address");
  if (addressEl) addressEl.textContent = VENUE.address;

  const mapHost = document.getElementById("contact-map");
  if (!mapHost) return;
  const lang = getCurrentLang();
  const en = lang === "en";
  mapHost.innerHTML = `
    <div class="venue-map" id="contact-map-canvas" role="img" aria-label="${en ? "Map" : "Bản đồ"}: ${VENUE.address}"></div>
    <a class="btn btn-primary btn-sm contact-map-link" href="${mapsSearchUrl()}" target="_blank" rel="noopener">
      ${en ? "Open in Google Maps" : "Mở trên Google Maps"}
    </a>`;
  drawVenueMap(document.getElementById("contact-map-canvas"), { lang });
}

renderVenueMap();
window.addEventListener("languagechange", renderVenueMap);

const formEl = document.getElementById("contact-form");
const submitBtn = document.getElementById("contact-submit-btn");

function applyCustomerDefaults() {
  const customer = getCurrentCustomer();
  if (!customer) return;

  if (formEl.elements.name && !formEl.elements.name.value) formEl.elements.name.value = customer.name || "";
  if (formEl.elements.phone && !formEl.elements.phone.value) formEl.elements.phone.value = customer.phone || "";
  if (formEl.elements.email && !formEl.elements.email.value) formEl.elements.email.value = customer.email || "";

  if (!formEl.querySelector(".customer-contact-notice")) {
    const noticeBox = document.createElement("div");
    noticeBox.className = "customer-contact-notice";
    noticeBox.style.cssText = "grid-column: 1 / -1; margin-bottom: 12px; background: rgba(197, 152, 67, 0.1); border: 1px solid rgba(197, 152, 67, 0.3); border-radius: 8px; padding: 10px 14px; font-size: 0.85rem; color: var(--cream); display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;";
    noticeBox.innerHTML = `
      <div>
        <strong style="color: var(--amber);">✦ Đang kết nối với tài khoản: ${escapeHtml(customer.name)}</strong>
        <div class="text-xs text-muted">Câu trả lời &amp; phản hồi từ quản trị viên sẽ được lưu trực tiếp vào hồ sơ thành viên của bạn.</div>
      </div>
      <a href="customer-account.html" class="btn btn-ghost btn-sm" style="font-size: 0.75rem; padding: 4px 8px; white-space: nowrap;">Xem phản hồi từ quán</a>
    `;
    formEl.insertBefore(noticeBox, formEl.firstChild);
  }
}

applyCustomerDefaults();

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();

  const { isValid, data } = validateForm(formEl);
  if (!isValid) {
    toast("Vui lòng kiểm tra lại thông tin trong form.", "error");
    return;
  }

  const restoreButton = setButtonLoading(submitBtn, "Đang gửi...");

  try {
    await addMessage({
      name: data.name,
      phone: data.phone,
      email: data.email || "",
      subject: data.subject,
      message: data.message,
    });

    toast("Cảm ơn bạn! Quán đã nhận được tin nhắn và sẽ phản hồi lại bạn sớm.", "success");
    formEl.reset();
    clearFormErrors(formEl);
    applyCustomerDefaults();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    restoreButton();
  }
});

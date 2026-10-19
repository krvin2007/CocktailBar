/* =========================================================
   CONTACT.JS - Trang liên hệ: form gửi tin nhắn tới quán
   Gửi dữ liệu lên máy chủ bằng POST /messages (async/await).
   ========================================================= */

import "../modules/navbar.js";
import { addMessage } from "../modules/messagesService.js";
import { validateForm, clearFormErrors } from "../modules/validation.js";
import { toast, setButtonLoading } from "../modules/ui.js";
import { getCurrentLang } from "../modules/i18n.js";
import { VENUE, mapsSearchUrl } from "../modules/venue.js";
import { renderVenueMap as drawVenueMap } from "../modules/venueMap.js";

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

    toast("Cảm ơn bạn! Quán đã nhận được tin nhắn và sẽ liên hệ lại sớm.", "success");
    formEl.reset();
    clearFormErrors(formEl);
  } catch (err) {
    toast(err.message, "error");
  } finally {
    restoreButton();
  }
});

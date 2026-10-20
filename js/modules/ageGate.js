/* =========================================================
   AGEGATE.JS - Cổng kiểm tra độ tuổi 18+ (Age Gate Modal)
   Tuân thủ Điều 32 Luật Phòng, chống tác hại của rượu, bia 2019:
   - Chặn người dưới 18 tuổi truy cập nội dung đồ uống có cồn.
   - Cảnh báo nghĩa vụ xuất trình CCCD/VNeID khi đến quán nhận bàn.
   - Lưu trạng thái vào localStorage ("bar_age_verified").
   - Hỗ trợ đa ngôn ngữ (VI / EN).
   ========================================================= */

import { getCurrentLang } from "./i18n.js";
import { getItem, setItem } from "./storage.js";

export const AGE_GATE_STORAGE_KEY = "bar_age_verified";

/**
 * Kiểm tra xem người dùng đã xác nhận độ tuổi 18+ hay chưa
 */
export function isAgeVerified() {
  return getItem(AGE_GATE_STORAGE_KEY, false) === true;
}

/**
 * Lưu trạng thái đã xác minh độ tuổi
 */
export function setAgeVerified(verified = true) {
  setItem(AGE_GATE_STORAGE_KEY, verified === true);
}

/**
 * Xóa trạng thái xác minh (để kiểm thử hoặc đổi người dùng)
 */
export function resetAgeVerification() {
  localStorage.removeItem(AGE_GATE_STORAGE_KEY);
}

/**
 * Khởi tạo và hiển thị modal Age Gate nếu người dùng chưa xác nhận
 */
export function initAgeGate() {
  // Không hiển thị trên các trang quản trị admin
  const path = window.location.pathname.toLowerCase();
  if (path.includes("admin-") || path.includes("/admin")) return;

  // Nếu đã xác minh rồi thì không hiện lại
  if (isAgeVerified()) return;

  // Tránh tạo nhiều modal trùng lặp
  if (document.getElementById("bar-age-gate-modal")) return;

  const isEn = getCurrentLang() === "en";

  const modalOverlay = document.createElement("div");
  modalOverlay.id = "bar-age-gate-modal";
  modalOverlay.className = "age-gate-overlay";
  modalOverlay.setAttribute("role", "dialog");
  modalOverlay.setAttribute("aria-modal", "true");
  modalOverlay.setAttribute("aria-labelledby", "age-gate-title");

  modalOverlay.innerHTML = `
    <div class="age-gate-card">
      <div class="age-gate-badge">18+</div>
      <h2 id="age-gate-title" class="age-gate-title">
        ${isEn ? "AGE VERIFICATION" : "XÁC NHẬN ĐỘ TUỔI THƯỞNG THỨC"}
      </h2>
      <p class="age-gate-brand">THE VELVET COCKTAIL BAR &amp; LOUNGE</p>
      
      <div class="age-gate-law-box">
        <p class="age-gate-law-title">
          ⚖️ ${isEn ? "Legal Compliance Notice (Vietnam Law 2019)" : "Tuân thủ Luật Phòng, chống tác hại của rượu, bia 2019:"}
        </p>
        <p class="age-gate-text">
          ${isEn
            ? "According to Article 32 of Vietnam Law on Prevention and Control of Harmful Effects of Alcoholic Beverages: Selling or providing alcohol to individuals under 18 years old is strictly prohibited."
            : "Theo quy định tại Điều 32 Luật Phòng, chống tác hại của rượu, bia số 44/2019/QH14: <strong>Nghiêm cấm bán, cung cấp rượu, bia cho người chưa đủ 18 tuổi</strong>."}
        </p>
        <p class="age-gate-subtext">
          ${isEn
            ? "Please verify that you are at least 18 years of age. Upon arrival at the bar, our Door Host will inspect your physical ID card or VNeID app before table seating. False declarations will result in service denial."
            : "Quý khách phải <strong>từ đủ 18 tuổi trở lên</strong> để truy cập website. Khi đến quán nhận bàn hoặc thưởng thức, quý khách vui lòng <strong>xuất trình CCCD hoặc ứng dụng VNeID (mức 2)</strong> để nhân viên lễ tân đối chiếu. Khai báo gian dối sẽ bị từ chối phục vụ."}
        </p>
      </div>

      <div class="age-gate-actions" id="age-gate-action-container">
        <button type="button" class="btn btn-primary btn-lg age-gate-btn-accept" id="age-gate-accept-btn">
          <span>${isEn ? "I am 18 or older (Enter)" : "Tôi đã đủ 18 tuổi (Vào quán)"}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
        <button type="button" class="btn btn-ghost btn-sm age-gate-btn-reject" id="age-gate-reject-btn">
          ${isEn ? "I am under 18 years old" : "Tôi chưa đủ 18 tuổi"}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);
  document.body.classList.add("age-gate-locked");

  const acceptBtn = modalOverlay.querySelector("#age-gate-accept-btn");
  const rejectBtn = modalOverlay.querySelector("#age-gate-reject-btn");
  const actionContainer = modalOverlay.querySelector("#age-gate-action-container");

  acceptBtn.onclick = () => {
    setAgeVerified(true);
    modalOverlay.classList.add("age-gate-closing");
    document.body.classList.remove("age-gate-locked");
    setTimeout(() => {
      modalOverlay.remove();
    }, 350);
  };

  rejectBtn.onclick = () => {
    actionContainer.innerHTML = `
      <div class="age-gate-underage-box">
        <div class="age-gate-underage-icon">🚫</div>
        <h3 class="age-gate-underage-title">${isEn ? "Access Restricted" : "Từ Chối Truy Cập"}</h3>
        <p class="age-gate-underage-msg">
          ${isEn
            ? "We appreciate your interest in The Velvet Bar. However, in accordance with applicable laws, our services and alcoholic beverages are exclusively reserved for adults aged 18 and over. We hope to welcome you in the future when you come of age!"
            : "Cảm ơn bạn đã ghé thăm The Velvet Cocktail Bar. Theo quy định pháp luật hiện hành, quán chỉ phục vụ khách hàng từ đủ 18 tuổi trở lên. Rất mong được đón tiếp bạn trong tương lai khi bạn đã đủ tuổi trưởng thành!"}
        </p>
        <a href="https://www.google.com" class="btn btn-outline mt-3" style="margin: 12px auto 0; display: inline-flex;">
          ${isEn ? "Exit Website" : "Rời khỏi website"}
        </a>
      </div>
    `;
  };
}

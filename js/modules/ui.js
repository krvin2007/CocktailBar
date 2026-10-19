/* =========================================================
   UI.JS - Thành phần giao diện dùng chung: toast, hộp xác nhận
   Sử dụng biểu tượng SVG nét mảnh, phong cách tối giản thanh lịch.
   ========================================================= */

import { ICONS } from "./icons.js";
import { escapeHtml } from "./utils.js";

/** Đảm bảo có sẵn khung chứa toast trong trang, tạo nếu chưa có */
function ensureToastHost() {
  let host = document.getElementById("toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "toast-host";
    host.className = "toast-host";
    document.body.appendChild(host);
  }
  return host;
}

/**
 * Hiện thông báo nổi góc màn hình.
 * message luôn là CHỮ THUẦN (đưa vào bằng textContent): thông báo hay chứa tên khách,
 * tên món, tham số URL... nên không được coi là HTML - tránh tấn công XSS.
 * @param {string} message
 * @param {"success"|"error"|"warning"|"info"} type ("danger" là tên gọi khác của "error")
 */
export function toast(message, type = "info") {
  const host = ensureToastHost();
  const kind = type === "danger" ? "error" : type;
  const iconMap = {
    success: ICONS.checkCircle(18),
    error: ICONS.alertCircle(18),
    warning: ICONS.alertCircle(18),
    info: ICONS.info(18)
  };
  const iconSvg = iconMap[kind] || ICONS.info(18);

  const el = document.createElement("div");
  el.className = `toast-item toast-${iconMap[kind] ? kind : "info"}`;
  el.innerHTML = `<span class="toast-icon">${iconSvg}</span><span class="toast-msg"></span>`;
  el.querySelector(".toast-msg").textContent = message;
  host.appendChild(el);

  requestAnimationFrame(() => el.classList.add("show"));

  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 250);
  }, 3200);
}

/** Đảm bảo có sẵn khung modal xác nhận trong trang */
function ensureConfirmHost() {
  let host = document.getElementById("confirm-modal");
  if (host) return host;

  host = document.createElement("div");
  host.id = "confirm-modal";
  host.className = "modal-overlay";
  host.hidden = true;
  host.innerHTML = `
    <div class="modal-box modal-confirm" role="alertdialog" aria-modal="true">
      <div class="modal-confirm-icon">${ICONS.alertCircle(28)}</div>
      <p class="modal-confirm-title" id="confirm-title">Xác nhận thao tác</p>
      <p class="modal-confirm-text" id="confirm-text"></p>
      <div class="modal-confirm-actions">
        <button type="button" class="btn btn-ghost" id="confirm-cancel">Huỷ bỏ</button>
        <button type="button" class="btn btn-danger" id="confirm-ok">Đồng ý</button>
      </div>
    </div>`;
  document.body.appendChild(host);
  return host;
}

/**
 * Hộp thoại xác nhận trước thao tác quan trọng (xoá dữ liệu...).
 */
export function confirmDialog(message, opts = {}) {
  const { title = "Xác nhận thao tác", okText = "Đồng ý", danger = true } = opts;
  const host = ensureConfirmHost();

  host.querySelector("#confirm-title").textContent = title;
  host.querySelector("#confirm-text").textContent = message;

  const okBtn = host.querySelector("#confirm-ok");
  const cancelBtn = host.querySelector("#confirm-cancel");
  okBtn.className = danger ? "btn btn-danger" : "btn btn-primary";
  okBtn.textContent = okText;

  host.hidden = false;
  requestAnimationFrame(() => host.classList.add("show"));

  return new Promise((resolve) => {
    const close = (result) => {
      host.classList.remove("show");
      setTimeout(() => { host.hidden = true; }, 200);
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      host.removeEventListener("click", onOverlay);
      resolve(result);
    };
    const onOk = () => close(true);
    const onCancel = () => close(false);
    const onOverlay = (e) => { if (e.target === host) close(false); };

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    host.addEventListener("click", onOverlay);
  });
}

/* =========================================================
   TIỆN ÍCH CHO THAO TÁC BẤT ĐỒNG BỘ (gọi API)
   ========================================================= */

/**
 * Chuyển một nút sang trạng thái "đang xử lý" trong lúc chờ API.
 * Trả về hàm khôi phục: gọi lại để trả nút về đúng nội dung ban đầu
 * (giữ nguyên icon SVG bên trong, không ghi đè bằng chữ thường).
 */
export function setButtonLoading(button, text = "Đang xử lý...") {
  if (!button) return () => {};
  const originalHtml = button.innerHTML;
  button.disabled = true;
  button.classList.add("is-loading");
  button.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span><span>${text}</span>`;

  return () => {
    button.disabled = false;
    button.classList.remove("is-loading");
    button.innerHTML = originalHtml;
  };
}

/** Khung "đang tải dữ liệu" hiển thị trong lúc chờ API trả về */
export function loadingHtml(message = "Đang tải dữ liệu từ máy chủ...") {
  return `
    <div class="loading-state" role="status">
      <span class="btn-spinner btn-spinner-lg" aria-hidden="true"></span>
      <p>${message}</p>
    </div>`;
}

/** Khung báo lỗi khi tải dữ liệu thất bại */
export function errorHtml(message) {
  return `
    <div class="empty-state error-state">
      <div class="empty-icon">${ICONS.alertCircle(32)}</div>
      <h4>Không tải được dữ liệu</h4>
      <p class="text-muted">${escapeHtml(message)}</p>
    </div>`;
}

/* ---------- Banner cảnh báo khi máy chủ API chưa chạy ---------- */

function ensureApiBanner() {
  let banner = document.getElementById("api-offline-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "api-offline-banner";
    banner.className = "api-offline-banner";
    banner.setAttribute("role", "alert");
    banner.innerHTML = `
      <span class="api-offline-icon">${ICONS.alertCircle(16)}</span>
      <span>Máy chủ API chưa chạy - đang hiển thị dữ liệu lưu tạm, chưa thể thêm/sửa/xoá.
        Chạy <code>npm start</code> rồi tải lại trang.</span>`;
    document.body.prepend(banner);
  }
  return banner;
}

// api.js phát sự kiện "api-status" mỗi khi trạng thái kết nối thay đổi
window.addEventListener("api-status", (e) => {
  const { online } = e.detail;
  if (online) {
    const banner = document.getElementById("api-offline-banner");
    if (banner) banner.remove();
  } else {
    ensureApiBanner();
  }
});

/* =========================================================
   MODAL THƯỜNG (form thêm/sửa, chi tiết đơn...)
   Khôi phục lại: các trang quản trị import 2 hàm này - thiếu là
   trình duyệt dừng nạp cả module, trang trắng trơn.
   ========================================================= */

/** Mở modal theo id; bấm nền tối hoặc phím Esc để đóng */
export function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("show"));
  document.body.classList.add("no-scroll");

  if (!el.dataset.closeBound) {
    el.dataset.closeBound = "1";
    el.addEventListener("click", (e) => { if (e.target === el) closeModal(id); });
  }
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (!el || el.hidden) return;
  el.classList.remove("show");
  document.body.classList.remove("no-scroll");
  setTimeout(() => { el.hidden = true; }, 200);
}

// Phím Esc đóng modal đang mở trên cùng (bàn phím - yêu cầu "keyboard event" của đề)
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const opened = [...document.querySelectorAll(".modal-overlay.show")].pop();
  if (opened && opened.id && opened.id !== "confirm-modal") closeModal(opened.id);
});

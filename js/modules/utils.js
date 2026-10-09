/* =========================================================
   UTILS.JS - Hàm tiện ích dùng chung toàn website
   ========================================================= */

/** Sinh id duy nhất, không cần thư viện ngoài: thời gian + số ngẫu nhiên */
export function uid(prefix = "id") {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

/** 65000 -> "65.000đ" */
export function formatMoney(value) {
  const n = Number(value) || 0;
  return n.toLocaleString("vi-VN") + "đ";
}

/** "2025-09-25T10:00:00.000Z" -> "25/09/2025" */
export function formatDate(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN");
}

/** "2025-09-25T10:00:00.000Z" -> "25/09/2025 10:00" */
export function formatDateTime(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("vi-VN")} ${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
}

/** Trì hoãn gọi hàm cho đến khi người dùng ngừng gõ (dùng cho ô tìm kiếm) */
export function debounce(fn, delay = 300) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Viết tắt document.querySelector / querySelectorAll */
export const qs = (selector, scope = document) => scope.querySelector(selector);
export const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

/** Chống lỗi XSS cơ bản khi chèn văn bản người dùng nhập vào innerHTML */
export function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Lấy tham số trên URL, ví dụ detail.html?id=d1 -> getQueryParam("id") = "d1" */
export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * Mô phỏng độ trễ mạng bằng Promise, để những chỗ "gửi dữ liệu"
 * có cảm giác như đang gọi API thật (và để minh hoạ async/await
 * dù đồ án không có backend).
 */
export function delay(ms = 500) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Giới hạn một số trong đoạn [min, max] */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Cắt chuỗi quá dài, thêm dấu "…" */
export function truncate(str = "", max = 80) {
  return str.length > max ? str.slice(0, max - 1).trimEnd() + "…" : str;
}

/**
 * Phân trang một mảng phía client.
 * @returns {{ items: Array, page: number, totalPages: number }}
 */
export function paginate(list, page = 1, perPage = 8) {
  const totalPages = Math.max(1, Math.ceil(list.length / perPage));
  const safePage = clamp(page, 1, totalPages);
  const start = (safePage - 1) * perPage;
  return { items: list.slice(start, start + perPage), page: safePage, totalPages };
}

/** Dựng HTML thanh phân trang, gọi onChange(page) khi bấm số trang */
export function renderPagination(container, page, totalPages, onChange) {
  if (totalPages <= 1) { container.innerHTML = ""; return; }

  let html = "";
  html += `<button data-page="${page - 1}" ${page === 1 ? "disabled" : ""}>‹</button>`;
  for (let p = 1; p <= totalPages; p++) {
    html += `<button data-page="${p}" class="${p === page ? "active" : ""}">${p}</button>`;
  }
  html += `<button data-page="${page + 1}" ${page === totalPages ? "disabled" : ""}>›</button>`;

  container.innerHTML = html;
  container.querySelectorAll("button[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => onChange(Number(btn.dataset.page)));
  });
}

/**
 * Ghép nhiều tên class lại, tự động bỏ qua giá trị rỗng/false/undefined.
 * Dùng rest parameter để nhận số lượng class tuỳ ý, ví dụ:
 *   classNames("badge", isActive && "badge-success", "badge-sm")
 */
export function classNames(...parts) {
  return parts.filter(Boolean).join(" ");
}

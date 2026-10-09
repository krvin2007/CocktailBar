/* =========================================================
   STORAGE.JS - Lớp bọc thao tác localStorage / sessionStorage
   Dữ liệu chung của quán nằm trên máy chủ json-server (xem api.js);
   localStorage giữ những gì thuộc về RIÊNG trình duyệt này:
     - giỏ hàng của khách (quanbar_cart)
     - bản sao đệm dữ liệu API (quanbar_cache_*) để xem được khi
       máy chủ chưa chạy
   Mọi module đều đi qua đây thay vì gọi localStorage trực tiếp, để:
   - Tự chuyển đổi JSON <-> Object
   - Bắt lỗi khi localStorage đầy / bị chặn (chế độ ẩn danh)
   - Có một nơi duy nhất đổi tiền tố khoá nếu cần
   ========================================================= */

const PREFIX = "quanbar_";

/** Đọc một khoá, trả về giá trị mặc định nếu chưa có hoặc lỗi */
export function getItem(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (err) {
    console.warn(`[storage] Không đọc được khoá "${key}":`, err);
    return fallback;
  }
}

/** Ghi một khoá, trả về true/false báo thành công hay không */
export function setItem(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`[storage] Không ghi được khoá "${key}":`, err);
    return false;
  }
}

/** Xoá một khoá */
export function removeItem(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (err) {
    console.warn(`[storage] Không xoá được khoá "${key}":`, err);
  }
}

/** sessionStorage dùng riêng cho phiên đăng nhập admin (mất khi đóng tab) */
export function getSession(key, fallback) {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function setSession(key, value) {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeSession(key) {
  try {
    sessionStorage.removeItem(PREFIX + key);
  } catch {
    /* bỏ qua */
  }
}

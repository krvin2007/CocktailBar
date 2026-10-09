/* =========================================================
   API.JS - Lớp gọi REST API (json-server) bằng axios + async/await

   Đúng theo hướng dẫn bài giảng (Slide 4 + file hướng dẫn
   json-server): dữ liệu nằm trong db.json, json-server biến nó
   thành REST API tại http://localhost:3000/<tên-bảng>, và trang
   web gọi API bằng axios với 4 thao tác:
       GET    -> đọc     (axios.get)
       POST   -> thêm    (axios.post)
       PATCH  -> sửa     (axios.patch)
       DELETE -> xoá     (axios.delete)

   axios được nạp qua thẻ <script> CDN trong từng trang HTML.
   Nếu máy không có mạng để tải CDN, module tự chuyển sang dùng
   fetch() thuần của trình duyệt - kết quả trả về giống hệt nhau.

   localStorage vẫn được dùng làm BỘ NHỚ ĐỆM: mỗi lần đọc API
   thành công, bản sao dữ liệu được lưu lại; khi server chưa chạy,
   trang vẫn hiển thị được dữ liệu từ bản sao này (chỉ đọc).
   ========================================================= */

import { getItem, setItem } from "./storage.js";

const API_PORT = "3000";
const TIMEOUT_MS = 6000;

/**
 * Địa chỉ gốc của API.
 * - Mở web bằng `npm start` (json-server phục vụ cả web lẫn API ở cổng 3000)
 *   -> dùng chung địa chỉ trang hiện tại.
 * - Mở web bằng Live Server (cổng 5500...) như hướng dẫn bài giảng
 *   -> gọi sang http://localhost:3000 (json-server đã bật CORS sẵn).
 */
const loc = globalThis.location;
export const API_BASE = loc && loc.port === API_PORT ? loc.origin : `http://localhost:${API_PORT}`;

/** Lỗi API đã được chuẩn hoá - trang chỉ cần đọc .message để báo người dùng */
export class ApiError extends Error {
  constructor(message, { status = 0, offline = false } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;    // mã HTTP (404, 500...), 0 nếu không kết nối được
    this.offline = offline;  // true khi máy chủ API chưa chạy / mất kết nối
  }
}

const OFFLINE_MESSAGE = "Không kết nối được máy chủ API. Hãy chạy lệnh \"npm start\" trong thư mục dự án rồi tải lại trang.";

/* ---------------- Trạng thái kết nối ---------------- */

let apiOnline = true;

/** Báo cho giao diện biết API đang bật hay tắt (ui.js lắng nghe để hiện banner) */
function setApiStatus(online) {
  if (apiOnline === online) return;
  apiOnline = online;
  if (typeof globalThis.dispatchEvent === "function" && typeof CustomEvent === "function") {
    globalThis.dispatchEvent(new CustomEvent("api-status", { detail: { online } }));
  }
}

export function isApiOnline() {
  return apiOnline;
}

/* ---------------- Gửi request: axios trước, fetch dự phòng ---------------- */

async function requestWithAxios(method, url, data) {
  try {
    const response = await globalThis.axios({ method, url, data, timeout: TIMEOUT_MS });
    return response.data;
  } catch (err) {
    if (err.response) {
      throw new ApiError(`Máy chủ báo lỗi ${err.response.status}`, { status: err.response.status });
    }
    throw new ApiError(OFFLINE_MESSAGE, { offline: true });
  }
}

async function requestWithFetch(method, url, data) {
  // AbortController để huỷ request treo quá TIMEOUT_MS (fetch không có sẵn timeout)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: data !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: data !== undefined ? JSON.stringify(data) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(OFFLINE_MESSAGE, { offline: true });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new ApiError(`Máy chủ báo lỗi ${response.status}`, { status: response.status });
  }
  // DELETE của json-server trả về {} - vẫn parse được; phòng trường hợp body rỗng
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Số lần thử lại lệnh ĐỌC khi rớt kết nối thoáng qua */
const READ_RETRIES = 2;

/**
 * Hàm gửi request duy nhất của cả website.
 * Mọi lỗi đều được quy về ApiError để nơi gọi xử lý thống nhất.
 *
 * Lệnh GET (chỉ đọc) được tự thử lại tối đa READ_RETRIES lần nếu mất
 * kết nối: json-server có thể khởi động lại trong tích tắc (VD chạy với
 * --watch), đọc lại là an toàn. Lệnh ghi (POST/PATCH/DELETE) KHÔNG tự
 * thử lại để tránh tạo trùng dữ liệu - lỗi được báo thẳng cho người dùng.
 */
async function request(method, path, data) {
  const url = `${API_BASE}${path}`;
  const send = typeof globalThis.axios === "function" ? requestWithAxios : requestWithFetch;
  const maxAttempts = method === "GET" ? READ_RETRIES + 1 : 1;

  for (let attempt = 1; ; attempt++) {
    try {
      const result = await send(method, url, data);
      setApiStatus(true);
      return result;
    } catch (err) {
      if (err.offline && attempt < maxAttempts) {
        await wait(400 * attempt);
        continue;
      }
      if (err.offline) setApiStatus(false);
      throw err;
    }
  }
}

/** Bộ hàm gọi API rút gọn - dùng giống hệt axios.get/post/patch/delete trong bài giảng */
export const api = {
  get: (path) => request("GET", path),
  post: (path, data) => request("POST", path, data),
  put: (path, data) => request("PUT", path, data),
  patch: (path, data) => request("PATCH", path, data),
  delete: (path) => request("DELETE", path),
};

/* ---------------- Đọc dữ liệu có bộ nhớ đệm localStorage ---------------- */

const cacheKey = (collection) => `cache_${collection}`;

/**
 * Đọc toàn bộ một bảng (GET /drinks, /orders...).
 * - Thành công: lưu bản sao vào localStorage rồi trả dữ liệu mới nhất.
 * - Server chưa chạy: trả bản sao đã lưu lần trước; nếu chưa từng
 *   lưu thì trả dữ liệu mẫu "fallback" đóng gói sẵn trong code.
 * - Lỗi khác (404, 500...): ném lỗi cho trang tự xử lý.
 */
export async function getCollection(collection, fallback = []) {
  try {
    const data = await api.get(`/${collection}`);
    const list = Array.isArray(data) ? data : [];
    setItem(cacheKey(collection), list);
    return list;
  } catch (err) {
    if (!err.offline) throw err;
    return getItem(cacheKey(collection), fallback);
  }
}

/**
 * Đọc một bản ghi theo id (GET /drinks/d1).
 * Trả về null nếu không tồn tại (404) - không coi là lỗi.
 */
export async function getRecord(collection, id, fallback = []) {
  try {
    return await api.get(`/${collection}/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err.status === 404) return null;
    if (!err.offline) throw err;
    const cached = getItem(cacheKey(collection), fallback);
    return cached.find((item) => String(item.id) === String(id)) || null;
  }
}

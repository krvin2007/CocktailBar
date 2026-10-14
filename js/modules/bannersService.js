/* =========================================================
   BANNERS-SERVICE.JS - Bảng banner quảng cáo (CRUD qua API)
   Đúng yêu cầu đề bài: bảng banner(id, tenbanner, hinhbanner).
     Đọc   : GET    /banners
     Thêm  : POST   /banners
     Sửa   : PATCH  /banners/:id
     Xoá   : DELETE /banners/:id
   Banner được trang chủ hiển thị thành slider (bannerSlider.js) và
   được quản trị viên quản lý tại admin-banners.html.

   Cột hinhbanner chấp nhận ĐÚNG 3 dạng (xem isSafeImageSrc):
     1. Đường dẫn tương đối tới ảnh trong dự án: img/hero-bar.jpg
     2. URL ảnh trên mạng: https://... hoặc http://...
     3. Ảnh tải lên từ máy, lưu dạng data URL base64: data:image/png;base64,...
   Mọi dạng khác (javascript:, vbscript:, file:, data:text/html...) bị
   từ chối ngay ở tầng nghiệp vụ để không thể chèn mã độc qua banner.
   ========================================================= */

import { api, getCollection } from "./api.js";
import { uid } from "./utils.js";

const COLLECTION = "banners";

/** Giới hạn độ dài tên banner (thông điệp quảng bá hiển thị trên slider) */
export const BANNER_NAME_MIN = 3;
export const BANNER_NAME_MAX = 80;

/** Ảnh tải lên từ máy tối đa 400KB - data URL được lưu thẳng trong db.json nên phải gọn */
export const BANNER_IMAGE_MAX_BYTES = 400 * 1024;

/** Các định dạng ảnh được phép tải lên (khớp với luật data URL bên dưới) */
export const BANNER_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];

/* ---------------- Kiểm tra nguồn ảnh an toàn ---------------- */

// data URL ảnh: chỉ các định dạng ảnh phổ biến, bắt buộc mã hoá base64
const DATA_IMAGE_RE = /^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/i;
// URL tuyệt đối: chỉ http/https, không khoảng trắng hay ký tự có thể phá vỡ thuộc tính HTML
const HTTP_URL_RE = /^https?:\/\/[^\s<>"'`\\]+$/i;
// Đường dẫn tương đối: KHÔNG chứa ":" (chặn mọi "giao thức" như javascript:),
// không bắt đầu bằng "//" (đó là URL tới máy chủ khác), không chứa ký tự nguy hiểm
const RELATIVE_PATH_RE = /^(?!\/\/)[^:<>"'`\\]+$/;

/**
 * Có ký tự điều khiển ẩn (xuống dòng, tab, NUL...) hay không - trình duyệt
 * bỏ qua chúng trong URL nên kẻ xấu hay dùng để "giấu" chữ javascript: -> chặn luôn.
 * Duyệt mã ký tự thay vì regex để không vướng luật no-control-regex của ESLint.
 */
function hasControlChar(text) {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

/**
 * Nguồn ảnh có an toàn để đưa vào thẻ <img src> hay không.
 * Chỉ nhận: đường dẫn tương đối không chứa ":", URL http(s)://,
 * hoặc data:image/(png|jpeg|jpg|gif|webp|svg+xml);base64,...
 * @param {unknown} src
 * @returns {boolean}
 */
export function isSafeImageSrc(src) {
  if (typeof src !== "string") return false;
  const value = src.trim();
  if (!value || hasControlChar(value)) return false;
  return DATA_IMAGE_RE.test(value) || HTTP_URL_RE.test(value) || RELATIVE_PATH_RE.test(value);
}

/**
 * Phân loại nguồn ảnh để giao diện hiển thị cho dễ hiểu.
 * @returns {"upload"|"url"|"path"|"invalid"}
 */
export function getImageSourceKind(src) {
  if (!isSafeImageSrc(src)) return "invalid";
  const value = src.trim();
  if (value.toLowerCase().startsWith("data:")) return "upload";
  if (/^https?:\/\//i.test(value)) return "url";
  return "path";
}

/** Ước lượng dung lượng thật (byte) của ảnh nằm trong data URL base64 */
export function estimateDataUrlBytes(dataUrl = "") {
  const comma = String(dataUrl).indexOf(",");
  if (comma < 0) return 0;
  const base64 = String(dataUrl).slice(comma + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

/* ============== LỚP BANNER (class, getter) ============== */

/**
 * Một banner quảng cáo - ĐÚNG 3 trường như đề bài: id, tenbanner, hinhbanner.
 * Các getter chỉ là thông tin suy ra, không được lưu xuống máy chủ.
 */
export class Banner {
  constructor({ id, tenbanner = "", hinhbanner = "" } = {}) {
    this.id = id;
    this.tenbanner = String(tenbanner ?? "").trim();
    this.hinhbanner = String(hinhbanner ?? "").trim();
  }

  /** Ảnh có thuộc 3 dạng được phép hay không */
  get hasSafeImage() {
    return isSafeImageSrc(this.hinhbanner);
  }

  /** "upload" (ảnh tải từ máy) | "url" (ảnh trên mạng) | "path" (ảnh trong dự án) | "invalid" */
  get imageKind() {
    return getImageSourceKind(this.hinhbanner);
  }

  /** Banner đủ điều kiện hiển thị trên trang chủ: có tên và ảnh hợp lệ */
  get isDisplayable() {
    return this.tenbanner.length > 0 && this.hasSafeImage;
  }

  /** Dữ liệu thuần gửi lên API - chỉ đúng 3 trường của bảng */
  toJSON() {
    return { id: this.id, tenbanner: this.tenbanner, hinhbanner: this.hinhbanner };
  }

  static from(data) {
    return new Banner(data);
  }
}

/**
 * Dữ liệu mẫu - nguồn sinh db.json (tools/tao-db.js) và dự phòng khi
 * API chưa chạy. Ảnh dùng ảnh thật có sẵn trong thư mục img/ của dự án.
 * Nội dung bám sát các chương trình khuyến mãi của quán: sale theo món
 * (10–35%), mã sinh nhật 25%, ưu đãi khách mới, món mới giảm 10% trong 14 ngày.
 * Banner đầu tiên cố ý KHÔNG dùng img/hero-bar.jpg vì ảnh đó đã là nền hero
 * ngay phía trên slider - tránh hai khung liền nhau trùng ảnh.
 */
export const SEED_BANNERS = [
  {
    id: "b1",
    tenbanner: "Sale 10–35% cocktail đặc tuyển mỗi đêm",
    hinhbanner: "img/lounge/bar-counter.jpg",
  },
  {
    id: "b2",
    tenbanner: "Quà sinh nhật: mã giảm 25% cho thành viên",
    hinhbanner: "img/lounge/vip-sofa.jpg",
  },
  {
    id: "b3",
    tenbanner: "Khách hàng mới giảm ngay 10% đơn đầu tiên",
    hinhbanner: "img/hero-bar.jpg",
  },
  {
    id: "b4",
    tenbanner: "Món mới ra mắt – giảm 10% trong 14 ngày đầu",
    hinhbanner: "img/lounge/dj-stage.jpg",
  },
];

/* ---------------- Kiểm tra dữ liệu trước khi gửi API ---------------- */

/**
 * Kiểm tra dữ liệu banner, trả về chuỗi lỗi tiếng Việt ("" nếu hợp lệ).
 * @param {{tenbanner?: string, hinhbanner?: string}} data
 * @param {{partial?: boolean}} opts partial = true khi sửa: chỉ kiểm tra trường có gửi lên
 */
export function validateBanner(data = {}, { partial = false } = {}) {
  const { tenbanner, hinhbanner } = data;

  if (!partial || tenbanner !== undefined) {
    const name = String(tenbanner ?? "").trim();
    if (!name) return "Tên banner không được bỏ trống";
    if (name.length < BANNER_NAME_MIN) return `Tên banner tối thiểu ${BANNER_NAME_MIN} ký tự`;
    if (name.length > BANNER_NAME_MAX) return `Tên banner tối đa ${BANNER_NAME_MAX} ký tự`;
  }

  if (!partial || hinhbanner !== undefined) {
    const image = String(hinhbanner ?? "").trim();
    if (!image) return "Hãy nhập đường dẫn ảnh hoặc chọn ảnh từ máy";
    if (!isSafeImageSrc(image)) {
      return "Ảnh banner chỉ nhận đường dẫn trong dự án (VD: img/hero-bar.jpg), URL http(s):// hoặc ảnh tải lên từ máy";
    }
    if (getImageSourceKind(image) === "upload" && estimateDataUrlBytes(image) > BANNER_IMAGE_MAX_BYTES) {
      return "Ảnh tải lên vượt quá 400KB";
    }
  }

  return "";
}

/* ---------------- CRUD qua API ---------------- */

/**
 * GET /banners -> Banner[].
 * Máy chủ chưa chạy: getCollection tự trả bản đệm / SEED_BANNERS.
 * Máy chủ chạy nhưng db.json chưa có bảng banners (404): báo rõ cách khắc phục.
 */
export async function getAllBanners() {
  try {
    const list = await getCollection(COLLECTION, SEED_BANNERS);
    return list.map((data) => Banner.from(data));
  } catch (err) {
    if (err.status === 404) {
      throw new Error("Máy chủ chưa có bảng /banners. Hãy tắt server, chạy \"npm run seed\" rồi \"npm start\" lại.", { cause: err });
    }
    throw err;
  }
}

/**
 * POST /banners -> Banner.
 * Luôn dùng bản ghi MÁY CHỦ TRẢ VỀ (json-server 1.x tự sinh id, bỏ qua id gửi lên).
 */
export async function addBanner({ tenbanner, hinhbanner } = {}) {
  const error = validateBanner({ tenbanner, hinhbanner });
  if (error) throw new Error(error);

  const banner = new Banner({ id: uid("banner"), tenbanner, hinhbanner });
  const saved = await api.post(`/${COLLECTION}`, banner.toJSON());
  return Banner.from(saved);
}

/** PATCH /banners/:id -> Banner (chỉ gửi tenbanner / hinhbanner, không cho đổi id) */
export async function updateBanner(id, changes = {}) {
  const body = {};
  if (changes.tenbanner !== undefined) body.tenbanner = String(changes.tenbanner).trim();
  if (changes.hinhbanner !== undefined) body.hinhbanner = String(changes.hinhbanner).trim();

  const error = validateBanner(body, { partial: true });
  if (error) throw new Error(error);

  const saved = await api.patch(`/${COLLECTION}/${encodeURIComponent(id)}`, body);
  return Banner.from(saved);
}

/** DELETE /banners/:id -> true */
export async function deleteBanner(id) {
  await api.delete(`/${COLLECTION}/${encodeURIComponent(id)}`);
  return true;
}

/* ---------------- Tìm kiếm ---------------- */

/** Bỏ dấu tiếng Việt + chữ thường để tìm "giam gia" vẫn ra "Giảm giá" */
function normalizeText(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

/** Lọc danh sách banner có sẵn trong bộ nhớ theo tên (hàm đồng bộ, không gọi API) */
export function filterBanners(banners, keyword = "") {
  const kw = normalizeText(keyword);
  if (!kw) return [...banners];
  return banners.filter((b) => normalizeText(b.tenbanner).includes(kw));
}

/** Tên banner đã tồn tại ở banner khác chưa (không phân biệt hoa/thường, dấu cách thừa) */
export function isBannerNameTaken(banners, tenbanner, exceptId = null) {
  const normalized = String(tenbanner || "").trim().replace(/\s+/g, " ").toLowerCase();
  if (!normalized) return false;
  return banners.some((b) => String(b.id) !== String(exceptId)
    && String(b.tenbanner || "").trim().replace(/\s+/g, " ").toLowerCase() === normalized);
}

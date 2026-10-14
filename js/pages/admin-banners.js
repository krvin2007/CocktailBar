/* =========================================================
   ADMIN-BANNERS.JS - CRUD banner quảng cáo (qua API)
   Bảng banner(id, tenbanner, hinhbanner) theo đề bài.
     Đọc   : GET    /banners
     Thêm  : POST   /banners
     Sửa   : PATCH  /banners/:id
     Xoá   : DELETE /banners/:id
   Ảnh banner nhận 3 dạng: đường dẫn trong dự án, URL http(s),
   hoặc ảnh chọn từ máy (FileReader -> data URL, tối đa 400KB).
   Khung xem trước mô phỏng đúng banner trên slider trang chủ.
   ========================================================= */

import { initAdminLayout } from "../modules/adminLayout.js";
import {
  getAllBanners, addBanner, updateBanner, deleteBanner,
  filterBanners, isBannerNameTaken, validateBanner, isSafeImageSrc, estimateDataUrlBytes,
  BANNER_NAME_MAX, BANNER_IMAGE_MAX_BYTES, BANNER_IMAGE_TYPES,
} from "../modules/bannersService.js";
import { debounce, paginate, renderPagination, escapeHtml } from "../modules/utils.js";
import { validateForm, clearFormErrors, setFieldError } from "../modules/validation.js";
import { toast, confirmDialog, openModal, closeModal, setButtonLoading } from "../modules/ui.js";
import { ICONS } from "../modules/icons.js";

const PER_PAGE = 8;
const MODAL_ID = "banner-modal";

const bodyEl = document.getElementById("banners-body");
const paginationEl = document.getElementById("pagination");
const keywordInput = document.getElementById("f-keyword");
const totalEl = document.getElementById("banner-total");

const formEl = document.getElementById("banner-form");
const modalTitle = document.getElementById("banner-modal-title");
const submitBtn = document.getElementById("banner-form-submit");
const nameInput = document.getElementById("banner-name");
const nameCounter = document.getElementById("banner-name-counter");
const imageInput = document.getElementById("banner-image");
const fileInput = document.getElementById("banner-file");
const fileBtn = document.getElementById("banner-file-btn");
const uploadChip = document.getElementById("banner-upload-chip");
const uploadName = document.getElementById("banner-upload-name");
const uploadClearBtn = document.getElementById("banner-upload-clear");
const previewImg = document.getElementById("banner-preview-img");
const previewTitle = document.getElementById("banner-preview-title");
const previewStatus = document.getElementById("banner-preview-status");

const IMAGE_INPUT_PLACEHOLDER = imageInput.placeholder;

/** Danh sách banner tải từ API - tải lại sau mỗi lần thêm/sửa/xoá */
let allBanners = [];
let currentPage = 1;

/** Ảnh chọn từ máy đang dùng trong form: { dataUrl, name, bytes } hoặc null */
let uploadedImage = null;

/** Trạng thái ảnh xem trước: "empty" | "invalid" | "loading" | "ok" | "error" */
let previewState = "empty";

/* ---------------- Tiện ích nhỏ ---------------- */

/** 409600 -> "400 KB", 900 -> "900 B" */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
}

const KIND_BADGES = {
  path: `<span class="badge badge-success banner-kind">Trong dự án</span>`,
  url: `<span class="badge badge-info banner-kind">URL</span>`,
  upload: `<span class="badge badge-warning banner-kind">Tải lên</span>`,
  invalid: `<span class="badge badge-danger banner-kind">Không hợp lệ</span>`,
};

/* ---------------- Bảng danh sách ---------------- */
function rowHtml(banner) {
  const kind = banner.imageKind;
  const position = allBanners.indexOf(banner) + 1;

  // Ảnh không thuộc 3 dạng an toàn thì KHÔNG đưa vào <img> (chặn javascript:...)
  const thumbHtml = banner.hasSafeImage
    ? `<img src="${escapeHtml(banner.hinhbanner)}" alt="" class="banner-thumb" loading="lazy">`
    : `<div class="banner-thumb-fallback">Ảnh không hợp lệ</div>`;

  const pathText = kind === "upload"
    ? `Ảnh tải từ máy · ${formatBytes(estimateDataUrlBytes(banner.hinhbanner))}`
    : banner.hinhbanner || "—";

  return `
    <tr data-id="${escapeHtml(banner.id)}">
      <td>${thumbHtml}</td>
      <td class="banner-name-cell">
        <strong title="${escapeHtml(banner.tenbanner)}">${escapeHtml(banner.tenbanner)}</strong>
        <div class="text-xs text-muted">Mã ${escapeHtml(banner.id)} · Vị trí ${position} trên slider</div>
      </td>
      <td>
        ${KIND_BADGES[kind] || KIND_BADGES.invalid}
        <span class="banner-path" title="${kind === "upload" ? "" : escapeHtml(banner.hinhbanner)}">${escapeHtml(pathText)}</span>
      </td>
      <td class="cell-actions" style="text-align: right;">
        <button type="button" class="btn btn-ghost btn-sm" data-action="edit"
                aria-label="Sửa banner ${escapeHtml(banner.tenbanner)}">${ICONS.edit(14)} Sửa</button>
        <button type="button" class="btn btn-danger btn-sm" data-action="delete"
                aria-label="Xoá banner ${escapeHtml(banner.tenbanner)}">${ICONS.trash(14)} Xoá</button>
      </td>
    </tr>`;
}

function tableMessage(message) {
  return `<tr><td colspan="4" class="table-empty py-4 text-center text-muted">${message}</td></tr>`;
}

function renderTable() {
  const list = filterBanners(allBanners, keywordInput.value);
  const { items, page, totalPages } = paginate(list, currentPage, PER_PAGE);
  currentPage = page;

  totalEl.textContent = allBanners.length;
  bodyEl.innerHTML = items.length
    ? items.map(rowHtml).join("")
    : tableMessage(allBanners.length
      ? "Không tìm thấy banner nào khớp với từ khoá."
      : "Chưa có banner nào - slider trang chủ đang bị ẩn. Bấm \"Thêm banner mới\" để tạo banner đầu tiên.");

  renderPagination(paginationEl, page, totalPages, (p) => { currentPage = p; renderTable(); });
}

/** Tải lại dữ liệu mới nhất từ máy chủ rồi vẽ lại bảng */
async function reloadTable() {
  try {
    allBanners = await getAllBanners();
    renderTable();
  } catch (err) {
    bodyEl.innerHTML = tableMessage(escapeHtml(err.message));
  }
}

// Ảnh thu nhỏ hỏng (đường dẫn sai, URL chết) -> thay bằng khung báo lỗi.
// Sự kiện "error" của <img> không nổi bọt nên phải bắt ở pha capture.
bodyEl.addEventListener("error", (e) => {
  if (!e.target.matches?.("img.banner-thumb")) return;
  const fallback = document.createElement("div");
  fallback.className = "banner-thumb-fallback";
  fallback.textContent = "Không tải được ảnh";
  e.target.replaceWith(fallback);
}, true);

/* ---------------- Ảnh: đường dẫn / URL hoặc chọn từ máy ---------------- */

/** Nguồn ảnh hiện tại của form: ảnh tải lên được ưu tiên hơn ô đường dẫn */
function currentImageSrc() {
  return uploadedImage ? uploadedImage.dataUrl : imageInput.value.trim();
}

/** Bật/tắt giao diện "đang dùng ảnh tải lên" */
function applyUploadState() {
  const hasUpload = Boolean(uploadedImage);
  uploadChip.hidden = !hasUpload;
  imageInput.disabled = hasUpload;

  if (hasUpload) {
    imageInput.value = "";
    imageInput.placeholder = "Đang dùng ảnh tải lên từ máy - bấm \"Bỏ ảnh tải lên\" để nhập đường dẫn";
    uploadName.textContent = `${uploadedImage.name} · ${formatBytes(uploadedImage.bytes)}`;
    uploadName.title = uploadedImage.name;
  } else {
    imageInput.placeholder = IMAGE_INPUT_PLACEHOLDER;
    uploadName.textContent = "";
  }
}

function setPreviewStatus(state, message) {
  previewState = state;
  previewStatus.textContent = message;
  previewStatus.classList.toggle("is-error", state === "error" || state === "invalid");
  previewStatus.classList.toggle("is-ok", state === "ok");
}

/** Cập nhật khung xem trước theo tên + ảnh đang nhập */
function updatePreview() {
  const name = nameInput.value.trim();
  previewTitle.textContent = name || "Tên banner sẽ hiển thị ở đây";
  previewTitle.classList.toggle("is-placeholder", !name);

  const src = currentImageSrc();
  if (!src) {
    previewImg.hidden = true;
    previewImg.removeAttribute("src");
    setPreviewStatus("empty", "Chưa có ảnh");
    return;
  }
  if (!isSafeImageSrc(src)) {
    previewImg.hidden = true;
    previewImg.removeAttribute("src");
    setPreviewStatus("invalid", "Đường dẫn ảnh không hợp lệ");
    return;
  }
  if (previewImg.getAttribute("src") !== src) {
    setPreviewStatus("loading", "Đang tải ảnh...");
    previewImg.hidden = false;
    previewImg.src = src; // gán bằng thuộc tính DOM, không ghép chuỗi HTML
  }
}

previewImg.addEventListener("load", () => {
  const { naturalWidth: w, naturalHeight: h } = previewImg;
  if (w && w < 800) {
    setPreviewStatus("ok", `Ảnh ${w}×${h}px - hơi nhỏ, có thể bị mờ trên màn hình lớn`);
  } else if (w && h && w / h < 1.4) {
    setPreviewStatus("ok", `Ảnh ${w}×${h}px - ảnh hơi dọc, nên dùng ảnh ngang`);
  } else {
    setPreviewStatus("ok", w ? `Ảnh hiển thị tốt · ${w}×${h}px` : "Ảnh hiển thị tốt");
  }
});

previewImg.addEventListener("error", () => {
  if (!previewImg.getAttribute("src")) return; // vừa xoá src chủ động, không phải lỗi
  previewImg.hidden = true;
  setPreviewStatus("error", "Không tải được ảnh từ đường dẫn này");
});

/** Đọc tệp ảnh thành data URL (FileReader + Promise để dùng được với async/await) */
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error || new Error("Không đọc được tệp")));
    reader.readAsDataURL(file);
  });
}

/** Báo lỗi ảnh ở cả dưới ô nhập lẫn toast (toast chèn HTML nên phải escape tên tệp) */
function reportImageError(message) {
  setFieldError(imageInput, message);
  toast(escapeHtml(message), "error");
}

async function handleFileChosen() {
  const file = fileInput.files?.[0];
  fileInput.value = ""; // cho phép chọn lại đúng tệp đó lần sau
  if (!file) return;

  if (!file.type || !file.type.startsWith("image/")) {
    reportImageError(`Tệp "${file.name}" không phải là ảnh.`);
    return;
  }
  if (!BANNER_IMAGE_TYPES.includes(file.type)) {
    reportImageError("Định dạng ảnh chưa hỗ trợ - chỉ nhận PNG, JPG, GIF, WEBP hoặc SVG.");
    return;
  }
  if (file.size > BANNER_IMAGE_MAX_BYTES) {
    reportImageError(`Ảnh "${file.name}" nặng ${formatBytes(file.size)}, vượt giới hạn ${formatBytes(BANNER_IMAGE_MAX_BYTES)}. Hãy nén ảnh hoặc dùng đường dẫn/URL.`);
    return;
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);
    if (!isSafeImageSrc(dataUrl)) {
      reportImageError("Không đọc được nội dung ảnh, hãy thử tệp khác.");
      return;
    }
    uploadedImage = { dataUrl, name: file.name, bytes: file.size };
    setFieldError(imageInput, "");
    applyUploadState();
    updatePreview();
  } catch {
    reportImageError(`Không đọc được tệp "${file.name}".`);
  }
}

/* ---------------- Mở form thêm / sửa ---------------- */
function updateNameCounter() {
  const length = nameInput.value.trim().length;
  nameCounter.textContent = `${length}/${BANNER_NAME_MAX}`;
  nameCounter.classList.toggle("is-over", length > BANNER_NAME_MAX);
}

function resetForm() {
  formEl.reset();
  clearFormErrors(formEl);
  uploadedImage = null;
  applyUploadState();
}

function openForCreate() {
  resetForm();
  formEl.elements.id.value = "";
  modalTitle.textContent = "Thêm banner mới";
  updateNameCounter();
  updatePreview();
  openModal(MODAL_ID);
  nameInput.focus();
}

function openForEdit(banner) {
  resetForm();
  formEl.elements.id.value = banner.id;
  nameInput.value = banner.tenbanner;

  if (banner.imageKind === "upload") {
    uploadedImage = {
      dataUrl: banner.hinhbanner,
      name: "Ảnh đã tải lên trước đó",
      bytes: estimateDataUrlBytes(banner.hinhbanner),
    };
  } else {
    imageInput.value = banner.hinhbanner;
  }
  applyUploadState();

  modalTitle.textContent = `Chỉnh sửa: ${banner.tenbanner}`;
  updateNameCounter();
  updatePreview();
  openModal(MODAL_ID);
  nameInput.focus();
}

/* ---------------- Xoá ---------------- */
async function handleDelete(banner) {
  const isLast = allBanners.length === 1;
  const ok = await confirmDialog(
    `Xoá banner "${banner.tenbanner}"? Banner sẽ biến mất khỏi slider trang chủ ngay lập tức.`
      + (isLast ? " Đây là banner cuối cùng - slider trang chủ sẽ bị ẩn." : ""),
    { title: "Xác nhận xoá banner", okText: "Xoá banner" },
  );
  if (!ok) return;

  try {
    await deleteBanner(banner.id);
    toast(`Đã xoá banner "${escapeHtml(banner.tenbanner)}".`, "success");
    await reloadTable();
  } catch (err) {
    toast(escapeHtml(err.message), "error");
  }
}

/* ---------------- Lưu (thêm / sửa) ---------------- */
async function handleSubmit(e) {
  e.preventDefault();

  // Tên banner: luật required|min:3|max:80 khai báo bằng data-rule trong HTML
  const { isValid, data } = validateForm(formEl);

  // Ảnh: kiểm tra riêng vì có thể đến từ ô đường dẫn HOẶC tệp tải lên
  const hinhbanner = currentImageSrc();
  const imageError = validateBanner({ hinhbanner }, { partial: true });
  setFieldError(imageInput, imageError);

  if (!isValid) return;
  if (imageError) {
    (imageInput.disabled ? fileBtn : imageInput).focus();
    return;
  }

  const tenbanner = data.tenbanner.replace(/\s+/g, " ");
  if (isBannerNameTaken(allBanners, tenbanner, data.id || null)) {
    setFieldError(nameInput, "Đã có banner khác trùng tên này");
    nameInput.focus();
    return;
  }

  // Ảnh không hiển thị được (đường dẫn sai / URL chết): hỏi lại trước khi lưu
  if (previewState === "error") {
    const keep = await confirmDialog(
      "Ảnh của banner không tải được nên trên trang chủ sẽ chỉ hiện nền thay thế. Bạn vẫn muốn lưu?",
      { title: "Ảnh banner chưa hiển thị được", okText: "Vẫn lưu", danger: false },
    );
    if (!keep) return;
  }

  const restoreButton = setButtonLoading(submitBtn, "Đang lưu...");
  try {
    if (data.id) {
      await updateBanner(data.id, { tenbanner, hinhbanner });
      toast(`Đã cập nhật banner "${escapeHtml(tenbanner)}".`, "success");
    } else {
      await addBanner({ tenbanner, hinhbanner });
      toast(`Đã thêm banner "${escapeHtml(tenbanner)}" vào slider trang chủ.`, "success");
    }
    closeModal(MODAL_ID);
    await reloadTable();
  } catch (err) {
    toast(escapeHtml(err.message), "error");
  } finally {
    restoreButton();
  }
}

/* ---------------- Gắn sự kiện ---------------- */
function bindEvents() {
  const debouncedRender = debounce(() => { currentPage = 1; renderTable(); }, 250);
  keywordInput.addEventListener("input", debouncedRender);

  bodyEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const banner = allBanners.find((b) => String(b.id) === btn.closest("tr").dataset.id);
    if (!banner) return;

    if (btn.dataset.action === "edit") openForEdit(banner);
    if (btn.dataset.action === "delete") handleDelete(banner);
  });

  document.getElementById("add-banner-btn").addEventListener("click", openForCreate);
  document.getElementById("banner-modal-close").addEventListener("click", () => closeModal(MODAL_ID));
  document.getElementById("banner-form-cancel").addEventListener("click", () => closeModal(MODAL_ID));

  nameInput.addEventListener("input", () => {
    updateNameCounter();
    updatePreview();
  });

  const debouncedPreview = debounce(updatePreview, 300);
  imageInput.addEventListener("input", () => {
    setFieldError(imageInput, "");
    debouncedPreview();
  });

  fileBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", handleFileChosen);

  uploadClearBtn.addEventListener("click", () => {
    uploadedImage = null;
    applyUploadState();
    updatePreview();
    imageInput.focus();
  });

  formEl.addEventListener("submit", handleSubmit);
}

// Chưa đăng nhập -> initAdminLayout chuyển hướng và trả false: dừng, không gọi API
if (initAdminLayout("Quản Lý Banner")) {
  bindEvents();
  bodyEl.innerHTML = tableMessage("Đang tải danh sách banner từ máy chủ...");
  reloadTable();
}

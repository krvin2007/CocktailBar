/* =========================================================
   PORTRAIT.JS - Ảnh đại diện cho thẻ nhân vật (Bartenders, Nhà sưu tầm)

   Nguyên tắc: ảnh nào cũng ghi rõ loại ngay trên thẻ để người xem không
   nhầm ảnh do AI tạo với ảnh thật của nhân vật. Các loại ảnh:
     - "archival"     : ảnh tư liệu đúng là người đó
     - "portrait"     : chân dung minh hoạ do AI tạo - KHÔNG phải ảnh thật,
                        khuôn mặt không phải của nhân vật
     - "illustration" : ảnh minh hoạ không có người (ly rượu, quầy bar...)
     - không có ảnh   : hiện khung chữ cái đầu tên (monogram)
   ========================================================= */

import { escapeHtml } from "./utils.js";

const IMAGE_LABELS = {
  archival: "Ảnh tư liệu",
  illustration: "Ảnh minh hoạ",
  portrait: "Chân dung minh hoạ (AI)",
};

/** "Salvatore Calabrese" -> "SC", "Michel-Jack Chasseuil" -> "MC" */
export function initialsOf(name = "") {
  const words = name.replace(/[“”"()]/g, " ").split(/[\s-]+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** HTML phần ảnh đại diện của một thẻ nhân vật */
export function portraitHtml(item) {
  if (item.image) {
    const label = IMAGE_LABELS[item.imageType] || IMAGE_LABELS.illustration;
    return `
      <img src="${escapeHtml(item.image)}" alt="${escapeHtml(label)} - ${escapeHtml(item.name)}"
           class="legend-portrait-img" loading="lazy">
      <span class="legend-image-label">${label}</span>`;
  }

  return `
    <div class="legend-monogram" role="img" aria-label="${escapeHtml(item.name)} (chưa có ảnh chân dung)">
      <span class="legend-monogram-initials">${escapeHtml(initialsOf(item.name))}</span>
    </div>
    <span class="legend-image-label">Chưa có ảnh chân dung được phép sử dụng</span>`;
}

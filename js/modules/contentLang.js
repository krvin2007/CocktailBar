/* =========================================================
   CONTENTLANG.JS - Chọn bản dịch nội dung (Hầm rượu, Bartenders, Nhà sưu tầm)
   Dữ liệu gốc (db.json / *Data.js) viết bằng tiếng Việt. Bản tiếng Anh nằm ở
   các "lớp phủ" (*En.js): object theo id, cùng khoá + cùng thứ tự mảng với
   bản gốc nhưng chỉ chứa phần chữ cần dịch. Khi chọn EN, lớp phủ được ghép
   đè lên bản gốc; trường nào lớp phủ không có thì giữ nguyên bản gốc.
   ========================================================= */

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Ghép lớp phủ lên bản gốc:
 * - mảng: ghép theo CHỈ SỐ (phần tử nào lớp phủ không có thì giữ bản gốc)
 * - object: ghép từng khoá
 * - còn lại: lớp phủ thắng
 */
export function mergeLocalized(base, overlay) {
  if (overlay === undefined) return base;
  if (Array.isArray(base) && Array.isArray(overlay)) {
    return base.map((item, index) => mergeLocalized(item, overlay[index]));
  }
  if (isPlainObject(base) && isPlainObject(overlay)) {
    const merged = { ...base };
    for (const key of Object.keys(overlay)) merged[key] = mergeLocalized(base[key], overlay[key]);
    return merged;
  }
  return overlay;
}

/** Bản của một mục theo ngôn ngữ: "vi" hoặc chưa có bản dịch thì trả nguyên bản gốc */
export function localizeItem(item, overlayById, lang) {
  if (lang !== "en" || !overlayById) return item;
  return mergeLocalized(item, overlayById[item.id]);
}

/** Bản của một bảng nhãn đơn giản (VD danh mục) theo ngôn ngữ */
export function localizeLabels(labels, overlay, lang) {
  return lang === "en" && overlay ? { ...labels, ...overlay } : labels;
}

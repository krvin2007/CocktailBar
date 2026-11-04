/* =========================================================
   FAVORITES-SERVICE.JS - Quản lý danh sách Cocktail yêu thích
   Cho phép khách hàng thả tim ❤️ lưu món yêu thích,
   lọc danh sách yêu thích và đồng bộ theo thời gian thực.
   ========================================================= */

import { getItem, setItem } from "./storage.js";
import { getCurrentCustomer } from "./customerAuth.js";

const STORAGE_KEY = "quanbar_favorites";

/** Lấy storage key riêng theo từng khách hàng (nếu đăng nhập) hoặc dùng chung cho khách vãng lai */
function getStorageKey() {
  const customer = getCurrentCustomer();
  return customer ? `${STORAGE_KEY}_${customer.id}` : STORAGE_KEY;
}

/** Lấy danh sách ID các món yêu thích */
export function getFavoriteIds() {
  return getItem(getStorageKey(), []);
}

/** Kiểm tra một món có nằm trong danh sách yêu thích không */
export function isFavorite(drinkId) {
  if (!drinkId) return false;
  const ids = getFavoriteIds();
  return ids.includes(String(drinkId));
}

/** Bật / Tắt trạng thái yêu thích của một món */
export function toggleFavorite(drinkId) {
  if (!drinkId) return false;
  const strId = String(drinkId);
  const ids = getFavoriteIds();
  const index = ids.indexOf(strId);
  let favorited;

  if (index === -1) {
    ids.push(strId);
    favorited = true;
  } else {
    ids.splice(index, 1);
    favorited = false;
  }

  setItem(getStorageKey(), ids);

  if (typeof globalThis.dispatchEvent === "function" && typeof CustomEvent === "function") {
    globalThis.dispatchEvent(new CustomEvent("favorites-change", {
      detail: { drinkId: strId, isFavorite: favorited, total: ids.length },
    }));
  }

  return favorited;
}

/** Lấy tổng số món yêu thích */
export function getFavoriteCount() {
  return getFavoriteIds().length;
}

/** Lấy danh sách đầy đủ các đối tượng món yêu thích từ mảng drinks truyền vào */
export function getFavoriteDrinks(drinksList = []) {
  const ids = new Set(getFavoriteIds());
  return drinksList.filter((d) => ids.has(String(d.id)));
}

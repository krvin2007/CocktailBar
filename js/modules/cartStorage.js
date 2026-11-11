/* =========================================================
   CART-STORAGE.JS - Lưu trữ & gộp giỏ hàng theo khách / khách vãng lai
   Tách riêng khỏi ordersService và customerAuth để tránh import vòng.
   ========================================================= */

import { getItem, setItem, removeItem } from "./storage.js";

const GUEST_CART_KEY = "cart";

/** Khóa lưu giỏ hàng riêng cho từng tài khoản khách hàng, hoặc giỏ tạm cho khách chưa đăng nhập */
export function cartKeyFor(customerId = "") {
  const cleanId = String(customerId || "").trim();
  return cleanId ? `cart_${cleanId}` : GUEST_CART_KEY;
}

export function readCartByCustomer(customerId = "") {
  const raw = getItem(cartKeyFor(customerId), []);
  return Array.isArray(raw) ? raw : [];
}

export function writeCartByCustomer(cart, customerId = "") {
  const normalized = Array.isArray(cart) ? cart : [];
  setItem(cartKeyFor(customerId), normalized);
  return normalized;
}

/**
 * Đưa toàn bộ món trong giỏ tạm (chọn lúc chưa đăng nhập) vào giỏ hàng
 * của khách hàng vừa đăng nhập / vừa đăng ký, rồi dọn giỏ tạm.
 */
export function mergeGuestCartIntoCustomer(customerId) {
  const cleanId = String(customerId || "").trim();
  if (!cleanId) return [];

  const guestCart = readCartByCustomer("");
  if (guestCart.length === 0) {
    return readCartByCustomer(cleanId);
  }

  const customerCart = readCartByCustomer(cleanId).map((item) => ({ ...item }));
  for (const guestItem of guestCart) {
    if (!guestItem || !guestItem.drinkId) continue;
    const qty = Math.max(1, Number(guestItem.qty) || 1);
    const existingIndex = customerCart.findIndex((item) => item.drinkId === guestItem.drinkId);
    if (existingIndex !== -1) {
      const existing = customerCart[existingIndex];
      customerCart[existingIndex] = {
        ...existing,
        name: guestItem.name || existing.name,
        price: Number.isFinite(Number(guestItem.price)) ? Number(guestItem.price) : existing.price,
        image: guestItem.image !== undefined ? guestItem.image : existing.image,
        qty: (Number(existing.qty) || 0) + qty,
      };
    } else {
      customerCart.push({ ...guestItem, qty });
    }
  }

  writeCartByCustomer(customerCart, cleanId);
  removeItem(GUEST_CART_KEY);
  return customerCart;
}


/* =========================================================
   VOUCHERSSERVICE.JS - Mã giảm giá (CRUD qua API /vouchers + kiểm tra điều kiện)
   Một mã có: loại (percent = giảm %, amount = giảm số tiền), giá trị, trần giảm (với %),
   đơn tối thiểu, hạn dùng, giới hạn lượt dùng (0 = không giới hạn), bật/tắt.
   Luật dùng mã (checkVoucher): còn hiệu lực, chưa hết hạn, còn lượt, đủ đơn tối thiểu,
   và MỖI SỐ ĐIỆN THOẠI chỉ dùng một mã một lần (trừ đơn đã huỷ).
   Hàm kiểm tra là hàm thuần (nhận sẵn danh sách đơn) nên dễ kiểm thử.
   ========================================================= */

import { api, getCollection } from "./api.js";
import { normalizePhone } from "./utils.js";

const COLLECTION = "vouchers";

export const VOUCHER_TYPES = {
  percent: "Giảm theo %",
  amount: "Giảm số tiền",
};

/** 23:59 của ngày cách hôm nay n ngày (ISO) - mốc hết hạn cho dữ liệu mẫu */
function endOfDayIn(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

/** Mã mẫu - nguồn sinh db.json và dự phòng khi máy chủ chưa chạy */
export const SEED_VOUCHERS = [
  {
    id: "v1", code: "WELCOME10", description: "Chào bạn mới: giảm 10% (tối đa 100.000đ) cho đơn từ 200.000đ",
    type: "percent", value: 10, maxDiscount: 100000, minOrder: 200000,
    expiresAt: endOfDayIn(90), usageLimit: 0, usedCount: 0, active: true,
  },
  {
    id: "v2", code: "GIAM50K", description: "Giảm thẳng 50.000đ cho đơn từ 300.000đ (100 lượt đầu)",
    type: "amount", value: 50000, maxDiscount: 0, minOrder: 300000,
    expiresAt: endOfDayIn(60), usageLimit: 100, usedCount: 0, active: true,
  },
  {
    id: "v3", code: "HAPPYNIGHT", description: "Đêm vui: giảm 15% (tối đa 150.000đ) cho đơn từ 400.000đ",
    type: "percent", value: 15, maxDiscount: 150000, minOrder: 400000,
    expiresAt: endOfDayIn(30), usageLimit: 0, usedCount: 0, active: true,
  },
];

/** "  welcome10 " -> "WELCOME10" */
export const normalizeVoucherCode = (code) => String(code || "").trim().toUpperCase();

/* ---------------- CRUD ---------------- */

export async function getAllVouchers() {
  return getCollection(COLLECTION, SEED_VOUCHERS);
}

/** Tìm mã theo chuỗi khách nhập (không phân biệt hoa/thường), không thấy thì null */
export async function findVoucherByCode(code) {
  const wanted = normalizeVoucherCode(code);
  if (!wanted) return null;
  return (await getAllVouchers()).find((v) => normalizeVoucherCode(v.code) === wanted) || null;
}

/** Chuẩn hoá + kiểm tra dữ liệu mã trước khi lưu; sai thì ném lỗi có câu giải thích */
export function validateVoucherData(data, others = []) {
  const code = normalizeVoucherCode(data.code);
  if (!/^[A-Z0-9_-]{3,20}$/.test(code)) throw new Error("Mã gồm 3-20 ký tự: chữ không dấu, số, gạch ngang hoặc gạch dưới.");
  if (others.some((v) => normalizeVoucherCode(v.code) === code && v.id !== data.id)) throw new Error(`Mã "${code}" đã tồn tại.`);
  if (!Object.hasOwn(VOUCHER_TYPES, data.type)) throw new Error("Loại mã không hợp lệ.");

  const value = Number(data.value);
  if (!Number.isFinite(value) || value <= 0) throw new Error("Giá trị giảm phải lớn hơn 0.");
  if (data.type === "percent" && value > 100) throw new Error("Giảm theo % tối đa 100%.");

  const nonNegInt = (n, label) => {
    const v = Number(n || 0);
    if (!Number.isInteger(v) || v < 0) throw new Error(`${label} phải là số nguyên không âm.`);
    return v;
  };
  const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new Error("Hạn dùng không hợp lệ.");

  return {
    code,
    description: String(data.description || "").trim(),
    type: data.type,
    value,
    maxDiscount: nonNegInt(data.maxDiscount, "Trần giảm"),
    minOrder: nonNegInt(data.minOrder, "Đơn tối thiểu"),
    expiresAt: expiresAt ? expiresAt.toISOString() : "",
    usageLimit: nonNegInt(data.usageLimit, "Giới hạn lượt dùng"),
    usedCount: nonNegInt(data.usedCount, "Số lượt đã dùng"),
    active: data.active !== false,
  };
}

export async function addVoucher(data) {
  const clean = validateVoucherData(data, await getAllVouchers());
  return api.post(`/${COLLECTION}`, { ...clean, usedCount: 0 });
}

export async function updateVoucher(id, data) {
  const clean = validateVoucherData({ ...data, id }, await getAllVouchers());
  return api.patch(`/${COLLECTION}/${encodeURIComponent(id)}`, clean);
}

export async function deleteVoucher(id) {
  await api.delete(`/${COLLECTION}/${encodeURIComponent(id)}`);
  return true;
}

/** Cộng/trừ số lượt đã dùng (đặt đơn +1, huỷ đơn -1); không xuống dưới 0 */
export async function adjustVoucherUsage(id, delta) {
  const voucher = await api.get(`/${COLLECTION}/${encodeURIComponent(id)}`);
  const usedCount = Math.max(0, (Number(voucher.usedCount) || 0) + delta);
  return api.patch(`/${COLLECTION}/${encodeURIComponent(id)}`, { usedCount });
}

/* ---------------- Kiểm tra điều kiện ---------------- */

/**
 * Mã này có dùng được cho đơn không, và giảm bao nhiêu.
 * @param {object} voucher
 * @param {{subtotal: number, remaining: number, phone: string, orders: object[], now?: number}} ctx
 *   subtotal = tạm tính gốc (so với đơn tối thiểu); remaining = số tiền còn lại sau giảm hạng (để tính %)
 * @returns {{ok: boolean, reason?: string, amount?: number}}
 */
export function checkVoucher(voucher, { subtotal, remaining, phone, orders = [], now = Date.now() }) {
  if (!voucher || voucher.active === false) return { ok: false, reason: "Mã giảm giá không còn hiệu lực." };
  if (voucher.expiresAt && new Date(voucher.expiresAt).getTime() < now) return { ok: false, reason: "Mã giảm giá đã hết hạn." };

  const limit = Number(voucher.usageLimit) || 0;
  if (limit > 0 && (Number(voucher.usedCount) || 0) >= limit) return { ok: false, reason: "Mã giảm giá đã hết lượt sử dụng." };

  const minOrder = Number(voucher.minOrder) || 0;
  if (subtotal < minOrder) return { ok: false, reason: `Mã chỉ áp dụng cho đơn từ ${minOrder.toLocaleString("vi-VN")}đ.` };

  const wantedPhone = normalizePhone(phone);
  const code = normalizeVoucherCode(voucher.code);
  const usedBefore = wantedPhone && orders.some((o) => normalizeVoucherCode(o.voucherCode) === code
    && o.status !== "cancelled" && normalizePhone(o.phone) === wantedPhone);
  if (usedBefore) return { ok: false, reason: "Số điện thoại này đã dùng mã này rồi (mỗi số chỉ dùng một lần)." };

  let amount = voucher.type === "percent"
    ? Math.floor((remaining * Number(voucher.value)) / 100)
    : Number(voucher.value);
  const cap = Number(voucher.maxDiscount) || 0;
  if (voucher.type === "percent" && cap > 0) amount = Math.min(amount, cap);
  amount = Math.max(0, Math.min(amount, remaining));
  return { ok: true, amount };
}

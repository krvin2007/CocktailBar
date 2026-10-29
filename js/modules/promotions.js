/* =========================================================
   PROMOTIONS.JS - Tính giá đơn hàng có ưu đãi (không đụng DOM)
   Thứ tự áp dụng (mỗi bước tính trên số tiền CÒN LẠI của bước trước):
     1. Giảm theo HẠNG thành viên (chỉ khi khách đã đăng nhập)
     2. Mã giảm giá (voucher) - tối đa một mã mỗi đơn
     3. Đổi ĐIỂM thành tiền - 1 điểm = POINT_REDEEM_VND, tối đa MAX_POINT_REDEEM_SHARE
        giá trị còn lại (không cho đơn về 0đ chỉ bằng điểm)
   Tổng giảm không bao giờ vượt tổng tiền. Mọi con số là SỐ NGUYÊN (đồng).
   ========================================================= */

import { api } from "./api.js";
import { rankForPoints, lifetimeOf } from "./customerAuth.js";
import { findVoucherByCode, checkVoucher, normalizeVoucherCode } from "./vouchersService.js";

/** 1 điểm = 500đ khi đổi (đối chiếu: tích 1 điểm / 10.000đ chi tiêu -> hoàn lại 5%) */
export const POINT_REDEEM_VND = 500;
/** Mỗi lần đổi tối thiểu bấy nhiêu điểm */
export const MIN_POINT_REDEEM = 20;
/** Điểm chỉ trả được tối đa bấy nhiêu phần giá trị còn lại của đơn */
export const MAX_POINT_REDEEM_SHARE = 0.5;

/** Số điểm tối đa khách được dùng cho đơn còn "remaining" đồng (theo số dư và trần 50%) */
export function maxRedeemablePoints(balance, remaining) {
  const byShare = Math.floor((Math.max(0, remaining) * MAX_POINT_REDEEM_SHARE) / POINT_REDEEM_VND);
  return Math.max(0, Math.min(Math.floor(Number(balance) || 0), byShare));
}

/** Hồ sơ khách theo id, 404 -> null (khách bị xoá thì coi như vãng lai) */
async function fetchCustomer(customerId) {
  if (!customerId) return null;
  try {
    return await api.get(`/customers/${encodeURIComponent(customerId)}`);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

/**
 * Tính giá đơn hàng.
 * @param {object} input
 * @param {number} input.subtotal   tổng tiền các món (chưa giảm)
 * @param {string} [input.customerId] khách đã đăng nhập (có thì được giảm hạng + đổi điểm)
 * @param {string} [input.voucherCode]
 * @param {number} [input.pointsToUse]
 * @param {string} [input.phone]    số điện thoại đặt (kiểm tra mã dùng một lần/số)
 * @param {object[]} [input.orders] danh sách đơn hiện có (kiểm tra mã đã dùng chưa)
 * @param {boolean} [input.strict]  true -> ném lỗi nếu mã/điểm không hợp lệ (dùng khi chốt đơn);
 *                                  false -> trả lỗi trong kết quả để giao diện hiện cho khách xem
 * @returns {Promise<{subtotal, discounts, total, pointsUsed, voucherCode, voucherId, customer, voucherError, pointsError, maxPoints}>}
 */
export async function resolvePricing({ subtotal, customerId = "", voucherCode = "", pointsToUse = 0, phone = "", orders = [], strict = false }) {
  const base = Math.max(0, Math.round(Number(subtotal) || 0));
  const customer = await fetchCustomer(customerId);
  const discounts = [];
  let remaining = base;
  let voucherError = "";
  let pointsError = "";
  let voucherId = "";
  let appliedCode = "";
  let pointsUsed = 0;

  if (base > 0) {
    // 1. Hạng thành viên hoặc Chiết khấu riêng do Admin cấp
    if (customer) {
      const adminDiscount = Number(customer.customDiscount) || 0;
      const rank = rankForPoints(lifetimeOf(customer));
      const rankDiscount = Number(rank.discountPercent) || 0;
      const effectivePercent = Math.max(adminDiscount, rankDiscount);

      if (effectivePercent > 0) {
        const amount = Math.floor((base * effectivePercent) / 100);
        const label = adminDiscount > rankDiscount
          ? `Ưu đãi riêng (Admin giảm ${adminDiscount}%)`
          : `${rank.label} -${rankDiscount}%`;
        discounts.push({ type: "rank", label, percent: effectivePercent, amount });
        remaining -= amount;
      }
    }

  }

  // 2. Mã giảm giá
  const code = normalizeVoucherCode(voucherCode);
  if (code) {
    const voucher = await findVoucherByCode(code);
    if (!voucher) {
      voucherError = "Mã giảm giá không tồn tại.";
    } else if (base <= 0) {
      voucherError = "Giỏ hàng chưa có món nào để áp mã giảm giá.";
    } else {
      const check = checkVoucher(voucher, { subtotal: base, remaining, phone, orders });
      if (!check.ok) {
        voucherError = check.reason;
      } else {
        discounts.push({ type: "voucher", label: `Mã ${voucher.code}`, code: voucher.code, amount: check.amount });
        remaining -= check.amount;
        voucherId = voucher.id;
        appliedCode = voucher.code;
      }
    }
  }

  // 3. Đổi điểm
  const wanted = Math.floor(Number(pointsToUse) || 0);
  const maxPoints = customer ? maxRedeemablePoints(customer.points, remaining) : 0;
  if (wanted > 0) {
    if (!customer) pointsError = "Vui lòng đăng nhập để dùng điểm thưởng.";
    else if (wanted > (Number(customer.points) || 0)) pointsError = `Bạn chỉ có ${customer.points || 0} điểm.`;
    else if (wanted < MIN_POINT_REDEEM) pointsError = `Mỗi lần dùng tối thiểu ${MIN_POINT_REDEEM} điểm.`;
    else if (wanted > maxPoints) pointsError = `Đơn này dùng tối đa ${maxPoints} điểm (tối đa ${MAX_POINT_REDEEM_SHARE * 100}% giá trị đơn).`;
    else {
      const amount = wanted * POINT_REDEEM_VND;
      discounts.push({ type: "points", label: `Dùng ${wanted} điểm`, points: wanted, amount });
      remaining -= amount;
      pointsUsed = wanted;
    }
  }

  if (strict && (voucherError || pointsError)) throw new Error(voucherError || pointsError);

  return {
    subtotal: base,
    discounts,
    total: Math.max(0, remaining),
    pointsUsed,
    voucherCode: appliedCode,
    voucherId,
    customer,
    voucherError,
    pointsError,
    maxPoints,
  };
}

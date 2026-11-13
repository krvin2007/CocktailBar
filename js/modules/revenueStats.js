/* =========================================================
   REVENUESTATS.JS - Doanh thu theo NGÀY / THÁNG / QUÝ / NĂM
   - Doanh thu thực thu = đơn thu đủ (paid) chưa huỷ + tiền cọc 70% giữ lại của đơn huỷ (khách mất cọc, kể cả đơn đã thu đủ)
     + phần cọc của đơn đã phục vụ nhưng quán chưa bấm "Thu nốt 30%". Cọc của đơn còn hiệu lực chỉ là "cọc đang giữ", chưa tính doanh thu.
   - Mỗi đơn tính vào NGÀY KINH DOANH của giờ phục vụ (đặt bàn = giờ hẹn; chốt ngày 06:00 sáng - venue.js),
     rồi gom lên tháng / quý / năm theo ngày kinh doanh đó. Hàm thuần (không đụng DOM) để dễ kiểm thử.
   ========================================================= */

import { businessDayKey, calcPrepayAmount } from "./venue.js";

export const PERIOD_KINDS = ["day", "month", "quarter", "year"];

/** Số kỳ hiển thị trong bảng chi tiết cho từng loại */
export const PERIOD_COUNTS = { day: 30, month: 12, quarter: 8, year: 5 };

export const PERIOD_NAMES = { day: "Ngày", month: "Tháng", quarter: "Quý", year: "Năm" };

const pad = (n) => String(n).padStart(2, "0");

/** Đơn thu đủ 100% và chưa huỷ */
export const isCollected = (o) => o.paymentStatus === "paid" && o.status !== "cancelled";

/** Tiền cọc 70% của đơn đã nhận cọc (0 nếu đơn không ở trạng thái cọc) */
export const depositOf = (o) => (o.paymentStatus === "deposit" ? calcPrepayAmount(Number(o.total) || 0) : 0);

/** Cọc 70% bị giữ lại vì khách huỷ đơn đã cọc / đã thu đủ (mất cọc); 0 nếu không thuộc trường hợp đó */
export const forfeitOf = (o) => ((o.paymentStatus === "deposit" || o.paymentStatus === "paid") && o.status === "cancelled"
  ? calcPrepayAmount(Number(o.total) || 0) : 0);

export const isForfeited = (o) => forfeitOf(o) > 0;

/** Cọc đang giữ cho đơn còn hiệu lực (chưa phục vụ xong, chưa huỷ) - chưa phải doanh thu */
export const depositHeldOf = (o) => (o.paymentStatus === "deposit" && o.status !== "cancelled" && o.status !== "completed" ? depositOf(o) : 0);

/**
 * Số tiền ghi vào doanh thu của một đơn:
 * - thu đủ & chưa huỷ: cả tổng đơn
 * - đã cọc / đã thu đủ mà bị huỷ (mất cọc): phần cọc 70% (đơn thu đủ huỷ được hoàn 30% còn lại)
 * - đã cọc & hoàn tất (chưa thu nốt 30%): phần cọc 70%
 * - còn lại: 0
 */
export function revenueOf(o) {
  if (isCollected(o)) return Number(o.total) || 0;
  if (o.paymentStatus === "deposit" && o.status === "completed") return depositOf(o);
  return forfeitOf(o);
}

/** Khoá kỳ từ ngày kinh doanh "YYYY-MM-DD": day -> chính nó, month -> "YYYY-MM", quarter -> "YYYY-Qn", year -> "YYYY" */
export function periodKeyOf(kind, dayKey) {
  const [y, m] = dayKey.split("-").map(Number);
  if (kind === "day") return dayKey;
  if (kind === "month") return `${y}-${pad(m)}`;
  if (kind === "quarter") return `${y}-Q${Math.ceil(m / 3)}`;
  return String(y);
}

/** Nhãn dễ đọc của một kỳ */
export function periodLabel(kind, key) {
  if (kind === "day") {
    const [y, m, d] = key.split("-").map(Number);
    const weekday = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"][new Date(y, m - 1, d, 12).getDay()];
    return `${pad(d)}/${pad(m)}/${y} (${weekday})`;
  }
  if (kind === "month") { const [y, m] = key.split("-"); return `Tháng ${m}/${y}`; }
  if (kind === "quarter") { const [y, q] = key.split("-Q"); return `Quý ${q}/${y}`; }
  return `Năm ${key}`;
}

/** Khoá kỳ liền TRƯỚC / SAU `step` kỳ (step âm = lùi) */
export function shiftPeriod(kind, key, step) {
  if (kind === "day") {
    const [y, m, d] = key.split("-").map(Number);
    const dt = new Date(y, m - 1, d + step, 12);
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  }
  if (kind === "month") {
    const [y, m] = key.split("-").map(Number);
    const dt = new Date(y, m - 1 + step, 1, 12);
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
  }
  if (kind === "quarter") {
    const [y, q] = key.split("-Q").map(Number);
    const idx = y * 4 + (q - 1) + step;
    return `${Math.floor(idx / 4)}-Q${(idx % 4) + 1}`;
  }
  return String(Number(key) + step);
}

/** Phần trăm thay đổi so với kỳ trước: null khi kỳ trước = 0 */
export function percentChange(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Gom doanh thu + số đơn thực thu theo khoá của từng loại kỳ */
export function aggregateRevenue(orders) {
  const maps = Object.fromEntries(PERIOD_KINDS.map((k) => [k, new Map()]));
  for (const o of orders) {
    const amount = revenueOf(o);
    if (amount <= 0) continue;
    const dayKey = businessDayKey(o.serviceTime || o.createdAt);
    for (const kind of PERIOD_KINDS) {
      const key = periodKeyOf(kind, dayKey);
      const cur = maps[kind].get(key) || { revenue: 0, orders: 0 };
      cur.revenue += amount;
      if (!isForfeited(o)) cur.orders += 1; // cọc bị giữ lại có doanh thu nhưng không phải đơn đã phục vụ
      maps[kind].set(key, cur);
    }
  }
  return maps;
}

/** Bốn thẻ tổng: kỳ hiện tại của từng loại + so sánh kỳ liền trước */
export function buildRevenueSummary(orders, now = new Date()) {
  const maps = aggregateRevenue(orders);
  const today = businessDayKey(now);
  return PERIOD_KINDS.map((kind) => {
    const key = periodKeyOf(kind, today);
    const prevKey = shiftPeriod(kind, key, -1);
    const cur = maps[kind].get(key) || { revenue: 0, orders: 0 };
    const prev = maps[kind].get(prevKey) || { revenue: 0, orders: 0 };
    return { kind, key, label: periodLabel(kind, key), revenue: cur.revenue, orders: cur.orders,
      prevKey, prevLabel: periodLabel(kind, prevKey), prevRevenue: prev.revenue, change: percentChange(cur.revenue, prev.revenue) };
  });
}

/** Chuỗi các kỳ gần nhất (mới nhất đứng đầu) cho bảng chi tiết */
export function buildPeriodSeries(orders, kind, now = new Date(), count = PERIOD_COUNTS[kind]) {
  const maps = aggregateRevenue(orders);
  const currentKey = periodKeyOf(kind, businessDayKey(now));
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const key = shiftPeriod(kind, currentKey, -i);
    const prevKey = shiftPeriod(kind, key, -1);
    const cur = maps[kind].get(key) || { revenue: 0, orders: 0 };
    const prev = maps[kind].get(prevKey) || { revenue: 0, orders: 0 };
    rows.push({ key, label: periodLabel(kind, key), revenue: cur.revenue, orders: cur.orders, change: percentChange(cur.revenue, prev.revenue), isCurrent: i === 0 });
  }
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalOrders = rows.reduce((s, r) => s + r.orders, 0);
  return { kind, rows, totalRevenue, totalOrders, maxRevenue: Math.max(...rows.map((r) => r.revenue), 0) };
}

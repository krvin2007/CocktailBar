/* =========================================================
   NOTIFICATION-SERVICE.JS - Thông báo thời gian thực khi đơn hàng thay đổi
   Tự động theo dõi trạng thái đơn hàng của khách và đơn mới của quán:
   - Phát âm thanh chuông dịu nhẹ (Web Audio API Chime)
   - Hiển thị Toast thông báo trạng thái mới (Đang pha chế, Hoàn tất, Đã thanh toán)
   - Hỗ trợ thông báo đơn mới cho Ban Quản trị / Bartender
   ========================================================= */

import { api } from "./api.js";
import { getCurrentCustomer } from "./customerAuth.js";
import { currentAdmin } from "./auth.js";
import { toast } from "./ui.js";
import { getItem, setItem } from "./storage.js";

const LAST_ORDER_STATES_KEY = "quanbar_tracked_order_states";
const KNOWN_ORDER_IDS_KEY = "quanbar_staff_known_order_ids";
/** Sự kiện phát ra (trên window) khi danh sách đơn trên máy chủ thay đổi - dành cho nhân viên đang mở trang */
export const ORDERS_CHANGED_EVENT = "orders-changed";
let lastOrdersSignature = null;
let pollingTimer = null;

/** Phát âm thanh chuông thông báo dịu nhẹ bằng Web Audio API (không cần tải file ngoài) */
export function playNotificationSound() {
  try {
    const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Âm 1 (D5 - 587.33Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    // Âm 2 (A5 - 880Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.15, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.6);
  } catch {
    // Trình duyệt chặn autoplay khi người dùng chưa tương tác
  }
}

/** Trạng thái đơn hàng lưu cache để so sánh */
function getTrackedStates() {
  return getItem(LAST_ORDER_STATES_KEY, {});
}

function saveTrackedStates(states) {
  setItem(LAST_ORDER_STATES_KEY, states);
}

/** Kiểm tra và thông báo thay đổi đơn hàng */
export async function checkOrderUpdates() {
  const customer = getCurrentCustomer();
  const staff = currentAdmin();
  if (!customer && !staff) return;

  try {
    const orders = await api.get("/orders");
    if (!Array.isArray(orders)) return;

    const tracked = getTrackedStates();
    let hasChanges = false;

    // 1. Phía Khách hàng: Theo dõi đơn của chính mình
    if (customer) {
      const myOrders = orders.filter((o) => (o.customerId && String(o.customerId) === String(customer.id)) || (o.phone && o.phone === customer.phone));
      for (const order of myOrders) {
        const prev = tracked[order.id];
        const currentSignature = `${order.status}|${order.paymentStatus}`;

        if (prev && prev !== currentSignature) {
          const [prevStatus, prevPayment] = prev.split("|");
          // Báo trạng thái pha chế / hoàn tất
          if (order.status !== prevStatus) {
            if (order.status === "preparing") {
              toast(`🍸 Đơn hàng ${order.code} đang được Bartender bắt đầu pha chế!`, "info");
              playNotificationSound();
            } else if (order.status === "completed") {
              toast(`✨ Đơn hàng ${order.code} đã hoàn tất! Chúc quý khách thưởng thức ngon miệng.`, "success");
              playNotificationSound();
            } else if (order.status === "cancelled") {
              toast(`Đơn hàng ${order.code} đã được ghi nhận huỷ.`, "warning");
            }
          }

          // Báo trạng thái thanh toán
          if (order.paymentStatus !== prevPayment && order.paymentStatus === "paid") {
            toast(`💳 Đơn hàng ${order.code} đã được quán xác nhận thu đủ tiền!`, "success");
            playNotificationSound();
          } else if (order.paymentStatus !== prevPayment && order.paymentStatus === "deposit") {
            toast(`💳 Đơn hàng ${order.code}: quán đã nhận cọc 70%, phần còn lại thanh toán tại quán.`, "success");
            playNotificationSound();
          }
        }
        tracked[order.id] = currentSignature;
        hasChanges = true;
      }
    }

    // 2. Phía Quản trị / Nhân sự: Báo khi có đơn mới + báo cho trang đơn tự tải lại bảng
    if (staff) {
      // Nhận biết đơn mới theo MÃ (id) chứ không đếm số lượng: xoá 1 đơn rồi có 1 đơn mới cùng lúc vẫn báo đúng
      const knownIds = getItem(KNOWN_ORDER_IDS_KEY, null);
      const currentIds = orders.map((o) => String(o.id));
      if (Array.isArray(knownIds)) {
        const known = new Set(knownIds);
        const newOrders = orders.filter((o) => !known.has(String(o.id)));
        if (newOrders.length > 0) {
          const latestCode = newOrders[newOrders.length - 1]?.code || "mới";
          const extra = newOrders.length > 1 ? ` (và ${newOrders.length - 1} đơn khác)` : "";
          toast(`🔔 Có đơn hàng mới: ${latestCode}!${extra} Vui lòng kiểm tra mục Quản lý đơn.`, "warning");
          playNotificationSound();
        }
      }
      setItem(KNOWN_ORDER_IDS_KEY, currentIds);

      // Danh sách đổi (đơn mới / đổi trạng thái / đổi thanh toán / xoá đơn) -> phát sự kiện để trang đơn tự tải lại
      const signature = orders.map((o) => `${o.id}|${o.status}|${o.paymentStatus}`).join(",");
      if (lastOrdersSignature !== null && signature !== lastOrdersSignature && typeof globalThis.dispatchEvent === "function") {
        globalThis.dispatchEvent(new CustomEvent(ORDERS_CHANGED_EVENT, { detail: { orders } }));
      }
      lastOrdersSignature = signature;
    }

    if (hasChanges) {
      saveTrackedStates(tracked);
    }
  } catch {
    // Bỏ qua lỗi kết nối trong khi polling ngầm
  }
}

/** Bắt đầu tiến trình theo dõi định kỳ (5 giây / lần) */
export function startOrderNotificationWatcher(intervalMs = 5000) {
  if (pollingTimer) return;
  // Chạy lần đầu
  checkOrderUpdates();
  pollingTimer = setInterval(checkOrderUpdates, intervalMs);
}

/** Dừng tiến trình theo dõi */
export function stopOrderNotificationWatcher() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}


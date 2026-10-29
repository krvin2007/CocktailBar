/* =========================================================
   EMAIL-SERVICE.JS - Dịch vụ gửi vé điện tử & xác nhận đơn qua Email
   Định dạng vé điện tử chuẩn rạp chiếu phim (Cinema E-Ticket):
     - Thương hiệu Quán Bar Đêm & thông tin địa chỉ
     - Mã vé / Mã đơn to rõ ràng
     - Thông tin suất nhận bàn / phòng / số khách
     - Combo đồ uống & bắp nước đã đặt
     - Mã vạch Barcode SVG & Mã QR check-in tại quầy Door Host
     - Chi tiết thanh toán MBBank
   Tự động gửi về Email tài khoản khách đã đăng ký khi đặt bàn & nước.
   ========================================================= */

import { api } from "./api.js";
import { getItem, setItem } from "./storage.js";
import { formatMoney, formatDateTime, escapeHtml, uid } from "./utils.js";

const EMAILS_KEY = "quanbar_sent_emails";

/**
 * Sinh mã vạch chuẩn vé xem phim dạng SVG (Code 128 style)
 * @param {string} codeText
 * @returns {string} SVG code
 */
export function generateBarcodeSvg(codeText) {
  const str = String(codeText || "DH0001").toUpperCase().trim();
  const bars = [2, 1, 3, 1, 2, 1]; // start sentinel
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bars.push((code % 3) + 1, (code % 2) + 1, ((code * 3) % 4) + 1, 1);
  }
  bars.push(2, 1, 2, 3, 1, 2); // stop sentinel

  let x = 10;
  const height = 44;
  const rects = [];
  bars.forEach((w, idx) => {
    if (idx % 2 === 0) {
      rects.push(`<rect x="${x}" y="0" width="${w}" height="${height}" fill="currentColor" />`);
    }
    x += w;
  });
  const totalWidth = x + 10;

  return `
    <svg width="100%" height="${height + 16}" viewBox="0 0 ${totalWidth} ${height + 16}" xmlns="http://www.w3.org/2000/svg" style="color: #e8c682; max-width: 280px; display: block; margin: 0 auto;">
      ${rects.join("")}
      <text x="${totalWidth / 2}" y="${height + 13}" text-anchor="middle" font-family="'Plus Jakarta Sans', monospace, sans-serif" font-size="11" font-weight="700" fill="currentColor" letter-spacing="3">${escapeHtml(str)}</text>
    </svg>`;
}

/**
 * Sinh mã QR check-in tại cửa
 * @param {string} codeText
 * @returns {string} HTML string
 */
export function generateTicketQr(codeText) {
  const safeCode = encodeURIComponent(String(codeText || "DH0001").trim());
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=QUANBARDEM:TICKET:${safeCode}`;
  return `
    <div style="background: #ffffff; padding: 6px; border-radius: 8px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
      <img src="${qrUrl}" alt="QR Check-in ${escapeHtml(codeText)}" width="110" height="110" style="display: block; border-radius: 4px;" onerror="this.onerror=null;this.src='img/favicon.svg';">
    </div>`;
}

/**
 * Xây dựng giao diện Vé Điện Tử (Cinema E-Ticket) đầy đủ
 * @param {object} order Đơn hàng
 * @param {object} options Các tùy chọn phụ
 * @returns {string} HTML string
 */
export function buildCinemaTicketHtml(order, { toEmail = "" } = {}) {
  const code = order.code || "DH0001";
  const email = toEmail || order.email || "—";
  const isPaid = order.paymentStatus === "paid";
  const items = Array.isArray(order.items) ? order.items : [];

  let serviceTypeLabel = "Đặt bàn trước";
  let seatLabel = "Khu vực Sảnh VIP Lounge";
  let timeLabel = order.bookingTime ? formatDateTime(order.bookingTime) : formatDateTime(order.createdAt);
  let guestLabel = order.guestCount ? `${order.guestCount} Khách (Vé đoàn)` : "1 Khách";

  if (order.serviceType === "dine-in") {
    serviceTypeLabel = "Gọi món tại bàn";
    seatLabel = order.tableNumber ? `Bàn số ${order.tableNumber}` : "Bàn tại chỗ";
    timeLabel = formatDateTime(order.createdAt);
    guestLabel = items.length ? `${items.reduce((s, it) => s + (it.qty || 1), 0)} ly đồ uống` : "Tại quán";
  } else if (order.serviceType === "takeaway") {
    serviceTypeLabel = "Mang đi (Takeaway)";
    seatLabel = "Nhận tại Quầy Bar";
    timeLabel = formatDateTime(order.createdAt);
    guestLabel = `${items.length} món`;
  }

  const itemsHtml = items.length ? `
    <div class="cinema-ticket-items" style="margin-top: 14px; border-top: 1px dashed rgba(212, 175, 55, 0.25); padding-top: 12px;">
      <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--amber-soft, #e8c682); font-weight: 700; letter-spacing: 0.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
        <span>🍸 COMBO ĐỒ UỐNG ĐÃ CHỌN (${items.length} món):</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px;">
        ${items.map((it) => `
          <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.25); padding: 6px 10px; border-radius: 6px; font-size: 0.88rem;">
            <div>
              <strong style="color: #fff;">${escapeHtml(it.name)}</strong>
              <span style="color: var(--amber, #c59843); font-weight: 700; margin-left: 6px;">x${it.qty || 1}</span>
            </div>
            <div style="color: var(--amber-soft, #e8c682); font-weight: 600;">
              ${formatMoney((Number(it.price) || 0) * (Number(it.qty) || 1))}
            </div>
          </div>
        `).join("")}
      </div>
    </div>` : `
    <div style="margin-top: 12px; font-size: 0.85rem; color: var(--text-muted, #baa998); font-style: italic;">
      * Đặt bàn giữ chỗ (Quý khách sẽ gọi đồ uống trực tiếp tại quầy khi đến)
    </div>`;

  const discountHtml = Array.isArray(order.discounts) && order.discounts.length ? `
    <div style="display: flex; justify-content: space-between; font-size: 0.82rem; color: #4ade80; margin-top: 4px;">
      <span>Ưu đãi giảm giá:</span>
      <span>−${formatMoney(order.discounts.reduce((sum, d) => sum + (Number(d.amount) || 0), 0))}</span>
    </div>` : "";

  return `
    <div class="cinema-ticket-card" style="background: linear-gradient(145deg, #18130e 0%, #0d0a08 100%); border: 1px solid rgba(212, 175, 55, 0.4); border-radius: 12px; overflow: hidden; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(197, 152, 67, 0.15); color: #fcf8f0; font-family: 'Plus Jakarta Sans', system-ui, sans-serif;">
      <!-- Vé Header -->
      <div class="cinema-ticket-header" style="background: linear-gradient(90deg, #2a1f14, #19120a); border-bottom: 2px dashed rgba(212, 175, 55, 0.35); padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.2rem;">🎟️</span>
            <strong style="font-size: 1.05rem; letter-spacing: 0.5px; color: #f5eedf;">QUÁN BAR ĐÊM</strong>
            <span style="font-size: 0.72rem; background: rgba(212, 175, 55, 0.15); border: 1px solid rgba(212, 175, 55, 0.5); color: #f7d794; padding: 2px 8px; border-radius: 999px; font-weight: 700; text-transform: uppercase;">CINEMA E-TICKET</span>
          </div>
          <div style="font-size: 0.74rem; color: #baa998; margin-top: 2px;">
            74-76 Nam Kỳ Khởi Nghĩa, P. Bến Nghé, Quận 1, TP. Hồ Chí Minh
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.7rem; color: #baa998; text-transform: uppercase;">MÃ VÉ ĐIỆN TỬ</div>
          <strong style="font-size: 1.2rem; color: #e8c682; font-family: monospace; letter-spacing: 1px;">#${escapeHtml(code)}</strong>
        </div>
      </div>

      <!-- Vé Layout: Thân vé (Trái) + Cuống vé Check-in (Phải) -->
      <div class="cinema-ticket-layout" style="display: grid; grid-template-columns: 1fr 180px; position: relative;">
        <!-- Thân vé -->
        <div class="cinema-ticket-main" style="padding: 16px 18px;">
          <!-- Lưới thông tin suất chiếu / nhận bàn -->
          <div class="cinema-ticket-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; background: rgba(255, 255, 255, 0.02); padding: 10px 12px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.06);">
            <div>
              <div style="font-size: 0.68rem; text-transform: uppercase; color: #e8c682; font-weight: 600;">Khách hàng (Tên vé)</div>
              <div style="font-size: 0.95rem; font-weight: 700; color: #fff;">${escapeHtml(order.name)}</div>
              <div style="font-size: 0.75rem; color: #baa998;">${escapeHtml(order.phone)}</div>
            </div>

            <div>
              <div style="font-size: 0.68rem; text-transform: uppercase; color: #e8c682; font-weight: 600;">Email nhận vé</div>
              <div style="font-size: 0.85rem; font-weight: 600; color: #4ade80; word-break: break-all;">${escapeHtml(email)}</div>
            </div>

            <div>
              <div style="font-size: 0.68rem; text-transform: uppercase; color: #e8c682; font-weight: 600;">Suất nhận bàn (Thời gian)</div>
              <div style="font-size: 0.92rem; font-weight: 700; color: #f5eedf;">${escapeHtml(timeLabel)}</div>
              <div style="font-size: 0.72rem; color: #baa998;">${escapeHtml(serviceTypeLabel)}</div>
            </div>

            <div>
              <div style="font-size: 0.68rem; text-transform: uppercase; color: #e8c682; font-weight: 600;">Vị trí &amp; Số vé</div>
              <div style="font-size: 0.92rem; font-weight: 700; color: #e8c682;">${escapeHtml(seatLabel)}</div>
              <div style="font-size: 0.75rem; color: #baa998;">${escapeHtml(guestLabel)}</div>
            </div>
          </div>

          <!-- Danh sách combo nước đã gọi -->
          ${itemsHtml}

          <!-- Tổng tiền & Chi tiết thanh toán -->
          <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
            ${discountHtml}
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
              <span style="font-size: 0.88rem; font-weight: 600; text-transform: uppercase;">Tổng thanh toán:</span>
              <strong style="font-size: 1.25rem; color: #e8c682; font-family: monospace;">${formatMoney(order.total || 0)}</strong>
            </div>
            <div style="margin-top: 4px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
              <span style="font-size: 0.78rem; color: #baa998;">Trạng thái thanh toán:</span>
              <span class="badge ${isPaid ? "badge-success" : "badge-danger"}" style="font-size: 0.78rem; padding: 2px 8px;">
                ${isPaid ? "✓ ĐÃ THANH TOÁN (MBBank)" : "CHƯA THANH TOÁN (MBBank)"}
              </span>
            </div>
          </div>

          <!-- Mã vạch Barcode SVG -->
          <div style="margin-top: 16px; padding-top: 10px; border-top: 1px dashed rgba(212, 175, 55, 0.25); text-align: center;">
            ${generateBarcodeSvg(code)}
          </div>
        </div>

        <!-- Cuống vé (Stub) Check-in Door Host -->
        <div class="cinema-ticket-stub" style="background: rgba(0, 0, 0, 0.25); border-left: 2px dashed rgba(212, 175, 55, 0.35); padding: 16px 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
          <div style="font-size: 0.65rem; text-transform: uppercase; color: #e8c682; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 6px;">
            QUÉT TẠI CỬA
          </div>
          ${generateTicketQr(code)}
          <div style="margin-top: 8px; font-size: 0.72rem; color: #baa998; line-height: 1.3;">
            Xuất trình mã QR tại cửa tiếp tân (Door Host)
          </div>
          <div style="margin-top: 8px; font-family: monospace; font-size: 0.85rem; font-weight: 700; color: #e8c682;">
            ${escapeHtml(code)}
          </div>
          <div style="margin-top: 6px; font-size: 0.68rem; color: #baa998;">
            ĐỘ TUỔI: 18+
          </div>
        </div>
      </div>

      <!-- Quy định check-in tại cửa như vé xem phim -->
      <div style="background: rgba(0, 0, 0, 0.4); border-top: 1px solid rgba(255, 255, 255, 0.08); padding: 10px 18px; font-size: 0.75rem; color: #baa998; display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 1rem;">🛡️</span>
        <div>
          <strong>Lưu ý nhận bàn:</strong> Quý khách vui lòng xuất trình vé điện tử này hoặc CCCD/VNeID khi đến quán. Bàn đặt được giữ trong vòng 20 phút kể từ giờ hẹn. Hotline hỗ trợ: <strong>0397 062 429</strong>.
        </div>
      </div>
    </div>`;
}

/**
 * Gửi vé điện tử qua Email cho khách hàng khi đặt bàn / gọi món
 * @param {object} order Đơn hàng
 * @param {object} customer Khách hàng đang đăng nhập (nếu có)
 * @returns {Promise<object>} Bản ghi email đã lưu
 */
export async function sendOrderConfirmationEmail(order, customer = null) {
  if (!order) throw new Error("Dữ liệu đơn hàng không hợp lệ.");

  const targetEmail = String(order.email || customer?.email || "").trim() || "khachhang@quanbar.vn";
  const bodyHtml = buildCinemaTicketHtml(order, { toEmail: targetEmail });

  const emailRecord = {
    id: uid("mail"),
    to: targetEmail,
    orderId: order.id,
    orderCode: order.code,
    subject: `🎟️ [Quán Bar Đêm] Vé Điện Tử & Xác Nhận Đơn Hàng #${order.code}`,
    type: "order_ticket",
    sentAt: new Date().toISOString(),
    bodyHtml,
    orderSummary: {
      code: order.code,
      name: order.name,
      phone: order.phone,
      total: order.total,
      status: order.status,
      paymentStatus: order.paymentStatus,
      serviceType: order.serviceType,
      bookingTime: order.bookingTime || "",
      itemsCount: Array.isArray(order.items) ? order.items.length : 0,
    },
  };

  // 1. Lưu bản đệm vào localStorage
  try {
    const list = getItem(EMAILS_KEY, []) || [];
    list.unshift(emailRecord);
    setItem(EMAILS_KEY, list.slice(0, 50));
  } catch (err) {
    console.warn("Không thể lưu email vào localStorage:", err);
  }

  // 2. Đồng bộ lên máy chủ REST /emails nếu json-server có hỗ trợ
  try {
    await api.post("/emails", emailRecord);
  } catch {
    // Không chặn luồng nếu bảng /emails chưa sẵn sàng
  }

  return emailRecord;
}

/**
 * Lấy danh sách các vé điện tử / email đã gửi cho khách hàng hiện tại
 * @param {string} email Email cần lọc
 * @returns {Promise<Array>}
 */
export async function getEmailsByRecipient(email) {
  const clean = String(email || "").trim().toLowerCase();
  let serverList = [];
  try {
    const res = await api.get("/emails");
    if (Array.isArray(res)) serverList = res;
  } catch {
    serverList = [];
  }

  const localList = getItem(EMAILS_KEY, []) || [];
  const combined = [...serverList, ...localList];
  const uniqueMap = new Map();
  combined.forEach((item) => {
    if (item && item.id && !uniqueMap.has(item.id)) {
      uniqueMap.set(item.id, item);
    }
  });

  const all = Array.from(uniqueMap.values());
  if (!clean) return all;
  return all.filter((e) => e.to && e.to.toLowerCase() === clean);
}

/**
 * Mở Hộp thoại hiển thị Vé Điện Tử (Cinema E-Ticket Modal)
 * @param {object} order Đơn hàng
 * @param {object} options
 */
export function openCinemaTicketModal(order, { toEmail = "" } = {}) {
  const email = toEmail || order.email || "Email tài khoản";
  const ticketHtml = buildCinemaTicketHtml(order, { toEmail: email });

  const modal = document.createElement("div");
  modal.className = "modal-overlay show";
  modal.id = "cinema-ticket-modal";
  modal.style.zIndex = "99999";
  modal.innerHTML = `
    <div class="modal-box modal-wide" role="dialog" aria-modal="true" style="max-width: 680px; padding: 20px;">
      <div class="modal-head" style="border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 1.3rem;">🎟️</span>
          <h3 style="margin: 0; font-size: 1.15rem; color: var(--cream);">Vé Điện Tử (Cinema E-Ticket) — #${escapeHtml(order.code)}</h3>
        </div>
        <button type="button" class="modal-close-x" id="ticket-modal-close" aria-label="Đóng">&times;</button>
      </div>

      <div class="ticket-email-status-banner" style="margin-bottom: 14px; background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.25); border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
        <div style="font-size: 0.84rem; color: #4ade80;">
          ✓ Bản vé này đã được gửi tự động tới Email: <strong>${escapeHtml(email)}</strong>
        </div>
        <span class="text-xs text-muted">Check-in tại cửa</span>
      </div>

      <div id="ticket-content-body" class="ticket-print-area">
        ${ticketHtml}
      </div>

      <div class="ticket-modal-actions" style="margin-top: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn btn-ghost btn-sm" id="ticket-print-btn" style="display: inline-flex; align-items: center; gap: 6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            <span>In vé điện tử</span>
          </button>
          ${email && email.includes("@") ? `
            <a href="mailto:${escapeHtml(email)}?subject=${encodeURIComponent("Vé Điện Tử Quán Bar Đêm - " + order.code)}" class="btn btn-ghost btn-sm" style="font-size: 0.8rem; padding: 4px 10px;">
              Mở hòm thư
            </a>` : ""}
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="ticket-dismiss-btn">
          Đã nhận vé &amp; Đóng
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector("#ticket-modal-close")?.addEventListener("click", close);
  modal.querySelector("#ticket-dismiss-btn")?.addEventListener("click", close);
  modal.querySelector("#ticket-print-btn")?.addEventListener("click", () => {
    window.print();
  });
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
}

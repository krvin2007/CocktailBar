/* =========================================================
   VENUE.JS - Thông tin địa điểm của quán (một nguồn dữ liệu duy nhất)
   - Mục "Địa điểm" trên trang chủ vẽ từ đây (không viết cứng trong HTML).
   - Form đặt bàn (order.js) kiểm tra giờ đến theo đúng OPENING_HOURS
     bên dưới -> đổi giờ mở cửa chỉ cần sửa MỘT chỗ.
   Module KHÔNG import gì (không đụng DOM) để ordersService.js dùng được
   cả trên trình duyệt lẫn trong script Node (npm test, npm run seed).
   ========================================================= */

export const VENUE = {
  city: "SAIGON",
  index: "01",
  title: { vi: "Trung tâm Sài Gòn", en: "Downtown Saigon" },
  tagline: {
    vi: "Giữa lòng Quận 1 — dễ tìm, dễ đến, khó về sớm.",
    en: "In the heart of District 1 — easy to find, easy to reach, hard to leave early.",
  },
  address: "74-76 Nam Kỳ Khởi Nghĩa, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
  name: "Quán Bar Đêm",
  // Toạ độ ghim trên bản đồ (venueMap.js) - đổi quán sang chỗ khác chỉ cần sửa 2 số này
  lat: 10.7706,
  lng: 106.7014,
  hotline: "090 123 4567",
  image: "img/lounge/bar-counter.jpg",
};

/**
 * Giờ mở cửa theo thứ trong tuần (0 = Chủ nhật ... 6 = Thứ 7).
 * Giờ đóng nhỏ hơn giờ mở nghĩa là đóng cửa SAU nửa đêm (sang ngày hôm sau).
 * Muốn cuối tuần mở muộn hơn chỉ cần tách thêm một dòng, VD:
 *   { days: [5, 6], label: {...}, open: "18:00", close: "03:00" }
 */
export const OPENING_HOURS = [
  { days: [0, 1, 2, 3, 4, 5, 6], label: { vi: "Thứ 2 – Chủ nhật", en: "Monday – Sunday" }, open: "18:00", close: "02:00" },
];

/**
 * Quy tắc đặt bàn trước - dùng chung cho form (order.js) và nghiệp vụ (ordersService.js)
 * - capacity           : tổng số khách đặt trước tối đa trong cùng một khung giờ
 * - slotMinutes        : một lượt đặt bàn giữ chỗ trong bao lâu (2 lượt cách nhau
 *                        ít hơn khoảng này thì tính là ngồi cùng lúc)
 * - minLeadMinutes     : phải đặt trước giờ đến tối thiểu bao nhiêu phút
 * - maxDaysAhead       : đặt trước xa nhất bao nhiêu ngày
 * - cancelDeadlineHours: khách tự huỷ online được nếu còn ít nhất ngần này giờ tới giờ hẹn
 */
export const BOOKING_RULES = {
  capacity: 60,
  slotMinutes: 120,
  minLeadMinutes: 60,
  maxDaysAhead: 30,
  cancelDeadlineHours: 2,
};

/**
 * Giờ chốt NGÀY KINH DOANH. Quán mở 18:00 - 02:00 nên ly bán lúc 01:00 sáng
 * thứ Ba thuộc ca tối thứ Hai: mọi thời điểm trước 06:00 sáng được tính cho
 * ngày hôm trước (dùng cho doanh thu Dashboard và kiểm tra giờ mở cửa).
 */
export const BUSINESS_DAY_CUTOFF_HOUR = 6;

/** Ngày kinh doanh của một thời điểm, dạng "YYYY-MM-DD" theo giờ địa phương */
export function businessDayKey(time) {
  const d = new Date(time);
  if (d.getHours() < BUSINESS_DAY_CUTOFF_HOUR) d.setDate(d.getDate() - 1);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Lấy chuỗi theo ngôn ngữ: localized({ vi, en }, "en") -> chuỗi tiếng Anh */
export const localized = (text, lang = "vi") => (typeof text === "string" ? text : text[lang] || text.vi);

/** "18:30" -> 1110 (số phút tính từ 00:00) */
const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Thời điểm "date" có nằm trong giờ mở cửa không.
 * Quán bar mở vắt qua nửa đêm: 01:00 sáng thứ Ba vẫn thuộc ĐÊM thứ Hai,
 * nên giờ trước giờ chốt ngày kinh doanh (06:00) được tính cho ngày hôm
 * trước (+24 giờ). Giờ đóng cửa không tính là trong giờ.
 */
export function isWithinOpeningHours(date) {
  let minutes = date.getHours() * 60 + date.getMinutes();
  const businessDay = new Date(date);
  if (minutes < BUSINESS_DAY_CUTOFF_HOUR * 60) {
    businessDay.setDate(businessDay.getDate() - 1);
    minutes += 24 * 60;
  }

  const rule = OPENING_HOURS.find((r) => r.days.includes(businessDay.getDay()));
  if (!rule) return false;

  const open = toMinutes(rule.open);
  let close = toMinutes(rule.close);
  if (close <= open) close += 24 * 60; // đóng cửa sau nửa đêm
  return minutes >= open && minutes < close;
}

/** "Thứ 2 – Chủ nhật: 18:00 – 02:00" - dùng trong thông báo lỗi đặt bàn */
export function openingHoursText(lang = "vi") {
  return OPENING_HOURS.map((r) => `${localized(r.label, lang)}: ${r.open} – ${r.close}`).join("; ");
}

/** Tỷ lệ thanh toán trả trước (đặt cọc) khi khách đặt đơn online: 70% trả trước, 30% trả tại quán */
export const PREPAY_RATE = 0.7;

/** Tính số tiền khách cần trả trước (70% giá trị đơn hàng) */
export function calcPrepayAmount(total) {
  const clean = Math.max(0, Math.round(Number(total) || 0));
  return Math.round(clean * PREPAY_RATE);
}

/** Tính số tiền còn lại khách thanh toán tại quán (30% giá trị đơn hàng) */
export function calcRemainingAmount(total) {
  const clean = Math.max(0, Math.round(Number(total) || 0));
  return Math.max(0, clean - calcPrepayAmount(clean));
}

/** Nội quy & Chính sách phục vụ chung của Quán Bar Đêm (hiển thị khi đặt bàn / gọi món) */
export const BAR_RULES = [
  {
    id: "prepay",
    icon: "💳",
    title: "Thanh toán trả trước 70%",
    text: "Khi đặt đơn có đồ uống, quý khách chỉ cần chuyển khoản trước 70% tổng giá trị đơn qua VietQR (MBBank) để xác nhận giữ đơn và pha chế; 30% còn lại thanh toán trực tiếp tại quán.",
  },
  {
    id: "age",
    icon: "🛡️",
    title: "Quy định 18+ & Check-in Door Host",
    text: "Theo Điều 32 Luật Phòng chống tác hại của rượu, bia: chỉ phục vụ khách từ đủ 18 tuổi trở lên. Quý khách vui lòng xuất trình CCCD hoặc VNeID chính chủ tại cửa; thông tin sai lệch sẽ bị từ chối phục vụ và huỷ bàn.",
  },
  {
    id: "booking",
    icon: "🕒",
    title: "Giờ mở cửa, giữ bàn & Huỷ đơn",
    text: `Mở cửa 18:00 – 02:00 hàng ngày. Bàn đặt được giữ tối đa 20 phút kể từ giờ hẹn. Đơn chưa thanh toán có thể tự huỷ online (đặt bàn trước cần huỷ trước giờ hẹn ít nhất ${BOOKING_RULES.cancelDeadlineHours} tiếng); đơn đã được xác nhận cọc 70% / đã thu đủ mà huỷ thì MẤT CỌC 70% (không hoàn; phần còn lại nếu đã thu đủ được hoàn); đơn đang chờ đối chiếu chuyển khoản hoặc đã thu đủ vui lòng gọi Hotline ${VENUE.hotline}.`,
  },
  {
    id: "conduct",
    icon: "🥂",
    title: "Văn hoá Speakeasy & An toàn",
    text: "Không mang đồ ăn, thức uống từ ngoài vào quán; giữ không gian thưởng thức văn minh, tôn trọng khách xung quanh. Đã sử dụng đồ uống có cồn không tự lái xe (quầy lễ tân hỗ trợ đặt xe an toàn).",
  },
];

/** Sơ đồ các khu vực & bàn ngồi trong Quán Bar Đêm (dùng chung cho Đặt Bàn Trước và Tại Quầy) */
export const BAR_SEATING_ZONES = [
  {
    id: "bar-counter",
    icon: "🍸",
    name: "Quầy Bar Pha Chế Trung Tâm",
    subtitle: "Ngắm Bartender pha chế trực tiếp · 1–2 khách/vị trí",
    tables: [
      { id: "BAR-01", label: "Ghế Quầy Bar 01–02", seats: 2 },
      { id: "BAR-02", label: "Ghế Quầy Bar 03–04", seats: 2 },
      { id: "BAR-03", label: "Ghế Quầy Bar 05–06", seats: 2 },
    ],
  },
  {
    id: "vip-sofa",
    icon: "🛋️",
    name: "Khu Bàn Sofa VIP Hoàng Gia",
    subtitle: "Riêng tư, sang trọng · Nhóm 4–8 khách",
    tables: [
      { id: "VIP-01", label: "Sofa VIP 01", seats: 6 },
      { id: "VIP-02", label: "Sofa VIP 02", seats: 6 },
      { id: "VIP-03", label: "Sofa VIP 03", seats: 8 },
      { id: "VIP-04", label: "Sofa VIP 04", seats: 4 },
    ],
  },
  {
    id: "high-tables",
    icon: "🪟",
    name: "Khu Bàn Cao View Phố & Chill",
    subtitle: "Ngắm cảnh phố đêm Quận 1 · 2–4 khách/bàn",
    tables: [
      { id: "C-01", label: "Bàn Cao C01", seats: 2 },
      { id: "C-02", label: "Bàn Cao C02", seats: 2 },
      { id: "C-03", label: "Bàn Cao C03", seats: 4 },
      { id: "C-04", label: "Bàn Cao C04", seats: 4 },
    ],
  },
  {
    id: "dj-cellar",
    icon: "🎧",
    name: "Sân Khấu DJ & Hầm Rượu Di Sản",
    subtitle: "Không khí âm nhạc hoặc thưởng lãm rượu quý · 4–6 khách",
    tables: [
      { id: "DJ-01", label: "Bàn Sân Khấu DJ 01", seats: 4 },
      { id: "DJ-02", label: "Bàn Sân Khấu DJ 02", seats: 4 },
      { id: "VAULT-01", label: "Bàn Hầm Rượu Di Sản", seats: 6 },
    ],
  },
];

export const ALL_BAR_TABLES = BAR_SEATING_ZONES.flatMap((zone) =>
  zone.tables.map((t) => ({ ...t, zoneId: zone.id, zoneName: zone.name })),
);

/** Link mở Google Maps (tab mới) tại đúng toạ độ của quán */
export const mapsSearchUrl = () =>
  `https://www.google.com/maps/search/?api=1&query=${VENUE.lat},${VENUE.lng}`;

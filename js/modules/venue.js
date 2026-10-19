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

/** Link mở Google Maps (tab mới) tại đúng toạ độ của quán */
export const mapsSearchUrl = () =>
  `https://www.google.com/maps/search/?api=1&query=${VENUE.lat},${VENUE.lng}`;

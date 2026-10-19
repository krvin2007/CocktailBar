/* =========================================================
   AGE.JS - Kiểm tra độ tuổi (Luật Phòng chống tác hại của rượu, bia 2019:
   không bán rượu bia cho người dưới 18 tuổi)
   Website chỉ biết được ngày sinh KHÁCH KHAI - không xác minh được giấy tờ.
   Nên đây là hàng rào thứ nhất (chặn khai dưới 18 / nhập bừa); hàng rào thứ hai,
   mang tính quyết định, là nhân viên kiểm tra CCCD khi khách đến quán.
   Hàm thuần (nhận sẵn "now") nên dễ kiểm thử.
   ========================================================= */

/** Tuổi tối thiểu để được phục vụ đồ uống có cồn */
export const MIN_AGE = 18;

/** Tuổi lớn nhất còn coi là ngày sinh thật (nhập 1800 là nhập bừa) */
const MAX_AGE = 120;

/** Ngày sinh dạng "YYYY-MM-DD" (giá trị của <input type="date">) -> {y, m, d}, sai định dạng/ngày không có thật thì null */
function parseBirthDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  // 31/02 -> Date tự dồn sang tháng 3: so lại để phát hiện ngày không có thật
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return { y, m, d };
}

/**
 * Số tuổi tròn tại thời điểm "now" (tính theo NGÀY LỊCH của máy: sinh 15/6/2008 thì đến 15/6/2026 mới đủ 18).
 * @returns {number|null} null nếu ngày sinh trống/sai định dạng
 */
export function ageOf(birthDate, now = new Date()) {
  const birth = parseBirthDate(birthDate);
  if (!birth) return null;
  let age = now.getFullYear() - birth.y;
  const monthDiff = now.getMonth() + 1 - birth.m;
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.d)) age -= 1;
  return age;
}

/**
 * Lý do ngày sinh này KHÔNG được chấp nhận, hoặc "" nếu hợp lệ và đủ MIN_AGE tuổi.
 * @param {string} birthDate "YYYY-MM-DD"
 * @param {Date} [now]
 */
export function ageProblem(birthDate, now = new Date()) {
  if (!String(birthDate || "").trim()) return "Vui lòng nhập ngày sinh.";
  const age = ageOf(birthDate, now);
  if (age === null || age < 0 || age > MAX_AGE) return "Ngày sinh không hợp lệ.";
  if (age < MIN_AGE) return `Quán chỉ phục vụ khách từ ${MIN_AGE} tuổi trở lên theo quy định của pháp luật.`;
  return "";
}

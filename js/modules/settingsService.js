/* =========================================================
   SETTINGS-SERVICE.JS - Cấu hình chung của quán (tài khoản nhận tiền)
   Lưu trên json-server dạng 1 object (không phải mảng) tại /settings:
       GET   /settings   -> đọc cấu hình
       PATCH /settings   -> sửa cấu hình
   Vì sao không lưu localStorage như trước? localStorage chỉ nằm trong
   trình duyệt của MỘT máy: quản lý đổi tài khoản trên máy quản lý thì
   máy của khách vẫn hiện tài khoản cũ. Đặt trên máy chủ thì mọi khách
   đều quét đúng mã QR của quán.
   Chỉ quản lý/admin được sửa (quyền "settings:bank" - xem auth.js).
   ========================================================= */

import { api } from "./api.js";
import { getItem, setItem } from "./storage.js";

const CACHE_KEY = "cache_settings";

/** Danh sách các ngân hàng phổ biến tại Việt Nam hỗ trợ chuẩn VietQR (id = mã ngân hàng của VietQR) */
export const VIETNAM_BANKS = [
  { id: "MB", name: "MBBank — Ngân hàng Quân Đội", bin: "970422" },
  { id: "VCB", name: "Vietcombank — Ngân hàng Ngoại Thương", bin: "970436" },
  { id: "TCB", name: "Techcombank — Ngân hàng Kỹ Thương", bin: "970407" },
  { id: "ACB", name: "ACB — Ngân hàng Á Châu", bin: "970416" },
  { id: "TPB", name: "TPBank — Ngân hàng Tiên Phong", bin: "970423" },
  { id: "BIDV", name: "BIDV — Ngân hàng Đầu tư & Phát triển", bin: "970418" },
  { id: "ICB", name: "VietinBank — Ngân hàng Công Thương", bin: "970415" },
  { id: "VPB", name: "VPBank — Ngân hàng Việt Nam Thịnh Vượng", bin: "970432" },
  { id: "VIB", name: "VIB — Ngân hàng Quốc Tế", bin: "970441" },
  { id: "STB", name: "Sacombank — Ngân hàng Sài Gòn Thương Tín", bin: "970403" },
  { id: "HDB", name: "HDBank — Ngân hàng Phát triển TP.HCM", bin: "970437" },
  { id: "SHB", name: "SHB — Ngân hàng Sài Gòn - Hà Nội", bin: "970443" },
  { id: "OCB", name: "OCB — Ngân hàng Phương Đông", bin: "970448" },
  { id: "MSB", name: "MSB — Ngân hàng Hàng Hải", bin: "970426" },
  { id: "LPB", name: "LPBank — Ngân hàng Lộc Phát", bin: "970449" },
  { id: "SEAB", name: "SeABank — Ngân hàng Đông Nam Á", bin: "970440" },
];

/** Cấu hình mẫu - nguồn sinh db.json và dự phòng khi máy chủ chưa chạy */
export const DEFAULT_SETTINGS = {
  bankId: "MB",
  bankName: "MBBank — Ngân hàng Quân Đội",
  accountNumber: "0901234567",
  accountName: "QUAN BAR DEM",
};

/** Đọc cấu hình tài khoản nhận tiền (máy chủ -> bản đệm -> mặc định) */
export async function getBankSettings() {
  try {
    const data = await api.get("/settings");
    const settings = { ...DEFAULT_SETTINGS, ...data };
    setItem(CACHE_KEY, settings);
    return settings;
  } catch (err) {
    if (!err.offline) throw err;
    return getItem(CACHE_KEY, DEFAULT_SETTINGS);
  }
}

/**
 * Lưu tài khoản nhận tiền mới - PATCH /settings.
 * Chuẩn hoá trước khi gửi: số tài khoản chỉ giữ chữ số, tên chủ tài
 * khoản viết HOA không dấu (đúng cách app ngân hàng hiển thị).
 */
export async function saveBankSettings({ bankId, accountNumber, accountName }) {
  const bank = VIETNAM_BANKS.find((b) => b.id === bankId);
  if (!bank) throw new Error("Ngân hàng không hợp lệ.");

  const data = {
    bankId,
    bankName: bank.name,
    accountNumber: String(accountNumber || "").replace(/\D/g, ""),
    accountName: removeVietnameseTones(String(accountName || "")).trim().toUpperCase(),
  };
  if (data.accountNumber.length < 6 || data.accountNumber.length > 19) {
    throw new Error("Số tài khoản phải gồm 6-19 chữ số.");
  }
  if (!data.accountName) throw new Error("Chưa nhập tên chủ tài khoản.");

  const saved = await api.patch("/settings", data);
  setItem(CACHE_KEY, saved);
  return saved;
}

/** "Quán Bar Đêm" -> "Quan Bar Dem" (app ngân hàng ghi tên chủ tài khoản không dấu) */
export function removeVietnameseTones(text) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}

/* =========================================================
   AUTH.JS - Đăng nhập quản trị (mô phỏng, không có backend)
   Tài khoản cố định để giảng viên/chấm bài đăng nhập nhanh:
     Tài khoản: admin
     Mật khẩu:  admin123
   Trạng thái đăng nhập lưu ở sessionStorage - tự mất khi đóng
   tab trình duyệt, khác với localStorage (lưu vĩnh viễn).
   ========================================================= */

import { getSession, setSession, removeSession } from "./storage.js";
import { getAllStaff } from "./staffService.js";

const SESSION_KEY = "admin_session";

export const ADMIN_ACCOUNT = {
  username: "admin",
  password: "admin123",
  displayName: "Quản trị viên",
};

/**
 * Kiểm tra tài khoản/mật khẩu:
 * Hỗ trợ tài khoản Quản trị tối cao (admin / admin123)
 * VÀ mọi tài khoản nhân viên trong cơ sở dữ liệu /staff.
 */
export async function login(username, password) {
  const u = String(username || "").trim();
  const p = String(password || "");

  // 1. Kiểm tra tài khoản Quản trị viên tối cao
  if (u.toLowerCase() === ADMIN_ACCOUNT.username.toLowerCase() && p === ADMIN_ACCOUNT.password) {
    const sessionData = {
      username: ADMIN_ACCOUNT.username,
      name: ADMIN_ACCOUNT.displayName,
      role: "admin",
      roleLabel: "Quản trị viên",
      staffCode: "ADMIN",
      loginAt: new Date().toISOString(),
    };
    setSession(SESSION_KEY, sessionData);
    return { success: true, user: sessionData };
  }

  // 2. Kiểm tra tài khoản nhân viên từ hệ thống
  try {
    const staffList = await getAllStaff();
    const cleanU = u.toLowerCase();
    const cleanPhone = u.replace(/[\s.-]/g, "");

    const staffMember = staffList.find((s) => {
      const matchUsername = s.username && s.username.toLowerCase() === cleanU;
      const matchCode = s.staffCode && s.staffCode.toLowerCase() === cleanU;
      const matchPhone = s.phone && String(s.phone).replace(/[\s.-]/g, "") === cleanPhone;
      const matchEmail = s.email && s.email.toLowerCase() === cleanU;
      return matchUsername || matchCode || matchPhone || matchEmail;
    });

    if (!staffMember) {
      return { success: false, reason: "not_found", message: "Tài khoản hoặc mã nhân sự không tồn tại trong hệ thống." };
    }

    if (staffMember.password !== p) {
      return { success: false, reason: "wrong_password", message: "Mật khẩu xác thực không chính xác." };
    }

    if (!staffMember.isActive) {
      return {
        success: false,
        reason: "inactive",
        message: `Tài khoản nhân sự "${staffMember.name}" (${staffMember.displayStaffCode}) hiện đã bị khóa hoặc tạm nghỉ. Vui lòng liên hệ Quản lý!`,
      };
    }

    const sessionData = {
      username: staffMember.username || u,
      name: staffMember.name,
      role: staffMember.role,
      roleLabel: staffMember.roleLabel,
      shift: staffMember.shift,
      shiftLabel: staffMember.shiftLabel,
      staffId: staffMember.id,
      staffCode: staffMember.displayStaffCode,
      email: staffMember.email || "",
      phone: staffMember.phone,
      loginAt: new Date().toISOString(),
    };
    setSession(SESSION_KEY, sessionData);
    return { success: true, user: sessionData };
  } catch (err) {
    return { success: false, reason: "error", message: err.message || "Lỗi kết nối máy chủ xác thực." };
  }
}

export function logout() {
  removeSession(SESSION_KEY);
}

export function isLoggedIn() {
  return getSession(SESSION_KEY, null) !== null;
}

export function currentAdmin() {
  return getSession(SESSION_KEY, null);
}

/**
 * Gọi ở đầu mỗi trang quản trị: nếu chưa đăng nhập thì đẩy
 * người dùng về trang đăng nhập ngay lập tức.
 */
export function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = "admin-login.html";
  }
}

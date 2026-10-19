/* =========================================================
   AUTH.JS - Đăng nhập dùng chung cho cả quản trị, nhân viên và khách
   Chỉ có MỘT form đăng nhập (customer-auth.html). Hàm signIn() tự nhận
   biết tài khoản thuộc loại nào:
     - Quản trị viên / nhân viên (có phiên admin_session) -> vào trang quản trị
     - Khách hàng (có phiên customer_session)             -> đặt bàn, tích điểm
   Tài khoản quản trị cố định để giảng viên chấm bài:
     Tài khoản: admin
     Mật khẩu:  Admin@123
   Phiên quản trị lưu ở sessionStorage - tự mất khi đóng tab trình duyệt,
   khác với localStorage (lưu vĩnh viễn) dùng cho phiên khách hàng.
   ========================================================= */

import { getSession, setSession, removeSession } from "./storage.js";
import { api } from "./api.js";
import { normalizePhone } from "./utils.js";
import { getAllStaff, Staff } from "./staffService.js";
import { customerLogin, customerLogout } from "./customerAuth.js";
import { verifyPassword, hashPassword } from "./passwords.js";

/** Trang chứa form đăng nhập / đăng ký duy nhất của website */
export const LOGIN_PAGE = "customer-auth.html";

const SESSION_KEY = "admin_session";

export const ADMIN_ACCOUNT = {
  username: "admin",
  // Chỉ lưu BẢN BĂM (mật khẩu demo ghi trong README) - mã nguồn không còn chữ thường
  passwordHash: "sha256$d77972b180397a5af2ce8ad233e84d56$90532f4b297d8e3a0329f75db92939d6cd807594ff0d5a58cc13da07c8acefd8",
  displayName: "Lê Thành Tài",
};

/**
 * Kiểm tra tài khoản/mật khẩu:
 * Hỗ trợ tài khoản Quản trị tối cao (admin / Admin@123)
 * VÀ mọi tài khoản nhân viên trong cơ sở dữ liệu /staff.
 */
export async function login(username, password) {
  const u = String(username || "").trim();
  const p = String(password || "");

  // 1. Kiểm tra tài khoản Quản trị viên tối cao
  if (u.toLowerCase() === ADMIN_ACCOUNT.username.toLowerCase()) {
    if (!verifyPassword(p, ADMIN_ACCOUNT.passwordHash).ok) {
      return { success: false, reason: "wrong_password", message: "Mật khẩu xác thực không chính xác." };
    }
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
    const cleanPhone = normalizePhone(u);

    const staffMember = staffList.find((s) => {
      const matchUsername = s.username && s.username.toLowerCase() === cleanU;
      const matchCode = s.staffCode && s.staffCode.toLowerCase() === cleanU;
      const matchPhone = s.phone && normalizePhone(s.phone) === cleanPhone;
      const matchEmail = s.email && s.email.toLowerCase() === cleanU;
      return matchUsername || matchCode || matchPhone || matchEmail;
    });

    if (!staffMember) {
      return { success: false, reason: "not_found", message: "Tài khoản hoặc mã nhân sự không tồn tại trong hệ thống." };
    }

    const passwordCheck = verifyPassword(p, staffMember.password);
    if (!passwordCheck.ok) {
      return { success: false, reason: "wrong_password", message: "Mật khẩu xác thực không chính xác." };
    }

    if (staffMember.isPending) {
      return {
        success: false,
        reason: "pending",
        message: `Tài khoản "${staffMember.username}" đang chờ quản lý duyệt, chưa thể đăng nhập.`,
      };
    }

    if (!staffMember.isActive) {
      return {
        success: false,
        reason: "inactive",
        message: `Tài khoản nhân sự "${staffMember.name}" (${staffMember.displayStaffCode}) hiện đã bị khóa hoặc tạm nghỉ. Vui lòng liên hệ Quản lý!`,
      };
    }

    // Tài khoản cũ còn lưu mật khẩu chữ thường: băm lại ngay sau lần đăng nhập đúng đầu tiên
    if (passwordCheck.needsUpgrade) {
      api.patch(`/staff/${encodeURIComponent(staffMember.id)}`, { password: hashPassword(p) }).catch(() => {});
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

/* ---------------- Phân quyền theo vai trò ---------------- */

/**
 * Quyền của từng vai trò. "*" = toàn quyền.
 *   page:<tên>   được vào trang admin-<tên>.html
 *   order:cancel huỷ đơn / khôi phục đơn đã huỷ (có hoàn - trừ tồn kho)
 *   order:delete xoá vĩnh viễn đơn hàng
 *   order:payment xác nhận đã nhận tiền chuyển khoản
 *   settings:bank đổi tài khoản ngân hàng nhận tiền của quán
 * Mọi vai trò vào được trang Đơn hàng đều đổi được tiến độ pha chế
 * (Chờ xử lý -> Đang pha chế -> Hoàn tất).
 */
export const ROLE_PERMISSIONS = {
  admin: ["*"],
  manager: ["*"],
  cashier: ["page:dashboard", "page:orders", "page:customers", "order:cancel", "order:payment"],
  bartender: ["page:orders"],
  waiter: ["page:orders", "page:messages"],
};

/** Người đang đăng nhập (hoặc user truyền vào) có quyền "permission" không */
export function can(permission, user = currentAdmin()) {
  if (!user) return false;
  const perms = ROLE_PERMISSIONS[user.role] || [];
  return perms.includes("*") || perms.includes(permission);
}

/** "admin-orders.html" -> "page:orders" */
const pagePermission = (fileName) => `page:${fileName.replace(/^admin-|\.html$/g, "")}`;

export function canAccessPage(fileName, user = currentAdmin()) {
  return can(pagePermission(fileName), user);
}

/** Thứ tự ưu tiên trang mở đầu sau khi đăng nhập */
const ADMIN_PAGES = ["admin-dashboard.html", "admin-orders.html", "admin-menu.html", "admin-customers.html", "admin-staff.html", "admin-messages.html"];

/** Trang đầu tiên mà vai trò này được vào (VD pha chế -> Quản lý đơn hàng) */
export function homePageFor(user = currentAdmin()) {
  return ADMIN_PAGES.find((page) => canAccessPage(page, user)) || "index.html";
}

export function logout() {
  removeSession(SESSION_KEY);
}

/**
 * Đối chiếu phiên đăng nhập với danh sách nhân sự hiện tại trên máy chủ.
 * Phiên chỉ là bản sao lúc đăng nhập nên sẽ lỗi thời nếu quản lý khoá/xoá tài khoản
 * hoặc đổi vai trò trong lúc nhân viên đang mở trang:
 *   - bị xoá / bị khoá / chưa duyệt  -> huỷ phiên, trả về null
 *   - đổi vai trò, tên, ca làm       -> cập nhật phiên theo bản mới
 *   - máy chủ tắt / lỗi mạng         -> giữ nguyên phiên (không đá người ra vì lỗi mạng)
 * Tài khoản admin gốc không nằm trong /staff nên luôn giữ nguyên.
 * @returns {Promise<object|null>} phiên sau khi đối chiếu, hoặc null nếu không còn hiệu lực
 */
export async function refreshSession() {
  const session = getSession(SESSION_KEY, null);
  if (!session || !session.staffId) return session;

  let record;
  try {
    record = await api.get(`/staff/${encodeURIComponent(session.staffId)}`);
  } catch (err) {
    if (err.status === 404) {
      removeSession(SESSION_KEY);
      return null;
    }
    return session;
  }

  const staff = Staff.from(record);
  if (!staff.isActive) {
    removeSession(SESSION_KEY);
    return null;
  }

  const fresh = {
    ...session,
    name: staff.name,
    role: staff.role,
    roleLabel: staff.roleLabel,
    shift: staff.shift,
    shiftLabel: staff.shiftLabel,
    phone: staff.phone,
    email: staff.email || "",
  };
  if (JSON.stringify(fresh) !== JSON.stringify(session)) setSession(SESSION_KEY, fresh);
  return fresh;
}

/**
 * Đăng nhập một cửa: thử tài khoản quản trị/nhân sự trước, không phải thì
 * thử tài khoản khách hàng. Mỗi trình duyệt chỉ giữ MỘT danh tính - đăng nhập
 * loại này sẽ đăng xuất loại kia.
 * @returns {Promise<{success: true, kind: "staff"|"customer", user: object}
 *   | {success: false, message: string}>}
 */
export async function signIn(identifier, password) {
  const staffResult = await login(identifier, password);
  if (staffResult.success) {
    customerLogout();
    return { success: true, kind: "staff", user: staffResult.user };
  }

  const customerResult = await customerLogin(identifier, password);
  if (customerResult.success) {
    logout();
    return { success: true, kind: "customer", user: customerResult.customer };
  }

  // Không phải khách. Nếu tên đăng nhập trùng một nhân sự thì báo đúng lý do
  // của nhân sự (sai mật khẩu, chờ duyệt, bị khoá) thay vì "không tìm thấy".
  const staffReasons = ["wrong_password", "pending", "inactive"];
  const message = staffReasons.includes(staffResult.reason) ? staffResult.message : customerResult.message;
  return { success: false, message };
}

export function isLoggedIn() {
  return getSession(SESSION_KEY, null) !== null;
}

export function currentAdmin() {
  return getSession(SESSION_KEY, null);
}

/**
 * Gọi ở đầu mỗi trang quản trị: nếu chưa đăng nhập thì đẩy
 * người dùng về trang đăng nhập chung ngay lập tức.
 */
export function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = LOGIN_PAGE;
  }
}

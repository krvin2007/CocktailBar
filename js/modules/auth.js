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

import { getItem, setItem, removeItem, getSession, setSession, removeSession } from "./storage.js";
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

/* ---------------- Phân quyền theo vai trò (RBAC) ---------------- */

/** Danh mục các nhóm phân quyền trong hệ thống quán bar */
export const PERMISSION_GROUPS = [
  { id: "pages", name: "Trang Quản Trị & Giao Diện", icon: "chart", desc: "Quyền truy cập các màn hình quản trị nghiệp vụ" },
  { id: "orders", name: "Nghiệp Vụ Đơn Hàng & POS", icon: "receipt", desc: "Thao tác trên hoá đơn, thanh toán và xử lý đơn" },
  { id: "menu", name: "Thực Đơn & Kho Hàng", icon: "cocktail", desc: "Quản lý danh mục đồ uống và điều chỉnh kho" },
  { id: "customers", name: "Khách Hàng Thành Viên", icon: "user", desc: "Quản lý thông tin, tích điểm và khóa tài khoản" },
  { id: "vouchers", name: "Mã Ưu Đãi & Khuyến Mãi", icon: "sparkle", desc: "Thiết lập chương trình giảm giá và voucher" },
  { id: "staff", name: "Nhân Sự & Phân Quyền", icon: "users", desc: "Quản lý hồ sơ nhân viên và thiết lập phân quyền" },
  { id: "settings", name: "Hệ Thống & Cấu Hình", icon: "shield", desc: "Cấu hình tài khoản ngân hàng và thiết lập hệ thống" },
];

/**
 * Danh sách toàn bộ quyền chi tiết (Fine-grained permissions).
 * "*" = toàn quyền mọi chức năng.
 */
export const SYSTEM_PERMISSIONS = [
  // 1. Phân quyền trang
  { id: "page:dashboard", group: "pages", label: "Bảng tổng quan (Dashboard)", desc: "Xem báo cáo doanh thu, đơn hàng và biểu đồ thống kê" },
  { id: "page:menu", group: "pages", label: "Quản lý thực đơn", desc: "Xem danh sách đồ uống, giá bán và công thức pha chế" },
  { id: "page:orders", group: "pages", label: "Quản lý đơn hàng (POS)", desc: "Xem danh sách và chi tiết các đơn đặt bàn, mang đi, tại quán" },
  { id: "page:customers", group: "pages", label: "Khách hàng thành viên", desc: "Xem hồ sơ khách hàng, hạng thẻ và lịch sử chi tiêu" },
  { id: "page:vouchers", group: "pages", label: "Mã giảm giá (Voucher)", desc: "Xem danh sách các voucher và chương trình ưu đãi" },
  { id: "page:staff", group: "pages", label: "Nhân sự & Phân quyền", desc: "Truy cập giao diện quản lý nhân viên và ma trận phân quyền" },
  { id: "page:messages", group: "pages", label: "Hộp thư liên hệ", desc: "Xem tin nhắn, đóng góp ý kiến từ khách hàng" },

  // 2. Nghiệp vụ đơn hàng
  { id: "order:status", group: "orders", label: "Cập nhật tiến độ pha chế", desc: "Chuyển trạng thái đơn: Chờ xử lý -> Đang pha chế -> Hoàn tất" },
  { id: "order:payment", group: "orders", label: "Xác nhận thanh toán", desc: "Xác nhận tiền mặt hoặc đối soát chuyển khoản VietQR" },
  { id: "order:cancel", group: "orders", label: "Huỷ & Khôi phục đơn", desc: "Huỷ đơn hàng hoặc khôi phục (tự động hoàn/trừ tồn kho)" },
  { id: "order:delete", group: "orders", label: "Xoá vĩnh viễn đơn hàng", desc: "Xoá hoàn toàn đơn khỏi cơ sở dữ liệu (nguy cơ cao)", danger: true },

  // 3. Thực đơn & Kho
  { id: "menu:edit", group: "menu", label: "Thêm/sửa món & Tồn kho", desc: "Thêm món mới, đổi giá bán, cập nhật số lượng tồn kho" },

  // 4. Khách hàng
  { id: "customer:lock", group: "customers", label: "Khoá / Mở tài khoản khách", desc: "Tạm đình chỉ hoặc kích hoạt lại tài khoản khách" },
  { id: "customer:points", group: "customers", label: "Điều chỉnh điểm thưởng", desc: "Cộng hoặc trừ điểm tích luỹ của khách hàng" },

  // 5. Khuyến mãi
  { id: "voucher:edit", group: "vouchers", label: "Thêm & Sửa mã giảm giá", desc: "Tạo voucher mới, sửa % giảm giá hoặc tạm dừng mã" },

  // 6. Nhân sự & Phân quyền
  { id: "staff:edit", group: "staff", label: "Quản lý hồ sơ nhân viên", desc: "Tiếp nhận nhân sự, sửa thông tin, khoá/mở tài khoản nhân viên" },
  { id: "staff:permissions", group: "staff", label: "Thiết lập phân quyền", desc: "Chỉnh sửa ma trận phân quyền vai trò & phân quyền riêng", danger: true },

  // 7. Cấu hình
  { id: "settings:bank", group: "settings", label: "Cấu hình ngân hàng VietQR", desc: "Thay đổi số tài khoản nhận tiền chuyển khoản của quán" },
];

/** Ma trận phân quyền mặc định chuẩn nghiệp vụ quán bar */
export const DEFAULT_ROLE_PERMISSIONS = {
  admin: ["*"],
  manager: ["*"],
  cashier: ["page:dashboard", "page:orders", "page:customers", "order:status", "order:cancel", "order:payment", "customer:points"],
  bartender: ["page:orders", "order:status"],
  waiter: ["page:orders", "page:messages", "order:status"],
};

export const ROLE_PERMISSIONS_STORAGE_KEY = "role_permissions";
export const STAFF_PERMISSIONS_STORAGE_KEY = "staff_permissions";

/** Đọc ma trận phân quyền vai trò hiện hành từ localStorage (hoặc trả về mặc định) */
export function getRolePermissions() {
  const custom = getItem(ROLE_PERMISSIONS_STORAGE_KEY, null);
  if (!custom || typeof custom !== "object") {
    return JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
  }
  return {
    ...DEFAULT_ROLE_PERMISSIONS,
    ...custom,
    admin: ["*"], // Quản trị viên tối cao luôn toàn quyền
  };
}

/** Lưu ma trận phân quyền vai trò vào localStorage */
export function saveRolePermissions(matrix) {
  if (!matrix || typeof matrix !== "object") return false;
  const sanitized = {
    ...matrix,
    admin: ["*"],
  };
  return setItem(ROLE_PERMISSIONS_STORAGE_KEY, sanitized);
}

/** Khôi phục ma trận phân quyền vai trò về trạng thái mặc định */
export function resetRolePermissions() {
  removeItem(ROLE_PERMISSIONS_STORAGE_KEY);
  return JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
}

/** Đọc toàn bộ danh sách phân quyền riêng của nhân viên */
export function getAllStaffCustomPermissions() {
  return getItem(STAFF_PERMISSIONS_STORAGE_KEY, {}) || {};
}

/** Đọc quyền riêng của một nhân viên cụ thể (null nếu thừa hưởng theo vai trò) */
export function getStaffCustomPermissions(staffId) {
  if (!staffId) return null;
  const map = getAllStaffCustomPermissions();
  const perms = map[String(staffId)];
  return Array.isArray(perms) ? perms : null;
}

/** Lưu quyền riêng cho một nhân sự (truyền null nếu muốn đưa về thừa hưởng vai trò) */
export function saveStaffCustomPermissions(staffId, permissionsOrNull) {
  if (!staffId) return false;
  const map = { ...getAllStaffCustomPermissions() };
  if (permissionsOrNull === null || typeof permissionsOrNull === "undefined") {
    delete map[String(staffId)];
  } else if (Array.isArray(permissionsOrNull)) {
    map[String(staffId)] = [...new Set(permissionsOrNull)];
  }
  return setItem(STAFF_PERMISSIONS_STORAGE_KEY, map);
}

/** Xoá quyền riêng của nhân viên, đưa về thừa hưởng theo vai trò */
export function clearStaffCustomPermissions(staffId) {
  return saveStaffCustomPermissions(staffId, null);
}

/**
 * Proxy tương thích ngược: ROLE_PERMISSIONS luôn phản ánh ma trận động
 * nhưng vẫn truy cập được dạng ROLE_PERMISSIONS[role].
 */
export const ROLE_PERMISSIONS = new Proxy(DEFAULT_ROLE_PERMISSIONS, {
  get(target, prop) {
    if (prop === "toJSON") return () => getRolePermissions();
    const current = getRolePermissions();
    if (Object.hasOwn(current, prop)) return current[prop];
    return target[prop] || [];
  },
  ownKeys() {
    return Reflect.ownKeys(getRolePermissions());
  },
  getOwnPropertyDescriptor(target, prop) {
    const current = getRolePermissions();
    if (Object.hasOwn(current, prop)) {
      return {
        value: current[prop],
        writable: false,
        enumerable: true,
        configurable: true,
      };
    }
    return Reflect.getOwnPropertyDescriptor(target, prop);
  },
});

/** Người đang đăng nhập (hoặc user truyền vào) có quyền "permission" không */
export function can(permission, user = currentAdmin()) {
  if (!user) return false;
  if (user.role === "admin") return true;

  // 1. Nếu nhân viên có thiết lập quyền riêng (Custom Permissions Override)
  const staffId = user.staffId || user.id;
  const customPerms = Array.isArray(user.customPermissions)
    ? user.customPermissions
    : (staffId ? getStaffCustomPermissions(staffId) : null);

  if (Array.isArray(customPerms)) {
    return customPerms.includes("*") || customPerms.includes(permission);
  }

  // 2. Tra cứu theo ma trận vai trò (RBAC)
  const roleMatrix = getRolePermissions();
  const rolePerms = roleMatrix[user.role] || [];
  return rolePerms.includes("*") || rolePerms.includes(permission);
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

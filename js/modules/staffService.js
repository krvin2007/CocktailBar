/* =========================================================
   STAFF-SERVICE.JS - CRUD nhân viên (khu vực quản trị)
   Dữ liệu lưu trên máy chủ json-server tại /staff.
   ========================================================= */

import { api, getCollection, getRecord } from "./api.js";
import { uid, normalizePhone } from "./utils.js";
import { hashIfPlain, isHashed, passwordProblem } from "./passwords.js";

/** Mật khẩu chữ thường gửi lên phải đạt luật chung (bản băm có sẵn thì bỏ qua) */
function assertPasswordAllowed(password) {
  if (password && !isHashed(password) && passwordProblem(password)) throw new Error(passwordProblem(password));
}

const COLLECTION = "staff";

export const STAFF_ROLES = {
  manager: "Quản lý",
  bartender: "Pha chế",
  waiter: "Phục vụ",
  cashier: "Thu ngân",
};

export const STAFF_SHIFTS = {
  morning: "Ca sáng",
  afternoon: "Ca chiều",
  evening: "Ca tối",
};

/** Dữ liệu mẫu - nguồn sinh db.json và dự phòng khi API chưa chạy */
export const SEED_STAFF = [
  {
    id: "s1",
    staffCode: "NV001",
    name: "Trần Minh Khoa",
    username: "khoa.tran",
    password: "Khoa@123456",
    role: "manager",
    shift: "morning",
    phone: "0901234567",
    email: "khoa.tran@quanbar.vn",
    startDate: "2023-03-01",
    status: "active",
    createdAt: "2023-03-01T08:00:00.000Z",
  },
  {
    id: "s2",
    staffCode: "NV002",
    name: "Nguyễn Thị Lan",
    username: "lan.nguyen",
    password: "Lan@123456",
    role: "bartender",
    shift: "evening",
    phone: "0912345678",
    email: "lan.nguyen@quanbar.vn",
    startDate: "2023-06-15",
    status: "active",
    createdAt: "2023-06-15T14:00:00.000Z",
  },
  {
    id: "s3",
    staffCode: "NV003",
    name: "Lê Văn Đức",
    username: "duc.le",
    password: "Duc@123456",
    role: "bartender",
    shift: "afternoon",
    phone: "0923456789",
    email: "duc.le@quanbar.vn",
    startDate: "2024-01-10",
    status: "active",
    createdAt: "2024-01-10T11:00:00.000Z",
  },
  {
    id: "s4",
    staffCode: "NV004",
    name: "Phạm Thu Hà",
    username: "ha.pham",
    password: "Ha@123456",
    role: "waiter",
    shift: "evening",
    phone: "0934567890",
    email: "ha.pham@quanbar.vn",
    startDate: "2024-05-20",
    status: "active",
    createdAt: "2024-05-20T16:00:00.000Z",
  },
  {
    id: "s5",
    staffCode: "NV005",
    name: "Hoàng Anh Tuấn",
    username: "tuan.hoang",
    password: "Tuan@123456",
    role: "cashier",
    shift: "morning",
    phone: "0945678901",
    email: "tuan.hoang@quanbar.vn",
    startDate: "2022-11-02",
    status: "inactive",
    createdAt: "2022-11-02T09:00:00.000Z",
  },
];

export const STAFF_STATUS = {
  pending: "Chờ duyệt",   // tự đăng ký, chưa được quản lý duyệt -> chưa đăng nhập được
  active: "Đang công tác",
  inactive: "Đã nghỉ",
};

/**
 * Vị trí được phép TỰ ĐĂNG KÝ ở trang admin-register.html.
 * "manager" không có trong danh sách: tài khoản quản lý chỉ do
 * quản lý/admin tạo trong trang Quản lý nhân viên.
 */
export const SELF_REGISTER_ROLES = ["bartender", "waiter", "cashier"];

/* ============== LỚP NHÂN VIÊN (class, getter/setter) ============== */

export class Staff {
  // Trạng thái công tác là trường private, chỉ đổi qua setter có kiểm tra
  #status;

  constructor({
    id,
    name,
    role,
    shift,
    phone,
    email = "",
    startDate,
    status = "active",
    username = "",
    password = "",
    staffCode = "",
    createdAt = "",
  } = {}) {
    this.id = id;
    this.name = name;
    this.role = role;
    this.shift = shift;
    this.phone = phone;
    this.email = email;
    this.startDate = startDate;
    this.status = status; // đi qua setter
    this.username = username || (phone ? `nv_${phone.replace(/\D/g, "").slice(-4)}` : "");
    this.password = password || "";
    this.staffCode = staffCode || (id ? `NV${String(id).replace(/\D/g, "").padStart(3, "0")}` : "");
    this.createdAt = createdAt || new Date().toISOString();
  }

  get status() {
    return this.#status;
  }

  /** Setter: chỉ nhận "active" hoặc "inactive" */
  set status(value) {
    if (!Object.hasOwn(STAFF_STATUS, value)) {
      throw new Error(`Trạng thái nhân viên không hợp lệ: "${value}"`);
    }
    this.#status = value;
  }

  get isActive() {
    return this.#status === "active";
  }

  get isPending() {
    return this.#status === "pending";
  }

  get statusLabel() {
    return STAFF_STATUS[this.#status];
  }

  get roleLabel() {
    return STAFF_ROLES[this.role] || this.role;
  }

  get shiftLabel() {
    return STAFF_SHIFTS[this.shift] || this.shift;
  }

  /** Số tháng đã làm việc tính từ ngày vào làm (0 nếu ngày vào làm ở tương lai) */
  get monthsOfService() {
    const start = new Date(this.startDate);
    if (Number.isNaN(start.getTime())) return 0;
    const now = new Date();
    const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    return Math.max(0, months);
  }

  /** Thâm niên dạng chữ: "2 năm 3 tháng", "5 tháng", "Mới vào làm" */
  get seniorityLabel() {
    const total = this.monthsOfService;
    if (total === 0) return "Mới vào làm";
    const years = Math.floor(total / 12);
    const months = total % 12;
    return [years && `${years} năm`, months && `${months} tháng`].filter(Boolean).join(" ");
  }

  get displayStaffCode() {
    return this.staffCode || (this.id ? `NV${String(this.id).replace(/\D/g, "").padStart(3, "0")}` : "NV000");
  }

  /** Dữ liệu thuần để gửi lên API (JSON.stringify không lấy được trường private) */
  toJSON() {
    return {
      id: this.id,
      staffCode: this.staffCode,
      name: this.name,
      username: this.username,
      password: this.password,
      role: this.role,
      shift: this.shift,
      phone: this.phone,
      email: this.email,
      startDate: this.startDate,
      status: this.status,
      createdAt: this.createdAt,
    };
  }

  static from(data) {
    return new Staff(data);
  }
}

/** Tự sinh mã nhân sự tiếp theo theo quy chuẩn NVxxx (VD: NV006) */
export function generateStaffCode(staffList = []) {
  let maxNum = 0;
  staffList.forEach((s) => {
    const raw = String(s.staffCode || s.id || "");
    const m = raw.match(/NV(\d+)/i) || raw.match(/s(\d+)/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n > maxNum) maxNum = n;
    }
  });
  return `NV${String(maxNum + 1).padStart(3, "0")}`;
}

/** Kiểm tra trùng tên đăng nhập */
export function isUsernameTaken(staffList, username, exceptId = null) {
  if (!username) return false;
  const normalized = String(username).trim().toLowerCase();
  if (normalized === "admin") return true; // bảo vệ tài khoản admin gốc
  return staffList.some((s) => s.id !== exceptId && String(s.username || "").trim().toLowerCase() === normalized);
}

/** Kiểm tra trùng email */
export function isEmailTaken(staffList, email, exceptId = null) {
  if (!email) return false;
  const normalized = String(email).trim().toLowerCase();
  return staffList.some((s) => s.id !== exceptId && String(s.email || "").trim().toLowerCase() === normalized);
}

/** Kiểm tra trùng mã nhân viên */
export function isStaffCodeTaken(staffList, staffCode, exceptId = null) {
  if (!staffCode) return false;
  const normalized = String(staffCode).trim().toUpperCase();
  return staffList.some((s) => s.id !== exceptId && String(s.staffCode || "").trim().toUpperCase() === normalized);
}

/**
 * Kiểm tra trùng số điện thoại với nhân viên khác (một số điện thoại
 * chỉ thuộc về một người). Bỏ qua chính bản ghi đang sửa (exceptId).
 */
export function isPhoneTaken(staffList, phone, exceptId = null) {
  const normalized = normalizePhone(phone);
  return staffList.some((s) => s.id !== exceptId && normalizePhone(s.phone) === normalized);
}

/** GET /staff - dữ liệu thô từ API được chuyển thành đối tượng Staff */
export async function getAllStaff() {
  const list = await getCollection(COLLECTION, SEED_STAFF);
  return list.map((data) => Staff.from(data));
}

/** GET /staff/:id */
export async function getStaffById(id) {
  const data = await getRecord(COLLECTION, id, SEED_STAFF);
  return data ? Staff.from(data) : null;
}

/** POST /staff - trả về nhân viên máy chủ đã lưu (kèm id do máy chủ quyết định) */
export async function addStaff(data) {
  // Mật khẩu luôn được băm trước khi gửi (đã băm rồi thì giữ nguyên, không băm hai lần)
  assertPasswordAllowed(data.password);
  const password = data.password ? hashIfPlain(data.password) : "";
  const staff = new Staff({ id: uid("staff"), ...data, password }); // dữ liệu sai bị setter chặn trước khi gửi
  const saved = await api.post(`/${COLLECTION}`, staff.toJSON());
  return Staff.from(saved);
}

/**
 * Nhân viên TỰ đăng ký tài khoản (trang admin-register.html).
 * Quy tắc nghiệp vụ:
 * - Không được tự chọn vị trí Quản lý.
 * - Tài khoản luôn ở trạng thái "Chờ duyệt", bỏ qua mọi status gửi lên;
 *   chỉ đăng nhập được sau khi quản lý bấm "Duyệt" ở trang Quản lý nhân viên.
 */
export async function registerStaff(data) {
  if (!SELF_REGISTER_ROLES.includes(data.role)) {
    throw new Error("Vị trí này không được tự đăng ký. Vui lòng liên hệ quản lý để được cấp tài khoản.");
  }
  const all = await getAllStaff();
  const staffCode = data.staffCode || generateStaffCode(all);
  return addStaff({
    ...data,
    staffCode,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
}

/** PATCH /staff/:id */
export async function updateStaff(id, changes) {
  const { id: _ignored, ...body } = changes;
  if (body.password) {
    assertPasswordAllowed(body.password);
    body.password = hashIfPlain(body.password);
  }
  if (body.status !== undefined && !Object.hasOwn(STAFF_STATUS, body.status)) {
    throw new Error(`Trạng thái nhân viên không hợp lệ: "${body.status}"`);
  }
  const saved = await api.patch(`/${COLLECTION}/${encodeURIComponent(id)}`, body);
  return Staff.from(saved);
}

/** DELETE /staff/:id */
export async function deleteStaff(id) {
  await api.delete(`/${COLLECTION}/${encodeURIComponent(id)}`);
  return true;
}

/** Lọc danh sách nhân viên có sẵn trong bộ nhớ (hàm đồng bộ) */
export function filterStaff(staffList, { keyword = "", role = "all", status = "all" } = {}) {
  let list = [...staffList];

  const kw = keyword.trim().toLowerCase();
  if (kw) {
    list = list.filter((s) =>
      s.name.toLowerCase().includes(kw)
      || String(s.phone).includes(kw)
      || String(s.username || "").toLowerCase().includes(kw)
      || String(s.staffCode || "").toLowerCase().includes(kw)
      || String(s.email || "").toLowerCase().includes(kw));
  }
  if (role !== "all") list = list.filter((s) => s.role === role);
  if (status !== "all") list = list.filter((s) => s.status === status);

  return list;
}

/** Tải từ API rồi lọc */
export async function queryStaff(opts = {}) {
  return filterStaff(await getAllStaff(), opts);
}


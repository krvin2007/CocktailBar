/* =========================================================
   CUSTOMER-AUTH.JS - Xác thực & Quản lý Tài khoản Khách hàng
   Hỗ trợ:
   - Đăng nhập (Số điện thoại / Email / Username + Mật khẩu)
   - Đăng ký thành viên mới (Họ tên, SĐT, Email, Mật khẩu)
   - Lưu phiên đăng nhập trong localStorage ("customer_session")
   - Tự động điền thông tin đặt bàn & tích điểm ưu đãi
   ========================================================= */

import { api, getCollection } from "./api.js";
import { getItem, setItem, removeItem } from "./storage.js";
import { mergeGuestCartIntoCustomer } from "./cartStorage.js";
import { uid, normalizePhone } from "./utils.js";
import { hashPassword, verifyPassword, passwordProblem } from "./passwords.js";
import { issueOtp, verifyOtp, availableChannels } from "./otpService.js";
import { ageProblem } from "./age.js";
import { sendWelcomeVoucherEmail } from "./emailService.js";

const CUSTOMER_COLLECTION = "customers";
const SESSION_KEY = "customer_session";

export const SEED_CUSTOMERS = [
  {
    id: "cust-001",
    name: "Nguyễn Hoàng Long",
    phone: "0909123456",
    email: "long.nguyen@gmail.com",
    birthDate: "1992-05-14",
    password: "Khach@123",
    tier: "Thành viên Vàng",
    points: 150,
    lifetimePoints: 150,
    createdAt: "2026-01-15T19:30:00.000Z",
  },
  {
    id: "cust-002",
    name: "Lê Thu Hương",
    phone: "0918765432",
    email: "huong.le@gmail.com",
    birthDate: "1995-08-22",
    password: "Khach@123",
    tier: "Thành viên Bạc",
    points: 80,
    lifetimePoints: 80,
    createdAt: "2026-03-20T20:15:00.000Z",
  },
];

/* ---------------- Tích điểm & hạng thành viên ---------------- */

/** Mỗi 10.000đ của đơn đã hoàn tất = 1 điểm thưởng */
export const POINT_VALUE_VND = 10000;

export function pointsForTotal(total) {
  return Math.floor(Math.max(0, Number(total) || 0) / POINT_VALUE_VND);
}

/**
 * Các hạng thành viên theo TỔNG ĐIỂM tích luỹ (xếp tăng dần, hạng đầu là mặc định cho mọi khách).
 * Thêm/đổi hạng chỉ cần sửa danh sách này - label là chuỗi lưu vào hồ sơ khách (tier).
 */
export const MEMBER_RANKS = [
  { key: "loyal", label: "Thành viên Thân thiết", min: 0, color: "#c59843", discountPercent: 0 },
  { key: "silver", label: "Thành viên Bạc", min: 50, color: "#cfd4db", discountPercent: 3 },
  { key: "gold", label: "Thành viên Vàng", min: 150, color: "#f0b429", discountPercent: 5 },
  { key: "diamond", label: "Thành viên Kim Cương", min: 400, color: "#7dd3fc", discountPercent: 8 },
];

/**
 * Điểm TÍCH LUỸ TRỌN ĐỜI dùng để xét hạng. Khác với `points` (số dư, giảm đi khi đổi điểm lấy ưu đãi),
 * `lifetimePoints` chỉ tăng - nên khách dùng điểm không bị tụt hạng. Hồ sơ cũ chưa có thì lấy `points`.
 */
export function lifetimeOf(customer) {
  const lifetime = Number(customer?.lifetimePoints);
  return Number.isFinite(lifetime) ? lifetime : Number(customer?.points) || 0;
}

/** Hạng cao nhất mà số điểm này đạt được */
export function rankForPoints(points) {
  const p = Number(points) || 0;
  return [...MEMBER_RANKS].reverse().find((rank) => p >= rank.min) || MEMBER_RANKS[0];
}

/** Tên hạng (chuỗi lưu trong hồ sơ khách) theo tổng điểm */
export function tierForPoints(points) {
  return rankForPoints(points).label;
}

/**
 * Tổng % giảm giá dành cho khách hàng:
 * Lấy mức cao nhất giữa chiết khấu do Admin cấp riêng (customDiscount) và giảm giá theo hạng.
 */
export function getCustomerDiscountPercent(customer) {
  if (!customer) return 0;
  const adminDiscount = Number(customer.customDiscount) || 0;
  const rank = rankForPoints(lifetimeOf(customer));
  const rankDiscount = Number(rank.discountPercent) || 0;
  return Math.max(adminDiscount, rankDiscount);
}

/**
 * Tiến độ lên hạng: hạng hiện tại, hạng kế tiếp, còn thiếu bao nhiêu điểm, % quãng đường
 * từ mốc hạng hiện tại tới mốc hạng kế (hạng cao nhất -> next = null, percent = 100).
 */
export function rankProgress(points) {
  const p = Math.max(0, Number(points) || 0);
  const current = rankForPoints(p);
  const next = MEMBER_RANKS[MEMBER_RANKS.indexOf(current) + 1] || null;
  if (!next) return { current, next: null, toNext: 0, percent: 100 };
  const percent = Math.min(100, Math.floor(((p - current.min) / (next.min - current.min)) * 100));
  return { current, next, toNext: next.min - p, percent };
}

/** Tìm khách theo số điện thoại (đã chuẩn hoá +84 / 0), không thấy thì null */
export async function findCustomerByPhone(phone) {
  const target = normalizePhone(phone);
  if (!target) return null;
  const list = await getAllCustomers();
  return list.find((c) => normalizePhone(c.phone) === target) || null;
}

/**
 * Cộng điểm cho khách khi đơn của họ HOÀN TẤT (gọi từ ordersService.updateOrderStatus) và GHI LẠI
 * một dòng lịch sử điểm. Mỗi đơn chỉ được cộng MỘT lần (kiểm tra theo id đơn trong lịch sử).
 * Khách vãng lai hoặc khách đã bị xoá thì bỏ qua.
 * @param {string} customerId
 * @param {{id: string, code: string, total: number}} order
 * @returns {Promise<object|null>} hồ sơ khách sau khi cộng điểm, hoặc null nếu không cộng
 */
export async function awardPoints(customerId, order) {
  const earned = pointsForTotal(order?.total);
  if (!customerId || earned <= 0) return null;

  let customer;
  try {
    customer = await api.get(`/${CUSTOMER_COLLECTION}/${encodeURIComponent(customerId)}`);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }

  const history = Array.isArray(customer.pointHistory) ? customer.pointHistory : [];
  if (history.some((entry) => entry.orderId === order.id)) return customer; // đơn này đã được cộng rồi

  const points = (Number(customer.points) || 0) + earned;
  const lifetimePoints = lifetimeOf(customer) + earned; // hạng xét theo điểm tích luỹ, không tụt khi đổi điểm
  const entry = { type: "order", orderId: order.id, orderCode: order.code, total: order.total, points: earned, at: new Date().toISOString() };
  return api.patch(`/${CUSTOMER_COLLECTION}/${encodeURIComponent(customerId)}`, {
    points,
    lifetimePoints,
    tier: tierForPoints(lifetimePoints),
    pointHistory: [...history, entry],
  });
}

/** Tổng điểm đã trừ (âm) / hoàn (dương) của một đơn trong lịch sử; 0 = chưa trừ hoặc đã hoàn hết */
function redeemNet(history, orderCode) {
  return history
    .filter((e) => (e.type === "redeem" || e.type === "refund") && e.orderCode === orderCode)
    .reduce((sum, e) => sum + (Number(e.points) || 0), 0);
}

async function fetchCustomerRecord(customerId) {
  try {
    return await api.get(`/${CUSTOMER_COLLECTION}/${encodeURIComponent(customerId)}`);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

/**
 * TRỪ điểm khi khách dùng điểm để giảm giá một đơn. Chỉ trừ SỐ DƯ (points); lifetimePoints giữ
 * nguyên nên hạng không bị tụt. Mỗi đơn (theo mã) chỉ bị trừ một lần cho tới khi được hoàn.
 * @returns {Promise<object>} hồ sơ khách sau khi trừ
 */
export async function redeemPoints(customerId, points, order) {
  const amount = Math.floor(Number(points) || 0);
  if (!customerId || amount <= 0) throw new Error("Số điểm cần dùng không hợp lệ.");

  const customer = await fetchCustomerRecord(customerId);
  if (!customer) throw new Error("Không tìm thấy tài khoản thành viên để trừ điểm.");

  const history = Array.isArray(customer.pointHistory) ? customer.pointHistory : [];
  if (redeemNet(history, order.code) < 0) return customer; // đơn này đã trừ điểm rồi

  const balance = Number(customer.points) || 0;
  if (amount > balance) throw new Error(`Bạn chỉ có ${balance} điểm, không đủ để dùng ${amount} điểm.`);

  const entry = { type: "redeem", orderCode: order.code, points: -amount, at: new Date().toISOString() };
  return api.patch(`/${CUSTOMER_COLLECTION}/${encodeURIComponent(customerId)}`, {
    points: balance - amount,
    pointHistory: [...history, entry],
  });
}

/**
 * HOÀN điểm đã dùng cho một đơn (đơn bị huỷ/xoá). Chỉ hoàn khi đơn đó thật sự đã bị trừ và
 * chưa hoàn - gọi lặp lại không cộng thêm. Khách đã bị xoá thì bỏ qua.
 * @returns {Promise<object|null>}
 */
export async function refundPoints(customerId, order) {
  if (!customerId) return null;
  const customer = await fetchCustomerRecord(customerId);
  if (!customer) return null;

  const history = Array.isArray(customer.pointHistory) ? customer.pointHistory : [];
  const net = redeemNet(history, order.code);
  if (net >= 0) return customer; // chưa trừ hoặc đã hoàn rồi

  const entry = { type: "refund", orderCode: order.code, points: -net, at: new Date().toISOString() };
  return api.patch(`/${CUSTOMER_COLLECTION}/${encodeURIComponent(customerId)}`, {
    points: (Number(customer.points) || 0) - net,
    pointHistory: [...history, entry],
  });
}

/**
 * Đối chiếu phiên khách đang đăng nhập với máy chủ (điểm, hạng, tên có thể đã đổi
 * sau mỗi đơn hoàn tất). Máy chủ tắt thì giữ nguyên phiên; khách đã bị xoá thì đăng xuất.
 * @returns {Promise<{customer: object|null, changed: boolean}>}
 */
export async function syncCustomerSession() {
  const session = getItem(SESSION_KEY, null);
  if (!session) return { customer: null, changed: false };

  let record;
  try {
    record = await api.get(`/${CUSTOMER_COLLECTION}/${encodeURIComponent(session.id)}`);
  } catch (err) {
    if (err.status === 404) {
      customerLogout();
      return { customer: null, changed: true };
    }
    return { customer: session, changed: false };
  }

  const fresh = {
    ...session,
    name: record.name,
    avatar: record.avatar || "",
    tier: record.tier || session.tier,
    points: record.points || 0,
    lifetimePoints: lifetimeOf(record),
    customDiscount: Number(record.customDiscount) || 0,
    discountNote: record.discountNote || "",
  };
  const changed = fresh.name !== session.name || fresh.avatar !== session.avatar || fresh.tier !== session.tier || fresh.points !== session.points
    || fresh.lifetimePoints !== session.lifetimePoints || fresh.customDiscount !== session.customDiscount
    || fresh.discountNote !== session.discountNote;
  if (changed) {
    setItem(SESSION_KEY, fresh);
    dispatchAuthChange(fresh);
  }
  return { customer: fresh, changed };
}

/** Lấy toàn bộ danh sách khách hàng từ API (hoặc bộ đệm / seed) */
export async function getAllCustomers() {
  return await getCollection(CUSTOMER_COLLECTION, SEED_CUSTOMERS);
}

/**
 * Đăng nhập khách hàng
 * @param {string} identifier - Số điện thoại, Email hoặc Tên đăng nhập
 * @param {string} password - Mật khẩu xác thực
 */
export async function customerLogin(identifier, password) {
  const ident = String(identifier || "").trim().toLowerCase();
  const cleanPhone = normalizePhone(ident);
  const p = String(password || "");

  if (!ident) {
    return { success: false, message: "Vui lòng nhập Số điện thoại hoặc Email." };
  }
  if (!p) {
    return { success: false, message: "Vui lòng nhập Mật khẩu." };
  }

  try {
    const list = await getAllCustomers();
    const customer = list.find((c) => {
      const matchPhone = c.phone && normalizePhone(c.phone) === cleanPhone;
      const matchEmail = c.email && c.email.toLowerCase() === ident;
      const matchUser = c.username && c.username.toLowerCase() === ident;
      return matchPhone || matchEmail || matchUser;
    });

    if (!customer) {
      return { success: false, message: "Không tìm thấy tài khoản với thông tin đã nhập." };
    }

    if (customer.status === "inactive" || customer.status === "banned") {
      return {
        success: false,
        message: customer.banReason || "Tài khoản của quý khách đã bị tạm khóa do vi phạm quy định độ tuổi 18+ hoặc khai gian thông tin. Vui lòng liên hệ Quản lý Lê Thành Tài.",
      };
    }

    const passwordCheck = verifyPassword(p, customer.password);
    if (!passwordCheck.ok) {
      return { success: false, message: "Mật khẩu xác thực chưa chính xác." };
    }
    // Tài khoản cũ còn lưu mật khẩu chữ thường: băm lại ngay sau lần đăng nhập đúng
    if (passwordCheck.needsUpgrade) {
      api.patch(`/${CUSTOMER_COLLECTION}/${encodeURIComponent(customer.id)}`, { password: hashPassword(p) }).catch(() => {});
    }

    const sessionData = {
      id: customer.id,
      name: customer.name,
      avatar: customer.avatar || "",
      phone: customer.phone,
      email: customer.email || "",
      birthDate: customer.birthDate || "",
      tier: customer.tier || "Thành viên Mới",
      points: customer.points || 0,
      lifetimePoints: lifetimeOf(customer),
      customDiscount: Number(customer.customDiscount) || 0,
      discountNote: customer.discountNote || "",
      loginAt: new Date().toISOString(),
    };

    setItem(SESSION_KEY, sessionData);
    mergeGuestCartIntoCustomer(sessionData.id);
    dispatchAuthChange(sessionData);

    return { success: true, customer: sessionData };
  } catch (err) {
    return { success: false, message: err.message || "Lỗi kết nối máy chủ xác thực." };
  }
}

/**
 * Đăng ký tài khoản khách hàng mới
 * @param {Object} data { name, phone, email, password }
 */
export async function customerRegister({ name, phone, email, password, birthDate }) {
  const cleanName = String(name || "").trim();
  const cleanPhone = normalizePhone(phone);
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPass = String(password || "");

  if (cleanName.length < 2) {
    return { success: false, message: "Họ và tên cần có ít nhất 2 ký tự." };
  }
  if (!/^0[35789][0-9]{8}$/.test(cleanPhone)) {
    return { success: false, message: "Số điện thoại chưa đúng định dạng di động Việt Nam (10 chữ số)." };
  }
  if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { success: false, message: "Địa chỉ email không đúng định dạng." };
  }
  if (passwordProblem(cleanPass)) {
    return { success: false, message: passwordProblem(cleanPass) };
  }
  // Thành viên phải đủ tuổi được phục vụ đồ uống có cồn (ngày sinh do khách khai, quán đối chiếu CCCD khi khách đến)
  const cleanBirth = String(birthDate || "").trim();
  if (ageProblem(cleanBirth)) {
    return { success: false, message: ageProblem(cleanBirth) };
  }

  try {
    const list = await getAllCustomers();

    // Kiểm tra trùng SĐT
    const phoneExists = list.some((c) => c.phone && normalizePhone(c.phone) === cleanPhone);
    if (phoneExists) {
      return { success: false, message: `Số điện thoại ${phone} đã được đăng ký tài khoản trước đó.` };
    }

    // Kiểm tra trùng Email
    if (cleanEmail) {
      const emailExists = list.some((c) => c.email && c.email.toLowerCase() === cleanEmail);
      if (emailExists) {
        return { success: false, message: `Email ${cleanEmail} đã tồn tại trong hệ thống.` };
      }
    }

    const newCustomer = {
      id: `cust-${uid()}`,
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      birthDate: cleanBirth,
      password: hashPassword(cleanPass),
      status: "active",
      legalAgreed: true,
      idVerified: false,
      points: 20, // Tặng ngay 20 điểm chào mừng
      lifetimePoints: 20,
      tier: tierForPoints(20),
      pointHistory: [{ type: "welcome", points: 20, at: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
    };

    // Gửi lên máy chủ json-server và dùng bản ghi MÁY CHỦ TRẢ VỀ (json-server 1.x tự cấp id mới,
    // bỏ qua id trình duyệt gửi) - nếu dùng id tự sinh thì điểm thưởng/đồng bộ phiên sẽ tìm sai khách.
    let saved = newCustomer;
    try {
      saved = await api.post(`/${CUSTOMER_COLLECTION}`, newCustomer);
    } catch (err) {
      // Chỉ khi máy chủ TẮT mới lưu tạm trong trình duyệt. Lỗi khác (404, 500...) phải báo lỗi,
      // không được giả vờ "đăng ký thành công" trong khi máy chủ không hề lưu.
      if (!err.offline) throw err;
      const cached = getItem(`cache_${CUSTOMER_COLLECTION}`, [...SEED_CUSTOMERS]);
      cached.push(newCustomer);
      setItem(`cache_${CUSTOMER_COLLECTION}`, cached);
    }

    const sessionData = {
      id: saved.id,
      name: saved.name,
      avatar: saved.avatar || "",
      phone: saved.phone,
      email: saved.email,
      birthDate: saved.birthDate || cleanBirth,
      tier: saved.tier,
      points: saved.points,
      lifetimePoints: lifetimeOf(saved),
      loginAt: new Date().toISOString(),
    };

    setItem(SESSION_KEY, sessionData);
    mergeGuestCartIntoCustomer(sessionData.id);
    dispatchAuthChange(sessionData);

    // Tạo mã giảm giá 50% chào mừng thành viên mới và gửi thư xác nhận về Email
    const personalVoucherCode = `WELCOME50-${cleanPhone.slice(-4)}`;
    const welcomeVoucher = {
      id: `v-welcome-${cleanPhone}`,
      code: personalVoucherCode,
      description: `Mã chào mừng thành viên mới (${cleanName}): Giảm 50% tổng bill cho đơn đầu tiên`,
      type: "percent",
      value: 50,
      maxDiscount: 0,
      minOrder: 0,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      usageLimit: 1,
      usedCount: 0,
      active: true,
      phone: cleanPhone,
      email: cleanEmail,
      createdAt: new Date().toISOString(),
    };

    try {
      await api.post("/vouchers", welcomeVoucher);
    } catch {
      // Không chặn luồng nếu máy chủ vouchers offline
    }

    if (cleanEmail) {
      try {
        await sendWelcomeVoucherEmail({
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          voucherCode: personalVoucherCode,
          discountPercent: 50,
        });
      } catch (err) {
        console.warn("Không thể gửi email chào mừng:", err);
      }
    }

    return { success: true, customer: sessionData, voucherCode: personalVoucherCode };
  } catch (err) {
    return { success: false, message: err.message || "Lỗi tạo tài khoản khách hàng mới." };
  }
}

/** Lấy thông tin khách hàng đang đăng nhập */
export function getCurrentCustomer() {
  return getItem(SESSION_KEY, null);
}

/** Kiểm tra khách hàng đã đăng nhập hay chưa */
export function isCustomerLoggedIn() {
  return getCurrentCustomer() !== null;
}

/** Đăng xuất khách hàng */
export function customerLogout() {
  removeItem(SESSION_KEY);
  removeItem("quanbar_latest_order");
  removeItem("applied_voucher");
  removeItem("cart");
  dispatchAuthChange(null);
}

/**
 * Cập nhật trạng thái khách hàng (active / inactive do vi phạm 18+ hoặc thông tin ảo)
 * Dùng bởi Quản lý quán (Lê Thành Tài) trong admin-customers
 */
export async function updateCustomerStatus(customerId, status, reason = "") {
  return await api.patch(`/${CUSTOMER_COLLECTION}/${encodeURIComponent(customerId)}`, {
    status,
    banReason: reason,
    statusUpdatedAt: new Date().toISOString(),
  });
}

/** Mức chiết khấu riêng tối đa Quản lý được cấp (khớp ô nhập trong admin-customers.html) */
export const MAX_CUSTOM_DISCOUNT = 50;

/**
 * Cập nhật chiết khấu ưu đãi riêng cho khách hàng (dành cho Admin / Quản lý)
 * @param {string} customerId
 * @param {number} customDiscount Tỷ lệ giảm giá % (0 - MAX_CUSTOM_DISCOUNT)
 * @param {string} [discountNote] Lý do ưu đãi riêng
 */
export async function updateCustomerDiscount(customerId, customDiscount, discountNote = "") {
  const raw = customDiscount === "" || customDiscount === null || customDiscount === undefined ? 0 : Number(customDiscount);
  if (!Number.isFinite(raw) || raw < 0 || raw > MAX_CUSTOM_DISCOUNT) {
    throw new Error(`Chiết khấu riêng chỉ được từ 0% đến ${MAX_CUSTOM_DISCOUNT}%.`);
  }
  const discount = Math.round(raw);
  return await api.patch(`/${CUSTOMER_COLLECTION}/${encodeURIComponent(customerId)}`, {
    customDiscount: discount,
    discountNote: String(discountNote || "").trim(),
  });
}

/**
 * Cập nhật ảnh đại diện của khách hàng
 * @param {string} customerId
 * @param {string} avatarDataUrl Chuỗi Data URL (Base64) hoặc link ảnh
 */
export async function updateCustomerAvatar(customerId, avatarDataUrl) {
  if (!customerId) throw new Error("Không tìm thấy mã khách hàng.");
  const avatar = String(avatarDataUrl || "").trim();
  const saved = await api.patch(`/${CUSTOMER_COLLECTION}/${encodeURIComponent(customerId)}`, {
    avatar,
    avatarUpdatedAt: new Date().toISOString(),
  });

  const session = getCurrentCustomer();
  if (session && session.id === customerId) {
    const updatedSession = { ...session, avatar };
    setItem(SESSION_KEY, updatedSession);
    dispatchAuthChange(updatedSession);
  }
  return saved;
}

/**
 * Cập nhật thông tin hồ sơ của khách hàng (Họ tên, Email, Ngày sinh)
 * @param {string} customerId
 * @param {Object} profileData
 */
export async function updateCustomerProfile(customerId, { name, email, birthDate } = {}) {
  if (!customerId) throw new Error("Không tìm thấy mã khách hàng.");
  const payload = {};
  if (name !== undefined) payload.name = String(name).trim();
  if (email !== undefined) payload.email = String(email).trim().toLowerCase();
  if (birthDate !== undefined) payload.birthDate = String(birthDate).trim();
  payload.updatedAt = new Date().toISOString();

  const saved = await api.patch(`/${CUSTOMER_COLLECTION}/${encodeURIComponent(customerId)}`, payload);

  const session = getCurrentCustomer();
  if (session && session.id === customerId) {
    const updatedSession = { ...session, ...payload };
    setItem(SESSION_KEY, updatedSession);
    dispatchAuthChange(updatedSession);
  }
  return saved;
}

/**
 * Đổi mật khẩu cho khách hàng đang đăng nhập
 * @param {string} customerId
 * @param {string} oldPassword
 * @param {string} newPassword
 */
export async function changeCustomerPassword(customerId, oldPassword, newPassword, otp) {
  if (!customerId) return { success: false, message: "Không tìm thấy thông tin khách hàng." };
  const oldPass = String(oldPassword || "");
  const newPass = String(newPassword || "");

  if (!oldPass) return { success: false, message: "Vui lòng nhập mật khẩu hiện tại." };
  if (!newPass) return { success: false, message: "Vui lòng nhập mật khẩu mới." };

  const prob = passwordProblem(newPass);
  if (prob) return { success: false, message: prob };

  const customer = await fetchCustomerRecord(customerId);
  if (!customer) return { success: false, message: "Không tìm thấy tài khoản khách hàng trên hệ thống." };

  const checkOld = verifyPassword(oldPass, customer.password);
  if (!checkOld.ok) return { success: false, message: "Mật khẩu hiện tại không chính xác." };

  if (oldPass === newPass) {
    return { success: false, message: "Mật khẩu mới không được trùng với mật khẩu hiện tại." };
  }

  // Xác thực OTP (gửi qua Email hoặc SMS) - kiểm sau cùng để nhập sai mật khẩu không làm hao mã
  const otpCheck = verifyOtp(customerId, "change", otp);
  if (!otpCheck.ok) return { success: false, message: otpCheck.message };

  const newHash = hashPassword(newPass);
  await api.patch(`/${CUSTOMER_COLLECTION}/${encodeURIComponent(customerId)}`, {
    password: newHash,
    passwordUpdatedAt: new Date().toISOString(),
  });

  return { success: true, message: "Đổi mật khẩu thành công! Quý khách vui lòng ghi nhớ mật khẩu mới." };
}

/**
 * Gửi OTP xác thực cho khách ĐANG ĐĂNG NHẬP muốn đổi mật khẩu.
 * @param {string} customerId
 * @param {"email"|"sms"} channel cách nhận mã
 */
export async function requestChangePasswordOtp(customerId, channel) {
  const customer = await fetchCustomerRecord(customerId);
  if (!customer) return { success: false, message: "Không tìm thấy tài khoản khách hàng." };
  return issueOtp({ customer, channel, purpose: "change" });
}

/**
 * Yêu cầu gửi mã OTP để đặt lại mật khẩu khi quên
 * @param {string} identifier SĐT hoặc Email đã đăng ký
 * @param {"email"|"sms"} [channel] cách nhận mã (bỏ trống = Email nếu có, không thì SMS)
 */
export async function requestPasswordResetOtp(identifier, channel) {
  const ident = String(identifier || "").trim().toLowerCase();
  const cleanPhone = normalizePhone(ident);
  if (!ident) return { success: false, message: "Vui lòng nhập Số điện thoại hoặc Email đã đăng ký." };

  const list = await getAllCustomers();
  const customer = list.find((c) => {
    const matchPhone = c.phone && normalizePhone(c.phone) === cleanPhone;
    const matchEmail = c.email && c.email.toLowerCase() === ident;
    return matchPhone || matchEmail;
  });

  if (!customer) {
    return { success: false, message: "Không tìm thấy tài khoản tương ứng với số điện thoại hoặc email này." };
  }

  if (customer.status === "inactive" || customer.status === "banned") {
    return { success: false, message: "Tài khoản này hiện đang bị khóa. Vui lòng liên hệ quản lý quầy bar để được hỗ trợ." };
  }

  const issued = issueOtp({ customer, channel, purpose: "reset" });
  if (!issued.success) return issued;
  return { ...issued, customerId: customer.id, customerName: customer.name, channels: availableChannels(customer) };
}

/**
 * Đặt lại mật khẩu mới sau khi xác thực OTP (bắt buộc phải có OTP hợp lệ)
 * @param {Object} param0 { customerId, newPassword, otp }
 */
export async function resetCustomerPassword({ customerId, newPassword, otp }) {
  if (!customerId) return { success: false, message: "Thiếu thông tin tài khoản cần đặt lại mật khẩu." };
  const newPass = String(newPassword || "");

  const prob = passwordProblem(newPass);
  if (prob) return { success: false, message: prob };

  const customer = await fetchCustomerRecord(customerId);
  if (!customer) return { success: false, message: "Không tìm thấy tài khoản khách hàng." };

  const otpCheck = verifyOtp(customerId, "reset", otp);
  if (!otpCheck.ok) return { success: false, message: otpCheck.message };

  const newHash = hashPassword(newPass);
  await api.patch(`/${CUSTOMER_COLLECTION}/${encodeURIComponent(customerId)}`, {
    password: newHash,
    passwordUpdatedAt: new Date().toISOString(),
  });

  return { success: true, message: "Đặt lại mật khẩu thành công! Quý khách có thể đăng nhập bằng mật khẩu mới." };
}

/**
 * Đặt lại mật khẩu khách hàng từ phía Quản lý / Admin
 * @param {string} customerId
 * @param {string} [newPassword] Mặc định là 'Khach@123'
 */
export async function adminResetCustomerPassword(customerId, newPassword = "Khach@123") {
  if (!customerId) throw new Error("Thiếu mã khách hàng.");
  const prob = passwordProblem(newPassword);
  if (prob) throw new Error(prob);

  const newHash = hashPassword(newPassword);
  return await api.patch(`/${CUSTOMER_COLLECTION}/${encodeURIComponent(customerId)}`, {
    password: newHash,
    passwordUpdatedAt: new Date().toISOString(),
  });
}

/** Phát sự kiện thay đổi phiên đăng nhập khách hàng để các thành phần trên trang cập nhật */
function dispatchAuthChange(customer) {
  if (typeof globalThis.dispatchEvent === "function" && typeof CustomEvent === "function") {
    globalThis.dispatchEvent(new CustomEvent("customer-auth-change", { detail: { customer } }));
  }
}

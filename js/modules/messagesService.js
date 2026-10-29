/* =========================================================
   MESSAGES-SERVICE.JS - Tin nhắn liên hệ từ khách (trang Contact)
   Phía khách tạo tin nhắn (POST); phía quản trị đọc, đánh dấu đã
   xử lý và xoá. Dữ liệu lưu trên json-server tại /messages.
   ========================================================= */

import { api, getCollection } from "./api.js";
import { uid } from "./utils.js";

const COLLECTION = "messages";

/** GET /messages - mới nhất lên đầu */
export async function getAllMessages() {
  const list = await getCollection(COLLECTION, []);
  return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/** POST /messages */
export async function addMessage(data) {
  return api.post(`/${COLLECTION}`, {
    id: uid("msg"),
    ...data,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

/** PATCH /messages/:id - đánh dấu đã đọc / chưa đọc */
export async function setMessageRead(id, read = true) {
  return api.patch(`/${COLLECTION}/${encodeURIComponent(id)}`, { read });
}

/** PATCH /messages/:id - Admin phản hồi tin nhắn của khách */
export async function replyToMessage(id, replyText, repliedBy = "Quản trị viên") {
  const cleanReply = String(replyText || "").trim();
  if (!cleanReply) throw new Error("Vui lòng nhập nội dung phản hồi cho khách hàng.");
  return api.patch(`/${COLLECTION}/${encodeURIComponent(id)}`, {
    reply: cleanReply,
    repliedAt: new Date().toISOString(),
    repliedBy: String(repliedBy || "Quản trị viên").trim(),
    read: true, // đã phản hồi thì tự động coi là đã xử lý
  });
}

/** DELETE /messages/:id */
export async function deleteMessage(id) {
  await api.delete(`/${COLLECTION}/${encodeURIComponent(id)}`);
  return true;
}

/** Đếm số tin chưa đọc (hiện huy hiệu trên thanh quản trị) */
export async function countUnreadMessages() {
  const list = await getAllMessages();
  return list.filter((m) => !m.read).length;
}

/** Lọc tin nhắn có sẵn trong bộ nhớ theo từ khoá + trạng thái đọc/phản hồi */
export function filterMessages(messages, { keyword = "", readState = "all" } = {}) {
  let list = [...messages];

  const kw = keyword.trim().toLowerCase();
  if (kw) {
    list = list.filter((m) => [m.name, m.email, m.phone, m.message, m.reply]
      .some((field) => String(field || "").toLowerCase().includes(kw)));
  }
  if (readState === "unread") list = list.filter((m) => !m.read);
  if (readState === "read") list = list.filter((m) => m.read);
  if (readState === "replied") list = list.filter((m) => Boolean(m.reply));
  if (readState === "unreplied") list = list.filter((m) => !m.reply);

  return list;
}

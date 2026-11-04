/* =========================================================
   REVIEWS-SERVICE.JS - Quản lý Đánh giá & Bình luận Cocktail
   Cho phép khách hàng chấm sao (1 - 5 sao), viết nhận xét,
   hiển thị danh sách đánh giá thực tế và tính điểm trung bình.
   ========================================================= */

import { api } from "./api.js";
import { getItem, setItem } from "./storage.js";
import { getCurrentCustomer } from "./customerAuth.js";
import { uid } from "./utils.js";

const REVIEW_COLLECTION = "reviews";

export const SEED_REVIEWS = [
  {
    id: "rev-1",
    drinkId: "d1",
    drinkName: "Negroni Classico",
    customerId: "cust-1",
    customerName: "Nguyễn Hoàng Long",
    customerAvatar: "",
    rating: 5,
    comment: "Tỷ lệ 1:1:1 chuẩn xác, rượu đắng Campari hòa quyện cùng Sweet Vermouth Carpano rất mượt mà. Vỏ cam cháy tạo hương thơm quyến rũ!",
    createdAt: "2026-10-25T14:30:00.000Z",
  },
  {
    id: "rev-2",
    drinkId: "d1",
    drinkName: "Negroni Classico",
    customerId: "cust-2",
    customerName: "Trần Thị Mai",
    customerAvatar: "",
    rating: 5,
    comment: "Một trong những ly Negroni ngon nhất từng uống tại Sài Gòn. Đá vuông điêu khắc thủ công tan chậm, giữ vị đắng đậm đà từ đầu đến cuối.",
    createdAt: "2026-10-28T16:15:00.000Z",
  },
  {
    id: "rev-3",
    drinkId: "d2",
    drinkName: "Smoked Old Fashioned",
    customerId: "cust-3",
    customerName: "Lê Thành Tài",
    customerAvatar: "",
    rating: 5,
    comment: "Khói gỗ sồi hun tại bàn cực kỳ ấn tượng! Hậu vị bourbon nồng nàn, chút ngọt thanh của đường mía hữu cơ rất tinh tế.",
    createdAt: "2026-10-29T13:00:00.000Z",
  },
  {
    id: "rev-4",
    drinkId: "d3",
    drinkName: "Midnight Manhattan",
    customerId: "cust-1",
    customerName: "Nguyễn Hoàng Long",
    customerAvatar: "",
    rating: 5,
    comment: "Rye whiskey cay nồng kết hợp quả anh đào Maraschino ướp rượu gia truyền, một ly cocktail hoàn hảo cho đêm muộn.",
    createdAt: "2026-10-30T15:40:00.000Z",
  },
  {
    id: "rev-5",
    drinkId: "d4",
    drinkName: "Green Park Basil Velvet",
    customerId: "cust-2",
    customerName: "Trần Thị Mai",
    customerAvatar: "",
    rating: 5,
    comment: "Vị thanh mát tuyệt vời của húng tây tươi và chanh vàng, bọt lòng trắng mịn như nhung. Rất hợp cho bạn gái!",
    createdAt: "2026-10-31T12:20:00.000Z",
  },
];

/** Lấy toàn bộ danh sách đánh giá từ API hoặc cache */
export async function getAllReviews() {
  try {
    const list = await api.get(`/${REVIEW_COLLECTION}`);
    if (Array.isArray(list) && list.length > 0) {
      setItem(`cache_${REVIEW_COLLECTION}`, list);
      return list;
    }
  } catch {
    // Nếu API chưa có bảng, dùng cache hoặc seed
  }
  return getItem(`cache_${REVIEW_COLLECTION}`, [...SEED_REVIEWS]);
}

/** Lấy danh sách đánh giá cho một ly cocktail cụ thể (mới nhất xếp trước) */
export async function getDrinkReviews(drinkId) {
  if (!drinkId) return [];
  const all = await getAllReviews();
  return all
    .filter((r) => String(r.drinkId) === String(drinkId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Gửi đánh giá & bình luận mới cho một món
 * @param {Object} param0 { drinkId, drinkName, rating, comment, customerName }
 */
export async function addDrinkReview({ drinkId, drinkName, rating, comment, customerName = "" }) {
  if (!drinkId) throw new Error("Thiếu mã món cocktail.");
  const numRating = Math.max(1, Math.min(5, Math.round(Number(rating) || 5)));
  const cleanComment = String(comment || "").trim();

  if (!cleanComment || cleanComment.length < 3) {
    throw new Error("Vui lòng nhập nhận xét tối thiểu 3 ký tự.");
  }

  const session = getCurrentCustomer();
  const authorName = session?.name || String(customerName || "").trim() || "Thực khách Quán Bar Đêm";
  const authorAvatar = session?.avatar || "";
  const authorId = session?.id || `guest-${uid()}`;

  const newReview = {
    id: `rev-${Date.now()}-${uid()}`,
    drinkId: String(drinkId),
    drinkName: String(drinkName || ""),
    customerId: authorId,
    customerName: authorName,
    customerAvatar: authorAvatar,
    rating: numRating,
    comment: cleanComment,
    createdAt: new Date().toISOString(),
  };

  let saved = newReview;
  try {
    saved = await api.post(`/${REVIEW_COLLECTION}`, newReview);
  } catch {
    const cached = getItem(`cache_${REVIEW_COLLECTION}`, [...SEED_REVIEWS]);
    cached.unshift(newReview);
    setItem(`cache_${REVIEW_COLLECTION}`, cached);
  }

  // Phát sự kiện để giao diện cập nhật ngay
  if (typeof globalThis.dispatchEvent === "function" && typeof CustomEvent === "function") {
    globalThis.dispatchEvent(new CustomEvent("drink-review-added", { detail: { review: saved } }));
  }

  return saved;
}

/** Xoá một đánh giá (dành cho Admin / Quản trị viên) */
export async function deleteReview(reviewId) {
  if (!reviewId) throw new Error("Thiếu mã đánh giá.");
  try {
    await api.delete(`/${REVIEW_COLLECTION}/${encodeURIComponent(reviewId)}`);
  } catch {
    const cached = getItem(`cache_${REVIEW_COLLECTION}`, [...SEED_REVIEWS]);
    const filtered = cached.filter((r) => String(r.id) !== String(reviewId));
    setItem(`cache_${REVIEW_COLLECTION}`, filtered);
  }
  return true;
}

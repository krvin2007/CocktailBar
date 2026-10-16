/* =========================================================
   AI-ASSISTANT.JS - Bộ não của Trợ lý AI (khung chat)

   Hai tầng trả lời - OFFLINE TRƯỚC để tiết kiệm token:
   1. Trợ lý OFFLINE (0 token): bộ luật + chấm điểm từ khoá trên DỮ LIỆU
      THẬT của quán (thực đơn, giá sau sale, món bán chạy, món mới, mã giảm
      giá công khai). Câu nào nhận diện được (kể cả câu ngoài lề -> từ chối)
      thì trả lời ngay, KHÔNG gọi AI.
   2. Gemini AI (trực tuyến): chỉ câu offline KHÔNG hiểu mới gửi lịch sử chat
      lên POST /ai/chat của json-server (middleware tools/ai-middleware.cjs).
      Máy chủ giữ khoá API bí mật và tự dựng ngữ cảnh từ db.json. Máy chủ
      không có khoá / quá tải / mất mạng -> dùng câu trả lời offline.

   Engine offline là hàm THUẦN answerOffline(text, { drinks, orders,
   vouchers, now }) - không đụng DOM, không gọi API - nên kiểm thử được
   bằng Node. Module chỉ trả dữ liệu ({ text, drinkIds }), việc hiển thị
   (escape HTML, thẻ món) do chatWidget.js đảm nhận.
   ========================================================= */

import { API_BASE } from "./api.js";
import {
  getAllDrinks, getDrinkPricing, rankBestSellers, getNewestDrinks,
  CATEGORY_LABELS, NEW_DRINK_DAYS, NEW_DRINK_DISCOUNT, SEED_DRINKS,
} from "./drinksService.js";
import { getAllOrders } from "./ordersService.js";
import { getPublicVouchers, BIRTHDAY_DISCOUNT, WELCOME_DISCOUNT, WELCOME_VALID_DAYS } from "./vouchersService.js";
import { formatMoney } from "./utils.js";

/* =========================================================
   CẤU HÌNH & THÔNG TIN QUÁN
   ========================================================= */

const MAX_HISTORY = 12;          // khớp giới hạn của middleware
const MAX_MESSAGE_CHARS = 1000;
const MAX_SUGGESTIONS = 3;       // tối đa 3 món mỗi câu trả lời offline
const AI_TIMEOUT_MS = 50000;     // AI có thể cần vài chục giây
const STATUS_TIMEOUT_MS = 5000;
const DATA_CACHE_MS = 60 * 1000; // dữ liệu offline dùng lại trong 60 giây

const BAR = {
  address: "123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM",
  hours: "18:00 – 02:00 mỗi đêm (kể cả ngày lễ)",
  phone: "(028) 1234 5678 · 090 123 4567",
  timeZone: "Asia/Ho_Chi_Minh",
  openHour: 18,
  closeHour: 2,
};

/* =========================================================
   CHUẨN HOÁ VĂN BẢN TIẾNG VIỆT
   ========================================================= */

/**
 * Bỏ dấu tiếng Việt + chữ thường + gọn khoảng trắng để so khớp từ khoá:
 * "Gợi ý món NGỌT nhẹ!" -> "goi y mon ngot nhe". Giữ lại chữ số và các
 * ký tự cần cho việc đọc số tiền / phần trăm (. , % + -).
 */
export function normalizeText(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9%+.,\s-]/g, " ")
    .replace(/([a-z])[.,]+(?=\s|$)/g, "$1") // dấu chấm/phẩy cuối từ: "ngot." -> "ngot"
    .replace(/\s+/g, " ")
    .trim();
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const phraseRegexCache = new Map();

/** Cụm từ `phrase` (đã bỏ dấu) có xuất hiện như một từ/cụm từ trọn vẹn trong `norm` không */
function hasPhrase(norm, phrase) {
  let re = phraseRegexCache.get(phrase);
  if (!re) {
    re = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(phrase)}(?=$|[^a-z0-9])`);
    phraseRegexCache.set(phrase, re);
  }
  return re.test(norm);
}

const hasAny = (norm, phrases) => phrases.some((p) => hasPhrase(norm, p));
const countAny = (norm, phrases) => phrases.reduce((sum, p) => sum + (hasPhrase(norm, p) ? 1 : 0), 0);

/** Khách gõ CÓ dấu tiếng Việt không (để phân biệt "chua"/"chưa", "đắng"/"đang") */
function hasVietnameseMarks(text) {
  return /[̀-ͯđĐ]/.test(String(text).normalize("NFD"));
}

/* =========================================================
   TỪ KHOÁ NHẬN DIỆN Ý ĐỊNH (đều ở dạng KHÔNG dấu)
   ========================================================= */

const KW = {
  greeting: ["xin chao", "chao", "chao ban", "chao em", "chao shop", "hello", "hi", "hey", "alo", "good evening", "good night"],
  thanks: ["cam on", "cam on nhieu", "thank", "thanks", "thank you", "tks", "ok cam on"],
  bye: ["tam biet", "bye", "goodbye", "hen gap lai"],
  hours: ["gio mo cua", "mo cua", "dong cua", "may gio", "gio hoat dong", "gio lam viec", "con mo", "mo den", "opening hours", "open", "close", "hours", "khung gio"],
  address: ["dia chi", "o dau", "cho nao", "duong nao", "chi duong", "ban do", "vi tri", "address", "where", "location", "quan nao", "toi quan", "den quan"],
  contact: ["hotline", "so dien thoai", "sdt", "lien he", "goi dien", "phone", "contact", "zalo"],
  booking: ["dat ban", "dat cho", "giu ban", "giu cho", "book", "booking", "reservation", "reserve", "dat truoc", "dat tiec", "ban vip", "phong vip"],
  ordering: ["dat mon", "goi mon", "cach dat", "cach goi", "order", "mua", "giao hang", "ship", "mang di", "mang ve", "takeaway", "thanh toan", "chuyen khoan", "vietqr", "tien mat", "quet ma"],
  voucher: ["ma giam gia", "ma giam", "ma khuyen mai", "ma uu dai", "ma sale", "voucher", "coupon", "promo code", "discount code", "code", "co ma", "ma nao", "ma gi", "nhap ma"],
  promo: ["khuyen mai", "uu dai", "giam gia", "chuong trinh", "sale", "discount", "promotion", "deal", "dang giam", "duoc giam"],
  birthday: ["sinh nhat", "birthday", "bday", "ngay sinh"],
  newCustomer: ["khach moi", "khach hang moi", "nguoi moi", "nguoi dung moi", "thanh vien moi", "lan dau", "don dau", "dau tien", "dang ky", "dang ki", "new customer", "first order", "sign up", "register", "thanh vien"],
  newDrink: ["mon moi", "moi ra mat", "moi nhat", "moi len", "vua ra mat", "do uong moi", "cocktail moi", "thuc uong moi", "new drink", "new drinks", "newest", "latest", "ra mat"],
  bestSeller: ["ban chay", "pho bien", "hot", "nhieu nguoi", "best seller", "bestseller", "best sellers", "noi bat", "duoc yeu thich", "yeu thich nhat", "goi nhieu", "top", "popular", "must try", "dang thu", "dac trung", "ngon nhat"],
  recommend: ["goi y", "de xuat", "tu van", "nen uong", "nen goi", "uong gi", "recommend", "suggest", "chon giup", "chon dum", "thuc don", "menu", "co mon nao", "mon nao", "loai nao", "uong nao", "cocktail nao", "do uong", "mon gi"],
  similar: ["giong", "tuong tu", "thay the", "na na", "similar", "like"],
  drive: ["lai xe", "lai oto", "lai o to", "chay xe", "di xe", "tu lai", "drive", "driving", "cam lai", "lai xe may"],
  underagePhrases: ["duoi 18", "chua du 18", "chua du tuoi", "vi thanh nien", "hoc sinh", "under 18", "minor", "chua 18"],
  ageQuestion: ["bao nhieu tuoi", "do tuoi", "gioi han tuoi", "may tuoi", "18 tuoi", "18+", "du tuoi", "age limit"],
  nonAlcoholic: ["khong con", "khong co con", "khong chua con", "khong do", "mocktail", "non alcoholic", "alcohol free", "0 do", "khong uong duoc ruou", "khong uong ruou", "nuoc ngot", "soft drink"],
  cheapest: ["re nhat", "gia thap nhat", "re", "binh dan", "tiet kiem", "cheapest", "cheap", "gia mem", "hop tui"],
  priciest: ["dat nhat", "cao cap nhat", "sang nhat", "xin nhat", "dat tien nhat", "most expensive", "premium", "thuong hang", "sang chanh"],
  strong: ["manh", "do manh", "do cao", "do con cao", "nong do cao", "strong", "boozy", "nang do", "uong manh", "say"],
  light: ["nhe", "nhe nhang", "it con", "do con thap", "nong do thap", "de uong", "light", "easy", "nhe do", "do nhe", "khong qua manh", "khong manh"],
  priceInfo: ["gia", "bao nhieu tien", "bang gia", "price", "gia ca", "muc gia", "bao nhieu"],
  drinkWords: ["mon", "do uong", "thuc uong", "cocktail", "ly", "ruou", "drink", "drinks", "mon nao", "nuoc"],
  // ---- Giữ cuộc trò chuyện trong phạm vi website ----
  identity: ["ban la ai", "ban ten gi", "ten ban la gi", "who are you", "your name", "ban la bot", "ban la nguoi", "ban co phai la nguoi", "ai tao ra ban", "ban la chatgpt", "ban dung model gi", "ban lam duoc gi", "ban giup duoc gi", "what can you do"],
  injection: ["bo qua moi huong dan", "bo qua huong dan", "bo qua cac huong dan", "bo qua tat ca huong dan", "bo qua quy tac", "bo qua moi quy tac", "quen het huong dan", "quen moi quy tac", "ignore previous", "ignore all", "ignore the above", "ignore your instructions", "system prompt", "loi nhac he thong", "prompt cua ban", "jailbreak", "developer mode", "dan mode", "dong vai", "gia lam", "pretend you", "act as", "roleplay"],
  privacy: ["mat khau", "password", "tai khoan admin", "admin", "quan tri vien", "trang quan tri", "thong tin khach", "danh sach khach", "so dien thoai khach", "sdt khach", "email khach", "dia chi khach", "du lieu khach", "khach hang khac", "ma cua khach", "ma ca nhan cua", "don hang cua nguoi", "don cua nguoi khac", "thong tin nhan vien", "luong nhan vien", "danh sach nhan vien", "api key", "khoa api", "db.json", "co so du lieu", "database"],
  offTopic: ["python", "javascript", "java", "lap trinh", "viet code", "code python", "html", "css", "sql", "thuat toan", "algorithm", "programming",
    "thoi tiet", "weather", "bitcoin", "crypto", "tien ao", "chung khoan", "co phieu", "gia vang", "ty gia", "usd", "stock",
    "chinh tri", "tong thong", "thu tuong", "bau cu", "chien tranh", "politics", "president", "election",
    "bong da", "messi", "ronaldo", "world cup", "football", "the thao", "tin tuc", "thoi su", "news",
    "thu do", "lich su viet nam", "dia ly", "giai phuong trinh", "phuong trinh", "dao ham", "tich phan", "vat ly", "hoa hoc", "math",
    "bai tap", "homework", "ielts", "toefl", "dich sang", "dich giup", "dich cau", "translate", "viet bai", "viet van", "bai van", "essay", "lam tho", "bai tho", "poem",
    "ke chuyen", "chuyen cuoi", "joke", "nau an", "cach nau", "cong thuc nau", "nau pho", "recipe for", "benh", "bac si", "covid", "doctor",
    "tu vi", "horoscope", "boi bai", "xem boi", "cung hoang dao", "phim", "movie", "game", "chatgpt", "openai", "gemini", "tinh yeu", "that tinh"],
  // Có các từ này thì câu hỏi vẫn thuộc phạm vi quán dù lẫn từ khoá ngoài lề
  onTopicAnchors: ["cocktail", "thuc don", "menu", "ma giam", "voucher", "dat ban", "do uong", "thuc uong", "ruou", "khuyen mai", "uu dai", "quan bar", "bartender", "uong", "mon nao", "goi y"],
  menuBook: ["menu bia da", "quyen menu", "menu 3d", "menu lat", "lat trang", "so menu"],
  facilities: ["wifi", "wi-fi", "dau xe", "gui xe", "bai xe", "cho de xe", "parking", "may lanh", "dieu hoa", "hut thuoc", "thuoc la", "smoking", "thu cung", "pet", "dress code", "trang phuc", "the tin dung", "quet the", "credit card", "nha ve sinh", "toilet", "tre em", "phong rieng", "karaoke"],
  delivery: ["giao hang", "ship", "mang di", "mang ve", "takeaway", "take away", "delivery", "grab food", "shopee food", "giao tan noi"],
  heritage: ["ham ruou", "ham ruou di san", "master bartender", "master bartenders", "huyen thoai", "nha suu tam", "suu tam", "collector", "collectors", "di san"],
  lookupWords: ["la gi", "the nao", "ra sao", "gom gi", "co gi", "mo ta", "thong tin", "gia", "bao nhieu", "con khong", "con hang", "nhu nao", "what is", "how much", "vi gi"],
};

/**
 * Khẩu vị:
 * - `ask`   = khách nói gì (dạng không dấu; từ đa nghĩa như "chua"/"chưa" được
 *             xử lý riêng ở bảng AMBIGUOUS bên dưới)
 * - `match` = dấu hiệu KHÔNG DẤU trong dữ liệu món (tên, mô tả, hương vị, thành phần)
 * - `exact` = dấu hiệu phải khớp ĐÚNG DẤU vì bỏ dấu sẽ nhầm nghĩa:
 *             "khói" ≠ "khối" (đá khối), "đắng" ≠ "dịu dàng", "cay" ≠ "trái cây"...
 */
const TASTES = [
  { key: "sweet", label: "ngọt", ask: ["ngot", "ngot ngao", "sweet", "ngot diu", "ngot nhe"],
    match: ["ngot", "mat ong", "caramel", "vani", "vanilla", "socola", "chocolate", "qua mong", "nam viet quat", "cranberry", "kahlua", "anh dao", "maraschino", "marmalade"],
    exact: ["mứt"] },
  { key: "sour", label: "chua", ask: ["chua", "sour"],
    match: ["sour", "nuoc cot chanh", "chanh tuoi", "chanh xanh", "lime"], exact: ["chua"] },
  { key: "bitter", label: "đắng", ask: ["dang", "bitter"],
    match: ["bitter", "campari", "fernet", "aperol", "amaro"], exact: ["đắng"] },
  { key: "smoky", label: "khói", ask: ["khoi", "smoky", "smoke", "than bun", "peat", "peaty", "xong khoi"],
    match: ["than bun", "peat", "smoked", "islay"], exact: ["khói"] },
  { key: "coffee", label: "cà phê", ask: ["ca phe", "cafe", "coffee", "espresso"],
    match: ["ca phe", "coffee", "espresso", "kahlua"] },
  { key: "fruity", label: "trái cây", ask: ["trai cay", "hoa qua", "fruity", "fruit", "vi cam", "huong cam", "tao", "buoi", "qua mong", "berry"],
    match: ["trai cay", "hoa qua", "qua mong", "viet quat", "nam viet quat", "cranberry", "anh dao", "marmalade", "maraschino"],
    exact: ["cam", "táo", "bưởi", "nho", "quả", "mứt"] },
  { key: "mint", label: "bạc hà", ask: ["bac ha", "mint", "the mat"], match: ["bac ha", "mint"] },
  { key: "herbal", label: "thảo mộc", ask: ["thao moc", "herbal", "herb", "hung que", "rau thom", "botanical"],
    match: ["thao moc", "hung que", "hung tay", "basil", "absinthe", "botanical", "fernet", "47 loai"], exact: ["hồi"] },
  { key: "refreshing", label: "sảng khoái", ask: ["sang khoai", "mat lanh", "thanh mat", "giai nhiet", "refreshing", "refresh", "tuoi mat", "giai khat", "mat me"],
    match: ["sang khoai", "thanh mat", "mat lanh", "soda", "tonic", "bac ha", "tuoi sang", "prosecco", "champagne", "thanh tao"], exact: ["sủi"] },
  { key: "sparkling", label: "sủi bọt", ask: ["sui", "sui bot", "sui tam", "bubbly", "sparkling", "co ga"],
    match: ["champagne", "prosecco", "soda", "tonic"], exact: ["sủi"] },
  { key: "spicy", label: "cay ấm", ask: ["cay", "am", "gia vi", "spicy", "am nong", "am ap", "warm"],
    match: ["gia vi", "gung", "tieu", "am nong", "am ap", "tram am"], exact: ["cay"] },
  { key: "creamy", label: "mượt béo", ask: ["beo", "muot", "creamy", "bot min", "velvet", "kem"],
    match: ["velvet", "crema", "long trang trung", "bot min", "bot muot"], exact: ["kem", "mượt", "nhung", "bọt"] },
];

/** Rượu nền: xét theo thứ tự - loại cụ thể (bourbon, scotch) đứng trước loại chung (whisky) */
const SPIRITS = [
  { key: "bourbon", label: "Bourbon", ask: ["bourbon"], match: ["bourbon"] },
  { key: "scotch", label: "Scotch", ask: ["scotch", "single malt", "macallan", "lagavulin", "islay"], match: ["scotch", "single malt", "malt"] },
  { key: "whisky", label: "Whisky", ask: ["whisky", "whiskey", "rye", "uytxki", "uy ki", "wisky", "ruou whisky"], match: ["whisky", "whiskey", "bourbon", "scotch", "rye", "single malt"] },
  { key: "gin", label: "Gin", ask: ["gin"], match: ["gin"] },
  { key: "rum", label: "Rum", ask: ["rum", "ron"], match: ["rum"] },
  { key: "tequila", label: "Tequila", ask: ["tequila", "agave", "mezcal"], match: ["tequila", "agave"] },
  { key: "vodka", label: "Vodka", ask: ["vodka"], match: ["vodka"] },
  { key: "cognac", label: "Cognac / Brandy", ask: ["cognac", "brandy", "calvados", "hennessy"], match: ["cognac", "brandy", "calvados"] },
  { key: "champagne", label: "Champagne / vang sủi", ask: ["champagne", "sampanh", "prosecco", "vang sui", "ruou vang"], match: ["champagne", "prosecco"] },
  { key: "aperitivo", label: "Campari / Aperol", ask: ["campari", "aperol"], match: ["campari", "aperol"] },
];

/** Danh mục thực đơn theo cách khách hay gọi */
const CATEGORY_ASK = {
  classic: ["co dien", "classic", "kinh dien", "truyen thong"],
  signature: ["dac tuyen", "signature", "doc dao", "sang tao", "dac biet"],
  "sour-fizz": ["highball", "fizz", "sour fizz"],
  aperitivo: ["aperitivo", "khai vi", "spritz"],
  spirits: ["ruou manh", "uong neat", "neat", "nguyen chai", "ruou nguyen chat", "uong thang"],
};

/** Từ trong TÊN món không đủ để nhận ra món (quá chung chung) */
const NAME_STOPWORDS = new Set([
  "the", "and", "of", "de", "la", "y", "classic", "classico", "reserve", "dry", "gin", "rum", "whisky", "whiskey",
  "bourbon", "tequila", "vodka", "cognac", "scotch", "single", "malt", "champagne", "old", "new", "cask", "sour",
  "x.o", "years", "year", "ruou", "cocktail",
]);

/* =========================================================
   TIỆN ÍCH DỮ LIỆU
   ========================================================= */

const toMs = (now) => {
  const ms = now instanceof Date ? now.getTime() : new Date(now ?? Date.now()).getTime();
  return Number.isNaN(ms) ? Date.now() : ms;
};

const isAvailable = (drink) => drink?.status === "available" && Number(drink?.stock) > 0;

const haystackCache = new WeakMap();

/**
 * Văn bản mô tả một món để chấm điểm từ khoá, ở 2 dạng: `norm` (bỏ dấu) và
 * `lower` (giữ dấu - cho các từ dễ nhầm nghĩa khi bỏ dấu). Có bộ nhớ đệm theo món.
 */
function drinkHaystack(drink) {
  if (haystackCache.has(drink)) return haystackCache.get(drink);
  const text = [
    drink.name, drink.description, drink.baseSpirit, drink.category, CATEGORY_LABELS[drink.category],
    ...(Array.isArray(drink.tasteNotes) ? drink.tasteNotes : []),
    ...(Array.isArray(drink.ingredients) ? drink.ingredients : []),
  ].filter(Boolean).join(" . ");
  const hay = { norm: normalizeText(text), lower: text.normalize("NFC").toLowerCase() };
  haystackCache.set(drink, hay);
  return hay;
}

/** Số dấu hiệu của một khẩu vị có trong món (khớp không dấu + khớp đúng dấu) */
function tasteHits(drink, taste) {
  const hay = drinkHaystack(drink);
  return countAny(hay.norm, taste.match || []) + (taste.exact || []).reduce((n, w) => n + (hasExact(hay.lower, w) ? 1 : 0), 0);
}

/** Văn bản về rượu nền của món (tên + rượu nền + thành phần) */
function spiritHaystack(drink) {
  return normalizeText([drink.name, drink.baseSpirit, ...(Array.isArray(drink.ingredients) ? drink.ingredients : [])].join(" . "));
}

/** Đọc ngày bắt đầu/kết thúc của mã (chuỗi "YYYY-MM-DD" hiểu theo giờ địa phương như vouchersService) */
function voucherDate(value, endOfDay) {
  if (!value) return null;
  const text = String(value);
  let date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [y, m, d] = text.split("-").map(Number);
    date = endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d);
  } else {
    date = new Date(text);
  }
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Mã CÔNG KHAI còn dùng được tại thời điểm `now`. Nhận cả Voucher (vouchersService)
 * lẫn object thuần - nhờ vậy test Node truyền SEED_VOUCHERS trực tiếp được.
 */
function isPublicUsable(v, nowMs) {
  if (!v || v.active === false || v.active === "false" || v.customerId || v.audience === "birthday") return false;
  const start = voucherDate(v.startDate, false);
  const end = voucherDate(v.endDate, true);
  if (start && nowMs < start.getTime()) return false;
  if (end && nowMs > end.getTime()) return false;
  const limit = Math.max(0, Number(v.usageLimit) || 0);
  if (limit > 0 && (Number(v.usedCount) || 0) >= limit) return false;
  return Boolean(v.code) && Number(v.percent) > 0;
}

function voucherLine(v) {
  const parts = [`• **${v.code}** – giảm ${Number(v.percent)}%`];
  parts.push(Number(v.minOrder) > 0 ? `đơn từ ${formatMoney(v.minOrder)}` : "mọi giá trị đơn");
  if (Number(v.maxDiscount) > 0) parts.push(`tối đa ${formatMoney(v.maxDiscount)}`);
  if (v.audience === "new-customer") parts.push("dành cho đơn đầu tiên");
  const limit = Number(v.usageLimit) || 0;
  if (limit > 0) parts.push(`còn ${Math.max(0, limit - (Number(v.usedCount) || 0))} lượt`);
  const end = voucherDate(v.endDate, true);
  if (end) parts.push(`hạn ${end.toLocaleDateString("vi-VN")}`);
  return parts.join(" · ");
}

/** Giờ hiện tại theo giờ Việt Nam (0-23) */
function vnHour(nowMs) {
  try {
    return Number(new Intl.DateTimeFormat("en-GB", { timeZone: BAR.timeZone, hour: "2-digit", hourCycle: "h23" }).format(new Date(nowMs)));
  } catch {
    return new Date(nowMs).getHours();
  }
}

const isOpenAt = (nowMs) => {
  const h = vnHour(nowMs);
  return h >= BAR.openHour || h < BAR.closeHour;
};

/** Một dòng giới thiệu món: tên, giá sau sale (kèm giá gốc), ABV, hương vị */
function drinkLine(drink, nowMs, extra = "") {
  const p = getDrinkPricing(drink, nowMs);
  let price = formatMoney(p.finalPrice);
  if (p.onSale) price += ` (gốc ${formatMoney(p.originalPrice)}, −${p.percent}%${p.reason === "new" ? " món mới" : ""})`;
  const notes = (Array.isArray(drink.tasteNotes) ? drink.tasteNotes : []).slice(0, 2).join(", ");
  return [`• **${drink.name}** – ${price}`, `${Number(drink.abv) || 0}% ABV`, notes, extra].filter(Boolean).join(" · ");
}

/* =========================================================
   PHÂN TÍCH CÂU HỎI
   ========================================================= */

/**
 * Từ đa nghĩa khi BỎ DẤU. Khách gõ có dấu -> so khớp đúng dấu (`exact`).
 * Khách gõ không dấu -> đoán theo từ đứng trước/sau:
 *   notNext / notPrev: gặp các từ này thì KHÔNG phải nghĩa cần tìm
 *     ("chua biet" = chưa biết, "dang sale" = đang sale, "da khoi" = đá khối...)
 *   needPrev: chỉ tính khi đứng sau các từ này ("ngot nhe" = ngọt nhẹ,
 *     còn "cam on nhe" = cảm ơn nhé); okNext: hoặc đứng trước các từ này.
 */
const AMBIGUOUS = {
  chua: { exact: "chua", notNext: ["biet", "co", "tung", "du", "den", "dat", "uong", "thu", "ro", "hieu", "nghi", "chon", "quyet", "lam", "xong", "kip", "duoc", "mo", "dang", "nhan", "tim", "an", "toi", "a", "ha"] },
  dang: { exact: "đắng", notNext: ["sale", "giam", "co", "mo", "ban", "chay", "khuyen", "uu", "hoat", "lam", "tim", "muon", "phuc", "ap", "nghi", "o", "uong", "can", "dien", "ra", "trong", "con", "hot", "duoc", "dung", "het", "la", "ky", "ki", "nhap"] },
  nhe: { exact: "nhẹ", needPrev: ["ngot", "chua", "dang", "mon", "do", "cocktail", "loai", "ly", "uong", "vi", "ruou", "hoi", "chut", "khoai", "mat", "thom", "con", "it", "thanh", "diu", "tuoi", "hon", "rat", "kha", "that", "sieu", "cuc", "nhat"], okNext: ["nhang", "do", "nhat", "thoi", "thanh", "diu", "hon"] },
  khoi: { exact: "khói", notNext: ["can", "phai", "lo", "bi", "noi", "da"], notPrev: ["da", "mot"] },
  tao: { exact: "táo", needPrev: ["vi", "huong", "nuoc", "ep", "qua", "ruou", "mui", "chat"], okNext: ["xanh", "do", "tuoi", "ep"] },
  buoi: { exact: "bưởi", notNext: ["toi", "sang", "chieu", "trua", "dem", "hen", "tiec", "gap", "nay", "do", "hom", "tap"] },
  kem: { exact: "kem", notNext: ["ngot", "hon", "chua", "dang", "manh", "nhe", "vui"] },
  mua: { exact: "mua", notPrev: ["troi", "con", "gap", "dang", "bi", "do"] },
  cay: { exact: "cay", notPrev: ["trai", "cai", "may", "con"], notNext: ["so", "xang", "co"] },
  re: { exact: "rẻ", notNext: ["trai", "phai"] },
  am: { exact: "ấm", needPrev: ["cho", "vi", "huong", "hoi", "that", "rat", "de", "uong", "nong", "tram"] },
  manh: { exact: "mạnh" },
  sui: { exact: "sủi" },
  gia: { exact: "giá", notNext: ["vi", "dinh", "su"] },
};

/** Bối cảnh một câu hỏi: bản bỏ dấu, bản giữ dấu, danh sách từ */
function makeContext(raw) {
  const norm = normalizeText(raw);
  return {
    raw,
    norm,
    lower: String(raw).normalize("NFC").toLowerCase(),
    accented: hasVietnameseMarks(raw),
    tokens: norm.split(/[^a-z0-9]+/).filter(Boolean),
  };
}

const exactRegexCache = new Map();

/** Từ `word` (CÓ dấu) xuất hiện trọn vẹn trong văn bản `lower` (giữ dấu, chữ thường) */
function hasExact(lower, word) {
  let re = exactRegexCache.get(word);
  if (!re) {
    re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegex(word)}(?=$|[^\\p{L}\\p{N}])`, "u");
    exactRegexCache.set(word, re);
  }
  return re.test(lower);
}

/** Khách có nhắc tới từ/cụm từ `phrase` không - xử lý riêng các từ đa nghĩa khi bỏ dấu */
function mentions(ctx, phrase) {
  const rule = AMBIGUOUS[phrase];
  if (!rule) return hasPhrase(ctx.norm, phrase);
  if (ctx.accented) return hasExact(ctx.lower, rule.exact);
  return ctx.tokens.some((token, i) => {
    if (token !== phrase) return false;
    const prev = ctx.tokens[i - 1] || "";
    const next = ctx.tokens[i + 1] || "";
    if (rule.notNext?.includes(next) || rule.notPrev?.includes(prev)) return false;
    if (rule.needPrev && !rule.needPrev.includes(prev) && !rule.okNext?.includes(next)) return false;
    return true;
  });
}

const mentionsAny = (ctx, phrases) => phrases.some((p) => mentions(ctx, p));

function detectTastes(ctx) {
  return TASTES.filter((taste) => mentionsAny(ctx, taste.ask));
}

function detectSpirit(ctx) {
  return SPIRITS.find((s) => mentionsAny(ctx, s.ask)) || null;
}

function detectCategory(ctx) {
  return Object.keys(CATEGORY_ASK).find((key) => mentionsAny(ctx, CATEGORY_ASK[key])) || null;
}

/** Chuỗi số "120.000" / "1,5" / "150" -> số */
function parseNumber(text) {
  if (/^\d{1,3}([.,]\d{3})+$/.test(text)) return Number(text.replace(/[.,]/g, ""));
  return Number(text.replace(",", "."));
}

const BUDGET_CONTEXT = ["duoi", "tren", "khoang", "tam", "gia", "tien", "ngan sach", "tu", "den", "toi da", "max", "under", "around", "budget", "re hon", "hon", "it hon", "khong qua", "chung", "co", "trong", "nghin"];

/**
 * Đọc ngân sách trong câu: "dưới 120k", "khoảng 150 nghìn", "từ 100k đến 150k",
 * "trên 200.000đ", "200k" -> { min, max, target, label } (đơn vị đồng) hoặc null.
 * Bỏ qua số đi kèm %, tuổi, người, ly, giờ để không hiểu nhầm.
 */
export function parseBudget(norm) {
  const re = /(\d+(?:[.,]\d+)*)\s*(k|nghin|ngan|ng|tr|trieu|cu|d|dong|vnd)?(?=$|[^a-z0-9%])(?!\s*(?:%|phan tram|tuoi|nguoi|ly|gio|h\b|ngay|nam|thang|khach|ban|lan|mon|chai|phut))/g;
  const amounts = [];
  for (const m of norm.matchAll(re)) {
    const before = norm.slice(Math.max(0, m.index - 16), m.index);
    let value = parseNumber(m[1]);
    if (!Number.isFinite(value) || value <= 0) continue;
    const unit = m[2] || "";
    if (["k", "nghin", "ngan", "ng"].includes(unit)) value *= 1000;
    else if (["tr", "trieu", "cu"].includes(unit)) value *= 1000000;
    else if (!unit) {
      if (value < 1000) {
        if (!BUDGET_CONTEXT.some((w) => hasPhrase(before, w))) continue; // VD "top 3", "d5"
        value *= 1000;
      } else if (value < 10000) {
        continue; // VD "1942" trong tên rượu
      }
    }
    if (value < 10000 || value > 100000000) continue;
    amounts.push({ value, before });
  }
  if (!amounts.length) return null;

  // Khoảng giá: "từ 100k đến 150k", "100k - 150k"
  if (amounts.length >= 2) {
    const [a, b] = amounts;
    return { min: Math.min(a.value, b.value), max: Math.max(a.value, b.value), target: 0, label: `từ ${formatMoney(Math.min(a.value, b.value))} đến ${formatMoney(Math.max(a.value, b.value))}` };
  }

  const { value, before } = amounts[0];
  if (/(duoi|it hon|khong qua|toi da|max|under|below|re hon|nho hon|<)\s*$/.test(before.trim())) {
    return { min: 0, max: value, target: 0, label: `dưới ${formatMoney(value)}` };
  }
  if (/(tren|hon|toi thieu|min|over|above|lon hon|>)\s*$/.test(before.trim())) {
    return { min: value, max: Infinity, target: 0, label: `trên ${formatMoney(value)}` };
  }
  if (/(khoang|tam|chung|around|about|xap xi|~)\s*$/.test(before.trim())) {
    return { min: value - 25000, max: value + 25000, target: value, label: `khoảng ${formatMoney(value)}` };
  }
  // Chỉ nêu một con số (VD "ngân sách 200k") -> hiểu là không vượt quá số đó
  return { min: 0, max: value, target: value, label: `không quá ${formatMoney(value)}` };
}

/** "sale 25%", "giảm 30 phần trăm", "trên 20%" -> { percent, atLeast } */
function parsePercent(norm) {
  const m = /(?:^|[^a-z0-9])(tren |tu |it nhat |>=? ?)?(\d{1,2})\s*(%|phan tram|percent)/.exec(norm);
  if (!m) return null;
  const percent = Number(m[2]);
  if (!percent || percent > 90) return null;
  return { percent, atLeast: Boolean(m[1]) };
}

/** Tuổi khách tự khai, VD "em 16 tuổi" -> 16 */
function parseAge(norm) {
  const m = /(?:^|[^0-9])(\d{1,2})\s*tuoi/.exec(norm);
  return m ? Number(m[1]) : null;
}

/* ---------------- Tra cứu món theo tên ---------------- */

const nameIndexCache = new WeakMap();

/** Chỉ mục token tên món + độ hiếm của token (token chỉ 1 món có -> trọng số 1) */
function buildNameIndex(drinks) {
  if (nameIndexCache.has(drinks)) return nameIndexCache.get(drinks);
  const entries = drinks.map((drink) => {
    const norm = normalizeText(drink.name);
    const tokens = [...new Set(norm.split(" ").filter((t) => t && !NAME_STOPWORDS.has(t) && (t.length >= 3 || /\d/.test(t))))];
    return { drink, norm, tokens };
  });
  const df = new Map();
  entries.forEach((e) => e.tokens.forEach((t) => df.set(t, (df.get(t) || 0) + 1)));
  const index = { entries, df };
  nameIndexCache.set(drinks, index);
  return index;
}

/**
 * Tìm món được nhắc tên trong câu hỏi.
 * @returns {{ strong: Array<object>, weak: Array<object> }} strong = chắc chắn
 *   (trùng tên đầy đủ hoặc chứa token riêng của món), weak = token chung nhiều món
 */
function findNamedDrinks(norm, drinks) {
  const { entries, df } = buildNameIndex(drinks);
  const scored = entries.map(({ drink, norm: nameNorm, tokens }) => {
    let score = nameNorm.length >= 4 && hasPhrase(norm, nameNorm) ? 3 : 0;
    tokens.forEach((t) => { if (hasPhrase(norm, t)) score += 1 / df.get(t); });
    return { drink, score };
  }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score);

  const strong = scored.filter((s) => s.score >= 0.99).map((s) => s.drink);
  const weak = strong.length ? [] : scored.filter((s) => s.score >= 0.3).map((s) => s.drink);
  return { strong, weak };
}

/* =========================================================
   CÁC KHỐI TRẢ LỜI
   ========================================================= */

function hoursAnswer(nowMs) {
  const open = isOpenAt(nowMs);
  return `Quán mở cửa **${BAR.hours}**. ${open ? "Hiện quán **đang mở cửa** – mời bạn ghé nhé!" : "Hiện quán **đang đóng cửa**, sẽ mở lại lúc **18:00**."}`;
}

const addressAnswer = () => `Địa chỉ quán: **${BAR.address}**. Nếu định thưởng thức đồ uống có cồn, bạn nên đi taxi/xe công nghệ nhé.`;

const contactAnswer = () => `Hotline của quán: **${BAR.phone}**. Bạn cũng có thể gửi lời nhắn ở trang **Liên hệ** (contact.html).`;

const bookingAnswer = () => [
  "Cách **đặt bàn** tại quán:",
  "1. Vào trang **Đặt bàn & Gọi món** (order.html), chọn món muốn dùng vào giỏ.",
  "2. Chọn hình thức **Đặt bàn trước**, nhập giờ đến và số khách.",
  "3. Điền tên, số điện thoại, nhập mã giảm giá (nếu có) rồi xác nhận.",
  `Nhóm đông hoặc bàn VIP, bạn gọi hotline **${BAR.phone}** để được giữ chỗ đẹp nhé.`,
].join("\n");

const orderingAnswer = () => [
  "Gọi món rất đơn giản:",
  "1. Bấm **Thêm vào giỏ** ở thẻ món (ngay trong khung chat này hoặc trang Thực đơn).",
  "2. Mở **Đặt bàn & Gọi món** (order.html), chọn **Tại quầy / bàn** hoặc **Đặt bàn trước**.",
  "3. Nhập mã giảm giá trong phiếu đặt chỗ – mỗi đơn dùng 1 mã.",
  "Đặt xong, trang sẽ hiện mã **VietQR** để bạn chuyển khoản; tra cứu đơn bằng mã đơn + số điện thoại.",
].join("\n");

const deliveryAnswer = () => "Website hiện nhận 2 hình thức: **Tại quầy / bàn** và **Đặt bàn trước** – chưa có giao hàng hay mang đi. Cần hỗ trợ thêm, bạn gọi hotline **" + BAR.phone + "** nhé.";

const birthdayAnswer = () => [
  `Quà sinh nhật: thành viên đã khai ngày sinh sẽ tự động nhận **mã giảm ${BIRTHDAY_DISCOUNT}%** khi đăng nhập trong khoảng **7 ngày trước đến 7 ngày sau sinh nhật** (mã cá nhân, dùng 1 lần).`,
  "Đăng ký / đăng nhập tại trang **Tài khoản** (account.html) để xem mã của bạn. Muốn tổ chức tiệc sinh nhật, bạn chọn **Đặt bàn trước** hoặc gọi hotline nhé!",
].join("\n");

function newCustomerAnswer(publicVouchers) {
  const lines = [
    `Khách mới đăng ký thành viên (trang **Tài khoản** – account.html) nhận ngay **mã chào mừng giảm ${WELCOME_DISCOUNT}%** (mã cá nhân, hạn ${WELCOME_VALID_DAYS} ngày).`,
  ];
  const firstOrder = publicVouchers.filter((v) => v.audience === "new-customer");
  if (firstOrder.length) {
    lines.push("Đơn đầu tiên của số điện thoại mới còn dùng được:");
    firstOrder.forEach((v) => lines.push(voucherLine(v)));
  }
  return lines.join("\n");
}

function voucherAnswer(publicVouchers, percentFilter) {
  let list = publicVouchers;
  let note = "";
  if (percentFilter) {
    const filtered = list.filter((v) => (percentFilter.atLeast ? Number(v.percent) >= percentFilter.percent : Number(v.percent) === percentFilter.percent));
    if (filtered.length) list = filtered;
    else note = `Hiện không có mã ${percentFilter.atLeast ? "từ" : ""} ${percentFilter.percent}%, đây là các mã đang có:`;
  }
  if (!list.length) {
    return "Hiện chưa có mã giảm giá công khai nào. Bạn theo dõi trang **Khuyến mãi** (sale.html) để cập nhật sớm nhất nhé – thành viên mới và khách sinh nhật luôn có mã riêng!";
  }
  const sorted = [...list].sort((a, b) => Number(a.percent) - Number(b.percent) || (Number(a.minOrder) || 0) - (Number(b.minOrder) || 0));
  return [
    note || `Các **mã giảm giá** đang áp dụng (${sorted.length} mã):`,
    ...sorted.slice(0, 6).map(voucherLine),
    "Nhập mã ở bước thanh toán trang **Đặt bàn & Gọi món** – mỗi đơn dùng 1 mã. Thành viên còn có mã chào mừng và quà sinh nhật riêng.",
  ].join("\n");
}

function ageAnswer() {
  return "Quán chỉ phục vụ đồ uống có cồn cho khách **từ 18 tuổi trở lên**. Thành viên đăng ký trên website cũng phải đủ 18 tuổi.";
}

function underageAnswer() {
  return "Cảm ơn bạn đã chia sẻ! Quán chỉ phục vụ đồ uống có cồn cho khách **từ 18 tuổi trở lên**, nên mình không thể tư vấn đồ uống cho bạn lúc này. Hẹn gặp bạn khi đủ tuổi nhé!";
}

function driveAnswer() {
  return "Vì an toàn của bạn và mọi người: **tuyệt đối không lái xe sau khi uống rượu bia**. Hãy gọi taxi/xe công nghệ hoặc nhờ người không uống đưa về .";
}

const greetingAnswer = () => [
  "Chào bạn, mình là **Trợ lý AI của Quán Bar Đêm**!",
  "Mình có thể gợi ý cocktail theo khẩu vị, ngân sách, báo món bán chạy / món mới / món đang sale, mã giảm giá, ưu đãi sinh nhật và hướng dẫn đặt bàn. Bạn muốn thử vị gì tối nay?",
].join("\n");

const thanksAnswer = () => "Rất vui được giúp bạn! Chúc bạn một buổi tối thật chill – nhớ uống có trách nhiệm nhé.";

const byeAnswer = () => "Hẹn gặp lại bạn tại Quán Bar Đêm! Về nhà an toàn và đừng lái xe sau khi uống nhé.";

const SCOPE_TOPICS = "thực đơn & giá, món bán chạy / món mới / món đang sale, mã giảm giá, ưu đãi thành viên & sinh nhật, giờ mở cửa, địa chỉ và cách đặt bàn";

const scopeAnswer = () => [
  "Xin lỗi, mình là trợ lý của **Quán Bar Đêm** nên chỉ hỗ trợ các nội dung có trên website của quán – " + SCOPE_TOPICS + ".",
  "Câu hỏi này nằm ngoài phạm vi đó nên mình không trả lời được. Bạn có muốn mình gợi ý một ly cocktail không?",
].join("\n");

const privacyAnswer = () => "Xin lỗi, mình không cung cấp mật khẩu, thông tin khu quản trị hay dữ liệu của khách hàng / nhân viên. Mã giảm giá cá nhân của bạn xem tại trang **Tài khoản** (account.html) sau khi đăng nhập.";

const identityAnswer = () => [
  "Mình là **Trợ lý AI của Quán Bar Đêm** – chỉ trả lời dựa trên nội dung website của quán.",
  "Mình hỗ trợ: " + SCOPE_TOPICS + ". Bạn muốn hỏi gì nào?",
].join("\n");

const noInfoAnswer = () => `Website của quán hiện **chưa có thông tin** về nội dung này nên mình không dám trả lời đoán. Bạn gọi hotline **${BAR.phone}** để nhân viên hỗ trợ chính xác nhé.`;

const notOnMenuAnswer = (item) => `Thực đơn trên website hiện chỉ gồm **cocktail và rượu mạnh** – quán chưa có **${item}**. Bạn xem toàn bộ tại trang **Thực đơn** (menu.html), hoặc nói khẩu vị để mình gợi ý cocktail nhé!`;

const menuBookAnswer = () => "Quyển **menu bìa da lật trang 3D** nằm ở trang **Thực đơn** (menu.html) – bấm vào bìa để mở, lật từng trang xem món. Muốn tìm nhanh, bạn chuyển sang chế độ **Bộ lọc & Tìm kiếm** ngay trên trang đó nhé.";

const heritageAnswer = () => [
  "Website có 3 trang tư liệu về văn hoá rượu:",
  "• **Hầm Rượu** (spirits.html) – các chai rượu di sản và bản đồ hương vị.",
  "• **Master Bartenders** (bartenders.html) – các huyền thoại pha chế.",
  "• **Nhà Sưu Tầm** (collectors.html) – những nhà sưu tầm rượu lừng danh.",
  "Bạn mở trang tương ứng để xem chi tiết nhé!",
].join("\n");

/** Đồ ăn / đồ uống KHÔNG có trong thực đơn của website (so trên văn bản giữ dấu để không nhầm "bìa" với "bia") */
const NOT_ON_MENU = [
  ["bia", /(?:^|[^\p{L}])(bia|beer|heineken|tiger|budweiser|sài gòn special|333)(?=$|[^\p{L}])/u],
  ["đồ ăn", /(?:^|[^\p{L}])(đồ ăn|món ăn|thức ăn|đồ nhậu|ăn vặt|đồ ăn vặt|snack|khai vị|pizza|burger|bít tết|steak|cơm|mì ý|food)(?=$|[^\p{L}])/u],
  ["trà sữa / sinh tố / cà phê sữa", /(?:^|[^\p{L}])(trà sữa|sinh tố|cà phê sữa|bạc xỉu|milk tea|smoothie)(?=$|[^\p{L}])/u],
];
const NOT_ON_MENU_PLAIN = [["đồ ăn", ["do an", "mon an", "thuc an", "do nhau", "an vat"]], ["trà sữa / sinh tố", ["tra sua", "sinh to"]]];

function detectNotOnMenu(ctx) {
  const hit = NOT_ON_MENU.find(([, re]) => re.test(ctx.lower));
  if (hit) return hit[0];
  if (!ctx.accented) {
    const plain = NOT_ON_MENU_PLAIN.find(([, words]) => hasAny(ctx.norm, words));
    if (plain) return plain[0];
  }
  return "";
}

const helpAnswer = () => [
  "Mình chưa tìm thấy thông tin này trên website của quán. Mình chỉ hỗ trợ " + SCOPE_TOPICS + ". Bạn có thể hỏi như:",
  "• Gợi ý cocktail ngọt nhẹ / chua thanh / có khói",
  "• Món gin dưới 130k, món rẻ nhất",
  "• Món bán chạy, món mới, món đang sale 25%",
  "• Có mã giảm giá nào? Ưu đãi sinh nhật?",
  "• Negroni giá bao nhiêu? Giờ mở cửa, đặt bàn thế nào?",
].join("\n");

/** Chi tiết một món (tra cứu theo tên) */
function drinkDetail(drink, nowMs) {
  const p = getDrinkPricing(drink, nowMs);
  const lines = [`**${drink.name}** – ${CATEGORY_LABELS[drink.category] || drink.category || "Đồ uống"}`];
  if (drink.description) {
    const desc = String(drink.description).trim();
    lines.push(desc.length > 220 ? `${desc.slice(0, 219).trimEnd()}…` : desc);
  }
  let price = `Giá: **${formatMoney(p.finalPrice)}**`;
  if (p.onSale) price += ` (giá gốc ${formatMoney(p.originalPrice)}, ${p.reason === "new" ? `ưu đãi món mới −${p.percent}%` : `đang sale −${p.percent}%`})`;
  lines.push(price);
  const notes = Array.isArray(drink.tasteNotes) ? drink.tasteNotes.join(", ") : "";
  lines.push([notes && `Hương vị: ${notes}`, drink.baseSpirit && `Rượu nền: ${drink.baseSpirit}`, `${Number(drink.abv) || 0}% ABV`].filter(Boolean).join(" · "));
  lines.push(isAvailable(drink) ? `Tình trạng: còn hàng (${Number(drink.stock)} ly).` : "Tình trạng: **tạm hết** – bạn thử món khác nhé.");
  return lines.join("\n");
}

/* ---------------- Gợi ý món theo bộ lọc ---------------- */

/**
 * Chọn món theo bộ lọc, tự nới lỏng điều kiện nếu không có món nào khớp.
 * @returns {{ drinks: Array, notes: string[] }}
 */
function pickDrinks(allDrinks, filters, ctx) {
  const { nowMs } = ctx;
  const pool = allDrinks.filter(isAvailable);
  const notes = [];

  const tasteScore = (drink) => {
    if (!filters.tastes.length) return { all: true, matched: 0, score: 0 };
    let matched = 0;
    let score = 0;
    filters.tastes.forEach((taste) => {
      const c = tasteHits(drink, taste);
      if (c > 0) { matched += 1; score += Math.min(c, 3); }
    });
    return { all: matched === filters.tastes.length, matched, score };
  };

  // Các điều kiện cứng, có thể được nới lỏng theo thứ tự
  const conditions = [
    { key: "spirit", active: Boolean(filters.spirit), test: (d) => hasAny(spiritHaystack(d), filters.spirit.match),
      relax: () => `Hiện không có món ${filters.spirit.label} phù hợp, mình gợi ý món khác:` },
    { key: "cocktail", active: Boolean(filters.cocktailOnly), test: (d) => d.category !== "spirits",
      relax: () => "Mình mở rộng sang cả rượu mạnh thưởng thức nguyên bản:" },
    { key: "category", active: Boolean(filters.category), test: (d) => d.category === filters.category,
      relax: () => `Nhóm ${CATEGORY_LABELS[filters.category] || filters.category} chưa có món khớp, mình mở rộng sang nhóm khác:` },
    { key: "taste", active: filters.tastes.length > 0, test: (d) => tasteScore(d).matched > 0,
      relax: () => `Thực đơn chưa có món đúng vị ${filters.tastes.map((t) => t.label).join(", ")}, bạn tham khảo:` },
    { key: "budget", active: Boolean(filters.budget), test: (d) => {
      const price = getDrinkPricing(d, nowMs).finalPrice;
      return price >= filters.budget.min && price <= filters.budget.max;
    }, relax: () => `Không có món nào ${filters.budget.label}, đây là các món gần ngân sách nhất:` },
    { key: "strength", active: Boolean(filters.strength), test: (d) => (filters.strength === "light" ? Number(d.abv) <= 22 : Number(d.abv) >= 28),
      relax: () => (filters.strength === "light" ? "Không có món nhẹ độ hợp điều kiện, mình chọn món độ cồn thấp nhất có thể:" : "Không có món mạnh hợp điều kiện, mình chọn món đậm nhất có thể:") },
  ].filter((c) => c.active);

  let candidates = pool.filter((d) => conditions.every((c) => c.test(d)));
  // Nới lỏng: bỏ dần điều kiện ít quan trọng nhất (cuối danh sách) cho tới khi có món
  const relaxOrder = ["cocktail", "strength", "budget", "taste", "category", "spirit"];
  const kept = new Set(conditions.map((c) => c.key));
  for (const key of relaxOrder) {
    if (candidates.length || !kept.has(key)) continue;
    kept.delete(key);
    notes.push(conditions.find((c) => c.key === key).relax());
    candidates = pool.filter((d) => conditions.filter((c) => kept.has(c.key)).every((c) => c.test(d)));
  }
  if (!candidates.length) candidates = pool;

  const soldRank = new Map(ctx.bestSellers.map((b, i) => [String(b.drink.id), i]));

  const scored = candidates.map((drink) => {
    const p = getDrinkPricing(drink, nowMs);
    const t = tasteScore(drink);
    const abv = Number(drink.abv) || 0;
    let score = (t.all ? 20 : 0) + t.matched * 6 + t.score;
    if (filters.strength === "light") score += (40 - abv) / 4;
    if (filters.strength === "strong") score += abv / 4;
    if (filters.budget) {
      // Ngoài khoảng ngân sách (khi đã phải nới lỏng) -> càng xa càng bị trừ điểm
      const { min, max, target } = filters.budget;
      const outside = p.finalPrice < min ? min - p.finalPrice : (p.finalPrice > max ? p.finalPrice - max : 0);
      score -= outside / 5000;
      if (target) score -= Math.abs(p.finalPrice - target) / 10000;
    }
    if (filters.budget && !filters.budget.target && Number.isFinite(filters.budget.max)) score += p.finalPrice / 50000; // sát ngân sách hơn
    if (soldRank.has(String(drink.id))) score += 3 - soldRank.get(String(drink.id)) * 0.3;
    score += (Number(drink.rating) || 0) * 0.8 + p.percent / 20;
    return { drink, p, score };
  });

  if (filters.cheapest) scored.sort((a, b) => a.p.finalPrice - b.p.finalPrice || b.score - a.score);
  else if (filters.priciest) scored.sort((a, b) => b.p.finalPrice - a.p.finalPrice || b.score - a.score);
  else scored.sort((a, b) => b.score - a.score);

  return { drinks: scored.slice(0, MAX_SUGGESTIONS).map((s) => s.drink), notes };
}

/** Câu mở đầu mô tả bộ lọc: "Gợi ý cocktail **ngọt** · **nhẹ độ** dưới 120.000đ:" */
function describeFilters(filters) {
  const bits = [];
  filters.tastes.forEach((t) => bits.push(`**${t.label}**`));
  if (filters.strength === "light") bits.push("**nhẹ độ cồn**");
  if (filters.strength === "strong") bits.push("**đậm, mạnh**");
  if (filters.spirit) bits.push(`nền **${filters.spirit.label}**`);
  if (filters.category) bits.push(`nhóm **${CATEGORY_LABELS[filters.category] || filters.category}**`);
  if (filters.budget) bits.push(filters.budget.label);
  if (filters.cheapest) return `Các món **giá mềm nhất**${bits.length ? ` (${bits.join(" · ")})` : ""} đang có:`;
  if (filters.priciest) return `Các món **cao cấp nhất**${bits.length ? ` (${bits.join(" · ")})` : ""} của quán:`;
  return bits.length ? `Gợi ý cho bạn – ${bits.join(" · ")}:` : "Mình gợi ý cho bạn:";
}

/* =========================================================
   ENGINE OFFLINE - HÀM THUẦN
   ========================================================= */

/**
 * Trả lời câu hỏi KHÔNG cần AI: nhận diện ý định bằng từ khoá (đã bỏ dấu)
 * rồi chọn món / mã giảm giá trên dữ liệu thật.
 *
 * @param {string} text - câu hỏi của khách
 * @param {{ drinks?: object[], orders?: object[], vouchers?: object[], now?: Date|number }} data
 * @returns {{ text: string, drinkIds: string[], intent: string }}
 *   text: văn bản thuần (xuống dòng bằng \n, in đậm bằng **...**), drinkIds: tối đa 3 id món
 */
export function answerOffline(text, { drinks = [], orders = [], vouchers = [], now = Date.now() } = {}) {
  const raw = String(text ?? "").slice(0, MAX_MESSAGE_CHARS);
  const ctx = makeContext(raw);
  const { norm } = ctx;
  const nowMs = toMs(now);
  const allDrinks = (Array.isArray(drinks) ? drinks : []).filter((d) => d && d.id !== undefined && d.id !== null && d.name);
  const publicVouchers = (Array.isArray(vouchers) ? vouchers : []).filter((v) => isPublicUsable(v, nowMs));
  const bestSellers = rankBestSellers(allDrinks, orders, 10).filter((b) => isAvailable(b.drink));

  const reply = (body, drinkIds = [], intent = "info") => ({
    text: body,
    drinkIds: [...new Set(drinkIds.map(String))].slice(0, MAX_SUGGESTIONS),
    intent,
  });

  if (!norm) return reply(greetingAnswer(), [], "greeting");

  /* ----- 1. An toàn: khách chưa đủ 18 tuổi ----- */
  const age = parseAge(norm);
  if ((age !== null && age < 18 && age >= 6) || mentionsAny(ctx, KW.underagePhrases)) {
    return reply(underageAnswer(), [], "underage");
  }

  const has = (key) => mentionsAny(ctx, KW[key]);
  const named = findNamedDrinks(norm, allDrinks);

  /* ----- 1b. Chỉ trả lời nội dung có trên website ----- */
  if (has("injection")) return reply(scopeAnswer(), [], "off-topic");
  if (has("privacy")) return reply(privacyAnswer(), [], "privacy");
  if (has("identity")) return reply(identityAnswer(), [], "identity");
  if (has("offTopic") && !named.strong.length && !has("onTopicAnchors")) return reply(scopeAnswer(), [], "off-topic");
  if (has("delivery")) return reply(deliveryAnswer(), [], "delivery");
  const notOnMenu = named.strong.length ? "" : detectNotOnMenu(ctx);
  if (notOnMenu) return reply(notOnMenuAnswer(notOnMenu), [], "not-on-menu");
  if (has("facilities")) return reply(noInfoAnswer(), [], "no-info");
  if (has("heritage") && !named.strong.length) return reply(heritageAnswer(), [], "heritage");
  if (has("menuBook")) return reply(menuBookAnswer(), [], "menu-book");

  /* ----- 2. Nhận diện ý định ----- */
  const percentFilter = parsePercent(norm);
  const wantsVoucher = has("voucher");
  const wantsBirthday = has("birthday");
  const wantsNewCustomer = has("newCustomer");
  const mentionsDrinkWord = has("drinkWords");
  const wantsSaleDrinks = (has("promo") || Boolean(percentFilter)) && !wantsVoucher
    && (mentionsDrinkWord || Boolean(percentFilter) || hasAny(norm, ["mon sale", "dang sale", "dang giam", "mon giam", "giam gia mon"]));
  const wantsPromoOverview = has("promo") && !wantsVoucher && !wantsBirthday && !wantsNewCustomer && !wantsSaleDrinks;
  const wantsNewDrink = has("newDrink") && !(wantsNewCustomer && !hasAny(norm, ["mon moi", "do uong moi", "cocktail moi"]));
  const wantsBest = has("bestSeller");
  // "không cồn" gõ có dấu là rõ nghĩa; gõ không dấu thì loại các câu "không còn hàng/món..."
  const wantsNonAlcoholic = has("nonAlcoholic")
    && (hasExact(ctx.lower, "cồn") || !/khong (co )?con (hang|mon|cho|ban|ve|lai|nua|khong)/.test(norm));

  const filters = {
    tastes: detectTastes(ctx),
    spirit: detectSpirit(ctx),
    category: detectCategory(ctx),
    strength: has("light") ? "light" : (has("strong") ? "strong" : ""),
    budget: parseBudget(norm),
    cheapest: has("cheapest"),
    priciest: has("priciest"),
  };
  // Khách nói "cocktail" -> không gợi ý rượu mạnh uống nguyên chai (neat)
  filters.cocktailOnly = !filters.category && !filters.spirit && mentionsAny(ctx, ["cocktail", "cocktails", "pha che"]);
  const hasDrinkFilters = filters.tastes.length > 0 || filters.spirit || filters.category || filters.strength
    || filters.budget || filters.cheapest || filters.priciest;

  const parts = [];
  const ids = [];
  let intent = "";
  const mark = (name) => { if (!intent) intent = name; };

  /* ----- 3. Tra cứu món theo tên ----- */
  const wantsSimilar = has("similar") && named.strong.length === 1;
  if (named.strong.length && !wantsSimilar) {
    mark("lookup");
    named.strong.slice(0, MAX_SUGGESTIONS).forEach((d) => { parts.push(drinkDetail(d, nowMs)); ids.push(d.id); });
  } else if (wantsSimilar) {
    mark("similar");
    const base = named.strong[0];
    const baseHay = new Set(normalizeText([...(base.tasteNotes || []), base.baseSpirit].join(" ")).split(" ").filter((w) => w.length > 2));
    const similar = allDrinks
      .filter((d) => d.id !== base.id && isAvailable(d))
      .map((d) => {
        const words = normalizeText([...(d.tasteNotes || []), d.baseSpirit].join(" ")).split(" ");
        const overlap = words.filter((w) => baseHay.has(w)).length;
        return { d, score: overlap * 2 + (d.category === base.category ? 2 : 0) + (Number(d.rating) || 0) / 5 };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SUGGESTIONS)
      .map((x) => x.d);
    parts.push([`Nếu bạn thích **${base.name}**, có thể thử:`, ...similar.map((d) => drinkLine(d, nowMs))].join("\n"));
    ids.push(...similar.map((d) => d.id));
  }

  /* ----- 4. Thông tin quán ----- */
  if (has("drive")) { mark("drive"); parts.push(driveAnswer()); }
  if (has("hours")) { mark("hours"); parts.push(hoursAnswer(nowMs)); }
  if (has("address")) { mark("address"); parts.push(addressAnswer()); }
  if (has("contact")) { mark("contact"); parts.push(contactAnswer()); }
  if (has("booking")) { mark("booking"); parts.push(bookingAnswer()); }
  else if (has("ordering")) { mark("ordering"); parts.push(orderingAnswer()); }
  if (has("ageQuestion") && !parts.length) { mark("age"); parts.push(ageAnswer()); }

  /* ----- 5. Khuyến mãi ----- */
  if (wantsBirthday) { mark("birthday"); parts.push(birthdayAnswer()); }
  if (wantsNewCustomer && !wantsNewDrink) { mark("new-customer"); parts.push(newCustomerAnswer(publicVouchers)); }
  if (wantsVoucher) { mark("vouchers"); parts.push(voucherAnswer(publicVouchers, percentFilter)); }

  if (wantsPromoOverview) {
    mark("promo");
    const onSale = allDrinks.filter(isAvailable)
      .map((d) => ({ d, p: getDrinkPricing(d, nowMs) }))
      .filter((x) => x.p.onSale)
      .sort((a, b) => b.p.percent - a.p.percent || (Number(b.d.rating) || 0) - (Number(a.d.rating) || 0));
    const lines = ["Các **ưu đãi** đang chạy tại quán:"];
    if (onSale.length) {
      lines.push(`• **${onSale.length} món** đang giảm giá (sale theo món + món mới giảm ${NEW_DRINK_DISCOUNT}%), nổi bật:`);
      onSale.slice(0, MAX_SUGGESTIONS).forEach((x) => lines.push(`  ${drinkLine(x.d, nowMs)}`));
      ids.push(...onSale.slice(0, MAX_SUGGESTIONS).map((x) => x.d.id));
    }
    if (publicVouchers.length) {
      lines.push(`• Mã giảm giá: ${publicVouchers.slice(0, 6).map((v) => `**${v.code}** (−${Number(v.percent)}%)`).join(", ")} – hỏi "có mã giảm giá nào?" để xem điều kiện.`);
    }
    lines.push(`• Thành viên mới: mã chào mừng −${WELCOME_DISCOUNT}%. Sinh nhật: mã quà tặng −${BIRTHDAY_DISCOUNT}%.`);
    lines.push("Xem đầy đủ tại trang **Khuyến mãi** (sale.html).");
    parts.push(lines.join("\n"));
  }

  /* ----- 6. Gợi ý món ----- */
  const pickCtx = { nowMs, bestSellers };
  const alreadySuggested = ids.length > 0;

  if (wantsSaleDrinks && !alreadySuggested) {
    mark("sale-drinks");
    let list = allDrinks.filter(isAvailable).map((d) => ({ d, p: getDrinkPricing(d, nowMs) })).filter((x) => x.p.onSale);
    let head = "Các món **đang giảm giá**:";
    if (percentFilter) {
      const exact = list.filter((x) => (percentFilter.atLeast ? x.p.percent >= percentFilter.percent : x.p.percent === percentFilter.percent));
      if (exact.length) {
        list = exact;
        head = `Các món đang giảm **${percentFilter.atLeast ? "từ " : ""}${percentFilter.percent}%**:`;
      } else {
        head = `Hiện không có món nào giảm đúng ${percentFilter.percent}%. Các mức sale đang có: ${[...new Set(list.map((x) => x.p.percent))].sort((a, b) => b - a).map((p) => `${p}%`).join(", ") || "chưa có"}. Gợi ý:`;
        list.sort((a, b) => Math.abs(a.p.percent - percentFilter.percent) - Math.abs(b.p.percent - percentFilter.percent)
          || b.p.percent - a.p.percent);
      }
    }
    if (!percentFilter) list.sort((a, b) => b.p.percent - a.p.percent || (Number(b.d.rating) || 0) - (Number(a.d.rating) || 0));
    if (filters.budget) list = list.filter((x) => x.p.finalPrice >= filters.budget.min && x.p.finalPrice <= filters.budget.max);
    if (list.length) {
      const top = list.slice(0, MAX_SUGGESTIONS);
      parts.push([head, ...top.map((x) => drinkLine(x.d, nowMs))].join("\n"));
      ids.push(...top.map((x) => x.d.id));
    } else {
      parts.push("Hiện chưa có món nào đang giảm giá phù hợp. Bạn xem thêm ưu đãi tại trang **Khuyến mãi** nhé!");
    }
  }

  if (wantsNewDrink && !ids.length) {
    mark("new-drinks");
    const fresh = allDrinks.filter((d) => isAvailable(d) && getDrinkPricing(d, nowMs).isNew);
    const list = fresh.length ? getNewestDrinks(fresh, MAX_SUGGESTIONS) : getNewestDrinks(allDrinks.filter(isAvailable), MAX_SUGGESTIONS);
    const head = fresh.length
      ? `**Món mới** lên thực đơn (tự động giảm ${NEW_DRINK_DISCOUNT}% trong ${NEW_DRINK_DAYS} ngày đầu ra mắt):`
      : "Hiện chưa có món mới trong 2 tuần qua – đây là các món lên thực đơn gần nhất:";
    parts.push([head, ...list.map((d) => drinkLine(d, nowMs))].join("\n"));
    ids.push(...list.map((d) => d.id));
  }

  if (wantsBest && !ids.length) {
    mark("best-sellers");
    let list = bestSellers;
    if (hasDrinkFilters) {
      const picked = pickDrinks(allDrinks, filters, pickCtx).drinks;
      const pickedIds = new Set(picked.map((d) => String(d.id)));
      const filtered = bestSellers.filter((b) => pickedIds.has(String(b.drink.id)));
      list = filtered.length ? filtered : bestSellers;
    }
    if (list.length) {
      const top = list.slice(0, MAX_SUGGESTIONS);
      parts.push(["**Món bán chạy** nhất của quán:", ...top.map((b) => drinkLine(b.drink, nowMs, `${b.sold} ly đã bán`))].join("\n"));
      ids.push(...top.map((b) => b.drink.id));
    } else {
      const top = allDrinks.filter(isAvailable).sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || (Number(b.rating) || 0) - (Number(a.rating) || 0)).slice(0, MAX_SUGGESTIONS);
      parts.push(["Quán chưa có đủ dữ liệu bán hàng, đây là các món được đánh giá cao nhất:", ...top.map((d) => drinkLine(d, nowMs, `★ ${d.rating}`))].join("\n"));
      ids.push(...top.map((d) => d.id));
    }
  }

  if (wantsNonAlcoholic && !ids.length) {
    mark("non-alcoholic");
    const zero = allDrinks.filter((d) => isAvailable(d) && Number(d.abv) === 0);
    const list = (zero.length ? zero : [...allDrinks.filter(isAvailable)].sort((a, b) => (Number(a.abv) || 0) - (Number(b.abv) || 0))).slice(0, MAX_SUGGESTIONS);
    const head = zero.length
      ? "Các đồ uống **không cồn** của quán:"
      : "Quán là cocktail bar nên thực đơn hiện **chưa có đồ uống không cồn**. Nếu muốn thật nhẹ, bạn thử các món độ cồn thấp nhất:";
    parts.push([head, ...list.map((d) => drinkLine(d, nowMs))].join("\n"));
    ids.push(...list.map((d) => d.id));
  }

  const wantsRecommend = has("recommend") || hasDrinkFilters;
  if (wantsRecommend && !ids.length && !named.strong.length) {
    mark("recommend");
    const { drinks: picked, notes } = pickDrinks(allDrinks, filters, pickCtx);
    if (picked.length) {
      const lines = [...notes];
      if (!notes.length) lines.push(describeFilters(filters));
      lines.push(...picked.map((d) => drinkLine(d, nowMs)));
      if (filters.strength === "strong" || picked.some((d) => Number(d.abv) >= 40)) lines.push("Món khá mạnh – nhớ thưởng thức chậm và uống có trách nhiệm nhé.");
      else lines.push("Bấm **Thêm vào giỏ** ở thẻ món để gọi ngay nhé!");
      parts.push(lines.join("\n"));
      ids.push(...picked.map((d) => d.id));
    } else {
      parts.push("Hiện thực đơn đang tạm hết món phù hợp, bạn quay lại sau ít phút hoặc gọi hotline nhé.");
    }
  }

  /* ----- 7. Tên món chung nhiều món (VD "martini") ----- */
  if (!parts.length && named.weak.length) {
    mark("lookup-many");
    const list = named.weak.filter(isAvailable).slice(0, MAX_SUGGESTIONS);
    if (list.length) {
      parts.push([`Quán có ${list.length} món khớp với yêu cầu của bạn:`, ...list.map((d) => drinkLine(d, nowMs))].join("\n"));
      ids.push(...list.map((d) => d.id));
    }
  }

  /* ----- 8. Hỏi giá chung chung ----- */
  if (!parts.length && has("priceInfo")) {
    mark("price-range");
    const prices = allDrinks.filter(isAvailable).map((d) => getDrinkPricing(d, nowMs).finalPrice);
    if (prices.length) {
      parts.push(`Giá đồ uống tại quán từ **${formatMoney(Math.min(...prices))}** đến **${formatMoney(Math.max(...prices))}** (đã trừ sale). Bạn cho mình biết ngân sách, VD "món dưới 120k", để mình gợi ý nhé!`);
    }
  }

  /* ----- 9. Chào hỏi / cảm ơn / không hiểu ----- */
  if (!parts.length) {
    if (has("thanks")) return reply(thanksAnswer(), [], "thanks");
    if (has("bye")) return reply(byeAnswer(), [], "bye");
    if (has("greeting")) return reply(greetingAnswer(), [], "greeting");
    return reply(helpAnswer(), [], "unknown");
  }

  return reply(parts.join("\n\n"), ids, intent || "info");
}

/* =========================================================
   OFFLINE TRƯỚC + GỌI MÁY CHỦ (GEMINI) KHI CẦN
   ========================================================= */

/** Ngôn ngữ giao diện hiện tại (đọc trực tiếp để module chạy được cả trong Node) */
function currentLang() {
  try {
    return globalThis.localStorage?.getItem("site_language") === "en" ? "en" : "vi";
  } catch {
    return "vi";
  }
}

/**
 * fetch có giới hạn thời gian. Dùng fetch trực tiếp thay vì api.js vì:
 * AI cần tới vài chục giây (api.js chỉ chờ 6 giây) và lỗi 503 của
 * trợ lý không có nghĩa là toàn bộ máy chủ dữ liệu bị tắt.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = AI_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

let statusPromise = null;

/**
 * Hỏi máy chủ trợ lý Gemini có sẵn sàng không (GET /ai/status) - chỉ gọi 1 lần / trang.
 * @returns {Promise<{ online: boolean, model: string }>}
 */
export function checkAssistantStatus() {
  if (!statusPromise) {
    statusPromise = (async () => {
      try {
        const res = await fetchWithTimeout(`${API_BASE}/ai/status`, { headers: { Accept: "application/json" } }, STATUS_TIMEOUT_MS);
        if (!res.ok) return { online: false, model: "" };
        const data = await res.json();
        return { online: data?.online === true, model: String(data?.model || "") };
      } catch {
        return { online: false, model: "" };
      }
    })();
  }
  return statusPromise;
}

/* ---------------- Dữ liệu cho engine offline (có bộ nhớ đệm) ---------------- */

let dataCache = null; // { at, promise }

async function loadAssistantData() {
  if (!dataCache || Date.now() - dataCache.at > DATA_CACHE_MS) {
    const promise = Promise.all([
      getAllDrinks().catch(() => SEED_DRINKS),
      getAllOrders().catch(() => []),
      getPublicVouchers().catch(() => []),
    ]).then(([drinks, orders, vouchers]) => ({ drinks, orders, vouchers }));
    dataCache = { at: Date.now(), promise };
    promise.catch(() => { dataCache = null; });
  }
  return dataCache.promise;
}

/**
 * Lấy đối tượng món theo danh sách id (giữ đúng thứ tự) - khung chat dùng để vẽ thẻ món.
 * Id không còn trong thực đơn bị bỏ qua.
 */
export async function getDrinksByIds(ids = []) {
  if (!Array.isArray(ids) || !ids.length) return [];
  const { drinks } = await loadAssistantData();
  const byId = new Map(drinks.map((d) => [String(d.id), d]));
  return ids.map((id) => byId.get(String(id))).filter(Boolean);
}

/** Lịch sử chat hợp lệ để gửi máy chủ: chỉ user/assistant, nội dung chuỗi, cắt độ dài */
function sanitizeHistory(history) {
  return (Array.isArray(history) ? history : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_MESSAGE_CHARS) }));
}

/** Sau khi máy chủ báo trợ lý AI không khả dụng, tạm dùng offline một lúc rồi mới thử lại */
let serverRetryAt = 0;

/**
 * Hỏi trợ lý: engine offline trả lời trước (0 token); câu offline không hiểu mới hỏi Gemini trên máy chủ.
 * @param {Array<{role: "user"|"assistant", content: string}>} history - các tin TRƯỚC câu hỏi này
 * @param {string} userText - câu hỏi mới của khách
 * @returns {Promise<{ text: string, drinkIds: string[], source: "gemini"|"offline" }>}
 */
export async function askAssistant(history, userText) {
  const question = String(userText ?? "").trim().slice(0, MAX_MESSAGE_CHARS);
  if (!question) {
    return { text: "Bạn muốn hỏi gì về đồ uống, khuyến mãi hay đặt bàn nào?", drinkIds: [], source: "offline" };
  }

  // 1. Offline trước: hiểu được câu hỏi thì trả lời luôn, không tốn token AI
  const data = await loadAssistantData();
  const offline = answerOffline(question, { ...data, now: Date.now() });
  const offlineResult = { text: offline.text, drinkIds: offline.drinkIds, source: "offline" };
  if (offline.intent !== "unknown") return offlineResult;

  // 2. Câu offline không hiểu -> hỏi Gemini qua máy chủ (nếu đang bật)
  if (Date.now() < serverRetryAt) return offlineResult;
  const messages = [...sanitizeHistory(history), { role: "user", content: question }].slice(-MAX_HISTORY);
  try {
    const res = await fetchWithTimeout(`${API_BASE}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ messages, lang: currentLang() }),
    });
    if (res.ok) {
      const body = await res.json();
      if (typeof body?.reply === "string" && body.reply.trim()) {
        const drinkIds = (Array.isArray(body.drinkIds) ? body.drinkIds : []).map(String).slice(0, 4);
        return { text: body.reply.trim(), drinkIds, source: "gemini" };
      }
    } else if ([404, 405, 503].includes(res.status)) {
      // 503: chưa có khoá / Gemini quá tải; 404-405: json-server chạy thiếu --middlewares
      serverRetryAt = Date.now() + 60 * 1000;
    }
  } catch (err) {
    // Máy chủ không chạy -> đợi 30 giây mới thử lại; hết giờ chờ (AbortError) thì lần sau vẫn thử
    if (err?.name !== "AbortError") serverRetryAt = Date.now() + 30 * 1000;
  }
  return offlineResult;
}

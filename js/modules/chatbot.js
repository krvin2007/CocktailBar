/* =========================================================
   CHATBOT.JS - Trợ lý Pha chế ảo AI (Virtual Bartender)
   Quán Bar Đêm — Artisan Cocktail Lounge & Speakeasy
   
   NGUYÊN TẮC BẢO VỆ PHẠM VI (SCOPE GUARDRAIL - STRICT IN-SCOPE ONLY):
   - CHỈ trả lời các thông tin trong phạm vi Quán Bar Đêm:
     + Thực đơn, hương vị cocktail, nguyên liệu, nồng độ cồn ABV
     + Tư vấn chọn đồ uống theo tâm trạng, gu vị, nồng độ
     + Đặt bàn, giữ chỗ, kiểm tra khung giờ, sức chứa, phụ thu
     + Giờ mở cửa (18:00 - 02:00), địa chỉ (74-76 Nam Kỳ Khởi Nghĩa, Q.1), Hotline
     + Mã giảm giá, voucher khuyến mãi (WELCOME10, GIAM50K, HAPPYNIGHT)
     + Chính sách khách hàng thân thiết, 4 hạng thẻ, tích điểm, đổi điểm
     + Master Bartenders & Bộ sưu tập Hầm rượu di sản
     + Quy định độ tuổi (18+)
   - TỪ CHỐI 100% MỌI CÂU HỎI NGOÀI PHẠM VI (Toán học, lập trình/code,
     thời tiết, địa lý/lịch sử ngoài lề, chính trị, dịch thuật, thể thao...).
   ========================================================= */

import { getAllDrinks } from "./drinksService.js";
import { getAllVouchers } from "./vouchersService.js";
import { VENUE, OPENING_HOURS, BOOKING_RULES } from "./venue.js";
import { formatMoney, escapeHtml } from "./utils.js";

/** Thông tin định danh của Trợ lý Bartender ảo */
export const BOT_PROFILE = {
  name: "Bartender ảo — Quán Bar Đêm",
  role: "Trợ Lý Pha Chế & Tư Vấn Đặt Bàn",
  avatarText: "🍸",
  welcomeMessage:
    "Xin chào quý khách! Em là **Trợ lý Pha chế ảo của Quán Bar Đêm**. 🍸\n\nEm có thể giúp quý khách **khám phá thực đơn cocktail**, **tư vấn đồ uống theo gu vị**, **hướng dẫn đặt bàn**, hoặc **tra cứu mã giảm giá & ưu đãi thành viên**.\n\nTối nay quý khách muốn thưởng thức hương vị như thế nào ạ?",
  outOfScopeMessage:
    "Dạ xin lỗi quý khách! Em là **Trợ lý Pha chế ảo của Quán Bar Đêm**, em chỉ được đào tạo để tư vấn về **thực đơn đồ uống, hương vị cocktail, đặt bàn và dịch vụ của quán** thôi ạ.\n\nCâu hỏi này nằm ngoài phạm vi hoạt động của quán bar. Quý khách có muốn em gợi ý một ly cocktail hợp gu tối nay, hoặc hỗ trợ đặt bàn giữ chỗ không ạ? 🍸",
};

/** Các mẫu biểu thức chính quy nhận diện câu hỏi NGOÀI PHẠM VI (Out-of-Scope Blacklist) */
const OUT_OF_SCOPE_PATTERNS = [
  // 1. Toán học & Tính toán số học ngoài lề
  /(\d+\s*[-+*xX/÷]\s*\d+|tính tích phân|đạo hàm|giải phương trình|hệ phương trình|căn bậc|hình học|tam giác|diện tích|chu vi|toán học|giải toán|\bsin\b|\bcos\b|\btan\b)/i,
  // 2. Lập trình / Viết code / Tin học / Công nghệ ngoài lề
  /(viết code|lập trình|python|javascript|typescript|\bhtml\b|\bcss\b|\bjava\b|\bc\+\+|\bc#|\bphp\b|\bsql\b|database|thuật toán|debug|\bbug\b|cài win|format ổ|sửa máy tính|\bhack\b|bẻ khóa|source code)/i,
  // 3. Thời tiết / Khí hậu / Môi trường
  /(thời tiết|dự báo thời tiết|trời hôm nay|trời ngày mai|nhiệt độ|trời có mưa|\bbão\b|áp thấp|độ ẩm|nắng mưa|trời mưa|mưa gió)/i,
  // 4. Kiến thức bách khoa, Địa lý, Lịch sử thế giới không liên quan
  /(thủ đô của|tổng thống|chính trị|bầu cử|chiến tranh|dân số|diện tích nước|nước nào lớn nhất|núi cao nhất|sông dài nhất|vũ trụ|hành tinh|mặt trăng|vật lý|hóa học vô cơ)/i,
  // 5. Thể thao, Showbiz, Giải trí ngoài lề
  /(bóng đá|ngoại hạng anh|world cup|cúp c1|messi|ronaldo|ca sĩ|diễn viên|phim chiếu rạp|chứng khoán|cổ phiếu|crypto|bitcoin|tiền ảo)/i,
  // 6. Dịch thuật, Thơ văn ngoài lề, Kể chuyện cười
  /(dịch giúp|dịch đoạn|dịch sang|translate|làm thơ|bài thơ|kể chuyện cổ tích|truyện cười|soạn văn)/i,
];

/** Từ khóa liên quan đến quán bar (In-Scope Whitelist Keywords) */
const IN_SCOPE_KEYWORDS = [
  "quán", "bar", "cocktail", "mocktail", "rượu", "uống", "menu", "thực đơn", "món", "ly",
  "đặt bàn", "giữ chỗ", "bàn", "khách", "giờ", "mở cửa", "đóng cửa", "địa chỉ", "ở đâu", "đường",
  "hotline", "số điện thoại", "sđt", "liên hệ", "zalo", "facebook", "messenger",
  "voucher", "mã giảm giá", "khuyến mãi", "ưu đãi", "giảm giá", "sale",
  "thành viên", "tích điểm", "hạng", "bạc", "vàng", "kim cương", "điểm", "đổi điểm",
  "giá", "giá bao nhiêu", "bao nhiêu tiền", "hết bao nhiêu", "nồng độ", "cồn", "abv", "say", "nhẹ", "mạnh",
  "chua", "ngọt", "đắng", "khói", "béo", "thảo mộc", "trái cây", "cam", "chanh",
  "gin", "whisky", "whiskey", "rum", "vodka", "tequila", "cognac", "bourbon",
  "negroni", "old fashioned", "martini", "daiquiri", "manhattan", "margarita", "mojito",
  "bartender", "pha chế", "ada coleman", "harry craddock", "dale degroff", "colin field",
  "hầm rượu", "nhà sưu tầm", "tuổi", "18", "say xe", "hút thuốc", "không gian", "3d", "chỗ ngồi",
  "xin chào", "chào", "hello", "hi", "cảm ơn", "tạm biệt", "bye", "bạn là ai", "tư vấn", "gợi ý",
];

/**
 * Kiểm tra xem một tin nhắn có nằm ngoài phạm vi Quán Bar Đêm hay không.
 * @param {string} text - Tin nhắn từ người dùng
 * @returns {boolean} true nếu vi phạm phạm vi (Out of Scope), false nếu hợp lệ
 */
export function isOutOfScope(text) {
  const query = String(text || "").trim().toLowerCase();
  if (!query) return false;

  // 1. Kiểm tra nếu khớp với danh sách Blacklist ngoài lề
  for (const pattern of OUT_OF_SCOPE_PATTERNS) {
    if (pattern.test(query)) {
      return true;
    }
  }

  // 2. Kiểm tra nếu câu hỏi dài (>= 3 từ) mà không chứa bất kỳ từ khóa liên quan nào đến quán bar
  const words = query.split(/\s+/);
  if (words.length >= 3) {
    const hasInScopeWord = IN_SCOPE_KEYWORDS.some((kw) => query.includes(kw));
    if (!hasInScopeWord) {
      return true;
    }
  }

  return false;
}

/**
 * Xử lý tin nhắn và tạo phản hồi thông minh từ Trợ lý Bartender ảo.
 * @param {string} userMessage - Tin nhắn từ khách
 * @returns {Promise<string>} Câu trả lời markdown
 */
export async function getBotResponse(userMessage) {
  const q = String(userMessage || "").trim();
  const lower = q.toLowerCase();

  if (!q) {
    return "Quý khách đang tìm kiếm đồ uống hoặc thông tin gì tại Quán Bar Đêm ạ? Em luôn sẵn sàng hỗ trợ!";
  }

  // BƯỚC 1: KIỂM SOÁT PHẠM VI NGHIÊM NGẶT (SCOPE GUARD)
  if (isOutOfScope(q)) {
    return BOT_PROFILE.outOfScopeMessage;
  }

  // BƯỚC 2: CHÀO HỎI & DANH TÍNH
  if (/^(chào|xin chào|hello|hi|alo|hé lô|hey)\b/i.test(lower) && lower.length < 20) {
    return (
      "Dạ em chào quý khách! Em là **Trợ lý Pha chế ảo của Quán Bar Đêm**. 🍸\n\n" +
      "Hôm nay quý khách muốn em tư vấn món cocktail nào, kiểm tra bàn trống, hay tìm hiểu về ưu đãi giảm giá của quán ạ?"
    );
  }

  if (/(bạn là ai|em là ai|mày là ai|giới thiệu về bạn|who are you)/i.test(lower)) {
    return (
      "Dạ em là **Trợ lý Pha chế ảo (AI Virtual Bartender) / Bartender ảo** được thiết kế riêng cho **Quán Bar Đêm** (74-76 Nam Kỳ Khởi Nghĩa, Q.1).\n\n" +
      "Nhiệm vụ duy nhất của em là hỗ trợ quý khách:\n" +
      "- 🍸 Tư vấn hương vị và thành phần của hơn 30+ loại cocktail & rượu mạnh hảo hạng.\n" +
      "- 📅 Hướng dẫn đặt bàn giữ chỗ và kiểm tra khung giờ mở cửa.\n" +
      "- 🎟️ Cung cấp mã giảm giá voucher & chính sách tích điểm thành viên.\n" +
      "- 🏛️ Giới thiệu về không gian 3D, hầm rượu di sản và các Master Bartenders.\n\n" +
      "Em có thể giúp gì cho buổi tối của quý khách hôm nay ạ?"
    );
  }

  if (/(cảm ơn|thank|tks|tkss|tuyệt vời|ok|được rồi)/i.test(lower)) {
    return "Rất hân hạnh được phục vụ quý khách! Chúc quý khách có một đêm thưởng thức cocktail tuyệt vời và ấm cúng tại Quán Bar Đêm. Hẹn gặp lại quý khách! 🥂✨";
  }

  // BƯỚC 3: GIỜ MỞ CỬA & ĐỊA CHỈ & LIÊN HỆ
  if (/(mở cửa|đóng cửa|mấy giờ|thời gian|hoạt động|lịch)/i.test(lower)) {
    const hours = OPENING_HOURS.map((h) => `- **${h.label.vi}**: Từ **${h.open}** tối đến **${h.close}** sáng hôm sau.`).join("\n");
    return (
      `🕒 **Giờ mở cửa của Quán Bar Đêm:**\n\n${hours}\n\n` +
      `💡 *Lưu ý: Quán mở cửa xuyên suốt tất cả các ngày trong tuần. Quý khách nên đặt bàn trước từ 20:00 - 23:00 để có vị trí đẹp nhất gần quầy pha chế ạ!*`
    );
  }

  if (/(địa chỉ|ở đâu|vị trí|chỗ nào|đường nào|map|bản đồ)/i.test(lower)) {
    return (
      `📍 **Địa chỉ Quán Bar Đêm:**\n\n` +
      `**${VENUE.address}**\n` +
      `- *Đặc điểm:* Nằm ngay trung tâm Quận 1, không gian Speakeasy cổ điển ấm cúng, có chỗ gửi xe an ninh.\n` +
      `- *Hotline đặt bàn nhanh:* **0397 062 429** hoặc **${VENUE.hotline}**\n` +
      `- Quý khách có thể xem bản đồ tương tác tại trang **Liên hệ** hoặc mục **Địa điểm** ở trang chủ.`
    );
  }

  if (/(hotline|số điện thoại|sđt|zalo|facebook|fanpage|liên lạc|liên hệ)/i.test(lower)) {
    return (
      `📞 **Thông tin liên hệ Quán Bar Đêm:**\n\n` +
      `- **Hotline / Điện thoại:** 0397 062 429 (hoặc ${VENUE.hotline})\n` +
      `- **Zalo tư vấn:** 0397 062 429\n` +
      `- **Facebook Fanpage:** [facebook.com/jayz0904](https://www.facebook.com/jayz0904?locale=vi_VN)\n` +
      `- Quý khách cũng có thể gửi lời nhắn trực tiếp qua form tại trang **Liên hệ** ạ.`
    );
  }

  // BƯỚC 4: ĐẶT BÀN & QUY ĐỊNH ĐẶT CHỖ
  if (/(đặt bàn|giữ chỗ|đặt chỗ|còn bàn|sức chứa|hẹn trước|quy định đặt)/i.test(lower)) {
    return (
      `📅 **Quy định đặt bàn tại Quán Bar Đêm:**\n\n` +
      `- **Sức chứa:** Tối đa ${BOOKING_RULES.capacity} khách trong một khung giờ (mỗi lượt giữ chỗ trong ${BOOKING_RULES.slotMinutes / 60} tiếng).\n` +
      `- **Thời gian:** Quý khách có thể đặt trước từ ${BOOKING_RULES.minLeadMinutes} phút đến tối đa ${BOOKING_RULES.maxDaysAhead} ngày.\n` +
      `- **Gọi món trước:** Là **tuỳ chọn** (quý khách có thể chỉ đặt giữ bàn và gọi món khi đến quán, hoặc chọn sẵn món trong thực đơn).\n` +
      `- **Độ tuổi:** Chỉ phục vụ khách từ **đủ 18 tuổi trở lên** (quý khách vui lòng mang theo CCCD khi đến quán).\n\n` +
      `👉 Quý khách có thể bấm vào mục **[Đặt bàn & Gọi món](order.html)** trên thanh menu để đặt chỗ ngay trong 1 phút!`
    );
  }

  // BƯỚC 5: MÃ GIẢM GIÁ & VOUCHER KHUYẾN MÃI
  if (/(voucher|mã giảm|khuyến mãi|ưu đãi|sale|coupon|mã)/i.test(lower)) {
    try {
      const vouchers = await getAllVouchers();
      const activeList = vouchers.filter((v) => v.active);
      if (activeList.length > 0) {
        const lines = activeList
          .map((v) => {
            const val = v.type === "percent" ? `${v.value}%` : `${formatMoney(v.value)}`;
            const max = v.maxDiscount > 0 ? ` (tối đa ${formatMoney(v.maxDiscount)})` : "";
            const min = v.minOrder > 0 ? ` cho đơn từ ${formatMoney(v.minOrder)}` : "";
            return `- 🎟️ Mã **\`${v.code}\`**: Giảm **${val}**${max}${min}.\n  *${v.description}*`;
          })
          .join("\n");
        return (
          `🎁 **Các mã ưu đãi hiện có tại Quán Bar Đêm:**\n\n${lines}\n\n` +
          `💡 *Cách dùng: Khi đặt bàn tại trang [Đặt bàn & Gọi món](order.html), quý khách chỉ cần nhập mã vào ô "Mã giảm giá" và bấm Áp dụng nhé!*`
        );
      }
    } catch {
      // fallback
    }
    return (
      "🎁 **Ưu đãi hôm nay:**\n\n" +
      "- Mã **`WELCOME10`**: Giảm 10% (tối đa 100.000đ) cho khách hàng mới (đơn từ 200.000đ).\n" +
      "- Mã **`GIAM50K`**: Giảm ngay 50.000đ cho đơn từ 300.000đ.\n" +
      "- Mã **`HAPPYNIGHT`**: Giảm 15% (tối đa 150.000đ) cho tiệc từ 400.000đ.\n\n" +
      "Quý khách có thể nhập mã này khi đặt bàn tại trang **Đặt bàn & Gọi món** ạ!"
    );
  }

  // BƯỚC 6: CHÍNH SÁCH THÀNH VIÊN & TÍCH ĐIỂM
  if (/(thành viên|tích điểm|điểm thưởng|đổi điểm|hạng|lên hạng|bạc|vàng|kim cương)/i.test(lower)) {
    return (
      `⭐ **Chương trình Thành viên & Tích điểm:**\n\n` +
      `- **Đăng ký tài khoản:** Nhận ngay **20 điểm chào mừng** khi tạo tài khoản.\n` +
      `- **Tích điểm khi dùng đồ uống:** Mỗi **10.000đ** chi tiêu = tích **1 điểm**.\n` +
      `- **Dùng điểm đổi tiền:** **1 điểm = 500đ** giảm giá trực tiếp (trừ tối đa 50% đơn).\n\n` +
      `👑 **4 Hạng thành viên & Quyền lợi giảm giá:**\n` +
      `1. **Thân thiết (0 - 49 điểm):** Tích điểm chuẩn.\n` +
      `2. **Bạc (50 - 149 điểm):** Giảm trực tiếp **3%** mọi hóa đơn.\n` +
      `3. **Vàng (150 - 399 điểm):** Giảm trực tiếp **5%** mọi hóa đơn.\n` +
      `4. **Kim Cương (Từ 400 điểm):** Giảm trực tiếp **8%** mọi hóa đơn & ưu tiên giữ bàn VIP quầy bar.\n\n` +
      `Quý khách có thể đăng nhập hoặc tạo tài khoản tại mục **Tài khoản** trên thanh điều hướng!`
    );
  }

  // BƯỚC 7: QUY ĐỊNH 18+ (TUỔI)
  if (/(tuổi|18|dưới 18|trẻ em|vị thành niên)/i.test(lower)) {
    return (
      "🔞 **Quy định độ tuổi tại Quán Bar Đêm:**\n\n" +
      "Theo Luật Phòng, chống tác hại của rượu, bia 2019, quán **chỉ phục vụ khách từ đủ 18 tuổi trở lên**.\n" +
      "- Khi đăng ký tài khoản hoặc đặt bàn, quý khách cần cung cấp ngày sinh xác nhận đủ 18 tuổi.\n" +
      "- Khách hàng dưới 18 tuổi sẽ không được phục vụ đồ uống có cồn. Chúng em rất mong quý khách thông cảm vì sự an toàn và tuân thủ pháp luật!"
    );
  }

  // BƯỚC 8: TƯ VẤN COCKTAIL THEO GU VỊ HOẶC TÌM MÓN CỤ THỂ
  try {
    const drinks = await getAllDrinks();

    // 8.1 Tìm theo tên món cụ thể (VD: Negroni, Old Fashioned, Margarita...)
    const matchedDrink = drinks.find((d) => {
      const dName = d.name.toLowerCase();
      const dBase = (d.baseSpirit || "").toLowerCase();
      if (lower.includes(dName)) return true;
      if (dBase && lower.includes(dBase)) return true;
      // Khớp theo từng từ chính (ví dụ khách gõ 'negroni' khớp 'Negroni Classico')
      const mainWords = dName.split(/[\s-]+/).filter((w) => w.length >= 4);
      return mainWords.some((w) => lower.includes(w));
    });

    if (matchedDrink) {
      return (
        `🍸 **${matchedDrink.name}** — ${formatMoney(matchedDrink.price)}\n\n` +
        `- **Nhóm:** ${matchedDrink.category === "spirits" ? "Rượu mạnh thượng hạng" : "Cocktail hảo hạng"}\n` +
        `- **Nồng độ cồn:** ${matchedDrink.abv || 20}% ABV\n` +
        `- **Rượu nền:** ${matchedDrink.baseSpirit || "Thảo mộc tự nhiên"}\n` +
        `- **Ghi chú hương vị:** ${matchedDrink.tasteNotes ? matchedDrink.tasteNotes.join(", ") : "Hương vị nồng nàn"}\n` +
        `- **Mô tả:** ${matchedDrink.description}\n` +
        `- **Thành phần:** ${matchedDrink.ingredients ? matchedDrink.ingredients.join(" · ") : "Công thức độc quyền"}\n\n` +
        `Quý khách có thể xem và thêm món này vào giỏ hàng tại mục **[Menu](menu.html)** ạ!`
      );
    }

    // 8.2 Tư vấn theo gu vị (chua, ngọt, đắng, khói, nhẹ, mạnh, không cồn)
    if (/(chua|citrus|chanh|thanh mát|refreshing)/i.test(lower)) {
      const sourDrinks = drinks.filter((d) =>
        (d.tasteNotes || []).some((t) => /chua|cam|chanh|thanh|mát/i.test(t))
      );
      const items = sourDrinks.slice(0, 3).map((d) => `- **${d.name}** (${formatMoney(d.price)}): ${d.description}`).join("\n");
      return (
        `🍋 **Gợi ý cocktail vị chua thanh, sảng khoái:**\n\n${items}\n\n` +
        `Các ly này kết hợp hoàn hảo giữa rượu nền hảo hạng và tinh dầu họ cam chanh tươi, rất thích hợp để mở đầu buổi tối!`
      );
    }

    if (/(đắng|bitter|campari|thảo mộc|herbal)/i.test(lower)) {
      const bitterDrinks = drinks.filter((d) =>
        (d.tasteNotes || []).some((t) => /đắng|thảo mộc|campari/i.test(t))
      );
      const items = bitterDrinks.slice(0, 3).map((d) => `- **${d.name}** (${formatMoney(d.price)}): ${d.description}`).join("\n");
      return (
        `🌿 **Gợi ý cocktail vị đắng thanh & thảo mộc sâu lắng:**\n\n${items}\n\n` +
        `Tiêu biểu là dòng Negroni kinh điển với Campari và Sweet Vermouth, mang lại cảm giác trưởng thành, trầm ấm.`
      );
    }

    if (/(khói|smoke|nướng|ấm|gỗ sồi|bourbon|whisky|whiskey)/i.test(lower)) {
      const smokyDrinks = drinks.filter((d) =>
        (d.tasteNotes || []).some((t) => /khói|sồi|ấm|nồng/i.test(t)) || /bourbon|whisky/i.test(d.baseSpirit)
      );
      const items = smokyDrinks.slice(0, 3).map((d) => `- **${d.name}** (${formatMoney(d.price)}): ${d.description}`).join("\n");
      return (
        `🪵 **Gợi ý cocktail vị khói sồi & Whisky nồng ấm:**\n\n${items}\n\n` +
        `Điểm nhấn là ly Smoked Old Fashioned được hun khói gỗ hồ đào trực tiếp, lưu hương quyến rũ trên từng giọt rượu.`
      );
    }

    if (/(ngọt|dễ uống|ngọt ngào|hoa quả|trái cây|béo)/i.test(lower)) {
      const sweetDrinks = drinks.filter((d) =>
        (d.tasteNotes || []).some((t) => /ngọt|dịu|trái cây|hoa quả|béo/i.test(t))
      );
      const items = sweetDrinks.slice(0, 3).map((d) => `- **${d.name}** (${formatMoney(d.price)}): ${d.description}`).join("\n");
      return (
        `🍓 **Gợi ý cocktail ngọt ngào, êm dịu, dễ thưởng thức:**\n\n${items}\n\n` +
        `Nồng độ cồn nhẹ nhàng kết hợp hương vị hoa quả tươi, thích hợp cho quý cô hoặc người mới bắt đầu khám phá thế giới cocktail.`
      );
    }

    if (/(không cồn|mocktail|lái xe|không say|nhẹ)/i.test(lower)) {
      const mocktails = drinks.filter((d) => d.category === "mocktail" || (d.abv && d.abv < 5));
      const items = (mocktails.length > 0 ? mocktails : drinks.slice(0, 3))
        .slice(0, 3)
        .map((d) => `- **${d.name}** (${formatMoney(d.price)}): ${d.description}`)
        .join("\n");
      return (
        `🍹 **Gợi ý đồ uống nồng độ nhẹ / Mocktail:**\n\n${items}\n\n` +
        `Quán Bar Đêm luôn ủng hộ phong cách "Uống có trách nhiệm - Đã uống rượu bia thì không lái xe" ạ!`
      );
    }

    if (/(bán chạy|ngon nhất|signature|đặc sắc|best seller|nổi tiếng)/i.test(lower)) {
      const topDrinks = drinks.filter((d) => d.featured).slice(0, 4);
      const items = topDrinks.map((d) => `- ⭐ **${d.name}** (${formatMoney(d.price)}): ${d.description}`).join("\n");
      return (
        `✨ **Top các món đặc tuyển (Signature & Best-seller) được yêu thích nhất:**\n\n${items}\n\n` +
        `Quý khách có thể xem toàn bộ ảnh và câu chuyện pha chế tại mục **[Menu](menu.html)** dạng sách lật 3D sống động!`
      );
    }
  } catch {
    // Không nạp được drinks API
  }

  // BƯỚC 9: MẶC ĐỊNH CHO CÁC CÂU HỎI VỀ QUÁN
  return (
    "Dạ em đã ghi nhận câu hỏi của quý khách về Quán Bar Đêm. 🍸\n\n" +
    "Để em hỗ trợ quý khách tốt nhất, quý khách có thể chọn một trong các chủ đề sau:\n" +
    "- 🍹 **Tư vấn cocktail theo gu vị** (chua, ngọt, đắng thảo mộc, khói sồi, nồng độ nhẹ/mạnh)\n" +
    "- 📅 **Hướng dẫn đặt bàn** & kiểm tra giờ mở cửa (18:00 - 02:00 sáng)\n" +
    "- 🎟️ **Mã giảm giá hôm nay** (WELCOME10, GIAM50K, HAPPYNIGHT)\n" +
    "- ⭐ **Chính sách tích điểm thành viên** (Bạc, Vàng, Kim Cương)\n" +
    "- 📍 **Địa chỉ quán & Hotline:** 74-76 Nam Kỳ Khởi Nghĩa, Q.1 · Hotline: 0397 062 429\n\n" +
    "Quý khách đang quan tâm đến mục nào ạ?"
  );
}

/** Trạng thái cờ đã gắn sự kiện toàn cục cho Chatbot hay chưa */
let chatbotEventsBound = false;

/**
 * Mở hoặc đóng cửa sổ Trợ lý Bartender ảo
 * @param {boolean} [shouldOpen] - true: mở, false: đóng, undefined: đảo trạng thái
 */
export function toggleChatbotWindow(shouldOpen) {
  const chatWindow = document.getElementById("bar-chatbot-window");
  const input = document.getElementById("chatbot-input");
  if (!chatWindow) return;

  const isOpen = !chatWindow.hidden && chatWindow.classList.contains("chat-window-open");
  const nextOpen = typeof shouldOpen === "boolean" ? shouldOpen : !isOpen;

  const toggleBtns = document.querySelectorAll("#bar-chatbot-toggle-btn, .bar-chatbot-toggle-btn");

  if (nextOpen) {
    chatWindow.hidden = false;
    requestAnimationFrame(() => {
      chatWindow.classList.add("chat-window-open");
    });
    toggleBtns.forEach((btn) => btn.classList.add("is-active"));
    input?.focus();
    const messagesEl = document.getElementById("chatbot-messages");
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
  } else {
    chatWindow.classList.remove("chat-window-open");
    toggleBtns.forEach((btn) => btn.classList.remove("is-active"));
    setTimeout(() => {
      if (!chatWindow.classList.contains("chat-window-open")) {
        chatWindow.hidden = true;
      }
    }, 250);
  }
}

/** Khởi tạo giao diện Cửa sổ Chatbot Widget gắn vào trang */
export function renderChatbotWidget() {
  if (typeof document === "undefined" || !document.body) return;

  let chatWindow = document.getElementById("bar-chatbot-window");
  if (!chatWindow) {
    chatWindow = document.createElement("div");
    chatWindow.id = "bar-chatbot-window";
    chatWindow.className = "bar-chatbot-window";
    chatWindow.hidden = true;
    chatWindow.setAttribute("aria-label", "Cửa sổ tư vấn của Bartender ảo");

    chatWindow.innerHTML = `
      <div class="chatbot-header">
        <div class="chatbot-header-info">
          <div class="chatbot-avatar">${BOT_PROFILE.avatarText}</div>
          <div>
            <div class="chatbot-name">${BOT_PROFILE.name}</div>
            <div class="chatbot-status">
              <span class="status-indicator-dot"></span>
              <span>Đang trực quầy bar · Sẵn sàng tư vấn</span>
            </div>
          </div>
        </div>
        <div class="chatbot-header-actions">
          <button type="button" class="chatbot-head-btn" id="btn-chatbot-clear" title="Xóa lịch sử chat" aria-label="Xóa tin nhắn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
          <button type="button" class="chatbot-head-btn" id="btn-chatbot-close" title="Đóng cửa sổ chat" aria-label="Đóng chat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      <!-- Khung thông báo giới hạn phạm vi an toàn -->
      <div class="chatbot-scope-badge">
        <span class="scope-icon">🔒</span>
        <span>Chuyên viên tư vấn độc quyền về Menu, Đặt bàn &amp; Dịch vụ Quán Bar Đêm</span>
      </div>

      <!-- Danh sách tin nhắn -->
      <div class="chatbot-messages" id="chatbot-messages">
        <!-- Tin nhắn khởi đầu -->
        <div class="chat-bubble chat-bubble-bot">
          <div class="chat-text">${formatMarkdown(BOT_PROFILE.welcomeMessage)}</div>
          <span class="chat-time">${formatChatTime()}</span>
        </div>
      </div>

      <!-- Gợi ý câu hỏi nhanh (Quick Chips) -->
      <div class="chatbot-quick-chips" id="chatbot-quick-chips">
        <button type="button" class="quick-chip-btn" data-query="Món cocktail nào bán chạy nhất?">🍹 Món bán chạy</button>
        <button type="button" class="quick-chip-btn" data-query="Tư vấn cho tôi cocktail vị chua thanh">🍋 Vị chua thanh</button>
        <button type="button" class="quick-chip-btn" data-query="Tôi thích vị khói sồi nồng ấm">🪵 Vị khói sồi</button>
        <button type="button" class="quick-chip-btn" data-query="Hôm nay có mã giảm giá voucher nào?">🎟️ Mã voucher</button>
        <button type="button" class="quick-chip-btn" data-query="Quán mở cửa mấy giờ và ở đâu?">🕒 Giờ &amp; Địa chỉ</button>
        <button type="button" class="quick-chip-btn" data-query="Quy định đặt bàn và sức chứa thế nào?">📅 Đặt bàn</button>
      </div>

      <!-- Ô nhập tin nhắn -->
      <form class="chatbot-input-row" id="chatbot-form" novalidate>
        <input type="text"
               id="chatbot-input"
               class="chatbot-input"
               placeholder="Hỏi về cocktail, đặt bàn, voucher..."
               autocomplete="off"
               maxlength="200"
               aria-label="Nhập câu hỏi cho Bartender">
        <button type="submit" class="chatbot-send-btn" id="btn-chatbot-send" aria-label="Gửi tin nhắn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </form>
    `;

    document.body.appendChild(chatWindow);
  }

  // Trường hợp trang không có thanh nổi contact widget, thêm nút dự phòng
  if (!document.getElementById("bar-chatbot-toggle-btn")) {
    const fallbackBtn = document.createElement("button");
    fallbackBtn.type = "button";
    fallbackBtn.className = "floating-contact-btn floating-btn-chatbot";
    fallbackBtn.id = "bar-chatbot-toggle-btn";
    fallbackBtn.setAttribute("aria-label", "Trò chuyện với Bartender ảo");
    fallbackBtn.innerHTML = `
      <span class="floating-btn-pulse"></span>
      <span class="floating-btn-tooltip">AI Bartender</span>
      <span class="floating-chatbot-icon">🍸</span>
      <span class="floating-chatbot-badge">AI</span>
    `;
    document.body.appendChild(fallbackBtn);
  }

  bindChatbotEvents();
}

/** Gắn sự kiện cho các thành phần của Chatbot (chỉ gắn 1 lần duy nhất trên document) */
function bindChatbotEvents() {
  if (chatbotEventsBound) return;
  chatbotEventsBound = true;

  // Lắng nghe click toàn cục cho nút toggle và nút đóng
  document.addEventListener("click", (e) => {
    const toggleBtn = e.target.closest("#bar-chatbot-toggle-btn, .bar-chatbot-toggle-btn");
    if (toggleBtn) {
      e.preventDefault();
      toggleChatbotWindow();
      return;
    }

    const closeBtn = e.target.closest("#btn-chatbot-close");
    if (closeBtn) {
      e.preventDefault();
      toggleChatbotWindow(false);
      return;
    }

    // Đóng khi click ra ngoài cửa sổ chat
    const chatWindow = document.getElementById("bar-chatbot-window");
    if (chatWindow && !chatWindow.hidden && chatWindow.classList.contains("chat-window-open")) {
      if (!e.target.closest("#bar-chatbot-window") && !e.target.closest("#bar-chatbot-toggle-btn, .bar-chatbot-toggle-btn")) {
        toggleChatbotWindow(false);
      }
    }
  });

  // Phím ESC đóng chat
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const chatWindow = document.getElementById("bar-chatbot-window");
      if (chatWindow && !chatWindow.hidden) {
        toggleChatbotWindow(false);
      }
    }
  });

  // Sự kiện xóa lịch sử chat
  document.addEventListener("click", (e) => {
    const clearBtn = e.target.closest("#btn-chatbot-clear");
    if (!clearBtn) return;
    const messagesEl = document.getElementById("chatbot-messages");
    if (messagesEl) {
      messagesEl.innerHTML = `
        <div class="chat-bubble chat-bubble-bot">
          <div class="chat-text">${formatMarkdown(BOT_PROFILE.welcomeMessage)}</div>
          <span class="chat-time">${formatChatTime()}</span>
        </div>`;
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  });

  // Xử lý gửi tin nhắn
  const handleSendMessage = async (rawText) => {
    const text = String(rawText || "").trim();
    if (!text) return;

    const messagesEl = document.getElementById("chatbot-messages");
    const input = document.getElementById("chatbot-input");
    if (!messagesEl) return;

    const scrollToBottom = () => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    };

    const userBubble = document.createElement("div");
    userBubble.className = "chat-bubble chat-bubble-user";
    userBubble.innerHTML = `
      <div class="chat-text">${escapeHtml(text)}</div>
      <span class="chat-time">${formatChatTime()}</span>
    `;
    messagesEl.appendChild(userBubble);
    if (input) input.value = "";
    scrollToBottom();

    const typing = document.createElement("div");
    typing.className = "chat-bubble chat-bubble-bot typing-indicator-bubble";
    typing.id = "chatbot-typing";
    typing.innerHTML = `
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    `;
    messagesEl.appendChild(typing);
    scrollToBottom();

    // Giả lập độ trễ pha chế & phản hồi tự nhiên (300ms - 650ms)
    const delay = Math.min(650, Math.max(300, text.length * 15));
    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      const botReply = await getBotResponse(text);
      typing.remove();
      const botBubble = document.createElement("div");
      botBubble.className = "chat-bubble chat-bubble-bot";
      botBubble.innerHTML = `
        <div class="chat-text">${formatMarkdown(botReply)}</div>
        <span class="chat-time">${formatChatTime()}</span>
      `;
      messagesEl.appendChild(botBubble);
      scrollToBottom();
    } catch {
      typing.remove();
      const errBubble = document.createElement("div");
      errBubble.className = "chat-bubble chat-bubble-bot";
      errBubble.innerHTML = `
        <div class="chat-text">Dạ em thành thật xin lỗi, hệ thống đang bận một chút. Quý khách vui lòng thử lại hoặc gọi Hotline **0397 062 429** để được hỗ trợ ngay ạ!</div>
        <span class="chat-time">${formatChatTime()}</span>
      `;
      messagesEl.appendChild(errBubble);
      scrollToBottom();
    }
  };

  // Submit form chat
  document.addEventListener("submit", (e) => {
    if (e.target && e.target.id === "chatbot-form") {
      e.preventDefault();
      const input = document.getElementById("chatbot-input");
      handleSendMessage(input?.value);
    }
  });

  // Bấm nút gợi ý nhanh Quick Chips
  document.addEventListener("click", (e) => {
    const chip = e.target.closest(".quick-chip-btn");
    if (chip && chip.dataset.query) {
      handleSendMessage(chip.dataset.query);
    }
  });
}

/** Chuyển đổi markdown cơ bản (in đậm **, gạch đầu dòng -, link []) sang HTML an toàn */
function formatMarkdown(text) {
  if (!text) return "";
  let html = escapeHtml(text);

  // In đậm: **chữ**
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // In nghiêng: *chữ*
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Code inline: `code`
  html = html.replace(/`([^`]+)`/g, "<code class='chat-inline-code'>$1</code>");

  // Link dạng: [chữ](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="chat-link" target="_self">$1</a>');

  // Xuống dòng: \n -> <br>
  html = html.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>");

  return `<p>${html}</p>`;
}

/** Lấy thời gian hiện tại định dạng HH:MM */
function formatChatTime() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

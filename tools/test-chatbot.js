/* =========================================================
   TEST-CHATBOT.JS - Bộ kiểm thử tự động Trợ lý Bartender ảo AI
   Kiểm tra nghiêm ngặt nguyên tắc:
   "CHỈ trả lời trong phạm vi web, trả lời bên ngoài là THẤT BẠI"
   ========================================================= */

import { isOutOfScope, getBotResponse, BOT_PROFILE } from "../js/modules/chatbot.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  OK   ${message}`);
    passed++;
  } else {
    console.error(`  FAIL ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n==============================================================");
  console.log("KIỂM THỬ TRỢ LÝ BARTENDER ẢO: BẢO VỆ PHẠM VI QUÁN BAR (STRICT)");
  console.log("==============================================================\n");

  // -------------------------------------------------------------------------
  // NHÓM 1: CÁC CÂU HỎI NGOÀI PHẠM VI (BẮT BUỘC PHẢI TỪ CHỐI)
  // -------------------------------------------------------------------------
  console.log("[1] Các câu hỏi ngoài phạm vi (Toán học, Lập trình, Thời tiết, Chính trị...)");

  const outOfScopeQuestions = [
    // Toán học
    "1 + 1 bằng mấy?",
    "Tính tích phân từ 0 đến 1 của x^2",
    "Giải phương trình bậc 2: x^2 - 4 = 0",
    "Căn bậc hai của 144 là bao nhiêu?",
    "Diện tích hình tròn bán kính r=5 là gì?",
    // Lập trình & CNTT ngoài lề
    "Viết code python đảo ngược chuỗi",
    "Lập trình javascript kết nối database mysql",
    "HTML thẻ div dùng để làm gì?",
    "Hướng dẫn cài win 11 cho máy tính",
    "Làm sao để hack tài khoản facebook?",
    // Thời tiết
    "Thời tiết hôm nay ở Hà Nội thế nào?",
    "Dự báo thời tiết ngày mai trời có mưa không?",
    "Nhiệt độ hiện tại ở Đà Lạt là bao nhiêu?",
    // Địa lý & Lịch sử & Bách khoa ngoài lề
    "Thủ đô của nước Pháp là gì?",
    "Tổng thống Mỹ hiện tại là ai?",
    "Chiến tranh thế giới thứ hai kết thúc năm nào?",
    "Dân số thế giới hiện nay là bao nhiêu người?",
    // Thể thao & Showbiz
    "Tối nay có trận bóng đá ngoại hạng Anh nào không?",
    "Ronaldo và Messi ai ghi nhiều bàn thắng hơn?",
    "Giá bitcoin hôm nay tăng hay giảm?",
    // Thơ văn & Dịch thuật ngoài lề
    "Làm giúp tôi một bài thơ tình yêu lãng mạn",
    "Kể cho tôi nghe một câu chuyện cổ tích",
    "Kể một câu chuyện cười vui nhộn",
    "Dịch giúp tôi đoạn văn này sang tiếng Anh",
  ];

  for (const q of outOfScopeQuestions) {
    const isOut = isOutOfScope(q);
    const resp = await getBotResponse(q);
    const rejected = resp.includes("ngoài phạm vi") || resp === BOT_PROFILE.outOfScopeMessage;
    assert(isOut && rejected, `Chặn thành công câu hỏi ngoài phạm vi: "${q}"`);
  }

  // -------------------------------------------------------------------------
  // NHÓM 2: CÁC CÂU HỎI TRONG PHẠM VI QUÁN BAR (PHẢI TRẢ LỜI CHÍNH XÁC)
  // -------------------------------------------------------------------------
  console.log("\n[2] Các câu hỏi trong phạm vi Quán Bar Đêm (Phải trả lời đúng nghiệp vụ)");

  const inScopeCases = [
    {
      q: "Quán mở cửa mấy giờ vậy em?",
      keyword: "18:00",
      desc: "Hỏi giờ mở cửa (trả về 18:00 - 02:00)",
    },
    {
      q: "Địa chỉ quán bar ở đâu?",
      keyword: "Nam Kỳ Khởi Nghĩa",
      desc: "Hỏi địa chỉ quán (trả về 74-76 Nam Kỳ Khởi Nghĩa, Q.1)",
    },
    {
      q: "Số hotline hoặc điện thoại liên hệ của quán là gì?",
      keyword: "0397 062 429",
      desc: "Hỏi số điện thoại liên hệ của quán",
    },
    {
      q: "Quy định đặt bàn trước như thế nào?",
      keyword: "đặt bàn",
      desc: "Hỏi quy định và sức chứa đặt bàn",
    },
    {
      q: "Hôm nay quán có mã giảm giá voucher nào không?",
      keyword: "WELCOME10",
      desc: "Hỏi mã voucher khuyến mãi",
    },
    {
      q: "Chính sách tích điểm thành viên và lên hạng thế nào?",
      keyword: "Thân thiết",
      desc: "Hỏi chính sách thành viên, tích điểm, đổi điểm",
    },
    {
      q: "Quán có cocktail nào vị chua thanh sảng khoái không?",
      keyword: "chua",
      desc: "Tư vấn cocktail theo vị chua thanh",
    },
    {
      q: "Tư vấn cho tôi cocktail vị khói sồi whisky nồng ấm",
      keyword: "Smoked Old Fashioned",
      desc: "Tư vấn cocktail vị khói sồi",
    },
    {
      q: "Cho tôi hỏi ly Negroni giá bao nhiêu và pha từ gì?",
      keyword: "Negroni",
      desc: "Tra cứu thông tin ly cocktail cụ thể (Negroni)",
    },
    {
      q: "Tôi lái xe không muốn uống cồn, quán có mocktail không?",
      keyword: "Mocktail",
      desc: "Tư vấn đồ uống không cồn / lái xe an toàn",
    },
    {
      q: "Dưới 18 tuổi có được vào quán uống rượu không?",
      keyword: "18 tuổi",
      desc: "Giải thích quy định độ tuổi 18+",
    },
    {
      q: "Bạn là ai?",
      keyword: "Bartender ảo",
      desc: "Hỏi danh tính của chatbot (Trợ lý Bartender ảo)",
    },
  ];

  for (const item of inScopeCases) {
    const isOut = isOutOfScope(item.q);
    const resp = await getBotResponse(item.q);
    const matched = !isOut && resp.toLowerCase().includes(item.keyword.toLowerCase());
    assert(matched, item.desc);
  }

  console.log("\n==============================================================");
  if (failed === 0) {
    console.log(`ĐẠT ${passed}/${passed + failed} PHÉP KIỂM TRA CHATBOT.`);
    console.log("XÁC NHẬN: Chatbot tuyệt đối chỉ trả lời trong phạm vi web, chặn 100% câu hỏi ngoài lề!");
  } else {
    console.error(`CÓ ${failed} PHÉP KIỂM TRA THẤT BẠI!`);
  }
  console.log("==============================================================\n");

  if (failed > 0) process.exit(1);
}

runTests();

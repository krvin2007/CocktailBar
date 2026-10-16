/* =========================================================
   EMAIL-CONFIG.JS - Cấu hình gửi email THẬT qua EmailJS
   (https://www.emailjs.com - gửi mail ngay từ JavaScript trên trình duyệt)

   Cách lấy 3 giá trị (tài khoản miễn phí, ~200 mail/tháng):
     1. Đăng ký emailjs.com -> Email Services -> Add New Service (VD Gmail)
        -> chép "Service ID".
     2. Email Templates -> Create New Template. Ô "To Email" điền {{to_email}},
        Subject điền {{subject}}, nội dung dùng các biến (xem README mục Email):
          {{to_name}} {{voucher_code}} {{discount}} {{valid_until}} {{occasion}} {{message}}
        -> chép "Template ID".
     3. Account -> General -> chép "Public Key".

   Public Key của EmailJS được thiết kế để nằm trong mã trình duyệt (không phải
   mật khẩu) - nhưng nên bật giới hạn tên miền trong Account -> Security.

   Để TRỐNG cả 3 -> website KHÔNG gửi mail thật, chỉ lưu thư vào "Hộp thư ưu đãi"
   trong trang Tài khoản (vẫn demo được đầy đủ).
   ========================================================= */

export const EMAILJS_CONFIG = {
  publicKey: "",
  serviceId: "",
  templateId: "",
};

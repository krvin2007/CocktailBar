/* =========================================================
   EMAIL-CONFIG.JS - Cấu hình gửi email THẬT qua EmailJS
   (https://www.emailjs.com - gửi mail ngay từ JavaScript trên trình duyệt, không cần máy chủ)

   Cách lấy 3 giá trị (tài khoản miễn phí, ~200 mail/tháng):
     1. Đăng ký emailjs.com -> Email Services -> Add New Service (VD Gmail) -> chép "Service ID".
     2. Email Templates -> Create New Template:
          To Email : {{to_email}}
          Subject  : {{subject}}
          Nội dung dùng các biến (xem README mục "Gửi email thật"):
          {{customer_name}} {{order_code}} {{service_type}} {{booking_time}} {{guests}} {{seat}}
          {{items_text}} {{discount_text}} {{total}} {{payment_status}} {{address}} {{hotline}} {{message}}
        -> chép "Template ID".
     3. Account -> General -> chép "Public Key".

   Public Key của EmailJS được thiết kế để nằm trong mã trình duyệt (không phải mật khẩu) - nhưng
   nên bật giới hạn tên miền trong Account -> Security.

   Để TRỐNG cả 3 -> website KHÔNG gửi mail thật, chỉ lưu vé vào "Hộp thư" trong trang Tài khoản.
   ========================================================= */

export const EMAILJS_CONFIG = {
  publicKey: "",
  serviceId: "",
  templateId: "",
};

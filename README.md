# 🍸 Quán Bar Đêm — Website Quản Lý & Đặt Bàn Quán Bar Speakeasy (Artisan Cocktail Lounge)

> **Môn học:** Lập trình Web / JavaScript Nâng Cao  
> **Nhóm đề tài:** Nhóm 3 — Website Quản Lý & Thương Mại Dịch Vụ  
> **Công nghệ:** HTML5 + CSS3 + 100% JavaScript thuần ES6+ (Module, OOP Class, Async/Await) + json-server REST API  
> **Trạng thái:** Hoàn thiện 100%, vượt qua **366/366** test tồn kho, **36/36** test chatbot, **63/63** health check, **0 lỗi ESLint**.

---

## 📚 BỘ HỒ SƠ TÀI LIỆU KỸ THUẬT THEO 8 GIAI ĐOẠN PHÁT TRIỂN (SDLC)

Toàn bộ quá trình phát triển hệ thống được tài liệu hóa thành 8 báo cáo chuyên sâu:

1. **[1_phan_tich_yeu_cau.md](1_phan_tich_yeu_cau.md):** Giai đoạn 1 — Phân tích yêu cầu nghiệp vụ, người dùng, phi chức năng và ma trận RTM.
2. **[2_xac_dinh_chuc_nang.md](2_xac_dinh_chuc_nang.md):** Giai đoạn 2 — Xác định và phân rã 21 chức năng, mô hình Use Case, ma trận vai trò.
3. **[workflow.md](workflow.md):** Giai đoạn 3 — Vẽ sơ đồ Workflow cho từng chức năng (Mermaid Flowchart, Sequence, State Machine).
4. **[software_architecture_design.md](software_architecture_design.md):** Giai đoạn 4 — Thiết kế kiến trúc phần mềm (C4 Model, N-Tier, Design Patterns).
5. **[database.md](database.md):** Giai đoạn 5 — Thiết kế cơ sở dữ liệu chi tiết, từ điển dữ liệu (Data Dictionary) và sơ đồ ERD.
6. **[API_Document.md](API_Document.md):** Giai đoạn 6 — Đặc tả thiết kế RESTful API đầy đủ endpoints, request/response payload và mã lỗi.
7. **[7_lap_trinh_frontend_backend.md](7_lap_trinh_frontend_backend.md):** Giai đoạn 7 — Đặc tả triển khai mã nguồn Frontend (HTML5/CSS3/OOP ES6) và Backend (json-server, VietQR, Web Audio).
8. **[8_kiem_thu.md](8_kiem_thu.md):** Giai đoạn 8 — Kế hoạch kiểm thử & Báo cáo kết quả nghiệm thu (366 test kho, 36 test chatbot, 63 health check, 0 lỗi ESLint).

---

## 1. GIỚI THIỆU ĐỀ TÀI

### 1.1. Bối cảnh & Ý tưởng
**Quán Bar Đêm** là hệ thống web ứng dụng mô phỏng mô hình kinh doanh quán Cocktail Bar cao cấp mang phong cách **Speakeasy Lounge** (không gian sang trọng, ánh sáng vàng hổ phách Noir & Champagne Gold, nhạc Jazz hoài cổ).

Dự án giải quyết trọn vẹn 2 bài toán lớn:
- **Dành cho khách hàng (Customer-Facing App):** Xem thực đơn chuẩn quốc tế (chi tiết tỷ lệ pha chế, ABV, Tasting Notes, ly phục vụ), yêu thích, đánh giá 5 sao, chat với Bartender ảo, đặt bàn theo khung giờ thông minh, thanh toán chuyển khoản tự động qua mã VietQR MBBank, nhận vé điện tử Bar Cinema Ticket có mã vạch định danh.
- **Dành cho ban quản trị & nhân viên (Executive POS & Operations):** Bảng điều khiển kinh doanh (Dashboard thống kê doanh thu, số ly bán, đơn theo khung giờ), máy trạng thái quản lý đơn hàng thời gian thực (State Machine liên kết tự động hoàn trừ tồn kho), phân quyền 4 vai trò nhân sự (Quản lý, Thu ngân, Pha chế, Phục vụ), nhập xuất file báo cáo (Excel UTF-8 BOM, In hóa đơn POS PDF, Import thực đơn CSV) và chuông âm thanh Web Audio cảnh báo đơn mới.

### 1.2. Mục tiêu kỹ thuật cốt lõi
- **100% Vanilla JavaScript (ES6+):** Sử dụng các chuẩn hiện đại (`import/export` module, Lập trình hướng đối tượng `class`, `extends`, `getter/setter`, đa hình, `async/await`). Không sử dụng bất kỳ thư viện giao diện ngoài nào (React, Vue, Angular).
- **Mô hình Client - REST API thực thụ:** Tách biệt hoàn toàn tầng giao diện (HTML/CSS) và tầng máy chủ dữ liệu (`json-server` phục vụ file `db.json`).
- **Dự phòng ngoại tuyến (Offline Resilience):** Tích hợp bộ đệm `localStorage` thông minh, hệ thống vẫn duy trì đọc dữ liệu mượt mà kể cả khi máy chủ API mất kết nối tạm thời.

---

## 2. HƯỚNG DẪN CÀI ĐẶT & CHẠY DỰ ÁN

### 2.1. Yêu cầu môi trường
- **Node.js:** Phiên bản v18.0.0 trở lên.
- **Trình duyệt:** Google Chrome, Microsoft Edge, Mozilla Firefox hoặc Safari bản mới nhất.

### 2.2. Khởi chạy nhanh (Chỉ 1 lệnh)
```bash
# 1. Cài đặt các gói phụ thuộc (json-server 0.17.4 + ESLint)
npm install

# 2. Khởi chạy máy chủ kép (Phục vụ đồng thời cả Website và REST API)
npm start
```
Truy cập trình duyệt tại địa chỉ: **http://localhost:3000**

### 2.3. Các lệnh kiểm thử & tiện ích khác
```bash
npm run seed     # Khôi phục dữ liệu mẫu ban đầu về 7 ngày gần nhất (trước buổi demo)
npm test         # Chạy 366 ca kiểm thử nghiệp vụ tồn kho + 36 ca kiểm thử Chatbot
npm run lint     # Kiểm tra chất lượng mã nguồn bằng ESLint (Đạt 0 lỗi, 0 cảnh báo)
npm run health   # Kiểm tra sức khỏe toàn diện 63 bài test (18 HTML, 10 bảng DB, các hàm Service)
```

---

## 3. TÀI KHOẢN TRẢI NGHIỆM HỆ THỐNG

Website sử dụng cơ chế **Đăng nhập một cửa thông minh** tại `customer-auth.html` (Nút **Tài khoản / Đăng nhập** trên thanh điều hướng). Hệ thống tự động phân loại quyền hạn:

| Tài khoản | Mật khẩu | Vai trò nhận diện | Quyền hạn truy cập |
|---|---|---|---|
| `admin` | `Admin@123` | **Quản trị viên / Quản lý quán** | Toàn quyền Dashboard, Thực đơn, Đơn hàng, Nhân sự, Vouchers |
| `cashier1` | `Staff@123` | **Thu ngân (Cashier)** | Quản lý đơn hàng, Duyệt VietQR, In hóa đơn POS PDF, Hộp thư |
| `bar1` | `Staff@123` | **Pha chế (Bartender)** | Danh sách ly cần pha chế, Điều chỉnh tồn kho ly |
| `waiter1` | `Staff@123` | **Phục vụ (Waiter)** | Theo dõi bàn & Trạng thái phục vụ tại chỗ |
| `0901234567` | `Pass@123` | **Khách hàng thành viên** | Đặt bàn, Quét VietQR, Tích điểm, Xem vé điện tử Cinema Ticket |

---

## 4. TỔNG HỢP CÁC TÍNH NĂNG NỔI BẬT

### 4.1. Phân hệ Khách hàng (Customer-Facing App)
- **Thực đơn Cocktail Chuẩn Quốc Tế:** Bộ lọc đa năng theo danh mục (Signature, Classic, Mocktail), nồng độ cồn ABV, hương vị và trạng thái còn hàng.
- **Thẻ đồ uống 3D & Huy hiệu:** Tích hợp huy hiệu `✦ SIGNATURE`, `🔥 BEST-SELLER` nổi bật và hiệu ứng nâng thẻ phát sáng hổ phách Noir.
- **Danh sách Yêu thích & Đánh giá 5 sao:** Thả tim tức thời, chấm sao và bình luận trực tiếp cho từng ly cocktail.
- **Trợ lý Bartender ảo AI:** Chatbot phục vụ tại quầy, tư vấn đồ uống theo vị và chặn 100% câu hỏi ngoài lề không thuộc phạm vi quán bar.
- **Đặt bàn & Phiếu đặt chỗ thông minh:** Bộ chọn Ngày thông minh và Nút chọn khung giờ đón khách nhanh (19:00, 20:00, 21:00...); tự động tính chiết khấu Voucher và hạng thành viên.
- **Thanh toán VietQR MBBank tự động:** Hiển thị mã QR động khớp chính xác số tài khoản, số tiền và nội dung đơn hàng.
- **Vé điện tử Bar Cinema Ticket:** Cấp vé điện tử sang trọng có mã vạch Barcode SVG định danh lưu trong hòm vé điện tử.

### 4.2. Phân hệ Quản trị POS & Vận hành (Admin Back-Office)
- **Dashboard Doanh thu thông minh:** Biểu đồ doanh thu 7 ngày gần nhất, tỷ lệ loại đơn (Tại quán / Đặt trước / Mang đi), Top cocktail bán chạy nhất.
- **Máy trạng thái đơn hàng (FSM):** Quản lý chu trình đơn `Pending` ➔ `Preparing` ➔ `Serving` ➔ `Completed`. Tự động hoàn kho khi huỷ hoặc xoá đơn chưa pha chế.
- **Chuông âm thanh Web Audio API:** Tự động phát âm thanh sang trọng khi có đơn hàng mới hoặc trạng thái đơn thay đổi theo thời gian thực.
- **Quản lý Thực đơn & Kho hàng:** Thêm, sửa, xoá món, cập nhật nồng độ ABV, công thức và mức cảnh báo tồn kho (Hết hàng / Sắp hết).
- **Quản lý Nhân sự & Phân quyền RBAC:** Xét duyệt tài khoản nhân viên mới tự đăng ký, phân bổ ca trực, đổi mật khẩu an toàn.
- **Xuất / Nhập Dữ Liệu Chuyên Nghiệp:** Xuất báo cáo Excel UTF-8 BOM tiếng Việt không lỗi font, in hóa đơn nhiệt POS 80mm PDF, nhập thực đơn hàng loạt từ CSV.

---

## 5. CẤU TRÚC THƯ MỤC DỰ ÁN

```
CocktailBar/
├── index.html                     # Trang chủ Speakeasy Lounge
├── menu.html                      # Danh sách thực đơn đồ uống
├── detail.html                    # Chi tiết ly cocktail & Đánh giá 5 sao
├── order.html                     # Đặt bàn, giỏ hàng & Thanh toán VietQR
├── customer-auth.html             # Đăng nhập một cửa (Khách hàng & Quản trị)
├── customer-account.html          # Trang cá nhân khách: điểm, hạng, hòm vé
├── admin-dashboard.html           # Bảng điều khiển kinh doanh & Thống kê
├── admin-orders.html              # Quản lý đơn hàng, đổi trạng thái, in POS PDF
├── admin-menu.html                # Quản lý thực đơn & tồn kho ly
├── admin-staff.html               # Quản lý nhân sự, duyệt tài khoản, phân quyền
├── admin-customers.html           # Quản lý danh sách khách hàng & hạng thành viên
├── admin-vouchers.html            # Quản lý mã giảm giá khuyến mãi
├── admin-messages.html            # Hộp thư liên hệ & đặt tiệc riêng
├── admin-register.html            # Nhân viên mới tự đăng ký tài khoản
│
├── css/                           # Thiết kế giao diện & Design Tokens
│   ├── variables.css              # Bảng màu Noir, Gold, Spacing, Typography
│   ├── style.css                  # Style chính Speakeasy Lounge, Gold Glow, Scrollbar
│   ├── admin.css                  # Style bảng biểu POS quản trị
│   ├── responsive.css             # Điểm ngắt Responsive Mobile / Tablet / Desktop
│   └── chatbot.css                # Giao diện widget Trợ lý Bartender ảo AI
│
├── js/                            # Mã nguồn JavaScript ES6+
│   ├── modules/                   # Các dịch vụ nghiệp vụ (Domain Services)
│   │   ├── api.js                 # HTTP REST Adapter (Axios + Fetch fallback)
│   │   ├── drinksService.js       # Quản lý cocktail, ABV, tồn kho
│   │   ├── ordersService.js       # Máy trạng thái đơn hàng (Lớp Order kế thừa)
│   │   ├── customerAuth.js        # Xác thực khách hàng, hạng thẻ, điểm thưởng
│   │   ├── staffAuth.js           # Phân quyền vai trò RBAC nhân sự
│   │   ├── vietqrService.js       # Tích hợp sinh URL mã QR động MBBank
│   │   ├── emailService.js        # Sinh mã vạch Barcode SVG & Vé Cinema Ticket
│   │   ├── exportService.js       # Xuất Excel UTF-8 BOM, In hóa đơn POS PDF
│   │   ├── favoritesService.js    # Quản lý danh sách cocktail yêu thích
│   │   ├── reviewsService.js      # Đánh giá 5 sao & bình luận
│   │   ├── chatbotService.js      # Trợ lý Bartender ảo AI bảo vệ phạm vi quán
│   │   ├── notificationService.js # Chuông âm thanh Web Audio API thời gian thực
│   │   └── utils.js               # Các tiện ích format tiền tệ, escapeHtml...
│   └── pages/                     # Tầng điều khiển theo từng trang HTML
│
├── tools/                         # Bộ công cụ kiểm thử tự động
│   ├── kiem-tra-ton-kho.js        # 366 test nghiệp vụ kho & đơn hàng
│   ├── test-chatbot.js            # 36 test phạm vi Trợ lý Bartender AI
│   └── kiem-tra-toan-dien.js      # 63 kiểm tra sức khỏe toàn diện (Health Check)
│
├── db.json                        # Cơ sở dữ liệu JSON 10 bảng của quán
├── package.json                   # Cấu hình script npm & dependencies
└── README.md                      # Tài liệu giới thiệu đề tài này
```

---

*Đồ án được thực hiện nghiêm túc, chuẩn mực, hoàn thiện đầy đủ hồ sơ kỹ thuật theo yêu cầu giảng viên và môn học.*

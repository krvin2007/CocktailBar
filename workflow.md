# 🔄 TÀI LIỆU WORKFLOW CHO TỪNG CHỨC NĂNG (SYSTEM WORKFLOWS)
## HỆ THỐNG QUẢN LÝ & ĐẶT BÀN QUÁN BAR ĐÊM (ARTISAN SPEAKEASY LOUNGE)

> **Môn học:** Lập trình Web / JavaScript Nâng Cao  
> **Tài liệu:** Bài tập 2 — Vẽ Workflow chi tiết cho từng chức năng của hệ thống  
> **Định dạng:** Markdown kết hợp Mermaid Diagrams và Bảng đặc tả luồng thao tác.

---

## MỤC LỤC DANH MỤC WORKFLOW

1. [Sơ đồ tổng thể toàn bộ hệ thống (End-to-End Master Workflow)](#1-sơ-đồ-tổng-thể-toàn-bộ-hệ-thống)
2. [Workflow F01: Tra cứu, tìm kiếm & Lọc thực đơn đa tiêu chí](#2-workflow-f01-tra-cứu-tìm-kiếm--lọc-thực-đơn)
3. [Workflow F02: Xem chi tiết ly cocktail & Thành phần pha chế](#3-workflow-f02-xem-chi-tiết-ly-cocktail)
4. [Workflow F03: Yêu thích Cocktail (Favorites - Thả tim động)](#4-workflow-f03-yêu-thích-cocktail-favorites)
5. [Workflow F04: Đánh giá & Bình luận 5 sao cho đồ uống](#5-workflow-f04-đánh-giá--bình-luận-5-sao)
6. [Workflow F05: Trợ lý Bartender ảo AI phục vụ tại quầy](#6-workflow-f05-trợ-lý-bartender-ảo-ai)
7. [Workflow F06: Đặt bàn & Chọn khung giờ đón khách](#7-workflow-f06-đặt-bàn--chọn-khung-giờ-đón-khách)
8. [Workflow F07: Thanh toán chuyển khoản tự động VietQR MBBank](#8-workflow-f07-thanh-toán-chuyển-khoản-vietqr-mbbank)
9. [Workflow F08: Cấp phát vé điện tử Bar Cinema Ticket (Barcode SVG)](#9-workflow-f08-cấp-phát-vé-điện-tử-bar-cinema-ticket)
10. [Workflow F09: Đăng nhập một cửa & Tích điểm thành viên](#10-workflow-f09-đăng-nhập-một-cửa--tích-điểm-thành-viên)
11. [Workflow F10: Phân quyền vai trò nhân sự (RBAC Flow)](#11-workflow-f10-phân-quyền-vai-trò-nhân-sự-rbac)
12. [Workflow F11: Quản lý vòng đời đơn hàng & Máy trạng thái hoàn trừ kho](#12-workflow-f11-quản-lý-vòng-đời-đơn-hàng--hoàn-trừ-kho)
13. [Workflow F12: Chuông âm thanh Web Audio API cảnh báo đơn mới](#13-workflow-f12-chuông-âm-thanh-web-audio-api)
14. [Workflow F13: Quản trị thực đơn & Điều chỉnh số tồn kho ly](#14-workflow-f13-quản-trị-thực-đơn--điều-chỉnh-tồn-kho)
15. [Workflow F14: Quản trị nhân sự & Xét duyệt tài khoản nhân viên mới](#15-workflow-f14-quản-trị-nhân-sự--duyệt-nhân-viên-mới)
16. [Workflow F15: Quản trị mã giảm giá (Vouchers) & Áp dụng ưu đãi](#16-workflow-f15-quản-trị-mã-giảm-giá-vouchers)
17. [Workflow F16: In hóa đơn nhiệt POS 80mm PDF & Xuất báo cáo Excel](#17-workflow-f16-in-hóa-đơn-pos-pdf--xuất-báo-cáo-excel)
18. [Workflow F17: Nhập thực đơn hàng loạt từ file CSV](#18-workflow-f17-nhập-thực-đơn-hàng-loạt-từ-file-csv)
19. [Workflow F18: Bảng điều khiển kinh doanh thông minh (Dashboard)](#19-workflow-f18-bảng-điều-khiển-kinh-doanh-dashboard)

---

## 1. SƠ ĐỒ TỔNG THỂ TOÀN BỘ HỆ THỐNG

```mermaid
flowchart TD
    %% Khách hàng
    CustomerStart(["Khách hàng truy cập"]) --> HomePage["Trang chủ (index.html)"]
    HomePage --> MenuPage["Thực đơn (menu.html)"]
    MenuPage --> DetailPage["Chi tiết ly (detail.html)"]
    DetailPage --> CartAdd["Thêm vào Giỏ hàng"]
    CartAdd --> OrderPage["Đặt bàn & Gọi món (order.html)"]
    
    OrderPage --> VietQRModal["Quét mã VietQR MBBank"]
    VietQRModal --> OrderSuccess["Đơn thành công ➔ Sinh vé Bar Cinema Ticket"]
    OrderSuccess --> EmailBox["Lưu hòm vé (/emails)"]

    %% Kênh tương tác tức thì
    HomePage --> ChatBot["Trợ lý ảo Bartender AI"]
    ChatBot --> DetailPage

    %% Kênh Quản trị viên
    OrderSuccess -.->|"Tín hiệu đơn mới"| WebAudio["Web Audio API: Chuông reo"]
    WebAudio --> AdminPOS["Quản lý đơn hàng (admin-orders.html)"]
    AdminPOS --> StateShift["Chuyển trạng thái: Pending ➔ Preparing ➔ Completed"]
    StateShift --> PrintBill["In hoá đơn POS PDF / Xuất Excel"]
    
    %% Quản lý tổng thể
    AdminAuth["Đăng nhập Quản trị"] --> AdminDash["Dashboard doanh thu (admin-dashboard.html)"]
    AdminDash --> AdminMenu["Quản lý món & Tồn kho (admin-menu.html)"]
    AdminDash --> AdminStaff["Quản lý & Duyệt nhân sự (admin-staff.html)"]
```

---

## 2. WORKFLOW F01: TRA CỨU, TÌM KIẾM & LỌC THỰC ĐƠN

```mermaid
flowchart TD
    A["Khách truy cập menu.html"] --> B["drinksService tải danh sách món từ /drinks"]
    B --> C["Hiển thị danh sách thẻ đồ uống (Drink Cards)"]
    C --> D{"Khách thao tác tìm kiếm / lọc"}
    D -->|"Nhập ô tìm kiếm"| E["Lọc theo tên, rượu nền, thành phần pha chế"]
    D -->|"Chọn danh mục"| F["Lọc: Signature / Classic / Mocktail / Beer"]
    D -->|"Lọc nồng độ ABV"| G["Lọc: Không cồn / Nhẹ (<15%) / Đậm (>25%)"]
    D -->|"Lọc trạng thái"| H["Chỉ hiển thị món còn hàng (stock > 0)"]
    D -->|"Sắp xếp"| I["Sắp xếp theo Giá tăng/giảm, Rating sao, Tên A-Z"]
    E & F & G & H & I --> J["Hiển thị kết quả lọc ngay tức thì (Debounced)"]
```

---

## 3. WORKFLOW F02: XEM CHI TIẾT LY COCKTAIL

```mermaid
flowchart TD
    A["Bấm vào 1 thẻ đồ uống bất kỳ"] --> B["Chuyển hướng detail.html?id={drink_id}"]
    B --> C["drinksService.getDrinkById(id) gọi GET /drinks/:id"]
    C --> D["Hiển thị ảnh lớn, nồng độ ABV, loại ly, Tasting Notes"]
    D --> E["Hiển thị câu chuyện nguồn gốc & Công thức tỷ lệ pha chế"]
    D --> F["Tải danh sách đánh giá sao từ /reviews?drinkId={id}"]
    D --> G["Nút Thêm vào giỏ: Kiểm tra số tồn kho hiện thời"]
```

---

## 4. WORKFLOW F03: YÊU THÍCH COCKTAIL (FAVORITES)

```mermaid
flowchart LR
    ClickFav["Bấm nút Thả Tim trên thẻ món"] --> Toggle["favoritesService.toggleFavorite(drinkId)"]
    Toggle --> CheckFav{"Món đã có trong yêu thích?"}
    CheckFav -->|"Đã có"| RemoveFav["Xoá khỏi danh sách yêu thích"]
    CheckFav -->|"Chưa có"| AddFav["Thêm id vào danh sách yêu thích"]
    RemoveFav --> UpdateUI["Đổi icon tim thành rỗng & Toast thông báo"]
    AddFav --> UpdateUI2["Đổi icon tim thành đỏ rực (#ef4444) & Toast thông báo"]
    UpdateUI & UpdateUI2 --> SyncStore["Đồng bộ mảng favorites vào localStorage / User Profile"]
```

---

## 5. WORKFLOW F04: ĐÁNH GIÁ & BÌNH LUẬN 5 SAO

```mermaid
flowchart TD
    A["Khách cuộn xuống mục Đánh giá tại detail.html"] --> B["Chọn số sao trải nghiệm (1 đến 5 sao ⭐)"]
    B --> C["Nhập tên người đánh giá & Nội dung nhận xét"]
    C --> D["Bấm 'Gửi đánh giá'"]
    D --> E{"Kiểm tra hợp lệ form"}
    E -->|"Hợp lệ"| F["Gửi POST /reviews (Lưu bình luận mới)"]
    E -->|"Chưa chọn sao"| G["Báo lỗi yêu cầu chấm sao"]
    F --> H["Tính lại điểm rating trung bình của món"]
    H --> I["Gửi PATCH /drinks/:id (Cập nhật rating mới)"]
    I --> J["Render lại danh sách bình luận ngay lập tức"]
```

---

## 6. WORKFLOW F05: TRỢ LÝ BARTENDER ẢO AI

```mermaid
flowchart TD
    UserMsg["Khách gửi tin nhắn vào widget Chat"] --> HeuristicEngine["Bộ phân tích ý định (Intent Engine)"]
    HeuristicEngine --> CheckScope{"Câu hỏi có thuộc phạm vi Quán Bar?"}
    
    CheckScope -->|"Trong phạm vi"| ParseTopic{"Phân loại chủ đề"}
    ParseTopic -->|"Hỏi vị cocktail"| SuggestDrink["Gợi ý ly cocktail phù hợp trong thực đơn kèm link"]
    ParseTopic -->|"Hỏi giờ / Địa chỉ"| AnswerVenue["Cung cấp giờ mở cửa 18:00-02:00, địa chỉ quán"]
    ParseTopic -->|"Hỏi đặt bàn / Voucher"| AnswerBooking["Hướng dẫn cách giữ bàn và áp dụng mã ưu đãi"]
    
    CheckScope -->|"Ngoài phạm vi (Toán, Code, Thời tiết, Chính trị...)"| BlockMsg["Từ chối lịch sự: 'Tôi chỉ là Bartender của Quán Bar Đêm, xin phép chỉ hỗ trợ đồ uống và dịch vụ của quán!'"]
```

---

## 7. WORKFLOW F06: ĐẶT BÀN & CHỌN KHUNG GIỜ ĐÓN KHÁCH

```mermaid
flowchart TD
    Start["Khách truy cập order.html"] --> ChooseType{"Chọn hình thức đặt"}
    ChooseType -->|"Đặt bàn trước (Booking)"| FormBooking["Hiển thị bộ chọn Ngày + Nút giờ nhanh"]
    ChooseType -->|"Tại quầy (Dine-in)"| FormDineIn["Nhập số bàn tại quán"]
    
    FormBooking --> SelectDate["Chọn ngày đến (Tối đa 30 ngày)"]
    SelectDate --> ClickTimeSlot["Bấm nút khung giờ nhanh (19:00, 20:00, 21:00, 22:00...)"]
    ClickTimeSlot --> ChooseArea["Chọn vị trí ngồi: Quầy Bar / Bàn Sofa / Góc riêng tư"]
    ChooseArea --> ReviewSlip["Cập nhật Phiếu Đặt Chỗ (Reservation Slip) ghim dính"]
```

---

## 8. WORKFLOW F07: THANH TOÁN CHUYỂN KHOẢN VIETQR MBBANK

```mermaid
sequenceDiagram
    autonumber
    actor Khach as Khách hàng
    participant OrderModule as Module Đặt Hàng (order.js)
    participant VietQR as Dịch vụ VietQR (vietqrService.js)
    participant API as json-server (db.json)

    Khach->>OrderModule: Chọn hình thức "Chuyển khoản VietQR" ➔ Bấm "Xác nhận đặt bàn"
    OrderModule->>API: Gửi POST /orders (Lưu đơn trạng thái: 'pending', paymentStatus: 'unpaid')
    API-->>OrderModule: Trả về mã đơn mới (VD: DH0010)
    OrderModule->>VietQR: Yêu cầu sinh mã QR động (Khớp STK MBBank, Số tiền, Mã đơn)
    VietQR-->>OrderModule: Trả về URL hình ảnh mã QR Napas247
    OrderModule-->>Khach: Mở Modal VietQR MBBank + Đồng hồ đếm ngược 10 phút
    Khach->>Khach: Mở App ngân hàng quét mã và xác nhận chuyển tiền
    Khach->>OrderModule: Bấm "Tôi đã chuyển khoản"
    OrderModule->>API: Gửi PATCH /orders/DH0010 (paymentStatus: 'paid')
    OrderModule-->>Khach: Đóng modal, phát âm thanh và chuyển hướng thành công
```

---

## 9. WORKFLOW F08: CẤP PHÁT VÉ ĐIỆN TỬ BAR CINEMA TICKET

```mermaid
flowchart TD
    OrderSuccess["Đơn hàng được xác nhận hoặc thanh toán thành công"] --> GenBarcode["emailService.generateBarcodeSvg(orderCode)"]
    GenBarcode --> BuildTicket["emailService.buildCinemaTicketHtml(order, barcodeSvg)"]
    BuildTicket --> TicketStructure["Tạo vé phong cách Cuống vé Cinema rách cổ điển:
    - Logo Quán Bar Đêm
    - Mã đơn & Tên khách hàng
    - Ngày đến & Khung giờ đón khách
    - Vị trí bàn & Danh sách ly phục vụ
    - Mã vạch Barcode SVG định danh để nhân viên quét cửa"]
    TicketStructure --> SaveEmail["Gửi POST /emails (Lưu vé vào hòm thư điện tử)"]
    SaveEmail --> CustomerView["Khách xem trực tiếp tại trang Xác nhận hoặc Hòm thư cá nhân"]
```

---

## 10. WORKFLOW F09: ĐĂNG NHẬP MỘT CỬA & TÍCH ĐIỂM THÀNH VIÊN

```mermaid
flowchart TD
    InputAuth["Nhập tài khoản & mật khẩu tại customer-auth.html"] --> MatchAuth{"Đối soát dữ liệu"}
    MatchAuth -->|"Khớp SĐT/Email Khách hàng"| LoginCust["Xác thực Khách hàng thành công"]
    LoginCust --> SaveCustLocal["Lưu phiên vào localStorage: 'current_customer'"]
    SaveCustLocal --> LoadLoyalty["Tải điểm tích luỹ & Hạng thẻ (Đồng, Bạc, Vàng, Bạch kim)"]
    LoadLoyalty --> AutoDiscount["Tự động áp dụng giảm giá theo hạng khi vào trang đặt bàn"]
    
    MatchAuth -->|"Khớp Tài khoản Nhân viên"| CheckStaffActive{"Kiểm tra trạng thái nhân viên"}
    CheckStaffActive -->|"Chờ duyệt (pending)"| BlockLogin["Báo lỗi: Đang chờ Quản lý duyệt"]
    CheckStaffActive -->|"Hoạt động (active)"| SaveStaffSession["Lưu phiên vào sessionStorage: 'current_admin'"]
    SaveStaffSession --> RedirectRole["Điều hướng thẳng vào trang quản trị tương ứng vai trò"]
```

---

## 11. WORKFLOW F10: PHÂN QUYỀN VAI TRÒ NHÂN SỰ (RBAC)

```mermaid
flowchart TD
    StaffSession["Nhân viên truy cập hệ thống"] --> GetRole["staffAuth.getStaffRole()"]
    GetRole --> RoleSwitch{"Vai trò nhân sự"}
    
    RoleSwitch -->|"Quản lý (Manager)"| PathManager["Toàn quyền: Dashboard, Thực đơn, Đơn hàng, Nhân viên, Vouchers, Hộp thư"]
    RoleSwitch -->|"Thu ngân (Cashier)"| PathCashier["Chỉ vào: Đơn hàng, Xác nhận VietQR, In hoá đơn PDF, Xem tin nhắn"]
    RoleSwitch -->|"Pha chế (Bartender)"| PathBartender["Chỉ vào: Màn hình đơn cần pha chế, Điều chỉnh tồn kho ly"]
    RoleSwitch -->|"Phục vụ (Waiter)"| PathWaiter["Chỉ vào: Theo dõi tình trạng bàn & Đơn đang phục vụ"]
    
    PathCashier & PathBartender & PathWaiter -.->|"Nếu cố tình truy cập trang trái phép (VD: admin-staff.html)"| AccessDenied["Chặn đứng & Báo lỗi không có quyền ➔ Đẩy về trang hợp lệ"]
```

---

## 12. WORKFLOW F11: QUẢN LÝ VÒNG ĐỜI ĐƠN HÀNG & HOÀN TRỪ KHO

```mermaid
stateDiagram-v2
    direction LR

    [*] --> Pending: Đặt đơn mới (Trừ tồn kho trong /drinks)
    
    Pending --> Preparing: Nhân viên xác nhận ➔ Quầy bar bắt đầu làm
    Preparing --> Serving: Bartender làm xong ➔ Mang ra phục vụ
    Serving --> Completed: Khách dùng xong & Thanh toán ➔ Đóng đơn
    Completed --> [*]

    Pending --> Cancelled: Khách hoặc Thu ngân huỷ đơn (Tự động hoàn kho)
    Preparing --> Cancelled: Khách đổi ý lúc đang làm (Tự động hoàn kho)
    Cancelled --> Pending: Bấm nhầm khôi phục lại (Tự động trừ kho lại)
    Cancelled --> [*]
```

---

## 13. WORKFLOW F12: CHUÔNG ÂM THANH WEB AUDIO API THỜI GIAN THỰC

```mermaid
flowchart TD
    InitWatcher["Trang quản trị chạy notificationService.startOrderNotificationWatcher()"] --> PollOrders["Quét danh sách đơn hàng mỗi 8 giây"]
    PollOrders --> DetectChange{"Phát hiện đơn mới hoặc đơn vừa đổi trạng thái?"}
    DetectChange -->|"Có"| TriggerAudio["notificationService.playNotificationSound()"]
    TriggerAudio --> AudioSynthesis["Web Audio API: Khởi tạo AudioContext
    - Tạo Oscillator tần số 880Hz (Nốt La cao)
    - Tạo Oscillator tần số 1320Hz (Nốt Mi cao)
    - Tạo hiệu ứng âm lượng vang ngân mượt mà (Gain Envelope)"]
    AudioSynthesis --> SoundPlay["Phát âm thanh chuông cửa sang trọng 'Ding-Dong'"]
    SoundPlay --> ToastNotif["Hiển thị Toast thông báo mã đơn hàng mới nổi bật trên màn hình"]
    DetectChange -->|"Không"| WaitLoop["Chờ chu kỳ quét tiếp theo"]
```

---

## 14. WORKFLOW F13: QUẢN TRỊ THỰC ĐƠN & ĐIỀU CHỈNH TỒN KHO

```mermaid
flowchart TD
    AdminMenu["Quản lý mở admin-menu.html"] --> LoadMenu["drinksService.getAllDrinks()"]
    LoadMenu --> ActionChoice{"Hành động quản trị"}
    
    ActionChoice -->|"Thêm món mới"| FormAdd["Nhập tên, danh mục, giá, ABV, ly, tồn kho ➔ POST /drinks"]
    ActionChoice -->|"Sửa thông tin"| FormEdit["Mở Modal chỉnh sửa ➔ PATCH /drinks/:id"]
    ActionChoice -->|"Chỉnh nhanh tồn kho"| QuickStock["Bấm tăng/giảm nút tồn kho ly ➔ PATCH /drinks/:id"]
    ActionChoice -->|"Xoá món"| ConfirmDel["Hộp thoại xác nhận ➔ DELETE /drinks/:id"]
    
    FormAdd & FormEdit & QuickStock & ConfirmDel --> UpdateTable["Cập nhật lại bảng dữ liệu & Thông báo thành công"]
```

---

## 15. WORKFLOW F14: QUẢN TRỊ NHÂN SỰ & DUYỆT NHÂN VIÊN MỚI

```mermaid
flowchart TD
    StaffRegister["Nhân viên tự đăng ký tại admin-register.html"] --> CreatePending["Tạo hồ sơ trạng thái: 'pending' (Chờ duyệt)"]
    CreatePending --> ManagerView["Quản lý đăng nhập vào admin-staff.html"]
    ManagerView --> SeeBadge["Thấy hàng nhân viên mới có huy hiệu 'Chờ duyệt'"]
    SeeBadge --> ManagerAction{"Quyết định của Quản lý"}
    
    ManagerAction -->|"Phê duyệt"| ApproveStaff["Chọn vai trò (Thu ngân/Pha chế/Phục vụ) ➔ Bấm 'Duyệt'"]
    ApproveStaff --> PatchActive["Gửi PATCH /staff/:id (status: 'active', role: '...')"]
    PatchActive --> StaffCanLogin["Nhân viên giờ đây đã có thể đăng nhập bình thường"]
    
    ManagerAction -->|"Từ chối / Xoá"| DeleteStaff["Gửi DELETE /staff/:id ➔ Huỷ bỏ hồ sơ"]
```

---

## 16. WORKFLOW F15: QUẢN TRỊ MÃ GIẢM GIÁ (VOUCHERS)

```mermaid
flowchart TD
    CreateVoucher["Quản lý vào admin-vouchers.html"] --> InputVoucher["Nhập: Mã code, % giảm, Giảm tối đa, Đơn tối thiểu, Hạn dùng"]
    InputVoucher --> SaveVoucher["Gửi POST /vouchers"]
    
    SaveVoucher -.-> CustomerUse["Khách hàng nhập mã tại order.html"]
    CustomerUse --> ValidateVoucher{"Kiểm tra tính hợp lệ"}
    ValidateVoucher -->|"Hết hạn / Không tồn tại"| RejectVoucher["Báo lỗi mã không hợp lệ"]
    ValidateVoucher -->|"Chưa đạt đơn tối thiểu"| RejectMin["Báo lỗi yêu cầu giá trị đơn hàng cao hơn"]
    ValidateVoucher -->|"Hợp lệ"| ApplyVoucher["Tính số tiền giảm ➔ Cập nhật trừ tiền trên Phiếu Đặt Chỗ"]
```

---

## 17. WORKFLOW F16: IN HÓA ĐƠN POS PDF & XUẤT BÁO CÁO EXCEL

```mermaid
flowchart TD
    AdminOrders["Thu ngân xem đơn tại admin-orders.html"] --> ChoiceDoc{"Lựa chọn thao tác"}
    
    ChoiceDoc -->|"Bấm 'In hoá đơn'"| PrintFlow["exportService.printOrderInvoice(order)"]
    PrintFlow --> FormatPOS["Định dạng phiếu in nhiệt POS 80mm:
    - Logo quán & Thông tin liên hệ
    - Mã đơn & Tên khách hàng
    - Bảng danh sách ly, đơn giá, số lượng
    - Tiền giảm voucher, thành tiền thanh toán
    - Mã QR tra cứu hoá đơn điện tử"]
    FormatPOS --> WindowPrint["Kích hoạt lệnh window.print() xuất PDF hoặc gửi máy in POS"]
    
    ChoiceDoc -->|"Bấm 'Xuất Excel'"| ExcelFlow["exportService.exportOrdersToExcel(orders)"]
    ExcelFlow --> GenerateCSV["Chuyển đổi mảng đơn hàng thành chuỗi CSV"]
    GenerateCSV --> PrependBOM["Chèn ký tự \uFEFF (UTF-8 with BOM) đầu file"]
    PrependBOM --> TriggerDownload["Tự động tải về file 'danh-sach-don-hang.csv' mở trên Excel chuẩn tiếng Việt"]
```

---

## 18. WORKFLOW F17: NHẬP THỰC ĐƠN HÀNG LOẠT TỪ FILE CSV

```mermaid
flowchart TD
    AdminMenu["Quản lý mở admin-menu.html"] --> ClickImport["Bấm nút 'Nhập CSV'"]
    ClickImport --> SelectFile["Chọn file .csv danh sách món từ máy tính"]
    SelectFile --> ParseCSV["exportService.parseCsv(fileContent)"]
    ParseCSV --> ValidateRows["Kiểm tra tính hợp lệ từng dòng: Tên món, Giá, ABV, Ly phục vụ"]
    ValidateRows --> BatchInsert["Gửi POST /drinks tuần tự thêm từng món lên máy chủ"]
    BatchInsert --> ToastResult["Hiển thị thông báo: 'Đã nhập thành công X món cocktail mới!'"]
    ToastResult --> ReloadGrid["Tự động làm mới bảng thực đơn"]
```

---

## 19. WORKFLOW F18: BẢNG ĐIỀU KHIỂN KINH DOANH THÔNG MINH (DASHBOARD)

```mermaid
flowchart TD
    OpenDash["Quản lý truy cập admin-dashboard.html"] --> FetchAll["Đồng thời tải /orders và /drinks"]
    FetchAll --> ComputeKPI["Tính toán số liệu kinh doanh:
    - Tổng doanh thu thực tế
    - Tổng số đơn đặt bàn
    - Tổng số ly cocktail đã phục vụ
    - Tỷ lệ hoàn thành đơn"]
    ComputeKPI --> RenderKPI["Hiển thị 4 thẻ KPI nổi bật trên đầu trang"]
    
    ComputeKPI --> RenderCharts["Vẽ các biểu đồ trực quan hóa:
    - Biểu đồ cột Doanh thu theo 7 ngày gần nhất
    - Biểu đồ phân bổ loại đơn (Tại quán / Đặt trước / Mang đi)
    - Danh sách Top 5 ly Cocktail bán chạy nhất (Best-Sellers)"]
```

---
*Tài liệu thuộc bộ hồ sơ kỹ thuật đồ án Quán Bar Đêm.*

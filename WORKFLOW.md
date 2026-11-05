# 🍸 SƠ ĐỒ QUY TRÌNH HOẠT ĐỘNG (SYSTEM WORKFLOW)
## HỆ THỐNG QUẢN LÝ & ĐẶT BÀN QUÁN BAR ĐÊM (ARTISAN SPEAKEASY LOUNGE)

---

## 1. SƠ ĐỒ TỔNG THỂ TOÀN BỘ QUY TRÌNH (END-TO-END MASTER FLOW)

```mermaid
flowchart TD
    %% Khởi đầu
    Start(["Khách hàng truy cập Website"]) --> Home["Trang chủ (index.html)"]

    %% Khám phá & Chọn món
    Home --> Explore{"Khách muốn làm gì?"}
    Explore -->|"Khám phá đồ uống"| Menu["Xem Thực Đơn (menu.html)"]
    Explore -->|"Cần tư vấn vị"| Bot["Chat với Bartender AI"]
    Explore -->|"Đặt bàn trực tiếp"| OrderPage["Trang Đặt Bàn (order.html)"]

    Bot -->|"Gợi ý món phù hợp"| Detail["Chi tiết món (detail.html)"]
    Menu --> Detail
    Detail --> Fav["Thả tim 'Yêu thích' / Xem đánh giá 5⭐"]
    Detail --> AddCart["Thêm đồ uống vào Giỏ hàng"]
    AddCart --> OrderPage

    %% Điền thông tin đặt bàn
    OrderPage --> SelectTime["Chọn Ngày đến & Khung giờ đón khách"]
    SelectTime --> ApplyPromo{"Có mã giảm giá hoặc Điểm?"}
    ApplyPromo -->|"Có"| CalcDiscount["Hệ thống trừ tiền khuyến mại"]
    ApplyPromo -->|"Không"| CalcBill["Tính tổng tiền theo giá niêm yết"]
    CalcDiscount --> BillReview["Xem trước Phiếu Đặt Chỗ (Reservation Slip)"]
    CalcBill --> BillReview

    %% Thanh toán
    BillReview --> PaymentSelect{"Chọn hình thức thanh toán"}
    PaymentSelect -->|"Tiền mặt tại quầy"| SubmitOrder["Tạo đơn trạng thái: Chờ thanh toán"]
    PaymentSelect -->|"Chuyển khoản VietQR"| VietQRModal["Mở Modal VietQR MBBank tự động"]
    VietQRModal --> ScanQR["Khách quét mã chuyển khoản trên App ngân hàng"]
    ScanQR --> SubmitOrderPaid["Cập nhật trạng thái: Đã thanh toán (Paid)"]

    %% Xử lý đơn & Email
    SubmitOrder --> ServerProcess["Máy chủ REST API (db.json)"]
    SubmitOrderPaid --> ServerProcess
    ServerProcess --> StockDeduct["Tự động trừ tồn kho các ly đã đặt"]
    ServerProcess --> GenTicket["Sinh Vé Điện Tử Cinema Bar Ticket kèm Barcode"]
    GenTicket --> EmailBox["Lưu vào Hòm thư vé (/emails) & Gửi thông báo"]

    %% Phía Quản trị viên
    ServerProcess --> SoundAlert["Web Audio API: Chuông báo đơn mới reo lên"]
    SoundAlert --> AdminDashboard["Admin POS tiếp nhận đơn hàng"]
    AdminDashboard --> StatusShift["Chuyển trạng thái: Chờ xử lý ➔ Đang pha chế ➔ Hoàn tất"]
    StatusShift --> Actions["In hóa đơn nhiệt POS (PDF) / Xuất báo cáo (Excel)"]
    Actions --> Finish(["Kết thúc chu trình phục vụ"])
```

---

## 2. QUY TRÌNH CHI TIẾT TƯƠNG TÁC HỆ THỐNG (SEQUENCE WORKFLOW)

Sơ đồ tuần tự thể hiện dòng chảy dữ liệu giữa **Khách hàng ➔ Giao diện Trình duyệt ➔ Máy chủ API ➔ Cổng VietQR ➔ Quản trị viên**:

```mermaid
sequenceDiagram
    autonumber
    actor Khach as Khách hàng
    participant Browser as Trình duyệt (Frontend)
    participant API as Máy chủ API (json-server)
    participant VietQR as Cổng VietQR (MBBank)
    actor Admin as Quản lý / Thu ngân (POS)

    Khach->>Browser: Chọn món Cocktail & bấm "Đặt bàn giữ chỗ"
    Browser->>Browser: Kiểm tra tồn kho & tính toán tiền sau Voucher
    Khach->>Browser: Chọn thanh toán "Chuyển khoản VietQR"
    Browser->>API: Gửi POST /orders (Lưu thông tin đơn hàng)
    API->>API: Cập nhật giảm trừ tồn kho trong bảng /drinks
    API-->>Browser: Trả về mã đơn hàng (VD: DH0009)

    Browser->>VietQR: Yêu cầu sinh mã QR động (Số TK MBBank, Số tiền, Mã đơn)
    VietQR-->>Browser: Trả về hình ảnh mã QR Napas247
    Browser-->>Khach: Hiển thị Modal Quét mã thanh toán & Đếm ngược 10 phút

    Khach->>Browser: Quét mã chuyển khoản thành công & bấm "Tôi đã chuyển khoản"
    Browser->>API: Gửi PATCH /orders (Cập nhật paymentStatus: 'paid')
    Browser->>API: Gửi POST /emails (Tạo vé Bar Cinema Ticket có mã vạch)
    
    API--)Admin: Bắn tín hiệu đơn mới (Chuông âm thanh Web Audio reo)
    Admin->>Browser: Mở admin-orders.html tiếp nhận đơn
    Admin->>Browser: Bấm "Chuyển pha chế" ➔ Bấm "Hoàn tất đơn"
    Browser->>API: Gửi PATCH /orders (Cập nhật status: 'completed')
    Admin->>Browser: Bấm "In hoá đơn PDF" giao cho khách
```

---

## 3. QUY TRÌNH VÒNG ĐỜI ĐƠN HÀNG & BẢO VỆ TỒN KHO (ORDER STATE MACHINE)

Đảm bảo số lượng ly tồn kho luôn chính xác 100%, không xảy ra tình trạng "bán khống" hoặc mất dữ liệu khi huỷ đơn:

```mermaid
stateDiagram-v2
    direction LR

    [*] --> ChoXuLy: Khách đặt đơn mới (Trừ tồn kho)
    
    ChoXuLy --> DangPhaChe: Nhân viên xác nhận đơn
    DangPhaChe --> DangPhucVu: Bartender pha chế xong mang ra bàn
    DangPhucVu --> HoanTat: Khách thanh toán & rời quán
    HoanTat --> [*]

    ChoXuLy --> DaHuy: Huỷ đơn (Tự động hoàn trả kho)
    DangPhaChe --> DaHuy: Khách đổi ý (Tự động hoàn trả kho)
    DaHuy --> ChoXuLy: Khôi phục đơn bị bấm nhầm (Trừ kho lại)
    DaHuy --> [*]
```

### Các nguyên tắc xử lý tồn kho:
1. **Khi đặt đơn:** Tồn kho ly `stock` giảm ngay lập tức. Nếu `stock = 0`, trạng thái món tự động chuyển sang `soldout`.
2. **Khi huỷ đơn (Cancelled):** Tồn kho tự động được hoàn trả đúng số ly. Món hết hàng sẽ tự động mở bán lại thành `available`.
3. **Khi xoá đơn:**
   - Đơn đang chờ / chưa phục vụ: Tự động hoàn kho trước khi xoá.
   - Đơn đã **Hoàn tất (Completed)**: Không hoàn kho để đảm bảo tính toàn vẹn doanh thu lịch sử.

---

## 4. QUY TRÌNH PHÂN QUYỀN MỘT CỬA (UNIFIED AUTH & RBAC WORKFLOW)

```mermaid
flowchart TD
    StartAuth["Khách hoặc Nhân viên nhập thông tin tại customer-auth.html"] --> CheckIdentity{"Hệ thống nhận diện danh tính"}

    %% Khách hàng
    CheckIdentity -->|"Khớp số điện thoại / email Khách hàng"| CustomerBranch["Đăng nhập Khách hàng"]
    CustomerBranch --> SaveLocal["Lưu phiên vào localStorage"]
    SaveLocal --> ApplyTier["Nhận diện Hạng thành viên (Bronze/Silver/Gold/Platinum)"]
    ApplyTier --> CustPortal["Trang cá nhân: Xem lịch sử đơn, Ví điểm thưởng, Hòm vé"]

    %% Ban quản trị & Nhân viên
    CheckIdentity -->|"Khớp tài khoản Nhân sự"| StaffBranch["Đăng nhập Nhân viên"]
    StaffBranch --> CheckActive{"Trạng thái tài khoản?"}
    CheckActive -->|"Chờ duyệt (Pending)"| RejectWait["Báo lỗi: Đang chờ Quản lý duyệt"]
    CheckActive -->|"Đang làm (Active)"| SaveSession["Lưu phiên vào sessionStorage"]

    SaveSession --> CheckRole{"Phân quyền theo Vai trò (RBAC)"}
    CheckRole -->|"Quản lý (Manager)"| ManagerPerm["Truy cập: Dashboard, Thực đơn, Đơn hàng, Nhân sự, Mã giảm giá"]
    CheckRole -->|"Thu ngân (Cashier)"| CashierPerm["Truy cập: Đơn hàng, Xác nhận VietQR, In hoá đơn PDF, Xem tin nhắn"]
    CheckRole -->|"Pha chế (Bartender)"| BartenderPerm["Truy cập: Danh sách đơn pha chế, Cập nhật tồn kho ly"]
    CheckRole -->|"Phục vụ (Waiter)"| WaiterPerm["Truy cập: Theo dõi bàn & Trạng thái phục vụ"]
```

---

## 5. BẢNG TỔNG HỢP CÁC BƯỚC THAO TÁC CỦA MỘT SAMPLE MẪU (STEP-BY-STEP SAMPLE)

| Giai đoạn | Đối tượng | Hành động | Trang / Module liên quan | Dữ liệu đầu ra |
|---|---|---|---|---|
| **1. Khám phá** | Khách hàng | Tìm kiếm cocktail vị khói, xem nồng độ ABV, thả tim món | `menu.html`, `detail.html`, `drinkCard.js` | Thêm vào mảng `favorites` |
| **2. Tư vấn** | Khách hàng | Hỏi trợ lý ảo: *"Gợi ý cho tôi món thanh mát nhẹ độ"* | `chatbot.js`, `chatbotService.js` | Chatbot tư vấn đúng món trong thực đơn |
| **3. Chọn chỗ** | Khách hàng | Chọn ngày đến, chọn nút khung giờ `20:00`, chọn bàn Bar | `order.html`, `order.js` | Tạo đối tượng `Order` (kế thừa `BookingOrder`) |
| **4. Ưu đãi** | Khách hàng | Nhập mã giảm giá hoặc dùng điểm tích lũy thành viên | `voucherService.js`, `customerAuth.js` | Tính giảm trừ hiển thị trên Phiếu Đặt Chỗ |
| **5. Trả tiền** | Khách hàng | Quét mã MBBank và bấm "Tôi đã chuyển khoản" | `vietqrService.js`, Cổng VietQR MBBank | `paymentStatus = 'paid'` |
| **6. Nhận vé** | Khách hàng | Xem vé điện tử Bar Cinema Ticket có mã vạch | `emailService.js`, bảng `/emails` | Vé điện tử lưu trong hòm thư |
| **7. Báo đơn** | Hệ thống | Phát chuông âm thanh cảnh báo đơn mới | `notificationService.js` (Web Audio API) | Âm thanh `ding-dong` sang trọng phát ra |
| **8. Quản trị** | Nhân viên | Tiếp nhận đơn, xác nhận, chuyển trạng thái pha chế | `admin-orders.html`, `ordersService.js` | `status = 'preparing' ➔ 'completed'` |
| **9. In & Xuất** | Thu ngân | In hóa đơn thanh toán PDF & Xuất báo cáo Excel | `exportService.js` | File `.csv` UTF-8 BOM và cửa sổ in POS |

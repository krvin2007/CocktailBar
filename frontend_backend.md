# 💻 GIAI ĐOẠN 7: LẬP TRÌNH FRONTEND & BACKEND (IMPLEMENTATION SPECIFICATION)
## HỆ THỐNG QUẢN LÝ & ĐẶT BÀN QUÁN BAR ĐÊM (ARTISAN SPEAKEASY LOUNGE)

> **Môn học:** Lập trình Web / JavaScript Nâng Cao  
> **Tài liệu:** Báo cáo Giai đoạn 7 — Đặc tả triển khai mã nguồn Frontend & Backend  
> **Phiên bản:** 2.0.0

---

## 1. TỔNG QUAN TRIỂN KHAI MÃ NGUỒN

Dự án được xây dựng dựa trên nguyên tắc **Zero-Framework Architecture (100% Vanilla JavaScript ES6+)**, phân tách mô-đun độc lập, không phụ thuộc vào bất kỳ framework giao diện nào (React/Vue/Angular), đảm bảo tính làm chủ mã nguồn và hiệu năng vận hành tối đa.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TẦNG GIAO DIỆN FRONTEND                         │
│  • 18 File HTML Ngữ Nghĩa (Semantic HTML5)                             │
│  • CSS3 Kiến trúc Design Tokens (Noir & Gold, 3D Tilt, Luxury Scroll)  │
│  • Vanilla JS ES6+: OOP Class (Kế thừa, Đa hình, Getter/Setter)        │
│  • Native ES6 Modules (import/export), Async/Await, Web Audio API      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         Giao thức HTTP / RESTful API
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                        TẦNG MÁY CHỦ BACKEND                            │
│  • json-server (v0.17.4) chạy trên Node.js Runtime (Port 3000)         │
│  • Phục vụ kép: Cung cấp REST API (/drinks, /orders) & Static Files    │
│  • Cơ sở dữ liệu tài liệu JSON: db.json                                │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. TRIỂN KHAI FRONTEND (GIAO DIỆN & TƯƠNG TÁC)

### 2.1. Cấu trúc 18 tệp HTML ngữ nghĩa (Semantic HTML5)
Hệ thống phân định rành mạch giữa khu vực khách hàng và khu vực quản trị:

| Nhóm trang | Tên tệp HTML | Vai trò & Trách nhiệm giao diện |
|---|---|---|
| **Khách hàng** | `index.html` | Trang chủ Speakeasy Lounge, Hero 3D Parallax, danh mục nổi bật |
| | `menu.html` | Thực đơn đầy đủ, thanh tìm kiếm và bộ lọc đa tiêu chí |
| | `detail.html` | Chi tiết ly cocktail, tỷ lệ công thức pha chế, đánh giá 5 sao |
| | `order.html` | Đặt bàn & Gọi món, bộ chọn ngày/giờ, phiếu đặt chỗ, VietQR |
| | `customer-auth.html` | Đăng nhập một cửa thông minh (Tự nhận diện Khách vs Nhân viên) |
| | `customer-account.html` | Trang cá nhân khách: hạng thẻ, ví điểm thưởng, hòm vé điện tử |
| | `contact.html` | Biểu mẫu liên hệ & Đặt tiệc riêng tư |
| | `spirits.html` | Hầm rượu di sản Speakeasy |
| | `bartenders.html` | Danh nhân Master Bartenders huyền thoại |
| | `collectors.html` | Nhà sưu tầm rượu lừng danh |
| **Quản trị POS** | `admin-dashboard.html` | Bảng điều hành kinh doanh, biểu đồ doanh thu 7 ngày |
| | `admin-orders.html` | Quản lý đơn hàng, đổi trạng thái pha chế, in hóa đơn nhiệt POS PDF |
| | `admin-menu.html` | Quản lý danh mục món, thêm/sửa/xoá và điều chỉnh tồn kho ly |
| | `admin-staff.html` | Quản trị nhân sự, duyệt tài khoản nhân viên mới đăng ký |
| | `admin-customers.html` | Quản lý danh sách khách hàng, đổi mật khẩu và hạng thẻ |
| | `admin-vouchers.html` | Quản lý mã giảm giá khuyến mãi (tỷ lệ %, mức giảm tối đa) |
| | `admin-messages.html` | Hộp thư liên hệ & đặt tiệc của khách hàng |
| | `admin-register.html` | Màn hình dành cho nhân viên mới tự đăng ký tài khoản |

---

### 2.2. Hệ thống CSS3 & Design Tokens cao cấp
Quản lý tập trung các biến giao diện trong `css/variables.css` theo phong cách **Speakeasy Lounge Noir & Champagne Gold**:
- **Bảng màu kim loại quý:** `--amber: #c59843` (Vàng đồng cổ điển), `--amber-soft: #e8c682` (Champagne sáng).
- **Chiều sâu bóng tối:** `--bg-page: #0b0907` (Đen mun obsidian), `--bg-card: #1a1410` (Gỗ sồi sẫm).
- **Thanh cuộn sang trọng (Dark Luxury Scrollbar):** Tông tối kết hợp dải gradient vàng hổ phách, hiệu ứng cuộn mượt mà `scroll-behavior: smooth`.
- **Huy hiệu thẻ đồ uống rực rỡ:**
  - `✦ SIGNATURE`: Phủ dải gradient vàng ánh kim metallic.
  - `🔥 BEST-SELLER`: Phủ dải gradient cam lửa nổi bật cho các món điểm rating $\ge 4.9$ sao.
- **Tương thích Responsive Mobile-first:** Tối ưu hóa 100% trên `css/responsive.css` với thanh điều hướng Drawer cảm ứng và bảng dữ liệu cuộn ngang `-webkit-overflow-scrolling: touch`.

---

### 2.3. Lập trình Hướng đối tượng (OOP) trong JavaScript ES6

Hệ thống áp dụng triệt để 4 tính chất OOP (Đóng gói, Kế thừa, Đa hình, Trừu tượng) thông qua các lớp thực thể:

#### Mô hình kế thừa Đơn hàng (`Order` Class Hierarchy):
```javascript
// Lớp cơ sở (Base Class)
export class Order {
  #status; // Thuộc tính Private đóng gói chặt chẽ

  constructor({ id, orderCode, customerName, customerPhone, items, total, status = "pending" }) {
    this.id = id;
    this.orderCode = orderCode;
    this.customerName = customerName;
    this.customerPhone = customerPhone;
    this.items = items || [];
    this.total = total || 0;
    this.#status = status;
  }

  // Getter & Setter đóng gói dữ liệu
  get status() { return this.#status; }
  set status(newStatus) {
    const valid = ["pending", "preparing", "serving", "completed", "cancelled"];
    if (!valid.includes(newStatus)) throw new Error(`Trạng thái không hợp lệ: ${newStatus}`);
    this.#status = newStatus;
  }

  get itemCount() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  // Phương thức đa hình (Polymorphism)
  getOrderDetails() {
    return `Đơn hàng ${this.orderCode} - Khách: ${this.customerName}`;
  }
}

// Lớp con: Đặt bàn trước (BookingOrder) kế thừa từ Order
export class BookingOrder extends Order {
  constructor(data) {
    super(data);
    this.bookingDate = data.bookingDate;
    this.bookingTimeSlot = data.bookingTimeSlot;
    this.tableType = data.tableType;
    this.guests = data.guests;
  }

  // Đa hình: Ghi đè phương thức hiển thị chi tiết của lớp cha
  getOrderDetails() {
    return `${super.getOrderDetails()} [Hẹn: ${this.bookingTimeSlot} ngày ${this.bookingDate} - Vị trí: ${this.tableType}]`;
  }
}

// Lớp con: Dùng tại quán (DineInOrder) kế thừa từ Order
export class DineInOrder extends Order {
  constructor(data) {
    super(data);
    this.tableNumber = data.tableNumber;
  }

  getOrderDetails() {
    return `${super.getOrderDetails()} [Phục vụ tại Bàn số: ${this.tableNumber}]`;
  }
}
```

---

## 3. TRIỂN KHAI BACKEND & DỊCH VỤ TÍCH HỢP

### 3.1. Máy chủ REST API (`json-server`)
Chạy bằng lệnh `npm start` tương ứng với:
```bash
json-server db.json --static . --port 3000
```
- Phục vụ toàn bộ dữ liệu máy chủ từ tệp `db.json`.
- Tự động hỗ trợ các phương thức RESTful: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`.
- Tích hợp sẵn cơ chế mở CORS (`Access-Control-Allow-Origin: *`) cho phép mọi trang HTML gọi API thông suốt.

---

### 3.2. Bộ điều hợp máy trạm thích ứng (`js/modules/api.js`)
Triển khai mẫu thiết kế **Adapter Pattern**:
```javascript
export async function request(endpoint, options = {}) {
  const url = endpoint.startsWith("http") ? endpoint : `http://localhost:3000${endpoint}`;
  
  try {
    // 1. Thử gọi qua thư viện Axios nếu có sẵn
    if (typeof axios !== "undefined") {
      const res = await axios({ url, method: options.method || "GET", data: options.body });
      localStorage.setItem(`quanbar_cache_${endpoint}`, JSON.stringify(res.data));
      return res.data;
    }
    // 2. Tự động rơi về Native Fetch nếu không có Axios
    const res = await fetch(url, options);
    const data = await res.json();
    localStorage.setItem(`quanbar_cache_${endpoint}`, JSON.stringify(data));
    return data;
  } catch (err) {
    // 3. Fallback ngoại tuyến: Đọc từ bộ nhớ đệm localStorage nếu mất mạng
    const cached = localStorage.getItem(`quanbar_cache_${endpoint}`);
    if (cached) return JSON.parse(cached);
    throw err;
  }
}
```

---

### 3.3. Dịch vụ Thanh toán VietQR MBBank (`vietqrService.js`)
Tự động sinh URL mã QR chuyển khoản Napas247 QuickLink:
```javascript
export function generateVietQRUrl({ accountNo, bankId = "MBBANK", amount, orderCode, accountName }) {
  const cleanAmount = Math.max(0, Math.floor(amount));
  const desc = encodeURIComponent(`Thanh toan don hang ${orderCode}`);
  const accName = encodeURIComponent(accountName || "QUAN BAR DEM");
  return `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${cleanAmount}&addInfo=${desc}&accountName=${accName}`;
}
```

---

### 3.4. Dịch vụ Chuông âm thanh Web Audio API (`notificationService.js`)
Tổng hợp âm thanh chuông cửa sang trọng tần số kép trực tiếp trên trình duyệt:
```javascript
export function playNotificationSound() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();

  // Nốt 1: La cao (880Hz)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.frequency.setValueAtTime(880, ctx.currentTime);
  gain1.gain.setValueAtTime(0.3, ctx.currentTime);
  gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start();
  osc1.stop(ctx.currentTime + 0.6);

  // Nốt 2: Mi cao (1320Hz) vang ngân sau 0.12s
  setTimeout(() => {
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.frequency.setValueAtTime(1320, ctx.currentTime);
    gain2.gain.setValueAtTime(0.25, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start();
    osc2.stop(ctx.currentTime + 0.8);
  }, 120);
}
```

---

### 3.5. Dịch vụ Xuất báo cáo Excel & In hoá đơn POS (`exportService.js`)
- **Xuất Excel UTF-8 BOM:** Sử dụng tiền tố `\uFEFF` để Microsoft Excel trên Windows tự nhận diện bảng mã Unicode tiếng Việt có dấu.
- **In hoá đơn nhiệt POS 80mm PDF:** Kích hoạt `window.print()` với định dạng cuống hoá đơn khổ hẹp 80mm có mã QR tra cứu.

---
*Tài liệu thuộc bộ hồ sơ kỹ thuật đồ án Quán Bar Đêm.*

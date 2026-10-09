# 🍸 Quán Bar Đêm — Website quản lý & đặt bàn quán bar

Đồ án cuối khoá môn JavaScript. Đề tài thuộc **Nhóm 3 — Website quản lý**: quản lý
thực đơn đồ uống, đơn hàng/đặt bàn, nhân viên và hộp thư liên hệ của một quán bar
cocktail phong cách Speakeasy.

**Công nghệ:** HTML5 + CSS3 + JavaScript thuần ES6+ (module `import/export`,
`class`, `async/await`…). Không dùng framework/thư viện giao diện nào.
Theo đúng hướng dẫn bài giảng (Slide 4 + tài liệu *"hướng dẫn tạo photo API json"*),
dữ liệu được lưu trong **`db.json`**, **json-server** biến nó thành REST API, và
trang web gọi API bằng **axios + async/await**.

> json-server và ESLint chỉ là công cụ phát triển chạy bằng Node (không nạp vào
> trình duyệt). axios nạp qua CDN như trong bài giảng; nếu máy không có mạng để
> tải CDN, website tự chuyển sang `fetch()` thuần — chức năng giữ nguyên.

---

## 1. Chạy dự án

### Cách 1 — khuyến nghị (1 lệnh)

```bash
npm install     # chỉ cần chạy 1 lần: cài json-server 0.17.4 + ESLint
npm start       # json-server phục vụ CẢ trang web lẫn API ở cổng 3000
```

Mở trình duyệt: **http://localhost:3000**

### Cách 2 — đúng y các bước trong tài liệu hướng dẫn bài giảng

```bash
npm i -g json-server          # B1
json-server --watch db.json   # B3 - chạy trong thư mục dự án (db.json đã có sẵn - B2)
```

Sau đó mở `index.html` bằng **Live Server** (VS Code). Trang web tự gọi API sang
`http://localhost:3000` (json-server đã bật sẵn CORS).

### Lưu ý về phiên bản json-server (đã kiểm chứng)

| Cách chạy | Kết quả kiểm thử với server thật |
|---|---|
| `npm start` (json-server **0.17.4**, không `--watch`) | ✅ đạt 15/15 thao tác, server không tự khởi động lại |
| `npm i -g json-server` (hiện cài bản **1.0**) + `json-server --watch db.json` | ✅ đạt 15/15 |
| json-server **0.17** **kèm** `--watch` | ⚠️ **không dùng** — khi có 2 lệnh ghi liên tiếp (VD đặt hàng: trừ tồn kho rồi lưu đơn), bản 0.17 tưởng `db.json` bị sửa tay và tự khởi động lại server giữa chừng, làm thao tác kế tiếp thất bại ngẫu nhiên |

Vì vậy `npm start` cố ý **không** dùng `--watch`. Dữ liệu thêm/sửa/xoá vẫn được
json-server ghi xuống `db.json` bình thường; `--watch` chỉ cần khi sửa tay file.

### Khôi phục dữ liệu mẫu (trước buổi demo)

```bash
npm run seed    # tắt server trước (Ctrl+C), chạy lệnh này, rồi npm start lại
```

Lệnh tạo lại `db.json` từ dữ liệu mẫu trong code, đồng thời làm mới ngày giờ các
đơn mẫu về "7 ngày gần nhất" để biểu đồ doanh thu trên Dashboard có số liệu.

### Tài khoản quản trị (demo cho giảng viên)

| Tài khoản | Mật khẩu |
|---|---|
| `admin` | `admin123` |

Đăng nhập tại `admin-login.html` (nút **Quản trị** trên thanh điều hướng). Phiên
đăng nhập lưu ở `sessionStorage`, tự mất khi đóng tab.

---

## 2. Kiến trúc dữ liệu

```
 Trang HTML ──► js/pages/*.js ──► js/modules/*Service.js ──► js/modules/api.js ──► json-server ──► db.json
 (giao diện)    (sự kiện, vẽ DOM)   (nghiệp vụ CRUD, lọc)      (axios / fetch)        (REST API)     (dữ liệu)
                                                                    │
                                                                    └──► localStorage (bản sao đệm)
```

**json-server (`db.json`)** — dữ liệu chung của quán:

| Bảng | Đọc | Thêm | Sửa | Xoá | Dùng ở |
|---|---|---|---|---|---|
| `/drinks` | GET | POST | PATCH | DELETE | Thực đơn, chi tiết, quản lý thực đơn, tồn kho |
| `/orders` | GET | POST | PATCH | DELETE | Đặt bàn, tra cứu đơn, quản lý đơn, Dashboard |
| `/staff` | GET | POST | PATCH | DELETE | Quản lý nhân viên |
| `/messages` | GET | POST | PATCH | DELETE | Form liên hệ, hộp thư quản trị |
| `/spirits`, `/bartenders`, `/collectors` | GET | | | | Trang Hầm rượu, Master Bartenders, Nhà sưu tầm |

**localStorage** — những gì thuộc về riêng trình duyệt của khách:

- **Giỏ hàng** (`quanbar_cart`): thêm / đọc / sửa số lượng / xoá món, còn nguyên sau khi tải lại trang hay đóng mở trình duyệt.
- **Bản sao đệm** (`quanbar_cache_*`): mỗi lần đọc API thành công đều lưu lại; nếu
  máy chủ chưa chạy, trang vẫn hiển thị dữ liệu từ bản sao này (chỉ đọc) kèm banner
  cảnh báo. Chưa từng có bản sao thì dùng dữ liệu mẫu đóng gói sẵn trong code.

**sessionStorage** — phiên đăng nhập quản trị.

---

## 3. Cấu trúc thư mục

```
CocktailBar/
├── index.html               Trang chủ - danh mục, món nổi bật
├── menu.html                Thực đơn - tìm kiếm + lọc danh mục/giá/còn hàng + sắp xếp
├── detail.html              Chi tiết 1 món - ABV, tasting notes, thêm vào giỏ
├── order.html               Giỏ hàng + đặt bàn/gọi món (form + validate) + tra cứu đơn
├── contact.html             Liên hệ & đặt tiệc riêng (form + validate)
├── spirits.html             Hầm rượu di sản (dữ liệu từ API)
├── bartenders.html          Master Bartenders huyền thoại (dữ liệu từ API)
├── collectors.html          Nhà sưu tầm rượu lừng danh (dữ liệu từ API)
├── admin-login.html         Đăng nhập quản trị
├── admin-dashboard.html     Thống kê: KPI, biểu đồ doanh thu 7 ngày, top món bán chạy
├── admin-menu.html          CRUD thực đơn + tồn kho
├── admin-orders.html        Quản lý đơn: chi tiết, đổi trạng thái, huỷ, xoá
├── admin-staff.html         CRUD nhân viên
├── admin-messages.html      Hộp thư liên hệ: đọc, đánh dấu đã xử lý, xoá
│
├── db.json                  Cơ sở dữ liệu của json-server
├── package.json             Lệnh npm: start, seed, test, check, lint
├── eslint.config.js         Cấu hình ESLint (Slide 7)
│
├── css/        reset, variables, style, admin, responsive, spirits, legends
├── js/
│   ├── modules/
│   │   ├── api.js               Gọi REST API bằng axios (dự phòng fetch), bộ nhớ đệm
│   │   ├── storage.js           Bọc localStorage / sessionStorage
│   │   ├── drinksService.js     class Drink, CRUD, lọc/sắp xếp, tồn kho
│   │   ├── ordersService.js     Giỏ hàng + CRUD đơn hàng + hoàn/trừ tồn kho
│   │   ├── staffService.js      CRUD nhân viên
│   │   ├── messagesService.js   Tin nhắn liên hệ
│   │   ├── validation.js        Engine kiểm tra form dùng chung (data-rule)
│   │   ├── ui.js                toast, hộp xác nhận, modal, trạng thái đang tải
│   │   ├── auth.js              Đăng nhập quản trị (mô phỏng)
│   │   ├── navbar.js            Header/Footer khu khách hàng
│   │   ├── adminLayout.js       Sidebar/topbar khu quản trị
│   │   ├── portrait.js          Ảnh nhân vật: ảnh tư liệu / minh hoạ / khung chữ cái đầu tên
│   │   ├── drinkCard.js, icons.js, utils.js
│   │   └── spiritsData.js, bartendersData.js, collectorsData.js   (dữ liệu mẫu)
│   └── pages/                   1 file logic cho mỗi trang HTML
│
├── img/                         Ảnh đồ uống, chai rượu, minh hoạ (xem mục 6 - nguồn ảnh)
└── tools/
    ├── tao-db.js                Sinh db.json từ dữ liệu mẫu (npm run seed)
    ├── kiem-tra-ton-kho.js      Kiểm thử nghiệp vụ trên API giả lập (npm test)
    ├── kiem-tra-module.js       Kiểm tra import/export giữa các module (npm run check)
    └── server.js                Máy chủ tĩnh thay thế (npm run web)
```

---

## 4. Nghiệp vụ

**Khách hàng**
- Xem thực đơn: tìm kiếm theo tên/rượu nền/nguyên liệu, lọc theo danh mục, khoảng giá, chỉ món còn hàng; 6 kiểu sắp xếp.
- Thêm vào giỏ: kiểm tra tồn kho mới nhất trên máy chủ, tính cả số ly đã có sẵn trong giỏ.
- Đặt chỗ & gọi món 2 hình thức: Thưởng thức tại quầy/bàn (Dine-in) hoặc Đặt bàn trước (Booking - giờ đến phải cách hiện tại ≥ 1 tiếng và trong khung giờ mở cửa 18:00–02:00).
- Trước khi đặt, giỏ hàng tự đối chiếu với thực đơn mới nhất: bỏ món đã hết/đã xoá, hạ số lượng theo tồn kho, cập nhật giá mới — và báo rõ cho khách.
- Tra cứu đơn: bắt buộc nhập **cả mã đơn lẫn số điện thoại** (không để người lạ xem đơn của khách khác).
- Gửi liên hệ / đặt tiệc riêng.

**Quản trị**
- Dashboard: tổng số món, số đơn, doanh thu đơn hoàn tất, đơn chờ xử lý, biểu đồ doanh thu 7 ngày, top 5 món bán chạy.
- Thực đơn: thêm/sửa/xoá món, quản lý tồn kho; tồn kho = 0 thì tự chuyển "Hết hàng"; không cho trùng tên món.
- Đơn hàng: xem chi tiết, đổi trạng thái; **huỷ đơn hoặc xoá đơn chưa phục vụ thì tự hoàn tồn kho**, phục hồi đơn đã huỷ thì trừ lại; mã đơn không bao giờ trùng.
- Nhân viên: thêm/sửa/xoá, lọc theo vị trí & trạng thái; không cho 2 nhân viên trùng số điện thoại.
- Hộp thư liên hệ: đọc tin nhắn khách gửi, đánh dấu đã xử lý, xoá; số tin chưa đọc hiện trên menu.

---

## 5. Đối chiếu yêu cầu đề bài & bài giảng

| Yêu cầu | Đáp ứng |
|---|---|
| HTML5/CSS3/JS thuần, không framework | Toàn bộ dự án |
| ≥ 7 trang (chủ, danh sách, chi tiết, thêm, sửa, liên hệ, quản lý) | 14 trang; thêm/sửa bằng form trong modal ở các trang quản trị |
| DOM: render động, không hardcode dữ liệu trong HTML | Mọi danh sách vẽ bằng JS từ dữ liệu API |
| Event: click, submit, input, change, keyboard | Lọc khi gõ (input), chọn bộ lọc (change), submit form, phím Esc đóng modal |
| Array/Object, map/filter/find/findIndex/some/reduce/sort/forEach | Các service và Dashboard |
| CRUD hoàn chỉnh | Thực đơn, nhân viên (đủ C-R-U-D); đơn hàng, tin nhắn (C-R-U-D) |
| Tìm kiếm – Lọc – Sắp xếp – Thống kê | Thực đơn + 4 bảng quản trị + Dashboard |
| Form & Validation | `validation.js`: required, email, phone, min/max độ dài, minval/maxval, integer, date + luật riêng (giờ đặt bàn, trùng tên, trùng SĐT) |
| LocalStorage, còn sau khi reload | Giỏ hàng + bản sao đệm (mục 2) |
| ES6+: let/const, arrow, template literal, destructuring, spread, rest, default param, module | Xuyên suốt (VD rest: `classNames(...parts)`, `debounce`) |
| **Slide 5 / Lab 4**: class, kế thừa, getter/setter | `Order` → `DineInOrder` / `BookingOrder` / `TakeawayOrder` (kế thừa, ghi đè `serviceDetails()` và `toJSON()` với `super`); getter `total`, `statusLabel`, `holdsStock`...; setter `status` từ chối trạng thái sai; `Staff` (getter thâm niên, setter trạng thái); `Drink`; `ApiError extends Error` |
| Promise / async-await (khuyến khích) | Mọi lệnh gọi API; `Promise.all` khi tải song song / trừ tồn kho nhiều món |
| **Slide 4 + tài liệu json-server**: async/await với axios, GET/POST/PUT/DELETE | `api.js` + `db.json` + json-server |
| **Slide 6 / Lab 5**: Module import/export | 18 module dùng chung + 14 file trang |
| **Lab 5 bài 5**: mua hàng thì giảm tồn, hết hàng thì không cho mua | Tồn kho trừ khi đặt, hoàn khi huỷ, hết thì khoá nút thêm |
| **Slide 7**: ESLint | `eslint.config.js`, `npm run lint` |
| Responsive | `responsive.css` - desktop / tablet / di động |
| Thông báo, xác nhận xoá, xử lý không có dữ liệu | Toast sau mọi thao tác, hộp xác nhận trước khi xoá/huỷ, trạng thái rỗng/đang tải/lỗi |

---

## 6. Nguồn hình ảnh & Bản quyền

| Thư mục | Nội dung | Nguồn gốc |
|---|---|---|
| `img/drinks/*.jpg` | 30 ảnh đồ uống (cocktail & rượu mạnh) | Tạo bằng AI của Google (trong file có dấu C2PA / SynthID) |
| `img/bottles/*.jpg` | 8 chai rượu mạnh & rượu mùi | Tạo bằng AI của Google |
| `img/lounge/*.jpg` | 5 ảnh không gian quán (quầy bar, sân khấu DJ, sofa VIP...) | Tạo bằng AI của Google |
| `img/hero-bar.jpg`, `img/about-bartender.jpg` | Ảnh nền trang chủ, giới thiệu | Tạo bằng AI của Google |
| `img/bartenders/*.jpg`, `img/collectors/*.jpg` | 13 chân dung minh hoạ cho Master Bartenders & Nhà sưu tầm | Tạo bằng AI của Google - **chỉ là ảnh minh hoạ, khuôn mặt do AI tự tạo, không phải ảnh thật và không giống người thật**. Trên thẻ ghi rõ nhãn "Chân dung minh hoạ (AI)" |

Website **không dùng ảnh lấy từ Internet** - mọi ảnh đều do nhóm tạo bằng AI nên không sao chép tác phẩm của nhiếp ảnh gia hay trang web khác. Tên và nhãn hiệu rượu xuất hiện trong ảnh thuộc về chủ sở hữu, chỉ dùng cho mục đích học tập.

Nội dung tiểu sử về các nhân vật có thật (Master Bartenders, Nhà sưu tầm) được tổng hợp và đối chiếu từ các nguồn tư liệu ngành công khai (Difford's Guide, Wikipedia, Tales of the Cocktail, The World's 50 Best Bars, scotchwhisky.com, Whisky Auctioneer...).

---

## 7. Kiểm thử & chất lượng mã

```bash
npm test         # 53 phép kiểm tra nghiệp vụ + class trên API giả lập (không cần bật server)
npm run check    # mọi import đều khớp export (bắt lỗi khiến trình duyệt dừng nạp module)
npm run lint     # ESLint
```

---

## 8. Hồ sơ nộp

Nén thư mục dự án thành `MSSV_HoTen_TenDeTai.rar`, **bỏ thư mục `node_modules`**
(người chấm chạy `npm install` để cài lại).

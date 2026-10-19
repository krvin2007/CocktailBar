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
                # (tạo lại cả thực đơn, đơn hàng, nhân sự, tài khoản khách mẫu và cấu hình ngân hàng)
```

Lệnh tạo lại `db.json` từ dữ liệu mẫu trong code, đồng thời làm mới ngày giờ các
đơn mẫu về "7 ngày gần nhất" để biểu đồ doanh thu trên Dashboard có số liệu.

### Đăng nhập (một cửa)

Website chỉ có **một form đăng nhập** tại `customer-auth.html` (nút **Đăng nhập** trên thanh điều hướng,
hoặc cửa sổ đăng nhập nhanh). Không còn cổng đăng nhập quản trị riêng - nhập tài khoản và mật khẩu,
hệ thống **tự nhận biết** loại tài khoản:

| Nhập | Hệ thống nhận ra | Chuyển tới |
|---|---|---|
| `admin` / `Admin@123` | Quản trị viên | Dashboard |
| Tên đăng nhập / mã / SĐT / email nhân sự đã được duyệt | Quản lý, thu ngân, pha chế, phục vụ | Trang đầu tiên được phép của vai trò đó |
| SĐT / email khách hàng | Khách hàng | Trang Đặt bàn & Gọi món |

Nhân viên mới tự đăng ký ở `admin-register.html` (đường dẫn nằm ngay dưới form đăng nhập), chờ quản lý
duyệt rồi đăng nhập bằng chính form này. Mỗi trình duyệt chỉ giữ một danh tính: đăng nhập tài khoản này
sẽ đăng xuất tài khoản kia. Phiên quản trị lưu ở `sessionStorage` (mất khi đóng tab), phiên khách ở `localStorage`.

---|---|
| `admin` | `Admin@123` |

Đăng nhập tại `customer-auth.html` (nút **Tài khoản / Đăng nhập** trên thanh điều hướng). Phiên
đăng nhập lưu ở `sessionStorage` (đối với ban quản trị), tự mất khi đóng tab.

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
| `/settings` (1 object) | GET | | PATCH | | Tài khoản ngân hàng nhận tiền VietQR (chỉ Quản lý sửa) |

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
├── admin-dashboard.html     Thống kê: KPI, biểu đồ doanh thu 7 ngày, top món bán chạy
├── admin-menu.html          CRUD thực đơn + tồn kho
├── admin-orders.html        Quản lý đơn: chi tiết, đổi trạng thái, huỷ, xoá
├── admin-customers.html     Khách hàng thành viên: hạng, điểm, chi tiêu, lịch sử điểm
├── customer-account.html    Khách xem hạng thành viên, tiến độ lên hạng, lịch sử điểm
├── admin-vouchers.html      Mã giảm giá: tạo/sửa/xoá, điều kiện, hạn dùng, lượt dùng (quản lý/admin)
├── admin-vouchers.html      CRUD mã giảm giá (loại %, số tiền, hạn dùng, lượt dùng, đơn tối thiểu)
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
│   │   ├── venue.js             Địa chỉ, giờ mở cửa, hotline, quy tắc đặt bàn (sức chứa, hạn huỷ...)
│   │   ├── settingsService.js   Tài khoản ngân hàng nhận tiền (GET/PATCH /settings)
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
- Đặt chỗ & gọi món 2 hình thức:
  - **Tại quầy/bàn** (Dine-in): bắt buộc có ít nhất 1 món.
  - **Đặt bàn trước** (Booking): **vừa giữ bàn vừa gọi món trước được**, nhưng gọi món là **tuỳ chọn** - giỏ trống vẫn giữ bàn được (đơn 0đ, không cần quét QR). Giờ đến: cách hiện tại ≥ 60 phút, tối đa 30 ngày, trong giờ mở cửa.
  - **Sức chứa theo khung giờ**: tối đa 60 khách đặt trước ngồi cùng lúc (2 lượt cách nhau < 2 tiếng tính là chồng giờ); form báo trực tiếp "Còn x/60 chỗ", hết chỗ thì không cho đặt.
  - **Xác nhận đủ 18 tuổi** (Luật Phòng chống tác hại rượu bia) bằng hai lớp: (1) form bắt buộc nhập **ngày sinh** và tick "Tôi đủ 18 tuổi" - khai dưới 18 (hoặc ngày không có thật) thì bị chặn, kể cả đặt bàn chỉ giữ chỗ; (2) phiếu đặt chỗ, trang tra cứu và chi tiết đơn của nhân viên đều nhắc **kiểm tra CCCD khi khách đến quán**. Website chỉ biết ngày sinh khách tự khai, không xác minh được giấy tờ - nên bước kiểm CCCD tại quán mới là bước quyết định.
  - Mọi quy tắc đặt bàn nằm ở `BOOKING_RULES` + `OPENING_HOURS` trong `js/modules/venue.js`.
- Trước khi đặt, giỏ hàng tự đối chiếu với thực đơn mới nhất: bỏ món đã hết/đã xoá, hạ số lượng theo tồn kho, cập nhật giá mới — và báo rõ cho khách.
- **Ưu đãi khi đặt** (xem mục 7): giảm tự động theo hạng thành viên, ô nhập **mã giảm giá**, ô **dùng điểm thưởng**; tiền thanh toán/QR luôn là số tiền sau giảm.
- Tra cứu đơn: bắt buộc nhập **cả mã đơn lẫn số điện thoại** (không để người lạ xem đơn của khách khác).
- **Khách tự huỷ** đơn/đặt bàn ngay khi tra cứu nếu đơn còn "Chờ xử lý", chưa thanh toán, và (với đặt bàn) còn ≥ 2 tiếng tới giờ hẹn - tự hoàn kho. Quy tắc nằm trong `Order.customerCancelCheck()`, lớp `BookingOrder` ghi đè thêm điều kiện giờ hẹn (đa hình).
- Thực đơn có nhóm **Mocktail không cồn** (khách lái xe / không uống rượu).
- Song ngữ **VI / EN** cho các trang khách dùng để đặt bàn (Đặt bàn, Liên hệ, Chi tiết món).
- Gửi liên hệ / đặt tiệc riêng.
- Thanh toán VietQR: quét mã theo tài khoản của quán (khách **không** đổi được tài khoản nhận tiền). Bấm "Tôi đã chuyển khoản" chỉ chuyển đơn sang **Chờ xác nhận CK**; đơn chỉ thành **Đã thanh toán** khi thu ngân đối chiếu và xác nhận.
- Mục **Địa điểm** trên trang chủ: địa chỉ, giờ mở cửa, hotline, bản đồ Google Maps. Dữ liệu ở `js/modules/venue.js` - form đặt bàn kiểm tra giờ đến theo đúng giờ mở cửa này.

**Quản trị**
- **Phân quyền theo vai trò** (`ROLE_PERMISSIONS` trong `auth.js`): Quản lý/Admin toàn quyền; Thu ngân: Dashboard + Đơn hàng (huỷ đơn, xác nhận thu tiền); Pha chế: chỉ Đơn hàng; Phục vụ: Đơn hàng + Hộp thư. Menu ẩn mục không có quyền, gõ thẳng URL cũng bị chuyển về trang của vai trò đó.
- Dashboard: tổng số món, số đơn, **doanh thu thực thu** (đơn đã xác nhận thanh toán), đơn chờ xử lý, chuyển khoản chờ đối chiếu, biểu đồ doanh thu **7 đêm gần nhất theo ngày kinh doanh** (chốt 06:00 sáng - ly bán lúc 01:00 thuộc đêm hôm trước; đơn đặt bàn tính theo giờ hẹn qua `order.serviceTime`), top 5 món bán chạy.
- Thực đơn: thêm/sửa/xoá món; **nhập và xem tồn kho** từng **chai rượu** (cocktail/mocktail không có tồn kho), cảnh báo *Sắp hết* (≤ 5 ly) / *Hết hàng*, lọc theo mức tồn kho; tồn kho = 0 thì tự chuyển "Tạm ngưng"; tạm ngưng chủ động vẫn giữ nguyên số tồn kho; không cho trùng tên món. Rượu mạnh bán theo **lần rót 30ml** (trường `servingMl`, giá ghi "/ 30ml"); giá rượu mạnh cao cấp ước tính theo giá chai bán lẻ, giá vốn khoảng 30-40% giá bán.
- Đơn hàng: xem chi tiết, đổi trạng thái **theo quy trình** (`ORDER_TRANSITIONS`): Chờ xử lý → Đang pha chế → Hoàn tất; đơn **Hoàn tất không thể huỷ** (đồ uống đã phục vụ). Huỷ đơn hoặc xoá đơn chưa phục vụ thì tự hoàn tồn kho, khôi phục đơn đã huỷ thì trừ lại; mã đơn không bao giờ trùng. Lọc theo tình trạng thanh toán; Quản lý cấu hình tài khoản ngân hàng nhận tiền.
- Nhân viên: thêm/sửa/xoá, lọc theo vị trí & trạng thái; không cho 2 nhân viên trùng số điện thoại. Nhân viên **tự đăng ký** ở trạng thái *Chờ duyệt* (không chọn được vị trí Quản lý), chỉ đăng nhập được sau khi Quản lý bấm **Duyệt**.
- Mã giảm giá (`admin-vouchers.html`, quản lý/admin): tạo/sửa/xoá mã giảm theo % (có trần) hoặc theo số tiền, đơn tối thiểu, hạn dùng, giới hạn lượt, bật/tắt; xem số lượt đã dùng.
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
| **Lab 5 bài 5**: mua hàng thì giảm tồn, hết hàng thì không cho mua | Chai rượu (nhóm "Rượu mạnh"): tồn kho trừ khi đặt, hoàn khi huỷ, hết thì khoá nút thêm |
| **Slide 7**: ESLint | `eslint.config.js`, `npm run lint` |
| Responsive | `responsive.css` - đã kiểm tra ở 320 / 375 / 390 / 768 / 1024 / 1440 / 1920px và điện thoại xoay ngang: không phần tử nào bị cắt; bảng quản trị cuộn ngang trên tablet/điện thoại; ô nhập 16px (iPhone không tự phóng to); chừa vùng tai thỏ; favicon + `manifest.json` (thêm vào màn hình chính) |
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

**Bản đồ** (trang chủ + Liên hệ) tự vẽ bằng thư viện Leaflet (nạp từ CDN cdnjs) trên nền OpenStreetMap, ghim mang tên quán; toạ độ ghim nằm ở `js/modules/venue.js` (`VENUE.lat`, `VENUE.lng`). Dữ liệu bản đồ © OpenStreetMap contributors (ghi nguồn ở góc bản đồ). Mất mạng thì bản đồ chuyển thành thẻ địa chỉ + nút mở Google Maps.

Website **không dùng ảnh lấy từ Internet** - mọi ảnh đều do nhóm tạo bằng AI nên không sao chép tác phẩm của nhiếp ảnh gia hay trang web khác. Tên và nhãn hiệu rượu xuất hiện trong ảnh thuộc về chủ sở hữu, chỉ dùng cho mục đích học tập.

Nội dung tiểu sử về các nhân vật có thật (Master Bartenders, Nhà sưu tầm) được tổng hợp và đối chiếu từ các nguồn tư liệu ngành công khai (Difford's Guide, Wikipedia, Tales of the Cocktail, The World's 50 Best Bars, scotchwhisky.com, Whisky Auctioneer...).

---

## 7. Kiểm thử & chất lượng mã

```bash
npm test         # 336 phép kiểm tra: 300 test nghiệp vụ quán + 36 test bảo vệ phạm vi Chatbot AI
npm run check    # 53 file JS: mọi import đều khớp export (không lỗi module)
npm run lint     # ESLint: 0 lỗi, 0 cảnh báo
```

### Quy tắc nghiệp vụ đã được kiểm thử

- **Chỉ chai rượu có tồn kho.** Cocktail, mocktail... pha từ nhiều nguyên liệu nên không giới hạn số ly (tối đa 99 ly/món/đơn để chặn nhập nhầm); quản lý chỉ cần bật/tắt "Tạm ngưng phục vụ". Form thêm/sửa món chỉ hiện ô Tồn kho khi chọn nhóm "Rượu mạnh". Xem `tracksStock()` trong `drinksService.js`.
- **Đơn hàng & kho** (áp dụng cho chai rượu): đặt món trừ kho, huỷ/xoá đơn chưa phục vụ hoàn kho, đơn đã phục vụ không huỷ được.
  **Khôi phục đơn đã huỷ** chỉ được khi kho còn đủ ly và (với đặt bàn) khung giờ còn đủ chỗ.
- **Sửa món không ghi đè kho:** form sửa món chỉ gửi trường kho/trạng thái nếu quản lý thực sự đổi (khách đặt xen vào lúc form đang mở không bị mất ly).
- **Số điện thoại:** `+84 912 345 678`, `0912.345.678`, `84912345678` đều quy về `0912345678` khi lưu, tra cứu đơn, đăng nhập và chống trùng.
- **Giờ đặt bàn** lưu dạng ISO (UTC), không phụ thuộc múi giờ máy.
- **Tích điểm khách hàng:** đơn của khách đã đăng nhập, khi chuyển sang *Hoàn tất*, được cộng 1 điểm / 10.000đ (đơn huỷ không cộng).
  Hạng: từ 150 điểm *Vàng*, từ 50 điểm *Bạc*, còn lại *Thân thiết*. Điểm trên thanh menu tự đối chiếu lại với máy chủ khi mở trang.
- **Phiên quản trị** được đối chiếu lại với `/staff` mỗi lần mở trang: tài khoản bị khoá/xoá thì bị đăng xuất, đổi vai trò thì áp quyền mới ngay.
  Quản lý không tự khoá / xoá / đổi vai trò của chính mình.
- **Bảo mật giao diện:** thông báo (toast) luôn hiển thị dạng chữ thuần (chống XSS qua tên khách, tên món, tham số URL).
- **Quy tắc đặt mật khẩu** (một luật chung cho đăng ký khách, đăng ký nhân sự và form nhân sự của quản lý - `checkPassword()` trong `js/modules/passwords.js`): ít nhất **8 ký tự**, **chữ cái đầu viết hoa**, có ít nhất **1 ký tự đặc biệt** (VD `@ # $ !`). Luật cũng được kiểm tra ở tầng nghiệp vụ nên gọi API trực tiếp từ giao diện nào cũng không lách được.
- **Tạm ngưng món:** form sửa món có ô tích **"Tạm ngưng phục vụ món này"**; tích thì khách không đặt được món, bỏ tích là mở bán lại (chai rượu hết kho thì tự tạm ngưng, nhập thêm hàng thì tự bỏ tích).
- **Hạng thành viên & tích điểm** (`MEMBER_RANKS` trong `customerAuth.js`): 4 hạng theo tổng điểm - Thân thiết (0), Bạc (50), Vàng (150), Kim Cương (400). Mỗi `10.000đ` của đơn **Hoàn tất** = 1 điểm; đơn huỷ không tính; mỗi đơn chỉ cộng một lần. Điểm được cộng cho khách đặt khi đã đăng nhập **và cả khách đặt vãng lai nếu số điện thoại trùng tài khoản thành viên**. Mỗi lần cộng ghi một dòng vào `pointHistory` (mã đơn, tổng tiền, số điểm, thời gian).
- **Độ tuổi** (`age.js`): `ageProblem(ngàySinh)` kiểm tra ngày sinh có thật, không ở tương lai, không quá 120 năm và đủ `MIN_AGE = 18` tuổi (tính theo ngày lịch: sinh 15/6/2008 thì đúng ngày 15/6/2026 mới đủ 18). Dùng ở 3 nơi: đăng ký thành viên (bắt buộc khai ngày sinh, lưu `birthDate` vào hồ sơ), form đặt bàn (thành viên được tự điền từ hồ sơ) và `createOrder` (kiểm tra lại ở tầng nghiệp vụ, đơn lưu `birthDate` để nhân viên đối chiếu CCCD).
- **Khuyến mãi** (`promotions.js`, `vouchersService.js`; giá được tính lại lúc chốt đơn trong `createOrder`, không tin con số trên giao diện). Thứ tự áp dụng, mỗi bước tính trên số tiền còn lại: (1) **giảm theo hạng** khi đã đăng nhập - Bạc 3%, Vàng 5%, Kim Cương 8%, Thân thiết 0%; (2) **mã giảm giá** - tối đa 1 mã/đơn, phải còn bật, chưa hết hạn, còn lượt, đủ đơn tối thiểu, và **mỗi số điện thoại chỉ dùng một mã một lần** (không tính đơn đã huỷ); mã giảm % có thể có trần; (3) **dùng điểm** - 1 điểm = 500đ, mỗi lần tối thiểu 20 điểm, tối đa 50% giá trị còn lại, phải đăng nhập và đủ số dư. Tổng giảm không vượt tổng tiền. Đơn lưu `subtotal`, `discounts[]`, `voucherCode`, `pointsUsed`; `total` là số tiền khách phải trả (dùng cho QR, doanh thu và tích điểm).
- **Điểm có hai số**: `points` là **số dư** (giảm khi dùng điểm), `lifetimePoints` là **tích luỹ trọn đời** (chỉ tăng) - hạng xét theo `lifetimePoints` nên dùng điểm **không làm tụt hạng**. Huỷ hoặc xoá đơn chưa phục vụ thì **hoàn điểm** và trả lại 1 lượt dùng mã (ghi `refund` trong lịch sử); khôi phục đơn đã huỷ thì trừ lại điểm (chặn nếu khách không đủ điểm hoặc số điện thoại đã dùng mã ở đơn khác). Dùng điểm ghi `redeem` (số âm) trong `pointHistory`.
- **Trang cho khách** `customer-account.html` (menu tên khách, mục "Hạng & điểm thưởng"): hạng hiện tại, thanh tiến độ lên hạng, bậc thang các hạng, lịch sử điểm. **Trang cho nhân viên** `admin-customers.html` (quản lý + thu ngân): danh sách khách kèm hạng, điểm, số đơn hoàn tất, tổng chi tiêu; lọc theo hạng, sắp xếp, xem lịch sử điểm. Điểm chỉ xem, không sửa tay để sổ điểm luôn khớp đơn hàng.
- **Mật khẩu được băm** (SHA-256 có muối riêng từng tài khoản, 1000 vòng - `js/modules/passwords.js`): `db.json` không còn mật khẩu chữ thường. Tài khoản cũ còn lưu chữ thường vẫn đăng nhập được và tự được băm lại ở lần đăng nhập đầu. Mật khẩu admin gốc trong mã nguồn cũng chỉ là bản băm.
- **Đơn đã thu tiền không xoá được** (giữ sổ doanh thu); muốn bỏ thì huỷ đơn (hoàn tiền) trước.
- **Song ngữ VI/EN cho cả nội dung** trang Hầm rượu, Master Bartenders, Nhà sưu tầm: dữ liệu gốc tiếng Việt, bản tiếng Anh nằm ở các lớp phủ `spiritsEn.js`, `bartendersEn.js`, `collectorsEn.js` (ghép bằng `contentLang.js`); đổi ngôn ngữ là đổi ngay, không cần tải lại.

### Giới hạn đã biết (đồ án học tập, không có máy chủ thật)

- Đăng nhập/phân quyền chạy ở **phía trình duyệt**; json-server không kiểm tra quyền nên ai gọi thẳng API vẫn đọc/ghi được (kể cả bản băm mật khẩu qua `/staff`). Băm mật khẩu chỉ là lớp bảo vệ bổ sung; triển khai thật cần backend xác thực và phân quyền ở phía máy chủ.
- Ngày sinh chỉ là **lời khai của khách** (không có bước xác minh giấy tờ trực tuyến); người gọi thẳng API vẫn tạo được đơn không có ngày sinh hợp lệ. Việc kiểm tra CCCD tại quán là biện pháp bù.
- Khuyến mãi (mã giảm giá, dùng điểm) cũng được kiểm tra **ở phía trình duyệt** rồi ghi qua API: json-server không chặn được người gọi thẳng API sửa số điểm hay lượt dùng mã. Trừ/hoàn điểm và lượt mã cũng là "đọc rồi ghi", không nguyên tử.
- Trừ/hoàn kho (chai rượu) là "đọc rồi ghi" qua API, không phải giao dịch nguyên tử: hai khách đặt cùng lúc chai sắp hết có thể làm kho lệch.
- Bản dịch tiếng Anh của 3 trang nội dung là lớp phủ tĩnh theo `id`: mục mới thêm vào `db.json` mà chưa có bản dịch thì vẫn hiển thị tiếng Việt khi chọn EN.

---

## 8. Hồ sơ nộp

Nén thư mục dự án thành `MSSV_HoTen_TenDeTai.rar`, **bỏ thư mục `node_modules`**
(người chấm chạy `npm install` để cài lại).

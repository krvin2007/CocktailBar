# 🍸 Quán Bar Đêm — Website quản lý, đặt bàn & khuyến mãi quán bar

Đồ án cuối khoá môn JavaScript. Đề tài thuộc **Nhóm 3 — Website quản lý**: quản lý
thực đơn đồ uống, đơn hàng/đặt bàn, nhân viên, hộp thư liên hệ, **banner quảng cáo,
mã giảm giá, khách hàng thành viên** và **trợ lý AI** của một quán bar cocktail
phong cách Speakeasy.

**Công nghệ:** HTML5 + CSS3 + JavaScript thuần ES6+ (module `import/export`,
`class`, getter/setter, `async/await`…). Không dùng framework/thư viện giao diện nào.
Theo đúng hướng dẫn bài giảng (Slide 4 + tài liệu *"hướng dẫn tạo photo API json"*),
dữ liệu được lưu trong **`db.json`**, **json-server** biến nó thành REST API, và
trang web gọi API bằng **axios + async/await**.

> json-server và ESLint chỉ là công cụ chạy bằng Node phía máy chủ (không nạp vào trình duyệt).
> Trợ lý AI gọi Google Gemini bằng `fetch` thuần (file JavaScript `tools/ai-middleware.cjs`), không cần thư viện nào thêm. axios nạp qua CDN như trong bài giảng; nếu
> máy không có mạng để tải CDN, website tự chuyển sang `fetch()` thuần — chức năng giữ nguyên.

---

## Mục lục

1. [Chạy dự án](#1-chạy-dự-án)
2. [Tài khoản demo](#2-tài-khoản-demo)
3. [Những gì đã làm được — từ đầu đến cuối](#3-những-gì-đã-làm-được--từ-đầu-đến-cuối)
4. [Đợt tính năng mới: đối chiếu 4 yêu cầu](#4-đợt-tính-năng-mới-đối-chiếu-4-yêu-cầu)
5. [Kiến trúc dữ liệu](#5-kiến-trúc-dữ-liệu)
6. [Cấu trúc thư mục](#6-cấu-trúc-thư-mục)
7. [Quy tắc nghiệp vụ chi tiết](#7-quy-tắc-nghiệp-vụ-chi-tiết)
8. [Đối chiếu yêu cầu đề bài & bài giảng](#8-đối-chiếu-yêu-cầu-đề-bài--bài-giảng)
9. [Kiểm thử & chất lượng mã](#9-kiểm-thử--chất-lượng-mã)
10. [Lưu ý kỹ thuật & giới hạn đã biết](#10-lưu-ý-kỹ-thuật--giới-hạn-đã-biết)
11. [Nguồn hình ảnh & bản quyền](#11-nguồn-hình-ảnh--bản-quyền)
12. [Hồ sơ nộp](#12-hồ-sơ-nộp)

---

## 1. Chạy dự án

### Cách 1 — khuyến nghị (1 lệnh)

```bash
npm install     # chỉ cần chạy 1 lần: json-server 0.17.4, ESLint
npm run seed    # tạo db.json mới (nên chạy đúng ngày demo - xem mục 2)
npm start       # json-server phục vụ CẢ trang web, API lẫn trợ lý AI ở cổng 3000
```

Mở trình duyệt: **http://localhost:3000**

### Bật trợ lý AI dùng Google Gemini (không bắt buộc)

Trợ lý AI **luôn chạy được** ở chế độ offline (dựa trên luật + dữ liệu thực đơn thật, **0 token**).
Muốn những câu khó được trả lời bằng Gemini:

1. Lấy khoá miễn phí tại **https://aistudio.google.com/apikey**.
2. Chép file `ai-key.example.json` thành **`ai-key.local.json`** rồi dán khoá vào:
   ```json
   { "apiKey": "KHOÁ_GEMINI_CỦA_BẠN", "model": "gemini-3.5-flash-lite" }
   ```
   File `ai-key.local.json` đã nằm trong `.gitignore` → **không bị đẩy lên GitHub**.
3. `npm start` lại. Nhãn đầu khung chat chuyển thành **"Gemini AI"**.

- **Tiết kiệm token:** trình duyệt cho trợ lý offline trả lời trước; chỉ câu offline **không hiểu** mới gửi
  lên Gemini. Mỗi lần gọi chỉ gửi 12 tin gần nhất (≤ 1000 ký tự/tin), câu trả lời ≤ 1024 token, tối đa 20 câu/phút/IP.
- Model mặc định `gemini-3.5-flash-lite` (bản Lite — rẻ nhất). Đổi bằng dòng `"model"` trong file khoá
  (VD `gemini-3.8-flash`); xem danh sách model khoá của bạn dùng được trong Google AI Studio.
- Khoá chỉ nằm ở máy chủ Node (`tools/ai-middleware.cjs`), **không bao giờ gửi xuống trình duyệt**.
- Không có khoá / mất mạng / Gemini quá tải (Google báo 503) → khung chat tự dùng câu trả lời offline.
- Có thể dùng biến môi trường thay file: `GEMINI_API_KEY=... npm start` (PowerShell: `$env:GEMINI_API_KEY="..."; npm start`).

### Cách 2 — đúng y các bước trong tài liệu hướng dẫn bài giảng

```bash
npm i -g json-server          # B1
json-server --watch db.json   # B3 - chạy trong thư mục dự án (db.json đã có sẵn - B2)
```

Sau đó mở `index.html` bằng **Live Server** (VS Code). Trang web tự gọi API sang
`http://localhost:3000` (json-server đã bật sẵn CORS). Cách này không nạp middleware AI
nên khung chat dùng chế độ offline — mọi chức năng khác giữ nguyên.

### Lưu ý về phiên bản json-server (đã kiểm chứng)

| Cách chạy | Kết quả kiểm thử với server thật |
|---|---|
| `npm start` (json-server **0.17.4**, không `--watch`, có `--fks _fk`) | ✅ khuyến nghị |
| `npm i -g json-server` (hiện cài bản **1.0**) + `json-server --watch db.json` | ✅ chạy được (trợ lý AI chỉ ở chế độ offline) |
| json-server **0.17** **kèm** `--watch` | ⚠️ **không dùng** — khi có 2 lệnh ghi liên tiếp (VD đặt hàng: trừ tồn kho rồi lưu đơn), bản 0.17 tưởng `db.json` bị sửa tay và tự khởi động lại server giữa chừng |
| json-server **0.17** **không** có `--fks _fk` | ⚠️ **không dùng** — xem mục 10: mỗi lệnh DELETE sẽ tự xoá các đơn có trường `customerId`/`voucherId` |

### Khôi phục dữ liệu mẫu (trước buổi demo)

```bash
npm run seed    # tắt server trước (Ctrl+C), chạy lệnh này, rồi npm start lại
```

Lệnh tạo lại `db.json` từ dữ liệu mẫu trong code, đồng thời làm mới ngày giờ: đơn mẫu về
"7 ngày gần nhất" (biểu đồ doanh thu có số liệu), 4 món mới ra mắt trong 3–10 ngày gần nhất,
và tài khoản demo **c1 có sinh nhật đúng ngày chạy seed** (để demo mã sinh nhật).

---

## 2. Tài khoản demo

**Quản trị** — đăng nhập tại `admin-login.html` (nút **Quản trị** trên thanh điều hướng):

| Tài khoản | Mật khẩu | Ghi chú |
|---|---|---|
| `admin` | `admin123` | Quản trị viên tối cao. Nhân viên trong bảng `staff` cũng đăng nhập được bằng tài khoản riêng |

Phiên quản trị lưu ở `sessionStorage`, tự mất khi đóng tab.

**Khách hàng thành viên** — đăng nhập tại `account.html` (nút **Thành viên** trên thanh điều hướng):

| SĐT | Mật khẩu | Đặc điểm để demo |
|---|---|---|
| `0981234567` | `123456` | **Sinh nhật hôm nay** (ngày chạy `npm run seed`) → đăng nhập là nhận mã giảm 25% |
| `0382345678` | `123456` | Sinh nhật 5 ngày tới (đang trong tuần sinh nhật), thành viên mới |
| `0773456789` | `123456` | Thành viên lâu năm, sinh nhật còn xa |

Mã giảm giá công khai có sẵn: `BANMOI10` (khách mới, đơn đầu tiên), `HAPPY10`, `SALE15`,
`CUOITUAN25`, `VIP30`, `DEMNAY35`, và `HETHAN20` (đã hết hạn — để demo thông báo lỗi).

---

## 3. Những gì đã làm được — từ đầu đến cuối

### Giai đoạn 1 — Nền tảng website quản lý quán bar (bản nộp đầu tiên)

**Khu khách hàng**
- **Trang chủ** (`index.html`): hero, dải danh mục dẫn sang thực đơn có sẵn bộ lọc, số liệu
  thật (số món, lượt phục vụ), **mô hình không gian quán 3D** (chọn bàn → tự điền vào form đặt bàn).
- **Thực đơn** (`menu.html`): **quyển menu bìa da lật trang 3D** + chế độ lưới; tìm kiếm theo tên/rượu
  nền/nguyên liệu, lọc danh mục, khoảng giá, chỉ món còn hàng, 6 kiểu sắp xếp.
- **Chi tiết món** (`detail.html`): ABV, tasting notes, ly phục vụ, thêm vào giỏ có kiểm tra tồn kho mới nhất.
- **Đặt bàn & gọi món** (`order.html`): giỏ hàng localStorage; 2 hình thức Dine-in / Đặt bàn trước
  (giờ đến ≥ 1 tiếng và trong khung 18:00–02:00); giỏ tự đối chiếu thực đơn mới nhất (bỏ món hết,
  hạ số lượng theo tồn kho, cập nhật giá) và báo rõ cho khách; **thanh toán VietQR**;
  tra cứu đơn bằng **cả mã đơn lẫn số điện thoại**.
- **Liên hệ & đặt tiệc riêng** (`contact.html`) có validate.
- **Hầm rượu di sản** (`spirits.html`), **Master Bartenders** (`bartenders.html`),
  **Nhà sưu tầm** (`collectors.html`) — dữ liệu từ API.
- **Song ngữ VI/EN** (`i18n.js`), responsive desktop/tablet/điện thoại, banner cảnh báo khi API tắt.

**Khu quản trị**
- **Dashboard**: KPI, biểu đồ doanh thu 7 ngày (đơn hoàn tất), top món bán chạy, đơn gần đây.
- **Thực đơn**: CRUD + tồn kho; tồn kho = 0 tự "Hết hàng"; không trùng tên món.
- **Đơn hàng**: chi tiết, đổi trạng thái; **huỷ/xoá đơn chưa phục vụ tự hoàn tồn kho**, phục hồi đơn
  đã huỷ thì trừ lại; mã đơn không bao giờ trùng.
- **Nhân viên**: CRUD, lọc vị trí/trạng thái, không trùng SĐT; trang đăng ký nhân sự.
- **Hộp thư liên hệ**: đọc, đánh dấu đã xử lý, xoá; số tin chưa đọc hiện trên menu.

### Giai đoạn 2 — Đợt tính năng mới (banner, bán chạy/mới nhất, sale, AI)

**1. Bảng banner** — `banners(id, tenbanner, hinhbanner)`
- Bảng mới trong `db.json`, đúng 3 trường như đề bài, 4 banner mẫu dùng ảnh có sẵn.
- `bannersService.js`: class `Banner`, CRUD qua API, kiểm tra ảnh an toàn (chỉ nhận đường dẫn
  trong dự án, `http(s)://` hoặc ảnh tải lên `data:image/...` — chặn `javascript:`).
- **Trang quản trị `admin-banners.html`**: bảng có ảnh thu nhỏ, tìm kiếm không dấu, phân trang; thêm/sửa
  trong modal (đếm ký tự tên, **chọn ảnh từ máy** bằng FileReader ≤ 400KB, xem trước như banner thật),
  xác nhận trước khi xoá.
- **Slider banner trên trang chủ** (`bannerSlider.js`): tự chuyển 5 giây, nút trước/sau, chấm điều hướng
  có thanh thời gian, tạm dừng khi rê chuột/chuyển tab, phím ←/→, vuốt trên điện thoại, tôn trọng
  "giảm chuyển động", nhãn cho trình đọc màn hình; bấm banner → trang Khuyến mãi.

**2. Trang chủ: sản phẩm nổi bật (bán chạy) & mới nhất**
- **"Nổi Bật — Bán Chạy Nhất"**: xếp hạng theo **số ly bán thật** từ bảng `orders` (bỏ đơn huỷ, bỏ món
  đã xoá), nhãn hạng #1–#4 và "Đã bán N ly"; chưa có lượt bán thì hiện món Signature.
- **"Món Mới Nhất"**: 4 món có `createdAt` mới nhất, nhãn "Ra mắt N ngày trước", nút "Xem tất cả" →
  `menu.html?sort=newest`.
- **Dải "Ưu đãi đang diễn ra"**: 3 thẻ Khách hàng mới / Sinh nhật / Sale theo món, số liệu lấy từ dữ liệu thật.
- Dashboard quản trị dùng chung hàm xếp hạng `rankBestSellers` → hai nơi luôn khớp số liệu.

**3. Sale: sản phẩm mới, người dùng mới, sale loại 10–15–25–30–35…, sinh nhật, mã giảm giá**
- **Sale theo món ("sale loại")**: mỗi món có `salePercent` ∈ {0, 10, 15, 20, 25, 30, 35, 40, 50},
  admin chọn trong form thực đơn (xem trước giá khách trả). Thẻ món hiện huy hiệu **-X%**, giá gạch ngang.
- **Sale sản phẩm mới**: món ra mắt trong **14 ngày** đầu tự giảm **10%**, huy hiệu **Mới**.
  Món vừa mới vừa có sale → lấy **mức cao hơn** (không cộng dồn).
- **Mã giảm giá** (bảng `vouchers`): mức giảm thuộc {10, 15, 20, 25, 30, 35, 40, 50}%, đơn tối thiểu,
  giảm tối đa, thời hạn, giới hạn lượt dùng, đối tượng (mọi khách / khách mới / sinh nhật), bật-tắt.
  **Trang quản trị `admin-vouchers.html`**: thống kê, khối "Chương trình tự động", lọc theo đối tượng/
  trạng thái/mức %, tạo mã ngẫu nhiên, xem trước số tiền giảm.
- **Người dùng mới**: (a) mã công khai `BANMOI10` chỉ dùng cho **đơn đầu tiên theo số điện thoại**;
  (b) **đăng ký thành viên** nhận ngay mã cá nhân `CHAO****` giảm **15%**, hạn 30 ngày.
- **Khách hàng tới sinh nhật nhận mã giảm giá**: thành viên đăng nhập trong khoảng **7 ngày trước đến
  7 ngày sau sinh nhật** tự nhận mã cá nhân `SNyy****` giảm **25%** (mỗi năm 1 mã, hạn tới sinh nhật + 7 ngày,
  xử lý cả sinh nhật vắt qua năm mới và người sinh 29/02). Admin có nút **"Phát mã sinh nhật"** trong
  trang `admin-customers.html`.
- **Khách hàng thành viên** (bảng `customers`): đăng ký/đăng nhập bằng SĐT ở `account.html`;
  **mật khẩu băm SHA-256** (Web Crypto), chặn trùng SĐT và **người dưới 18 tuổi** (quán bar);
  hồ sơ, đếm ngược sinh nhật, **ví mã giảm giá** (sao chép, "Dùng ngay"). Trang quản trị khách hàng:
  lọc "sinh nhật tháng này / sắp sinh nhật / thành viên mới", xem mã của từng khách.
- **Trang Khuyến mãi `sale.html`**: 4 chương trình, lọc món theo mức sale (`?tier=15`), lưới món mới,
  coupon các mã công khai (thanh "đã dùng/giới hạn", nút sao chép).
- **Áp mã khi đặt hàng** (`order.html`): ô mã giảm giá (+ `?voucher=CODE` trên URL), chip "Mã dành cho
  bạn", kiểm tra ngay và kiểm tra lại khi giỏ/SĐT thay đổi; bảng tiền: Tạm tính theo giá gốc → Tiết kiệm
  từ sale món → Giảm theo mã → **Tổng thanh toán**; khách đã đăng nhập được điền sẵn thông tin.
  Máy chủ kiểm tra lại mã khi tạo đơn; **huỷ/xoá đơn hoàn lượt dùng mã**, phục hồi đơn thì trừ lại.
  VietQR, tra cứu đơn, quản trị đơn và dashboard đều hiển thị số tiền giảm.

**4. AI tích hợp — Trợ lý AI Quán Bar Đêm**
- **Khung chat nổi** trên mọi trang khách (`chatWidget.js`): chip gợi ý nhanh, hiệu ứng "đang gõ…",
  **thẻ món gợi ý có nút "Thêm vào giỏ"**, lưu lịch sử trong phiên, xoá lịch sử, toàn màn hình trên điện thoại.
- **Offline trước, Gemini khi cần** (tiết kiệm token): câu nào trợ lý offline hiểu thì trả lời ngay (0 token);
  chỉ câu offline không hiểu mới gửi lên **Google Gemini** qua `tools/ai-middleware.cjs` (nạp vào json-server,
  gọi REST API bằng `fetch`, khoá đọc từ `ai-key.local.json`). Đầu ra JSON có cấu trúc `{ reply, drinkIds, outOfScope }`.
  Ngữ cảnh dựng **phía máy chủ** từ `db.json`: thực đơn + giá sau sale + mã **công khai** còn hạn + tên các trang
  tư liệu — **không bao giờ** đưa khách hàng, nhân viên, chi tiết đơn hay mã cá nhân vào prompt. Có giới hạn
  20 câu/phút/IP, kiểm tra và cắt ngắn tin nhắn, chặn vai trò lạ (chống chèn lệnh), tự thử lại 1 lần khi Gemini quá tải.
- **Chỉ trả lời nội dung có trên website** (cả 2 chế độ): câu ngoài lề (kiến thức chung, lập trình, bài tập, dịch
  thuật, thời sự, chính trị, tài chính…) bị từ chối bằng một câu cố định; hỏi dữ liệu khách/mật khẩu bị từ chối;
  hỏi thứ website không có (wifi, chỗ đậu xe, bia, đồ ăn, giao hàng) thì nói rõ "website chưa có thông tin" và mời
  gọi hotline — không đoán. Với Gemini còn có **chặn cứng bằng code**: AI phải đánh dấu `outOfScope`, máy chủ
  thay câu trả lời bằng câu từ chối chuẩn nên AI không thể "lỡ" trả lời lan man.
- **Chế độ offline** (`aiAssistant.js`, không cần mạng/khoá): hiểu tiếng Việt **có dấu và không dấu**,
  nhận diện ý định (giờ mở cửa, địa chỉ, đặt bàn, mã giảm giá thật, sinh nhật, khách mới, món mới,
  bán chạy, món đang sale theo %), gợi ý theo khẩu vị, rượu nền, độ mạnh, **ngân sách** ("dưới 120k");
  chỉ gợi ý món còn hàng; tôn trọng an toàn (18+, không lái xe sau khi uống).

**Điều hướng & hạ tầng chung**
- Thanh điều hướng thêm **Khuyến mãi** và nút **Thành viên** (hiện tên khi đã đăng nhập); sidebar quản trị
  thêm **Banner quảng cáo**, **Mã giảm giá & Sale**, **Khách hàng thành viên**; footer thêm liên kết mới.
- Bố cục thanh menu tự co theo độ rộng màn hình (gọn 1 dòng trên laptop, menu xổ xuống trên tablet/di động).
- `npm run seed` sinh thêm 3 bảng mới; `npm test` chạy thêm 119 phép kiểm tra mới.

---

## 4. Đợt tính năng mới: đối chiếu 4 yêu cầu

| Yêu cầu | Đáp ứng | Xem ở |
|---|---|---|
| Tạo bảng banner(id, tenbanner, hinhbanner) | Bảng `/banners` + CRUD + slider trang chủ | `db.json`, `bannersService.js`, `admin-banners.html`, `bannerSlider.js` |
| Trang chủ: sản phẩm nổi bật (bán chạy), mới nhất | 2 khối mới tính từ dữ liệu thật | `index.html`, `home.js`, `rankBestSellers`/`getNewestDrinks` trong `drinksService.js` |
| Sale: sản phẩm mới | Tự giảm 10% trong 14 ngày đầu, huy hiệu "Mới" | `getDrinkPricing` (`drinksService.js`), `drinkCard.js`, `sale.html` |
| Sale: người dùng mới | `BANMOI10` (đơn đầu theo SĐT) + mã chào mừng 15% khi đăng ký | `vouchersService.js`, `account.html` |
| Sale loại 10, 15, 25, 30, 35… | Mức sale theo món + mức giảm của mã | `SALE_TIERS`, `DISCOUNT_TIERS`, `admin-menu.html`, `admin-vouchers.html` |
| Khách hàng tới sinh nhật nhận mã giảm giá | Tự phát mã 25% trong tuần sinh nhật + admin phát tay | `ensureBirthdayVoucher`, `customerAuth.js`, `admin-customers.html` |
| AI tích hợp | Khung chat AI (offline trước, Gemini khi cần; chỉ trả lời nội dung website) gợi ý món, thêm giỏ, giải đáp khuyến mãi | `chatWidget.js`, `aiAssistant.js`, `tools/ai-middleware.cjs` |

---

## 5. Kiến trúc dữ liệu

```
 Trang HTML ──► js/pages/*.js ──► js/modules/*Service.js ──► js/modules/api.js ──► json-server ──► db.json
 (giao diện)    (sự kiện, vẽ DOM)   (nghiệp vụ CRUD, lọc)      (axios / fetch)        (REST API)     (dữ liệu)
                                                                    │
                                                                    └──► localStorage (bản sao đệm)

 Khung chat AI ──► aiAssistant.js ──► trợ lý offline (trả lời trước, 0 token)
                        │
                        └─ câu offline không hiểu ──► POST /ai/chat ──► tools/ai-middleware.cjs ──► Google Gemini (REST)
                                                     (json-server --middlewares)   └──► đọc db.json (chỉ dữ liệu công khai)
```

**json-server (`db.json`)** — dữ liệu chung của quán:

| Bảng | Đọc | Thêm | Sửa | Xoá | Dùng ở |
|---|---|---|---|---|---|
| `/drinks` | GET | POST | PATCH | DELETE | Thực đơn, chi tiết, quản lý thực đơn, tồn kho, **sale theo món (`salePercent`)** |
| `/orders` | GET | POST | PATCH | DELETE | Đặt bàn, tra cứu, quản lý đơn, Dashboard, **bán chạy**, **giảm giá theo mã** |
| `/staff` | GET | POST | PATCH | DELETE | Quản lý nhân viên |
| `/messages` | GET | POST | PATCH | DELETE | Form liên hệ, hộp thư quản trị |
| **`/banners`** | GET | POST | PATCH | DELETE | Slider trang chủ, quản lý banner |
| **`/vouchers`** | GET | POST | PATCH | DELETE | Mã giảm giá, áp mã khi đặt, ví mã của khách |
| **`/customers`** | GET | POST | PATCH | DELETE | Đăng ký/đăng nhập thành viên, sinh nhật, quản lý khách hàng |
| `/spirits`, `/bartenders`, `/collectors` | GET | | | | Trang Hầm rượu, Master Bartenders, Nhà sưu tầm |

Trường mới trên bảng cũ: `drinks.salePercent`; `orders.subtotal`, `orders.discount`, `orders.voucherCode`,
`orders.voucherId`, `orders.customerId` (đơn cũ không có các trường này vẫn hiển thị đúng).

**localStorage**: giỏ hàng (`quanbar_cart` — lưu cả giá sau sale và giá gốc), bản sao đệm
(`quanbar_cache_*`), **phiên khách thành viên** (`customer_session`, không chứa mật khẩu băm, hết hạn sau 30 ngày),
ngôn ngữ. **sessionStorage**: phiên quản trị, lịch sử khung chat AI.

---

## 6. Cấu trúc thư mục

```
CocktailBar/
├── index.html               Trang chủ - slider banner, bán chạy, món mới, ưu đãi, không gian 3D
├── menu.html                Thực đơn - quyển menu 3D + lưới; lọc "chỉ món đang giảm giá", ?sale=1, ?sort=newest
├── detail.html              Chi tiết 1 món - giá sau sale, chương trình đang áp dụng, thêm vào giỏ
├── order.html               Giỏ hàng + đặt bàn + MÃ GIẢM GIÁ + tra cứu đơn + VietQR
├── sale.html                (MỚI) Khuyến mãi & Sale - 4 chương trình, lọc theo mức %, coupon mã công khai
├── account.html             (MỚI) Thành viên - đăng ký/đăng nhập, hồ sơ, sinh nhật, ví mã giảm giá
├── contact.html             Liên hệ & đặt tiệc riêng
├── spirits.html, bartenders.html, collectors.html
├── admin-login.html, admin-register.html
├── admin-dashboard.html     Thống kê + KPI món đang sale / món mới / tổng giảm theo mã
├── admin-menu.html          CRUD thực đơn + tồn kho + MỨC SALE (%)
├── admin-orders.html        Quản lý đơn (hiện mã giảm giá & số tiền giảm)
├── admin-banners.html       (MỚI) CRUD bảng banner
├── admin-vouchers.html      (MỚI) CRUD mã giảm giá & chương trình sale
├── admin-customers.html     (MỚI) Khách hàng thành viên, phát mã sinh nhật
├── admin-staff.html, admin-messages.html
│
├── db.json                  Cơ sở dữ liệu của json-server (10 bảng)
├── package.json             Lệnh npm: start, api, web, seed, test, check, lint
├── eslint.config.js         Cấu hình ESLint (Slide 7) - gồm cả file .cjs của Node
│
├── css/        reset, variables, style, admin, responsive, spirits, legends, menu-book,
│               banner (MỚI), promo (MỚI), promo-admin (MỚI), checkout (MỚI), chat (MỚI)
├── js/
│   ├── modules/
│   │   ├── api.js               Gọi REST API bằng axios (dự phòng fetch), bộ nhớ đệm
│   │   ├── storage.js           Bọc localStorage / sessionStorage
│   │   ├── drinksService.js     class Drink, CRUD, lọc/sắp xếp, tồn kho, GIÁ SALE, MÓN MỚI, BÁN CHẠY
│   │   ├── ordersService.js     Giỏ hàng + CRUD đơn + hoàn/trừ tồn kho + ÁP MÃ / HOÀN LƯỢT MÃ
│   │   ├── bannersService.js    (MỚI) class Banner, CRUD bảng banner, kiểm tra ảnh an toàn
│   │   ├── bannerSlider.js      (MỚI) Slider banner trang chủ
│   │   ├── vouchersService.js   (MỚI) class Voucher, CRUD, kiểm tra mã, mã chào mừng, mã sinh nhật
│   │   ├── customersService.js  (MỚI) class Customer, đăng ký, băm SHA-256, tính sinh nhật/tuổi
│   │   ├── customerAuth.js      (MỚI) Phiên đăng nhập khách thành viên
│   │   ├── aiAssistant.js       (MỚI) Gọi trợ lý AI máy chủ, engine trợ lý offline
│   │   ├── chatWidget.js        (MỚI) Khung chat AI nổi trên mọi trang khách
│   │   ├── staffService.js, messagesService.js, vietqrService.js, auth.js
│   │   ├── validation.js, ui.js, i18n.js, navbar.js, adminLayout.js
│   │   ├── drinkCard.js (huy hiệu Mới / -X%), menuBook.js, lounge3d.js, portrait.js, icons.js, utils.js
│   │   └── spiritsData.js, bartendersData.js, collectorsData.js   (dữ liệu mẫu)
│   └── pages/                   1 file logic cho mỗi trang HTML (20 trang)
│
├── img/                         Ảnh đồ uống, chai rượu, không gian quán, chân dung minh hoạ
└── tools/
    ├── tao-db.js                Sinh db.json từ dữ liệu mẫu (npm run seed)
    ├── ai-middleware.cjs        (MỚI) Middleware json-server: /ai/status, /ai/chat -> Google Gemini
    ├── kiem-tra-ton-kho.js      53 phép kiểm tra nghiệp vụ tồn kho / đơn hàng / class
    ├── kiem-tra-khuyen-mai.js   (MỚI) 119 phép kiểm tra banner / sale / mã giảm giá / sinh nhật / AI
    ├── kiem-tra-module.js       Kiểm tra import/export giữa các module (npm run check)
    ├── tao-anh.js               Sinh hình minh hoạ SVG (npm run images)
    └── server.js                Máy chủ tĩnh thay thế (npm run web)
```

---

## 7. Quy tắc nghiệp vụ chi tiết

**Giá bán**
- Giá khách trả = giá gốc × (100 − %) / 100, **làm tròn đến nghìn đồng**.
- % = **mức cao hơn** giữa sale theo món (`salePercent`) và ưu đãi món mới (10% trong 14 ngày) — không cộng dồn.
- Giỏ hàng lưu giá tại thời điểm thêm; trước khi đặt, giỏ đối chiếu lại giá sau sale mới nhất và báo khách nếu đổi.
- Bộ lọc khoảng giá và sắp xếp theo giá trên thực đơn dùng **giá sau ưu đãi**.

**Mã giảm giá**
- Tiền giảm = tạm tính × % (làm tròn đồng), không vượt "giảm tối đa" (nếu có), không vượt tạm tính;
  tạm tính < "đơn tối thiểu" → không áp dụng. Mã giảm **trên giá đã sale** (sale món + mã có thể cùng dùng).
- Mỗi đơn dùng **1 mã**. Mã được kiểm tra ở trình duyệt (báo ngay) và **kiểm tra lại khi tạo đơn**.
- Từ chối khi: không tồn tại, đang tắt, chưa đến ngày, hết hạn, hết lượt, chưa đủ đơn tối thiểu,
  mã cá nhân của người khác, mã khách mới mà SĐT đã có đơn (đơn đã huỷ không tính).
- Đặt thành công → +1 lượt dùng; huỷ đơn / xoá đơn chưa phục vụ → hoàn 1 lượt; phục hồi đơn đã huỷ → trừ lại.
- Nên **"Tắt"** thay vì xoá mã đã có người dùng (giữ lịch sử).

**Thành viên & sinh nhật**
- Đăng ký: SĐT di động hợp lệ, không trùng; đủ **18 tuổi**; mật khẩu ≥ 6 ký tự (lưu băm SHA-256).
- Mã chào mừng: `CHAO****`, 15%, 1 lần, hạn 30 ngày, chỉ chủ tài khoản dùng được, cho đơn đầu tiên.
- Mã sinh nhật: tự phát khi thành viên đăng nhập / mở trang tài khoản trong **±7 ngày quanh sinh nhật**;
  `SNyy****`, 25%, 1 lần, hạn đến sinh nhật + 7 ngày (23:59); mỗi khách mỗi năm 1 mã.

**Đơn hàng / tồn kho (giữ nguyên từ giai đoạn 1)**
- Đặt hàng trừ kho; huỷ hoặc xoá đơn chưa phục vụ hoàn kho; tồn kho = 0 → tự "Hết hàng".
- Mã đơn = số lớn nhất + 1 (không trùng sau khi xoá). Tra cứu đơn cần cả mã đơn và SĐT.

---

## 8. Đối chiếu yêu cầu đề bài & bài giảng

| Yêu cầu | Đáp ứng |
|---|---|
| HTML5/CSS3/JS thuần, không framework | Toàn bộ dự án |
| ≥ 7 trang (chủ, danh sách, chi tiết, thêm, sửa, liên hệ, quản lý) | **20 trang**; thêm/sửa bằng form trong modal ở các trang quản trị |
| DOM: render động, không hardcode dữ liệu trong HTML | Mọi danh sách, slider, coupon, khung chat vẽ bằng JS từ dữ liệu API |
| Event: click, submit, input, change, keyboard | Lọc khi gõ, chọn bộ lọc, submit form, Esc đóng modal, ←/→ slider, Enter gửi chat, vuốt slider |
| Array/Object, map/filter/find/findIndex/some/reduce/sort/forEach | Các service, Dashboard, xếp hạng bán chạy (`Map` + `reduce`), engine AI |
| CRUD hoàn chỉnh | Thực đơn, nhân viên, **banner, mã giảm giá** (đủ C-R-U-D); đơn hàng, tin nhắn, **khách hàng** |
| Tìm kiếm – Lọc – Sắp xếp – Thống kê | Thực đơn + 7 bảng quản trị + Dashboard + trang Khuyến mãi |
| Form & Validation | `validation.js` + luật riêng: giờ đặt bàn, trùng tên/SĐT/mã, ≥ 18 tuổi, ngày kết thúc ≥ ngày bắt đầu, ảnh ≤ 400KB |
| LocalStorage, còn sau khi reload | Giỏ hàng, bản sao đệm, phiên thành viên |
| ES6+: let/const, arrow, template literal, destructuring, spread, rest, default param, module | Xuyên suốt |
| **Slide 5 / Lab 4**: class, kế thừa, getter/setter | `Order` → `DineInOrder`/`BookingOrder`/`TakeawayOrder`; getter `total`, `subtotal`, `productSavings`; `Voucher` (setter `percent` chỉ nhận mức hợp lệ, getter `isUsable`, `statusLabel`); `Customer` (trường private mật khẩu băm, getter `age`, `isInBirthdayWindow`); `Banner`; `Staff`; `Drink`; `ApiError extends Error` |
| Promise / async-await | Mọi lệnh gọi API; `Promise.all` khi tải song song / trừ kho nhiều món / trừ kho + trừ lượt mã; Web Crypto `crypto.subtle.digest` |
| **Slide 4 + tài liệu json-server**: async/await với axios, GET/POST/PUT/DELETE | `api.js` + `db.json` + json-server |
| **Slide 6 / Lab 5**: Module import/export | 29 module dùng chung + 20 file trang |
| **Lab 5 bài 5**: mua hàng thì giảm tồn, hết hàng thì không cho mua | Tồn kho trừ khi đặt, hoàn khi huỷ, hết thì khoá nút thêm |
| **Slide 7**: ESLint | `eslint.config.js`, `npm run lint` (0 lỗi) |
| Responsive | Desktop / laptop / tablet / điện thoại (đã kiểm tra 360px → 2200px không tràn ngang) |
| Thông báo, xác nhận xoá, xử lý không có dữ liệu | Toast, hộp xác nhận, trạng thái rỗng/đang tải/lỗi ở mọi trang mới |

---

## 9. Kiểm thử & chất lượng mã

```bash
npm test         # 53 + 119 = 172 phép kiểm tra nghiệp vụ trên API giả lập (không cần bật server)
npm run check    # mọi import đều khớp export (bắt lỗi khiến trình duyệt dừng nạp module)
npm run lint     # ESLint - 0 lỗi
```

`tools/kiem-tra-khuyen-mai.js` (119 phép) kiểm tra: CRUD banner & chặn ảnh `javascript:`; giá sale/món mới/
không cộng dồn; xếp hạng bán chạy (bỏ đơn huỷ, bỏ món đã xoá) và món mới nhất; tính tiền giảm, giảm tối đa,
mọi lý do từ chối mã; khách mới theo SĐT; đăng ký (băm mật khẩu, chặn trùng SĐT, chặn dưới 18 tuổi), mã chào
mừng, mã cá nhân; cửa sổ sinh nhật vắt qua năm, 29/02, mỗi năm 1 mã, hết hạn; đặt hàng có mã (giỏ theo giá sale,
mã sai không tạo đơn, hoàn/trừ lượt khi huỷ/phục hồi/xoá); trợ lý AI offline (có/không dấu, ngân sách, chỉ món
còn hàng); **trợ lý chỉ trả lời nội dung website** (12 câu ngoài lề bị từ chối, hỏi dữ liệu khách / mật khẩu bị từ
chối, món không có như bia/đồ ăn, wifi, giao hàng được trả lời "website chưa có", không bịa thông tin); middleware AI
**không lộ dữ liệu khách/nhân viên/mã cá nhân** vào prompt, bắt buộc trường `outOfScope`, chặn tin vai trò lạ.

Ngoài ra đã chạy kiểm thử trên **trình duyệt thật (Chromium)** với json-server: mở 30 trang/khung nhìn
(khách, quản trị, điện thoại 375px) không có lỗi JavaScript hay tràn ngang, và chạy trọn luồng
*đăng nhập thành viên có sinh nhật → nhận mã → thêm món đang sale → áp mã → đặt hàng thành công*
(230.000đ → sale 35% còn 150.000đ → mã sinh nhật 25% → **112.500đ**).

---

## 10. Lưu ý kỹ thuật & giới hạn đã biết

- **`--fks _fk` trong `npm start` là bắt buộc.** json-server 0.17 có cơ chế "tự xoá bản ghi mồ côi": mỗi khi
  có lệnh DELETE, nó xoá mọi bản ghi có trường kết thúc bằng `Id` (VD `customerId`, `voucherId`) trỏ tới bản ghi
  không tồn tại (đã đối chiếu mã nguồn `json-server/lib/server/mixins.js`). Cờ `--fks _fk` tắt cơ chế này.
  Code cũng chủ động không ghi `customerId`/`voucherId` rỗng.
- **json-server phục vụ mọi bảng công khai** (`GET /customers`, `GET /staff`…) — giới hạn của mô hình
  json-server dùng trong đồ án; không có backend xác thực thật. Mật khẩu khách hàng vì vậy được **băm SHA-256**
  thay vì lưu thô. Không dùng cấu trúc này cho hệ thống thật.
- Kiểm tra mã giảm giá và trừ lượt dùng chạy ở trình duyệt → nếu nhiều người đặt cùng lúc có thể vượt nhẹ
  giới hạn lượt; chấp nhận được trong phạm vi đồ án.
- **Gemini đã được chạy thử với khoá thật** (model `gemini-3.5-flash-lite`): gợi ý món đúng thực đơn & giá, từ chối câu
  ngoài lề / xin dữ liệu khách, nói "chưa có thông tin" với câu website không đề cập. Gói miễn phí của Google có giới hạn
  lượt/phút và đôi khi báo quá tải (503) — khi đó khung chat tự dùng trợ lý offline. Lưu ý gói miễn phí có thể được
  Google dùng dữ liệu hội thoại để cải thiện sản phẩm — không nhập thông tin nhạy cảm vào khung chat.
- Ảnh banner tải lên được lưu dạng base64 trong `db.json` (≈ 530KB / ảnh 400KB) — nên dùng đường dẫn ảnh
  trong thư mục `img/` khi có thể.
- Ngày tháng trong dữ liệu mẫu tính tương đối theo ngày chạy `npm run seed` → chạy seed vào ngày demo.

---

## 11. Nguồn hình ảnh & bản quyền

| Thư mục | Nội dung | Nguồn gốc |
|---|---|---|
| `img/drinks/*.jpg` | 30 ảnh đồ uống (cocktail & rượu mạnh) | Tạo bằng AI của Google (trong file có dấu C2PA / SynthID) |
| `img/bottles/*.jpg` | 8 chai rượu mạnh & rượu mùi | Tạo bằng AI của Google |
| `img/lounge/*.jpg` | 5 ảnh không gian quán (quầy bar, sân khấu DJ, sofa VIP...) — dùng lại cho banner | Tạo bằng AI của Google |
| `img/hero-bar.jpg`, `img/about-bartender.jpg` | Ảnh nền trang chủ, giới thiệu | Tạo bằng AI của Google |
| `img/bartenders/*.jpg`, `img/collectors/*.jpg` | 13 chân dung minh hoạ cho Master Bartenders & Nhà sưu tầm | Tạo bằng AI của Google - **chỉ là ảnh minh hoạ, khuôn mặt do AI tự tạo, không phải ảnh thật và không giống người thật**. Trên thẻ ghi rõ nhãn "Chân dung minh hoạ (AI)" |

Website **không dùng ảnh lấy từ Internet** - mọi ảnh đều do nhóm tạo bằng AI nên không sao chép tác phẩm của
nhiếp ảnh gia hay trang web khác. Tên và nhãn hiệu rượu xuất hiện trong ảnh thuộc về chủ sở hữu, chỉ dùng cho
mục đích học tập.

Nội dung tiểu sử về các nhân vật có thật (Master Bartenders, Nhà sưu tầm) được tổng hợp và đối chiếu từ các
nguồn tư liệu ngành công khai (Difford's Guide, Wikipedia, Tales of the Cocktail, The World's 50 Best Bars,
scotchwhisky.com, Whisky Auctioneer...).

---

## 12. Hồ sơ nộp

Nén thư mục dự án thành `MSSV_HoTen_TenDeTai.rar`, **bỏ thư mục `node_modules`**
(người chấm chạy `npm install` để cài lại). **Không** nộp kèm file `ai-key.local.json` (chứa khoá Gemini) — chỉ nộp `ai-key.example.json`.

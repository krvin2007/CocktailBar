# 🔄 SƠ ĐỒ WORKFLOW CHO SAMPLE ĐƠN GIẢN CỦA WEB APPLICATION
## TÍNH NĂNG CHI TIẾT SẢN PHẨM & ĐÁNH GIÁ (PRODUCT DETAIL & REVIEW SYSTEM)

> **Mô hình triển khai:** Mã nguồn `app.js` & giao diện `sample_review.html`  
> **Giao thức:** RESTful API qua thư viện Axios  
> **Lưu trữ phiên:** `localStorage` (`sample-review-user`)  
> **Ngôn ngữ định dạng:** GitHub Markdown kết hợp Mermaid Diagrams chuẩn.

---

## 1. SƠ ĐỒ LUỒNG TỔNG THỂ (OVERALL MASTER FLOWCHART)

Sơ đồ thể hiện toàn bộ vòng đời hoạt động từ khi người dùng mở trang web, đăng nhập cho đến khi gửi đánh giá sao và hiển thị nhận xét:

```mermaid
flowchart TD
    Start(["Người dùng mở trang web (sample_review.html)"]) --> CheckLocal["Kiểm tra phiên đăng nhập: readSavedUser() từ localStorage"]
    
    CheckLocal --> RenderAcc["renderAccount(): Cập nhật trạng thái giao diện (Đã đăng nhập hay Chưa)"]
    RenderAcc --> LoadData["loadPageData(): Tải dữ liệu song song qua Promise.all()"]
    
    LoadData --> FetchProd["api.get('/products/1')"]
    LoadData --> FetchRev["api.get('/reviews?productId=1&_sort=createdAt&_order=desc')"]
    
    FetchProd & FetchRev --> CalcRating["Tính điểm Rating trung bình:<br/>Average = Tổng số sao / Số lượng nhận xét"]
    CalcRating --> RenderProd["renderProduct(): Hiển thị ảnh, tên, giá tiền, mô tả & điểm sao trung bình"]
    RenderProd --> RenderRevList["renderReviews(): Duyệt mảng nhận xét, escapeHTML chống XSS & hiển thị ra danh sách"]
    
    RenderRevList --> UserChoice{"Người dùng thực hiện thao tác gì?"}
    
    %% Nhánh 1: Đăng nhập
    UserChoice -->|"1. Chưa đăng nhập"| LoginForm["Điền Email & Mật khẩu ➔ Submit #login-form"]
    LoginForm --> ApiLogin["api.get('/user', { params: { email } })"]
    ApiLogin --> CheckPass{"Mật khẩu có khớp?"}
    CheckPass -->|"Không khớp"| LoginFail["Báo lỗi: Email hoặc mật khẩu không đúng"]
    CheckPass -->|"Khớp"| SaveSession["Lưu currentUser vào localStorage: 'sample-review-user'"]
    SaveSession --> RenderAcc
    
    %% Nhánh 2: Đăng xuất
    UserChoice -->|"2. Bấm Đăng xuất"| Logout["Xoá 'sample-review-user' khỏi localStorage"]
    Logout --> RenderAcc
    
    %% Nhánh 3: Viết đánh giá
    UserChoice -->|"3. Gửi đánh giá mới"| ReviewForm["Chọn 1 - 5 sao (Radio) & Nhập nội dung bình luận"]
    ReviewForm --> ValidateRev{"Kiểm tra: Đã đăng nhập & Chọn sao & Nhập bình luận?"}
    ValidateRev -->|"Chưa hợp lệ"| AlertErr["Báo lỗi: Vui lòng đăng nhập / chọn sao / nhập bình luận"]
    ValidateRev -->|"Hợp lệ"| DisableBtn["Vô hiệu hóa nút Submit (#review-submit) chống spam"]
    
    DisableBtn --> PostApi["api.post('/reviews', { productId, userId, userName, rating, comment, createdAt })"]
    PostApi --> SuccessMsg["Thông báo: Đã gửi đánh giá thành công! & Reset form"]
    SuccessMsg --> ReloadData["Gọi lại loadPageData() để cập nhật điểm sao và thêm nhận xét mới vào đầu danh sách"]
    ReloadData --> Finish(["Hoàn tất chu trình"])
```

---

## 2. WORKFLOW 1: TẢI TRANG & HIỂN THỊ DỮ LIỆU BAN ĐẦU (PAGE LOAD FLOW)

Quy trình tuần tự giữa Trình duyệt và Máy chủ REST API khi người dùng mới mở trang:

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng
    participant UI as Giao diện (sample_review.html)
    participant App as Mã xử lý (app.js)
    participant Local as Trình duyệt (localStorage)
    participant Server as REST API (json-server)

    User->>UI: Truy cập vào trang web
    UI->>App: Khởi chạy app.js
    App->>Local: Đọc 'sample-review-user' (readSavedUser)
    Local-->>App: Trả về thông tin phiên (nếu có)
    App->>UI: renderAccount(): Ẩn/Hiện form đăng nhập & form đánh giá

    App->>Server: Gửi song song (Promise.all):
    Note over App,Server: GET /products/1 & GET /reviews?productId=1
    Server-->>App: Trả về đối tượng sản phẩm & Mảng các nhận xét
    
    App->>App: Tính điểm Rating trung bình = (Tổng sao) / (Số nhận xét)
    App->>UI: renderProduct(): Điền tên, giá (formatPrice), ảnh và điểm sao
    App->>App: escapeHTML() làm sạch toàn bộ tên và nội dung bình luận
    App->>UI: renderReviews(): Vẽ danh sách các thẻ nhận xét và định dạng ngày giờ
```

---

## 3. WORKFLOW 2: QUY TRÌNH ĐĂNG NHẬP THÀNH VIÊN (USER LOGIN FLOW)

```mermaid
flowchart TD
    Step1["Người dùng nhập Email & Mật khẩu vào form"] --> Step2["Bấm nút 'Đăng nhập' (#login-form submit)"]
    Step2 --> Prevent["event.preventDefault(): Chặn tải lại trang"]
    Step3["Lấy email.trim() và password"] --> Step4["Gọi API: api.get('/user', { params: { email } })"]
    
    Step4 --> CheckExist{"Tìm thấy tài khoản khớp email & password?"}
    CheckExist -->|"Không tìm thấy"| ShowErr["Hiển thị: 'Email hoặc mật khẩu không đúng.'"]
    
    CheckExist -->|"Tìm thấy"| CreateSession["Tạo đối tượng currentUser: { id, name, email }"]
    CreateSession --> SaveStorage["localStorage.setItem('sample-review-user', JSON.stringify(currentUser))"]
    SaveStorage --> ResetForm["elements.loginForm.reset()"]
    ResetForm --> UpdateUI["renderAccount():
    - Ẩn form đăng nhập
    - Hiện khối chào mừng: 'Xin chào, [Tên]!' và nút Đăng xuất
    - Hiện form gửi đánh giá (Mở khoá #review-form)
    - Ẩn dòng nhắc nhở 'Vui lòng đăng nhập'"]
```

---

## 4. WORKFLOW 3: QUY TRÌNH GỬI ĐÁNH GIÁ 5 SAO & BÌNH LUẬN (REVIEW SUBMISSION FLOW)

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng đã đăng nhập
    participant Form as Form Đánh giá (#review-form)
    participant Logic as app.js
    participant API as json-server (/reviews)
    participant UI as Danh sách nhận xét (#reviews-list)

    User->>Form: Chọn số sao (Radio rating: 1 - 5 sao)
    User->>Form: Nhập nội dung bình luận vào #review-comment
    User->>Form: Bấm nút "Gửi đánh giá" (#review-submit)

    Form->>Logic: Bắt sự kiện submit
    Logic->>Logic: Kiểm tra hợp lệ: rating trong [1, 5] & comment không rỗng
    Logic->>Form: reviewSubmit.disabled = true (Khoá nút tránh bấm nhiều lần)

    Logic->>API: Gửi POST /reviews kèm payload:
    Note over Logic,API: { productId, userId, userName, rating, comment, createdAt }
    API-->>Logic: Phản hồi HTTP 201 Created (Bản ghi đã lưu vào db.json)

    Logic->>Form: reviewForm.reset() & Hiển thị thông báo "Đã gửi đánh giá thành công!"
    Logic->>API: Gọi lại loadPageData() để tải danh sách mới nhất
    API-->>Logic: Trả về danh sách reviews đã bao gồm bình luận mới
    Logic->>UI: Cập nhật lại điểm sao trung bình của sản phẩm
    Logic->>UI: Thêm nhận xét mới lên đầu danh sách
    Logic->>Form: reviewSubmit.disabled = false (Mở lại nút)
```

---

## 5. WORKFLOW 4: QUY TRÌNH ĐĂNG XUẤT (LOGOUT FLOW)

```mermaid
flowchart LR
    ClickLogout["Người dùng bấm nút 'Đăng xuất' (#logout-button)"] --> ClearState["Gán currentUser = null"]
    ClearState --> RemoveStorage["localStorage.removeItem('sample-review-user')"]
    RemoveStorage --> ClearMsg["Xoá các thông báo lỗi cũ"]
    ClearMsg --> ReRender["renderAccount():
    - Ẩn khối phiên đăng nhập
    - Hiện lại form đăng nhập
    - Ẩn form gửi đánh giá
    - Hiện lại dòng nhắc 'Vui lòng đăng nhập trước khi gửi nhận xét'"]
```

---

## 6. BẢNG TỔNG HỢP ÁNH XẠ GIỮA LUỒNG NGHIỆP VỤ VÀ MÃ NGUỒN `app.js`

| Luồng nghiệp vụ | Hàm / Biến trong mã `app.js` | Cơ chế kỹ thuật |
|---|---|---|
| **Đọc phiên khi mở trang** | `readSavedUser()` | `localStorage.getItem("sample-review-user")` + `JSON.parse` có bọc `try/catch`. |
| **Bảo vệ chống XSS** | `escapeHTML(value)` | Thay thế các ký tự nguy hiểm `&`, `<`, `>`, `"`, `'` thành HTML entities tương ứng. |
| **Định dạng tiền tệ** | `formatPrice(price)` | `Intl.NumberFormat("vi-VN")` ➔ Thêm đuôi `" đ"`. |
| **Định dạng ngày giờ** | `formatDate(dateString)` | `Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" })`. |
| **Tải dữ liệu song song** | `loadPageData()` | `Promise.all([api.get("/products/1"), api.get("/reviews")])`. |
| **Tính sao trung bình** | `renderProduct()` | `reviews.reduce(...) / reviews.length` ➔ hiển thị với `toFixed(1)`. |
| **Chuyển đổi giao diện Auth** | `renderAccount()` | Thay đổi thuộc tính `.hidden` của `#login-form` và `#review-form`. |
| **Vẽ danh sách bình luận** | `renderReviews()` | Dùng `Array.map` tạo chuỗi HTML, lặp ký tự `"★"` và `"☆"`. |
| **Gửi đánh giá lên máy chủ** | `reviewForm.addEventListener` | `new FormData()`, gọi `api.post("/reviews")` với `createdAt: new Date().toISOString()`. |

---
*Tài liệu workflow mẫu hoàn chỉnh cho tệp mã nguồn app.js và giao diện sample_review.html.*


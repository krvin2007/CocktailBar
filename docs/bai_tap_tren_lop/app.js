// Cấu hình định danh sản phẩm mẫu và địa chỉ API cùng origin với trang web.
const PRODUCT_ID = 1;
const api = axios.create({ baseURL: "/" });

// Lưu trạng thái đăng nhập ở trình duyệt; đây chỉ là phiên mẫu, không thay thế xác thực phía máy chủ.
const elements = {
  productImage: document.querySelector("#product-image"),
  productName: document.querySelector("#product-name"),
  productDescription: document.querySelector("#product-description"),
  productPrice: document.querySelector("#product-price"),
  productRating: document.querySelector("#product-rating"),
  loginForm: document.querySelector("#login-form"),
  loginEmail: document.querySelector("#login-email"),
  loginPassword: document.querySelector("#login-password"),
  accountSession: document.querySelector("#account-session"),
  welcomeMessage: document.querySelector("#welcome-message"),
  logoutButton: document.querySelector("#logout-button"),
  accountMessage: document.querySelector("#account-message"),
  reviewForm: document.querySelector("#review-form"),
  reviewLoginHint: document.querySelector("#review-login-hint"),
  reviewComment: document.querySelector("#review-comment"),
  reviewSubmit: document.querySelector("#review-submit"),
  reviewMessage: document.querySelector("#review-message"),
  reviewCount: document.querySelector("#review-count"),
  reviewsList: document.querySelector("#reviews-list"),
};

let currentUser = readSavedUser();
let product = null;

// Đọc phiên đăng nhập mà không lưu mật khẩu và thông báo cho người dùng nếu dữ liệu trình duyệt bị hỏng.
function readSavedUser() {
  const savedUser = localStorage.getItem("sample-review-user");
  if (!savedUser) return null;

  try {
    const user = JSON.parse(savedUser);
    if (user && Number.isInteger(user.id) && typeof user.name === "string") {
      return user;
    }
  } catch (error) {
    console.error("Không thể đọc phiên đăng nhập đã lưu:", error);
    elements.accountMessage.textContent = "Phiên đăng nhập bị lỗi. Vui lòng đăng nhập lại.";
  }

  localStorage.removeItem("sample-review-user");
  return null;
}

// Chèn dữ liệu từ JSON vào HTML an toàn, tránh diễn giải tên/bình luận thành mã HTML.
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

// Định dạng giá theo tiền Việt và ngày giờ theo ngôn ngữ tiếng Việt.
function formatPrice(price) {
  return new Intl.NumberFormat("vi-VN").format(Number(price)) + " đ";
}

function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Vừa xong";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

// Tải sản phẩm và các nhận xét hiện có từ JSON Server.
async function loadPageData() {
  try {
    const [productResponse, reviewsResponse] = await Promise.all([
      api.get(`/products/${PRODUCT_ID}`),
      api.get("/reviews", {
        params: {
          productId: PRODUCT_ID,
          _sort: "createdAt",
          _order: "desc",
        },
      }),
    ]);

    product = productResponse.data;
    renderProduct(product, reviewsResponse.data);
    renderReviews(reviewsResponse.data);
  } catch (error) {
    console.error("Không thể tải dữ liệu sản phẩm:", error);
    elements.productName.textContent = "Không tải được sản phẩm";
    elements.reviewsList.innerHTML =
      '<p class="muted">Không thể tải dữ liệu. Hãy kiểm tra JSON Server đang chạy.</p>';
  }
}

// Hiển thị sản phẩm; khi chưa có đánh giá mới, điểm số dùng rating trong db.json.
function renderProduct(productData, reviews) {
  elements.productName.textContent = productData.name;
  elements.productDescription.textContent = productData.description;
  elements.productPrice.textContent = formatPrice(productData.price);
  elements.productImage.src = productData.image;
  elements.productImage.alt = productData.name;

  // PHẦN RATING: tính điểm trung bình từ nhận xét mới; nếu chưa có thì dùng rating gốc trong db.json.
  const reviewAverage = reviews.length
    ? reviews.reduce((total, review) => total + Number(review.rating), 0) / reviews.length
    : Number(productData.rating);
  elements.productRating.textContent =
    `★ ${reviewAverage.toFixed(1)} · ${reviews.length} đánh giá mới`;
}

// Chuyển phần giao diện đăng nhập và form đánh giá theo trạng thái người dùng.
function renderAccount() {
  const isLoggedIn = Boolean(currentUser);
  elements.loginForm.hidden = isLoggedIn;
  elements.accountSession.hidden = !isLoggedIn;
  elements.reviewForm.hidden = !isLoggedIn;
  elements.reviewLoginHint.hidden = isLoggedIn;

  if (isLoggedIn) {
    elements.welcomeMessage.textContent = `Xin chào, ${currentUser.name}!`;
  }
}

// Vẽ các nhận xét và số lượng sao; escapeHTML bảo vệ nội dung do người dùng nhập.
function renderReviews(reviews) {
  elements.reviewCount.textContent = `${reviews.length} nhận xét`;

  if (!reviews.length) {
    elements.reviewsList.innerHTML =
      '<p class="muted">Chưa có nhận xét nào. Hãy là người đầu tiên đánh giá nhé!</p>';
    return;
  }

  elements.reviewsList.innerHTML = reviews
    .map((review) => {
      // PHẦN RATING: đổi số sao trong dữ liệu thành chuỗi sao để hiển thị.
      const rating = Math.min(5, Math.max(1, Number(review.rating)));
      const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
      // PHẦN COMMENT: đưa tên, nội dung và ngày viết nhận xét ra danh sách.
      return `
        <article class="review-item">
          <div class="review-item-header">
            <p class="review-author">${escapeHTML(review.userName)}</p>
            <span class="review-stars" aria-label="${rating} trên 5 sao">${stars}</span>
          </div>
          <p class="review-comment">${escapeHTML(review.comment)}</p>
          <time class="review-date" datetime="${escapeHTML(review.createdAt)}">
            ${escapeHTML(formatDate(review.createdAt))}
          </time>
        </article>
      `;
    })
    .join("");
}

// Đăng nhập bằng email và mật khẩu mẫu trong collection user của db.json.
elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.accountMessage.textContent = "";

  const email = elements.loginEmail.value.trim();
  const password = elements.loginPassword.value;

  try {
    let users = [];
    try {
      const response = await api.get("/user", { params: { email } });
      users = Array.isArray(response.data) ? response.data : [response.data];
    } catch {
      const response = await api.get("/users", { params: { email } });
      users = Array.isArray(response.data) ? response.data : [response.data];
    }
    const matchedUser = users.find((user) => user && user.password === password);

    if (!matchedUser) {
      elements.accountMessage.textContent = "Email hoặc mật khẩu không đúng.";
      return;
    }

    currentUser = { id: matchedUser.id, name: matchedUser.name, email: matchedUser.email };
    localStorage.setItem("sample-review-user", JSON.stringify(currentUser));
    elements.loginForm.reset();
    renderAccount();
  } catch (error) {
    console.error("Đăng nhập thất bại:", error);
    elements.accountMessage.textContent = "Không thể đăng nhập. Hãy kiểm tra JSON Server.";
  }
});

// Đăng xuất khỏi giao diện mẫu và xóa thông tin phiên đã lưu.
elements.logoutButton.addEventListener("click", () => {
  currentUser = null;
  localStorage.removeItem("sample-review-user");
  elements.accountMessage.textContent = "";
  elements.reviewMessage.textContent = "";
  renderAccount();
});

// Gửi điểm sao và bình luận lên collection reviews để JSON Server ghi vào db.json.
elements.reviewForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.reviewMessage.textContent = "";

  if (!currentUser || !product) {
    elements.reviewMessage.textContent = "Vui lòng đăng nhập trước khi gửi đánh giá.";
    return;
  }

  // PHẦN RATING: lấy lựa chọn 1-5 sao từ các radio name="rating" trong index.html.
  const formData = new FormData(elements.reviewForm);
  const rating = Number(formData.get("rating"));
  // PHẦN COMMENT: lấy nội dung đã nhập trong ô #review-comment.
  const comment = elements.reviewComment.value.trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !comment) {
    elements.reviewMessage.textContent = "Hãy chọn số sao và nhập bình luận.";
    return;
  }

  elements.reviewSubmit.disabled = true;
  try {
    // Lưu rating và comment cùng thông tin người dùng/sản phẩm vào collection reviews.
    await api.post("/reviews", {
      productId: PRODUCT_ID,
      userId: currentUser.id,
      userName: currentUser.name,
      rating,
      comment,
      createdAt: new Date().toISOString(),
    });

    elements.reviewForm.reset();
    elements.reviewMessage.textContent = "Đã gửi đánh giá thành công!";
    await loadPageData();
  } catch (error) {
    console.error("Không thể gửi đánh giá:", error);
    elements.reviewMessage.textContent = "Gửi đánh giá thất bại. Hãy thử lại.";
  } finally {
    elements.reviewSubmit.disabled = false;
  }
});

// Khởi tạo giao diện, khôi phục phiên mẫu và tải sản phẩm cùng danh sách nhận xét.
renderAccount();
loadPageData();
/**
 * =============================================================================
 * GHI CHÚ BÀI GIẢNG: QUY TRÌNH PHÁT TRIỂN PHẦN MỀM & PHÂN TÍCH YÊU CẦU
 * =============================================================================
 *
 * TRÌNH TỰ 8 BƯỚC PHÁT TRIỂN WEB APPLICATION:
 * 1. Phân tích yêu cầu (Requirements Analysis)
 * 2. Xác định chức năng (Feature Identification)
 * 3. Vẽ workflow cho từng chức năng (Workflow Diagram)
 * 4. Thiết kế kiến trúc phần mềm (Software Architecture Design)
 * 5. Thiết kế database (Database Design & ERD)
 * 6. Thiết kế API (RESTful API Design)
 * 7. Lập trình Frontend và Backend (Implementation)
 * 8. Kiểm thử (Testing & QA)
 *
 * MARKDOWN LÀ GÌ?
 * Markdown là một ngôn ngữ đánh dấu (Markup Language) đơn giản, dễ đọc và dễ viết,
 * thường được sử dụng để tạo tài liệu kỹ thuật, ghi chú, blog, README file, v.v.
 * Nó cho phép người dùng định dạng văn bản bằng cách sử dụng các ký tự đặc biệt
 * như #, *, -, >, [link](url)... để tạo tiêu đề, danh sách, liên kết, hình ảnh, trích dẫn.
 *
 * BỘ HỒ SƠ 5 FILE BÀI TẬP:
 * 1. README.md: Giới thiệu đề tài
 * 2. workflow.md: Vẽ workflow cho từng chức năng
 * 3. database.md: Thiết kế database
 * 4. API_Document.md: Thiết kế API
 * 5. software_architecture_design.md: Thiết kế kiến trúc phần mềm
 *
 * -----------------------------------------------------------------------------
 * CHI TIẾT GIAI ĐOẠN 1: PHÂN TÍCH YÊU CẦU (REQUIREMENTS ANALYSIS)
 * -----------------------------------------------------------------------------
 * Là quá trình thu thập, phân tích và xác định các yêu cầu mà hệ thống phần mềm cần đáp ứng.
 *
 * Ví dụ thực tế: Khách hàng yêu cầu xây dựng website bán hàng / quán bar.
 * Lập trình viên / BA cần tìm hiểu những gì?
 * + Website có những chức năng gì?
 * + Ai sử dụng website? (Khách hàng, nhân viên thu ngân, pha chế, phục vụ, quản trị viên?)
 * + Khách hàng có thể xem sản phẩm, đặt hàng, thanh toán, đánh giá sản phẩm như thế nào?
 * + Khách hàng có được đặt hàng không cần đăng nhập không? Có cần xác thực email không?
 * + Nhân viên có thể quản lý sản phẩm, đơn hàng, khách hàng, duyệt đánh giá không?
 * + Quản trị viên quản lý nhân sự, phân quyền như thế nào?
 * + Có thanh toán trực tuyến không? Có tích hợp cổng VietQR / ngân hàng không?
 * + Có cần tích hợp dịch vụ vận chuyển, dịch vụ marketing không?
 * + Có cần tích hợp báo cáo, thống kê doanh thu ra Excel / PDF không?
 * + Có tích hợp AI không? (Ví dụ: Chatbot tư vấn đồ uống, gợi ý sản phẩm, phân tích dữ liệu?)
 * + Cần những biểu mẫu (Forms) nào?
 *
 * PHÂN LOẠI YÊU CẦU (2 NHÓM CHÍNH):
 * 1. Yêu cầu chức năng (Functional Requirements):
 *    Mô tả các hành vi, chức năng cụ thể mà hệ thống PHẢI LÀM ĐƯỢC.
 *    Ví dụ:
 *    - Đăng ký, đăng nhập, đăng xuất tài khoản.
 *    - Xem thông tin cá nhân và lịch sử đặt bàn.
 *    - Quản lý danh mục sản phẩm (thêm, sửa, xoá).
 *    - Tìm kiếm và lọc sản phẩm đa tiêu chí.
 *    - Thêm sản phẩm vào giỏ hàng.
 *    - Đặt bàn, áp dụng mã voucher và thanh toán quét mã QR.
 *    - Gửi đánh giá sao và bình luận cho món.
 *
 * 2. Yêu cầu phi chức năng (Non-functional Requirements):
 *    Mô tả các thuộc tính, tiêu chí chất lượng mà hệ thống CẦN ĐÁP ỨNG.
 *    Ví dụ:
 *    - Hiệu suất: Tốc độ tải trang nhanh, phản hồi < 100ms.
 *    - Bảo mật: Bảo mật thông tin người dùng, lọc mã độc XSS (escapeHTML).
 *    - Mã hóa: Dữ liệu truyền qua mạng được mã hóa HTTPS.
 *    - Khả năng mở rộng: Hệ thống chịu tải tốt khi lượng người dùng tăng.
 *    - Khả năng sử dụng: Giao diện trực quan, thân thiện (UI/UX).
 *    - Tính tương thích: Hỗ trợ đa thiết bị (Máy tính, Điện thoại, Tablet) và đa trình duyệt.
 *
 * SẢN PHẨM TẠO RA SAU KHI PHÂN TÍCH YÊU CẦU:
 * 1. SRS (Software Requirements Specification): Tài liệu đặc tả yêu cầu phần mềm chi tiết.
 * 2. Use Case Diagram: Sơ đồ ca sử dụng mô tả các tác nhân (Actors) và hành động (Use cases).
 * 3. Use Case Description: Bản mô tả chi tiết từng Use Case (Tiền điều kiện, luồng chính, luồng thay thế).
 * 4. User Story: Câu chuyện người dùng ("Với tư cách là [Ai], tôi muốn [Làm gì], để [Đạt được gì]").
 * 5. Acceptance Criteria: Tiêu chí chấp nhận để nghiệm thu một chức năng đã hoàn thành.
 *
 * VẼ WORKFLOW KHI NÀO?
 * - Vẽ workflow khi đã hiểu rõ yêu cầu chức năng và phi chức năng của hệ thống.
 * - Mục đích: Mô tả trực quan các bước, luồng công việc hoặc quy trình nghiệp vụ
 *   để người dùng và hệ thống phối hợp đạt được mục tiêu cụ thể.
 * - Giúp lập trình viên, thiết kế và khách hàng hiểu rõ ràng cách hệ thống hoạt động,
 *   phát hiện sớm các điểm nghẽn nghiệp vụ và tối ưu hóa trải nghiệm người dùng.
 */
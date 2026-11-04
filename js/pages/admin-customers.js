/* =========================================================
   ADMIN-CUSTOMERS.JS - Danh sách khách hàng thành viên: hạng, điểm, chi tiêu
   Đọc GET /customers + GET /orders (Promise.all). Chỉ XEM - điểm do hệ thống tự cộng khi
   đơn Hoàn tất (ordersService.updateOrderStatus), không sửa tay để sổ điểm luôn khớp đơn hàng.
   ========================================================= */

import { initAdminLayout } from "../modules/adminLayout.js";
import { getAllCustomers, MEMBER_RANKS, rankForPoints, lifetimeOf, updateCustomerStatus, updateCustomerDiscount, adminResetCustomerPassword, updateCustomerAvatar } from "../modules/customerAuth.js";
import { getAllOrders } from "../modules/ordersService.js";
import { normalizePhone, formatMoney, formatDate, formatDateTime, debounce, paginate, renderPagination, escapeHtml } from "../modules/utils.js";
import { openModal, closeModal, toast, confirmDialog } from "../modules/ui.js";
import { ICONS } from "../modules/icons.js";

const bodyEl = document.getElementById("customers-body");
const paginationEl = document.getElementById("pagination");
const keywordInput = document.getElementById("f-keyword");
const rankSelect = document.getElementById("f-rank");
const sortSelect = document.getElementById("f-sort");

let rows = [];
let currentPage = 1;

const rankBadge = (rank) => `<span class="rank-badge" style="--rank-color: ${rank.color}">${escapeHtml(rank.label)}</span>`;

/** Gắn thống kê đơn vào từng khách: khớp theo customerId hoặc số điện thoại, chỉ tính đơn Hoàn tất */
function buildRows(customers, orders) {
  const completed = orders.filter((o) => o.status === "completed");
  return customers.map((customer) => {
    const phone = normalizePhone(customer.phone);
    const mine = completed.filter((o) => o.customerId === customer.id || (phone && normalizePhone(o.phone) === phone));
    return {
      customer,
      rank: rankForPoints(lifetimeOf(customer)),
      orderCount: mine.length,
      spent: mine.reduce((sum, o) => sum + o.total, 0),
    };
  });
}

function filtered() {
  const kw = keywordInput.value.trim().toLowerCase();
  let list = rows.filter(({ customer, rank }) => {
    if (rankSelect.value !== "all" && rank.key !== rankSelect.value) return false;
    if (!kw) return true;
    return [customer.name, customer.phone, customer.email].some((v) => String(v || "").toLowerCase().includes(kw));
  });
  const sorters = {
    "points-desc": (a, b) => (b.customer.points || 0) - (a.customer.points || 0),
    "spent-desc": (a, b) => b.spent - a.spent,
    newest: (a, b) => new Date(b.customer.createdAt || 0) - new Date(a.customer.createdAt || 0),
    "name-asc": (a, b) => String(a.customer.name).localeCompare(String(b.customer.name), "vi"),
  };
  list = [...list].sort(sorters[sortSelect.value] || sorters["points-desc"]);
  return list;
}

function rowHtml({ customer, rank, orderCount, spent }) {
  const isBanned = customer.status === "inactive" || customer.status === "banned";
  const statusBadge = isBanned
    ? `<span class="badge badge-danger" title="${escapeHtml(customer.banReason || "Tạm khóa do vi phạm 18+")}">🚫 Tạm khóa</span>`
    : `<span class="badge badge-success">✅ Hoạt động (Đủ 18+)</span>`;

  const customDiscount = Number(customer.customDiscount) || 0;
  const discountBadge = customDiscount > 0
    ? `<div style="margin-top: 4px;"><span class="badge badge-warning" title="${escapeHtml(customer.discountNote || "Admin giảm giá riêng")}">${ICONS.sparkle(12)} Admin -${customDiscount}%</span></div>`
    : "";

  const avatarHtml = customer.avatar
    ? `<img src="${escapeHtml(customer.avatar)}" alt="${escapeHtml(customer.name)}" class="admin-cust-avatar" data-action="avatar" title="Bấm để quản lý ảnh đại diện">`
    : `<div class="admin-cust-avatar-fallback" data-action="avatar" title="Bấm để tải ảnh đại diện lên">${escapeHtml((customer.name || "K").charAt(0).toUpperCase())}</div>`;

  return `
    <tr data-id="${escapeHtml(customer.id)}">
      <td>
        <div style="display: flex; align-items: center; gap: 10px;">
          ${avatarHtml}
          <div>
            <strong>${escapeHtml(customer.name)}</strong>
            <div class="text-xs text-muted">${customer.createdAt ? `Tham gia ${formatDate(customer.createdAt)}` : ""}</div>
          </div>
        </div>
      </td>
      <td class="text-sm">${escapeHtml(customer.phone || "")}${customer.email ? `<div class="text-xs text-muted">${escapeHtml(customer.email)}</div>` : ""}</td>
      <td>
        ${rankBadge(rank)}
        ${discountBadge}
      </td>
      <td><strong>${Number(customer.points) || 0}</strong></td>
      <td>${orderCount}</td>
      <td><strong>${formatMoney(spent)}</strong></td>
      <td>${statusBadge}</td>
      <td class="cell-actions" style="text-align: right; display: flex; gap: 5px; justify-content: flex-end; align-items: center; flex-wrap: nowrap;">
        <button type="button" class="btn btn-ghost btn-sm" data-action="reset-pass" title="Đặt lại mật khẩu cho khách hàng này">🔑 Đặt lại MK</button>
        <button type="button" class="btn btn-ghost btn-sm" data-action="avatar" title="Cập nhật hoặc gỡ ảnh đại diện">📷 Ảnh</button>
        <button type="button" class="btn btn-ghost btn-sm" data-action="discount" title="Cấp chiết khấu ưu đãi riêng cho khách này">${ICONS.sparkle(14)} Giảm giá</button>
        ${isBanned
          ? `<button type="button" class="btn btn-ghost btn-sm text-success" data-action="unlock">Mở khóa</button>`
          : `<button type="button" class="btn btn-ghost btn-sm text-danger" data-action="lock" title="Khóa tài khoản do vi phạm độ tuổi 18+ hoặc khai gian">Khóa</button>`}
        <button type="button" class="btn btn-ghost btn-sm" data-action="history">Điểm</button>
      </td>
    </tr>`;
}

function renderTable() {
  const list = filtered();
  const { items, page, totalPages } = paginate(list, currentPage, 8);
  currentPage = page;
  bodyEl.innerHTML = items.length ? items.map(rowHtml).join("")
    : `<tr><td colspan="8" class="table-empty py-4 text-center text-muted">${rows.length ? "Không có khách phù hợp với bộ lọc." : "Chưa có khách hàng thành viên nào."}</td></tr>`;
  renderPagination(paginationEl, page, totalPages, (p) => { currentPage = p; renderTable(); });
}

/** Nội dung một dòng lịch sử điểm theo loại giao dịch */
function historyLabel(e) {
  if (e.type === "order") return `Đơn ${escapeHtml(e.orderCode || "")} · ${formatMoney(e.total || 0)}`;
  if (e.type === "redeem") return `Dùng điểm giảm giá cho đơn ${escapeHtml(e.orderCode || "")}`;
  if (e.type === "refund") return `Hoàn điểm do đơn ${escapeHtml(e.orderCode || "")} bị huỷ`;
  if (e.type === "welcome") return "Điểm chào mừng thành viên mới";
  return "Điểm có sẵn từ trước";
}

function openHistory({ customer, rank }) {
  const entries = [...(Array.isArray(customer.pointHistory) ? customer.pointHistory : [])].sort((a, b) => new Date(b.at) - new Date(a.at));
  const recorded = entries.reduce((sum, e) => sum + (Number(e.points) || 0), 0);
  const baseline = (Number(customer.points) || 0) - recorded;
  const line = (e) => `
    <tr>
      <td class="text-sm">${e.at ? formatDateTime(e.at) : "—"}</td>
      <td class="text-sm">${historyLabel(e)}</td>
      <td class="${Number(e.points) < 0 ? "account-points-minus" : "account-points-plus"}">${Number(e.points) < 0 ? "−" : "+"}${Math.abs(Number(e.points) || 0)}</td>
    </tr>`;
  const all = baseline > 0 ? [...entries.map(line), line({ type: "opening", points: baseline, at: customer.createdAt })] : entries.map(line);

  document.getElementById("customer-modal-title").textContent = `${customer.name} — ${rank.label} · ${customer.points || 0} điểm`;
  document.getElementById("customer-modal-body").innerHTML = all.length
    ? `<table class="data-table"><thead><tr><th>Thời gian</th><th>Nội dung</th><th>Điểm</th></tr></thead><tbody>${all.join("")}</tbody></table>`
    : `<p class="text-muted">Chưa có điểm nào được ghi nhận.</p>`;
  openModal("customer-modal");
}

async function reload() {
  try {
    const [customers, orders] = await Promise.all([getAllCustomers(), getAllOrders()]);
    rows = buildRows(customers, orders);
    renderTable();
  } catch (err) {
    bodyEl.innerHTML = `<tr><td colspan="8" class="table-empty py-4 text-center text-muted">${escapeHtml(err.message)}</td></tr>`;
  }
}

function openDiscountModal(customer) {
  const customDiscount = Number(customer.customDiscount) || 0;
  document.getElementById("discount-form-id").value = customer.id;
  document.getElementById("discount-form-percent").value = customDiscount || "";
  document.getElementById("discount-form-note").value = customer.discountNote || "";
  document.getElementById("discount-modal-title").innerHTML = `${ICONS.sparkle(18)} Chiết Khấu Ưu Đãi: ${escapeHtml(customer.name)}`;
  const rank = rankForPoints(lifetimeOf(customer));
  document.getElementById("discount-modal-subtitle").textContent = `SĐT: ${customer.phone} · Hạng hiện tại: ${rank.label} (Giảm mặc định: ${rank.discountPercent}%)`;
  openModal("discount-modal");
}

function openAdminResetPassModal(customer) {
  document.getElementById("admin-reset-cust-id").value = customer.id;
  document.getElementById("admin-reset-pass-input").value = "Khach@123";
  document.getElementById("admin-reset-pass-input").type = "password";
  document.getElementById("admin-reset-modal-title").innerHTML = `🔑 Đặt Lại Mật Khẩu: ${escapeHtml(customer.name)}`;
  document.getElementById("admin-reset-modal-subtitle").textContent = `SĐT: ${customer.phone || "—"} · Email: ${customer.email || "—"}`;
  openModal("admin-reset-pass-modal");
}

let activeAvatarCustomer = null;

function openAdminAvatarModal(customer) {
  activeAvatarCustomer = customer;
  document.getElementById("admin-avatar-cust-id").value = customer.id;
  document.getElementById("admin-avatar-modal-title").innerHTML = `📷 Quản Lý Ảnh: ${escapeHtml(customer.name)}`;
  document.getElementById("admin-avatar-modal-subtitle").textContent = `SĐT: ${customer.phone || "—"}`;

  const imgEl = document.getElementById("admin-avatar-preview-img");
  const fallbackEl = document.getElementById("admin-avatar-preview-fallback");
  const removeBtn = document.getElementById("admin-avatar-btn-remove");

  if (customer.avatar) {
    imgEl.src = customer.avatar;
    imgEl.style.display = "block";
    fallbackEl.style.display = "none";
    if (removeBtn) removeBtn.style.display = "inline-flex";
  } else {
    imgEl.src = "";
    imgEl.style.display = "none";
    fallbackEl.textContent = (customer.name || "K").charAt(0).toUpperCase();
    fallbackEl.style.display = "block";
    if (removeBtn) removeBtn.style.display = "none";
  }

  openModal("admin-avatar-modal");
}

bodyEl.addEventListener("click", async (e) => {
  const resetPassBtn = e.target.closest('button[data-action="reset-pass"]');
  if (resetPassBtn) {
    const row = rows.find((r) => r.customer.id === resetPassBtn.closest("tr").dataset.id);
    if (row) openAdminResetPassModal(row.customer);
    return;
  }

  const avatarTarget = e.target.closest('[data-action="avatar"]');
  if (avatarTarget) {
    const row = rows.find((r) => r.customer.id === avatarTarget.closest("tr").dataset.id);
    if (row) openAdminAvatarModal(row.customer);
    return;
  }

  const discountBtn = e.target.closest('button[data-action="discount"]');
  if (discountBtn) {
    const row = rows.find((r) => r.customer.id === discountBtn.closest("tr").dataset.id);
    if (row) openDiscountModal(row.customer);
    return;
  }

  const lockBtn = e.target.closest('button[data-action="lock"]');
  if (lockBtn) {
    const row = rows.find((r) => r.customer.id === lockBtn.closest("tr").dataset.id);
    if (!row) return;
    const ok = await confirmDialog(
      `Bạn có chắc muốn TẠM KHÓA tài khoản của ${row.customer.name}?\n\n• Lý do: Vi phạm quy định độ tuổi 18+ hoặc cung cấp thông tin sai lệch khi đến quán.\n• Khách sẽ bị từ chối đăng nhập và không thể đặt bàn nữa.`,
      { title: "Khóa tài khoản vi phạm 18+", okText: "Khóa tài khoản" }
    );
    if (!ok) return;
    try {
      await updateCustomerStatus(row.customer.id, "inactive", "Tài khoản bị tạm khóa do vi phạm quy định độ tuổi 18+ hoặc khai gian thông tin.");
      toast(`Đã tạm khóa tài khoản của ${row.customer.name}.`, "warning");
      await reload();
    } catch (err) {
      toast(err.message, "error");
    }
    return;
  }

  const unlockBtn = e.target.closest('button[data-action="unlock"]');
  if (unlockBtn) {
    const row = rows.find((r) => r.customer.id === unlockBtn.closest("tr").dataset.id);
    if (!row) return;
    const ok = await confirmDialog(
      `Mở khóa tài khoản cho ${row.customer.name}? Khách hàng sẽ có thể đăng nhập và đặt bàn bình thường.`,
      { title: "Mở khóa tài khoản", okText: "Mở khóa" }
    );
    if (!ok) return;
    try {
      await updateCustomerStatus(row.customer.id, "active", "");
      toast(`Đã mở khóa tài khoản của ${row.customer.name}.`, "success");
      await reload();
    } catch (err) {
      toast(err.message, "error");
    }
    return;
  }

  const historyBtn = e.target.closest('button[data-action="history"]');
  if (historyBtn) {
    const row = rows.find((r) => r.customer.id === historyBtn.closest("tr").dataset.id);
    if (row) openHistory(row);
  }
});

if (initAdminLayout("Khách Hàng Thành Viên")) {
  MEMBER_RANKS.forEach((rank) => rankSelect.insertAdjacentHTML("beforeend", `<option value="${rank.key}">${escapeHtml(rank.label)}</option>`));
  const debounced = debounce(() => { currentPage = 1; renderTable(); }, 250);
  keywordInput.addEventListener("input", debounced);
  [rankSelect, sortSelect].forEach((el) => el.addEventListener("change", () => { currentPage = 1; renderTable(); }));
  document.getElementById("customer-modal-close").addEventListener("click", () => closeModal("customer-modal"));
  document.getElementById("discount-modal-close")?.addEventListener("click", () => closeModal("discount-modal"));
  document.getElementById("discount-modal-cancel")?.addEventListener("click", () => closeModal("discount-modal"));

  // Đóng modal Reset Pass và Avatar
  document.getElementById("admin-reset-modal-close")?.addEventListener("click", () => closeModal("admin-reset-pass-modal"));
  document.getElementById("admin-reset-modal-cancel")?.addEventListener("click", () => closeModal("admin-reset-pass-modal"));
  document.getElementById("admin-avatar-modal-close")?.addEventListener("click", () => closeModal("admin-avatar-modal"));
  document.getElementById("admin-avatar-modal-cancel")?.addEventListener("click", () => closeModal("admin-avatar-modal"));

  // Nút tạo mật khẩu ngẫu nhiên cho admin
  document.getElementById("admin-reset-btn-random")?.addEventListener("click", () => {
    const randomPass = `Khach@${Math.floor(1000 + Math.random() * 9000)}`;
    const passInput = document.getElementById("admin-reset-pass-input");
    passInput.value = randomPass;
    passInput.type = "text";
  });

  // Toggle ẩn/hiện mật khẩu
  document.querySelectorAll(".pw-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (input) {
        input.type = input.type === "password" ? "text" : "password";
      }
    });
  });

  // Submit đặt lại mật khẩu cho khách
  const adminResetForm = document.getElementById("admin-reset-form");
  adminResetForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const customerId = document.getElementById("admin-reset-cust-id").value;
    const newPass = document.getElementById("admin-reset-pass-input").value;

    try {
      await adminResetCustomerPassword(customerId, newPass);
      const row = rows.find((r) => r.customer.id === customerId);
      const custName = row?.customer?.name || "khách hàng";
      toast(`Đã đặt lại mật khẩu cho ${custName} thành công: "${newPass}"`, "success");
      closeModal("admin-reset-pass-modal");
      await reload();
    } catch (err) {
      toast(err.message, "error");
    }
  });

  // Upload avatar khách từ admin
  const avatarFileInput = document.getElementById("admin-avatar-file-input");
  avatarFileInput?.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file || !activeAvatarCustomer) return;

    if (!file.type.startsWith("image/")) {
      toast("Vui lòng chọn file hình ảnh (PNG, JPG, WebP, GIF).", "warning");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast("Dung lượng ảnh tối đa là 2MB. Vui lòng chọn ảnh nhỏ hơn.", "warning");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      try {
        await updateCustomerAvatar(activeAvatarCustomer.id, dataUrl);
        toast(`Đã cập nhật ảnh đại diện cho ${activeAvatarCustomer.name}!`, "success");
        activeAvatarCustomer.avatar = dataUrl;
        openAdminAvatarModal(activeAvatarCustomer);
        await reload();
      } catch (err) {
        toast(err.message || "Không thể cập nhật ảnh đại diện.", "error");
      }
    };
    reader.readAsDataURL(file);
  });

  // Gỡ avatar khách từ admin
  document.getElementById("admin-avatar-btn-remove")?.addEventListener("click", async () => {
    if (!activeAvatarCustomer) return;
    const ok = await confirmDialog(`Bạn có chắc muốn gỡ ảnh đại diện của ${activeAvatarCustomer.name}?`, {
      title: "Gỡ ảnh đại diện",
      okText: "Gỡ ảnh",
    });
    if (!ok) return;

    try {
      await updateCustomerAvatar(activeAvatarCustomer.id, "");
      toast(`Đã gỡ ảnh đại diện của ${activeAvatarCustomer.name}.`, "info");
      activeAvatarCustomer.avatar = "";
      openAdminAvatarModal(activeAvatarCustomer);
      await reload();
    } catch (err) {
      toast(err.message || "Không thể gỡ ảnh đại diện.", "error");
    }
  });

  const discountForm = document.getElementById("discount-form");
  discountForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const customerId = document.getElementById("discount-form-id").value;
    const percent = Number(document.getElementById("discount-form-percent").value) || 0;
    const note = document.getElementById("discount-form-note").value.trim();

    try {
      await updateCustomerDiscount(customerId, percent, note);
      toast(percent > 0 ? `Đã thiết lập chiết khấu ${percent}% cho khách hàng!` : "Đã xoá chiết khấu riêng.", "success");
      closeModal("discount-modal");
      await reload();
    } catch (err) {
      toast(err.message, "error");
    }
  });

  document.getElementById("discount-btn-clear")?.addEventListener("click", async () => {
    const customerId = document.getElementById("discount-form-id").value;
    try {
      await updateCustomerDiscount(customerId, 0, "");
      toast("Đã xoá chiết khấu ưu đãi riêng, đưa về theo hạng.", "info");
      closeModal("discount-modal");
      await reload();
    } catch (err) {
      toast(err.message, "error");
    }
  });
  bodyEl.innerHTML = `<tr><td colspan="7" class="table-empty py-4 text-center text-muted">Đang tải danh sách khách hàng...</td></tr>`;
  reload();
}

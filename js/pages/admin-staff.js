/* =========================================================
   ADMIN-STAFF.JS - CRUD quản lý nhân viên (qua API /staff)
   Bao gồm quản lý tài khoản đăng nhập, cấp mật khẩu, khóa/mở khóa
   ========================================================= */

import { initAdminLayout } from "../modules/adminLayout.js";
import {
  getAllStaff, filterStaff, addStaff, updateStaff, deleteStaff,
  isPhoneTaken, isUsernameTaken, isEmailTaken, generateStaffCode,
  STAFF_ROLES, STAFF_SHIFTS,
} from "../modules/staffService.js";
import { formatDate, debounce, paginate, renderPagination, escapeHtml } from "../modules/utils.js";
import { validateForm, clearFormErrors, setFieldError } from "../modules/validation.js";
import { toast, confirmDialog, openModal, closeModal, setButtonLoading } from "../modules/ui.js";
import { ICONS } from "../modules/icons.js";

const bodyEl = document.getElementById("staff-body");
const paginationEl = document.getElementById("pagination");
const keywordInput = document.getElementById("f-keyword");
const roleFilter = document.getElementById("f-role");
const statusFilter = document.getElementById("f-status");

const formEl = document.getElementById("staff-form");
const formRoleSelect = document.getElementById("staff-form-role");
const formShiftSelect = document.getElementById("staff-form-shift");
const formCodeInput = document.getElementById("staff-form-code");
const formUsernameInput = document.getElementById("staff-form-username");
const formPasswordInput = document.getElementById("staff-form-password");
const formPasswordReq = document.getElementById("staff-password-req");
const formPasswordHint = document.getElementById("staff-password-hint");
const modalTitle = document.getElementById("staff-modal-title");
const submitBtn = document.getElementById("staff-form-submit");

/** Danh sách nhân viên tải từ API - tải lại sau mỗi lần thêm/sửa/xoá */
let allStaff = [];
let currentPage = 1;

function fillSelects() {
  Object.entries(STAFF_ROLES).forEach(([value, label]) => {
    roleFilter.insertAdjacentHTML("beforeend", `<option value="${value}">${label}</option>`);
    formRoleSelect.insertAdjacentHTML("beforeend", `<option value="${value}">${label}</option>`);
  });
  Object.entries(STAFF_SHIFTS).forEach(([value, label]) => {
    formShiftSelect.insertAdjacentHTML("beforeend", `<option value="${value}">${label}</option>`);
  });
}

function rowHtml(s) {
  return `
    <tr data-id="${escapeHtml(s.id)}">
      <td>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="badge badge-muted" style="font-family: monospace; font-size: 0.72rem;">${escapeHtml(s.displayStaffCode)}</span>
          <strong>${escapeHtml(s.name)}</strong>
        </div>
        ${s.email ? `<div class="text-xs text-muted" style="margin-top: 2px;">${escapeHtml(s.email)}</div>` : ""}
      </td>
      <td>
        ${s.username
    ? `<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.82rem; font-family: monospace; color: var(--amber-soft); background: rgba(197,152,67,0.1); padding: 2px 7px; border-radius: 4px; border: 1px solid rgba(197,152,67,0.25);">
               @${escapeHtml(s.username)}
             </span>`
    : '<span class="text-xs text-muted">Chưa cấp</span>'}
      </td>
      <td><span class="text-sm font-medium">${s.roleLabel}</span></td>
      <td><span class="text-sm text-muted">${s.shiftLabel}</span></td>
      <td><span class="text-sm">${escapeHtml(s.phone)}</span></td>
      <td class="text-sm text-muted">
        ${formatDate(s.startDate)}
        <div class="text-xs">Thâm niên: ${s.seniorityLabel}</div>
      </td>
      <td>
        <span class="badge ${s.isActive ? "badge-success" : "badge-muted"}">
          ${s.statusLabel}
        </span>
      </td>
      <td class="cell-actions" style="text-align: right; white-space: nowrap;">
        <button type="button" class="btn btn-ghost btn-sm" data-action="toggle-status" title="${s.isActive ? "Tạm khóa tài khoản" : "Kích hoạt lại tài khoản"}">
          ${s.isActive ? "Khóa" : "Mở"}
        </button>
        <button type="button" class="btn btn-ghost btn-sm" data-action="edit" title="Chỉnh sửa">${ICONS.edit(14)} Sửa</button>
        <button type="button" class="btn btn-danger btn-sm" data-action="delete" title="Xoá nhân sự">${ICONS.trash(14)} Xoá</button>
      </td>
    </tr>`;
}

function renderTable() {
  const list = filterStaff(allStaff, { keyword: keywordInput.value, role: roleFilter.value, status: statusFilter.value });
  const { items, page, totalPages } = paginate(list, currentPage, 8);
  currentPage = page;

  bodyEl.innerHTML = items.length
    ? items.map(rowHtml).join("")
    : `<tr><td colspan="8" class="table-empty py-4 text-center text-muted">
        ${allStaff.length ? "Không tìm thấy nhân viên phù hợp với bộ lọc." : "Chưa có nhân viên nào - bấm \"Thêm nhân sự mới\"."}
       </td></tr>`;

  renderPagination(paginationEl, page, totalPages, (p) => { currentPage = p; renderTable(); });
}

async function reloadTable() {
  try {
    allStaff = await getAllStaff();
    renderTable();
  } catch (err) {
    bodyEl.innerHTML = `<tr><td colspan="8" class="table-empty py-4 text-center text-muted">${escapeHtml(err.message)}</td></tr>`;
  }
}

function openForCreate() {
  formEl.reset();
  clearFormErrors(formEl);
  formEl.elements.id.value = "";
  formEl.elements.status.value = "active";
  if (formCodeInput) formCodeInput.value = generateStaffCode(allStaff);

  // Tạo mới -> Bắt buộc nhập mật khẩu an toàn
  if (formPasswordInput) {
    formPasswordInput.dataset.rule = "required|min:8|max:32";
    formPasswordInput.placeholder = "Tối thiểu 8 ký tự, gồm hoa, thường, số, ký tự đặc biệt";
  }
  if (formPasswordReq) formPasswordReq.hidden = false;
  if (formPasswordHint) formPasswordHint.textContent = "Mật khẩu tạo mới: Bắt buộc từ 8-32 ký tự, đủ hoa, thường, số, ký tự đặc biệt.";

  modalTitle.textContent = "Tiếp nhận nhân sự mới";
  openModal("staff-modal");
}

function openForEdit(staff) {
  formEl.reset();
  clearFormErrors(formEl);
  formEl.elements.id.value = staff.id;
  if (formCodeInput) formCodeInput.value = staff.displayStaffCode;
  formEl.elements.name.value = staff.name;
  if (formUsernameInput) formUsernameInput.value = staff.username || "";
  formEl.elements.role.value = staff.role;
  formEl.elements.shift.value = staff.shift;
  formEl.elements.phone.value = staff.phone;
  formEl.elements.email.value = staff.email || "";
  formEl.elements.startDate.value = staff.startDate;
  formEl.elements.status.value = staff.status;

  // Khi chỉnh sửa: mật khẩu không bắt buộc (chỉ nhập khi muốn đổi)
  if (formPasswordInput) {
    formPasswordInput.value = "";
    delete formPasswordInput.dataset.rule;
    formPasswordInput.placeholder = "Để trống nếu giữ nguyên mật khẩu cũ";
  }
  if (formPasswordReq) formPasswordReq.hidden = true;
  if (formPasswordHint) formPasswordHint.textContent = "Để trống nếu muốn giữ nguyên mật khẩu hiện tại của nhân viên.";

  modalTitle.textContent = `Hồ sơ nhân sự: ${staff.name} (${staff.displayStaffCode})`;
  openModal("staff-modal");
}

async function handleToggleStatus(staff) {
  const newStatus = staff.isActive ? "inactive" : "active";
  const actionText = staff.isActive ? "tạm khóa tài khoản & đình chỉ" : "kích hoạt lại tài khoản cho";

  const ok = await confirmDialog(`Xác nhận ${actionText} nhân viên "${staff.name}" (${staff.displayStaffCode})?`, {
    title: staff.isActive ? "Khóa tài khoản nhân sự" : "Mở khóa tài khoản",
    okText: "Xác nhận",
  });
  if (!ok) return;

  try {
    await updateStaff(staff.id, { status: newStatus });
    toast(`Đã ${staff.isActive ? "tạm khóa" : "kích hoạt"} tài khoản "${staff.name}".`, "success");
    await reloadTable();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function handleDelete(staff) {
  const ok = await confirmDialog(`Xác nhận xoá nhân viên "${staff.name}" (${staff.displayStaffCode}) khỏi danh sách nhân sự?`, {
    title: "Xoá hồ sơ nhân viên",
    okText: "Xác nhận xoá",
  });
  if (!ok) return;

  try {
    await deleteStaff(staff.id);
    toast(`Đã xoá nhân viên "${staff.name}".`, "success");
    await reloadTable();
  } catch (err) {
    toast(err.message, "error");
  }
}

bodyEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const staff = allStaff.find((s) => s.id === btn.closest("tr").dataset.id);
  if (!staff) return;

  if (btn.dataset.action === "edit") openForEdit(staff);
  if (btn.dataset.action === "delete") handleDelete(staff);
  if (btn.dataset.action === "toggle-status") handleToggleStatus(staff);
});

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();

  const { isValid, data } = validateForm(formEl);
  if (!isValid) return;

  const staffId = data.id || null;

  // 1. Kiểm tra trùng số điện thoại
  if (isPhoneTaken(allStaff, data.phone, staffId)) {
    setFieldError(formEl.elements.phone, "Số điện thoại này đã thuộc về một nhân viên khác");
    formEl.elements.phone.focus();
    return;
  }

  // 2. Kiểm tra trùng tên đăng nhập
  if (data.username && isUsernameTaken(allStaff, data.username, staffId)) {
    setFieldError(formEl.elements.username, "Tên đăng nhập này đã được sử dụng hoặc là tài khoản bảo lưu hệ thống");
    formEl.elements.username.focus();
    return;
  }

  // 3. Kiểm tra trùng email (nếu có)
  if (data.email && isEmailTaken(allStaff, data.email, staffId)) {
    setFieldError(formEl.elements.email, "Địa chỉ email này đã thuộc về một nhân viên khác");
    formEl.elements.email.focus();
    return;
  }

  // 4. Mật khẩu
  const rawPassword = formPasswordInput ? formPasswordInput.value.trim() : "";
  if (!staffId && !rawPassword) {
    setFieldError(formPasswordInput, "Bắt buộc nhập mật khẩu khi tạo nhân viên mới");
    formPasswordInput.focus();
    return;
  }
  if (rawPassword && rawPassword.length < 8) {
    setFieldError(formPasswordInput, "Mật khẩu phải có tối thiểu 8 ký tự");
    formPasswordInput.focus();
    return;
  }

  const existingStaff = staffId ? allStaff.find((s) => s.id === staffId) : null;
  const staffCode = data.staffCode || (existingStaff ? existingStaff.displayStaffCode : generateStaffCode(allStaff));

  const payload = {
    staffCode,
    name: data.name,
    username: data.username || (data.phone ? `nv_${data.phone.slice(-4)}` : ""),
    role: data.role,
    shift: data.shift,
    phone: data.phone,
    email: data.email || "",
    startDate: data.startDate,
    status: data.status,
  };

  if (rawPassword) {
    payload.password = rawPassword;
  } else if (existingStaff && existingStaff.password) {
    payload.password = existingStaff.password;
  }

  const restoreButton = setButtonLoading(submitBtn, "Đang lưu...");
  try {
    if (staffId) {
      await updateStaff(staffId, payload);
      toast(`Đã cập nhật hồ sơ "${payload.name}".`, "success");
    } else {
      await addStaff(payload);
      toast(`Đã tiếp nhận nhân sự "${payload.name}" (${payload.staffCode}).`, "success");
    }
    closeModal("staff-modal");
    await reloadTable();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    restoreButton();
  }
});

function bindPasswordToggles() {
  document.querySelectorAll(".pw-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (!input) return;

      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";

      btn.innerHTML = isPassword
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    });
  });

  const genBtn = document.getElementById("btn-gen-password");
  if (genBtn && formPasswordInput) {
    genBtn.addEventListener("click", () => {
      // Sinh mật khẩu mạnh ngẫu nhiên: chữ hoa + chữ thường + số + ký tự đặc biệt
      const charsUpper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
      const charsLower = "abcdefghijkmnpqrstuvwxyz";
      const charsNum = "23456789";
      const charsSpec = "@#$%&*!";
      let pw = "";
      pw += charsUpper[Math.floor(Math.random() * charsUpper.length)];
      pw += charsLower[Math.floor(Math.random() * charsLower.length)];
      pw += charsLower[Math.floor(Math.random() * charsLower.length)];
      pw += charsSpec[Math.floor(Math.random() * charsSpec.length)];
      pw += charsNum[Math.floor(Math.random() * charsNum.length)];
      pw += charsNum[Math.floor(Math.random() * charsNum.length)];
      pw += charsNum[Math.floor(Math.random() * charsNum.length)];
      pw += charsUpper[Math.floor(Math.random() * charsUpper.length)];
      formPasswordInput.type = "text";
      formPasswordInput.value = pw;
      toast(`Đã tạo mật khẩu ngẫu nhiên: ${pw}`, "info");
    });
  }
}

function bindEvents() {
  const debouncedRender = debounce(() => { currentPage = 1; renderTable(); }, 250);
  keywordInput.addEventListener("input", debouncedRender);
  [roleFilter, statusFilter].forEach((el) => el.addEventListener("change", () => { currentPage = 1; renderTable(); }));

  document.getElementById("add-staff-btn").addEventListener("click", openForCreate);
  document.getElementById("staff-form-cancel").addEventListener("click", () => closeModal("staff-modal"));
  document.getElementById("staff-modal-close").addEventListener("click", () => closeModal("staff-modal"));

  bindPasswordToggles();
}

if (initAdminLayout("Quản Lý Nhân Sự")) {
  fillSelects();
  bindEvents();
  bodyEl.innerHTML = `<tr><td colspan="8" class="table-empty py-4 text-center text-muted">Đang tải danh sách nhân sự...</td></tr>`;
  reloadTable();
}

/* =========================================================
   ADMIN-STAFF.JS - CRUD quản lý nhân viên (qua API /staff)
   Bao gồm quản lý tài khoản đăng nhập, cấp mật khẩu, khóa/mở khóa
   và hệ thống phân quyền vai trò (RBAC) + phân quyền riêng nhân sự
   ========================================================= */

import { initAdminLayout } from "../modules/adminLayout.js";
import {
  currentAdmin, can,
  SYSTEM_PERMISSIONS, PERMISSION_GROUPS,
  getRolePermissions, saveRolePermissions, resetRolePermissions,
  getStaffCustomPermissions, saveStaffCustomPermissions,
} from "../modules/auth.js";
import { passwordProblem } from "../modules/passwords.js";
import {
  getAllStaff, filterStaff, addStaff, updateStaff, deleteStaff, updateStaffPermissions,
  isPhoneTaken, isUsernameTaken, isEmailTaken, generateStaffCode,
  STAFF_ROLES,
} from "../modules/staffService.js";
import { debounce, paginate, renderPagination, escapeHtml } from "../modules/utils.js";
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
const formCodeInput = document.getElementById("staff-form-code");
const formUsernameInput = document.getElementById("staff-form-username");
const formPasswordInput = document.getElementById("staff-form-password");
const formPasswordReq = document.getElementById("staff-password-req");
const formPasswordHint = document.getElementById("staff-password-hint");
const modalTitle = document.getElementById("staff-modal-title");
const submitBtn = document.getElementById("staff-form-submit");

/* Tabs & Ma Trận Phân Quyền Elements */
const tabButtons = document.querySelectorAll("#staff-tab-nav .admin-tab");
const tabPanes = {
  list: document.getElementById("pane-staff-list"),
  matrix: document.getElementById("pane-staff-matrix"),
};
const matrixTableEl = document.getElementById("rbac-matrix-table");

/* Modal Phân Quyền Riêng Nhân Sự Elements */
const permModalTitle = document.getElementById("staff-perm-modal-title");
const permModalSubtitle = document.getElementById("staff-perm-modal-subtitle");
const permRolePreview = document.getElementById("perm-role-label-preview");
const permChecklistWrap = document.getElementById("staff-perm-checklist-wrap");
const permModeInherit = document.getElementById("perm-mode-inherit");
const permModeCustom = document.getElementById("perm-mode-custom");

const MATRIX_ROLES = [
  { key: "admin", label: "Quản trị viên", isSuper: true },
  { key: "manager", label: "Quản lý" },
  { key: "cashier", label: "Thu ngân" },
  { key: "bartender", label: "Pha chế" },
  { key: "waiter", label: "Phục vụ" },
];

/** Danh sách nhân viên tải từ API - tải lại sau mỗi lần thêm/sửa/xoá */
let allStaff = [];
let currentPage = 1;
let currentStaffForPerm = null;

/** Màu huy hiệu theo trạng thái tài khoản */
const STATUS_BADGE = { active: "badge-success", pending: "badge-warning", inactive: "badge-muted" };

function fillSelects() {
  Object.entries(STAFF_ROLES).forEach(([value, label]) => {
    roleFilter.insertAdjacentHTML("beforeend", `<option value="${value}">${label}</option>`);
    formRoleSelect.insertAdjacentHTML("beforeend", `<option value="${value}">${label}</option>`);
  });
}

function rowHtml(s) {
  const customPerms = s.customPermissions || getStaffCustomPermissions(s.id);
  const permBadge = Array.isArray(customPerms)
    ? `<span class="perm-custom-badge" title="Nhân viên có ${customPerms.length} quyền riêng">${ICONS.key(12)} Quyền riêng (${customPerms.length})</span>`
    : `<span class="perm-inherited-badge" title="Thừa hưởng theo vai trò ${s.roleLabel}">${ICONS.shield(12)} Theo vai trò</span>`;

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
      <td><span class="text-sm">${escapeHtml(s.phone)}</span></td>
      <td>${permBadge}</td>
      <td>
        <span class="badge ${STATUS_BADGE[s.status] || "badge-muted"}">
          ${s.statusLabel}
        </span>
      </td>
      <td class="cell-actions" style="text-align: right; white-space: nowrap;">
        ${s.isPending
    ? `<button type="button" class="btn btn-primary btn-sm" data-action="approve" title="Duyệt tài khoản tự đăng ký">Duyệt</button>`
    : `<button type="button" class="btn btn-ghost btn-sm" data-action="toggle-status" title="${s.isActive ? "Tạm khóa tài khoản" : "Kích hoạt lại tài khoản"}">
          ${s.isActive ? "Khóa" : "Mở"}
        </button>`}
        <button type="button" class="btn btn-ghost btn-sm" data-action="permissions" title="Thiết lập quyền hạn riêng cho nhân sự này">${ICONS.key(14)} Quyền</button>
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
    formPasswordInput.dataset.rule = "required|password";
    formPasswordInput.placeholder = "Tối thiểu 8 ký tự, chữ đầu viết hoa, có ký tự đặc biệt";
  }
  if (formPasswordReq) formPasswordReq.hidden = false;
  if (formPasswordHint) formPasswordHint.textContent = "Mật khẩu tạo mới: ít nhất 8 ký tự, chữ cái đầu viết hoa, có ít nhất 1 ký tự đặc biệt.";

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

/** Hồ sơ này có phải chính người đang đăng nhập không (admin gốc không có hồ sơ nhân sự nên luôn là false) */
const isSelf = (staff) => Boolean(currentAdmin()?.staffId) && currentAdmin().staffId === staff.id;

async function handleToggleStatus(staff) {
  if (isSelf(staff)) {
    toast("Bạn không thể tự khoá tài khoản của chính mình.", "error");
    return;
  }
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

/** Duyệt tài khoản nhân viên tự đăng ký: Chờ duyệt -> Đang công tác (đăng nhập được) */
async function handleApprove(staff) {
  const ok = await confirmDialog(
    `Duyệt tài khoản "${staff.username}" của ${staff.name} - vị trí ${staff.roleLabel}? Sau khi duyệt, nhân viên này đăng nhập được khu quản trị.`,
    { title: "Duyệt tài khoản nhân sự", okText: "Duyệt" },
  );
  if (!ok) return;

  try {
    await updateStaff(staff.id, { status: "active" });
    toast(`Đã duyệt tài khoản "${staff.name}".`, "success");
    await reloadTable();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function handleDelete(staff) {
  if (isSelf(staff)) {
    toast("Bạn không thể tự xoá hồ sơ của chính mình.", "error");
    return;
  }
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

  if (btn.dataset.action === "permissions") openPermissionsModal(staff);
  if (btn.dataset.action === "edit") openForEdit(staff);
  if (btn.dataset.action === "delete") handleDelete(staff);
  if (btn.dataset.action === "toggle-status") handleToggleStatus(staff);
  if (btn.dataset.action === "approve") handleApprove(staff);
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
  if (rawPassword && passwordProblem(rawPassword)) {
    setFieldError(formPasswordInput, passwordProblem(rawPassword));
    formPasswordInput.focus();
    return;
  }

  const existingStaff = staffId ? allStaff.find((s) => s.id === staffId) : null;
  // Tự đổi vai trò / khoá mình sẽ làm mất quyền ngay giữa chừng (hoặc không ai còn quyền quản lý)
  if (existingStaff && isSelf(existingStaff) && (data.role !== existingStaff.role || data.status !== existingStaff.status)) {
    toast("Bạn không thể tự đổi vai trò hoặc trạng thái của chính mình.", "error");
    return;
  }
  const staffCode = data.staffCode || (existingStaff ? existingStaff.displayStaffCode : generateStaffCode(allStaff));

  const payload = {
    staffCode,
    name: data.name,
    username: data.username || (data.phone ? `nv_${data.phone.slice(-4)}` : ""),
    role: data.role,
    shift: existingStaff?.shift || "",
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
      // Dùng crypto.getRandomValues (bộ sinh số ngẫu nhiên an toàn) thay cho Math.random(),
      // rồi xáo trộn để vị trí chữ hoa/số/ký tự đặc biệt không theo một khuôn cố định
      const charsUpper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
      const charsLower = "abcdefghijkmnpqrstuvwxyz";
      const charsNum = "23456789";
      const charsSpec = "@#$%&*!";
      const rand = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
      const pick = (chars) => chars[rand(chars.length)];
      // Chữ cái ĐẦU luôn là chữ hoa (đúng luật mật khẩu); phần còn lại xáo trộn
      const rest = [pick(charsUpper), pick(charsLower), pick(charsLower), pick(charsLower), pick(charsLower),
        pick(charsNum), pick(charsNum), pick(charsNum), pick(charsSpec), pick(charsSpec), pick(charsLower)];
      for (let i = rest.length - 1; i > 0; i--) {
        const j = rand(i + 1);
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      const pw = pick(charsUpper) + rest.join("");
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

  // Tab chuyển đổi: Danh sách nhân sự <-> Ma trận phân quyền RBAC
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // Nút hành động trên Ma trận phân quyền
  document.getElementById("btn-save-matrix")?.addEventListener("click", handleSaveMatrix);
  document.getElementById("btn-reset-matrix")?.addEventListener("click", handleResetMatrix);

  // Chọn hết / Bỏ hết theo cột vai trò trên Ma trận
  matrixTableEl?.addEventListener("click", (e) => {
    const selAllBtn = e.target.closest("button[data-role-select-all]");
    if (selAllBtn) {
      const role = selAllBtn.dataset.roleSelectAll;
      matrixTableEl.querySelectorAll(`input[data-role="${role}"]`).forEach((cb) => { cb.checked = true; });
      return;
    }
    const deselAllBtn = e.target.closest("button[data-role-deselect-all]");
    if (deselAllBtn) {
      const role = deselAllBtn.dataset.roleDeselectAll;
      matrixTableEl.querySelectorAll(`input[data-role="${role}"]`).forEach((cb) => { cb.checked = false; });
    }
  });

  // Modal phân quyền riêng cho nhân viên
  document.getElementById("staff-perm-modal-close")?.addEventListener("click", () => closeModal("staff-perm-modal"));
  document.getElementById("staff-perm-btn-cancel")?.addEventListener("click", () => closeModal("staff-perm-modal"));
  document.getElementById("staff-perm-btn-save")?.addEventListener("click", handleSaveStaffPermissions);
  document.getElementById("staff-perm-btn-revert")?.addEventListener("click", handleRevertStaffPermissions);

  [permModeInherit, permModeCustom].forEach((radio) => {
    radio?.addEventListener("change", () => {
      if (!currentStaffForPerm) return;
      const isCustom = permModeCustom.checked;
      renderStaffPermChecklist(currentStaffForPerm, isCustom);
    });
  });

  bindPasswordToggles();
}

/* =========================================================
   TAB SWITCHING & MA TRẬN PHÂN QUYỀN (RBAC)
   ========================================================= */

function switchTab(tabKey) {
  tabButtons.forEach((btn) => {
    const isActive = btn.dataset.tab === tabKey;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
  });

  Object.entries(tabPanes).forEach(([key, pane]) => {
    if (pane) pane.hidden = key !== tabKey;
  });

  if (tabKey === "matrix") {
    renderRbacMatrix();
  }
}

function renderRbacMatrix() {
  if (!matrixTableEl) return;
  const roleMatrix = getRolePermissions();
  const editableRoles = MATRIX_ROLES.filter((r) => !r.isSuper);

  const theadHtml = `
    <thead>
      <tr>
        <th style="min-width: 280px;">Chức năng &amp; Nghiệp vụ hệ thống</th>
        <th class="perm-role-header">
          <div class="perm-role-header-title">
            ${ICONS.shield(14)}
            <span>Quản trị viên</span>
          </div>
          <div class="text-xs text-muted" style="font-weight: normal;">Toàn quyền (*)</div>
        </th>
        ${editableRoles.map((r) => `
          <th class="perm-role-header">
            <div class="perm-role-header-title">
              <span>${escapeHtml(r.label)}</span>
            </div>
            <div class="perm-role-header-actions">
              <button type="button" data-role-select-all="${r.key}" title="Chọn tất cả quyền cho vai trò ${escapeHtml(r.label)}">Chọn hết</button>
              <span>·</span>
              <button type="button" data-role-deselect-all="${r.key}" title="Bỏ tất cả quyền của vai trò ${escapeHtml(r.label)}">Bỏ hết</button>
            </div>
          </th>
        `).join("")}
      </tr>
    </thead>
  `;

  const tbodyHtml = PERMISSION_GROUPS.map((group) => {
    const groupPerms = SYSTEM_PERMISSIONS.filter((p) => p.group === group.id);
    const groupHeaderRow = `
      <tr class="perm-group-row">
        <td colspan="${1 + MATRIX_ROLES.length}">
          <div style="display: flex; align-items: center; gap: 8px;">
            ${ICONS[group.icon] ? ICONS[group.icon](16) : ICONS.shield(16)}
            <span>${escapeHtml(group.name)}</span>
            <span class="text-xs text-muted" style="font-weight: normal;">— ${escapeHtml(group.desc)}</span>
          </div>
        </td>
      </tr>
    `;

    const permRows = groupPerms.map((perm) => `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 6px;">
            <strong>${escapeHtml(perm.label)}</strong>
            ${perm.danger ? '<span class="perm-badge-danger">Nguy cơ</span>' : ""}
          </div>
          <div class="perm-item-desc">${escapeHtml(perm.desc)}</div>
          <div class="text-xs text-muted" style="font-family: monospace; font-size: 0.72rem; margin-top: 2px;">${escapeHtml(perm.id)}</div>
        </td>
        <td class="perm-cell-check">
          <input type="checkbox" checked disabled title="Quản trị viên tối cao luôn sở hữu toàn quyền (*)">
        </td>
        ${editableRoles.map((r) => {
          const rolePerms = roleMatrix[r.key] || [];
          const isChecked = rolePerms.includes("*") || rolePerms.includes(perm.id);
          return `
            <td class="perm-cell-check">
              <input type="checkbox" data-role="${r.key}" data-perm="${perm.id}" ${isChecked ? "checked" : ""}>
            </td>
          `;
        }).join("")}
      </tr>
    `).join("");

    return groupHeaderRow + permRows;
  }).join("");

  matrixTableEl.innerHTML = theadHtml + `<tbody>${tbodyHtml}</tbody>`;
}

async function handleSaveMatrix() {
  if (!can("staff:permissions")) {
    toast("Bạn không có quyền cập nhật ma trận phân quyền hệ thống.", "error");
    return;
  }

  const newMatrix = {
    admin: ["*"],
  };

  const editableRoles = MATRIX_ROLES.filter((r) => !r.isSuper);
  editableRoles.forEach((r) => {
    const checkedBoxes = Array.from(matrixTableEl.querySelectorAll(`input[data-role="${r.key}"]:checked`));
    const perms = checkedBoxes.map((cb) => cb.dataset.perm);

    // Nếu chọn tất cả quyền thì quy về ["*"]
    if (perms.length === SYSTEM_PERMISSIONS.length) {
      newMatrix[r.key] = ["*"];
    } else {
      newMatrix[r.key] = perms;
    }
  });

  saveRolePermissions(newMatrix);
  toast("Đã lưu ma trận phân quyền vai trò (RBAC) thành công!", "success");
}

async function handleResetMatrix() {
  if (!can("staff:permissions")) {
    toast("Bạn không có quyền khôi phục ma trận phân quyền.", "error");
    return;
  }

  const ok = await confirmDialog(
    "Bạn có chắc chắn muốn khôi phục ma trận phân quyền vai trò về cấu hình gốc mặc định của quán?",
    { title: "Khôi phục ma trận mặc định", okText: "Khôi phục" },
  );
  if (!ok) return;

  resetRolePermissions();
  renderRbacMatrix();
  toast("Đã khôi phục ma trận phân quyền về mặc định thành công!", "success");
}

/* =========================================================
   MODAL PHÂN QUYỀN RIÊNG CHO TỪNG NHÂN SỰ
   ========================================================= */

function renderStaffPermChecklist(staff, isCustomMode) {
  const roleMatrix = getRolePermissions();
  const staffCustom = staff.customPermissions || getStaffCustomPermissions(staff.id);
  const rolePerms = roleMatrix[staff.role] || [];

  permChecklistWrap.innerHTML = PERMISSION_GROUPS.map((group) => {
    const groupPerms = SYSTEM_PERMISSIONS.filter((p) => p.group === group.id);
    return `
      <div class="perm-modal-group">
        <div class="perm-modal-group-title">
          <div style="display: flex; align-items: center; gap: 6px;">
            ${ICONS[group.icon] ? ICONS[group.icon](15) : ICONS.shield(15)}
            <span>${escapeHtml(group.name)}</span>
          </div>
          <span class="text-xs text-muted">(${groupPerms.length} quyền)</span>
        </div>
        <div class="perm-modal-grid">
          ${groupPerms.map((perm) => {
            const isChecked = isCustomMode
              ? (Array.isArray(staffCustom) ? (staffCustom.includes("*") || staffCustom.includes(perm.id)) : (rolePerms.includes("*") || rolePerms.includes(perm.id)))
              : (rolePerms.includes("*") || rolePerms.includes(perm.id));

            return `
              <label class="perm-modal-item">
                <input type="checkbox" data-staff-perm="${perm.id}" ${isChecked ? "checked" : ""} ${!isCustomMode ? "disabled" : ""}>
                <div>
                  <div style="font-size: 0.84rem; font-weight: 500; color: var(--cream);">
                    ${escapeHtml(perm.label)}
                    ${perm.danger ? '<span class="perm-badge-danger">Nguy cơ</span>' : ""}
                  </div>
                  <div class="perm-item-desc">${escapeHtml(perm.desc)}</div>
                </div>
              </label>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }).join("");
}

function openPermissionsModal(staff) {
  currentStaffForPerm = staff;
  const staffCustom = staff.customPermissions || getStaffCustomPermissions(staff.id);
  const isCustom = Array.isArray(staffCustom);

  permModalTitle.innerHTML = `${ICONS.key(18)} Thiết Lập Quyền Riêng: ${escapeHtml(staff.name)}`;
  permModalSubtitle.textContent = `Mã: ${staff.displayStaffCode} · Vị trí: ${staff.roleLabel}`;
  if (permRolePreview) permRolePreview.textContent = staff.roleLabel;

  if (isCustom) {
    permModeCustom.checked = true;
  } else {
    permModeInherit.checked = true;
  }

  renderStaffPermChecklist(staff, isCustom);
  openModal("staff-perm-modal");
}

async function handleSaveStaffPermissions() {
  if (!currentStaffForPerm) return;
  if (!can("staff:permissions")) {
    toast("Bạn không có quyền điều chỉnh phân quyền nhân viên.", "error");
    return;
  }

  const staff = currentStaffForPerm;
  const isCustom = permModeCustom.checked;

  try {
    if (isCustom) {
      const checkedBoxes = Array.from(permChecklistWrap.querySelectorAll("input[data-staff-perm]:checked"));
      const perms = checkedBoxes.map((cb) => cb.dataset.staffPerm);
      saveStaffCustomPermissions(staff.id, perms);
      await updateStaffPermissions(staff.id, perms).catch(() => {});
      staff.customPermissions = perms;
      toast(`Đã lưu ${perms.length} quyền riêng cho nhân viên "${staff.name}".`, "success");
    } else {
      saveStaffCustomPermissions(staff.id, null);
      await updateStaffPermissions(staff.id, null).catch(() => {});
      staff.customPermissions = null;
      toast(`Đã khôi phục quyền nhân viên "${staff.name}" về theo vai trò "${staff.roleLabel}".`, "success");
    }
    closeModal("staff-perm-modal");
    renderTable();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function handleRevertStaffPermissions() {
  if (!currentStaffForPerm) return;
  const staff = currentStaffForPerm;
  const ok = await confirmDialog(
    `Khôi phục phân quyền của nhân viên "${staff.name}" về mặc định theo vai trò "${staff.roleLabel}"?`,
    { title: "Khôi phục theo vai trò", okText: "Khôi phục" },
  );
  if (!ok) return;

  try {
    saveStaffCustomPermissions(staff.id, null);
    await updateStaffPermissions(staff.id, null).catch(() => {});
    staff.customPermissions = null;
    toast(`Đã khôi phục quyền nhân viên "${staff.name}" về theo vai trò "${staff.roleLabel}".`, "success");
    closeModal("staff-perm-modal");
    renderTable();
  } catch (err) {
    toast(err.message, "error");
  }
}

if (initAdminLayout("Quản Lý Nhân Sự")) {
  fillSelects();
  bindEvents();
  bodyEl.innerHTML = `<tr><td colspan="8" class="table-empty py-4 text-center text-muted">Đang tải danh sách nhân sự...</td></tr>`;
  reloadTable();
}

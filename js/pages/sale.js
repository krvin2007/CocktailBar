/* =========================================================
   SALE.JS - Trang "Khuyến Mãi & Sale" (sale.html)
   Gom toàn bộ chương trình ưu đãi của quán về một trang:

   01. Sale sản phẩm mới  - món ra mắt trong NEW_DRINK_DAYS ngày tự
       giảm NEW_DRINK_DISCOUNT % (không cần mã) + lưới các món mới.
   02. Khách hàng mới     - mã công khai (VD BANMOI10) cho đơn đầu
       tiên theo SĐT, hoặc đăng ký thành viên nhận mã cá nhân giảm
       WELCOME_DISCOUNT %.
   03. Sale theo mức      - mỗi món một mức 10% · 15% · 25% · 30% ·
       35%…; hàng nút lọc theo mức (chỉ các mức đang có món) + lưới
       món đang sale (getDrinkPricing(d).reason === "sale").
   04. Quà sinh nhật      - thành viên nhận mã BIRTHDAY_DISCOUNT % trong
       khoảng ± 7 ngày quanh sinh nhật; đang đăng nhập thì hiện đếm ngược.
   Cuối trang: "Mã giảm giá đang phát hành" - thẻ dạng vé cho mỗi mã
   công khai còn dùng được (getPublicVouchers), có nút Sao chép và
   "Dùng ngay" (sang order.html?voucher=MÃ).

   Thực đơn và mã giảm giá được tải SONG SONG bằng Promise.allSettled:
   một nguồn lỗi thì phần còn lại của trang vẫn hiển thị bình thường.
   ========================================================= */

import "../modules/navbar.js";
import {
  getAllDrinks, getDrinkPricing, isNewDrink, NEW_DRINK_DISCOUNT, NEW_DRINK_DAYS, SALE_TIERS,
} from "../modules/drinksService.js";
import { drinkCardHtml } from "../modules/drinkCard.js";
import { getPublicVouchers, VOUCHER_AUDIENCES, BIRTHDAY_DISCOUNT, WELCOME_DISCOUNT } from "../modules/vouchersService.js";
import { getCurrentCustomer } from "../modules/customerAuth.js";
import { Customer } from "../modules/customersService.js";
import { toast, loadingHtml, errorHtml } from "../modules/ui.js";
import { ICONS } from "../modules/icons.js";
import { escapeHtml, formatMoney, getQueryParam } from "../modules/utils.js";

/* =========================================================
   HẰNG SỐ & BIỂU TƯỢNG
   ========================================================= */

const DAY_MS = 24 * 60 * 60 * 1000;
/** Cửa sổ quà sinh nhật: ± 7 ngày quanh sinh nhật (theo đặc tả vouchersService) */
const BIRTHDAY_WINDOW = 7;
/** Mã chào mừng thành viên mới có hạn 30 ngày, dùng 1 lần */
const WELCOME_VALID_DAYS = 30;
/** Mã giới hạn lượt còn ≤ ngưỡng này thì gắn nhãn "Sắp hết" */
const LOW_STOCK_USES = 5;

/** Các mức sale admin chọn được (bỏ 0 = không sale) */
const SALE_LEVELS = SALE_TIERS.filter((tier) => tier > 0);

const svgIcon = (size, body) => `<svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICON_GIFT = (size = 22) => svgIcon(size, `<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>`);
const ICON_TAG = (size = 22) => svgIcon(size, `<path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5"/>`);
const ICON_USER_PLUS = (size = 22) => svgIcon(size, `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>`);
const ICON_COPY = (size = 14) => svgIcon(size, `<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>`);

/* =========================================================
   TRẠNG THÁI TRANG
   ========================================================= */

const state = {
  drinks: null,        // null = đang tải
  drinksError: "",
  vouchers: null,      // null = đang tải
  vouchersError: "",
  tier: "all",         // mức sale đang lọc: "all" hoặc số (10, 15, 25...)
};

const $ = (id) => document.getElementById(id);

/* =========================================================
   TIỆN ÍCH
   ========================================================= */

const pad2 = (n) => String(n).padStart(2, "0");
const formatDay = (d) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
const formatDayMonth = (d) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;

/** Số thứ tự ngày theo lịch địa phương (bỏ giờ) - hiệu hai ngày luôn là số nguyên */
function dayNumber(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return NaN;
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

/** Thời điểm tạo món dạng số; thiếu/sai -> 0 */
function createdTime(drink) {
  const ms = new Date(drink?.createdAt).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

const isSoldOut = (drink) => drink.status === "soldout" || Number(drink.stock) <= 0;

/** 100000 -> "100k", 1500000 -> "1,5tr" (ghi gọn trên cuống vé) */
function shortMoney(value) {
  const n = Number(value) || 0;
  if (n >= 1000000) return `${(n / 1000000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr`;
  return `${Math.round(n / 1000)}k`;
}

/** Tên gọi (từ cuối của họ tên) */
function shortName(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "bạn";
}

function currentCustomer() {
  try {
    return getCurrentCustomer() || null;
  } catch (err) {
    console.warn("[sale] Không đọc được phiên thành viên:", err);
    return null;
  }
}

/** Khung trống dùng chung cho các lưới */
function emptyHtml(message, icon = ICONS.cocktail(32)) {
  return `
    <div class="empty-state promo-empty">
      <div class="empty-icon">${icon}</div>
      <p class="text-muted">${message}</p>
    </div>`;
}

/** Khung lỗi + nút "Thử lại" (tải lại cả trang dữ liệu) */
function errorWithRetry(message) {
  return `
    ${errorHtml(escapeHtml(message))}
    <div class="promo-retry">
      <button type="button" class="btn btn-ghost btn-sm" data-action="reload">${ICONS.refresh(14)} Thử lại</button>
    </div>`;
}

/** Bật/tắt role="list" và aria-busy cho lưới tuỳ nội dung */
function fillGrid(host, itemsHtml, fallbackHtml, { busy = false } = {}) {
  host.setAttribute("aria-busy", String(busy));
  if (itemsHtml.length) {
    host.setAttribute("role", "list");
    host.innerHTML = itemsHtml.join("");
  } else {
    host.removeAttribute("role");
    host.innerHTML = fallbackHtml;
  }
}

/* ---------------- Mã giảm giá ---------------- */

/** Ngày hết hạn của mã (chuỗi "YYYY-MM-DD" hiểu là hết ngày đó); không hạn -> null */
function voucherEnd(voucher) {
  if (!voucher?.endDate) return null;
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(voucher.endDate));
  const d = plain
    ? new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3]), 23, 59, 59, 999)
    : new Date(voucher.endDate);
  return Number.isNaN(d.getTime()) ? null : d;
}

function expiryText(voucher, now = new Date()) {
  const end = voucherEnd(voucher);
  if (!end) return "Không thời hạn";
  const daysLeft = dayNumber(end) - dayNumber(now);
  if (daysLeft <= 0) return `${formatDay(end)} (hết hạn hôm nay)`;
  return `${formatDay(end)} (còn ${daysLeft} ngày)`;
}

/** Số lượt còn lại; Infinity nếu không giới hạn */
function remainingUses(voucher) {
  const limit = Number(voucher?.usageLimit) || 0;
  return limit > 0 ? Math.max(0, limit - (Number(voucher.usedCount) || 0)) : Infinity;
}

const orderLink = (code) => `order.html?voucher=${encodeURIComponent(code)}`;

/** Thẻ mã giảm giá dạng "vé/coupon": cuống ghi %, thân ghi điều kiện, mã lớn + 2 nút */
function couponHtml(voucher) {
  const code = escapeHtml(voucher.code);
  const percent = Number(voucher.percent) || 0;
  const minOrder = Number(voucher.minOrder) || 0;
  const maxDiscount = Number(voucher.maxDiscount) || 0;
  const audience = String(voucher.audience || "all");
  const left = remainingUses(voucher);
  const limited = Number.isFinite(left);
  const used = Number(voucher.usedCount) || 0;
  const usedPercent = limited ? Math.min(100, Math.round((used / Number(voucher.usageLimit)) * 100)) : 0;

  const usesBadge = limited
    ? `<span class="coupon-uses${left <= LOW_STOCK_USES ? " is-low" : ""}">${left <= LOW_STOCK_USES ? "Sắp hết · " : ""}Còn ${left} lượt</span>`
    : `<span class="coupon-uses is-unlimited">Không giới hạn lượt</span>`;

  return `
    <article class="coupon" data-audience="${escapeHtml(audience)}" role="listitem">
      <div class="coupon-stub">
        <span class="coupon-percent">${percent}<small>%</small></span>
        <span class="coupon-off">Giảm</span>
        ${maxDiscount > 0 ? `<span class="coupon-cap">tối đa ${shortMoney(maxDiscount)}</span>` : ""}
      </div>
      <div class="coupon-body">
        <div class="coupon-top">
          <span class="coupon-tag">${escapeHtml(VOUCHER_AUDIENCES[audience] || audience)}</span>
          ${usesBadge}
        </div>
        <h3 class="coupon-name">${escapeHtml(voucher.name || `Giảm ${percent}%`)}</h3>
        ${voucher.description ? `<p class="coupon-desc">${escapeHtml(voucher.description)}</p>` : ""}
        <dl class="coupon-specs">
          <div><dt>Đơn tối thiểu</dt><dd>${minOrder > 0 ? formatMoney(minOrder) : "Không yêu cầu"}</dd></div>
          <div><dt>Giảm tối đa</dt><dd>${maxDiscount > 0 ? formatMoney(maxDiscount) : "Không giới hạn"}</dd></div>
          <div><dt>Hạn dùng</dt><dd>${escapeHtml(expiryText(voucher))}</dd></div>
        </dl>
        ${limited ? `
          <div class="coupon-usage" role="img" aria-label="Đã dùng ${used}/${Number(voucher.usageLimit)} lượt">
            <span style="width: ${usedPercent}%"></span>
          </div>` : ""}
        <div class="coupon-actions">
          <code class="coupon-code">${code}</code>
          <button type="button" class="btn btn-ghost btn-sm" data-copy-code="${code}" aria-label="Sao chép mã ${code}">
            ${ICON_COPY()} <span>Sao chép</span>
          </button>
          <a class="btn btn-primary btn-sm" href="${orderLink(voucher.code)}">Dùng ngay</a>
        </div>
      </div>
    </article>`;
}

/* ---------------- Sao chép mã ---------------- */

/**
 * Chép chữ vào bộ nhớ tạm. navigator.clipboard chỉ có ở ngữ cảnh an toàn
 * (https / localhost) và có thể bị từ chối -> bọc try/catch, thất bại thì
 * thử cách cũ bằng ô textarea ẩn.
 */
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn("[sale] Clipboard API bị từ chối, thử cách dự phòng:", err.message);
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

async function handleCopy(button) {
  const code = button.dataset.copyCode || "";
  if (!code) return;
  if (!(await copyText(code))) {
    toast(`Trình duyệt không cho sao chép tự động - hãy chép thủ công mã <strong>${escapeHtml(code)}</strong>.`, "info");
    return;
  }
  toast(`Đã sao chép mã <strong>${escapeHtml(code)}</strong> - dán vào ô "Mã giảm giá" khi đặt món.`, "success");

  const label = button.querySelector("span");
  if (!label || button.classList.contains("is-copied")) return;
  const original = label.textContent;
  button.classList.add("is-copied");
  label.textContent = "Đã chép";
  setTimeout(() => {
    button.classList.remove("is-copied");
    label.textContent = original;
  }, 1600);
}

/* =========================================================
   SỐ LIỆU HERO & THẺ TỔNG QUAN 4 CHƯƠNG TRÌNH
   ========================================================= */

/** Món đang được giảm giá (kể cả ưu đãi món mới) kèm thông tin giá */
function pricedDrinks() {
  return (state.drinks || []).map((drink) => ({ drink, pricing: getDrinkPricing(drink) }));
}

/** Các món sale THEO MỨC (reason "sale"), không gồm món chỉ giảm vì là món mới */
function tierSaleItems() {
  return pricedDrinks().filter(({ pricing }) => pricing.reason === "sale");
}

function renderStats() {
  const set = (id, text) => { const el = $(id); if (el) el.textContent = text; };

  if (state.drinks) {
    const discounted = pricedDrinks().filter(({ pricing }) => pricing.onSale);
    const maxPercent = discounted.reduce((max, { pricing }) => Math.max(max, pricing.percent), 0);
    set("stat-sale-count", String(discounted.length));
    set("stat-max-percent", maxPercent > 0 ? `${maxPercent}%` : "—");
    set("stat-new-count", String(state.drinks.filter((d) => isNewDrink(d)).length));
  } else {
    ["stat-sale-count", "stat-max-percent", "stat-new-count"].forEach((id) => set(id, "—"));
  }
  set("stat-voucher-count", state.vouchers ? String(state.vouchers.length) : "—");
}

/** "10–35%" theo các mức sale thật đang có trên thực đơn */
function saleRangeText() {
  const percents = tierSaleItems().map(({ pricing }) => pricing.percent);
  if (!percents.length) return state.drinks ? "Sale" : `${SALE_LEVELS[0]}%+`;
  const min = Math.min(...percents);
  const max = Math.max(...percents);
  return min === max ? `-${max}%` : `${min}–${max}%`;
}

/** Mã công khai dành cho khách hàng mới (VD BANMOI10) nếu đang phát hành */
function newcomerVoucher() {
  return (state.vouchers || []).find((v) => v.audience === "new-customer") || null;
}

function renderPrograms() {
  const host = $("program-grid");
  if (!host) return;

  const newcomer = newcomerVoucher();
  const programs = [
    {
      href: "#program-new",
      num: "01",
      icon: ICONS.sparkle(22),
      value: `-${NEW_DRINK_DISCOUNT}%`,
      title: "Sale sản phẩm mới",
      desc: `Món ra mắt trong ${NEW_DRINK_DAYS} ngày gần nhất tự động giảm ${NEW_DRINK_DISCOUNT}% - không cần nhập mã.`,
      link: "Xem món mới",
    },
    {
      href: "#program-newcustomer",
      num: "02",
      icon: ICON_USER_PLUS(22),
      value: `-${WELCOME_DISCOUNT}%`,
      title: "Khách hàng mới",
      desc: newcomer
        ? `Nhập mã ${newcomer.code} giảm ${newcomer.percent}% cho đơn đầu tiên, hoặc đăng ký thành viên nhận mã riêng giảm ${WELCOME_DISCOUNT}%.`
        : `Đăng ký thành viên nhận ngay mã riêng giảm ${WELCOME_DISCOUNT}% cho đơn đầu tiên.`,
      link: "Nhận quà chào mừng",
    },
    {
      href: "#program-tiers",
      num: "03",
      icon: ICON_TAG(22),
      value: saleRangeText(),
      title: "Sale theo mức",
      desc: `Mỗi món một mức sale ${SALE_LEVELS.slice(0, 5).join("% · ")}%… trừ thẳng vào giá trên thực đơn.`,
      link: "Lọc theo mức giảm",
    },
    {
      href: "#program-birthday",
      num: "04",
      icon: ICON_GIFT(22),
      value: `-${BIRTHDAY_DISCOUNT}%`,
      title: "Quà sinh nhật",
      desc: `Thành viên tự nhận mã giảm ${BIRTHDAY_DISCOUNT}% trong khoảng ${BIRTHDAY_WINDOW} ngày trước và sau sinh nhật.`,
      link: "Xem cách nhận",
    },
  ];

  host.innerHTML = programs.map((p) => `
    <a class="program-card" href="${p.href}">
      <div class="program-card-top">
        <span class="program-card-icon">${p.icon}</span>
        <span class="program-card-num">${p.num}</span>
      </div>
      <span class="program-card-value">${escapeHtml(p.value)}</span>
      <h3 class="program-card-title">${escapeHtml(p.title)}</h3>
      <p class="program-card-desc">${escapeHtml(p.desc)}</p>
      <span class="program-card-link">${escapeHtml(p.link)} ${ICONS.arrowRight(14)}</span>
    </a>`).join("");
}

/* =========================================================
   01. SALE SẢN PHẨM MỚI
   ========================================================= */

function newPickHtml(drink, now) {
  const pricing = getDrinkPricing(drink, now);
  const age = Math.max(0, Math.floor((now - createdTime(drink)) / DAY_MS));
  const daysLeft = Math.max(0, NEW_DRINK_DAYS - age);
  const launched = age === 0 ? "Ra mắt hôm nay" : `Ra mắt ${age} ngày trước`;

  // Không cộng dồn: món mới mà đang sale sâu hơn thì hưởng mức sale (getDrinkPricing đã chọn mức cao hơn)
  const offer = pricing.reason === "sale"
    ? `Đang sale ${pricing.percent}% (cao hơn ưu đãi món mới)`
    : daysLeft === 0 ? "Ưu đãi kết thúc hôm nay" : `Còn ${daysLeft} ngày ưu đãi`;

  // Gọi drinkCardHtml với đúng 1 tham số (không truyền thẳng vào .map để tránh lọt chỉ số mảng)
  return `
    <div class="promo-pick" role="listitem">
      <div class="promo-pick-head">
        <span class="promo-pill">${ICONS.calendar(13)} ${escapeHtml(launched)}</span>
        <span class="promo-pill is-accent">${escapeHtml(offer)}</span>
      </div>
      ${drinkCardHtml(drink)}
    </div>`;
}

function renderNewDrinks() {
  const host = $("new-drinks-grid");
  const desc = $("new-program-desc");
  if (desc) {
    desc.textContent = `Món ra mắt trong ${NEW_DRINK_DAYS} ngày gần nhất được tự động giảm ${NEW_DRINK_DISCOUNT}% ngay trên thực đơn - không cần mã. `
      + "Món mới đang có mức sale cao hơn thì hưởng mức cao hơn (không cộng dồn).";
  }
  if (!host) return;

  if (state.drinksError) return fillGrid(host, [], errorWithRetry(state.drinksError));
  if (!state.drinks) return fillGrid(host, [], loadingHtml("Đang tải các món mới ra mắt..."), { busy: true });

  const now = Date.now();
  const items = state.drinks
    .filter((drink) => isNewDrink(drink, now))
    .sort((a, b) => createdTime(b) - createdTime(a))
    .map((drink) => newPickHtml(drink, now));

  fillGrid(host, items, emptyHtml(`Chưa có món mới trong ${NEW_DRINK_DAYS} ngày gần đây - quầy bar đang chuẩn bị công thức tiếp theo, hẹn bạn tuần sau!`));
}

/* =========================================================
   02. KHÁCH HÀNG MỚI
   ========================================================= */

function renderNewcomerPublic() {
  const host = $("newcomer-public");
  if (!host) return;

  const head = `
    <div class="newcomer-head">
      <span class="newcomer-icon">${ICON_TAG(22)}</span>
      <div>
        <span class="newcomer-kicker">Không cần đăng ký</span>
        <h3>Mã công khai cho đơn đầu tiên</h3>
      </div>
    </div>
    <p class="newcomer-text">Nhập mã khi đặt món - hệ thống kiểm tra số điện thoại: chỉ áp dụng nếu số này
      chưa từng có đơn tại quán (không tính đơn đã huỷ).</p>`;

  let body;
  if (state.vouchersError) {
    body = `<p class="newcomer-note is-error">${ICONS.alertCircle(16)} <span>Chưa tải được mã giảm giá.</span>
      <button type="button" class="link-button" data-action="reload">Thử lại</button></p>`;
  } else if (!state.vouchers) {
    body = loadingHtml("Đang tải mã cho khách mới...");
  } else {
    const voucher = newcomerVoucher();
    body = voucher
      ? `<div class="coupon-single" role="list">${couponHtml(voucher)}</div>`
      : `<p class="newcomer-note">Hiện chưa có mã công khai cho khách mới - đăng ký thành viên để nhận mã riêng giảm ${WELCOME_DISCOUNT}%.</p>`;
  }
  host.innerHTML = head + body;
}

function renderNewcomerMember() {
  const host = $("newcomer-member");
  if (!host) return;
  const customer = currentCustomer();

  if (customer) {
    host.innerHTML = `
      <div class="newcomer-head">
        <span class="newcomer-icon">${ICON_USER_PLUS(22)}</span>
        <div>
          <span class="newcomer-kicker">Thành viên</span>
          <h3>Chào ${escapeHtml(shortName(customer.name))}, bạn đã là thành viên!</h3>
        </div>
      </div>
      <p class="newcomer-text">Mã chào mừng giảm ${WELCOME_DISCOUNT}% (nếu chưa dùng) cùng mọi quà tặng cá nhân
        đều nằm trong ví mã giảm giá của bạn.</p>
      <div class="newcomer-actions">
        <a class="btn btn-primary" href="account.html#wallet">${ICONS.user(16)} Mở ví của tôi</a>
        <a class="btn btn-ghost" href="order.html">${ICONS.shoppingBag(16)} Đặt bàn &amp; gọi món</a>
      </div>`;
    return;
  }

  host.innerHTML = `
    <div class="newcomer-head">
      <span class="newcomer-icon">${ICON_USER_PLUS(22)}</span>
      <div>
        <span class="newcomer-kicker">Thành viên mới</span>
        <h3>Đăng ký nhận mã riêng</h3>
      </div>
    </div>
    <div class="newcomer-value">
      <strong>-${WELCOME_DISCOUNT}%</strong>
      <span>cho đơn đầu tiên<br>của thành viên mới</span>
    </div>
    <ul class="check-list">
      <li>${ICONS.check(14)} Mã cá nhân dạng CHAO····, chỉ tài khoản của bạn dùng được</li>
      <li>${ICONS.check(14)} Hạn dùng ${WELCOME_VALID_DAYS} ngày, dùng 1 lần</li>
      <li>${ICONS.check(14)} Mỗi năm thêm quà sinh nhật giảm ${BIRTHDAY_DISCOUNT}%</li>
    </ul>
    <div class="newcomer-actions">
      <a class="btn btn-primary" href="account.html?tab=register">Đăng ký thành viên</a>
      <a class="btn btn-ghost" href="account.html">Đã có tài khoản? Đăng nhập</a>
    </div>`;
}

/* =========================================================
   03. SALE THEO MỨC
   ========================================================= */

/** Mức lọc ban đầu lấy từ URL (sale.html?tier=25) để chia sẻ được đường dẫn */
function initialTier() {
  const fromUrl = Number(getQueryParam("tier"));
  return SALE_LEVELS.includes(fromUrl) ? fromUrl : "all";
}

function tierChipHtml(value, label, count) {
  const active = state.tier === value;
  return `
    <button type="button" class="tier-chip${active ? " is-active" : ""}" data-tier="${value}" aria-pressed="${active}">
      <span>${label}</span><span class="tier-chip-count">${count}</span>
    </button>`;
}

function renderTierLegend() {
  const legend = $("tier-legend");
  if (legend) legend.textContent = `${SALE_LEVELS.slice(0, 5).map((t) => `${t}%`).join(" · ")}…`;
}

function renderTierFilter(items) {
  const host = $("tier-filter");
  if (!host) return;

  if (!state.drinks || !items.length) {
    host.hidden = true;
    host.innerHTML = "";
    return;
  }

  const counts = new Map();
  items.forEach(({ pricing }) => counts.set(pricing.percent, (counts.get(pricing.percent) || 0) + 1));
  const tiers = [...counts.keys()].sort((a, b) => a - b);
  if (state.tier !== "all" && !counts.has(state.tier)) state.tier = "all";

  host.hidden = false;
  host.innerHTML = [
    tierChipHtml("all", "Tất cả", items.length),
    ...tiers.map((tier) => tierChipHtml(tier, `-${tier}%`, counts.get(tier))),
  ].join("");
}

function salePickHtml({ drink, pricing }) {
  const saving = pricing.originalPrice - pricing.finalPrice;
  return `
    <div class="promo-pick" role="listitem">
      <div class="promo-pick-head">
        <span class="promo-pill is-accent">${ICONS.flame(13)} Sale ${pricing.percent}%</span>
        ${saving > 0 ? `<span class="promo-pill">Tiết kiệm ${formatMoney(saving)}/ly</span>` : ""}
      </div>
      ${drinkCardHtml(drink)}
    </div>`;
}

function renderSaleGrid(items) {
  const host = $("sale-drinks-grid");
  const result = $("tier-result");
  if (!host) return;

  if (state.drinksError) {
    if (result) result.textContent = "";
    return fillGrid(host, [], errorWithRetry(state.drinksError));
  }
  if (!state.drinks) {
    if (result) result.textContent = "";
    return fillGrid(host, [], loadingHtml("Đang tải các món đang sale..."), { busy: true });
  }

  const filtered = (state.tier === "all" ? items : items.filter(({ pricing }) => pricing.percent === state.tier))
    .sort((a, b) =>
      Number(isSoldOut(a.drink)) - Number(isSoldOut(b.drink))          // còn hàng trước
      || b.pricing.percent - a.pricing.percent                          // giảm sâu trước
      || (b.pricing.originalPrice - b.pricing.finalPrice) - (a.pricing.originalPrice - a.pricing.finalPrice)
      || String(a.drink.name || "").localeCompare(String(b.drink.name || ""), "vi"));

  if (result) {
    result.textContent = items.length
      ? `${filtered.length} món ${state.tier === "all" ? "đang sale" : `giảm ${state.tier}%`}`
      : "";
  }

  fillGrid(host, filtered.map(salePickHtml), emptyHtml(
    "Hiện chưa có món nào đang sale theo mức - ghé lại vào cuối tuần hoặc xem các món mới đang giảm giá phía trên nhé!",
    ICON_TAG(32),
  ));
}

function renderTiers() {
  const items = state.drinks ? tierSaleItems() : [];
  renderTierFilter(items);
  renderSaleGrid(items);
}

/** Đổi mức lọc: cập nhật nút (không vẽ lại để giữ focus bàn phím) + lưới + URL */
function selectTier(value) {
  state.tier = value === "all" ? "all" : Number(value);
  document.querySelectorAll("#tier-filter .tier-chip").forEach((chip) => {
    const active = String(state.tier) === chip.dataset.tier;
    chip.classList.toggle("is-active", active);
    chip.setAttribute("aria-pressed", String(active));
  });
  renderSaleGrid(tierSaleItems());

  const url = new URL(window.location.href);
  if (state.tier === "all") url.searchParams.delete("tier");
  else url.searchParams.set("tier", String(state.tier));
  history.replaceState(null, "", url);
}

/* =========================================================
   04. QUÀ SINH NHẬT
   ========================================================= */

function renderBirthdayProgram() {
  const desc = $("birthday-program-desc");
  if (desc) {
    desc.textContent = `Thành viên được tự động gửi mã giảm ${BIRTHDAY_DISCOUNT}% trong tuần sinh nhật `
      + `(${BIRTHDAY_WINDOW} ngày trước đến ${BIRTHDAY_WINDOW} ngày sau) - mỗi năm một mã, dùng cho một đơn bất kỳ.`;
  }
  const step = $("birthday-step-3");
  if (step) step.textContent = `Mã cá nhân dạng SNyy···· giảm ${BIRTHDAY_DISCOUNT}%, dùng 1 lần, hạn tới hết ${BIRTHDAY_WINDOW} ngày sau sinh nhật.`;
}

function renderBirthdayStatus() {
  const host = $("birthday-status");
  if (!host) return;
  const customer = currentCustomer();

  if (!customer) {
    host.innerHTML = `
      <div class="bday-cta">
        <span class="bday-cta-value">-${BIRTHDAY_DISCOUNT}%</span>
        <p>Đăng nhập để xem còn bao nhiêu ngày tới sinh nhật của bạn và nhận quà đúng dịp.</p>
        <div class="newcomer-actions">
          <a class="btn btn-primary" href="account.html">Đăng nhập</a>
          <a class="btn btn-ghost" href="account.html?tab=register">Đăng ký thành viên</a>
        </div>
      </div>`;
    return;
  }

  const member = new Customer(customer);
  const days = member.daysUntilBirthday;
  const name = escapeHtml(shortName(member.name));

  if (days === null || days === undefined || Number.isNaN(Number(days))) {
    host.innerHTML = `
      <div class="bday-cta">
        <p>Tài khoản của ${name} chưa có ngày sinh hợp lệ - liên hệ quán để cập nhật và nhận quà sinh nhật.</p>
      </div>`;
    return;
  }

  const next = member.nextBirthday;
  const walletBtn = `<a class="btn btn-primary" href="account.html#wallet">${ICON_GIFT(16)} Mở ví nhận quà</a>`;

  if (days === 0 || member.isInBirthdayWindow) {
    // 3 tình huống trong cửa sổ: đúng ngày / sắp tới (còn 1-7 ngày) / vừa qua (sinh nhật đã qua ≤ 7 ngày)
    let title;
    let badge;
    if (days === 0) {
      title = `Chúc mừng sinh nhật, ${name}!`;
      badge = `${ICON_GIFT(34)}<span>Hôm nay</span>`;
    } else if (days <= BIRTHDAY_WINDOW) {
      title = `Còn ${days} ngày nữa là sinh nhật ${name}`;
      badge = `<strong>${days}</strong><span>ngày nữa</span>`;
    } else {
      title = `Sinh nhật của ${name} vừa qua - quà vẫn còn hiệu lực`;
      badge = `${ICON_GIFT(34)}<span>Tuần sinh nhật</span>`;
    }

    host.innerHTML = `
      <div class="bday-countdown is-celebrate">
        <div class="bday-countdown-num">${badge}</div>
        <div class="bday-countdown-body">
          <h3>${title}</h3>
          <p>Bạn đang trong tuần sinh nhật: mở trang Tài khoản để mã quà giảm ${BIRTHDAY_DISCOUNT}% được gửi vào ví (mỗi năm 1 mã).</p>
          <div class="newcomer-actions">${walletBtn}</div>
        </div>
      </div>`;
    return;
  }

  const opensOn = next ? new Date(next.getFullYear(), next.getMonth(), next.getDate() - BIRTHDAY_WINDOW) : null;
  const progress = Math.max(2, Math.round((1 - days / 366) * 100));
  host.innerHTML = `
    <div class="bday-countdown">
      <div class="bday-countdown-num"><strong>${days}</strong><span>ngày nữa</span></div>
      <div class="bday-countdown-body">
        <h3>${name} ơi, còn ${days} ngày tới sinh nhật${next ? ` (${formatDayMonth(next)})` : ""}</h3>
        <p>Mã quà giảm ${BIRTHDAY_DISCOUNT}% sẽ vào ví từ ngày ${opensOn ? formatDay(opensOn) : "7 ngày trước sinh nhật"} khi bạn đăng nhập.</p>
        <div class="bday-progress" role="img" aria-label="Đã qua ${progress}% chặng đường tới sinh nhật">
          <span style="width: ${progress}%"></span>
        </div>
      </div>
    </div>`;
}

/* =========================================================
   MÃ GIẢM GIÁ ĐANG PHÁT HÀNH
   ========================================================= */

function renderVouchers() {
  const host = $("voucher-grid");
  if (!host) return;

  if (state.vouchersError) return fillGrid(host, [], errorWithRetry(state.vouchersError));
  if (!state.vouchers) return fillGrid(host, [], loadingHtml("Đang tải mã giảm giá..."), { busy: true });

  fillGrid(host, state.vouchers.map((voucher) => couponHtml(voucher)), emptyHtml(
    "Hiện chưa có mã giảm giá công khai nào. Đăng ký thành viên để nhận mã riêng và quà sinh nhật!",
    ICON_TAG(32),
  ));
}

/* =========================================================
   TẢI DỮ LIỆU & KHỞI ĐỘNG
   ========================================================= */

function renderAll() {
  renderStats();
  renderPrograms();
  renderNewDrinks();
  renderNewcomerPublic();
  renderNewcomerMember();
  renderTiers();
  renderBirthdayStatus();
  renderVouchers();
}

/** Tải thực đơn + mã công khai song song; nguồn nào lỗi thì chỉ khối đó báo lỗi */
async function loadData() {
  Object.assign(state, { drinks: null, drinksError: "", vouchers: null, vouchersError: "" });
  renderAll();

  const [drinksResult, vouchersResult] = await Promise.allSettled([getAllDrinks(), getPublicVouchers()]);

  if (drinksResult.status === "fulfilled") {
    state.drinks = Array.isArray(drinksResult.value) ? drinksResult.value : [];
  } else {
    state.drinksError = drinksResult.reason?.message || "Không tải được thực đơn từ máy chủ.";
  }
  if (vouchersResult.status === "fulfilled") {
    state.vouchers = Array.isArray(vouchersResult.value) ? vouchersResult.value : [];
  } else {
    state.vouchersError = vouchersResult.reason?.message || "Không tải được mã giảm giá từ máy chủ.";
  }
  renderAll();
}

function setupEvents() {
  document.addEventListener("click", (e) => {
    const copyBtn = e.target.closest("[data-copy-code]");
    if (copyBtn) {
      handleCopy(copyBtn);
      return;
    }
    const chip = e.target.closest("#tier-filter .tier-chip");
    if (chip) {
      selectTier(chip.dataset.tier);
      return;
    }
    if (e.target.closest('[data-action="reload"]')) loadData();
  });

  // Đăng nhập / đăng xuất -> vẽ lại các khối phụ thuộc thành viên.
  // customerAuth.js phát "customerchange" cả khi phiên đổi ở TAB KHÁC (nó tự nghe sự kiện "storage").
  window.addEventListener("customerchange", () => {
    renderNewcomerMember();
    renderBirthdayStatus();
  });

  // Thẻ món có nhãn song ngữ (drinkCard.js) -> đổi ngôn ngữ thì vẽ lại 2 lưới món
  window.addEventListener("languagechange", () => {
    renderNewDrinks();
    renderSaleGrid(state.drinks ? tierSaleItems() : []);
  });
}

function init() {
  state.tier = initialTier();
  renderTierLegend();
  renderBirthdayProgram();
  setupEvents();
  loadData();
}

init();

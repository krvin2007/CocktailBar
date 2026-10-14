/* =========================================================
   HOME.JS - Logic riêng cho trang chủ (index.html)
     1. Slider banner quảng cáo (bảng banners) ngay dưới hero
     2. Dải danh mục dẫn sang thực đơn có sẵn bộ lọc
     3. "Nổi Bật — Bán Chạy Nhất": xếp hạng theo số ly bán thật
        (rankBestSellers), chưa có dữ liệu bán -> món Signature
     4. "Món Mới Nhất": món vừa thêm vào thực đơn (getNewestDrinks)
     5. Dải ưu đãi: khách hàng mới, quà sinh nhật, sale theo món
     6. Số liệu hero + mô hình không gian 3D
   Đổi ngôn ngữ (sự kiện "languagechange") -> vẽ lại toàn bộ phần chữ.
   ========================================================= */

import "../modules/navbar.js";
import {
  getAllDrinks, CATEGORY_LABELS, getCategoryLabel,
  rankBestSellers, getNewestDrinks, getDrinkPricing, NEW_DRINK_DAYS, NEW_DRINK_DISCOUNT,
} from "../modules/drinksService.js";
import { getAllOrders } from "../modules/ordersService.js";
import { drinkCardHtml } from "../modules/drinkCard.js";
import { ICONS } from "../modules/icons.js";
import { loadingHtml, errorHtml } from "../modules/ui.js";
import { initLounge3D } from "../modules/lounge3d.js";
import { initBannerSlider } from "../modules/bannerSlider.js";
import { escapeHtml, formatDate } from "../modules/utils.js";
import { getCurrentLang, t } from "../modules/i18n.js";

/** Số món hiển thị ở mỗi khối "Bán chạy" / "Món mới" */
const HOME_LIMIT = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Mức ưu đãi mặc định - được thay bằng số liệu thật của vouchersService khi nạp xong:
 * welcome/birthday = WELCOME_DISCOUNT/BIRTHDAY_DISCOUNT, newCode = mã công khai cho khách mới (VD BANMOI10).
 */
const offerConfig = { welcome: 15, birthday: 25, newCode: "", newCodePct: 0 };

const CATEGORY_ICONS = {
  classic: ICONS.cocktail(20),
  signature: ICONS.sparkle(20),
  "sour-fizz": `<svg class="ui-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 2h8l-1.5 18a2 2 0 0 1-2 2H9.5a2 2 0 0 1-2-2L6 2zM5 7h14M12 2v5"/></svg>`,
  aperitivo: ICONS.wine(20),
  spirits: `<svg class="ui-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4h14l-1.5 15a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8L5 4zM6 9h12"/><circle cx="12" cy="14" r="2"/></svg>`,
};

const ICON_GIFT = `<svg class="ui-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>`;
const ICON_TAG = `<svg class="ui-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5"/></svg>`;

/* ---------------- Chuỗi giao diện song ngữ của các khối mới ----------------
   i18n.js có key "home_*" thì ưu tiên dùng (qua t()), chưa có thì lấy bảng này. */
const HOME_TEXT = {
  vi: {
    best_kicker: "BEST SELLERS",
    best_title: "Nổi Bật — Bán Chạy Nhất",
    best_sub: "Bảng xếp hạng theo số ly khách đã gọi thực tế tại quán (không tính đơn đã huỷ)",
    best_fallback_note: "Quán chưa ghi nhận lượt bán nào - dưới đây là các món Signature do Bartender đề xuất.",
    rank_label: "Hạng {n}",
    sold: "Đã bán {n} ly",
    pick_label: "Gợi ý",
    new_kicker: "NEW ARRIVALS",
    new_title: "Món Mới Nhất",
    new_sub: "Công thức vừa ra mắt tại quầy bar - món mới được giảm {pct}% trong {days} ngày đầu",
    new_btn: "Xem tất cả",
    launched_today: "Ra mắt hôm nay",
    launched_days: "Ra mắt {n} ngày trước",
    launched_on: "Ra mắt {date}",
    launched_unknown: "Có trong thực đơn",
    empty_newest: "Thực đơn chưa có món nào.",
    offers_kicker: "MEMBER PERKS & OFFERS",
    offers_title: "Ưu Đãi Đang Diễn Ra",
    offers_sub: "Trở thành thành viên để nhận quà chào mừng, mã sinh nhật và săn sale mỗi đêm",
    offer_new_kicker: "Khách hàng mới",
    offer_new_title: "Quà chào mừng thành viên",
    offer_new_desc: "Đăng ký thành viên nhận ngay mã giảm {pct}% dùng cho đơn đầu tiên, hạn 30 ngày.",
    offer_new_code: "Chưa đăng ký? Nhập mã {code} để giảm {pct}% đơn đầu tiên.",
    offer_new_link: "Đăng ký thành viên",
    offer_bday_kicker: "Sinh nhật",
    offer_bday_title: "Mã giảm giá sinh nhật",
    offer_bday_desc: "Thành viên tự nhận mã giảm {pct}% khi đăng nhập trong khoảng 7 ngày trước và sau sinh nhật.",
    offer_bday_link: "Nhận quà sinh nhật",
    offer_sale_kicker: "Sale theo món",
    offer_sale_title: "Cocktail giảm giá mỗi đêm",
    offer_sale_desc: "Hiện có {count} món đang giảm giá, sâu nhất {max}%. Món mới ra mắt tự giảm {newPct}% trong {days} ngày đầu.",
    offer_sale_desc_none: "Mỗi món có mức sale riêng từ 10% đến 35%. Món mới ra mắt tự giảm {newPct}% trong {days} ngày đầu.",
    offer_sale_value_none: "Sale",
    offer_sale_link: "Xem món đang sale",
  },
  en: {
    best_kicker: "BEST SELLERS",
    best_title: "Highlights — Best Sellers",
    best_sub: "Ranked by the real number of glasses our guests have ordered (cancelled orders excluded)",
    best_fallback_note: "No sales recorded yet - here are the Signature drinks recommended by our bartenders.",
    rank_label: "Rank {n}",
    sold: "{n} glasses sold",
    pick_label: "Bartender's pick",
    new_kicker: "NEW ARRIVALS",
    new_title: "Newest Drinks",
    new_sub: "Freshly launched recipes - new drinks are {pct}% off for their first {days} days",
    new_btn: "View all",
    launched_today: "Launched today",
    launched_days: "Launched {n} days ago",
    launched_on: "Launched {date}",
    launched_unknown: "On the menu",
    empty_newest: "The menu has no drinks yet.",
    offers_kicker: "MEMBER PERKS & OFFERS",
    offers_title: "Current Offers",
    offers_sub: "Join our membership for a welcome gift, a birthday code and nightly sales",
    offer_new_kicker: "New guests",
    offer_new_title: "Member welcome gift",
    offer_new_desc: "Sign up and instantly receive a {pct}% code for your first order, valid for 30 days.",
    offer_new_code: "Not a member yet? Use code {code} for {pct}% off your first order.",
    offer_new_link: "Become a member",
    offer_bday_kicker: "Birthday",
    offer_bday_title: "Birthday discount code",
    offer_bday_desc: "Members automatically get a {pct}% code when signing in within 7 days before or after their birthday.",
    offer_bday_link: "Claim your birthday gift",
    offer_sale_kicker: "Drink sales",
    offer_sale_title: "Cocktails on sale nightly",
    offer_sale_desc: "{count} drinks are on sale right now, up to {max}% off. New drinks are {newPct}% off for their first {days} days.",
    offer_sale_desc_none: "Each drink has its own 10%–35% sale tier. New drinks are {newPct}% off for their first {days} days.",
    offer_sale_value_none: "Sale",
    offer_sale_link: "See drinks on sale",
  },
};

/** Lấy chuỗi theo ngôn ngữ hiện tại, thay {biến} bằng giá trị (giá trị đã được escape/định dạng sẵn) */
function ht(key, vars = {}) {
  const dict = HOME_TEXT[getCurrentLang()] || HOME_TEXT.vi;
  const template = t(`home_${key}`, dict[key] ?? HOME_TEXT.vi[key] ?? "");
  return template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ""));
}

const formatCount = (n) => Number(n || 0).toLocaleString(getCurrentLang() === "en" ? "en-US" : "vi-VN");

/** Dữ liệu đã tải - giữ lại để vẽ lại khi đổi ngôn ngữ mà không gọi API lần nữa */
let homeData = null;

/* ---------------- Chữ tĩnh của các khối mới ---------------- */
function applyHomeTexts() {
  document.querySelectorAll("[data-home-i18n]").forEach((el) => {
    el.textContent = ht(el.dataset.homeI18n, { pct: NEW_DRINK_DISCOUNT, days: NEW_DRINK_DAYS });
  });
}

/* ---------------- Dải danh mục ---------------- */
function renderCategoryStrip() {
  const host = document.getElementById("category-strip");
  if (!host) return;

  host.innerHTML = Object.keys(CATEGORY_LABELS).map((key) => `
    <a class="category-chip" href="menu.html?category=${key}">
      <span class="category-chip-icon">${CATEGORY_ICONS[key] || ICONS.cocktail(20)}</span>
      <span class="category-chip-label">${getCategoryLabel(key)}</span>
      <span class="category-chip-arrow">${ICONS.arrowRight(13)}</span>
    </a>`).join("");
}

/** Gắn danh sách thẻ vào lưới; role="list" chỉ bật khi lưới thật sự chứa các thẻ món */
function fillGrid(host, itemsHtml, emptyHtml) {
  if (itemsHtml.length) {
    host.setAttribute("role", "list");
    host.innerHTML = itemsHtml.join("");
  } else {
    host.removeAttribute("role");
    host.innerHTML = emptyHtml;
  }
}

function emptyStateHtml(message) {
  return `
    <div class="empty-state">
      <div class="empty-icon">${ICONS.cocktail(32)}</div>
      <p>${escapeHtml(message)}</p>
    </div>`;
}

/* ---------------- Nổi Bật — Bán Chạy Nhất ---------------- */

/**
 * Danh sách món cho khối "Bán chạy": hạng #1..#4 theo số ly bán thật.
 * Bán được ít hơn 4 món -> bù bằng món Signature (không đánh số hạng).
 * @returns {{ picks: Array<{drink, rank, sold}>, hasSales: boolean }}
 */
function buildBestSellerPicks(drinks, orders) {
  const picks = rankBestSellers(drinks, orders, HOME_LIMIT)
    .filter(({ sold }) => sold > 0)
    .map(({ drink, sold }, i) => ({ drink, sold, rank: i + 1 }));
  const hasSales = picks.length > 0;

  if (picks.length < HOME_LIMIT) {
    const used = new Set(picks.map(({ drink }) => String(drink.id)));
    drinks
      .filter((d) => d.featured && !used.has(String(d.id)))
      .slice(0, HOME_LIMIT - picks.length)
      .forEach((drink) => picks.push({ drink, sold: 0, rank: 0 }));
  }
  return { picks, hasSales };
}

function bestPickHtml({ drink, sold, rank }) {
  const head = rank > 0
    ? `<span class="home-rank" title="${escapeHtml(ht("rank_label", { n: rank }))}"><small>#</small>${rank}</span>
       <span class="home-pick-pill">${ICONS.flame(13)} <span>${ht("sold", { n: `<strong>${formatCount(sold)}</strong>` })}</span></span>`
    : `<span class="home-pick-label">${ICONS.sparkle(13)} ${escapeHtml(ht("pick_label"))}</span>
       <span class="home-pick-pill is-muted">${ICONS.star(12)} Signature</span>`;

  // Gọi drinkCardHtml với ĐÚNG 1 tham số (không truyền thẳng vào .map để tránh lọt chỉ số mảng)
  return `
    <div class="home-pick ${rank > 0 ? `is-rank-${rank}` : "is-suggested"}" role="listitem">
      <div class="home-pick-head">${head}</div>
      ${drinkCardHtml(drink)}
    </div>`;
}

function renderBestSellers({ drinks, orders }) {
  const host = document.getElementById("bestseller-grid");
  const note = document.getElementById("bestseller-note");
  if (!host) return;

  const { picks, hasSales } = buildBestSellerPicks(drinks, orders);
  fillGrid(host, picks.map(bestPickHtml), emptyStateHtml(t("empty_featured", "Danh sách món nổi bật đang được cập nhật.")));

  if (note) {
    note.hidden = hasSales || picks.length === 0;
    note.textContent = ht("best_fallback_note");
  }
}

/* ---------------- Món Mới Nhất ---------------- */

/** Nhãn ngày ra mắt: "Ra mắt hôm nay" / "Ra mắt 3 ngày trước" / "Ra mắt 12/05/2026" */
function launchLabel(createdAt, now = Date.now()) {
  const time = new Date(createdAt).getTime();
  if (Number.isNaN(time) || time > now) return ht("launched_unknown");

  const days = Math.floor((now - time) / DAY_MS);
  if (days === 0) return ht("launched_today");
  if (days < 30) return ht("launched_days", { n: days });
  return ht("launched_on", { date: formatDate(createdAt) });
}

function newestPickHtml(drink, now) {
  return `
    <div class="home-pick is-newest" role="listitem">
      <div class="home-pick-head">
        <span class="home-pick-pill is-muted">${ICONS.calendar(13)} <span>${escapeHtml(launchLabel(drink.createdAt, now))}</span></span>
      </div>
      ${drinkCardHtml(drink)}
    </div>`;
}

function renderNewest({ drinks }) {
  const host = document.getElementById("newest-grid");
  if (!host) return;

  const now = Date.now();
  const items = getNewestDrinks(drinks, HOME_LIMIT).map((drink) => newestPickHtml(drink, now));
  fillGrid(host, items, emptyStateHtml(ht("empty_newest")));
}

/* ---------------- Dải ưu đãi ---------------- */

/** Thống kê món đang sale (dựa trên giá sau giảm thật của từng món) */
function getSaleStats(drinks = []) {
  const percents = drinks.map((d) => getDrinkPricing(d).percent).filter((p) => p > 0);
  if (!percents.length) return { count: 0, min: 0, max: 0 };
  return { count: percents.length, min: Math.min(...percents), max: Math.max(...percents) };
}

function offerCardHtml({ href, icon, value, kicker, title, desc, link }) {
  return `
    <a class="offer-card" href="${href}">
      <div class="offer-card-top">
        <span class="offer-card-icon">${icon}</span>
        <span class="offer-card-value">${escapeHtml(value)}</span>
      </div>
      <span class="offer-card-kicker">${escapeHtml(kicker)}</span>
      <h3 class="offer-card-title">${escapeHtml(title)}</h3>
      <p class="offer-card-desc">${escapeHtml(desc)}</p>
      <span class="offer-card-link">${escapeHtml(link)} ${ICONS.arrowRight(14)}</span>
    </a>`;
}

function renderOffers(drinks) {
  const host = document.getElementById("offer-strip");
  if (!host) return;

  const stats = getSaleStats(drinks || []);
  const saleValue = stats.count === 0
    ? ht("offer_sale_value_none")
    : stats.min === stats.max ? `-${stats.max}%` : `${stats.min}–${stats.max}%`;
  const saleVars = { count: stats.count, max: stats.max, newPct: NEW_DRINK_DISCOUNT, days: NEW_DRINK_DAYS };

  host.innerHTML = [
    {
      href: "account.html",
      icon: ICONS.user(20),
      value: `-${offerConfig.welcome}%`,
      kicker: ht("offer_new_kicker"),
      title: ht("offer_new_title"),
      desc: [
        ht("offer_new_desc", { pct: offerConfig.welcome }),
        offerConfig.newCode ? ht("offer_new_code", { code: offerConfig.newCode, pct: offerConfig.newCodePct }) : "",
      ].filter(Boolean).join(" "),
      link: ht("offer_new_link"),
    },
    {
      href: "account.html",
      icon: ICON_GIFT,
      value: `-${offerConfig.birthday}%`,
      kicker: ht("offer_bday_kicker"),
      title: ht("offer_bday_title"),
      desc: ht("offer_bday_desc", { pct: offerConfig.birthday }),
      link: ht("offer_bday_link"),
    },
    {
      href: "sale.html",
      icon: ICON_TAG,
      value: saleValue,
      kicker: ht("offer_sale_kicker"),
      title: ht("offer_sale_title"),
      desc: ht(stats.count ? "offer_sale_desc" : "offer_sale_desc_none", saleVars),
      link: ht("offer_sale_link"),
    },
  ].map(offerCardHtml).join("");
}

/**
 * Lấy mức giảm thật (khách mới / sinh nhật) và mã công khai dành cho khách mới
 * từ vouchersService bằng import động: module khuyến mãi lỗi hay chưa có bảng
 * vouchers thì trang chủ vẫn chạy bình thường với số mặc định.
 */
async function loadOfferConfig() {
  let vouchersModule;
  try {
    vouchersModule = await import("../modules/vouchersService.js");
  } catch (err) {
    console.warn("[home] Không nạp được vouchersService, dùng mức ưu đãi mặc định:", err.message);
    return;
  }

  const { WELCOME_DISCOUNT, BIRTHDAY_DISCOUNT, getPublicVouchers } = vouchersModule;
  if (Number(WELCOME_DISCOUNT) > 0) offerConfig.welcome = Number(WELCOME_DISCOUNT);
  if (Number(BIRTHDAY_DISCOUNT) > 0) offerConfig.birthday = Number(BIRTHDAY_DISCOUNT);

  try {
    const vouchers = typeof getPublicVouchers === "function" ? await getPublicVouchers() : [];
    const welcomeCode = vouchers.find((v) => v.audience === "new-customer");
    if (welcomeCode) {
      offerConfig.newCode = String(welcomeCode.code || "");
      offerConfig.newCodePct = Number(welcomeCode.percent) || 0;
    }
  } catch (err) {
    console.warn("[home] Không tải được mã giảm giá công khai:", err.message);
  }
  renderOffers(homeData?.drinks);
}

/* ---------------- Số liệu hero ---------------- */
function renderStats(drinks, orders) {
  const drinksEl = document.getElementById("stat-drinks");
  const ordersEl = document.getElementById("stat-orders");

  if (drinksEl) drinksEl.textContent = drinks.length;
  if (ordersEl) {
    // Số liệu thật từ máy chủ, không cộng thêm số "trang trí"
    ordersEl.textContent = orders.filter((o) => o.status === "completed").length;
  }
}

/* ---------------- Tải dữ liệu ---------------- */

/**
 * Tải đồng thời đồ uống + đơn hàng bằng Promise.all (2 request chạy song song).
 * Đơn hàng lỗi không chặn trang: coi như chưa có lượt bán -> khối "Bán chạy" dùng món Signature.
 */
async function loadHomeData() {
  const grids = ["bestseller-grid", "newest-grid"].map((id) => document.getElementById(id)).filter(Boolean);
  grids.forEach((host) => {
    host.removeAttribute("role");
    host.setAttribute("aria-busy", "true");
    host.innerHTML = loadingHtml();
  });

  try {
    const [drinks, orders] = await Promise.all([
      getAllDrinks(),
      getAllOrders().catch((err) => {
        console.warn("[home] Không tải được đơn hàng, bỏ qua xếp hạng bán chạy:", err.message);
        return [];
      }),
    ]);
    homeData = { drinks, orders };
    renderBestSellers(homeData);
    renderNewest(homeData);
    renderOffers(drinks);
    renderStats(drinks, orders);
  } catch (err) {
    grids.forEach((host) => { host.innerHTML = errorHtml(escapeHtml(err.message)); });
    renderOffers([]);
  } finally {
    grids.forEach((host) => host.removeAttribute("aria-busy"));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  applyHomeTexts();
  renderCategoryStrip();
  renderOffers([]); // vẽ ngay khung ưu đãi với số mặc định, cập nhật khi có dữ liệu
  initBannerSlider("banner-slider");
  loadHomeData();
  loadOfferConfig();
  initLounge3D("lounge-3d-mount");

  // Slider banner tự cập nhật chữ khi đổi ngôn ngữ; ở đây vẽ lại các khối còn lại
  window.addEventListener("languagechange", () => {
    applyHomeTexts();
    renderCategoryStrip();
    renderOffers(homeData?.drinks);
    if (homeData) {
      renderBestSellers(homeData);
      renderNewest(homeData);
    }
  });
});

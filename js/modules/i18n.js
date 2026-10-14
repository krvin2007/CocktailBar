/* =========================================================
   I18N.JS - Quản lý đa ngôn ngữ Tiếng Việt (VI) & Tiếng Anh (EN)
   100% Thuần Vanilla JS, lưu trữ qua localStorage, tự động
   đồng bộ giao diện, thẻ HTML lang và phát sự kiện languagechange.
   ========================================================= */

import { toast } from "./ui.js";

const STORAGE_KEY = "site_language";
export const SUPPORTED_LANGS = ["vi", "en"];

export const TRANSLATIONS = {
  vi: {
    // Thanh điều hướng (Navbar)
    nav_home: "Trang chủ",
    nav_menu: "Menu",
    nav_spirits: "Hầm Rượu",
    nav_bartenders: "Master Bartenders",
    nav_collectors: "Nhà Sưu Tầm",
    nav_order: "Đặt bàn & Gọi món",
    nav_contact: "Liên hệ",
    nav_sale: "Khuyến mãi",
    nav_account: "Thành viên",
    nav_account_title: "Đăng nhập / Đăng ký thành viên",
    nav_admin: "Quản trị",
    brand_title: "Quán Bar Đêm",
    brand_subtitle: "Artisan Cocktail Lounge",
    cart_title: "Xem giỏ hàng",
    lang_switch_title: "Chuyển sang Tiếng Anh (EN)",

    // Chân trang (Footer)
    footer_desc: "Không gian thưởng thức cocktail thủ công tinh tuyển, nơi kết hợp giữa nghệ thuật pha chế cổ điển và hơi thở đô thị về đêm.",
    footer_badge_speakeasy: "Speakeasy Lounge",
    footer_badge_cocktails: "Artisan Cocktails",
    footer_badge_jazz: "Live Jazz Nights",
    footer_col_experience: "Trải nghiệm & Di sản",
    footer_link_menu: "Menu thức uống",
    footer_link_sale: "Khuyến mãi & Mã giảm giá",
    footer_link_account: "Thành viên & Quà sinh nhật",
    footer_link_spirits: "Hầm rượu di sản & Hương vị",
    footer_link_bartenders: "Huyền thoại Master Bartenders",
    footer_link_collectors: "Nhà sưu tầm rượu lừng danh",
    footer_link_order: "Đặt bàn trước & Gọi món",
    footer_link_contact: "Tổ chức sự kiện riêng tư",
    footer_col_info: "Thông tin & Giờ phục vụ",
    footer_address: "123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM",
    footer_hours: "18:00 – 02:00 mỗi đêm (Bao gồm ngày lễ)",
    footer_admin: "Cổng Quản Trị",
    footer_tagline: "Đỉnh cao nghệ thuật cocktail thủ công Sài Gòn",

    // Hero Section
    hero_kicker: "ARTISAN COCKTAIL LOUNGE · SÀI GÒN",
    hero_title: "Quán Bar Đêm",
    hero_lead: "Nơi mỗi ly cocktail là một bản giao hưởng giữa rượu hảo hạng, thảo mộc tươi và sự yên tĩnh đầy mê hoặc của thành phố về đêm.",
    hero_btn_menu: "Xem Menu",
    hero_btn_3d: "Khám Phá Không Gian 3D",
    hero_btn_order: "Đặt Bàn Tối Nay",

    // Quyển Menu Lật 3D (Flipbook)
    menu_book_kicker: "SPEAKEASY COCKTAIL BOOK",
    menu_book_title: "Quyển Menu Cocktail Bìa Da 3D",
    menu_book_sub: "Lật từng trang như cuốn menu bìa da ngoài đời thực để khám phá 30 công thức cocktail & rượu di sản độc bản.",
    btn_mode_book: "Quyển Menu Lật 3D",
    btn_mode_grid: "Bộ Lọc & Tìm Kiếm",
    book_open_cover: "Chạm để mở menu",
    book_close_cover: "Gấp menu lại",
    book_prev_page: "Trang trước",
    book_next_page: "Trang sau",
    book_page: "Trang",
    book_sound_on: "Âm thanh lật giấy: Bật",
    book_sound_off: "Âm thanh lật giấy: Tắt",
    book_jump_cover: "Bìa",
    book_jump_toc: "Mục lục",
    book_jump_signature: "Signature",
    book_jump_classic: "Classic",
    book_jump_sour: "Sour & Spritz",
    book_jump_spirits: "Hầm Rượu",
    book_jump_back: "Bìa Sau",
    book_hint: "💡 Mẹo: Nhấp chuột mép trang, vuốt màn hình hoặc dùng phím ← / → để lật trang",
    book_quick_order: "Thêm vào giỏ",
    book_view_detail: "Xem chi tiết",
    stat_drinks: "Món Đặc Tuyển",
    stat_orders: "Lượt Phục Vụ",
    stat_hours: "Giờ Mở Cửa Đêm",
    stat_craft: "Pha Chế Thủ Công",

    // Section Categories & Featured
    sec_curated_kicker: "CURATED EXPERIENCES",
    sec_curated_title: "Bộ Sưu Tập Đồ Uống",
    sec_curated_sub: "Lựa chọn ly nước phù hợp với tâm trạng và gu thưởng thức của bạn",
    sec_featured_kicker: "SIGNATURE COCKTAILS",
    sec_featured_title: "Được Yêu Thích Nhất",
    sec_featured_sub: "Những công thức độc bản được sáng tạo và hoàn thiện qua nhiều năm bởi đội ngũ Bartender",
    btn_explore_all_menu: "Khám Phá Toàn Bộ Menu",

    // Spotlight Hầm Rượu
    spirits_spotlight_kicker: "CONNOISSEUR ARCHIVE",
    spirits_spotlight_title: "Hầm Rượu Di Sản & Bản Đồ Hương Vị",
    spirits_spotlight_desc: "Khám phá tiểu sử hào hùng, bí quyết chưng cất nồi đồng và bản đồ 3 tầng hương vị (Khứu giác - Vị giác - Hậu vị) của những chai rượu huyền thoại: The Macallan 18, Hennessy X.O, Don Julio 1942, Monkey 47...",
    spirits_spotlight_btn: "Tham Quan Phòng Trưng Bày Rượu",
    spirits_stat_bottles: "Chai Di Sản",
    spirits_stat_steps: "Nếm Sommelier",

    // 3D Virtual Lounge
    lounge_kicker: "3D VIRTUAL EXPERIENCE",
    lounge_heading: "Mô Hình Không Gian 3D",
    lounge_heading_em: "Quán Bar Đêm",
    lounge_sub: "Khám phá phối cảnh 3D tương tác và góc nhìn thực tế 8K từng phân khu: Quầy pha chế, Khu Sofa VIP, Sân khấu DJ, Bàn cao view đêm và Tủ rượu di sản.",
    btn_orbit_mode: "Mô hình 3D xoay",
    btn_real_mode: "Ảnh không gian thực tế",
    preset_all: "Toàn Cảnh 3D",
    preset_bar: "Quầy Bar",
    preset_vip: "Sofa VIP",
    preset_dj: "Sân Khấu DJ",
    preset_high: "Bàn Cao",
    preset_cellar: "Hầm Rượu",
    orbit_on: "Tự động xoay: Bật",
    orbit_off: "Tự động xoay: Tắt",
    btn_reset_cam: "Góc chuẩn",
    spec_capacity: "Sức Chứa",
    spec_ambience: "Phong Cách",
    spec_music: "Âm Nhạc",
    spec_lighting: "Ánh Sáng",
    ideal_experience: "Trải nghiệm lý tưởng:",
    btn_book_zone: "Đặt Chỗ Tại Khu Vực Này",
    btn_zoom_photo: "Xem ảnh lớn",
    btn_zoom_main: "Xem Cận Cảnh Toàn Màn Hình",
    real_view_live: "Ảnh thực tế tại quán",
    live_status: "Đang phục vụ tối nay",
    lounge_hint: "Kéo thả chuột hoặc vuốt để xoay không gian 3D • Click điểm ghim để xem khu vực",
    hotline_vip: "Hotline tư vấn vị trí VIP:",

    // About Section
    about_kicker: "OUR PHILOSOPHY",
    about_title: "Hơi Thở Speakeasy Giữa Lòng Thành Phố",
    about_highlight: "Được thành lập từ năm 2019, Quán Bar Đêm được định vị là chốn dừng chân ấm cúng dành cho những ai trân trọng giá trị nguyên bản của nghệ thuật pha chế.",
    about_desc: "Chúng tôi tin rằng cocktail không chỉ đơn thuần là đồ uống có cồn, mà là sự cân bằng tuyệt đối của nhiệt độ, độ pha loãng của đá thủ công và hương vị tự nhiên của thảo mộc tươi.",
    about_feat_1_title: "Nguyên Liệu Tự Nhiên & Rượu Chuẩn Nguồn",
    about_feat_1_desc: "Nước ép quả tươi ép trong ngày, siro hoa quả tự nấu và rượu nền nhập khẩu chính ngạch.",
    about_feat_2_title: "Đá Viên Cắt Tay Trong Suốt",
    about_feat_2_desc: "Khối đá được tinh lọc và gọt tay tỉ mỉ, tan cực chậm để giữ vị rượu nguyên bản đến giọt cuối cùng.",
    about_feat_3_title: "Đặt Bàn Nhanh & Giữ Vị Trí Ưa Thích",
    about_feat_3_desc: "Chọn quầy bar để theo dõi pha chế trực tiếp, hoặc bàn sofa riêng tư cho những cuộc trò chuyện sâu lắng.",

    // Heritage Section
    heritage_kicker: "HERITAGE & CULTURE",
    heritage_title: "Di Sản & Những Huyền Thoại Quầy Bar",
    heritage_sub: "Khám phá những bộ óc sáng tạo vĩ đại đã định hình nghệ thuật cocktail và những nhà sưu tầm cất giữ các hầm rượu vô giá của nhân loại.",
    card_bartenders_title: "Huyền Thoại Master Bartenders",
    card_bartenders_desc: "Chiêm ngưỡng chân dung, triết lý phục vụ và công thức kinh điển của những bậc thầy như Salvatore Calabrese, Ada Coleman, Dale DeGroff và Harry Craddock.",
    card_bartenders_btn: "Khám Phá Master Bartenders",
    card_collectors_title: "Nhà Sưu Tầm Rượu Lừng Danh",
    card_collectors_desc: "Bước vào những hầm rượu bảo mật triệu đô lưu giữ Macallan 1926, Cognac 1789 và những mẻ thùng đơn độc bản từ các lò chưng cất đã vĩnh viễn đóng cửa.",
    card_collectors_btn: "Khám Phá Nhà Sưu Tầm",

    // CTA
    cta_badge: "RESERVATIONS & PRIVATE EVENTS",
    cta_title: "Dành Cho Những Buổi Hẹn Đầy Cảm Xúc",
    cta_desc: "Dù bạn tìm kiếm một góc riêng tư thư giãn sau giờ làm việc, một buổi hẹn hò lãng mạn hay bữa tiệc kỷ niệm ấm cúng cùng bạn bè, Quán Bar Đêm luôn sẵn sàng chuẩn bị không gian ưng ý nhất.",
    cta_btn: "Đặt Bàn Giữ Chỗ Tối Nay",

    // Toast thông báo
    lang_switched_toast: "Đã chuyển sang Tiếng Việt",

    badge_soldout: "Tạm hết món",
    badge_featured: "Signature",
    abv_tooltip: "Nồng độ cồn",
    rating_tooltip: "Đánh giá",
    empty_featured: "Danh sách món nổi bật đang được cập nhật.",

    // Quản trị
    admin_brand_badge: "Bảng điều hành",
    admin_back_link: "Về trang khách hàng",
    admin_logout: "Đăng xuất",
    admin_menu_dash: "Tổng quan & Thống kê",
    admin_menu_drinks: "Quản lý thực đơn",
    admin_menu_orders: "Quản lý đơn hàng",
    admin_menu_banners: "Banner quảng cáo",
    admin_menu_vouchers: "Mã giảm giá & Sale",
    admin_menu_customers: "Khách hàng thành viên",
    admin_menu_staff: "Quản lý nhân viên",
    admin_menu_messages: "Hộp thư liên hệ",
    admin_new_messages: "tin nhắn mới"
  },
  en: {
    // Navbar
    nav_home: "Home",
    nav_menu: "Menu",
    nav_spirits: "Spirits Vault",
    nav_bartenders: "Master Bartenders",
    nav_collectors: "Collectors",
    nav_order: "Reservation & Order",
    nav_contact: "Contact",
    nav_sale: "Offers",
    nav_account: "Member",
    nav_account_title: "Sign in / Join membership",
    nav_admin: "Staff Portal",
    brand_title: "Night Bar Lounge",
    brand_subtitle: "Artisan Cocktail Lounge",
    cart_title: "View Cart",
    lang_switch_title: "Chuyển sang Tiếng Việt (VI)",

    // Footer
    footer_desc: "A refined speakeasy sanctuary where classical mixology meets the captivating rhythm and ambiance of urban nightlife.",
    footer_badge_speakeasy: "Speakeasy Lounge",
    footer_badge_cocktails: "Artisan Cocktails",
    footer_badge_jazz: "Live Jazz Nights",
    footer_col_experience: "Experiences & Heritage",
    footer_link_menu: "Curated Drink Collections",
    footer_link_sale: "Offers & Discount Codes",
    footer_link_account: "Membership & Birthday Gifts",
    footer_link_spirits: "Heritage Spirits Vault & Tasting",
    footer_link_bartenders: "Legendary Master Bartenders",
    footer_link_collectors: "World-Renowned Collectors",
    footer_link_order: "Table Reservation & Orders",
    footer_link_contact: "Private Event Inquiries",
    footer_col_info: "Hours & Location",
    footer_address: "123 Nguyen Hue Blvd, Ben Nghe Ward, Dist 1, HCMC",
    footer_hours: "18:00 – 02:00 Nightly (Including Holidays)",
    footer_admin: "Admin Portal",
    footer_tagline: "The Pinnacle of Saigon's Artisan Cocktail Artistry",

    // Hero Section
    hero_kicker: "ARTISAN COCKTAIL LOUNGE · SAIGON",
    hero_title: "Night Bar Lounge",
    hero_lead: "Where every cocktail is a symphony of rare spirits, fresh botanical aromatics, and the enchanting pulse of the midnight city.",
    hero_btn_menu: "Explore Menu",
    hero_btn_3d: "3D Virtual Lounge",
    hero_btn_order: "Book Tonight",

    // 3D Flipbook Menu
    menu_book_kicker: "SPEAKEASY COCKTAIL BOOK",
    menu_book_title: "3D Leather-Bound Cocktail Menu Book",
    menu_book_sub: "Flip through pages like a real leather-bound cocktail menu to discover 30 artisanal cocktails and heritage spirits.",
    btn_mode_book: "3D Book Flip View",
    btn_mode_grid: "Filter & Search View",
    book_open_cover: "Click to Open Menu",
    book_close_cover: "Close Menu Book",
    book_prev_page: "Previous Page",
    book_next_page: "Next Page",
    book_page: "Page",
    book_sound_on: "Paper Sound: On",
    book_sound_off: "Paper Sound: Off",
    book_jump_cover: "Cover",
    book_jump_toc: "Contents",
    book_jump_signature: "Signature",
    book_jump_classic: "Classic",
    book_jump_sour: "Sour & Spritz",
    book_jump_spirits: "Spirits Vault",
    book_jump_back: "Back Cover",
    book_hint: "💡 Tip: Click page corners, swipe, or use ← / → keys to turn pages",
    book_quick_order: "Add to Cart",
    book_view_detail: "View Details",
    stat_drinks: "Curated Cocktails",
    stat_orders: "Served Guests",
    stat_hours: "Nightly Hours",
    stat_craft: "Artisan Craft",

    // Section Categories & Featured
    sec_curated_kicker: "CURATED EXPERIENCES",
    sec_curated_title: "Drink Collections",
    sec_curated_sub: "Select the perfect drink tailored to your palate and midnight mood",
    sec_featured_kicker: "SIGNATURE COCKTAILS",
    sec_featured_title: "Best Sellers & Signatures",
    sec_featured_sub: "Exclusive bespoke recipes crafted and perfected over years by our master bartenders",
    btn_explore_all_menu: "Explore Full Menu",

    // Spotlight Hầm Rượu
    spirits_spotlight_kicker: "CONNOISSEUR ARCHIVE",
    spirits_spotlight_title: "Heritage Spirits Vault & Flavor Matrix",
    spirits_spotlight_desc: "Explore legendary single malt whiskies and rare cognacs with copper pot still distillation lore and 3-tier tasting notes (Nose - Palate - Finish): The Macallan 18, Hennessy X.O, Don Julio 1942, Monkey 47...",
    spirits_spotlight_btn: "Explore Spirits Gallery",
    spirits_stat_bottles: "Vintage Bottles",
    spirits_stat_steps: "Sommelier Steps",

    // 3D Virtual Lounge
    lounge_kicker: "3D VIRTUAL EXPERIENCE",
    lounge_heading: "3D Virtual Lounge",
    lounge_heading_em: "Speakeasy Bar",
    lounge_sub: "Explore interactive 3D perspective and 8K real photos of all 5 zones: Mixology Counter, VIP Sofa, DJ Stage, Skyline High Tables, and Heritage Spirits Vault.",
    btn_orbit_mode: "3D Orbit Model",
    btn_real_mode: "Real Bar Photos",
    preset_all: "Full 3D View",
    preset_bar: "Bar Counter",
    preset_vip: "VIP Sofa",
    preset_dj: "DJ Stage",
    preset_high: "High Tables",
    preset_cellar: "Spirits Vault",
    orbit_on: "Auto Orbit: On",
    orbit_off: "Auto Orbit: Off",
    btn_reset_cam: "Reset View",
    spec_capacity: "Capacity",
    spec_ambience: "Ambience",
    spec_music: "Music",
    spec_lighting: "Lighting",
    ideal_experience: "Ideal Experience:",
    btn_book_zone: "Reserve This Area",
    btn_zoom_photo: "Zoom Photo",
    btn_zoom_main: "8K Fullscreen View",
    real_view_live: "Real Bar View",
    live_status: "Serving Tonight",
    lounge_hint: "Drag or swipe to rotate 3D view • Click hotspot pins to explore areas",
    hotline_vip: "VIP Hotline:",

    // About Section
    about_kicker: "OUR PHILOSOPHY",
    about_title: "A Speakeasy Sanctuary in the Heart of the City",
    about_highlight: "Established in 2019, Night Bar Lounge is a cozy sanctuary dedicated to those who appreciate the authentic essence of mixology.",
    about_desc: "We believe cocktails are more than alcoholic beverages; they represent the precise balance of temperature, artisanal ice dilution, and botanical aromatics.",
    about_feat_1_title: "Natural Botanical Ingredients & Sourced Spirits",
    about_feat_1_desc: "Freshly pressed daily juices, house-simmered herbal syrups, and genuine imported base spirits.",
    about_feat_2_title: "Hand-Carved Crystal Clear Ice Blocks",
    about_feat_2_desc: "Slow-frozen pure blocks hand-carved to melt at ultra-slow rates, preserving drink integrity to the last drop.",
    about_feat_3_title: "Instant Reservations & Dedicated Seating",
    about_feat_3_desc: "Select the mixology counter for front-row action or private VIP leather booths for intimate conversations.",

    // Heritage Section
    heritage_kicker: "HERITAGE & CULTURE",
    heritage_title: "Heritage & Bar Legends",
    heritage_sub: "Discover the visionary minds that shaped cocktail history and the connoisseurs who preserve humanity's rarest spirits.",
    card_bartenders_title: "Legendary Master Bartenders",
    card_bartenders_desc: "Explore portraits, hospitality philosophies, and signature recipes of masters such as Salvatore Calabrese, Ada Coleman, Dale DeGroff, and Harry Craddock.",
    card_bartenders_btn: "Explore Master Bartenders",
    card_collectors_title: "World-Renowned Collectors",
    card_collectors_desc: "Step inside multimillion-dollar private vaults housing Macallan 1926, 1789 pre-phylloxera Cognacs, and lost distillery single casks.",
    card_collectors_btn: "Explore Collectors",

    // CTA
    cta_badge: "RESERVATIONS & PRIVATE EVENTS",
    cta_title: "Curated for Unforgettable Midnight Moments",
    cta_desc: "Whether you seek an intimate unwind after hours, a romantic evening, or a celebratory gathering with friends, our lounge is prepared to craft your finest experience.",
    cta_btn: "Reserve a Table Tonight",

    // Toast
    lang_switched_toast: "Language switched to English",

    badge_soldout: "Sold Out",
    badge_featured: "Signature",
    abv_tooltip: "Alcohol by Volume",
    rating_tooltip: "Rating",
    empty_featured: "Featured cocktails list is currently being updated.",

    // Admin
    admin_brand_badge: "Executive POS",
    admin_back_link: "Back to Website",
    admin_logout: "Sign Out",
    admin_menu_dash: "Dashboard & Analytics",
    admin_menu_drinks: "Menu Management",
    admin_menu_orders: "Order Management",
    admin_menu_banners: "Promo Banners",
    admin_menu_vouchers: "Vouchers & Sales",
    admin_menu_customers: "Members",
    admin_menu_staff: "Staff Management",
    admin_menu_messages: "Contact Messages",
    admin_new_messages: "new messages"
  }
};

/** Lấy ngôn ngữ hiện tại từ localStorage (mặc định 'vi') */
export function getCurrentLang() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return SUPPORTED_LANGS.includes(saved) ? saved : "vi";
}

/** Lấy chuỗi bản dịch theo key */
export function t(key, fallback = "") {
  const lang = getCurrentLang();
  return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.vi?.[key] ?? fallback;
}

/**
 * Đặt ngôn ngữ cụ thể
 * @param {"vi"|"en"} lang
 * @param {boolean} showNotice Có hiển thị thông báo toast hay không
 */
export function setLanguage(lang, showNotice = true) {
  if (!SUPPORTED_LANGS.includes(lang)) return;
  const prev = getCurrentLang();
  localStorage.setItem(STORAGE_KEY, lang);
  document.documentElement.setAttribute("lang", lang);

  applyI18n();

  window.dispatchEvent(new CustomEvent("languagechange", { detail: { lang, prev } }));

  if (showNotice && lang !== prev) {
    toast(TRANSLATIONS[lang].lang_switched_toast, "success");
  }
}

/** Chuyển đổi qua lại giữa VI và EN */
export function toggleLanguage() {
  const current = getCurrentLang();
  const next = current === "vi" ? "en" : "vi";
  setLanguage(next, true);
  return next;
}

/** Quét và tự động dịch mọi phần tử có thuộc tính data-i18n */
export function applyI18n(root = document) {
  const current = getCurrentLang();
  const dict = TRANSLATIONS[current] || TRANSLATIONS.vi;

  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key && dict[key]) {
      el.textContent = dict[key];
    }
  });

  root.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.getAttribute("data-i18n-html");
    if (key && dict[key]) {
      el.innerHTML = dict[key];
    }
  });

  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (key && dict[key]) {
      el.setAttribute("placeholder", dict[key]);
    }
  });

  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    if (key && dict[key]) {
      el.setAttribute("title", dict[key]);
    }
  });

  root.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    if (key && dict[key]) {
      el.setAttribute("aria-label", dict[key]);
    }
  });
}

// Khởi chạy ngầm khi module được nạp
if (typeof document !== "undefined") {
  document.documentElement.setAttribute("lang", getCurrentLang());
}

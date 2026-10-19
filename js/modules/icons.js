/* =========================================================
   ICONS.JS - Hệ thống biểu tượng SVG nét mảnh (Fine-line SVG)
   Chuẩn thiết kế cao cấp thay thế 100% Emoji thông thường.
   Đồng bộ nét vẽ 1.5px - 2px, kích thước tuỳ biến linh hoạt.
   ========================================================= */

const SVG_ATTRS = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';

export const ICONS = {
  cocktail: (size = 18, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <path d="M8 22h8m-4-7v7M4 4l8 8 8-8H4z"/>
    </svg>`,

  wine: (size = 18, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <path d="M8 22h8m-4-7v7m-5-8a5 5 0 0 0 10 0V3H7v6z"/>
    </svg>`,

  star: (size = 14, cls = "") => `
    <svg class="ui-icon ui-icon-star ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>`,

  clock: (size = 16, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>`,

  mapPin: (size = 16, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>`,

  phone: (size = 16, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>`,

  mail: (size = 16, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
    </svg>`,

  calendar: (size = 16, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>`,

  shoppingBag: (size = 16, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>`,

  check: (size = 16, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>`,

  checkCircle: (size = 18, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>`,

  alertCircle: (size = 18, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>`,

  info: (size = 18, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>`,

  user: (size = 16, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>`,

  users: (size = 16, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>`,

  search: (size = 16, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>`,

  refresh: (size = 14, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>`,

  arrowRight: (size = 16, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>`,

  arrowLeft: (size = 16, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
    </svg>`,

  plus: (size = 16, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>`,

  edit: (size = 15, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>`,

  trash: (size = 15, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>`,

  chart: (size = 18, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>`,

  receipt: (size = 18, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/>
    </svg>`,

  logout: (size = 16, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>`,

  flame: (size = 14, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3.5z"/>
    </svg>`,

  sparkle: (size = 16, cls = "") => `
    <svg class="ui-icon ${cls}" width="${size}" height="${size}" ${SVG_ATTRS}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    </svg>`
};

/** Chuyển icon name thành chuỗi HTML an toàn */
export function iconHtml(name, size = 16, cls = "") {
  if (ICONS[name]) return ICONS[name](size, cls);
  return "";
}

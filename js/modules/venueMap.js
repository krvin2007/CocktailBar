/* =========================================================
   VENUEMAP.JS - Bản đồ địa điểm của quán (dùng chung trang chủ + Liên hệ)

   Vì sao không nhúng iframe Google Maps: bản đồ Google tự gắn TÊN địa điểm
   thật tại vị trí đó (không đổi được từ phía website). Ở đây vẽ bản đồ riêng
   bằng Leaflet + nền OpenStreetMap (không cần API key) rồi đặt ghim mang tên
   của quán (VENUE.name). Leaflet nạp từ CDN khi cần; nếu mất mạng thì hiện
   thẻ địa chỉ + nút mở Google Maps thay cho bản đồ.
   ========================================================= */

import { VENUE, mapsSearchUrl } from "./venue.js";
import { escapeHtml } from "./utils.js";

const LEAFLET_BASE = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4";
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = "&copy; OpenStreetMap contributors";
const DEFAULT_ZOOM = 17;

let leafletPromise = null;

/** Nạp Leaflet (CSS + JS) đúng một lần, trả về đối tượng L */
function loadLeaflet() {
  if (globalThis.L) return Promise.resolve(globalThis.L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `${LEAFLET_BASE}/leaflet.css`;
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = `${LEAFLET_BASE}/leaflet.js`;
    script.onload = () => resolve(globalThis.L);
    script.onerror = () => {
      leafletPromise = null; // cho phép thử lại lần sau
      reject(new Error("Không tải được thư viện bản đồ"));
    };
    document.head.appendChild(script);
  });
  return leafletPromise;
}

/** Ghim mang tên quán: chấm vàng + nhãn "Quán Bar Đêm" */
function pinIcon(L) {
  return L.divIcon({
    className: "venue-pin",
    html: `<span class="venue-pin-label">${escapeHtml(VENUE.name)}</span><span class="venue-pin-dot"></span>`,
    iconSize: [0, 0],
  });
}

/** Nút "Mở Google Maps" nằm ngay trên bản đồ (góc phải), mở tab mới tại toạ độ của quán */
function openMapsControl(L, en) {
  const Control = L.Control.extend({
    options: { position: "topright" },
    onAdd() {
      const link = L.DomUtil.create("a", "venue-map-open");
      link.href = mapsSearchUrl();
      link.target = "_blank";
      link.rel = "noopener";
      link.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        <span>${en ? "Open Google Maps" : "Mở Google Maps"}</span>`;
      L.DomEvent.disableClickPropagation(link);
      return link;
    },
  });
  return new Control();
}

/**
 * Vẽ bản đồ vào phần tử host.
 * @param {HTMLElement} host nơi đặt bản đồ (cần có chiều cao trong CSS)
 * @param {{lang?: string}} options
 */
export async function renderVenueMap(host, { lang = "vi" } = {}) {
  if (!host) return;
  const en = lang === "en";

  try {
    const L = await loadLeaflet();
    host.innerHTML = "";
    const map = L.map(host, { scrollWheelZoom: false, attributionControl: true })
      .setView([VENUE.lat, VENUE.lng], DEFAULT_ZOOM);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
    L.marker([VENUE.lat, VENUE.lng], { icon: pinIcon(L), keyboard: false, title: VENUE.name }).addTo(map);
    openMapsControl(L, en).addTo(map);
    // Bấm vào bản đồ thì mới cho cuộn chuột để phóng to (tránh kẹt khi cuộn trang)
    map.once("focus", () => map.scrollWheelZoom.enable());
  } catch {
    host.innerHTML = `
      <div class="venue-map-fallback">
        <strong>${escapeHtml(VENUE.name)}</strong>
        <span>${escapeHtml(VENUE.address)}</span>
        <a href="${mapsSearchUrl()}" target="_blank" rel="noopener">${en ? "Open Google Maps" : "Mở Google Maps"}</a>
      </div>`;
  }
}

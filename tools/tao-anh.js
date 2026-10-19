/* =========================================================
   TAO-ANH.JS - Tự vẽ toàn bộ hình minh hoạ của website bằng SVG
   Chạy: npm run images   (ghi đè các file .svg trong img/)

   Thay cho các ảnh lấy từ Internet trước đây. Mọi hình đều được vẽ
   bằng code (hình học + màu), không có khuôn mặt người, không có logo
   thương hiệu - chỉ có tên sản phẩm viết bằng chữ thường.
   ========================================================= */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SERIF = "Georgia, 'Times New Roman', serif";

/** Bộ sinh số giả ngẫu nhiên có hạt giống -> lần nào chạy cũng ra cùng một hình */
function makeRandom(seed) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function svg(width, height, body, defs = "") {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
<defs>${defs}</defs>
${body}
</svg>
`;
}

/** Thoát ký tự đặc biệt khi chèn chữ vào XML (VD "Edward & Edward") */
function xml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function save(relPath, content) {
  const full = join(ROOT, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, "utf8");
  console.log(`  ✓ ${relPath}`);
}

/* ---------------------------------------------------------
   1. CHAI RƯỢU (nền trong suốt, 300 x 600)
   --------------------------------------------------------- */

/** Đường viền chai: cổ chai -> vai -> thân -> đáy bo góc */
function bottlePath({ nw, bw, neckTop, shoulderTop, shoulderBottom, bottom, r }) {
  const cx = 150;
  const k = (shoulderBottom - shoulderTop) * 0.55;
  return [
    `M${cx - nw},${neckTop}`,
    `L${cx - nw},${shoulderTop}`,
    `C${cx - nw},${shoulderTop + k} ${cx - bw},${shoulderBottom - k} ${cx - bw},${shoulderBottom}`,
    `L${cx - bw},${bottom - r}`,
    `Q${cx - bw},${bottom} ${cx - bw + r},${bottom}`,
    `L${cx + bw - r},${bottom}`,
    `Q${cx + bw},${bottom} ${cx + bw},${bottom - r}`,
    `L${cx + bw},${shoulderBottom}`,
    `C${cx + bw},${shoulderBottom - k} ${cx + nw},${shoulderTop + k} ${cx + nw},${shoulderTop}`,
    `L${cx + nw},${neckTop}Z`,
  ].join(" ");
}

function bottleSvg(id, o) {
  const shape = bottlePath(o.shape);
  const { nw, bw, neckTop, shoulderBottom, bottom } = o.shape;
  const labelTop = o.labelTop ?? shoulderBottom + 40;
  const labelH = o.labelH ?? 150;
  const innerWidth = (bw - 26) * 2;
  const lines = o.label.map((t, i) => {
    // Cỡ chữ tự thu nhỏ để tên không tràn ra ngoài nhãn (ước lượng 0.72em mỗi ký tự)
    const wanted = i === 0 ? o.titleSize ?? 26 : 15;
    const size = Math.min(wanted, innerWidth / (t.length * 0.72)).toFixed(1);
    const y = labelTop + (i === 0 ? 48 : 48 + 22 + (i - 1) * 21);
    return `<text x="150" y="${y}" text-anchor="middle" font-family="${SERIF}" font-size="${size}"
      font-weight="${i === 0 ? 700 : 400}" letter-spacing="${i === 0 ? 1.5 : 1}" fill="${o.labelInk}">${xml(t)}</text>`;
  }).join("\n");

  const defs = `
    <clipPath id="${id}-clip"><path d="${shape}"/></clipPath>
    <linearGradient id="${id}-liquid" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${o.liquid[1]}"/><stop offset="0.45" stop-color="${o.liquid[0]}"/>
      <stop offset="1" stop-color="${o.liquid[1]}"/>
    </linearGradient>
    <linearGradient id="${id}-shine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>`;

  const body = `
  <ellipse cx="150" cy="${bottom + 8}" rx="${bw + 10}" ry="9" fill="#000" opacity="0.35"/>
  <g clip-path="url(#${id}-clip)">
    <rect x="0" y="0" width="300" height="600" fill="${o.glass}" opacity="${o.glassOpacity ?? 0.35}"/>
    <rect x="0" y="${o.fillLevel}" width="300" height="${600 - o.fillLevel}" fill="url(#${id}-liquid)"/>
    <rect x="${150 - bw + 14}" y="${neckTop}" width="16" height="${bottom - neckTop}" fill="url(#${id}-shine)" opacity="0.8"/>
    <rect x="${150 + bw - 34}" y="${shoulderBottom}" width="6" height="${bottom - shoulderBottom - 30}" fill="#fff" opacity="0.12"/>
  </g>
  <path d="${shape}" fill="none" stroke="${o.edge ?? "#ffffff"}" stroke-opacity="0.35" stroke-width="2"/>
  <rect x="${150 - bw + 12}" y="${labelTop}" width="${(bw - 12) * 2}" height="${labelH}" rx="4"
        fill="${o.labelColor}" stroke="${o.labelInk}" stroke-opacity="0.35"/>
  <rect x="${150 - bw + 20}" y="${labelTop + 8}" width="${(bw - 20) * 2}" height="${labelH - 16}" rx="2"
        fill="none" stroke="${o.labelInk}" stroke-opacity="0.45"/>
  ${lines}
  <rect x="${150 - nw - 5}" y="${neckTop - (o.capH ?? 46)}" width="${(nw + 5) * 2}" height="${o.capH ?? 46}" rx="5" fill="${o.cap}"/>
  <rect x="${150 - nw - 5}" y="${neckTop - 8}" width="${(nw + 5) * 2}" height="8" fill="#000" opacity="0.25"/>`;

  return svg(300, 600, body, defs);
}

const BOTTLES = {
  "macallan-18": {
    shape: { nw: 22, bw: 82, neckTop: 120, shoulderTop: 190, shoulderBottom: 270, bottom: 575, r: 14 },
    glass: "#d9c9a8", liquid: ["#b5651d", "#6e3510"], fillLevel: 205,
    labelColor: "#f3ead8", labelInk: "#4a2a12", cap: "#2b1a10",
    label: ["THE MACALLAN", "18 YEARS OLD", "DOUBLE CASK", "Highland Single Malt"], titleSize: 22,
  },
  "hennessy-xo": {
    shape: { nw: 20, bw: 92, neckTop: 150, shoulderTop: 205, shoulderBottom: 330, bottom: 570, r: 70 },
    glass: "#d8b98a", liquid: ["#a8521a", "#5a2608"], fillLevel: 215,
    labelColor: "#1b1410", labelInk: "#d9b46a", cap: "#c49a4a", labelTop: 380, labelH: 120,
    label: ["HENNESSY", "X.O", "Cognac"], titleSize: 24,
  },
  "don-julio-1942": {
    shape: { nw: 18, bw: 56, neckTop: 70, shoulderTop: 140, shoulderBottom: 210, bottom: 580, r: 10 },
    glass: "#efe3c4", liquid: ["#e0a83a", "#9c6a17"], fillLevel: 160,
    labelColor: "#f6f0e2", labelInk: "#6b4a1a", cap: "#b48a3c", labelTop: 300, labelH: 150,
    label: ["DON JULIO", "1942", "Tequila Añejo"], titleSize: 19,
  },
  "monkey-47": {
    shape: { nw: 26, bw: 78, neckTop: 175, shoulderTop: 215, shoulderBottom: 265, bottom: 570, r: 12 },
    glass: "#4a2a12", glassOpacity: 0.95, liquid: ["#5a3416", "#3a1e0a"], fillLevel: 230,
    labelColor: "#efe6d2", labelInk: "#1f2a1c", cap: "#1b1b1b", labelTop: 320, labelH: 170,
    label: ["MONKEY 47", "Schwarzwald", "Dry Gin", "47% vol"], titleSize: 24,
  },
  "lagavulin-16": {
    shape: { nw: 21, bw: 80, neckTop: 115, shoulderTop: 185, shoulderBottom: 255, bottom: 575, r: 14 },
    glass: "#c9b98e", liquid: ["#9a4b14", "#55250a"], fillLevel: 200,
    labelColor: "#efe5c8", labelInk: "#2a2116", cap: "#1f1a14",
    label: ["LAGAVULIN", "16 YEARS OLD", "Islay Single Malt"], titleSize: 22,
  },
  "diplomatico-rum": {
    shape: { nw: 24, bw: 86, neckTop: 140, shoulderTop: 230, shoulderBottom: 300, bottom: 575, r: 26 },
    glass: "#c5a77b", liquid: ["#7a3311", "#3e1606"], fillLevel: 250,
    labelColor: "#e9dcc0", labelInk: "#3a2214", cap: "#2a160c", labelTop: 340, labelH: 140,
    label: ["DIPLOMÁTICO", "Reserva", "Exclusiva", "Rum"], titleSize: 20,
  },
  campari: {
    shape: { nw: 17, bw: 58, neckTop: 85, shoulderTop: 170, shoulderBottom: 250, bottom: 580, r: 8 },
    glass: "#f2c1c1", liquid: ["#d0142c", "#7c0614"], fillLevel: 190,
    labelColor: "#f7f2ea", labelInk: "#a30d1f", cap: "#b5101f", labelTop: 330, labelH: 120,
    label: ["CAMPARI", "Bitter", "Milano"], titleSize: 22,
  },
  "bulleit-bourbon": {
    shape: { nw: 21, bw: 84, neckTop: 120, shoulderTop: 175, shoulderBottom: 215, bottom: 575, r: 10 },
    glass: "#d1bf98", liquid: ["#b0601c", "#61300c"], fillLevel: 190,
    labelColor: "#e4d6b5", labelInk: "#2f2416", cap: "#c4a35a", labelTop: 300, labelH: 160,
    label: ["BULLEIT", "10 YEAR", "Kentucky Straight", "Bourbon"], titleSize: 26,
  },
};

/* ---------------------------------------------------------
   2. CẢNH QUẦY BAR (ly rượu đặc trưng của từng bartender)
   --------------------------------------------------------- */

/** Nền: tường tối + kệ rượu mờ phía sau + mặt quầy gỗ */
function barBackdrop(w, h, seed, { counterY = h * 0.76, tone = "#2a170c" } = {}) {
  const rand = makeRandom(seed);
  const colors = ["#7a3d12", "#3d5a2a", "#8a1c1c", "#c58a2a", "#2d3f5c", "#5c2a12", "#9a7a3a"];
  let shelves = "";
  for (let row = 0; row < 2; row += 1) {
    const baseY = h * (0.28 + row * 0.24);
    shelves += `<rect x="0" y="${baseY}" width="${w}" height="6" fill="#5a3a1c" opacity="0.6"/>`;
    for (let x = 14; x < w - 20; x += 28 + rand() * 18) {
      const bh = 60 + rand() * 50;
      const bw = 16 + rand() * 12;
      const c = colors[Math.floor(rand() * colors.length)];
      shelves += `<rect x="${x}" y="${baseY - bh}" width="${bw}" height="${bh}" rx="5" fill="${c}" opacity="0.45"/>
        <rect x="${x + bw / 2 - 3}" y="${baseY - bh - 16}" width="6" height="18" rx="2" fill="${c}" opacity="0.45"/>`;
    }
  }
  const defs = `
    <radialGradient id="bg${seed}" cx="50%" cy="35%" r="75%">
      <stop offset="0" stop-color="${tone}"/><stop offset="1" stop-color="#070403"/>
    </radialGradient>
    <linearGradient id="wood${seed}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6b3f1d"/><stop offset="0.08" stop-color="#3b2010"/><stop offset="1" stop-color="#140904"/>
    </linearGradient>
    <radialGradient id="spot${seed}" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#ffd58a" stop-opacity="0.35"/><stop offset="1" stop-color="#ffd58a" stop-opacity="0"/>
    </radialGradient>
    <filter id="blur${seed}"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="glow${seed}"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  const body = `
  <rect width="${w}" height="${h}" fill="url(#bg${seed})"/>
  <g filter="url(#blur${seed})">${shelves}</g>
  <ellipse cx="${w / 2}" cy="${counterY - 40}" rx="${w * 0.45}" ry="${h * 0.3}" fill="url(#spot${seed})"/>
  <rect x="0" y="${counterY}" width="${w}" height="${h - counterY}" fill="url(#wood${seed})"/>
  <rect x="0" y="${counterY}" width="${w}" height="3" fill="#c08a4a" opacity="0.6"/>`;
  return { defs, body };
}

/** Ly và đồ uống - mỗi hàm trả về SVG đặt tại tâm cx, đáy ly baseY */
const GLASS = "stroke=\"#f4e9d8\" stroke-opacity=\"0.75\" stroke-width=\"2.5\" fill=\"#ffffff\" fill-opacity=\"0.06\"";

function coupe(cx, baseY, liquid, { foam = false } = {}) {
  const rimY = baseY - 230;
  return `
  <ellipse cx="${cx}" cy="${baseY}" rx="62" ry="10" ${GLASS}/>
  <path d="M${cx - 5},${rimY + 82} L${cx - 4},${baseY - 8} M${cx + 5},${rimY + 82} L${cx + 4},${baseY - 8}" stroke="#f4e9d8" stroke-opacity="0.7" stroke-width="2.5"/>
  <path d="M${cx - 88},${rimY + 14} Q${cx - 84},${rimY + 72} ${cx},${rimY + 76} Q${cx + 84},${rimY + 72} ${cx + 88},${rimY + 14} Z" fill="${liquid}" opacity="0.92"/>
  ${foam ? `<ellipse cx="${cx}" cy="${rimY + 16}" rx="88" ry="11" fill="#f7f1df" opacity="0.95"/>` : `<ellipse cx="${cx}" cy="${rimY + 14}" rx="88" ry="9" fill="#ffffff" opacity="0.18"/>`}
  <path d="M${cx - 96},${rimY} Q${cx - 92},${rimY + 82} ${cx},${rimY + 86} Q${cx + 92},${rimY + 82} ${cx + 96},${rimY}" ${GLASS}/>
  <ellipse cx="${cx}" cy="${rimY}" rx="96" ry="10" ${GLASS}/>
  <path d="M${cx - 70},${rimY + 22} Q${cx - 64},${rimY + 56} ${cx - 34},${rimY + 66}" stroke="#fff" stroke-opacity="0.35" stroke-width="4" fill="none"/>`;
}

function martini(cx, baseY, liquid) {
  const rimY = baseY - 250;
  return `
  <ellipse cx="${cx}" cy="${baseY}" rx="62" ry="10" ${GLASS}/>
  <path d="M${cx},${rimY + 132} L${cx},${baseY - 8}" stroke="#f4e9d8" stroke-opacity="0.7" stroke-width="3"/>
  <path d="M${cx - 104},${rimY + 12} L${cx},${rimY + 126} L${cx + 104},${rimY + 12} Z" fill="${liquid}" opacity="0.9"/>
  <ellipse cx="${cx}" cy="${rimY + 12}" rx="104" ry="9" fill="#fff" opacity="0.2"/>
  <path d="M${cx - 118},${rimY} L${cx},${rimY + 134} L${cx + 118},${rimY}" ${GLASS}/>
  <ellipse cx="${cx}" cy="${rimY}" rx="118" ry="11" ${GLASS}/>
  <path d="M${cx - 80},${rimY + 20} L${cx - 30},${rimY + 76}" stroke="#fff" stroke-opacity="0.35" stroke-width="4"/>`;
}

function rocks(cx, baseY, liquid, level = 0.55, { diamond = false, ice = true } = {}) {
  const top = baseY - 175;
  const liqTop = baseY - 18 - (175 - 18) * level;
  const iceSvg = diamond
    ? `<polygon points="${cx},${liqTop - 46} ${cx + 52},${liqTop + 8} ${cx},${baseY - 26} ${cx - 52},${liqTop + 8}" fill="#e8f4ff" fill-opacity="0.55" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2"/>
       <polyline points="${cx - 52},${liqTop + 8} ${cx - 18},${liqTop + 2} ${cx},${liqTop - 46} ${cx + 18},${liqTop + 2} ${cx + 52},${liqTop + 8}" fill="none" stroke="#fff" stroke-opacity="0.6" stroke-width="1.5"/>
       <line x1="${cx - 18}" y1="${liqTop + 2}" x2="${cx}" y2="${baseY - 26}" stroke="#fff" stroke-opacity="0.4"/>
       <line x1="${cx + 18}" y1="${liqTop + 2}" x2="${cx}" y2="${baseY - 26}" stroke="#fff" stroke-opacity="0.4"/>`
    : ice ? `<rect x="${cx - 46}" y="${liqTop - 30}" width="88" height="80" rx="10" fill="#eef7ff" fill-opacity="0.35" stroke="#fff" stroke-opacity="0.7" transform="rotate(-6 ${cx} ${liqTop})"/>` : "";
  return `
  <rect x="${cx - 82}" y="${liqTop}" width="164" height="${baseY - 18 - liqTop}" fill="${liquid}" opacity="0.88"/>
  <ellipse cx="${cx}" cy="${liqTop}" rx="82" ry="8" fill="#fff" opacity="0.15"/>
  ${iceSvg}
  <path d="M${cx - 88},${top} L${cx - 82},${baseY} L${cx + 82},${baseY} L${cx + 88},${top}" ${GLASS}/>
  <rect x="${cx - 82}" y="${baseY - 18}" width="164" height="18" fill="#fff" opacity="0.12"/>
  <ellipse cx="${cx}" cy="${top}" rx="88" ry="9" ${GLASS}/>
  <line x1="${cx - 64}" y1="${top + 18}" x2="${cx - 60}" y2="${baseY - 30}" stroke="#fff" stroke-opacity="0.3" stroke-width="5"/>`;
}

function highball(cx, baseY, liquid, seed) {
  const rand = makeRandom(seed);
  const top = baseY - 300;
  let bubbles = "";
  for (let i = 0; i < 22; i += 1) {
    bubbles += `<circle cx="${cx - 48 + rand() * 96}" cy="${top + 40 + rand() * 240}" r="${1.5 + rand() * 3}" fill="#fff" opacity="${0.3 + rand() * 0.4}"/>`;
  }
  return `
  <rect x="${cx - 60}" y="${top + 30}" width="120" height="${300 - 30 - 14}" fill="${liquid}" opacity="0.85"/>
  ${bubbles}
  <rect x="${cx - 64}" y="${top}" width="128" height="300" rx="6" ${GLASS}/>
  <rect x="${cx - 60}" y="${baseY - 14}" width="120" height="14" fill="#fff" opacity="0.12"/>
  <line x1="${cx - 44}" y1="${top + 20}" x2="${cx - 44}" y2="${baseY - 24}" stroke="#fff" stroke-opacity="0.3" stroke-width="5"/>`;
}

function orangeTwist(x, y, scale = 1) {
  return `<path d="M${x},${y} c${18 * scale},${-10 * scale} ${34 * scale},${4 * scale} ${22 * scale},${18 * scale} s${-30 * scale},${8 * scale} ${-14 * scale},${26 * scale} s${30 * scale},${2 * scale} ${26 * scale},${20 * scale}"
    fill="none" stroke="#f08a1c" stroke-width="${7 * scale}" stroke-linecap="round"/>`;
}

function leaf(x, y, rot, color = "#3f8f3a", size = 1) {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${size})">
    <path d="M0,0 Q18,-16 40,0 Q18,16 0,0 Z" fill="${color}"/>
    <path d="M2,0 L36,0" stroke="#1f4f1c" stroke-width="1.2"/></g>`;
}

function flame(x, y, s = 1, seed = 1) {
  return `<g filter="url(#glow${seed})" transform="translate(${x} ${y}) scale(${s})">
    <path d="M0,0 C-14,-20 -6,-38 0,-58 C6,-38 16,-22 0,0 Z" fill="#ff9a2a" opacity="0.9"/>
    <path d="M0,-4 C-7,-16 -3,-28 0,-40 C4,-28 8,-16 0,-4 Z" fill="#ffe08a"/></g>`;
}

function book(x, y, w, h, color, lines) {
  const text = lines.map((t, i) => `<text x="${x + w / 2}" y="${y + 44 + i * 22}" text-anchor="middle" font-family="${SERIF}" font-size="${i === 0 ? 16 : 13}" fill="#e9c97a" letter-spacing="1">${xml(t)}</text>`).join("");
  return `<g transform="rotate(-4 ${x + w / 2} ${y + h})">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${color}"/>
    <rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="${h - 16}" rx="2" fill="none" stroke="#e9c97a" stroke-opacity="0.7"/>
    ${text}</g>`;
}

function caption(w, h, text) {
  return `<text x="${w - 18}" y="${h - 16}" text-anchor="end" font-family="${SERIF}" font-size="15" font-style="italic" fill="#e9c97a" opacity="0.85">${xml(text)}</text>`;
}

function scene(seed, draw, { w = 600, h = 620, captionText = "", tone } = {}) {
  const counterY = h * 0.76;
  const bg = barBackdrop(w, h, seed, { counterY, tone });
  return svg(w, h, `${bg.body}\n${draw({ w, h, counterY, seed })}\n${captionText ? caption(w, h, captionText) : ""}`, bg.defs);
}

const BARTENDER_SCENES = {
  "salvatore-calabrese": scene(11, ({ counterY }) => `
    <g transform="translate(400 ${counterY - 70})">
      <rect x="0" y="0" width="70" height="82" rx="8" fill="#f2a43a" opacity="0.85"/>
      <rect x="-4" y="-16" width="78" height="20" rx="4" fill="#d9d2c0"/>
      <rect x="10" y="28" width="50" height="30" rx="3" fill="#fff6e0"/>
      <text x="35" y="48" text-anchor="middle" font-family="${SERIF}" font-size="11" fill="#8a4a10">Marmalade</text>
    </g>
    ${martini(270, counterY + 10, "#f6c75a")}
    ${orangeTwist(340, counterY - 270, 0.9)}`, { captionText: "Breakfast Martini" }),

  "ada-coleman": scene(12, ({ counterY }) => `
    ${coupe(300, counterY + 10, "#8a2a1a")}
    ${orangeTwist(372, counterY - 250, 0.9)}`, { captionText: "Hanky Panky", tone: "#2c1810" }),

  "dale-degroff": scene(13, ({ counterY, seed }) => `
    ${martini(290, counterY + 10, "#e0566e")}
    ${flame(400, counterY - 250, 1.2, seed)}
    ${orangeTwist(388, counterY - 262, 0.7)}`, { captionText: "Cosmopolitan · flamed orange peel" }),

  "harry-craddock": scene(14, ({ counterY }) => `
    ${book(70, counterY - 190, 150, 200, "#3a1f3f", ["THE SAVOY", "COCKTAIL", "BOOK", "1930"])}
    ${coupe(360, counterY + 10, "#efe6c8", { foam: true })}`, { captionText: "White Lady" }),

  "hidetsugu-ueno": scene(15, ({ counterY }) => `
    ${rocks(300, counterY + 10, "#b8641a", 0.5, { diamond: true })}`, { captionText: "Ice diamond", tone: "#1c1a20" }),

  "colin-field": scene(16, ({ counterY, seed }) => `
    ${highball(300, counterY + 10, "#e8d27a", seed)}
    ${leaf(300, counterY - 300, -30, "#4a9a3e", 1.1)}
    ${leaf(286, counterY - 292, -150, "#3a8a34", 0.9)}`, { captionText: "Serendipity" }),

  "erik-lorincz": scene(17, ({ counterY }) => `
    ${coupe(300, counterY + 10, "#b9cf7a", { foam: true })}
    ${leaf(318, counterY - 228, -12, "#3f8f3a", 1.2)}`, { captionText: "Green Park" }),

  "jerry-thomas": scene(18, ({ counterY, seed }) => `
    <g>
      <rect x="120" y="${counterY - 300}" width="110" height="120" rx="10" fill="#c9ccd3"/>
      <rect x="226" y="${counterY - 280}" width="26" height="70" rx="12" fill="none" stroke="#c9ccd3" stroke-width="10"/>
      <rect x="360" y="${counterY - 110}" width="110" height="120" rx="10" fill="#c9ccd3"/>
      <rect x="348" y="${counterY - 90}" width="26" height="70" rx="12" fill="none" stroke="#c9ccd3" stroke-width="10"/>
      <path d="M200,${counterY - 300} C 300,${counterY - 380} 380,${counterY - 260} 410,${counterY - 112}"
            fill="none" stroke="#58a6ff" stroke-width="16" stroke-linecap="round" opacity="0.85" filter="url(#glow${seed})"/>
      <path d="M200,${counterY - 300} C 300,${counterY - 380} 380,${counterY - 260} 410,${counterY - 112}"
            fill="none" stroke="#d6ecff" stroke-width="5" stroke-linecap="round"/>
    </g>`, { captionText: "Blue Blazer", tone: "#14182a" }),
};

/* ---------------------------------------------------------
   3. CẢNH NHÀ SƯU TẦM (kệ rượu, hầm rượu)
   --------------------------------------------------------- */

function shelfWall(w, h, seed, { rows = 4, mini = false, palette }) {
  const rand = makeRandom(seed);
  let out = "";
  const rowH = (h - 60) / rows;
  for (let r = 0; r < rows; r += 1) {
    const baseY = 40 + rowH * (r + 1);
    for (let x = 18; x < w - 24;) {
      const bw = mini ? 14 + rand() * 6 : 26 + rand() * 14;
      const bh = mini ? rowH * (0.35 + rand() * 0.2) : rowH * (0.55 + rand() * 0.3);
      const c = palette[Math.floor(rand() * palette.length)];
      const neckW = bw * 0.34;
      out += `<rect x="${x}" y="${baseY - bh}" width="${bw}" height="${bh}" rx="${bw * 0.25}" fill="${c}"/>
        <rect x="${x + bw / 2 - neckW / 2}" y="${baseY - bh - bh * 0.28}" width="${neckW}" height="${bh * 0.3}" rx="2" fill="${c}"/>
        <rect x="${x + 3}" y="${baseY - bh * 0.6}" width="${bw - 6}" height="${bh * 0.28}" fill="#efe4c8" opacity="0.75"/>
        <rect x="${x + 4}" y="${baseY - bh + 4}" width="3" height="${bh * 0.6}" fill="#fff" opacity="0.22"/>`;
      x += bw + (mini ? 6 : 8) + rand() * 6;
    }
    out += `<rect x="0" y="${baseY}" width="${w}" height="12" fill="#5a361a"/><rect x="0" y="${baseY}" width="${w}" height="2" fill="#a8743e"/>`;
  }
  return out;
}

function collectorShelves(seed, opts, captionText, extra = "") {
  const w = 600;
  const h = 620;
  const defs = `
    <linearGradient id="wall${seed}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#24140a"/><stop offset="1" stop-color="#0b0604"/>
    </linearGradient>
    <radialGradient id="light${seed}" cx="50%" cy="20%" r="70%">
      <stop offset="0" stop-color="#ffcf7a" stop-opacity="0.28"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/>
    </radialGradient>`;
  return svg(w, h, `
  <rect width="${w}" height="${h}" fill="url(#wall${seed})"/>
  ${shelfWall(w, h, seed, opts)}
  <rect width="${w}" height="${h}" fill="url(#light${seed})"/>
  ${extra}
  ${caption(w, h, captionText)}`, defs);
}

function wineCellar(seed, captionText) {
  const w = 600;
  const h = 620;
  let racks = "";
  for (let row = 0; row < 7; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const x = 92 + col * 52 + (row % 2) * 26;
      const y = 250 + row * 46;
      if (x > 520) continue;
      racks += `<circle cx="${x}" cy="${y}" r="19" fill="#1a0d08" stroke="#4a2a18" stroke-width="3"/>
        <circle cx="${x}" cy="${y}" r="9" fill="${(row + col) % 3 === 0 ? "#6e1a22" : "#2e1a10"}"/>
        <circle cx="${x - 4}" cy="${y - 4}" r="3" fill="#fff" opacity="0.25"/>`;
    }
  }
  const defs = `
    <linearGradient id="stone${seed}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4a3a2c"/><stop offset="1" stop-color="#15100c"/>
    </linearGradient>
    <radialGradient id="lamp${seed}" cx="50%" cy="18%" r="60%">
      <stop offset="0" stop-color="#ffc56a" stop-opacity="0.45"/><stop offset="1" stop-color="#ffc56a" stop-opacity="0"/>
    </radialGradient>`;
  return svg(w, h, `
  <rect width="${w}" height="${h}" fill="url(#stone${seed})"/>
  <path d="M60,${h} L60,200 Q300,20 540,200 L540,${h} Z" fill="#0d0806" stroke="#7a5a3c" stroke-width="10"/>
  ${Array.from({ length: 9 }, (_, i) => `<line x1="0" y1="${40 + i * 70}" x2="60" y2="${40 + i * 70}" stroke="#2a2018" stroke-width="3"/><line x1="540" y1="${70 + i * 70}" x2="600" y2="${70 + i * 70}" stroke="#2a2018" stroke-width="3"/>`).join("")}
  ${racks}
  <line x1="300" y1="70" x2="300" y2="130" stroke="#3a2a1a" stroke-width="3"/>
  <circle cx="300" cy="140" r="12" fill="#ffd27a"/>
  <rect width="${w}" height="${h}" fill="url(#lamp${seed})"/>
  ${caption(w, h, captionText)}`, defs);
}

const WHISKY = ["#8a4416", "#a55a1c", "#6a3010", "#b8742a", "#5a2a0e", "#2d4a2a"];

const COLLECTOR_SCENES = {
  "richard-gooding": collectorShelves(21, { rows: 4, palette: WHISKY }, "The Perfect Collection"),
  "michel-jack-chasseuil": wineCellar(22, "La cave · Deux-Sèvres"),
  "valentino-zagatti": collectorShelves(23, { rows: 5, palette: WHISKY }, "Floor-to-ceiling Scotch",
    Array.from({ length: 6 }, (_, i) => `<circle cx="${40 + (i % 2) * 14}" cy="${40 + Math.floor(i / 2) * 14}" r="4" fill="#e9c97a" opacity="0.8"/>`).join("")),
  "sukhinder-singh": collectorShelves(24, { rows: 7, mini: true, palette: [...WHISKY, "#2d3f5c", "#7a1c2a", "#c9a24a"] }, "Miniatures"),
  "edoardo-giaccone": collectorShelves(25, { rows: 4, palette: [...WHISKY, "#1f3a5a", "#2a5a2a"] }, "Edward & Edward · Salò",
    `<rect x="0" y="560" width="600" height="60" fill="#3b2010"/><rect x="0" y="560" width="600" height="3" fill="#c08a4a"/>`),
};

/* ---------------------------------------------------------
   4. ẢNH MÓN CHƯA CÓ ẢNH (tỉ lệ 4:3)
   --------------------------------------------------------- */
const DRINK_SCENES = {
  manhattan: scene(31, ({ counterY }) => `
    ${coupe(400, counterY + 10, "#7a1e12")}
    <line x1="380" y1="${counterY - 240}" x2="440" y2="${counterY - 170}" stroke="#d9c9a8" stroke-width="3"/>
    <circle cx="430" cy="${counterY - 182}" r="13" fill="#8a0a1a"/><circle cx="426" cy="${counterY - 186}" r="4" fill="#fff" opacity="0.4"/>`,
  { w: 800, h: 600, captionText: "Manhattan" }),

  "macallan-12": scene(32, ({ counterY }) => `
    ${rocks(400, counterY + 10, "#b5651d", 0.35, { ice: false })}`, { w: 800, h: 600, captionText: "Single malt · neat" }),
};

/* --------------------------------------------------------- */
console.log("Đang vẽ hình minh hoạ...");
Object.entries(BOTTLES).forEach(([name, o]) => save(`img/bottles/${name}.svg`, bottleSvg(name, o)));
Object.entries(BARTENDER_SCENES).forEach(([name, s]) => save(`img/bartenders/${name}.svg`, s));
Object.entries(COLLECTOR_SCENES).forEach(([name, s]) => save(`img/collectors/${name}.svg`, s));
Object.entries(DRINK_SCENES).forEach(([name, s]) => save(`img/drinks/${name}.svg`, s));
console.log("Xong.");

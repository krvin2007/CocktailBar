/* =========================================================
   XLSX-HELPER.JS - Tạo & đọc file Excel (.xlsx) thuần JavaScript ES6+
   Không phụ thuộc thư viện ngoài; chạy được cả trên trình duyệt lẫn Node.
   Hỗ trợ UTF-8 tiếng Việt đầy đủ (XML inlineStr & sharedStrings).
   ========================================================= */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8");

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function unescapeXml(value) {
  return String(value ?? "")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function colIndexToName(index) {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function colNameToIndex(cellRef) {
  const match = String(cellRef || "").match(/^([A-Z]+)/i);
  if (!match) return -1;
  const letters = match[1].toUpperCase();
  let index = 0;
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.charCodeAt(i) - 64);
  }
  return index - 1;
}

function buildZip(entries) {
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBytes = textEncoder.encode(name);
    const content = data instanceof Uint8Array ? data : textEncoder.encode(data);
    const crc = crc32(content);

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true);      // compression method: stored
    lv.setUint32(14, crc, true);
    lv.setUint32(18, content.length, true);
    lv.setUint32(22, content.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, content.length, true);
    cv.setUint32(24, content.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);

    localChunks.push(local, content);
    centralChunks.push(central);
    offset += local.length + content.length;
  }

  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const totalSize = offset + centralSize + eocd.length;
  const output = new Uint8Array(totalSize);
  let cursor = 0;
  for (const chunk of [...localChunks, ...centralChunks, eocd]) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }
  return output;
}

/**
 * Tạo mảng byte của một file .xlsx hợp lệ từ headers và rows.
 * @param {Array<Array<string|number>>} rows
 * @param {Array<string>} headers
 * @param {string} sheetName
 */
export function buildXlsxBytes(rows = [], headers = [], sheetName = "DonHang") {
  const allRows = [];
  if (Array.isArray(headers) && headers.length > 0) allRows.push({ cells: headers, isHeader: true });
  rows.forEach((r) => allRows.push({ cells: Array.isArray(r) ? r : [], isHeader: false }));

  const colCount = allRows.reduce((max, r) => Math.max(max, r.cells.length), 1);
  const colWidths = Array.from({ length: colCount }, (_, colIdx) => {
    const longest = allRows.reduce((max, r) => Math.max(max, String(r.cells[colIdx] ?? "").length), 10);
    return `<col min="${colIdx + 1}" max="${colIdx + 1}" width="${Math.min(48, Math.max(14, longest + 4))}" customWidth="1"/>`;
  }).join("");

  const sheetRowsXml = allRows.map((rowObj, rowIndex) => {
    const rNum = rowIndex + 1;
    const cellsXml = rowObj.cells.map((raw, colIdx) => {
      const ref = `${colIndexToName(colIdx)}${rNum}`;
      const styleAttr = rowObj.isHeader ? ' s="1"' : "";
      if (typeof raw === "number" && Number.isFinite(raw)) {
        return `<c r="${ref}" t="n"${styleAttr}><v>${raw}</v></c>`;
      }
      const text = String(raw ?? "");
      return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
    }).join("");
    return `<row r="${rNum}">${cellsXml}</row>`;
  }).join("");

  const safeSheetName = escapeXml(String(sheetName || "Sheet1").slice(0, 31));
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${safeSheetName}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF1F2937"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF3E3C3"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
</styleSheet>`;

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>${colWidths}</cols>
  <sheetData>${sheetRowsXml}</sheetData>
</worksheet>`;

  return buildZip([
    { name: "[Content_Types].xml", data: contentTypesXml },
    { name: "_rels/.rels", data: rootRelsXml },
    { name: "xl/workbook.xml", data: workbookXml },
    { name: "xl/_rels/workbook.xml.rels", data: workbookRelsXml },
    { name: "xl/styles.xml", data: stylesXml },
    { name: "xl/worksheets/sheet1.xml", data: sheetXml },
  ]);
}

async function inflateRaw(compressedBytes) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Trình duyệt không hỗ trợ giải nén file .xlsx. Vui lòng lưu file sang .csv UTF-8 rồi tải lên.");
  }
  const stream = new Blob([compressedBytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

async function readZipEntries(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    throw new Error("File .xls đời cũ (Excel 97-2003) chưa hỗ trợ trực tiếp — hãy mở bằng Excel rồi Save As dạng .xlsx hoặc .csv.");
  }
  if (bytes.length < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error("File không đúng định dạng Excel (.xlsx).");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocdOffset = -1;
  const minOffset = Math.max(0, bytes.length - 65558);
  for (let i = bytes.length - 22; i >= minOffset; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error("Cấu trúc file .xlsx bị hỏng.");

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  let cdOffset = view.getUint32(eocdOffset + 16, true);
  const files = new Map();

  for (let i = 0; i < totalEntries; i++) {
    if (cdOffset + 46 > bytes.length || view.getUint32(cdOffset, true) !== 0x02014b50) break;
    const method = view.getUint16(cdOffset + 10, true);
    const compSize = view.getUint32(cdOffset + 20, true);
    const nameLen = view.getUint16(cdOffset + 28, true);
    const extraLen = view.getUint16(cdOffset + 30, true);
    const commentLen = view.getUint16(cdOffset + 32, true);
    const localOffset = view.getUint32(cdOffset + 42, true);

    const fileName = textDecoder.decode(bytes.subarray(cdOffset + 46, cdOffset + 46 + nameLen));
    cdOffset += 46 + nameLen + extraLen + commentLen;

    if (fileName.endsWith("/") || localOffset + 30 > bytes.length) continue;
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const slice = bytes.subarray(dataStart, dataStart + compSize);

    let decoded;
    if (method === 0) {
      decoded = slice;
    } else if (method === 8) {
      decoded = await inflateRaw(slice);
    } else {
      throw new Error(`Phương thức nén trong file .xlsx không được hỗ trợ (method=${method}).`);
    }
    files.set(fileName.replace(/\\/g, "/"), textDecoder.decode(decoded));
  }

  return files;
}

function extractSharedStrings(xmlText) {
  if (!xmlText) return [];
  const strings = [];
  for (const siMatch of xmlText.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    const parts = [];
    for (const tMatch of siMatch[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) {
      parts.push(unescapeXml(tMatch[1]));
    }
    strings.push(parts.join(""));
  }
  return strings;
}

function findFirstSheetPath(files) {
  const workbookXml = files.get("xl/workbook.xml") || "";
  const relsXml = files.get("xl/_rels/workbook.xml.rels") || "";
  const firstSheet = workbookXml.match(/<sheet\b[^>]*r:id=["']([^"']+)["'][^>]*>/);
  if (firstSheet && relsXml) {
    const rid = firstSheet[1];
    for (const rel of relsXml.matchAll(/<Relationship\b([^>]+)\/?>/g)) {
      const attrs = rel[1];
      if (new RegExp(`Id=["']${rid}["']`).test(attrs)) {
        const targetMatch = attrs.match(/Target=["']([^"']+)["']/);
        if (targetMatch) {
          const target = targetMatch[1].replace(/^\/+/, "");
          return target.startsWith("xl/") ? target : `xl/${target}`;
        }
      }
    }
  }
  return [...files.keys()].find((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k)) || "";
}

function parseSheetRows(sheetXml, sharedStrings) {
  const rows = [];
  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowCells = [];
    let fallbackCol = 0;

    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cellMatch[1] || "";
      const inner = cellMatch[2] || "";
      const refMatch = attrs.match(/\br=["']([A-Z]+\d+)["']/i);
      const typeMatch = attrs.match(/\bt=["']([^"']+)["']/i);

      const colIdx = refMatch ? colNameToIndex(refMatch[1]) : fallbackCol;
      fallbackCol = colIdx + 1;
      const cellType = typeMatch ? typeMatch[1] : "n";

      let value;
      if (cellType === "inlineStr") {
        const parts = [...inner.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1]));
        value = parts.join("");
      } else {
        const vMatch = inner.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/);
        const rawVal = vMatch ? unescapeXml(vMatch[1]) : "";
        if (cellType === "s") {
          const idx = Number(rawVal);
          value = Number.isInteger(idx) && idx >= 0 && idx < sharedStrings.length ? sharedStrings[idx] : "";
        } else if (cellType === "b") {
          value = rawVal === "1" ? "TRUE" : "FALSE";
        } else {
          value = rawVal;
        }
      }

      if (colIdx >= 0) rowCells[colIdx] = String(value ?? "").trim();
    }

    for (let i = 0; i < rowCells.length; i++) {
      if (rowCells[i] === undefined) rowCells[i] = "";
    }
    if (rowCells.some((cell) => cell !== "")) {
      rows.push(rowCells);
    }
  }
  return rows;
}

/**
 * Đọc ArrayBuffer của file .xlsx và trả về mảng 2 chiều các dòng/cột.
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<Array<Array<string>>>}
 */
export async function parseXlsxBuffer(arrayBuffer) {
  const files = await readZipEntries(arrayBuffer);
  const sheetPath = findFirstSheetPath(files);
  const sheetXml = sheetPath ? files.get(sheetPath) : "";
  if (!sheetXml) {
    throw new Error("Không tìm thấy trang tính dữ liệu trong file Excel.");
  }
  const sharedStrings = extractSharedStrings(files.get("xl/sharedStrings.xml"));
  return parseSheetRows(sheetXml, sharedStrings);
}

/* =========================================================
   EXPORT-SERVICE.JS - Xuất Excel (CSV chuẩn UTF-8), Nhập Excel/CSV & In Hóa đơn PDF
   - Xuất danh sách Đơn hàng, Thực đơn, Khách hàng ra Excel chuẩn tiếng Việt (BOM)
   - Nhập hàng loạt món mới từ file CSV/Excel vào hệ thống
   - In / Xuất hóa đơn Speakeasy ra PDF chuyên nghiệp
   ========================================================= */

import { formatMoney, formatDateTime, formatDate, escapeHtml, normalizePhone } from "./utils.js";
import { toast } from "./ui.js";
import { buildXlsxBytes, parseXlsxBuffer } from "./xlsxHelper.js";
import { ageProblem } from "./age.js";

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Tải dữ liệu bảng về máy dưới định dạng Excel chuẩn (.xlsx) hỗ trợ tiếng Việt UTF-8.
 */
export function exportToXlsx(filename, rows, headers = [], sheetName = "DonHang") {
  const bytes = buildXlsxBytes(rows, headers, sheetName);
  const finalName = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, finalName);
  toast(`Đã tải file Excel "${finalName}" thành công!`, "success");
}

/**
 * Tải dữ liệu dạng bảng về máy dưới định dạng CSV (tương thích 100% Microsoft Excel có tiếng Việt)
 * @param {string} filename Tên file xuất (VD: "Danh-sach-don-hang.csv")
 * @param {Array<Array<string|number>>} rows Dữ liệu các dòng
 * @param {Array<string>} headers Tiêu đề các cột
 */
export function exportToCsv(filename, rows, headers = []) {
  const escapeCell = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const lines = [];
  if (headers && headers.length > 0) {
    lines.push(headers.map(escapeCell).join(","));
  }

  rows.forEach((row) => {
    lines.push(row.map(escapeCell).join(","));
  });

  // Ký tự Byte Order Mark (\uFEFF) giúp Microsoft Excel hiển thị đúng tiếng Việt có dấu
  const csvContent = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const finalName = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  triggerDownload(blob, finalName);

  toast(`Đã xuất file Excel "${finalName}" thành công!`, "success");
}

/** Xuất danh sách đơn hàng ra Excel */
export function exportOrdersToExcel(orders = []) {
  if (!orders.length) {
    toast("Không có dữ liệu đơn hàng để xuất.", "warning");
    return;
  }

  const headers = [
    "Mã đơn", "Thời gian đặt", "Tên khách hàng", "Số điện thoại", "Email",
    "Hình thức phục vụ", "Danh sách món đã gọi", "Tổng tiền (VNĐ)",
    "Trạng thái đơn", "Trạng thái thanh toán", "Ghi chú"
  ];

  const rows = orders.map((o) => {
    const itemsText = Array.isArray(o.items) && o.items.length
      ? o.items.map((i) => `${i.name} (x${i.qty})`).join("; ")
      : "Đặt bàn";

    const serviceLabels = {
      "dine-in": "Tại quầy / Bàn",
      "booking": "Đặt bàn trước",
      "takeaway": "Mang đi",
    };

    const statusLabels = {
      pending: "Chờ xử lý",
      preparing: "Đang pha chế",
      completed: "Hoàn tất",
      cancelled: "Đã huỷ",
    };

    const paymentLabels = {
      paid: "Đã thanh toán",
      awaiting: "Chờ xác nhận CK",
      unpaid: "Chưa thanh toán",
    };

    return [
      o.code || "",
      o.createdAt ? formatDateTime(o.createdAt) : "",
      o.name || "",
      o.phone || "",
      o.email || "",
      serviceLabels[o.serviceType] || o.serviceType || "",
      itemsText,
      o.total || 0,
      statusLabels[o.status] || o.status || "",
      paymentLabels[o.paymentStatus] || o.paymentStatus || "",
      o.note || "",
    ];
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  exportToCsv(`Don-Hang-Quan-Bar-Dem_${dateStr}.csv`, rows, headers);
}

/** Xuất danh sách thực đơn ra Excel */
export function exportDrinksToExcel(drinks = []) {
  if (!drinks.length) {
    toast("Không có dữ liệu thực đơn để xuất.", "warning");
    return;
  }

  const headers = [
    "Mã món", "Tên đồ uống", "Danh mục", "Giá bán (VNĐ)",
    "Nồng độ cồn (% ABV)", "Ly phục vụ", "Trạng thái", "Đánh giá sao", "Ghi chú hương vị", "Mô tả"
  ];

  const rows = drinks.map((d) => [
    d.id || "",
    d.name || "",
    d.category || "",
    d.price || 0,
    d.abv || 0,
    d.glassType || "",
    d.status === "available" ? "Đang phục vụ" : "Tạm ngưng",
    d.rating || 5,
    Array.isArray(d.tasteNotes) ? d.tasteNotes.join(", ") : "",
    d.description || "",
  ]);

  const dateStr = new Date().toISOString().slice(0, 10);
  exportToCsv(`Thuc-Don-Cocktail_${dateStr}.csv`, rows, headers);
}

/** Xuất danh sách khách hàng thành viên ra Excel */
export function exportCustomersToExcel(customers = []) {
  if (!customers.length) {
    toast("Không có dữ liệu khách hàng để xuất.", "warning");
    return;
  }

  const headers = [
    "Mã khách", "Họ và tên", "Số điện thoại", "Email", "Ngày sinh",
    "Hạng thành viên", "Điểm khả dụng", "Ưu đãi riêng (%)", "Trạng thái 18+", "Ngày tham gia"
  ];

  const rows = customers.map((c) => [
    c.id || "",
    c.name || "",
    c.phone || "",
    c.email || "",
    c.birthDate ? formatDate(c.birthDate) : "",
    c.tier || "Thành viên Mới",
    c.points || 0,
    c.customDiscount ? `${c.customDiscount}%` : "0%",
    c.status === "inactive" || c.status === "banned" ? "Tạm khoá 18+" : "Đủ 18+ (Hoạt động)",
    c.createdAt ? formatDate(c.createdAt) : "",
  ]);

  const dateStr = new Date().toISOString().slice(0, 10);
  exportToCsv(`Khach-Hang-Thanh-Vien_${dateStr}.csv`, rows, headers);
}

/**
 * Phân tích cú pháp chuỗi CSV thành mảng các dòng
 * @param {string} csvText
 */
export function parseCsv(csvText) {
  const lines = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const row = [];
    let insideQuote = false;
    let entry = "";

    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') {
        if (insideQuote && line[c + 1] === '"') {
          entry += '"';
          c++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if ((char === "," || char === ";") && !insideQuote) {
        row.push(entry.trim());
        entry = "";
      } else {
        entry += char;
      }
    }
    row.push(entry.trim());
    result.push(row);
  }
  return result;
}

const VALID_DRINK_CATEGORIES = ["classic", "signature", "sour-fizz", "aperitivo", "spirits", "zero-proof"];

/** Tải file CSV mẫu để người dùng điền và import thực đơn */
export function downloadDrinkTemplateCsv() {
  const headers = ["Tên món", "Danh mục (classic/signature/sour-fizz/aperitivo/spirits/zero-proof)", "Giá bán (VNĐ)", "Nồng độ cồn (% ABV)", "Ly phục vụ", "Mô tả", "Hương vị (cách nhau dấu phẩy)"];
  const sampleRows = [
    ["Gold Velvet Negroni", "signature", "145000", "22", "Crystal Rocks", "Biến tấu Negroni phủ bột vàng 24K óng ánh cùng tinh dầu bưởi hồng.", "Ngọt thanh, Thảo mộc, Cam quýt"],
    ["Smoked Highland Mist", "spirits", "185000", "28", "Glencairn Snifter", "Single Malt 16 năm hun khói gỗ sồi than bùn đảo Islay.", "Khói đậm, Vani, Gỗ sồi"],
    ["Virgin Passion Fizz", "zero-proof", "85000", "0", "Highball Glass", "Chanh dây tươi, sả đập dập và soda tonic thanh mát không cồn.", "Chua ngọt, Sảng khoái, Trái cây"]
  ];
  exportToCsv("Mau-Nhap-Thuc-Don-Cocktail.csv", sampleRows, headers);
}

/**
 * Chuyển dữ liệu mảng CSV thành danh sách các món đồ uống hợp lệ
 * @param {Array<Array<string>>} rows
 */
export function parseDrinksFromCsvRows(rows) {
  if (!rows || rows.length < 2) {
    throw new Error("File CSV không có dữ liệu hoặc thiếu dòng tiêu đề.");
  }

  // Bỏ qua dòng tiêu đề
  const dataRows = rows.slice(1);
  const drinks = [];

  dataRows.forEach((row, idx) => {
    const name = String(row[0] || "").trim();
    if (!name) return; // bỏ dòng trống

    // Chấp nhận cả tên cũ trong file mẫu đời đầu (mocktail/heritage) và quy về danh mục có thật của web
    const CATEGORY_ALIASES = { mocktail: "zero-proof", heritage: "spirits" };
    const rawCategory = String(row[1] || "signature").trim().toLowerCase();
    const category = CATEGORY_ALIASES[rawCategory] || rawCategory;
    if (!VALID_DRINK_CATEGORIES.includes(category)) {
      throw new Error(`Dòng ${idx + 2} ("${name}"): danh mục "${rawCategory}" không hợp lệ. Dùng một trong: ${VALID_DRINK_CATEGORIES.join(", ")}.`);
    }
    const price = Math.max(10000, Number(String(row[2] || "").replace(/[^0-9]/g, "")) || 120000);
    const abv = Math.max(0, Math.min(100, Number(row[3]) || 0));
    const glassType = String(row[4] || "Crystal Glass").trim();
    const description = String(row[5] || `Món cocktail thủ công đặc sắc của Quán Bar Đêm.`).trim();
    const tasteNotes = row[6] ? String(row[6]).split(",").map((s) => s.trim()).filter(Boolean) : ["Thảo mộc", "Cân bằng"];

    drinks.push({
      id: `drink-imp-${Date.now()}-${idx}`,
      name,
      category,
      price,
      abv,
      glassType,
      description,
      tasteNotes,
      status: "available",
      featured: false,
      rating: 5.0,
      createdAt: new Date().toISOString(),
    });
  });

  return drinks;
}

export const ORDER_IMPORT_HEADERS = [
  "Tên khách hàng",
  "Số điện thoại",
  "Email",
  "Ngày sinh (YYYY-MM-DD)",
  "Hình thức (dine-in/booking/takeaway)",
  "Bàn / Giờ hẹn",
  "Số khách",
  "Món đặt (Tên món x SL; ...)",
  "Thanh toán (unpaid/paid)",
  "Ghi chú",
];

export const ORDER_IMPORT_SAMPLE_ROWS = [
  ["Trần Minh Khang", "0908112233", "khang.tran@gmail.com", "1996-05-18", "dine-in", "Bàn 3", "", "Negroni Classico x2; Smoked Old Fashioned x1", "unpaid", "Ít đá, thêm vỏ cam"],
  ["Lê Bảo Ngọc", "0917334455", "ngoc.le@gmail.com", "1998-09-22", "booking", "2026-11-20 20:00", "4", "Bourbon Whiskey Sour x2; Mojito Havana Rum x2", "unpaid", "Bàn gần ban nhạc Jazz"],
  ["Phạm Quốc Huy", "0939556677", "huy.pham@gmail.com", "1994-12-03", "takeaway", "", "", "Classic Margarita x1; Velvet Espresso Martini x1", "paid", "Đóng gói giữ lạnh"],
];

/** Tải file Excel (.xlsx) mẫu để nhập thêm đơn hàng */
export function downloadOrderTemplateExcel() {
  exportToXlsx("Mau-Nhap-Don-Hang.xlsx", ORDER_IMPORT_SAMPLE_ROWS, ORDER_IMPORT_HEADERS, "NhapDonHang");
}

/** Tải file CSV (.csv UTF-8) mẫu để nhập thêm đơn hàng */
export function downloadOrderTemplateCsv() {
  exportToCsv("Mau-Nhap-Don-Hang.csv", ORDER_IMPORT_SAMPLE_ROWS, ORDER_IMPORT_HEADERS);
}

/**
 * Đọc File (.xlsx hoặc .csv) từ input trình duyệt thành mảng 2 chiều dòng/cột.
 * @param {File} file
 */
export async function parseRowsFromSpreadsheetFile(file) {
  if (!file) throw new Error("Vui lòng chọn file Excel hoặc CSV.");
  const lower = String(file.name || "").toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    return await parseXlsxBuffer(buffer);
  }
  const text = await file.text();
  return parseCsv(text);
}

function excelSerialToDate(serialNum) {
  const utcMs = Date.UTC(1899, 11, 30) + serialNum * 86400 * 1000;
  return new Date(utcMs);
}

const pad2 = (n) => String(n).padStart(2, "0");

function normalizeSpreadsheetPhone(raw) {
  const normalized = normalizePhone(String(raw ?? "").trim());
  if (/^[35789]\d{8}$/.test(normalized)) return `0${normalized}`;
  return normalized;
}

function parseSpreadsheetDate(raw) {
  const val = String(raw ?? "").trim();
  if (!val) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;

  const dmy = val.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${pad2(dmy[2])}-${pad2(dmy[1])}`;

  const num = Number(val);
  if (Number.isFinite(num) && num > 1000 && num < 100000) {
    const d = excelSerialToDate(Math.floor(num));
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }
  return val;
}

function parseSpreadsheetDateTime(raw) {
  const val = String(raw ?? "").trim();
  if (!val) return "";
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(val)) {
    return val.replace(" ", "T").slice(0, 16);
  }

  const dmy = val.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s+(\d{1,2}):(\d{2})/);
  if (dmy) {
    return `${dmy[3]}-${pad2(dmy[2])}-${pad2(dmy[1])}T${pad2(dmy[4])}:${pad2(dmy[5])}`;
  }

  const num = Number(val);
  if (Number.isFinite(num) && num > 1000 && num < 100000) {
    const d = excelSerialToDate(num);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  }
  return val;
}

function normalizeOrderServiceType(raw) {
  const text = String(raw ?? "").trim().toLowerCase();
  if (!text || text === "dine-in" || text.includes("tại") || text.includes("bàn tại")) return "dine-in";
  if (text === "booking" || text.includes("đặt bàn") || text.includes("dat ban")) return "booking";
  if (text === "takeaway" || text.includes("mang")) return "takeaway";
  return "";
}

function normalizeOrderPaymentStatus(raw) {
  const text = String(raw ?? "").trim().toLowerCase();
  if (text === "paid" || text.includes("đã thanh toán") || text.includes("da thanh toan")) return "paid";
  if (text === "awaiting" || text.includes("chờ")) return "awaiting";
  return "unpaid";
}

function parseOrderItemsCell(cellText, drinksList) {
  const raw = String(cellText ?? "").trim();
  if (!raw) return { items: [], unknownItems: [] };

  const byId = new Map();
  const byName = new Map();
  drinksList.forEach((d) => {
    if (d.id) byId.set(String(d.id).trim().toLowerCase(), d);
    if (d.name) byName.set(String(d.name).trim().toLowerCase(), d);
  });

  const merged = new Map();
  const unknownItems = [];
  const segments = raw.split(/[;|\n,]+/).map((s) => s.trim()).filter(Boolean);

  for (const seg of segments) {
    let query = seg;
    let qty = 1;

    const suffixQty = seg.match(/^(.*?)\s*(?:\(\s*x\s*(\d+)\s*\)|[xX*×:]\s*(\d+))$/);
    const prefixQty = seg.match(/^(\d+)\s*[xX*×]\s*(.+)$/);
    if (suffixQty) {
      query = suffixQty[1].trim();
      qty = Math.max(1, Number(suffixQty[2] || suffixQty[3]) || 1);
    } else if (prefixQty) {
      qty = Math.max(1, Number(prefixQty[1]) || 1);
      query = prefixQty[2].trim();
    }

    const qLower = query.toLowerCase();
    let drink = byId.get(qLower) || byName.get(qLower);
    if (!drink && qLower.length >= 3) {
      const partialMatches = drinksList.filter((d) => String(d.name || "").toLowerCase().includes(qLower));
      if (partialMatches.length === 1) drink = partialMatches[0];
    }

    if (!drink) {
      unknownItems.push(query);
      continue;
    }

    const existing = merged.get(drink.id);
    if (existing) {
      existing.qty += qty;
    } else {
      merged.set(drink.id, {
        drinkId: drink.id,
        name: drink.name,
        price: Number(drink.price) || 0,
        image: drink.image || "",
        qty,
      });
    }
  }

  return { items: [...merged.values()], unknownItems };
}

/**
 * Chuyển dữ liệu bảng (Excel / CSV) thành danh sách đơn hàng kèm trạng thái kiểm tra hợp lệ từng dòng.
 * @param {Array<Array<string>>} rows
 * @param {Array<object>} drinksList
 */
export function parseOrdersFromRows(rows, drinksList = []) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("File không có dữ liệu.");
  }

  const firstCell = String(rows[0]?.[0] || "").trim().toLowerCase();
  const hasHeader = firstCell.includes("tên") || firstCell.includes("khách") || firstCell === "name";
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const startRowNumber = hasHeader ? 2 : 1;

  if (dataRows.length === 0) {
    throw new Error("File chỉ có dòng tiêu đề, chưa có dòng đơn hàng nào.");
  }

  const parsed = [];
  dataRows.forEach((row, index) => {
    const cells = Array.isArray(row) ? row : [];
    if (cells.every((c) => !String(c ?? "").trim())) return;

    const rowNumber = startRowNumber + index;
    const name = String(cells[0] ?? "").trim();
    const phone = normalizeSpreadsheetPhone(cells[1]);
    const email = String(cells[2] ?? "").trim();
    const birthDate = parseSpreadsheetDate(cells[3]);
    const serviceType = normalizeOrderServiceType(cells[4]);
    const seatOrTime = String(cells[5] ?? "").trim();
    const guestCountRaw = String(cells[6] ?? "").trim();
    const { items, unknownItems } = parseOrderItemsCell(cells[7], drinksList);
    const paymentStatus = normalizeOrderPaymentStatus(cells[8]);
    const note = String(cells[9] ?? "").trim();

    const errors = [];
    if (name.length < 2) errors.push("Thiếu tên khách hàng");
    if (!/^0[35789][0-9]{8}$/.test(phone)) errors.push("SĐT chưa đúng 10 số VN");
    const ageErr = ageProblem(birthDate);
    if (ageErr) errors.push(ageErr);
    if (!serviceType) errors.push("Hình thức phải là dine-in / booking / takeaway");

    const bookingTime = serviceType === "booking" ? parseSpreadsheetDateTime(seatOrTime) : "";
    const guestCount = serviceType === "booking" ? Math.max(1, Number(guestCountRaw) || 2) : null;
    if (serviceType === "booking" && (!bookingTime || Number.isNaN(new Date(bookingTime).getTime()))) {
      errors.push("Đơn đặt bàn cần cột 'Bàn / Giờ hẹn' hợp lệ (VD: 2026-11-20 20:00)");
    }

    if (unknownItems.length > 0) {
      errors.push(`Không tìm thấy món: ${unknownItems.join(", ")}`);
    }
    if (serviceType && serviceType !== "booking" && items.length === 0) {
      errors.push("Cần ít nhất 1 món hợp lệ");
    }

    const subtotal = items.reduce((sum, it) => sum + it.price * it.qty, 0);
    const itemsText = items.length > 0
      ? items.map((it) => `${it.name} ×${it.qty}`).join(", ")
      : (serviceType === "booking" ? "Chỉ giữ bàn" : "—");

    parsed.push({
      rowNumber,
      valid: errors.length === 0,
      errors,
      subtotal,
      itemsText,
      orderPayload: {
        name,
        phone,
        email,
        birthDate,
        serviceType: serviceType || "dine-in",
        tableNumber: serviceType === "dine-in" ? seatOrTime : "",
        bookingTime,
        guestCount,
        items,
        paymentStatus,
        note,
      },
    });
  });

  if (parsed.length === 0) {
    throw new Error("Không tìm thấy dòng đơn hàng nào có dữ liệu.");
  }
  return parsed;
}

/**
 * In / Xuất hóa đơn hoặc biên lai ra PDF
 * @param {Object} order
 */
export function printOrderInvoice(order) {
  if (!order) return;

  const itemsHtml = Array.isArray(order.items) && order.items.length
    ? order.items.map((i, idx) => `
      <tr>
        <td style="padding: 8px 4px; border-bottom: 1px dashed #ccc; text-align: center;">${idx + 1}</td>
        <td style="padding: 8px 4px; border-bottom: 1px dashed #ccc;">
          <strong>${escapeHtml(i.name)}</strong>
        </td>
        <td style="padding: 8px 4px; border-bottom: 1px dashed #ccc; text-align: center;">${i.qty}</td>
        <td style="padding: 8px 4px; border-bottom: 1px dashed #ccc; text-align: right;">${formatMoney(i.price)}</td>
        <td style="padding: 8px 4px; border-bottom: 1px dashed #ccc; text-align: right; font-weight: bold;">${formatMoney(i.price * i.qty)}</td>
      </tr>`).join("")
    : `<tr><td colspan="5" style="padding: 10px; text-align: center;">Đặt bàn giữ chỗ</td></tr>`;

  const printWindow = window.open("", "_blank", "width=700,height=800");
  if (!printWindow) {
    toast("Trình duyệt đang chặn cửa sổ pop-up. Vui lòng cho phép để in hóa đơn.", "warning");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>Phiếu Thanh Toán — Đơn ${escapeHtml(order.code)}</title>
      <style>
        body { font-family: 'Times New Roman', serif; margin: 0; padding: 24px; color: #111; background: #fff; }
        .invoice-box { max-width: 540px; margin: 0 auto; border: 1px solid #ddd; padding: 24px; }
        .header { text-align: center; border-bottom: 2px solid #222; padding-bottom: 14px; margin-bottom: 18px; }
        .brand { font-size: 1.5rem; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; }
        .sub { font-size: 0.85rem; color: #555; margin-top: 4px; }
        .meta-row { display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 0.88rem; }
        th { border-top: 1px solid #222; border-bottom: 1px solid #222; padding: 6px 4px; }
        .total-box { margin-top: 12px; border-top: 2px solid #222; padding-top: 10px; }
        .total-row { display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: bold; }
        .footer-note { text-align: center; font-size: 0.8rem; color: #666; margin-top: 24px; font-style: italic; }
        @media print {
          body { padding: 0; }
          .invoice-box { border: none; padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="invoice-box">
        <div class="header">
          <div class="brand">QUÁN BAR ĐÊM</div>
          <div class="sub">Artisan Cocktail Lounge &amp; Speakeasy</div>
          <div class="sub">74-76 Nam Kỳ Khởi Nghĩa, Quận 1, TP. Hồ Chí Minh · Hotline: 0904 200 710</div>
        </div>

        <div class="meta-row"><span>MÃ HÓA ĐƠN: <strong>${escapeHtml(order.code)}</strong></span> <span>${formatDateTime(order.createdAt || new Date())}</span></div>
        <div class="meta-row"><span>Khách hàng: <strong>${escapeHtml(order.name)}</strong></span> <span>SĐT: ${escapeHtml(order.phone || "—")}</span></div>
        <div class="meta-row"><span>Hình thức: ${escapeHtml({ "dine-in": "Tại quầy / Bàn", booking: "Đặt bàn trước", takeaway: "Mang đi" }[order.serviceType] || order.serviceType || "Tại quầy")}</span> <span>Trạng thái: <strong>${order.paymentStatus === "paid" ? "ĐÃ THANH TOÁN" : "CHƯA THANH TOÁN"}</strong></span></div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px;">STT</th>
              <th style="text-align: left;">Món Cocktail</th>
              <th style="width: 40px; text-align: center;">SL</th>
              <th style="text-align: right;">Đơn giá</th>
              <th style="text-align: right;">Thành tiền</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <div class="total-box">
          ${order.subtotal && order.subtotal > order.total ? `
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: #555; margin-bottom: 4px;">
              <span>Tạm tính:</span> <span>${formatMoney(order.subtotal)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: #16a34a; margin-bottom: 6px;">
              <span>Giảm giá / Điểm thưởng:</span> <span>-${formatMoney(order.subtotal - order.total)}</span>
            </div>
          ` : ""}
          <div class="total-row">
            <span>TỔNG THANH TOÁN:</span>
            <span style="color: #b45309;">${formatMoney(order.total)}</span>
          </div>
        </div>

        <div class="footer-note">
          <div>Cảm ơn quý khách đã đồng hành cùng Quán Bar Đêm!</div>
          <div style="margin-top: 4px;">Quý khách vui lòng đối chiếu hoá đơn khi thanh toán. Hẹn gặp lại quý khách!</div>
        </div>
      </div>
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}


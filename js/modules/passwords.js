/* =========================================================
   PASSWORDS.JS - Băm mật khẩu (SHA-256 có muối, lặp nhiều vòng)
   Trước đây mật khẩu nhân sự/khách lưu CHỮ THƯỜNG trong db.json và ai
   cũng đọc được qua GET /staff. Giờ chỉ lưu bản băm dạng:
       sha256$<muối hex>$<băm hex>
   - Muối ngẫu nhiên riêng từng tài khoản: hai người cùng mật khẩu vẫn
     ra hai bản băm khác nhau, không tra "bảng băm có sẵn" được.
   - Lặp ROUNDS vòng để việc dò mật khẩu từng cái tốn thời gian hơn.
   Tự cài SHA-256 bằng JavaScript thuần thay vì crypto.subtle, vì
   crypto.subtle KHÔNG có khi mở web qua http://địa-chỉ-IP (demo trong
   mạng nội bộ) - khi đó đăng nhập sẽ hỏng hoàn toàn.
   Lưu ý trung thực: đây là lớp bảo vệ bổ sung; đăng nhập vẫn chạy ở
   trình duyệt nên không thay thế được một backend xác thực thật.
   ========================================================= */

/* ---------------- Quy tắc đặt mật khẩu (dùng chung mọi form) ----------------
   - Ít nhất 8 ký tự (tối đa 64)
   - Chữ cái đầu tiên phải viết HOA (hỗ trợ cả chữ có dấu: Đ, Á, Ê...)
   - Có ít nhất 1 ký tự đặc biệt (không phải chữ, không phải số, không phải khoảng trắng) */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;
export const PASSWORD_RULE_TEXT = "Mật khẩu phải có ít nhất 8 ký tự, chữ cái đầu viết hoa và có ít nhất 1 ký tự đặc biệt (VD: @ # $ !).";

/** Từng điều kiện của mật khẩu (để form hiện dấu tích theo thời gian thực) */
export function checkPassword(password = "") {
  const p = String(password ?? "");
  const checks = {
    length: p.length >= PASSWORD_MIN_LENGTH && p.length <= PASSWORD_MAX_LENGTH,
    firstUpper: /^\p{Lu}/u.test(p),
    special: /[^\p{L}\p{N}\s]/u.test(p),
  };
  return { ...checks, valid: Object.values(checks).every(Boolean) };
}

/** Chuỗi báo lỗi nếu mật khẩu chưa đạt, chuỗi rỗng nếu hợp lệ */
export function passwordProblem(password = "") {
  return checkPassword(password).valid ? "" : PASSWORD_RULE_TEXT;
}

const ROUNDS = 1000;
const PREFIX = "sha256";
const HASH_PATTERN = /^sha256\$[0-9a-f]{16,}\$[0-9a-f]{64}$/;

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x, n) => (x >>> n) | (x << (32 - n));

/** SHA-256 của một chuỗi UTF-8 -> chuỗi hex 64 ký tự */
export function sha256(text) {
  const data = new TextEncoder().encode(text);
  const bitLength = data.length * 8;
  const paddedLength = ((data.length + 9 + 63) >> 6) << 6;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(data);
  bytes[data.length] = 0x80;
  const view = new DataView(bytes.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  return [...h].map((n) => n.toString(16).padStart(8, "0")).join("");
}

/** Muối ngẫu nhiên 16 byte (hex). Dùng bộ sinh số an toàn của trình duyệt / Node */
function randomSalt() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function derive(password, salt) {
  let digest = sha256(`${salt}:${password}`);
  for (let i = 1; i < ROUNDS; i++) digest = sha256(`${salt}:${digest}`);
  return digest;
}

/** "matkhau" -> "sha256$<muối>$<băm>" (muối mới mỗi lần gọi) */
export function hashPassword(password) {
  const salt = randomSalt();
  return `${PREFIX}$${salt}$${derive(String(password), salt)}`;
}

/** Chuỗi này đã là bản băm của module này chưa (khác với mật khẩu chữ thường) */
export function isHashed(value) {
  return HASH_PATTERN.test(String(value || ""));
}

/** Nếu còn là chữ thường thì băm, đã băm rồi thì giữ nguyên - dùng ở mọi chỗ ghi mật khẩu lên máy chủ */
export function hashIfPlain(value) {
  return isHashed(value) ? value : hashPassword(value);
}

/**
 * Kiểm tra mật khẩu nhập vào với giá trị đang lưu.
 * Vẫn nhận bản ghi CŨ lưu chữ thường (dữ liệu cũ / dữ liệu mẫu) và báo needsUpgrade
 * để nơi gọi băm lại ngay sau khi đăng nhập đúng.
 * @returns {{ok: boolean, needsUpgrade: boolean}}
 */
export function verifyPassword(password, stored) {
  const input = String(password ?? "");
  const saved = String(stored ?? "");
  if (!saved) return { ok: false, needsUpgrade: false };

  if (!isHashed(saved)) return { ok: saved === input, needsUpgrade: saved === input };

  const [, salt, expected] = saved.split("$");
  const actual = derive(input, salt);
  // So sánh toàn bộ chuỗi, không dừng ở ký tự khác đầu tiên
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  return { ok: diff === 0, needsUpgrade: false };
}

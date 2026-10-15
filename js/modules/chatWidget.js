/* =========================================================
   CHAT-WIDGET.JS - Khung chat "Trợ Lý AI · Quán Bar Đêm"

   Tự khởi tạo khi được import (navbar.js import module này nên mọi
   trang khách đều có): nút tròn nổi góc phải dưới -> bấm mở khung chat.
   - Gửi câu hỏi cho aiAssistant.js (Claude trên máy chủ, lỗi thì tự
     chuyển sang trợ lý offline) và hiển thị nhãn nguồn trả lời.
   - Chip gợi ý nhanh, hiệu ứng "đang gõ…", thẻ món có nút "Thêm vào giỏ".
   - Lịch sử lưu sessionStorage (tối đa 30 tin, mất khi đóng tab).
   - Mọi nội dung đều qua escapeHtml trước khi chèn; chỉ sau đó mới đổi
     **đậm** và xuống dòng thành thẻ HTML -> không thể chèn mã độc.
   Không chạy trên trang quản trị (admin-*.html). Không import navbar.js
   (tránh vòng import) - addToCart tự phát sự kiện "cartchange".
   ========================================================= */

import { askAssistant, checkAssistantStatus, getDrinksByIds } from "./aiAssistant.js";
import { getDrinkPricing } from "./drinksService.js";
import { addToCart } from "./ordersService.js";
import { toast, confirmDialog } from "./ui.js";
import { escapeHtml, formatMoney } from "./utils.js";
import { getSession, setSession, removeSession } from "./storage.js";
import { ICONS } from "./icons.js";

const HISTORY_KEY = "ai_chat_history";
const MAX_STORED = 30;
const MAX_INPUT = 1000;

/** Câu hỏi mẫu - bấm là gửi ngay */
const QUICK_CHIPS = [
  "Gợi ý cocktail ngọt nhẹ",
  "Món bán chạy",
  "Có mã giảm giá nào?",
  "Món mới",
  "Ưu đãi sinh nhật",
  "Giờ mở cửa",
];

const WELCOME_TEXT = "Chào bạn! Mình là **Trợ lý AI của Quán Bar Đêm**.\n"
  + "Mình có thể gợi ý cocktail theo khẩu vị và ngân sách, báo món bán chạy, món mới, món đang sale, mã giảm giá và hướng dẫn đặt bàn. Bạn muốn thử gì tối nay?";

const SOURCE_LABELS = {
  checking: "Đang kết nối…",
  online: "Claude AI",
  offline: "Trợ lý offline",
};

/* ---------------- Biểu tượng riêng của khung chat ---------------- */

const SVG_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const chatIcon = (size = 26) => `<svg width="${size}" height="${size}" ${SVG_ATTRS}><path d="M21 12a8.5 8.5 0 0 1-12.4 7.6L3 21l1.4-5.1A8.5 8.5 0 1 1 21 12Z"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" stroke-width="2.4"/></svg>`;
const sendIcon = (size = 18) => `<svg width="${size}" height="${size}" ${SVG_ATTRS}><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7Z"/></svg>`;
const closeIcon = (size = 18) => `<svg width="${size}" height="${size}" ${SVG_ATTRS}><path d="M18 6 6 18M6 6l12 12"/></svg>`;

/* ---------------- Định dạng an toàn ---------------- */

/**
 * Văn bản -> HTML an toàn: escape TOÀN BỘ trước, sau đó mới chuyển
 * **chữ đậm** thành <strong> và \n thành <br>. Vì đã escape, mọi thẻ
 * <script>, onerror=... do AI/khách gõ chỉ còn là chữ vô hại.
 */
export function formatMessageHtml(text) {
  return escapeHtml(String(text ?? ""))
    .replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}

/* ---------------- Lịch sử chat (sessionStorage) ---------------- */

function loadHistory() {
  const saved = getSession(HISTORY_KEY, []);
  if (!Array.isArray(saved)) return [];
  return saved
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, 4000),
      drinkIds: Array.isArray(m.drinkIds) ? m.drinkIds.map(String).slice(0, 4) : [],
      source: m.source === "claude" ? "claude" : "offline",
    }))
    .slice(-MAX_STORED);
}

/* =========================================================
   KHỞI TẠO KHUNG CHAT
   ========================================================= */

function shouldInit() {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (window.__barChatInit) return false;
  const page = window.location.pathname.split("/").pop() || "";
  return !page.startsWith("admin-");
}

/** Tự nạp css/chat.css (đường dẫn tính theo vị trí file JS nên đúng ở mọi trang) */
function loadStylesheet() {
  if (document.querySelector("link[data-bar-chat-css]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("../../css/chat.css", import.meta.url).href;
  link.dataset.barChatCss = "1";
  document.head.appendChild(link);
}

function buildShell() {
  const root = document.createElement("div");
  root.className = "bar-chat";
  root.id = "bar-chat";
  root.innerHTML = `
    <button type="button" class="bar-chat-fab" aria-label="Mở Trợ lý AI" aria-expanded="false" aria-controls="bar-chat-panel">
      <span class="bar-chat-fab-icon">${chatIcon(26)}</span>
      <span class="bar-chat-fab-dot" data-state="checking" aria-hidden="true"></span>
    </button>

    <section class="bar-chat-panel" id="bar-chat-panel" role="dialog" aria-labelledby="bar-chat-title" hidden>
      <header class="bar-chat-head">
        <span class="bar-chat-avatar" aria-hidden="true">${ICONS.sparkle(18)}</span>
        <div class="bar-chat-head-text">
          <h2 class="bar-chat-title" id="bar-chat-title">Trợ Lý AI · Quán Bar Đêm</h2>
          <span class="bar-chat-source" data-state="checking">
            <span class="bar-chat-source-dot" aria-hidden="true"></span>
            <span class="bar-chat-source-text">${SOURCE_LABELS.checking}</span>
          </span>
        </div>
        <button type="button" class="bar-chat-icon-btn" data-action="clear" title="Xoá lịch sử trò chuyện" aria-label="Xoá lịch sử trò chuyện">${ICONS.trash(16)}</button>
        <button type="button" class="bar-chat-icon-btn" data-action="close" title="Đóng" aria-label="Đóng khung chat">${closeIcon(18)}</button>
      </header>

      <div class="bar-chat-messages" role="log" aria-live="polite" aria-relevant="additions"></div>

      <div class="bar-chat-chips" aria-label="Câu hỏi gợi ý">
        ${QUICK_CHIPS.map((chip) => `<button type="button" class="bar-chat-chip" data-chip="${escapeHtml(chip)}">${escapeHtml(chip)}</button>`).join("")}
      </div>

      <form class="bar-chat-form" novalidate>
        <label class="bar-chat-sr-only" for="bar-chat-input">Nhập câu hỏi cho trợ lý</label>
        <textarea id="bar-chat-input" class="bar-chat-input" rows="1" maxlength="${MAX_INPUT}"
          placeholder="Nhập câu hỏi của bạn…" autocomplete="off"></textarea>
        <button type="submit" class="bar-chat-send" aria-label="Gửi câu hỏi">${sendIcon(18)}</button>
      </form>
      <p class="bar-chat-note">Chỉ phục vụ khách 18+ · Uống có trách nhiệm · Không lái xe sau khi uống</p>
    </section>`;
  document.body.appendChild(root);
  return root;
}

function initChatWidget() {
  if (!shouldInit()) return;
  window.__barChatInit = true;
  loadStylesheet();

  const root = buildShell();
  const fab = root.querySelector(".bar-chat-fab");
  const fabDot = root.querySelector(".bar-chat-fab-dot");
  const panel = root.querySelector(".bar-chat-panel");
  const sourceEl = root.querySelector(".bar-chat-source");
  const sourceText = root.querySelector(".bar-chat-source-text");
  const list = root.querySelector(".bar-chat-messages");
  const form = root.querySelector(".bar-chat-form");
  const input = root.querySelector(".bar-chat-input");
  const sendBtn = root.querySelector(".bar-chat-send");

  let history = loadHistory();
  let busy = false;
  let typingEl = null;
  const cardDrinks = new Map(); // id -> object món đang hiển thị trên thẻ (để thêm vào giỏ)

  /* ----- Nhãn nguồn trả lời: Claude AI / Trợ lý offline ----- */
  const setSource = (state) => {
    sourceEl.dataset.state = state;
    fabDot.dataset.state = state;
    sourceText.textContent = SOURCE_LABELS[state] || SOURCE_LABELS.offline;
  };

  /* ----- Thẻ món gợi ý ----- */
  const cardHtml = (drink) => {
    const p = getDrinkPricing(drink);
    const id = String(drink.id);
    const available = drink.status === "available" && Number(drink.stock) > 0;
    const detailUrl = `detail.html?id=${encodeURIComponent(id)}`;
    const image = drink.image
      ? `<img class="bar-chat-card-img" src="${escapeHtml(drink.image)}" alt="${escapeHtml(drink.name)}" loading="lazy">`
      : `<span class="bar-chat-card-img bar-chat-card-img--empty" aria-hidden="true">${ICONS.cocktail(22)}</span>`;
    return `
      <article class="bar-chat-card">
        <a href="${detailUrl}" class="bar-chat-card-media" tabindex="-1" aria-hidden="true">${image}</a>
        <div class="bar-chat-card-body">
          <a href="${detailUrl}" class="bar-chat-card-name">${escapeHtml(drink.name)}</a>
          <div class="bar-chat-card-price">
            <strong>${formatMoney(p.finalPrice)}</strong>
            ${p.onSale ? `<s>${formatMoney(p.originalPrice)}</s><span class="bar-chat-card-badge">−${p.percent}%</span>` : ""}
          </div>
          <div class="bar-chat-card-actions">
            <button type="button" class="bar-chat-add" data-add="${escapeHtml(id)}" ${available ? "" : "disabled"}>
              ${available ? "Thêm vào giỏ" : "Tạm hết"}
            </button>
            <a href="${detailUrl}" class="bar-chat-detail">Chi tiết</a>
          </div>
        </div>
      </article>`;
  };

  /** Nạp dữ liệu món theo id rồi vẽ thẻ vào vùng chứa (bất đồng bộ) */
  const fillCards = async (container, drinkIds) => {
    try {
      const drinks = await getDrinksByIds(drinkIds);
      if (!drinks.length) {
        container.remove();
        return;
      }
      drinks.forEach((d) => cardDrinks.set(String(d.id), d));
      container.innerHTML = drinks.map(cardHtml).join("");
      container.querySelectorAll("img.bar-chat-card-img").forEach((img) => {
        img.addEventListener("error", () => {
          const ph = document.createElement("span");
          ph.className = "bar-chat-card-img bar-chat-card-img--empty";
          ph.innerHTML = ICONS.cocktail(22);
          img.replaceWith(ph);
        }, { once: true });
      });
      scrollToBottom();
    } catch (err) {
      console.error("[chat] Không tải được thẻ món:", err);
      container.remove();
    }
  };

  /* ----- Tin nhắn ----- */
  const messageEl = (msg) => {
    const el = document.createElement("div");
    el.className = `bar-chat-msg bar-chat-msg--${msg.role === "user" ? "user" : "bot"}`;
    const meta = msg.role === "assistant" && msg.source
      ? `<span class="bar-chat-meta">${msg.source === "claude" ? "Claude AI" : "Trợ lý offline"}</span>`
      : "";
    el.innerHTML = `<div class="bar-chat-bubble">${formatMessageHtml(msg.content)}</div>${meta}`;
    if (msg.role === "assistant" && Array.isArray(msg.drinkIds) && msg.drinkIds.length) {
      const cards = document.createElement("div");
      cards.className = "bar-chat-cards";
      cards.innerHTML = `<span class="bar-chat-cards-loading">Đang tải món gợi ý…</span>`;
      el.appendChild(cards);
      fillCards(cards, msg.drinkIds);
    }
    return el;
  };

  const scrollToBottom = () => {
    list.scrollTop = list.scrollHeight;
  };

  const renderAll = () => {
    list.innerHTML = "";
    cardDrinks.clear();
    list.appendChild(messageEl({ role: "assistant", content: WELCOME_TEXT }));
    history.forEach((msg) => list.appendChild(messageEl(msg)));
    scrollToBottom();
  };

  const saveHistory = () => {
    history = history.slice(-MAX_STORED);
    setSession(HISTORY_KEY, history);
  };

  const pushMessage = (msg) => {
    history.push(msg);
    saveHistory();
    list.appendChild(messageEl(msg));
    scrollToBottom();
  };

  const showTyping = () => {
    typingEl = document.createElement("div");
    typingEl.className = "bar-chat-msg bar-chat-msg--bot bar-chat-typing";
    typingEl.setAttribute("aria-label", "Trợ lý đang soạn câu trả lời");
    typingEl.innerHTML = `<div class="bar-chat-bubble"><span></span><span></span><span></span><em>đang gõ…</em></div>`;
    list.appendChild(typingEl);
    scrollToBottom();
  };

  const hideTyping = () => {
    typingEl?.remove();
    typingEl = null;
  };

  const setBusy = (state) => {
    busy = state;
    sendBtn.disabled = state;
    input.setAttribute("aria-busy", String(state));
    root.querySelectorAll(".bar-chat-chip").forEach((chip) => { chip.disabled = state; });
  };

  /* ----- Gửi câu hỏi ----- */
  const send = async (text) => {
    const content = String(text ?? "").trim().slice(0, MAX_INPUT);
    if (!content || busy) return;

    const prior = history.map(({ role, content: c }) => ({ role, content: c }));
    pushMessage({ role: "user", content, drinkIds: [], source: "" });
    input.value = "";
    autoResize();
    setBusy(true);
    showTyping();

    try {
      const answer = await askAssistant(prior, content);
      hideTyping();
      pushMessage({ role: "assistant", content: answer.text, drinkIds: answer.drinkIds || [], source: answer.source });
      setSource(answer.source === "claude" ? "online" : "offline");
    } catch (err) {
      console.error("[chat] Trợ lý gặp lỗi:", err);
      hideTyping();
      pushMessage({
        role: "assistant",
        content: "Xin lỗi, trợ lý đang gặp sự cố. Bạn thử lại sau ít phút hoặc gọi hotline **(028) 1234 5678** nhé.",
        drinkIds: [],
        source: "offline",
      });
    } finally {
      setBusy(false);
      if (!panel.hidden) input.focus();
    }
  };

  /* ----- Mở / đóng ----- */
  const openPanel = () => {
    panel.hidden = false;
    requestAnimationFrame(() => root.classList.add("is-open"));
    fab.setAttribute("aria-expanded", "true");
    fab.setAttribute("aria-label", "Đóng Trợ lý AI");
    document.body.classList.add("bar-chat-open");
    scrollToBottom();
    setTimeout(() => input.focus(), 60);
  };

  const closePanel = () => {
    root.classList.remove("is-open");
    fab.setAttribute("aria-expanded", "false");
    fab.setAttribute("aria-label", "Mở Trợ lý AI");
    document.body.classList.remove("bar-chat-open");
    setTimeout(() => { if (!root.classList.contains("is-open")) panel.hidden = true; }, 220);
    fab.focus();
  };

  const autoResize = () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  };

  /* ----- Sự kiện ----- */
  fab.addEventListener("click", () => (panel.hidden ? openPanel() : closePanel()));

  root.querySelector('[data-action="close"]').addEventListener("click", closePanel);

  root.querySelector('[data-action="clear"]').addEventListener("click", async () => {
    if (!history.length) {
      toast("Chưa có tin nhắn nào để xoá.", "info");
      return;
    }
    const ok = await confirmDialog("Xoá toàn bộ cuộc trò chuyện với trợ lý?", { title: "Xoá lịch sử chat", okText: "Xoá" });
    if (!ok) return;
    history = [];
    removeSession(HISTORY_KEY);
    renderAll();
    input.focus();
  });

  root.querySelectorAll(".bar-chat-chip").forEach((chip) => {
    chip.addEventListener("click", () => send(chip.dataset.chip));
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    send(input.value);
  });

  input.addEventListener("input", autoResize);
  input.addEventListener("keydown", (e) => {
    // Enter gửi; Shift+Enter xuống dòng; đang gõ bộ gõ tiếng Việt (IME) thì bỏ qua
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send(input.value);
    }
  });

  panel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      closePanel();
    }
  });

  // Thêm món vào giỏ từ thẻ gợi ý (uỷ quyền sự kiện cho cả danh sách tin nhắn)
  list.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-add]");
    if (!btn || btn.disabled) return;
    const drink = cardDrinks.get(btn.dataset.add);
    if (!drink) return;
    try {
      addToCart(drink, 1);
      toast(`Đã thêm <strong>${escapeHtml(drink.name)}</strong> vào giỏ hàng.`, "success");
      btn.textContent = "Đã thêm ✓";
      btn.classList.add("is-added");
      setTimeout(() => {
        btn.textContent = "Thêm vào giỏ";
        btn.classList.remove("is-added");
      }, 1600);
    } catch (err) {
      console.error("[chat] Không thêm được vào giỏ:", err);
      toast("Không thêm được món vào giỏ, vui lòng thử lại.", "error");
    }
  });

  renderAll();
  setSource("checking");
  checkAssistantStatus().then(({ online }) => {
    // Chỉ cập nhật nếu chưa có câu trả lời nào đặt nhãn nguồn
    if (sourceEl.dataset.state === "checking") setSource(online ? "online" : "offline");
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initChatWidget, { once: true });
  } else {
    initChatWidget();
  }
}

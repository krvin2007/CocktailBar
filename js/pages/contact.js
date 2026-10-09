/* =========================================================
   CONTACT.JS - Trang liên hệ: form gửi tin nhắn tới quán
   Gửi dữ liệu lên máy chủ bằng POST /messages (async/await).
   ========================================================= */

import "../modules/navbar.js";
import { addMessage } from "../modules/messagesService.js";
import { validateForm, clearFormErrors } from "../modules/validation.js";
import { toast, setButtonLoading } from "../modules/ui.js";

const formEl = document.getElementById("contact-form");
const submitBtn = document.getElementById("contact-submit-btn");

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();

  const { isValid, data } = validateForm(formEl);
  if (!isValid) {
    toast("Vui lòng kiểm tra lại thông tin trong form.", "error");
    return;
  }

  const restoreButton = setButtonLoading(submitBtn, "Đang gửi...");

  try {
    await addMessage({
      name: data.name,
      phone: data.phone,
      email: data.email || "",
      subject: data.subject,
      message: data.message,
    });

    toast("Cảm ơn bạn! Quán đã nhận được tin nhắn và sẽ liên hệ lại sớm.", "success");
    formEl.reset();
    clearFormErrors(formEl);
  } catch (err) {
    toast(err.message, "error");
  } finally {
    restoreButton();
  }
});

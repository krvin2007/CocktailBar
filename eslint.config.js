/* =========================================================
   ESLINT.CONFIG.JS - Cấu hình kiểm tra chất lượng mã (Slide 7)
   Chạy: npm run lint
   ========================================================= */

import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,

  // Mã chạy trên trình duyệt
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, axios: "readonly" },
    },
    rules: {
      "no-unused-vars": ["warn", { ignoreRestSiblings: true, argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-var": "error",            // chỉ dùng let/const (ES6)
      "prefer-const": "error",      // biến không gán lại thì phải là const
      eqeqeq: ["error", "always"],  // luôn so sánh bằng === / !==
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // Script công cụ chạy bằng Node (tạo db.json, kiểm thử, server tĩnh)
  {
    files: ["tools/**/*.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
];

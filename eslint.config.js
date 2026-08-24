// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // games/ 配下は各ゲームが独自の eslint.config.js を持つ完全独立プロジェクトのため対象外
  { ignores: ["dist/**", "node_modules/**", "games/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
);

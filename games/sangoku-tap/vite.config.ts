import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages（/side-scroller/ サブパス配信）でも動くよう相対パスにする
  base: "./",
  build: {
    // Phaser 本体だけで ~1.3MB あり、ゲームエンジンとして正常な範囲。
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id: string): string | undefined {
          if (id.includes("node_modules/phaser")) return "phaser";
          return undefined;
        },
      },
    },
  },
});

import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages（サブパス配信）でも動くよう相対パスにする
  base: "./",
  build: {
    // Phaser 本体だけで ~1.3MB あり、ゲームエンジンとして正常な範囲。
    // manualChunks でアプリコードとは分離済みなので閾値を実態に合わせる。
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Phaser 本体は変更頻度が低いので別チャンクに分離し、
        // アプリコード更新時のキャッシュ再利用率を上げる
        manualChunks(id: string): string | undefined {
          if (id.includes("node_modules/phaser")) return "phaser";
          return undefined;
        },
      },
    },
  },
});

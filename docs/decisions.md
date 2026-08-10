# 設計判断ログ

## 2026-08-10
- 実行環境（ヘッドレスコンテナ、Playwright+Chromium あり、Unity/Unreal 不可）を踏まえ、ゲームはブラウザベース（HTML5/Canvas/JS）で開発する方針とした。
- セッション間で会話コンテキストは共有されないため、引き継ぎ情報はすべてリポジトリ内のファイル（CLAUDE.md / docs/）に残す運用とした。
- AI_project001 は現時点でこのセッションの GitHub 認証からアクセス不可。参照が必要な場合はアクセス権付与が必要。

- 販路戦略: 収益は CrazyGames（広告収益60%・非独占）、日本向け露出は PLiCy / GitHub Pages / X。unityroom は Unity/Godot 限定のため Phaser 製は投稿不可。日本には収益分配型ポータルがほぼ無い（アツマール終了済み）。
- ゲームは日英2言語対応（navigator.language で自動判定＋手動切替）。CrazyGames SDK はラッパー経由で、SDK が無い環境では no-op。

# 設計判断ログ

## 2026-08-10
- 実行環境（ヘッドレスコンテナ、Playwright+Chromium あり、Unity/Unreal 不可）を踏まえ、ゲームはブラウザベース（HTML5/Canvas/JS）で開発する方針とした。
- セッション間で会話コンテキストは共有されないため、引き継ぎ情報はすべてリポジトリ内のファイル（CLAUDE.md / docs/）に残す運用とした。
- AI_project001 は現時点でこのセッションの GitHub 認証からアクセス不可。参照が必要な場合はアクセス権付与が必要。

- 販路戦略: 収益は CrazyGames（広告収益60%・非独占）、日本向け露出は PLiCy / GitHub Pages / X。unityroom は Unity/Godot 限定のため Phaser 製は投稿不可。日本には収益分配型ポータルがほぼ無い（アツマール終了済み）。
- ゲームは日英2言語対応（navigator.language で自動判定＋手動切替）。CrazyGames SDK はラッパー経由で、SDK が無い環境では no-op。

## 2026-08-11
- 転生システム: 累計100万調合で解放、エッセンス = floor(sqrt(累計/100万))、1個につき生産・クリック+10%（永続）。平方根スケールで転生を繰り返すほど周回が速くなる標準設計。
- GitHub Pages デプロイを GitHub Actions で自動化（main への push で typecheck→test→build→deploy）。vite base は './'。リポジトリ設定で Pages のソースを「GitHub Actions」にする必要あり（人間の作業）。

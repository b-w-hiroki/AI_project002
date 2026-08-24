# AI_project002 — AIフル活用ゲーム開発

AI（Claude Code）を主体としてゲームを開発するプロジェクト。

## セッション間の情報共有ルール

Claude のセッションはコンテナごとに使い捨てで、会話コンテキストは共有されない。
セッションをまたいで引き継ぐものは必ずファイルとしてリポジトリに残し、push する。

- 恒久的な前提・ルール → この `CLAUDE.md` に追記する
- 設計判断・経緯 → `docs/decisions.md` に日付付きで追記する
- 未完了タスク・次にやること → `docs/TODO.md` を更新する
- 作業成果 → こまめに commit & push（コンテナ終了で消えるため必須）

セッション開始時は `docs/TODO.md` と `docs/decisions.md` を読んでから作業を始めること。

## 実行環境（リモートコンテナ）の前提

- Node.js 22 / npm 10 / Python 3.11 が利用可能
- Chromium + Playwright が設定済み（`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`、`playwright install` は実行しない）
- ヘッドレス環境のため Unity / Unreal / ネイティブGUI は使えない
- したがって **ゲームはブラウザベース（HTML5 / Canvas / JavaScript）** で開発する

## 複数ゲーム構成

このリポジトリは1リポジトリに複数のゲームを収録するモノレポ構成。

- リポジトリ直下 = 1本目のゲーム（ポーション工房・放置ゲーム）。既存URLを維持するためルート直下のまま
- `games/<name>/` = 2本目以降のゲーム。それぞれ独立した package.json / vite.config.ts / tsconfig.json / eslint.config.js / playwright.config.ts を持つ完全に独立した Phaser + TS + Vite プロジェクト（ルートの node_modules や設定には依存しない）
- 新しいゲームを追加する時は `games/side-scroller/` を雛形としてコピーする
- デプロイは `.github/workflows/deploy.yml` が一括で担当。ルートは Pages の `/` に、`games/<name>/` は `/​<name>/` サブパスにビルド出力をコピーして同じ GitHub Pages サイトにまとめて公開する
- 各ゲームの README/README代わりの説明は `README.md` の一覧表に追記する

## 開発ワークフロー

1. 指定されたフィーチャーブランチで開発する（main へ直接 push しない）
2. 動作確認は Playwright + Chromium でスクリーンショット・自動テストを取る
3. push 後は draft PR を作成してレビュー可能な状態にする

## 検証

- ゲームの動作確認: ローカルで `npx serve`（または `python3 -m http.server`）で配信し、Playwright で操作・スクリーンショット
- テストを追加したら PR 前に必ず実行する

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

## アート素材（画像アセット）の運用

これまでは画像アセット0円・Phaser Graphicsでその場描画する方針だったが、ユーザーがChatGPT等の外部
画像生成でイラスト素材を用意する運用を開始した。

- 必要な画像素材とその依頼プロンプト・依頼状況は `docs/art-assets.md` に一元管理する（ChatGPT側からでも
  この台帳を見れば依頼内容・進捗を追跡できるようにするのが目的）
- 新しく画像素材が欲しくなったら、まず `docs/art-assets.md` に行を追加してからユーザーに依頼を促す
- ユーザーから画像ファイルを受け取ったら `games/<game>/public/images/<asset-id>.png` に保存し、
  コードへの組み込みが完了した時点で `docs/art-assets.md` の該当行のステータスを更新する
- 組み込み後も、画像が読み込めない場合のフォールバック（Graphics描画）を残すか、読み込み失敗時のハンドリング
  方針をコードコメントか `docs/decisions.md` に明記すること

## 実行環境（リモートコンテナ）の前提

- Node.js 22 / npm 10 / Python 3.11 が利用可能
- Chromium + Playwright が設定済み（`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`、`playwright install` は実行しない）
- ヘッドレス環境のため Unity / Unreal / ネイティブGUI は使えない
- したがって **ゲームはブラウザベース（HTML5 / Canvas / JavaScript）** で開発する

## 複数ゲーム構成

このリポジトリは1リポジトリに複数のゲームを収録するモノレポ構成。

- 各ゲームは `games/<name>/` に格納。それぞれ独立した package.json / vite.config.ts / tsconfig.json / eslint.config.js / playwright.config.ts を持つ完全に独立した Phaser + TS + Vite プロジェクト（ルートの node_modules や設定には依存しない）
- リポジトリ直下は Node プロジェクトではなく、静的なゲーム一覧ハブページ（`index.html` 1枚のみ、ビルド不要）
- 新しいゲームを追加する時は `games/side-scroller/` を雛形としてコピーし、ハブページ（ルート `index.html`）にカードを追加する
- デプロイは `.github/workflows/deploy.yml` が一括で担当。各 `games/<name>/` をビルドし、ルートのハブページと合わせて `/<name>/` サブパスにまとめて GitHub Pages に公開する
- 各ゲームの説明は `README.md` の一覧表とルートのハブページ両方に追記する

## 開発ワークフロー

1. 指定されたフィーチャーブランチで開発する（main へ直接 push しない）
2. 動作確認は Playwright + Chromium でスクリーンショット・自動テストを取る
3. push 後は draft PR を作成してレビュー可能な状態にする

## 検証

- ゲームの動作確認: ローカルで `npx serve`（または `python3 -m http.server`）で配信し、Playwright で操作・スクリーンショット
- テストを追加したら PR 前に必ず実行する
- **画面（フロントエンド／UI・見た目）を変更した場合は、改修後に必ず Playwright でスクリーンショットを撮り、ユーザーに送付すること。** コード上のテストが通っていても実際の見た目の確認にはならないため省略しない。1回の変更で複数画面（タイトル／プレイ中／結果 等）に影響する場合はそれぞれ撮る

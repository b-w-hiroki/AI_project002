# AI_project002：WebKit正例ベンチマーク

共通Playbookの固定比較課題：`project002-webkit-01`。このリポジトリの現行mainで、`Color Match` と `Fist Legend（覇拳伝）` の既存Playwrightテストが実ブラウザで通ることを検証する。**AIモデルの比較・旧不具合の負例再生ではない。**

- [Benchmark WebKit workflow](../.github/workflows/benchmark-webkit-positive-control.yml) は2作品を独立ジョブとして `npm ci → npm run build → full WebKit Playwright` で実行する。
- `scripts/benchmark-webkit-report.mjs` はPlaywright自身のJSON reportを読み、全ケースが1回で成功・skipやflaky retriesなしを確認する。Sourceコードの名前だけ見て成功したとは扱わない。
- Color Match：`six individual answer parts are visible and operable` を含む既存の6個別ボタンの可視性と実操作テストが成功すること。
- Fist Legend：`short portrait separates opponent guidance and keeps primary actions touchable` を含む現行WebKit全E2Eが成功すること。
- 画像artifactは既存の `e2e/screenshots/` を参照。レビュー担当がゲーム表示・モックとの違いを別にチェックすること。

**未検証**：古いエラーが起きたSHAの再現、物理スマートフォン、3試行×2構成の独立AIワーカー、料金、ゲームとしての長期評価。CIの成功だけで過去の修正が最適だったとは断言しない。

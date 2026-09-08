# 初回改修の検証と画面集

2026-09-07追補：三国の最新画面集は大型ボスと新しい兵士イラストに更新済み。制作方法・プロンプトは[キャラクター制作記録](../design/sangoku-character-art.md)。

更新：三国ポチポチの第二段階は[最新画面集](sangoku-campaign/index.html)を参照。三国のテストは追加14件により49件。以下の325件と旧画面は第一段階の記録。

2026-09-06。実装範囲と次段階は[統合設計](../design/game-evolution.md)を参照。

[全画面ギャラリー](index.html)（HTMLをブラウザで開く）。以下は改修後の実際のゲーム画面。比較用の改修前画像は含まない。

## 自動検証

6作品すべてで `npm run lint` / `npm run typecheck` / `npm test -- --run` / `npm run build` が成功。

|作品|Vitest件数|
|---|---:|
|三国ポチポチ|35|
|覇拳伝|35|
|カルマクエスト|34|
|ポーション工房|73|
|カラーマッチ|15|
|剣戟の森|133|
|合計|325（追加23）|

Chromium + Playwright の操作検証は `scripts/review-games.mjs` と `scripts/review-edge-cases.mjs`。実行結果はこのフォルダのJSONに保存（25 + 12撮影、重複更新あり、pageerrorなし）。

- 三国：編成→出発→分岐→再読み込み復帰→帰還、二重精算防止。敗走半額・踏破Rare報酬・合成素材消費と不足時拒否。
- 覇拳：敵選択→相性に沿った入力→勝敗結果。
- カルマ：12年通し、報告2枠制限、二重提出防止、最終年代記。
- 工房：初期・設備購入後・注文と一度限りの納品・英語表示。
- カラー：ドラッグ回答、切替境界、締切、結果、遅延処理が再挑戦へ混入しないこと。
- 剣戟：流派選択、選択後の移動、ボス予兆、連撃HUD。

## 確認の限界と再実行

短時間で境界に到達するため、ブラウザ内でシーン状態・時間・一部の乱数を制御している。60秒間の人間による連続プレイや長期経済バランスの評価ではない。スマホ画像は390×844のブラウザ幅確認で、実機タッチの検証ではない。新規全身イラスト・背景差分、剣戟の終点付き冒険などは次段階。

各ゲームをビルドし、リポジトリをポート8765で配信してから実行。QAスクリプトは `CODEX_PRIMARY_RUNTIME_NODE_MODULES` 内のPlaywrightと `GAME_CHROMIUM`（既定 `/tmp/game-chromium`）を使用する。通常環境ではこれらを手元のインストール先に合わせる。配信とChromiumが同じネットワークからlocalhostへアクセスできる必要がある。

QAのシーン参照用フックはレスポンスの一時差し替えで、製品バンドルには追加していない。ブラウザ本体・QA追加依存はリポジトリ外に配置し、製品依存は変更していない。

## 三国ポチポチ

3人編成と10地点の遠征。危険な道へ進むか、報酬を持ち帰るか。

[sangoku-title](sangoku-title.png) · [sangoku-camp](sangoku-camp.png) · [sangoku-expedition](sangoku-expedition.png) · [sangoku-fork](sangoku-fork.png) · [sangoku-return](sangoku-return.png) · [sangoku-defeat](sangoku-defeat.png) · [sangoku-clear](sangoku-clear.png) · [sangoku-breeding](sangoku-breeding.png) · [sangoku-mobile](sangoku-mobile.png)

## 覇拳伝

敵の傾向と予兆を読み、奥義につなぐ。

[fist-title](fist-title.png) · [fist-battle](fist-battle.png) · [fist-result](fist-result.png)

## カルマクエスト

実際の出来事を神へ報告し、翌年と伝説を変える。

[karma-title](karma-title.png) · [karma-growth](karma-growth.png) · [karma-battle](karma-battle.png) · [karma-report](karma-report.png) · [karma-final](karma-final.png)

## ポーション工房

街の需要・注文・評判と、購入で育つ工房の見た目。

[potion-initial](potion-initial.png) · [potion-grown](potion-grown.png) · [potion-orders](potion-orders.png) · [potion-delivered](potion-delivered.png) · [potion-orders-en](potion-orders-en.png)

## カラーマッチ

60秒で段階的に混乱が増すチャレンジと成績分析。

[color-title](color-title.png) · [color-playing](color-playing.png) · [color-switch](color-switch.png) · [color-result](color-result.png)

## 剣戟の森

流派の選択と、向きを示すボスの突進予兆。

[sword-loadout](sword-loadout.png) · [sword-style](sword-style.png) · [sword-playing](sword-playing.png) · [sword-boss-tell](sword-boss-tell.png) · [sword-chain](sword-chain.png)

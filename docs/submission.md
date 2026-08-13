# 投稿準備資料（CrazyGames / PLiCy）

## ゲーム概要

- タイトル: ポーション工房 / Potion Workshop
- ジャンル: 放置・育成（idle/incremental）
- 対応言語: 日本語・英語（自動判定＋切替ボタン）
- 対応デバイス: PC・スマートフォン（タッチ対応、レスポンシブ）
- 技術: Phaser 3 + TypeScript + Vite（HTML5、外部プラグイン依存なし）

## 紹介文（日本語・PLiCy等向け）

> クリックしてポーションを調合し、設備を増やして自動生産。集めたポーションで
> 錬金術師や大釜、竜やポータルまで揃えて、生産効率をどんどん上げよう。
> 一定量を調合したら「転生」して、次の周回をもっと有利に進められる永続ボーナスを
> 獲得。実績を集めながら、放置と操作の両方で楽しめるポーション工房を大きく育てよう。

## Description (English, for CrazyGames)

> Click to brew potions, then hire alchemists, cauldrons, dragons, and portals to
> automate production. Once you've brewed enough, ascend to reset your run for a
> permanent production bonus and push further next time. Collect achievements and
> grow your workshop your way — whether you love clicking or watching numbers climb
> on their own.

## カテゴリ / タグ候補

- Idle, Clicker, Incremental, Casual
- 日本語: 放置ゲーム, クリッカー, 育成

## 主要機能（審査・紹介文に使える箇条書き）

- クリックで手動生産、設備購入で自動生産
- 8種類の設備、指数関数的なコスト増加
- 転生（プレステージ）システムで周回ごとに強くなる
- 10種類の実績
- オフライン進行（最大8時間）
- 日本語/英語 完全対応
- サウンドON/OFF切り替え
- セーブデータのエクスポート/インポート（JSON）
- レスポンシブ対応（PC・スマホ）

## CrazyGames投稿の技術要件チェックリスト

- [x] `src/platform/crazygames.ts` で SDK 初期化・`gameplayStart`/`gameplayStop`/`happytime` 呼び出し済み
- [x] 非独占（他ポータルにも同時公開可能）
- [ ] `npm run build` の `dist/` を zip 化してアップロード（投稿時に実施）
- [ ] サムネイル画像（推奨 1200×630 以上）を用意 — 現状 `public/og-image.png` は単色プレースホルダーなので、投稿前に差し替え推奨
- [ ] CrazyGames 開発者アカウント作成（人間の作業）

## PLiCy投稿の準備

- [ ] PLiCy アカウント作成（人間の作業）
- [ ] `dist/` をそのままアップロード、または GitHub Pages のURLを直接案内
- [x] 日本語の紹介文（上記）

## 公開URL

- GitHub Pages: https://b-w-hiroki.github.io/AI_project002/

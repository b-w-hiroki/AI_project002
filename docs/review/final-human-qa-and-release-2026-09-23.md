# 最終実機QA・公開チェックシート（2026-09-23）

コード側の実装・自動検証は完了済み。最新ゲームコード（`3fbb6dd`）で Browser E2E run #343、WebKit Smoke run #63、CrazyGames Readiness run #7、CrazyGames Marketing Assets run #7 が成功し、最新main（`e505de2`）の GitHub Pages deploy run #164 も成功。CrazyGames実投稿は `docs/review/crazygames-final-submission-2026-09-24.md` を単一の提出手順として使用する。

## 1. iOS Safari 実機QA

端末名 / iOS / Safariバージョンを記録する。

### 全6作品共通
- [ ] 起動して主要画面まで遷移できる
- [ ] 縦持ちで主要CTA・タップ・ドラッグ位置がずれない
- [ ] 横持ちへ回転してUIが欠けない
- [ ] Safariアドレスバー伸縮でCanvasが大きくジャンプしない
- [ ] Dynamic Island / notch / ホームインジケータと主要UIが重ならない
- [ ] 効果音 / BGMが意図した音量で再生される
- [ ] 10分以上連続プレイで著しいカクつき・メモリ落ちがない

### 作品別重点
- [ ] 剣戟の森: 仮想スティック / 攻撃 / ガードhold-release / 攻撃・被弾専用スプライト
- [ ] 覇拳伝: 3人編成 / portrait交代 / landscape交代 / 奥義 / キャラ専用立ち絵
- [ ] Karma Quest: ホーム→依頼→討伐→報告→次年、縦横回転、12年進行
- [ ] 三国ポチポチ: 編成 / 出陣 / 地域イベント / 3地域守将
- [ ] Color Match: ドラッグ / FLOW / 20秒弱点練習 / 音
- [ ] Potion Workshop: 調合 / 設備 / 街選択 / 転生 / 長時間放置復帰

## 2. Android Chrome 実機QA

端末名 / Android / Chromeバージョンを記録する。

- [ ] 全6作品で縦持ち・横持ちの主要フローが操作できる
- [ ] browser bar伸縮でCanvasとタップ位置がずれない
- [ ] 戻る / アプリ切替 / 復帰後も進行不能にならない
- [ ] 音・画像読込に問題がない
- [ ] 10分以上連続プレイで著しい性能劣化がない
- [ ] iOS重点項目と同じ作品別操作を確認する

## 3. 問題発生時

- [ ] 端末名 / OS / ブラウザバージョンを記録
- [ ] 画面・操作手順・期待結果・実際結果を記録
- [ ] スクリーンショットまたは動画を残す
- [ ] 既存Issue #90 / #93 / #97 に記録するか、再現性が高いものは個別Issue化

## 4. CrazyGames

- [x] 最新mainで6作品の英語fallback / SDK locale / iframe / 初期download / 禁止UIを自動検証
- [x] 最新mainから6作品分の3種カバー + landscape/portrait previewをartifact生成
- [x] 各作品の投稿ZIPを `game-release-packages` artifactで自動生成
- [ ] 開発者アカウント作成
- [ ] Developer Portal Previewで初期download size / SDK / locale / asset見た目を最終確認
- [ ] PEGI 12相当の内容確認
- [ ] `docs/submission.md` のタイトル・紹介文・タグを使用
- [ ] 最新 `game-release-packages` artifact の各ZIPを6作品分アップロード
- [ ] 最新 `*-crazygames-marketing` artifact のカバー/previewを使用
- [ ] 審査URL / 公開URL / 審査結果をIssue #98へ記録
- [ ] プラットフォーム固有修正は個別Issue化

## 5. PLiCy

- [ ] アカウント作成
- [ ] `docs/submission.md` の日本語紹介文を使用
- [ ] 最新distまたはGitHub Pages URLで6作品を登録
- [ ] 公開URLをIssue #98へ記録
- [ ] プラットフォーム固有修正は個別Issue化

## 6. 現在の自動検証基準

- main: `e505de2`（PR #172まで反映）
- ゲームコード基準: `3fbb6dd`（PR #171）
- Browser E2E: run #343 成功
- WebKit Smoke: run #63 成功
- CrazyGames Readiness: run #7 全6作品成功
- CrazyGames Marketing Assets: run #7 全6作品成功、6 artifact生成
- GitHub Pages: Deploy to GitHub Pages run #164 成功
- open PR: 0
- コード側作品Epic #94 / #95 / #96 / #99 / #100: 完了
- 剣戟 #93: 実機QAのみ残件
- Karma #90: 実機QAのみ残件
- 共通 #97: 実機QAのみ残件
- 公開 #98: CrazyGames Developer Portal最終確認、外部アカウント作成・実投稿のみ残件

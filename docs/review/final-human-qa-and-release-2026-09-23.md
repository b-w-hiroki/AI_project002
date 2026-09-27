# 最終実機QA・公開チェックシート（2026-09-23）

コード側の実装・自動検証は完了済み。現在のリリース候補は **v1.0.0-rc.1**。最新状態は `RELEASE-CANDIDATE.md` と `docs/review/final-release-gate-2026-09-27.md` を正とする。CrazyGames実投稿は `docs/review/crazygames-final-submission-2026-09-24.md` を単一の提出手順として使用する。固定commit/run番号ではなく、**mainの最新成功workflow**を使用する。

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

- release candidate: `v1.0.0-rc.1`
- source: main
- Browser E2E: mainの最新成功run
- WebKit Smoke: mainの最新成功run
- CrazyGames Readiness: mainの最新成功run
- CrazyGames Marketing Assets: mainの最新成功run
- GitHub Pages: mainの最新成功run
- open PR: 0をリリース前に確認
- 剣戟 #93: 実機QAのみ残件
- Karma #90: 実機QAのみ残件
- 共通 #97: 実機QAのみ残件
- 公開 #98: CrazyGames / PLiCy外部アカウント・Portal Preview・実投稿
- branch cleanup: Issue #212
- v1.1 gameplay/retention: Issue #213

Karma Questは2026-09-27に未参照の重複PNG/旧outcome画像を削除済み。初期ロード設計は変更せず、総packageを軽量化している。

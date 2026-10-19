# 共通・配信基盤 — 現行仕様書

初版確認: 2026-10-19 / c975eab。公開状態ではなく作業ツリーの記述。

## 製品構成

ブラウザの一覧ハブから6つの独立ゲームへ移動する。各作品は自分のゲームループ・保存領域を持つ。
JavaScript、Canvas、localStorageが使用できるブラウザを前提とする。アカウント、全作品共通のクラウド保存やライブ対戦は提供範囲としない。

## スマホ・入力・言語

画面サイズ・向き・safe areaに合わせてCanvasを収める。縦横でレイアウトを切り替えてもタップ位置と表示の対応を保つ。
主要タップ領域は44px相当を目安とし、主要CTAをブラウザUIやsafe areaから離す。達成状況は作品ごとのE2Eと実画面で確認する。
日本語表示と英語fallbackを持つ。翻訳が必要な変更では主要操作と回転後の表示を対象にする。
音設定やPortal SDKの挙動は各作品のplatform実装に従う。Karmaの8秒タイムアウトを他5作品にもあると扱わない。

## 素材と保存

各ゲームの画像はそのゲームのpublic/images以下。生成素材はgenerated以下、参考資料はruntimeと分離する。
縦横比を保ち、UI文字を背景へ焼き込まない。コードで表す意味のあるUI・FXはコードを優先する。
localStorageは同一originのブラウザ保存であり、端末変更・消去・プライベート閲覧による保持を保証しない。保存互換性は作品ごとの仕様を参照する。

## 配布と完了条件

[deploy workflow](../../.github/workflows/deploy.yml) がハブと6作品をビルド・配信する。単体ZIP等の実際の成果物はworkflowとリリース資料を参照。
コード保存、テスト成功、マージ、公開確認、実機確認は別の状態。
v1.0.0前の物理iOS Safari・Android Chrome・外部Portal Previewは [RELEASE-CANDIDATE](../../RELEASE-CANDIDATE.md) に従う。
この文書整備では公開や実機合格を追加認定しない。

## 関連文書

[共通設計](platform-design.md) / [更新手順](../documentation-workflow.md) / [QA条件](../review/game-finish-qa-template.md)

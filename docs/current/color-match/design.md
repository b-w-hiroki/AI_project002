# カラーマッチ — 実装設計書

初版確認日: 2026-10-19。実装基準: `c975eab`（PR #347までを含む作業ツリー。公開状態ではない）。
更新時は変更箇所と [変更記録](../../updates) を同じPRで更新する。運用は [文書更新手順](../../documentation-workflow.md)。
対になる文書: [仕様書](spec.md)。

## 起動と責務
[main.ts](../../../games/color-match/src/main.ts) と [GameScene](../../../games/color-match/src/scenes/GameScene.ts) がtitle / playing / resultを制御する。
[round](../../../games/color-match/src/logic/round.ts) は色・出題・得点、[challenge](../../../games/color-match/src/logic/challenge.ts) は60秒の判定切替、[resultInsight](../../../games/color-match/src/logic/resultInsight.ts) は改善点を生成する。
表示改修時も正答IDと6択の入力を別のルールへ変えない。

## 状態と入力
SessionModeはchallenge / practice。練習は20秒、判定は固定。Sceneは回答受付、次の問題へのタイマー、連打抑止を所有する。
Scene再生成と回転を区別し、残ったタイマーや入力で二重回答しないことをE2Eで確認する。

## 永続化
[progress.ts](../../../games/color-match/src/logic/progress.ts) のキー:
color_match_60s_best_score_v1 / color_match_60s_best_turbo_v1 / color_match_writing_mode_v1 / color_match_performance_v1。
成績はcontent / color / switchの正答数・総数・反応時間・サンプル数。設定の不正値は既定表記へ戻す。
統計形式を変える場合は旧値の正規化と「出題なし」の表示を確認する。

## 検証と参照
[tests](../../../games/color-match/tests) と [E2E](../../../games/color-match/e2e/game.spec.ts) を使用。
[モック構想](../../design/redesign-color-match.md) にある表現と現在の60秒ルールを混同しない。ゲーム性は本仕様を優先し、将来案は別記する。

## 確認範囲・保留
現行コードと既存テストを照合した仕様の初版。本作の全機能を今回再プレイしたという意味ではない。
実機・外部Portal・公開の合否は [リリース資料](../../../RELEASE-CANDIDATE.md) と個別QA記録を参照する。

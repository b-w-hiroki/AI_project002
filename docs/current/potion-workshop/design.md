# ポーション工房 — 実装設計書

初版確認日: 2026-10-19。実装基準: `c975eab`（PR #347までを含む作業ツリー。公開状態ではない）。
更新時は変更箇所と [変更記録](../../updates) を同じPRで更新する。運用は [文書更新手順](../../documentation-workflow.md)。
対になる文書: [仕様書](spec.md)。

## 起動と責務
[main.ts](../../../games/potion-workshop/src/main.ts) の実行Sceneは [IdleScene](../../../games/potion-workshop/src/scenes/IdleScene.ts)。GameScene.tsは最小動作確認用であり製品の主経路ではない。
presentation → conceptArt → mobileLayout → wall-clock persistence の組込順を維持する。
[economy](../../../games/potion-workshop/src/logic/economy.ts) が生産・価格・転生、[contracts](../../../games/potion-workshop/src/logic/contracts.ts) が需要／注文、[towns](../../../games/potion-workshop/src/logic/towns.ts) が街を扱う。
[nextObjective](../../../games/potion-workshop/src/logic/nextObjective.ts) は転生可能→未完了の初期注文→需要設備→転生進捗の順で案内を決める。

## 状態と永続化
[save.ts](../../../games/potion-workshop/src/logic/save.ts) のキーは ai_project002_save_v1。state / savedAtを保存し、ロード時はnewGameとマージする。
[persistence.ts](../../../games/potion-workshop/src/persistence.ts) はDate.now基準で5秒ごとの保存を補助する。生産tickを実時間に置換する処理ではない。
パース検証は限定的であり、任意の不正データを完全に正規化する保証はしない。保存形式の拡張は既定値と旧JSON読込を同時に検査する。

## 表示と検証
[mobileLayout](../../../games/potion-workshop/src/mobileLayout.ts) が縦横の管理導線を担う。Scene再入場時の画像decode・テクスチャ参照を確認する。
[test群](../../../games/potion-workshop/tests) で経済・保存を検査し、[E2E](../../../games/potion-workshop/e2e/game.spec.ts) で大釜、ナビ、転生、街、保存を確認する。
[既存構想](../../design/redesign-potion-workshop.md) は目標表現の参照であり、すべての掲載機能が実装済みとは限らない。

## 確認範囲・保留
現行コードと既存テストを照合した仕様の初版。本作の全機能を今回再プレイしたという意味ではない。
実機・外部Portal・公開の合否は [リリース資料](../../../RELEASE-CANDIDATE.md) と個別QA記録を参照する。


# 三国ポチポチ — 実装設計書

初版確認日: 2026-10-19。実装基準: `c975eab`（PR #347までを含む作業ツリー。公開状態ではない）。
更新時は変更箇所と [変更記録](../../updates) を同じPRで更新する。運用は [文書更新手順](../../documentation-workflow.md)。
対になる文書: [仕様書](spec.md)。

## 起動と責務
[main.ts](../../../games/sangoku-tap/src/main.ts) はGameSceneとExpeditionSceneを登録し、presentation / artFidelity / visualPolish / mobileLayoutを組み込む。
[ExpeditionScene](../../../games/sangoku-tap/src/scenes/ExpeditionScene.ts) が遠征の進行と描画を担当。
[expedition](../../../games/sangoku-tap/src/logic/expedition.ts)、[regions](../../../games/sangoku-tap/src/logic/regions.ts)、[campaign](../../../games/sangoku-tap/src/logic/campaign.ts) が進軍・地域・攻略記録を分離する。
[roster](../../../games/sangoku-tap/src/logic/roster.ts)、[general](../../../games/sangoku-tap/src/logic/general.ts)、[breeding](../../../games/sangoku-tap/src/logic/breeding.ts) は武将・装備を担当。

## 永続化
[progress](../../../games/sangoku-tap/src/logic/progress.ts): sangoku_tap_currency_v1 / best_distance_v1 / equipment_inventory_v1 / owned_generals_v1 / equipped_map_v1（後4つにもsangoku_tap_接頭辞）。
[expeditionSave](../../../games/sangoku-tap/src/logic/expeditionSave.ts): sangoku_expedition_v1 / sangoku_starter_v1 / sangoku_party_v1。
campaign.ts: sangoku_campaign_v1。有効なactive遠征のstep、HP、戦利品、部隊値を検証して復元する。
初期武将・装備の配布はstarter記録を使う。報酬処理を描画やTween終了だけに依存させない。

## 描画と検証
WebKitはCanvas fallback、その他はAUTO。縦のホームと横の遠征で同じ保存・編成を使う。
[tests](../../../games/sangoku-tap/tests) と [E2E](../../../games/sangoku-tap/e2e/game.spec.ts) を参照。
[キャンペーン設計](../../design/sangoku-campaign.md)・[演出設計](../../design/sangoku-staging.md) は詳細な背景資料として残す。

## 確認範囲・保留
現行コードと既存テストを照合した仕様の初版。本作の全機能を今回再プレイしたという意味ではない。
実機・外部Portal・公開の合否は [リリース資料](../../../RELEASE-CANDIDATE.md) と個別QA記録を参照する。


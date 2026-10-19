# 覇拳伝 — 実装設計書

初版確認日: 2026-10-19。実装基準: `c975eab`（PR #347までを含む作業ツリー。公開状態ではない）。
更新時は変更箇所と [変更記録](../../updates) を同じPRで更新する。運用は [文書更新手順](../../documentation-workflow.md)。
対になる文書: [仕様書](spec.md)。

## 起動と責務
[main.ts](../../../games/fist-legend/src/main.ts) は presentation / conceptArt / mobileLayout / hajaMode / artFidelity / visualPolish を組み込む。GameSceneの既存挙動をラップするため順序に注意する。
[battle](../../../games/fist-legend/src/logic/battle.ts) は相性、ダメージ、ゲージ、HPを扱う。
[team](../../../games/fist-legend/src/logic/team.ts)、[teamTactics](../../../games/fist-legend/src/logic/teamTactics.ts)、[opponent](../../../games/fist-legend/src/logic/opponent.ts)、[story](../../../games/fist-legend/src/logic/story.ts) が編成・相手・進行を担当。

## 戦闘補正
[haja](../../../games/fist-legend/src/logic/haja.ts) は通常戦闘の解決後に差分を補正する。三すくみの本体を置き換えない。
剛は与ダメージ+40%、柔は被ダメージ50%軽減、瞬は奥義加速と硬直短縮。持続は5000ms。
タイマー、交代、演出を跨いだ同一操作の二重適用を避ける。

## 永続化と描画
[progress](../../../games/fist-legend/src/logic/progress.ts): fist_legend_currency_v1 / fist_legend_win_count_v1 / fist_legend_team_v1 / fist_legend_story_progress_v1。
[gacha](../../../games/fist-legend/src/logic/gacha.ts) は排出率と抽選の純粋ロジック。GameSceneのrollGachaが通貨を消費して結果を表示する。gacha.ts自体に保存処理はない。
WebKitはCanvas fallback、その他はAUTO。回転後の描画消失と操作座標を両方検査する。

## 検証と参照
[tests](../../../games/fist-legend/tests)、[E2E](../../../games/fist-legend/e2e/game.spec.ts)、[覇者E2E](../../../games/fist-legend/e2e/haja.spec.ts)。
[構想資料](../../design/redesign-fist-legend.md) と本書の現行動作を区別する。

## 確認範囲・保留
現行コードと既存テストを照合した仕様の初版。本作の全機能を今回再プレイしたという意味ではない。
実機・外部Portal・公開の合否は [リリース資料](../../../RELEASE-CANDIDATE.md) と個別QA記録を参照する。

# 剣戟の森 — 実装設計書

初版確認日: 2026-10-19。実装基準: `c975eab`（PR #347までを含む作業ツリー。公開状態ではない）。
更新時は変更箇所と [変更記録](../../updates) を同じPRで更新する。運用は [文書更新手順](../../documentation-workflow.md)。
対になる文書: [仕様書](spec.md)。

## 起動経路
[main.ts](../../../games/side-scroller/src/main.ts) はLoadoutSceneとGameSceneを登録し、Arcade Physicsを使用する。
通常は [mockBattleView](../../../games/side-scroller/src/mockBattleView.ts)。URLのlegacyView=1またはlocalStorageのside-scroller:legacy-view=1で旧presentation / conceptArt / mobileLayout / artFidelity / mobileScenePolish経路を使う。
旧経路だけを編集して通常画面を修正したと判定しない。

## ロジックと状態
[combat](../../../games/side-scroller/src/logic/combat.ts) は戦闘・武器、[waves](../../../games/side-scroller/src/logic/waves.ts) はウェーブ、[style](../../../games/side-scroller/src/logic/style.ts) は連撃・居合とボスの予兆／突進／隙、[commandInput](../../../games/side-scroller/src/logic/commandInput.ts) はコマンドを担当。
[loadout](../../../games/side-scroller/src/logic/loadout.ts) のWeaponTemplate→WeaponInstanceを戦闘用WeaponDefへ変換する。
武器切替の実行と物理への適用はScene側。描画だけで武器能力を変更しない。

BattleInputAdapterはキーごとに押下識別子をWeakMapで保持し、次フレームへ送る解放時に照合する。押し直されたキーへの古いonUpを無視し、短いタップをフレームへ渡す従来の遅延解放は維持する。

## 永続化と検証


キーはai_project002_sideScroller_loadout_v1とai_project002_sideScroller_bestWave_v1。ロードアウトと最高記録は別管理。
[progress](../../../games/side-scroller/src/logic/progress.ts) とloadoutのパース・既定値を変更時に確認する。
[tests](../../../games/side-scroller/tests) と [E2E](../../../games/side-scroller/e2e/game.spec.ts) で通常・必要な旧経路、回転、移動、攻撃、表示するウェーブを検査する。
[UI再設計](../../design/side-scroller-uiux-reboot.md) は詳細な意図の参照先。未実装案を現行仕様へ混ぜない。

ガードE2Eは押下前・保持中・解放後のキーとガード状態に加え、画面停止条件・フレーム・Scene状態・フォーカス・CanvasサイズをJSONへ記録する。失敗時のスクリーンショットとともに既存のe2e/screenshots artifactへ保存し、再発時の切り分けに使う。合格条件と5秒の検査待機は変更しない。

ドラッグE2Eも操作前・入力保持・移動・解放の状態系列を同じartifactへ保存する。左右入力、ガード入力、位置・速度、Body有効状態と物理停止を記録し、入力が届かない場合と入力後に動かない場合を区別する。移動量・停止速度の合格条件は維持する。

## 確認範囲・保留
現行コードと既存テストを照合した仕様の初版。本作の全機能を今回再プレイしたという意味ではない。
実機・外部Portal・公開の合否は [リリース資料](../../../RELEASE-CANDIDATE.md) と個別QA記録を参照する。

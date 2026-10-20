# 現行仕様・設計の入口

このディレクトリは「今の実装」を説明する正本。仕様書は利用者から見た振る舞い、設計書はそれを実現する責務・状態・保存・検証を扱う。
初版の実装基準は c975eab（2026-10-19、PR #347までを含む）。mainへの統合・公開・実機検証済みを意味しない。

| 対象 | 仕様書 | 設計書 |
| --- | --- | --- |
| 共通・配信基盤 | [仕様](platform-spec.md) | [設計](platform-design.md) |
| ポーション工房 | [仕様](potion-workshop/spec.md) | [設計](potion-workshop/design.md) |
| 剣戟の森 | [仕様](side-scroller/spec.md) | [設計](side-scroller/design.md) |
| カラーマッチ | [仕様](color-match/spec.md) | [設計](color-match/design.md) |
| 覇拳伝 | [仕様](fist-legend/spec.md) | [設計](fist-legend/design.md) |
| カルマクエスト | [仕様](karma-quest/spec.md) | [設計](karma-quest/design.md) |
| 三国ポチポチ | [仕様](sangoku-tap/spec.md) | [設計](sangoku-tap/design.md) |

## 正本の分担

- 現行動作: 上の仕様書・設計書。矛盾を見つけたらコード・テスト・意図を確認し、同じPRで修正する。
- 更新手順: [文書更新ワークフロー](../documentation-workflow.md)。変更記録は [updates](../updates)。
- 将来案・モックの意図: [既存設計資料](../design/README.md)。実装済みの保証には使わない。
- 作業判断: [decisions](../decisions.md)。未完了: [TODO](../TODO.md)。検証証拠: [review](../review/README.md)。
- リリース: [RELEASE-CANDIDATE](../../RELEASE-CANDIDATE.md)、[CHANGELOG](../../CHANGELOG.md)。古い合格記録を新しい版の合格とみなさない。
- 共通スタジオ標準は [外部Playbook](https://github.com/b-w-hiroki/studio-playbook/blob/main/README.md)。本文は本リポジトリへ複製しない。

数値や細かな全データを文書へ丸写しせず、判断に必要なルールとソースへのリンクを残す。未実装案は現行仕様に混ぜない。

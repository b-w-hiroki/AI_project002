# AGENTS.md — AI_project002

このリポジトリで作業するAIエージェント向けの共通実行ルール。

## Start here
1. `CLAUDE.md`
2. `docs/review/final-release-gate-2026-09-27.md`
3. `docs/review/game-finish-qa-template.md`
4. `docs/design/retention-phase-2026-09-27.md`
5. 対象ゲームの `public/images` / generated manifest / E2E

## Core constraints
- 既存ゲームのコアループを勝手に別ジャンルへ変えない。
- 重複素材を作らない。生成前に既存素材・manifest・reviewを調べる。
- 背景にTAP / START / tutorial textを焼き込まない。
- 画像化する意味が薄いUI/FXはcode-nativeを優先する。
- generated assetsは `games/<game>/public/images/generated/`。
- 参考アートはruntimeフォルダへ混ぜない。
- fallbackが有効な画面は可能な限り維持する。

## Visual workflow
1. 現状スクショを取得。
2. 最も弱い画面/瞬間を1つ決める。
3. 必要最小限のコード/素材変更。
4. lint / typecheck / unit / build。
5. Browser E2E / WebKit。
6. visual-QA artifactの実スクショを確認。
7. モックとの差が残る場合だけ追加修正。
8. PR/merge。

## Mobile priority
- primary actionを最も強く見せる。
- 主要CTAはsafe area / browser chromeから離す。
- タップ領域は最低44px相当を目安。
- 回転後もタップ座標とCanvas比率を維持。
- 剣戟の森ではATK / SKL / GRDを主要操作階層として維持。

## Asset policy
- 同一役割のPNG/WebP重複を残さない。
- superseded assetはコード参照を確認してから削除。
- package sizeを増やす素材は、実画面で明確な改善がある場合だけ採用。
- Karma Questはdeferred loadingを壊さない。

## Release policy
- 現在の候補は `v1.0.0-rc.1`。
- v1.0.0前に物理iOS Safari / Android Chromeと外部Portal Previewが必要。
- RC中に大きな新機能を混ぜない。新しい継続プレイ機能はv1.1 Epicへ。
- release資料は `RELEASE-CANDIDATE.md` / `CHANGELOG.md` / final release gateを正とする。

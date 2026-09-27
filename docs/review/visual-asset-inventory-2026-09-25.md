# Visual Asset Inventory — final status 2026-09-27

## 運用ルール
- 既存素材を再生成しない。
- 実装用画像は `games/<game>/public/images/generated/`、参考シートはreview資料として分離する。
- 元モックのゲーム性・世界観を固定する。
- 背景にTAP / START / 説明文を焼き込まない。
- UI/FXは画像化が有効な場合だけ生成し、Phaser/code-native実装との重複を避ける。

## Final status

| Title | Runtime generated assets | Code/native or existing assets | Final decision |
| --- | --- | --- | --- |
| 三国ポチポチ | hero / capital bg / deploy button / impact FX / city prop | generals / battlefield / boss / campaign UI | complete |
| Potion Workshop | female alchemist | workshop bg / cauldron / dragon / responsive UI / brew FX | complete |
| Karma Quest | dedicated generated folder not required | hero / factions / dialogue / outcomes / backgrounds / chronicle UI | complete |
| 剣戟の森 | guardian boss / slash FX | hero poses / enemies / forest / HUD / hit FX | complete |
| 覇拳伝 | dedicated generated folder not required | arena / hero / enemy / fighters / responsive result UI / clash effects | complete |
| Color Match | six-answer UI sheet | mascot / turbo badge / fantasy backgrounds / result FX | complete |

## Reference-only / rejected candidates
- `st-brand-lockup.webp`: reference/branding confirmation only.
- Local-only candidates intentionally not committed:
  - `sf-fx-hit`
  - `sf-ui-battle-hud`
  - `fl-fx-clash`
  - `fl-ui-victory-banner`
  - `st-prop-capital-node`
  - `st-ui-campaign-banner`
- Reason: the current game already has the same runtime role covered. Adding them would duplicate UI/FX responsibility or add visual density without improving gameplay clarity.

## Done conditions
- [x] No duplicate generation.
- [x] Prefix-based naming for generated runtime assets.
- [x] Generated assets integrated only where they improve the actual screen.
- [x] Fallbacks retained where image loading can fail.
- [x] Six-title Browser E2E visual artifacts produced.
- [x] WebKit Smoke passed.
- [x] Pages/release package workflow passed.
- [x] Final cross-title screenshot QA completed.

See [Final Release Gate — 2026-09-27](final-release-gate-2026-09-27.md).

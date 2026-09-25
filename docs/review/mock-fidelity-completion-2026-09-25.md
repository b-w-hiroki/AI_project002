# Mock Fidelity Completion Audit — 2026-09-25

## Scope
6タイトルのモック寄せ実装を、ゲーム性を変更せずに完了させるための最終台帳。

| Title | Characters | Backgrounds | UI | Effects | Props | Branding | Mock-fidelity implementation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Color Match | `cm-mascot.png` | `cm-bg-fantasy-*.svg` | `generated/ui/cm-answer-buttons.webp` + Phaser UI | `cm-turbo-badge.png` + `artFidelity.ts` | mascot/crown runtime elements | title typography in GameScene | answer area enlarged, particles reduced |
| 三国ポチポチ | `generated/characters/st-hero-protagonist.webp` + `st-general-*` | `generated/backgrounds/st-bg-capital.webp` + battlefield | `generated/ui/st-ui-deploy-button.webp` | `generated/effects/st-fx-impact.webp` | `generated/props/st-prop-city.webp` | `generated/branding/st-brand-lockup.webp` | title + campaign + boss presentation |
| Potion Workshop | `generated/characters/pw-hero-alchemist-female.webp` | `pw-bg-workshop.png` | `ui/theme.ts` / IdleScene cards & orders | brew/town glow code FX | cauldron / dragon + workshop decor | title/header typography | female hero locked, workshop composition tightened |
| 剣戟の森 | hero + attack/hurt + enemy variants + boss SVG | `sf-bg-forest.png` | GameScene HUD / LoadoutScene | reusable combat slash/hit textures in GameScene | weapon/loadout/pickup runtime elements | title/loadout presentation | hero enlarged, boss silhouette prioritized |
| 覇拳伝 | hero/enemy + four fighter SVGs + gacha Ryuga | `fl-bg-arena.png` | battle/title/result/gacha UI in GameScene | clash/aura/result FX in GameScene | roster/team/gacha runtime elements | title typography | versus composition and fighters enlarged |
| Karma Quest | hero/elder/dialogue portraits | capital/village/faction backgrounds | choice/report/faction UI | outcome art + visual polish | faction icons / chronicle deeds | title/chronicle typography | hero-first title, stronger choice/chronicle hierarchy |

## Rules preserved
- 元モックのゲーム性を変更しない。
- 重複生成を行わない。
- 背景に世界観外の TAP / START / 説明文を焼き込まない。
- AI感の強い常時粒子を抑える。
- 画像化する価値がないUI/FXは無理に重複画像化せず、既存のPhaser実装を正式なruntime assetとして扱う。
- 実装用画像と参考シートを混在させない。

## Merged implementation PRs
- #175 Color Match generated answer UI
- #176 三国ポチポチ generated visual kit
- #177 Potion Workshop female protagonist / workshop composition
- #178 Color Match mock-fidelity polish
- #179 三国ポチポチ campaign mock-fidelity
- #180 剣戟の森 combat hierarchy
- #181 覇拳伝 versus composition
- #182 Karma Quest choice / chronicle hierarchy

## Validation
- Browser E2E / WebKit / build / typecheck / test are defined in GitHub Actions.
- Latest-main workflow results are the source of truth for final validation.
- Screenshot artifacts produced by Browser E2E / WebKit are the comparison source for final visual QA.

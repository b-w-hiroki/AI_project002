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


## Final completion addendum — 2026-09-27

Additional merged work after the original audit:
- #184 Side final boss/slash + E2E visibility fix
- #185 game-feel pass
- #186 Potion onboarding
- #187–#188 visual completion rounds
- #189 Fist result stage + Karma E2E
- #190 Side character presence
- #191 Color result + WebKit
- #192 Side touch UI theme
- #193 Potion footer + Karma final
- #194 Karma retry-position compatibility
- #195 Karma route-fetch retry
- #196 Side mobile readability
- #197 Potion ambient-noise cleanup
- #198 Side mobile GRD
- #199 Karma final visual artifact
- #200 Potion mobile brew CTA
- #201–#202 Potion female-hero runtime alignment
- #203 test alignment/stability
- #204 final mobile spacing
- #205 Fist mobile result stage

Final gate: all five latest-main workflows passed on commit `4b351424515657ada138aa7f4304f37f17e62583`.
Current release status is documented in [final-release-gate-2026-09-27.md](final-release-gate-2026-09-27.md).

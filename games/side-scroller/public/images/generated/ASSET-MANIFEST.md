# 剣戟の森 generated battle assets — 2026-10-01

- `backgrounds/sf-approved-forest-battle-v2.jpg`
  - 1600×900, 568 KB.
  - Approved mock referenced ImageGen environment pass.
  - Environment only: no hero, enemy, boss, HUD, text, or slash baked in.
- `characters/sf-hero-approved-lunge-v2.png`
  - 640×320 transparent PNG, 230 KB.
  - Preserves the mock hero's brown hair, blue eyes, blue cape/scarf, silver-white armor, and blue sword.
  - New runtime pose: complete right-facing attack lunge because the mock does not expose an unobstructed reusable full-body sprite.
- `characters/sf-boss-approved-ogre-v2.png`
  - 576×384 transparent PNG, 410 KB.
  - Preserves the mock boss's green skin, horned dark armor, skull trophies, red cloth, and heavy cleaver.
  - New runtime pose: complete left-facing heavy-strike stance because the mock boss is partially obscured by UI, effects, and the hero.

Original generated sources are kept in `docs/design/generated-sources/`. Runtime derivatives are produced by `games/side-scroller/scripts/prepare-approved-battle-assets.ps1`.

Gameplay, hitboxes, movement, attack, guard, special, boss phases, and wave rules remain live and unchanged.

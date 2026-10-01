# Potion Workshop visual asset manifest — 2026-10-01

## Mock fidelity baseline

- The female alchemist is the official protagonist visual.
- The workshop management and brewing loop remain unchanged.
- Dense workshop props are decorative; economy logic stays code-driven.

## Runtime assets

- `pw-hero-alchemist.png` — official protagonist and single runtime hero texture.
- `mock-extracts/pw-approved-cat-visible.png` — source-pixel cutout of the visible approved-home cat; no hidden body generated.
- `pw-bg-workshop.png` — workshop background.
- `pw-cauldron-icon.png` — brewing prop.
- `pw-dragon-icon.png` — progression and rare prop.
- Existing Phaser UI/theme — request/reward, recipe, generator, and resource UI.

The invalid duplicate `generated/characters/pw-hero-alchemist-female.webp` was retired. It was not a decodable WebP and the runtime had always fallen back to the official PNG above.

## Remaining source-sheet roles

The recovered artboard is the reference for the black cat, town, furniture, ingredients, recipe cards, UI frames, FX, props, and branding. These are not duplicated until a runtime screen needs a separate texture.

## Rules

- No genre change.
- Keep the idle, brewing, and economy loop.
- Preserve readable resource hierarchy and large protagonist/cauldron focus.

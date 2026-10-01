# Potion Workshop visual asset manifest — 2026-10-01

## Mock fidelity baseline

- The female alchemist remains the official protagonist visual.
- The workshop management and brewing loop remain unchanged.
- Dense workshop props are decorative; economy logic stays code-driven.

## Runtime assets

- `pw-hero-alchemist.png` — official protagonist identity reference and landscape fallback.
- `generated/characters/pw-hero-stirring-v2.png` — transparent portrait-home pose derived from the official protagonist. ImageGen changed only the pose and added one wooden stirring rod. Face, silver curls, blue eyes, hat, white/navy/blue/gold costume, brooch, proportions, linework and palette were locked. The cauldron, cat, magic, UI and background remain separate live objects.
- `mock-extracts/pw-approved-cat-visible.png` — source-pixel cutout of the visible approved-home cat; no hidden body generated.
- `pw-bg-workshop.png` — workshop background.
- `pw-cauldron-icon.png` — brewing prop.
- `pw-dragon-icon.png` — progression and rare prop.
- Existing Phaser UI/theme — request/reward, recipe, generator and resource UI.

The accepted high-resolution generation source is retained at `docs/design/generated-sources/pw-hero-stirring-v2-source.png`. The runtime derivative is a 640×640 32-bit transparent PNG.

The invalid duplicate `generated/characters/pw-hero-alchemist-female.webp` was retired. It was not a decodable WebP and the runtime had always fallen back to the official PNG.

## Remaining source-sheet roles

The recovered artboard remains the reference for the black cat, town, furniture, ingredients, recipe cards, UI frames, FX, props and branding. These are not duplicated until a runtime screen needs a separate texture.

## Rules

- No genre change.
- Keep the idle, brewing and economy loop.
- Preserve readable resource hierarchy and large protagonist/cauldron focus.
- Do not bake the hero, cauldron, cat, blackboard or navigation into one screenshot.

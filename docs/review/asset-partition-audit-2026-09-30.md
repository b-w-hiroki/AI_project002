# Asset partition audit — 2026-09-30

Mock-fidelity rule: runtime-controllable visual roles must remain separate assets. Do not bake TAP/START/tutorial text into backgrounds.

| Game | Background | Hero/characters | Enemy/Boss | FX/props | UI parts | Status |
|---|---|---|---|---|---|---|
| Sangoku Tap | separate | separate generals + protagonist | separate bosses | city + impact separate | deploy decoration separate | OK |
| Potion Workshop | workshop separate | female alchemist separate | n/a | cauldron + dragon separate | ingredients/furniture remain code-native/reference until needed | OK for current runtime |
| Karma Quest | separate scene backgrounds | hero/NPC/dialogue portraits separate | n/a | faction icons + outcomes separate | request/choice UI code-native | OK; delivery duplicates should not be loaded twice |
| Sword Forest | forest separate | hero states separate | enemy types + boss separate | slash FX separate | controls code-native | OK |
| Fist Legend | arena separate | Ryuga/hero and each roster slot separate | enemy separate | impact code-native | controls code-native | NEEDS QUALITY UPGRADE: Renka/Gaku/Mei replacements generated as individual transparent character parts |
| Color Match | portrait/landscape backgrounds separate | mascot separate | n/a | turbo badge separate | six answers are individual code-native parts | FIXED: corrupted combined 2x3 answer sheet removed |

## Required naming for Fist Legend replacements

- `fl-fighter-renka.webp`
- `fl-fighter-gaku.webp`
- `fl-fighter-mei.webp`

Each replacement must be transparent, contain one full-body fighter only, contain no text/UI/background, and preserve the existing roster role/color identity.

## Rule going forward

If a visual element needs independent position, scale, visibility, tint, animation, lazy loading, or state replacement, it must be a separate runtime part rather than a baked composite.

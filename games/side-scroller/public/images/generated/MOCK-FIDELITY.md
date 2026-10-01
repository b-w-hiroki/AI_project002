# Blade Woods mock-fidelity pass — 2026-10-01

- The approved mock defines identity, palette, lighting, materials, and silhouette.
- The background was regenerated rather than cropped because every battle crop contains actors, HP bars, controls, and slash effects.
- Hero idle, run, and attack are separate transparent pose assets from one identity-preserving generation chain; they are not full-screen animation frames.
- The attack slash and two subtle afterimages remain live game objects. Reduced-motion mode disables the afterimages.
- A small code-native foreground foliage layer adds depth. Reduced-motion mode keeps the layer static.
- No actor, boss, HUD, or combat effect is baked into the background.
- Movement, collision, attack, guard, specials, boss tell/charge, damage, and enemy state continue to use the existing live rules.
- Existing code-native and legacy art assets remain fallbacks when the approved-fidelity assets fail to load.

# Karma duplicate PNG cleanup — 2026-09-27

Removed eight unreferenced PNG duplicates that have equivalent WebP runtime assets.

Removed:
- `kq-bg-village-reaction.png`
- `kq-bg-merchant-market-v1.png`
- `kq-npc-elder.png`
- `kq-bg-warrior-forge-v1.png`
- `kq-bg-capital-home-v3.png`
- `kq-bg-outlaw-courtyard-v1.png`
- `kq-bg-mage-study-v1.png`
- `kq-bg-kingdom-portrait-v2.png`

Rationale:
- code search found no references to these PNG filenames;
- equivalent WebP assets remain;
- this reduces Pages/release package weight without changing runtime behavior.

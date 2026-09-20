"""Lossless format conversion only. Requires Pillow; never alters source PNGs."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / "docs/art-sources/karma"
destination = root / "games/karma-quest/public/images"
files = sorted(source.glob("*.png"))
legacy_names = [
    "kq-hero-warrior", "kq-faction-icon-warrior", "kq-faction-icon-merchant",
    "kq-faction-icon-outlaw", "kq-faction-icon-mage", "kq-bg-kingdom-portrait-v2",
    "kq-bg-capital-home-v3", "kq-hero-warrior-back", "kq-npc-elder",
    "kq-bg-village-reaction", "kq-bg-merchant-market-v1",
    "kq-bg-outlaw-courtyard-v1", "kq-bg-mage-study-v1",
]
files += [destination / (name + ".png") for name in legacy_names]
for path in files:
    output = destination / (path.stem + ".webp")
    with Image.open(path) as original:
        original.save(output, format="WEBP", lossless=True, method=6, exact=True)
        with Image.open(output) as encoded:
            assert original.convert("RGBA").tobytes() == encoded.convert("RGBA").tobytes(), path
print(f"Verified {len(files)} images: dimensions and RGBA pixels preserved")

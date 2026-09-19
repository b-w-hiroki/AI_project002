# 会話背景の統一 — 2026-09-19

内蔵 image_gen で王都ホームを参照し、白石・青旗・暖かな昼光を引き継ぐ回廊を制作。縦横の会話で同じ素材を同率拡縮し、人物下端は既存の濃紺フェードで操作面へ接続。結果場面の固有の明暗は、承諾・見送りの意味として維持。

- 原PNG: `docs/art-sources/karma/kq-bg-dialogue-arcade-v1.png`（1024×1536）
- 配信: `games/karma-quest/public/images/kq-bg-dialogue-arcade-v1.webp`
- 可逆形式変換のみ。復号後RGBA画素の完全一致を検証。

## 最終プロンプト

```text
Create a portrait 1024x1536 fantasy RPG dialogue BACKGROUND with no foreground characters and no UI or lettering. The reference is the same royal capital: preserve its white limestone, cobalt-blue banners with gold embroidery, distant blue-roofed spires, warm daylight from upper left, refined painterly Japanese fantasy illustration. Change camera to a sheltered street-level palace arcade suitable for close chest-up dialogue, not the sweeping skyline view. Left edge carved stone arch and a hanging blue banner; middle height behind where faces will appear (35-65 percent down) broad softly shaded warm limestone, subdued climbing green leaves, uncluttered and low contrast. Upper quarter shows an elegant arch framing a small distant castle and blue sky. Lower quarter softly shadowed stone paving. Strong hand-painted fantasy illustration, warm bounced light and cool navy shadows, avoid photographic rendering, avoid busy tiny figures or street clutter. No people, no text, no frames, no interface. This must feel like a nearby location in the reference city.
```

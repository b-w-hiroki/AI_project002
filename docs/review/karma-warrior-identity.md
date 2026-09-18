# 戦士と主人公の識別設計（2026-09-18）

戦士の茶髪・緑のマントが主人公と重なっていたため、戦士を年長の隊長として再設計した。ホームの依頼者、縦横の会話、鉄と訓練の承諾・見送り4場面、年代記の挿絵へ同じ外見を接続。

| 要素 | 主人公 | 戦士の依頼者 |
| --- | --- | --- |
| 年齢・輪郭 | 若い、細めの顔 | 年長、角張った顎と太い眉 |
| 髪・髭 | 茶髪、髭なし | 短い銀髪、銀の髭 |
| 衣装 | 緑のマント、金の鎧 | 深紅のマント、黒鉄と銅金の鎧 |
| 役割の見せ方 | 左下のバストアップ | 右の年長者、結果では隊長として登場 |

色だけに頼らず髪型・年齢・顔立ち・体格も変える。承諾と見送りで顔や衣装を変えず、表情・行動・背景で結果を伝える。

## 保存先

- 立ち絵: `docs/art-sources/karma/kq-dialogue-warrior-v3.png`。RGBA、実アルファあり。
- 鉄の承諾・見送り: `docs/art-sources/karma/kq-outcome-warrior_iron-{accept,decline}-v2.png`。
- 訓練の承諾・見送り: `docs/art-sources/karma/kq-outcome-warrior_train-{accept,decline}-v2.png`。
- 配信用: `games/karma-quest/public/images/` の同名 `.webp`。可逆変換、原PNGと復号後RGBA画素が完全一致。
- 不採用の市松模様入り出力: `docs/art-sources/karma/drafts/kq-dialogue-warrior-v2.png`。素材履歴としてのみ保存し、配信・読み込み対象から除外。

## 実画面

立ち絵は1254×1254、結果4枚は各1024×1536。追加5枚はPNG 12,786,638 bytes、可逆WebP 8,808,274 bytes（約31%削減）。`prepare-karma-assets.py` で既存分を含む22枚の寸法と復号後RGBA画素一致を検証。

- [スマホ会話](karma-compact-dialogue-warrior.png) / [横会話](karma-compact-dialogue-warrior-landscape.png)
- [鉄を届けた](karma-compact-warrior_iron-accept.png) / [鉄を見送った](karma-compact-warrior_iron-decline.png)
- [訓練を認めた](karma-compact-warrior_train-accept.png) / [訓練を見送った](karma-compact-warrior_train-decline.png)

## 検証結果

- TypeScript型チェック、ESLint、ビルド成功。単体テスト39件成功。
- Playwright E2E 21件成功（約2分12秒）。全依頼の人物対応、縦横回転、全16結果、通常12年間のタップ進行を含む。
- ホームの戦士肖像を含む画像基準を更新し、通常の画像比較テストでも成功。
- 320×568の会話と4結果、800×360の会話を目視。顔・本文・ボタンの重なりなし。拡縮は縦横同率。
- 実機のノッチ・音・長時間動作は今回も未検証。

## プロンプト

内蔵 image_gen による編集。既存の各結果絵を編集対象、新しい立ち絵を同一人物の参照に指定。絵の縦横比を保ち、背景・構図・他の登場人物を維持する指示で作成。

### Portrait initial draft

```text
Use case: identity-preserve redesign. Edit target: provided Karma Quest warrior envoy bust. Preserve refined painterly Japanese fantasy rendering, chest-up composition with shoulders and hands, left-facing three-quarter conversational pose, armor detail and genuine transparent background. REDESIGN THIS NPC to be unmistakably distinct from young brown-haired green-cloaked protagonist: 58 year old broad stocky veteran captain, close-cropped SILVER GREY hair with receding temples, heavy silver eyebrows, broad square weathered jaw, short squared grey beard, one small old eyebrow scar, dark brown eyes. Replace green cape with muted OXBLOOD RED shoulder mantle with copper clasp. Heavy dark gunmetal plate armor with restrained copper edging, no green fabric, no brown tousled hair, no youthful delicate face. Calm stern reliable expression. Preserve full head and hands with margins. No text or frame.
```

### Portrait transparent final

```text
Use case: background-extraction. Edit this exact veteran captain portrait. Keep EVERY character pixel and identity, pose, silver hair, grey beard, red cloak, dark armor unchanged. Remove the entire grey-white checkerboard background. Output a PNG with a REAL alpha transparency channel, alpha=0 outside the silhouette. The checkerboard is unwanted painted content, NOT transparency. Do not draw any checkerboard, solid background, shadow behind silhouette, or scenery. Preserve all hair and cloak edges. This must be an isolated transparent game sprite.
```

### Forge accepted

```text
Edit image 1, the forge scene. Image 2 is the exact identity reference. Replace the foreground female green-cloaked soldier with the mature male captain from image 2: short swept-back silver hair, broad square jaw, silver beard, heavy eyebrows, oxblood red mantle, dark steel armour with copper-gold lion ornaments. He inspects the supplied sword with quiet satisfaction. Preserve the forge, blacksmith tools, sunny castle courtyard, vertical composition and painterly fantasy-game illustration quality. No young brown-haired green-cloaked hero. Keep the captain's entire head inside the upper half with clear breathing space above. No text, no UI. One finished full scene.
```

### Forge declined

```text
Edit image 1 only, preserving the forge composition, blacksmith on the right, empty anvil, sparse weapon rack, subdued daylight and disappointed mood. Image 2 is the exact identity reference for the LEFT warrior. Replace that left brown-haired green-cloaked man with the mature silver-haired captain from image 2: short swept-back silver hair, square face, silver beard, heavy eyebrows, oxblood red shoulder mantle, dark steel armor with copper-gold lion ornament. Keep his thoughtful disappointed hand-to-chin pose. Same premium illustrated fantasy game style, no UI, no text. Keep entire head visible and scene geometry intact.
```

### Training accepted

```text
Edit image 1 training courtyard. Image 2 is identity reference only. Replace ONLY the central supervising instructor in green cloak with the same mature male captain from image 2: short swept-back silver hair, strong square jaw, silver beard, heavy brows, dark steel armor copper-gold lion decoration and deep oxblood RED mantle. Keep both foreground young trainees unchanged, their wooden practice swords, crossed-sword action, sunlit castle training courtyard, flags, perspective and framing. Captain watches with satisfied restrained smile, arms folded. Premium painterly fantasy-game illustration. No text or UI.
```

### Training declined

```text
Edit image 1, the declined training scene. Image 2 is the exact captain identity reference. Replace ONLY the central adult green-cloaked brown-haired man walking away with the mature captain: short swept-back SILVER hair, silver beard visible in slight side profile, broad shoulders, dark steel armour with copper-gold lion ornament, deep oxblood RED mantle. Preserve the two younger blue/white trainees, all courtyard architecture, closed gate, unused weapon racks, quiet disappointed walking-away action, perspective and tall framing. Premium painterly fantasy game illustration, no text no UI. He must clearly be the same older red-mantled captain from image 2.
```

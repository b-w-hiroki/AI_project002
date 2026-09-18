# 魔術師の研究室

- 生成: built-in image_gen、2026-09-18。CLI/APIは使用していない。
- 保存先: `games/karma-quest/public/images/kq-bg-mage-study-v1.png`（1024×1536）。
- 用途: 魔術師の魔石・禁書依頼の結果画面と縦画面年代記の最新イベント画像。承諾・拒否共通の中立的な研究場面。
- 配置: 元画像の縦横比を保持し、縦位置25%を基準にトリミング。横長領域でも顔が欠けないことを実画面で確認。
- その他の派閥は王都背景へフォールバック。食料配布は `village_food` を承諾した場合に限定する。派閥別専用絵と選択画面の依頼者素材は引き続き必要。

## 使用プロンプト

Use case: stylized-concept. Asset type: Karma Quest fantasy RPG outcome illustration, portrait 1024x1536. Create a beautifully polished anime painterly medieval fantasy mage study, warm sunlight through arched windows showing a white castle and blue mountain valley. A thoughtful adult scholar in deep blue robes studies at a wooden desk with closed leather books, a small inert blue crystal in a brass holder, parchment without readable text, brass astrolabe. Rich material detail, welcoming lush fantasy mobile game key art, blue green gold palette. Calm neutral moment, no celebration, no sadness, no handing over objects: usable after either granting or declining a request. Composition: scholar head and hands, books and crystal clustered in the CENTRAL horizontal band from 30% to 65% image height, with the main face near center; important objects safely inside central 70% image width. Top is architecture and window, bottom desk and atmospheric room details. Must crop well to a wide center strip and a tall portrait. No UI, labels, lettering, symbols resembling text, borders, logos, watermarks, no food, no food distribution.

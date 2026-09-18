# 派閥別の場面パターン

内蔵 image_gen で生成（2026-09-18）。全素材1024×1536、縦横比を維持して表示。承諾・拒否共通の中立的な場面。結果画面の縦横と年代記のイベント画像に連動する。

- 戦士: `games/karma-quest/public/images/kq-bg-warrior-forge-v1.png` — 鍛冶場と訓練場
- 商人: `games/karma-quest/public/images/kq-bg-merchant-market-v1.png` — 王都の市場と商隊
- 荒くれ者: `games/karma-quest/public/images/kq-bg-outlaw-courtyard-v1.png` — 酒場の中庭
- 魔術師: 既存の `kq-bg-mage-study-v1.png` — 研究室

4派閥・全8依頼に対応。出来事そのものの成功演出ではなく、派閥の活動場所を表す。依頼ごとの固有演出と選択画面の依頼者立ち絵は今後の対象。

生成プロンプト:

## warrior

Use case: stylized-concept. Asset for Karma Quest fantasy mobile RPG, portrait 1024x1536. Polished anime painterly illustration, detailed fabrics and architecture, warm sunlight, blue green gold palette, white medieval castle kingdom. Neutral moment usable after either granting or declining a request, no celebration, no exchange of goods, no explicit success/failure. Main adult character head and hands and relevant objects all in the middle 25%-65% height, inside central 70% width, must crop to wide center band without cutting face. Upper architecture, lower environmental detail. No text, UI, border, logo or watermark. Scene: a disciplined adult female knight with auburn braided hair in practical steel armor and a dark green cape, thoughtfully examining an unsharpened training sword beside a forge courtyard. Iron ingots and a weapons rack nearby, sunlit castle training grounds beyond. Composed thoughtful expression, dignified strong silhouette, waist-up main subject.

## merchant

Use case: stylized-concept. Asset for Karma Quest fantasy mobile RPG, portrait 1024x1536. Polished anime painterly illustration, detailed fabrics and architecture, warm sunlight, blue green gold palette, white medieval castle kingdom. Neutral moment usable after either granting or declining a request, no celebration, no exchange of goods, no explicit success/failure. Main adult character head and hands and relevant objects all in the middle 25%-65% height, inside central 70% width, must crop to wide center band without cutting face. Upper architecture, lower environmental detail. No text, UI, border, logo or watermark. Scene: an adult woman merchant with dark hair in a tidy bun, teal and ivory travel clothes and a burgundy shawl, thoughtfully checking a closed ledger and brass balance scales at a covered market stall. Packed crates and a stationary caravan wagon nearby; a bright white castle gate and cobbled road in the background. No customers buying, no money changing hands. Waist-up central composition, inviting colorful textiles and trade goods, calm capable expression.

## outlaw

Use case: stylized-concept. Asset for Karma Quest fantasy mobile RPG, portrait 1024x1536. Polished anime painterly illustration, detailed fabrics and architecture, warm sunlight, blue green gold palette, white medieval castle kingdom. Neutral moment usable after either granting or declining a request, no celebration, no exchange of goods, no explicit success/failure. Main adult character head and hands and relevant objects all in the middle 25%-65% height, inside central 70% width, must crop to wide center band without cutting face. Upper architecture, lower environmental detail. No text, UI, border, logo or watermark. Scene: a rugged adult male adventurer with short tousled dark hair, a small healed eyebrow scar, weathered leather armor and a rust-red scarf, resting at a wooden tavern courtyard table. One closed coin pouch and a plain pewter mug on the table, practice rings and a notice board with no writing in the background, late-afternoon sunlight and castle rooftops beyond. Confident but thoughtful expression, no fighting, no drinking in action, no payment or toast. Hands visible resting naturally. Waist-up central figure, attractive illustrated fantasy RPG art, no skull gore.


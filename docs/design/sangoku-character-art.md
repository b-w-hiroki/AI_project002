# ボスを主役にするキャラクター演出

2026-09-06。ユーザーの「ボスは大きく、ザコはシンプル、テイストを合わせる」を反映。

## 実装

- 関門直前（9/10）で260px高の大型守将を表示。通常兵は84px、味方小兵・足軽は102pxを基本とし、大きさで役割を区別する。
- 通常区間は赤みを付けた小さな敵兵2体を奥に配置。味方は原色で左手前に配置し、敵味方の位置と色を区別。
- 蒼刃を参考に、輪郭と陰影のあるイラスト調へ統一。低レア兵には簡潔な鎧・武器を与え、ボスには重い鎧と大型武器を与える。
- 小兵と足軽は地図・編成・遠征・帰還・武将一覧・募集表示へ同じ素材を使用。
- 関門戦の勝敗計算は従来通り。見かけだけの敵HPバーは追加しない。今回のボス素材は1体を3地域で共有。
- PNGは生成時のRGBAをそのまま保存。表示時にPhaserで縮小。各画像がない場合はGraphicsにフォールバック。

## 制作方法と採用プロンプト

内蔵imagegen使用。生成原本をプロジェクトへコピー。透過に失敗した案は採用せず、下記3点が最終素材。

### st-boss-gatekeeper.png

参照：既存 `st-general-soujin.png`（画風のみ）。

> Use case: stylized-concept. Create ONE new game sprite asset: a formidable Chinese fantasy gatekeeper boss, full body, isolated on a genuinely transparent alpha background. Reference image is STYLE REFERENCE ONLY, do not copy this blue swordsman's identity. Match the polished Chinese mobile RPG anime illustration, confident dark outlines, dimensional cel shading and metallic highlights. Boss has broad powerful silhouette, dark charcoal and burgundy armor, restrained gold trim, closed imposing helmet with red plume, heavy single poleaxe held close to his body, long crimson waist cloth. Face shaded, no gore. Approximately 4.5 heads tall, imposing rather than cute. Three-quarter view facing slightly left toward the player, steady braced stance, both boots fully visible. Compact vertical silhouette, entire weapon contained, no effects beyond body, no floor or scenery, no text, no frame, no shadow rectangle. Transparent PNG. This will be displayed 250px tall in a portrait game, so prioritize strong readable shapes over tiny ornament. Output one boss illustration.

### st-general-kohei.png

参照：採用ボス画像（画風と透過形式）。

> Create a new isolated PNG sprite with TRANSPARENT BACKGROUND, same image format and background treatment as the reference boss. A simple low rank Chinese foot soldier, no boss ornaments. Ochre tunic, simple dark lamellar vest, plain rounded steel cap, friendly young adult male face, short spear upright and small supply pouch. Full body, 4.5 heads tall, facing slightly right. Polished anime mobile RPG illustration with dark contours, shaded materials, readable broad shapes. Simplify the costume substantially compared with reference boss. All feet and spear inside canvas. One soldier. Transparent background.

### st-general-ashigaru.png

参照：採用小兵画像（画風・体型・透過形式）。

> Create one companion soldier game sprite in exactly this illustration style and proportions. Transparent background, same PNG cutout treatment as reference. A simple Chinese shield infantryman in a muted TEAL tunic and plain dark lamellar armor, plain rounded steel helmet with no plume, sturdy friendly adult male face different from reference. Small rectangular teal-and-steel shield on left arm, short sword pointed down on right, no spear or pouch. Full body, feet fully inside frame, facing slightly right. Polished anime mobile RPG shading, dark contours, simple broad readable shapes, no gold ornament or effects. Low rank unit, not a boss. One isolated character with transparent background.

## 検証範囲

本作49テスト・型検査・lint・buildを確認。ブラウザでは一般敵兵2体と関門ボスのサイズ、三地域の操作フロー、編成・帰還・武将一覧・募集表示を確認。画像欠損時も代替表示と進行を確認する。実機性能と専用攻撃アニメーションは未対応。

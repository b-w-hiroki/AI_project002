# アート素材リクエスト仕様書

このリポジトリのゲームはこれまで「画像アセット0円・Phaser Graphicsでその場描画」方針で作ってきたが、
ChatGPT等の画像生成でイラスト素材を用意し、ゲームらしい見た目に強化していく。
このファイルは **ChatGPT側からでも今の依頼状況を追跡できるようにする台帳** を兼ねる。

## 運用フロー

1. 下表から「未依頼」の行を選び、`プロンプト（日本語）` または `Prompt (English)` をそのままChatGPT等の画像生成に貼り付ける
2. 生成された画像ファイルを `games/<game>/public/images/<ファイル名>` に保存する（`public/images/` が無ければ作成）
3. このファイルの該当行の `ステータス` を `依頼中` → `受領` に更新し、`受領日` と実際に保存したファイル名を記入する
4. Claude（Claude Code）に「〇〇の画像を受け取ったのでゲームに組み込んで」と伝える。組み込み完了後、Claudeが`ステータス`を `組み込み済み` に更新する
5. 生成し直したい場合は`ステータス`を`再依頼`に戻し、備考に理由を書く

## 命名・保存規則

- 保存先: `games/<game>/public/images/<asset-id>.png`（Viteの`public/`はビルド時にそのままdistにコピーされるため、コード側は`/images/<asset-id>.png`で参照する）
- ファイル名は下表の`asset-id`列と一致させる（拡張子は生成結果に合わせてpng/webp可、コード側の参照も合わせて変更すること）
- 透過が必要な素材（キャラ・アイコン等）は背景透過（PNG）を明示的にプロンプトへ含める

## 共通スタイルガイド（全ゲーム）

- 全体のトーン: 明るく親しみやすいソシャゲ/カジュアルゲーム調。過度にリアル/グロテスクにしない
- 線: くっきりした輪郭線があるイラスト調（ベタ塗り、厚塗り両方可、ゲームごとに統一があればなお良い）
- 背景: キャラ/アイコン単体素材は必ず背景透過。背景イラストのみ不透過で作成
- テキスト・文字を画像内に含めない（UI側でテキストは別途描画するため）
- 版権キャラクター・実在の人物・商標ロゴに似せない（オリジナルデザインで）

---

## 1. ポーション工房 / Potion Workshop

パレット: 淡い青空・ファンタジー系（水色〜白グラデーション、`panelFill:#f3f9ff` 系統）

| asset-id | 用途 | サイズ目安 | ステータス | 受領日 | 備考 |
|---|---|---|---|---|---|
| pw-hero-alchemist | おかえりモーダルの錬金術師キャラ | 512×512、背景透過 | 組み込み済み | 2026-09-01 | おかえり（オフライン進行）モーダルに表示 |
| pw-cauldron-icon | 大釜アイコン（設備リスト用） | 256×256、背景透過 | 組み込み済み | 2026-09-01 | 設備リストの「自動大釜」行のアイコンに使用 |
| pw-dragon-icon | 竜アイコン（設備リスト用） | 256×256、背景透過 | 組み込み済み | 2026-09-01 | 設備リストの「契約の竜」行のアイコンに使用 |
| pw-bg-workshop | 工房内観の背景イラスト | 1600×900、不透過 | 組み込み済み | 2026-09-01 | 画面全体の背景として使用（淡い青グラデーションを薄く重ねて既存UIとの馴染みを調整） |

### プロンプト（日本語）— pw-hero-alchemist
> 淡い水色〜白のパステル背景の錬金術師の女の子キャラクター、丸みのあるカジュアルなソシャゲ風デフォルメイラスト、片手に光る緑のポーションが入ったフラスコを掲げている、もう片方の手はおまじないのポーズ、三角帽子とローブ、くっきりした輪郭線、明るく親しみやすい雰囲気、背景は透過、正面立ち絵、512x512px

### Prompt (English) — pw-hero-alchemist
> A cute chibi-style alchemist girl character in a casual mobile-game art style, pastel light-blue and white palette, holding up a flask with a glowing green potion in one hand, other hand posed as if casting a spell, wearing a witch hat and robe, clean bold outlines, friendly and bright mood, transparent background, front-facing full body, 512x512px

### プロンプト（日本語）— pw-cauldron-icon
> ファンタジー世界の自動でポーションを煮出す大釜のアイコン、黒い鋳鉄の大釜から淡い緑の魔法の煙がふわりと立ち上っている、丸みのあるカジュアルなソシャゲ風デフォルメイラスト、水色を差し色に使った配色、くっきりした輪郭線、背景透過、ゲームの設備リスト用アイコン、256x256px

### Prompt (English) — pw-cauldron-icon
> A fantasy game icon of an automated potion-brewing cauldron, black cast-iron cauldron with soft pale-green magical smoke wafting up, casual mobile-game chibi art style, light-blue accent color, clean bold outlines, transparent background, game facility-list icon, 256x256px

### プロンプト（日本語）— pw-dragon-icon
> ファンタジー世界の契約の竜のアイコン、小さくて丸っこいデフォルメされたかわいい竜、淡い水色〜白の鱗、ポーションの原料を運んでくれる相棒のようなイメージ、カジュアルなソシャゲ風イラスト、くっきりした輪郭線、背景透過、ゲームの設備リスト用アイコン、256x256px

### Prompt (English) — pw-dragon-icon
> A fantasy game icon of a "contracted dragon", small round chibi-style cute dragon, pale light-blue to white scales, portrayed as a friendly companion that gathers potion ingredients, casual mobile-game art style, clean bold outlines, transparent background, game facility-list icon, 256x256px

### プロンプト（日本語）— pw-bg-workshop
> ファンタジー世界の錬金術工房の内観背景イラスト、木製の作業台に並ぶ色とりどりのポーション瓶、壁一面の本棚、天井から吊るされたドライハーブ、大きな窓から差し込む柔らかい光、淡い水色〜白を基調にした明るく親しみやすい配色、カジュアルなソシャゲ風背景イラスト、くっきりした輪郭線、中央付近は要素を少なめにしてUIを重ねられるようにする、不透過、1600x900px

### Prompt (English) — pw-bg-workshop
> A fantasy alchemist workshop interior background illustration, wooden workbench lined with colorful potion bottles, a wall of bookshelves, dried herbs hanging from the ceiling, soft light streaming through a large window, bright and friendly palette based on pale light-blue and white, casual mobile-game background art, clean bold outlines, keep the center area relatively empty so UI can be overlaid, opaque, 1600x900px

---

## 2. 剣戟の森 / Blade Woods（side-scroller）

パレット: 淡い青空ファンタジー、地上は茶色い土＋緑の芝、浮遊床は白い雲

| asset-id | 用途 | サイズ目安 | ステータス | 受領日 | 備考 |
|---|---|---|---|---|---|
| sf-hero-swordsman | 主人公キャラ（横向き、剣を構えるポーズ） | 256×384、背景透過 | 未依頼 | | |
| sf-enemy-normal | 通常敵キャラ | 256×256、背景透過 | 未依頼 | | |
| sf-bg-forest | 背景の森ステージイラスト | 1920×600、不透過（横スクロール想定） | 未依頼 | | |

### プロンプト（日本語）— sf-hero-swordsman
> 真横向きで片手剣を構える若い剣士のキャラクター、軽装の革鎧、明るいファンタジー世界観のカジュアルゲームアート、くっきりした輪郭線、青空ファンタジー系の配色（水色・白・緑を差し色に）、背景透過、横スクロールアクションゲームのプレイヤーキャラクター立ち絵、真横向きのゲームスプライト構図、256x384px

### Prompt (English) — sf-hero-swordsman
> A young swordsman character in a pure side-profile battle stance holding a one-handed sword, light leather armor, bright fantasy casual-game art style, clean bold outlines, sky-blue fantasy palette with light-blue/white/green accents, transparent background, side-scroller action game player sprite, strict side-view game-sprite composition, 256x384px

### プロンプト（日本語）— sf-enemy-normal
> 真横向きの徘徊する森の敵モンスター、ゴブリンやスライムのような親しみやすいデフォルメされた敵キャラクター、明るいファンタジー世界観のカジュアルゲームアート、くっきりした輪郭線、緑〜茶色を基調にした配色、背景透過、横スクロールアクションゲームの敵キャラクタースプライト、真横向きのゲームスプライト構図、256x256px

### Prompt (English) — sf-enemy-normal
> A side-profile wandering forest enemy monster, a friendly chibi-deformed goblin- or slime-like creature, bright fantasy casual-game art style, clean bold outlines, green-to-brown color palette, transparent background, side-scroller action game enemy sprite, strict side-view game-sprite composition, 256x256px

### プロンプト（日本語）— sf-bg-forest
> 横スクロールアクションゲームの森ステージ背景イラスト、淡い青空、遠景の緑の丘、手前は茶色い土と緑の芝の地面、白い雲のような浮遊する足場、明るく親しみやすいファンタジー世界観、カジュアルなソシャゲ風背景イラスト、くっきりした輪郭線、横に長いパララックス背景を想定した横長構図、不透過、1920x600px

### Prompt (English) — sf-bg-forest
> A side-scrolling action game forest stage background illustration, pale blue sky, distant green hills, brown dirt and green grass ground in the foreground, cloud-like floating platforms, bright and friendly fantasy setting, casual mobile-game background art, clean bold outlines, wide horizontal composition intended for a parallax background, opaque, 1920x600px

---

## 3. カラーマッチ / Color Match

パレット: 明るいクリーム色ベース（`#fdf6e3`）

| asset-id | 用途 | サイズ目安 | ステータス | 受領日 | 備考 |
|---|---|---|---|---|---|
| cm-mascot | タイトル画面のマスコットキャラ | 512×512、背景透過 | 未依頼 | | |
| cm-turbo-badge | ターボモード突入時に表示するバッジ/エフェクト素材 | 256×256、背景透過 | 未依頼 | | |

### プロンプト（日本語）— cm-mascot
> カードや色をテーマにした可愛いマスコットキャラクター、頭の上に虹色のトランプカードを乗せている、驚いたような楽しそうな表情、クリーム色の明るい背景に映える配色（赤・青・緑・黄を差し色に）、丸みのあるカジュアルなソシャゲ風デフォルメイラスト、くっきりした輪郭線、背景透過、タイトル画面用の正面立ち絵、512x512px

### Prompt (English) — cm-mascot
> A cute mascot character themed around playing cards and colors, balancing a rainbow-colored playing card on its head, surprised and cheerful expression, casual mobile-game chibi art style, bright colors (red/blue/green/yellow accents) that pop against a cream background, clean bold outlines, transparent background, front-facing title-screen pose, 512x512px

### プロンプト（日本語）— cm-turbo-badge
> 「ターボモード」を表す炎とスピード感のあるバッジアイコン、燃える炎とモーションラインを組み合わせたエフェクト風デザイン、赤〜オレンジのグラデーション、丸みのあるカジュアルなソシャゲ風イラスト、くっきりした輪郭線、背景透過、ゲーム内のステータス表示用アイコン、256x256px

### Prompt (English) — cm-turbo-badge
> A badge icon representing "Turbo Mode", combining fire flames and speed motion-lines into an effect-style design, red-to-orange gradient, casual mobile-game art style, clean bold outlines, transparent background, in-game status display icon, 256x256px

---

## 4. 覇拳伝 / Fist Legend

パレット: 濃い赤茶〜金、重厚な格闘ゲーム調（`panelFill:#2a2018`, `accent:#d94a3d`）

| asset-id | 用途 | サイズ目安 | ステータス | 受領日 | 備考 |
|---|---|---|---|---|---|
| fl-hero-fighter | 主人公キャラ（構えポーズ） | 384×512、背景透過 | 未依頼 | | |
| fl-enemy-fighter | 対戦相手キャラ | 384×512、背景透過 | 未依頼 | | |
| fl-gacha-char-ryuga | ガチャキャラ「竜牙」の立ち絵 | 384×512、背景透過 | 未依頼 | 版権IPを避けたオリジナルデザイン |
| fl-bg-arena | バトル背景（闘技場） | 1600×900、不透過 | 未依頼 | | |

### プロンプト（日本語）— fl-hero-fighter
> 竜をモチーフにした若い格闘家の男性キャラクター「竜牙」、正面をやや斜めに向いて両拳を構えたバトルポーズ、道着風の胴着に赤いサッシュ、力強く男らしい濃い赤と金を基調にした配色、劇画寄りのカジュアルゲームアート、くっきりした輪郭線、背景透過、格闘ゲームのプレイヤーキャラクター立ち絵、384x512px

### Prompt (English) — fl-hero-fighter
> A young male fighter character named "Ryuga" with a dragon motif, fists raised in a battle stance facing slightly to the side, wearing a martial-arts gi with a red sash, bold dark-red and gold color scheme, semi-realistic casual fighting-game art style, clean bold outlines, transparent background, fighting game player character full body, 384x512px

### プロンプト（日本語）— fl-enemy-fighter
> 対戦相手となる屈強な格闘家の男性キャラクター、竜牙とは対照的な冷たい印象、正面をやや斜めに向いて構えたバトルポーズ、青〜銀を基調にした配色で竜牙の赤と対比させる、劇画寄りのカジュアルゲームアート、くっきりした輪郭線、背景透過、格闘ゲームの対戦相手キャラクター立ち絵、384x512px

### Prompt (English) — fl-enemy-fighter
> A tough rival fighter character serving as the opponent, cold and stoic impression contrasting with the protagonist Ryuga, battle stance facing slightly to the side, blue-to-silver color scheme contrasting with Ryuga's red, semi-realistic casual fighting-game art style, clean bold outlines, transparent background, fighting game opponent character full body, 384x512px

### プロンプト（日本語）— fl-gacha-char-ryuga
> ガチャ演出用の「竜牙」の全身立ち絵、fl-hero-fighterと同一キャラクター・同じデザインで、勝利ポーズや決めポーズなどより華やかな構図、背景に淡い光のエフェクトを加えても良い、濃い赤と金を基調にした配色、劇画寄りのカジュアルゲームアート、くっきりした輪郭線、背景透過、ガチャ排出演出用の高解像度立ち絵、384x512px

### Prompt (English) — fl-gacha-char-ryuga
> A full-body illustration of "Ryuga" for gacha pull presentation, same character and design as fl-hero-fighter but in a more flashy victory or finishing pose, optional soft light-effect glow in the background, bold dark-red and gold color scheme, semi-realistic casual fighting-game art style, clean bold outlines, transparent background, high-resolution art for gacha reveal presentation, 384x512px

### プロンプト（日本語）— fl-bg-arena
> 格闘ゲームのバトル背景イラスト、石造りの闘技場、夕暮れ〜夜の照明で照らされた円形のステージ、観客席のシルエット、濃い赤と金を基調にした重厚な配色、劇画寄りのカジュアルゲームアート、くっきりした輪郭線、中央付近は要素を少なめにしてキャラクターとUIを重ねられるようにする、不透過、1600x900px

### Prompt (English) — fl-bg-arena
> A fighting game battle background illustration, a stone-built arena, a circular stage lit by dusk-to-night lighting, silhouettes of spectator stands, bold dark-red and gold heavy color scheme, semi-realistic casual fighting-game art style, clean bold outlines, keep the center area relatively empty so characters and UI can be overlaid, opaque, 1600x900px

---

## 5. カルマクエスト / Karma Quest

パレット: 深緑×金（`panelFill:#1f3a30`, `accent:#d9b45a`）

| asset-id | 用途 | サイズ目安 | ステータス | 受領日 | 備考 |
|---|---|---|---|---|---|
| kq-hero-warrior | 勇者キャラ（デフォルト外見） | 384×512、背景透過 | 未依頼 | | |
| kq-faction-icon-warrior | 戦士の派閥アイコン | 128×128、背景透過 | 未依頼 | | |
| kq-faction-icon-merchant | 商人の派閥アイコン | 128×128、背景透過 | 未依頼 | | |
| kq-faction-icon-outlaw | 荒くれ者の派閥アイコン | 128×128、背景透過 | 未依頼 | | |
| kq-faction-icon-mage | 魔術師の派閥アイコン | 128×128、背景透過 | 未依頼 | | |

### プロンプト（日本語）— kq-hero-warrior
> ファンタジーRPGの勇者キャラクター、腰に剣を携えた凛々しい正面立ち姿、まだ駆け出しを感じさせるシンプルな軽装、深緑と金を基調にした落ち着いた配色、カジュアルなソシャゲ風イラスト、くっきりした輪郭線、背景透過、育成RPGのメインキャラクター立ち絵（育成前のベース外見）、384x512px

### Prompt (English) — kq-hero-warrior
> A fantasy RPG hero character with a sword at their hip, dignified front-facing standing pose, simple light gear suggesting an early-career adventurer, calm dark-green and gold color palette, casual mobile-RPG art style, clean bold outlines, transparent background, main character full body for a hero-raising RPG (base appearance before growth), 384x512px

### プロンプト（日本語）— kq-faction-icon-warrior
> 「戦士の派閥」を表すエンブレム風アイコン、交差した剣と盾のモチーフ、力強い印象、深緑と金を基調にした配色、丸いバッジ型のフレーム、カジュアルなソシャゲ風イラスト、くっきりした輪郭線、背景透過、派閥選択UI用アイコン、128x128px

### Prompt (English) — kq-faction-icon-warrior
> An emblem-style icon representing the "Warrior Faction", crossed sword and shield motif, powerful impression, dark-green and gold color palette, circular badge-shaped frame, casual mobile-game art style, clean bold outlines, transparent background, faction-selection UI icon, 128x128px

### プロンプト（日本語）— kq-faction-icon-merchant
> 「商人の派閥」を表すエンブレム風アイコン、天秤とコイン袋のモチーフ、堅実で豊かな印象、深緑と金を基調にした配色、丸いバッジ型のフレーム、カジュアルなソシャゲ風イラスト、くっきりした輪郭線、背景透過、派閥選択UI用アイコン、128x128px

### Prompt (English) — kq-faction-icon-merchant
> An emblem-style icon representing the "Merchant Faction", a balance scale and coin pouch motif, a prosperous and reliable impression, dark-green and gold color palette, circular badge-shaped frame, casual mobile-game art style, clean bold outlines, transparent background, faction-selection UI icon, 128x128px

### プロンプト（日本語）— kq-faction-icon-outlaw
> 「荒くれ者の派閥」を表すエンブレム風アイコン、ナイフと骸骨、または野性的な牙のモチーフ、無骨で荒々しい印象、深緑と金を基調にしつつ差し色に赤を少し入れる、丸いバッジ型のフレーム、カジュアルなソシャゲ風イラスト、くっきりした輪郭線、背景透過、派閥選択UI用アイコン、128x128px

### Prompt (English) — kq-faction-icon-outlaw
> An emblem-style icon representing the "Outlaw Faction", a knife-and-skull or wild fang motif, a rough and wild impression, dark-green and gold base palette with a small red accent, circular badge-shaped frame, casual mobile-game art style, clean bold outlines, transparent background, faction-selection UI icon, 128x128px

### プロンプト（日本語）— kq-faction-icon-mage
> 「魔術師の派閥」を表すエンブレム風アイコン、魔法陣と杖、または魔石のモチーフ、神秘的で知的な印象、深緑と金を基調にした配色、丸いバッジ型のフレーム、カジュアルなソシャゲ風イラスト、くっきりした輪郭線、背景透過、派閥選択UI用アイコン、128x128px

### Prompt (English) — kq-faction-icon-mage
> An emblem-style icon representing the "Mage Faction", a magic circle and staff or a magic gem motif, a mystical and intellectual impression, dark-green and gold color palette, circular badge-shaped frame, casual mobile-game art style, clean bold outlines, transparent background, faction-selection UI icon, 128x128px

---

## 6. 三国ポチポチ / Sangoku Tap

パレット: 朱色〜金、三国志風（`panelFill:#2a1a14`, `accent:#d94a3d`）

| asset-id | 用途 | サイズ目安 | ステータス | 受領日 | 備考 |
|---|---|---|---|---|---|
| st-general-hakuen | 武将「白炎」(SSR)の立ち絵 | 384×512、背景透過 | 未依頼 | | |
| st-general-soujin | 武将「蒼刃」(SR)の立ち絵 | 384×512、背景透過 | 未依頼 | | |
| st-bg-battlefield | タップ進撃の背景（中華風の街道） | 1200×800、不透過 | 未依頼 | | |

### プロンプト（日本語）— st-general-hakuen
> 三国志風の武将キャラクター「白炎」、燃えるような朱色と金を基調にした豪華な鎧、大きな戟（げき、長柄武器）を携えて威風堂々と構える立ち姿、力強く華やかな最高レアリティらしい後光やエフェクトを背後に添えても良い、カジュアルなソシャゲ風イラスト、くっきりした輪郭線、背景透過、タップRPGの最高レアリティ（SSR）武将立ち絵、384x512px

### Prompt (English) — st-general-hakuen
> A Three Kingdoms-inspired general character named "Hakuen", ornate armor in blazing vermilion and gold, dignified commanding pose wielding a large polearm (ji), optionally with a subtle heroic light/aura effect behind them befitting a top-rarity unit, powerful and flashy, casual mobile-game art style, clean bold outlines, transparent background, top-rarity (SSR) general full body for a tap RPG, 384x512px

### プロンプト（日本語）— st-general-soujin
> 三国志風の武将キャラクター「蒼刃」、白炎よりも落ち着いた青と銀を基調にした鎧、片手に片刃の剣を携えたすらりとした立ち姿、白炎とは異なる爽やかで俊敏な印象、カジュアルなソシャゲ風イラスト、くっきりした輪郭線、背景透過、タップRPGの上位レアリティ（SR）武将立ち絵、384x512px

### Prompt (English) — st-general-soujin
> A Three Kingdoms-inspired general character named "Soujin", armor in a calmer blue and silver palette (contrasting with Hakuen's red/gold), slender standing pose wielding a single-edged sword in one hand, a refreshing and agile impression distinct from Hakuen, casual mobile-game art style, clean bold outlines, transparent background, high-rarity (SR) general full body for a tap RPG, 384x512px

### プロンプト（日本語）— st-bg-battlefield
> 中華風の街道を進撃する背景イラスト、土煙の立つ古代中国風の街道、遠景に山並みと城壁、朱色と金を基調にした夕暮れの空、タップして部隊を進撃させるゲームの雰囲気に合う躍動感、カジュアルなソシャゲ風背景イラスト、くっきりした輪郭線、中央付近は要素を少なめにしてUIを重ねられるようにする、不透過、1200x800px

### Prompt (English) — st-bg-battlefield
> A background illustration of an army advancing along a Chinese-inspired ancient road, dust rising from the road, distant mountains and city walls, a vermilion-and-gold dusk sky, dynamic mood fitting a tap-to-advance game, casual mobile-game background art, clean bold outlines, keep the center area relatively empty so UI can be overlaid, opaque, 1200x800px

---

## ルートハブページ

| asset-id | 用途 | サイズ目安 | ステータス | 受領日 | 備考 |
|---|---|---|---|---|---|
| hub-banner | ハブページ上部のバナーイラスト（6作のキャラが集合するイメージ等） | 1600×500、不透過 | 未依頼 | 各ゲームのキャラ素材が揃ってから着手すると統一感が出しやすい |

---

## 進捗サマリー（このセクションはClaudeが更新する）

- 組み込み済み: ポーション工房 4/4（pw-hero-alchemist, pw-cauldron-icon, pw-dragon-icon, pw-bg-workshop）
- 未依頼: 残り17アセット（剣戟の森・カラーマッチ・覇拳伝・カルマクエスト・三国ポチポチ・ハブページ）

更新履歴は `docs/decisions.md` に日付付きで記載する。個々のステータス変更はこのファイル自体を直接編集する。

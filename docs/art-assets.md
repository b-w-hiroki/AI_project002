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
| pw-hero-alchemist | タイトル/ヘッダーの錬金術師キャラ | 512×512、背景透過 | 未依頼 | | |
| pw-cauldron-icon | 大釜アイコン（設備リスト用） | 256×256、背景透過 | 未依頼 | | |
| pw-dragon-icon | 竜アイコン（設備リスト用） | 256×256、背景透過 | 未依頼 | | |
| pw-bg-workshop | 工房内観の背景イラスト | 1600×900、不透過 | 未依頼 | | |

### プロンプト（日本語）— pw-hero-alchemist
> 淡い水色〜白のパステル背景の錬金術師の女の子キャラクター、丸みのあるカジュアルなソシャゲ風デフォルメイラスト、フラスコを持っている、くっきりした輪郭線、明るく親しみやすい雰囲気、背景は透過、正面立ち絵、512x512px

### Prompt (English) — pw-hero-alchemist
> A cute chibi-style alchemist girl character in a casual mobile-game art style, pastel light-blue and white palette, holding a flask, clean bold outlines, friendly and bright mood, transparent background, front-facing full body, 512x512px

---

## 2. 剣戟の森 / Blade Woods（side-scroller）

パレット: 淡い青空ファンタジー、地上は茶色い土＋緑の芝、浮遊床は白い雲

| asset-id | 用途 | サイズ目安 | ステータス | 受領日 | 備考 |
|---|---|---|---|---|---|
| sf-hero-swordsman | 主人公キャラ（横向き、剣を構えるポーズ） | 256×384、背景透過 | 未依頼 | | |
| sf-enemy-normal | 通常敵キャラ | 256×256、背景透過 | 未依頼 | | |
| sf-bg-forest | 背景の森ステージイラスト | 1920×600、不透過（横スクロール想定） | 未依頼 | | |

### プロンプト（日本語）— sf-hero-swordsman
> 横向きに剣を構える若い剣士のキャラクター、明るいファンタジー世界観のカジュアルゲームアート、くっきりした輪郭線、青空ファンタジー系の配色、背景透過、横スクロールアクションゲームのプレイヤーキャラクター立ち絵、256x384px

### Prompt (English) — sf-hero-swordsman
> A young swordsman character in a side-facing battle stance holding a sword, bright fantasy casual-game art style, clean bold outlines, sky-blue fantasy palette, transparent background, side-scroller action game player sprite, 256x384px

---

## 3. カラーマッチ / Color Match

パレット: 明るいクリーム色ベース（`#fdf6e3`）

| asset-id | 用途 | サイズ目安 | ステータス | 受領日 | 備考 |
|---|---|---|---|---|---|
| cm-mascot | タイトル画面のマスコットキャラ | 512×512、背景透過 | 未依頼 | | |

### プロンプト（日本語）— cm-mascot
> カードや色をテーマにした可愛いマスコットキャラクター、クリーム色の明るい背景に映える配色、丸みのあるカジュアルなソシャゲ風デフォルメイラスト、くっきりした輪郭線、背景透過、512x512px

### Prompt (English) — cm-mascot
> A cute mascot character themed around playing cards and colors, casual mobile-game chibi art style, bright colors that pop against a cream background, clean bold outlines, transparent background, 512x512px

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
> 格闘家の男性キャラクター、拳を構えたバトルポーズ、力強く男らしい濃い赤と金を基調にした配色、劇画寄りのカジュアルゲームアート、くっきりした輪郭線、背景透過、格闘ゲームのプレイヤーキャラクター立ち絵、384x512px

### Prompt (English) — fl-hero-fighter
> A male martial artist fighter character in a battle stance with fists raised, bold dark-red and gold color scheme, semi-realistic casual fighting-game art style, clean bold outlines, transparent background, fighting game player character full body, 384x512px

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
> ファンタジーRPGの勇者キャラクター、深緑と金を基調にした落ち着いた配色、剣を携えた凛々しい立ち姿、カジュアルなソシャゲ風イラスト、くっきりした輪郭線、背景透過、育成RPGのメインキャラクター立ち絵、384x512px

### Prompt (English) — kq-hero-warrior
> A fantasy RPG hero character with a sword, calm dark-green and gold color palette, dignified standing pose, casual mobile-RPG art style, clean bold outlines, transparent background, main character full body for a hero-raising RPG, 384x512px

---

## 6. 三国ポチポチ / Sangoku Tap

パレット: 朱色〜金、三国志風（`panelFill:#2a1a14`, `accent:#d94a3d`）

| asset-id | 用途 | サイズ目安 | ステータス | 受領日 | 備考 |
|---|---|---|---|---|---|
| st-general-hakuen | 武将「白炎」(SSR)の立ち絵 | 384×512、背景透過 | 未依頼 | | |
| st-general-soujin | 武将「蒼刃」(SR)の立ち絵 | 384×512、背景透過 | 未依頼 | | |
| st-bg-battlefield | タップ進撃の背景（中華風の街道） | 1200×800、不透過 | 未依頼 | | |

### プロンプト（日本語）— st-general-hakuen
> 三国志風の武将キャラクター「白炎」、朱色と金を基調にした豪華な鎧、威風堂々とした立ち姿、カジュアルなソシャゲ風イラスト、くっきりした輪郭線、背景透過、タップRPGの最高レアリティ武将立ち絵、384x512px

### Prompt (English) — st-general-hakuen
> A Three Kingdoms-inspired general character named "Hakuen", ornate armor in vermilion and gold, dignified commanding pose, casual mobile-game art style, clean bold outlines, transparent background, top-rarity general full body for a tap RPG, 384x512px

---

## ルートハブページ

| asset-id | 用途 | サイズ目安 | ステータス | 受領日 | 備考 |
|---|---|---|---|---|---|
| hub-banner | ハブページ上部のバナーイラスト（6作のキャラが集合するイメージ等） | 1600×500、不透過 | 未依頼 | 各ゲームのキャラ素材が揃ってから着手すると統一感が出しやすい |

---

## 進捗サマリー（このセクションはClaudeが更新する）

- 未依頼: 全アセット
- 組み込み済み: なし

更新履歴は `docs/decisions.md` に日付付きで記載する。個々のステータス変更はこのファイル自体を直接編集する。

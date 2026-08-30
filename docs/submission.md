# 投稿準備資料（CrazyGames / PLiCy）

6作すべて Phaser + TypeScript + Vite（HTML5、外部プラグイン依存なし）、CrazyGames SDK連携済み（`src/platform/crazygames.ts`、非SDK環境ではno-op）。日本語UIのみ（多言語対応はポーション工房のみ）。

公開URL: https://b-w-hiroki.github.io/AI_project002/

---

## 1. ポーション工房 / Potion Workshop

- ジャンル: 放置・育成（idle/incremental）
- 対応言語: 日本語・英語（自動判定＋切替ボタン）
- 対応デバイス: PC・スマートフォン（タッチ対応、レスポンシブ）
- 公開URL: https://b-w-hiroki.github.io/AI_project002/potion-workshop/

### 紹介文（日本語）
> クリックしてポーションを調合し、設備を増やして自動生産。集めたポーションで
> 錬金術師や大釜、竜やポータルまで揃えて、生産効率をどんどん上げよう。
> 一定量を調合したら「転生」して、次の周回をもっと有利に進められる永続ボーナスを
> 獲得。実績を集めながら、放置と操作の両方で楽しめるポーション工房を大きく育てよう。

### Description (English)
> Click to brew potions, then hire alchemists, cauldrons, dragons, and portals to
> automate production. Once you've brewed enough, ascend to reset your run for a
> permanent production bonus and push further next time. Collect achievements and
> grow your workshop your way — whether you love clicking or watching numbers climb
> on their own.

### カテゴリ / タグ候補
- Idle, Clicker, Incremental, Casual
- 日本語: 放置ゲーム, クリッカー, 育成

### 主要機能
- クリックで手動生産、設備購入で自動生産
- 8種類の設備、指数関数的なコスト増加
- 転生（プレステージ）システムで周回ごとに強くなる
- 10種類の実績
- オフライン進行（最大72時間まで拡張可能）
- 日本語/英語 完全対応
- サウンドON/OFF切り替え
- セーブデータのエクスポート/インポート（JSON）

---

## 2. 剣戟の森 / Sword Forest

- ジャンル: 横スクロールアクション・ウェーブサバイバル
- 対応デバイス: PC・スマートフォン（タッチ操作・仮想スティック対応）
- 公開URL: https://b-w-hiroki.github.io/AI_project002/side-scroller/

### 紹介文（日本語）
> ウェーブごとに強くなる敵の群れを剣で迎え撃ち、どこまで生き残れるかに挑む
> 横スクロールアクション。近距離・中距離・遠距離の3種の武器を切り替え、
> スキルや奥義・秘奥義で連続撃破を狙おう。武器はガチャと鍛治で集めて強化し、
> 自分だけのロードアウトを組んで高ウェーブを目指せ。

### Description (English)
> Fend off waves of ever-stronger enemies in this side-scrolling action game.
> Switch between melee, mid-range, and ranged weapons, chain skills and finishing
> moves, and gear up through gacha and blacksmithing to build your own loadout.
> How many waves can you survive?

### カテゴリ / タグ候補
- Action, Survival, RPG
- 日本語: アクション, サバイバル, 武器収集

### 主要機能
- ウェーブ式サバイバル（ランダム生成、ボス/大量発生ウェーブあり）
- 武器種別（近接/中距離/遠距離）の即時切替
- スキル・奥義・秘奥義（コマンド入力対応）
- 武器/防具のレア度・強化・進化システム
- モバイル対応（仮想スティック＋タッチボタン）

---

## 3. カラーマッチ / Color Match

- ジャンル: 脳トレ・反応速度（ストループ効果ベース）
- 対応デバイス: スマートフォン優先（縦持ちレイアウト）、PCも可
- 公開URL: https://b-w-hiroki.github.io/AI_project002/color-match/

### 紹介文（日本語）
> 文字の「内容」か「色」、指示された方に一致する枠まで制限時間内にカードを
> ドラッグする認知力・反応速度チャレンジ。ひらがな/カタカナ/漢字/英語の
> 4つの表記モードを切り替え可能。連続正解でターボモードに突入し、
> スコアがどんどん伸びていく爽快感を楽しめる。

### Description (English)
> A Stroop-effect brain-training game — drag the card to the frame matching
> either its word or its ink color, whichever you're told, before time runs out.
> Chain fast correct answers to enter Turbo Mode and watch your score climb.

### カテゴリ / タグ候補
- Puzzle, Brain Training, Casual, Reaction
- 日本語: 脳トレ, 反応速度, パズル

### 主要機能
- ドラッグ&ドロップ＋制限時間タイマー
- 内容/色の複合判定（ストループ効果）
- ターボモード（連続正解ボーナス）
- 表記モード4種（ひらがな/カタカナ/漢字/English）
- ベストスコア・ベストターボの永続化

---

## 4. 覇拳伝 / Fist Legend

- ジャンル: 格闘バトル
- 対応デバイス: PC・スマートフォン（横持ち、タッチ操作対応）
- 公開URL: https://b-w-hiroki.github.io/AI_project002/fist-legend/

### 紹介文（日本語）
> 拳・蹴・気の3ボタンで応酬する格闘バトル。じゃんけん相性で威力が変わり、
> 攻撃を当てるほど溜まる奥義ゲージで大技を放て。拳→拳→拳→気の隠しコマンド
> 技も存在する。バトルで貯めた通貨で武将ガチャを回し、豪華なキャラクターを
> 集めよう。

### Description (English)
> A fighting game fought with three moves — punch, kick, and ki — each with a
> rock-paper-scissors-style advantage. Land hits to fill your special gauge for a
> finishing move, or land a hidden command combo. Spend your winnings on gacha
> pulls to collect fighters.

### カテゴリ / タグ候補
- Fighting, Action, Arcade
- 日本語: 格闘ゲーム, アクション, ガチャ

### 主要機能
- 拳/蹴/気の三すくみバトル、奥義ゲージ
- 隠しコマンド技（拳→拳→拳→気）
- ガチャ（SSR/SR/R/N、実課金なしのゲーム内通貨制）
- 効果音・ダメージ数値ポップアップ演出

---

## 5. カルマクエスト / Karma Quest

- ジャンル: 育成RPG
- 対応デバイス: スマートフォン優先（縦持ちレイアウト）、PCも可
- 公開URL: https://b-w-hiroki.github.io/AI_project002/karma-quest/

### 紹介文（日本語）
> 勇者を育て、討伐に送り出し、神様に戦果を報告する育成RPG。4つの派閥からの
> 要望に応えるか断るかでカルマが傾き、勇者の力が変化する。討伐中は「おうえん」
> ボタンで勝率を後押しでき、道中では選択によってカルマや戦況が変わる遭遇
> イベントも。報告は良い場面だけを選ぶのがコツ、悪い場面まで報告すると評価が
> 下がる。12回の討伐を乗り越えて、最強の勇者伝説を作ろう。

### Description (English)
> Raise a hero, send them to battle, and report the results to the gods. Answer
> or decline requests from four factions to shape your hero's growth, cheer them
> on mid-battle, and navigate random encounters along the way. Only report the
> good moments — bad news lowers your standing. Survive 12 campaigns to become a
> legend.

### カテゴリ / タグ候補
- RPG, Idle, Strategy, Casual
- 日本語: 育成RPG, カルマ, オートバトル

### 主要機能
- 4派閥のカルマシステム（応じる/断るで勇者の成長方向が変化）
- オートバトルの討伐パート、道中の遭遇イベント
- 「おうえん」ボタンで勝率をわずかに後押し
- 良い場面だけを選んで報告する神様への報告パート
- 12年サイクルの育成ループ

---

## 6. 三国ポチポチ / Sangoku Tap

- ジャンル: タップ進撃・放置RPG
- 対応デバイス: スマートフォン優先（縦持ちレイアウト）、PCも可
- 公開URL: https://b-w-hiroki.github.io/AI_project002/sangoku-tap/

### 紹介文（日本語）
> タップして部隊を進撃させよう。宝箱・出会い・小競り合いがランダムに発生する
> タップRPG。貯めたコインで武将ガチャを回し、集めた武将には装備合成
> （ブリーディング）で作った装備を装着してステータスを強化できる。
> 装備合成の排出率はレアリティの組み合わせごとに細かく設定されており、
> 狙った装備を掘り当てる楽しみがある。

### Description (English)
> Tap to advance your troops through random encounters, treasure finds, and
> skirmishes. Spend your coins on general gacha pulls, then breed equipment and
> gear up your generals to boost their stats. Equipment breeding odds vary
> precisely by rarity combination — chase the drop you want.

### カテゴリ / タグ候補
- Idle, Clicker, RPG, Casual
- 日本語: タップゲーム, 放置, ガチャ

### 主要機能
- タップ進撃（遭遇/宝箱/戦闘のランダムイベント）
- 武将ガチャ（SSR/SR/R/N）と所持武将の永続化
- 装備合成（レアリティ別の詳細な排出率テーブル）
- 武将一覧・装備の装着システム（ステータス強化）

---

## CrazyGames投稿の技術要件チェックリスト（全6作共通）

- [x] `src/platform/crazygames.ts` で SDK 初期化・`gameplayStart`/`happytime` 呼び出し済み（全6作）
- [x] 非独占（他ポータルにも同時公開可能）
- [x] サムネイル画像（1200×630、各ゲームのアクセントカラーで生成）
- [ ] `npm run build` の `dist/` を各ゲームごとにzip化してアップロード（投稿時に実施）
- [ ] CrazyGames 開発者アカウント作成（人間の作業）

## PLiCy投稿の準備（全6作共通）

- [ ] PLiCy アカウント作成（人間の作業）
- [ ] 各ゲームの `dist/` をそのままアップロード、または GitHub Pages のURLを直接案内
- [x] 日本語の紹介文（上記、全6作分）

## 公開URL

- ハブページ: https://b-w-hiroki.github.io/AI_project002/
- ポーション工房: https://b-w-hiroki.github.io/AI_project002/potion-workshop/
- 剣戟の森: https://b-w-hiroki.github.io/AI_project002/side-scroller/
- カラーマッチ: https://b-w-hiroki.github.io/AI_project002/color-match/
- 覇拳伝: https://b-w-hiroki.github.io/AI_project002/fist-legend/
- カルマクエスト: https://b-w-hiroki.github.io/AI_project002/karma-quest/
- 三国ポチポチ: https://b-w-hiroki.github.io/AI_project002/sangoku-tap/

# AI Project 002 — スマホ最適化 + ビジュアル強化 実装指示書

更新日: 2026-09-13

## 0. 目的

6作品すべてを、スマートフォンの縦持ち / 横持ちで破綻なく遊べる状態へ統一し、そのレスポンシブ基盤の上で、スタンドアロンのコンセプトアートに実画面を寄せる。

対象:

- `games/sangoku-tap`
- `games/potion-workshop`
- `games/karma-quest`
- `games/color-match`
- `games/side-scroller`
- `games/fist-legend`

この作業ではゲームロジックを極力変更しない。主対象はレイアウト、入力、表示密度、背景、アート、UI階層、演出である。

---

# 1. 完成条件

すべての作品で以下を満たすこと。

## 1.1 端末対応

- 縦持ち: 360×800 〜 430×932 を主対象とする
- 横持ち: 667×375 〜 932×430 を主対象とする
- タブレットは同じ仕組みで破綻しないことを最低条件とする
- iPhone系の Safe Area を考慮する
- orientation change 後にリロード不要で再レイアウトする
- スクロールなしで主要操作が完結する

## 1.2 操作

- 主要タップ領域は最低 44×44 CSS px 相当
- 重要CTAは 52px 以上を推奨
- 画面端 12px 以内に主要操作を置かない
- 横持ちアクションゲームは親指操作を前提に左手 / 右手領域を分ける
- hover を必須条件にしない
- pointerdown / pointerup の押下フィードバックを必ず入れる

## 1.3 視認性

- 通常本文相当: 12px 未満を避ける
- 主要数値: 16px 以上
- CTA: 16〜24px
- HP / TIME / SCORE / 通貨 / 次目標は 1秒以内に見つけられる
- 背景と文字のコントラストを確保する

## 1.4 ビジュアル

各ゲームで以下が明確であること。

1. 主役
2. 今の目的
3. 次に押すもの
4. 進捗
5. 成功 / 失敗のフィードバック

---

# 2. 共通レスポンシブ基盤

## 2.1 レイアウトモード

全ゲームに共通のレイアウト判定を導入する。

```ts
export type LayoutMode =
  | "phone-portrait"
  | "phone-landscape"
  | "tablet-portrait"
  | "tablet-landscape";
```

最低限、以下を共通化する。

```ts
export type ViewportLayout = {
  mode: LayoutMode;
  width: number;
  height: number;
  safeTop: number;
  safeRight: number;
  safeBottom: number;
  safeLeft: number;
  uiScale: number;
  isPortrait: boolean;
};
```

判定基準の初期値:

- `isPortrait = height >= width`
- `tablet = min(width, height) >= 600`
- `uiScale = clamp(min(width / baseWidth, height / baseHeight), 0.82, 1.18)`

## 2.2 推奨ファイル

各ゲームへ重複実装せず、可能なら共通モジュールを置く。

例:

```text
games/shared/mobile/
  layout.ts
  safeArea.ts
  touch.ts
  responsiveScene.ts
```

ただしビルド構成上の共有が複雑になる場合は、まず同一APIのローカル実装で開始し、安定後に共通化してよい。

## 2.3 Safe Area

HTML側で以下を使用する。

```css
padding-top: env(safe-area-inset-top);
padding-right: env(safe-area-inset-right);
padding-bottom: env(safe-area-inset-bottom);
padding-left: env(safe-area-inset-left);
```

Canvas内でも Safe Area を考慮したレイアウト値を使う。

避けること:

- ノッチ付近に戻る / 設定 / 一時停止を配置
- ホームインジケータ直上に重要CTAを密着

## 2.4 Scene側の再配置

固定座標を散在させず、各Sceneに1つのレイアウト関数を持たせる。

```ts
private layoutUi(layout: ViewportLayout): void
```

または表示専用レイヤーの場合:

```ts
export function applyLayout(scene: Runtime, layout: ViewportLayout): void
```

`resize` / orientation change で再実行する。

## 2.5 画面領域の基本分割

### Portrait

```text
┌─────────────────┐
│ top HUD         │ 10〜14%
├─────────────────┤
│                 │
│ main visual     │ 52〜60%
│                 │
├─────────────────┤
│ goal / status   │ 8〜12%
├─────────────────┤
│ controls / CTA  │ 20〜26%
└─────────────────┘
```

### Landscape

```text
┌─────────────────────────────┐
│ top HUD                     │
├───────────────┬─────────────┤
│               │ side HUD /  │
│ main visual   │ objective   │
│               │             │
├───────────────┴─────────────┤
│ controls / CTA              │
└─────────────────────────────┘
```

アクション系は左右親指領域へ分ける。

---

# 3. UI共通ルール

## 3.1 情報優先順位

常時表示は最大5系統まで。

優先度A:
- HP / TIME / SCORE
- 現在ステージ / YEAR / WAVE
- 主通貨
- 次目標
- メインCTA

優先度B:
- サブ通貨
- 詳細ステータス
- 設備一覧
- 履歴
- 設定

Bはドロワー、タブ、補助パネルへ退避する。

## 3.2 ゲームUI化

Webカード風に見えないようにする。

- 強い外枠
- 上面ハイライト
- 影
- 押下時に2〜4px沈む
- 数値を大きく
- アイコン + 数値の組み合わせ
- 重要CTAだけ彩度を上げる

## 3.3 フィードバック

共通実装候補:

- hit flash
- scale punch
- floating number
- combo pop
- light shake
- reward burst
- progress fill tween

すべてを常用せず、作品ごとの核に合わせる。

---

# 4. 三国ポチポチ

## 4.1 画面コンセプト

「武将を率い、戦場を進軍し、天下統一へ向かう戦略マップ」。

## 4.2 Portrait

### 構成

```text
[章 / 資源 / 功績]
[戦略マップ]
[選択中拠点 / 報酬 / 勝率]
[武将3〜4枚]
[編成] [出陣]
```

### ルール

- マップが画面面積の45〜52%
- 左サイドメニューは縦持ちでは常設しない
- メニューは上部ハンバーガーまたは小型タブへ
- `出陣` は画面最下段の最大CTA
- 武将カードは横スクロール可

## 4.3 Landscape

```text
[資源 / 章 / 功績]
[戦略マップ 65%] [選択拠点 35%]
                  [武将]
                  [報酬]
                  [出陣]
```

- 戦略マップを横に広く見せる
- 右側へ情報を集約
- 右下 `出陣`

## 4.4 ビジュアル強化

優先:

1. 専用戦略マップ背景
2. 章ごとの城 / 砦 / 山 / 河川
3. 武将カードの統一フレーム
4. ルート上の旗 / 炎 / 行軍粒子
5. BOSS拠点専用アート

## 4.5 DoD

- Portraitでマップが小さなカード群に見えない
- Landscapeで戦場の横方向の広がりを感じる
- 3秒以内に「次にどこへ出陣するか」が分かる
- 武将、勝率、報酬、出陣が一連の導線になる

---

# 5. Potion Workshop

## 5.1 コンセプト

「錬金術師と大釜が主役の、放置系錬金クリッカー」。

## 5.2 Portrait

```text
[通貨 / Essence / REP]
[錬金術師]
[大釜 TAP]
[本日の依頼]
[おすすめ強化]
[生産ライン / 発展]
```

- キャラ + 大釜で画面の45〜55%
- 設備一覧はドロワー
- `TAP!` は親指で届く中央下
- 依頼とおすすめ強化は1枚ずつ

## 5.3 Landscape

```text
[通貨]
[錬金術師 + 大釜 55%] [依頼 / 強化 45%]
[生産ライン横一列]
```

- 左側を世界観、右側を管理UIに分ける
- 白いカードを増やさない

## 5.4 ビジュアル強化

優先:

1. 工房専用背景をコンセプトアート品質へ更新
2. 窓光 / 棚 / ハーブ /瓶 / 木材の暖色感
3. 大釜の発光と液体アニメ
4. キャラの待機モーション
5. 設備稼働アニメ
6. 注文達成の報酬演出

## 5.5 DoD

- 一目で大釜をタップしたくなる
- キャラがUIに埋もれない
- 10秒見ているだけでも工房が動いて見える
- 縦横どちらでも主役が常に最大要素

---

# 6. カルマクエスト

## 6.1 コンセプト

「選択が世界と勇者を変える、勇者育成 × 派閥シミュレーション」。

## 6.2 Portrait

```text
[YEAR / 評価 / 神託]
[主人公 + 王都]
[依頼 / 物語]
[勢力評価]
[選択肢 A]
[選択肢 B]
```

- 主人公を画面左〜中央に大きく
- 羊皮紙イベントを右寄せまたは重ねる
- 派閥詳細は折りたたみ可能
- 選択肢は下部固定

## 6.3 Landscape

```text
[主人公 + 王都] [物語 / 神託]
[主人公 + 王都] [派閥 / カルマ]
[選択 A] [選択 B]
```

- 左50%を絵
- 右50%を判断材料

## 6.4 ビジュアル強化

優先:

1. 王都 / 地方 / 荒野などイベント背景差分
2. 主人公の成長段階差分
3. 派閥ごとの紋章
4. カルマコンパスのアニメ
5. 章切替 / 年次切替のページ演出
6. 選択結果による背景・人物変化

## 6.5 DoD

- 選択肢が画面の主CTAとして明確
- 選択前に影響先が分かる
- 選択後に「世界が変わった」反応が見える
- PortraitでもUI重なりがない

---

# 7. Color Match

## 7.1 コンセプト

「色と文字のズレを瞬時に見抜く、60秒アーケード」。

## 7.2 Portrait

```text
[SCORE / pause]
[TIME] [RULE]
[お題]
[回答カード 2×3]
[CHAIN / FLOW]
[NEXT RULE + mascot]
```

- Portraitを主基準とする
- 回答カードは親指タップ優先
- 1カード最低 96×76 相当

## 7.3 Landscape

```text
[TIME / SCORE] [RULE / NEXT]
[お題] [回答カード 3×2]
       [mascot / CHAIN]
```

- お題を左、回答を右に分離してもよい
- 指の移動距離を短くする

## 7.4 ビジュアル強化

優先:

1. 背景をよりアーケード的に動かす
2. カード押下・正解・誤答の差を明確化
3. FLOW中の背景変化
4. CHAINの成長演出
5. マスコット反応差分
6. 終了時リザルト強化

## 7.5 DoD

- 縦持ち片手でも遊べる
- 60秒間、次に押す場所を迷わない
- FLOW突入が見た目だけで分かる
- 横持ちでもカードが間延びしない

---

# 8. 剣戟の森

## 8.1 コンセプト

「読みと反撃で斬り抜ける、横スクロール剣戟アクション」。

## 8.2 Landscape — 主モード

```text
[HP / OUGI] [STAGE] [MISSION]

       GAMEPLAY FIELD

[virtual stick]        [斬][技]
                       [跳][奥義]
```

- 横持ちを第一品質基準にする
- 左下に移動、右下にアクション
- 中央下を空ける
- Boss HPは中央上部

## 8.3 Portrait — 対応モード

```text
[HP / STAGE / WAVE]
[縦長Gameplay]
[MISSION]
[stick] [斬][技][跳]
        [奥義]
```

- 視界が狭くなるためカメラズームを調整
- 敵の出現距離をPortrait時に少し短く見せる
- HUDを1段へ圧縮

ゲームルール自体は変更しない。

## 8.4 ビジュアル強化

優先:

1. 森背景の遠景 / 中景 / 前景レイヤー
2. 主人公の攻撃・回避アニメ
3. 雑魚敵の統一アート
4. BOSSをさらに大型化
5. tell → charge → recover の視覚差
6. 斬撃残像 / hit stop / dust

## 8.5 DoD

- Landscapeでスマホアクションゲームとして自然
- 両親指で操作したときUIが被らない
- Portraitでも最低限クリアまで遊べる
- BOSSの予兆が小画面でも読める

---

# 9. 覇拳伝

## 9.1 コンセプト

「三すくみを読み、一撃必殺を決める対戦バトル」。

## 9.2 Landscape — 主モード

```text
[PLAYER HP] [ROUND/TIME] [ENEMY HP]

     PLAYER  VS  ENEMY

[stick]      [打][蹴][気]
              [奥義]
```

- キャラの対峙面積を最大化
- 操作は右下へ集約
- HPは上辺の左右

## 9.3 Portrait

```text
[PLAYER HP]
[ROUND / TIME]
[ENEMY HP]

[PLAYER VS ENEMY]

[打] [蹴] [気]
[     奥義     ]
```

- 2キャラを斜めに配置して奥行きを作る
- 仮想スティックが不要な操作体系ならPortraitでは非表示可
- 大ボタン中心の読み合いUIにする

## 9.4 ビジュアル強化

優先:

1. 闘技場背景の専用アート
2. 2キャラの対峙絵大型化
3. 攻撃 / 被弾差分
4. 読み勝ち時の画面停止 + 衝撃波
5. 奥義カットイン
6. KO / ROUND結果演出

## 9.5 DoD

- Landscapeで格闘ゲームに見える
- Portraitでも三すくみ入力を迷わない
- 読み勝ちと読み負けが一目で判別できる
- 奥義READYが強い期待感を出す

---

# 10. 実装順

## Phase 1 — 共通レスポンシブ基盤

PR例: `feat: add shared mobile layout foundation`

対象:

- viewport / orientation判定
- Safe Area
- uiScale
- resize event
- layout presets
- touch target helper

完成条件:

- 6作品すべてでレイアウトモードが取得できる
- orientation change後にUI再配置可能

## Phase 2 — Portrait系4作

順番:

1. Color Match
2. 三国ポチポチ
3. カルマクエスト
4. Potion Workshop

1作品1PR。

目的:

- まず縦持ち品質を完成
- そのPR内で横持ちレイアウトも実装

## Phase 3 — Action系2作

順番:

5. 剣戟の森
6. 覇拳伝

横持ちを主品質とし、同時にPortrait fallbackを作る。

## Phase 4 — 専用アート投入

順番:

1. 三国背景 / 拠点 / 武将
2. Potion工房背景 / 設備
3. カルマ王都 / 地域背景
4. 剣戟 森 / BOSS / 雑魚
5. 覇拳 闘技場 / 攻撃差分
6. Color 背景 / マスコット差分

---

# 11. テスト戦略

## 11.1 Playwright viewport matrix

最低限以下を自動確認する。

```ts
[
  { name: "iphone-portrait", width: 390, height: 844 },
  { name: "iphone-landscape", width: 844, height: 390 },
  { name: "small-portrait", width: 360, height: 800 },
  { name: "small-landscape", width: 800, height: 360 },
]
```

各ゲームで確認:

- Canvasが画面外へはみ出さない
- 主要CTAがviewport内
- portrait / landscapeでクラッシュしない
- タップ可能

アクション2作:

- 仮想スティックと主要ボタンが重ならない

Color:

- 6カードが全て操作可能

Potion:

- 大釜タップが有効

三国:

- 出陣CTAが操作可能

Karma:

- 2選択肢が操作可能

Fist:

- 三すくみ入力 + 奥義が操作可能

## 11.2 Visual regression

将来的に各orientationの代表スクリーンショットを保存し、PRごとに比較する。

推奨:

```text
visual-baseline/
  sangoku/portrait.png
  sangoku/landscape.png
  ...
```

---

# 12. PR運用

1 PR = 1つの明確な完成条件。

推奨:

1. `feat: add shared mobile layout foundation`
2. `feat(color): optimize portrait and landscape play`
3. `feat(sangoku): optimize campaign map for mobile`
4. `feat(karma): optimize choice screen for mobile`
5. `feat(potion): optimize workshop for mobile`
6. `feat(side): add landscape-first mobile controls`
7. `feat(fist): optimize versus layout for mobile`
8. `art(sangoku): upgrade campaign world art`
9. `art(potion): upgrade workshop world art`
10. 以下各作品

各PRで:

- lint
- typecheck
- unit test
- build
- relevant browser E2E
- portrait / landscape screenshot review

を通す。

---

# 13. 最終Definition of Done

6作品すべてについて:

- Portraitでプレイ可能
- Landscapeでプレイ可能
- orientation changeで破綻しない
- Safe Area内に主要操作が収まる
- コンセプトアートとの主構図が一致
- 主役ビジュアルが最大要素
- HUDがWeb UIではなくゲームUIとして見える
- 目的 / 進捗 / 報酬 / CTAが明確
- 主要画面のスクリーンショットが作品として見せられる品質

この状態を、AI Project 002 の「ゲーム画面完成ライン」とする。

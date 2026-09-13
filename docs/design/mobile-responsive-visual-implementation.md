# AI Project 002 — スマホ最適化 + ビジュアル強化 実装指示書

更新日: 2026-09-13

## 0. 目的

6作品すべてを、PCブラウザ前提の固定画面から **スマホ縦持ち / 横持ちの両方で成立するゲーム画面**へ移行する。

そのうえで、各作品のスタンドアロン・コンセプトアートを実装上のアートディレクション基準として使い、以下を同時に満たす。

1. 縦持ちでも主要操作が片手〜両親指で完結する
2. 横持ちではプレイ領域を最大化し、ゲームらしい情報密度を保つ
3. ノッチ / Dynamic Island / ホームインジケータを避ける
4. 画面比率が違ってもUIが潰れない
5. コンセプトアートの「主役サイズ・背景密度・CTAの強さ」を維持する
6. 既存ロジック、セーブ、経済、スコア、戦闘判定を壊さない

---

# 1. 共通レスポンシブ基盤

## 1.1 LayoutMode

全作品で次の3モードを共通概念として持つ。

```ts
export type LayoutMode =
  | "phone-portrait"
  | "phone-landscape"
  | "wide";
```

判定目安:

- `phone-portrait`: `height > width * 1.15`
- `phone-landscape`: `width > height * 1.15 && min(width, height) <= 600`
- `wide`: その他。PC / タブレット横 / 大型端末

CSSのviewportサイズではなく、Phaser Scale Managerが返す実描画領域を基準にする。

## 1.2 レイアウト情報

各Sceneで直接 `window.innerWidth` を参照しない。共通ヘルパーから以下を取得する。

```ts
export type SafeInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type LayoutContext = {
  mode: LayoutMode;
  width: number;
  height: number;
  safe: SafeInsets;
  uiScale: number;
  compact: boolean;
};
```

想定API:

```ts
getLayoutContext(scene): LayoutContext
onLayoutChange(scene, callback): () => void
```

## 1.3 Safe Area

各ゲームの `index.html` / CSS で `env(safe-area-inset-*)` を受け取り、Canvas周辺だけでなく Phaser UI にも反映する。

最低限:

```css
html, body, #app, #game {
  margin: 0;
  width: 100%;
  height: 100%;
  min-height: 100dvh;
  overflow: hidden;
  background: #000;
}

body {
  padding-top: env(safe-area-inset-top);
  padding-right: env(safe-area-inset-right);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
}
```

Phaser側ではCSS paddingに依存しきらず、主要HUD/操作を画面端から最低12〜16px離す。

## 1.4 タッチターゲット

スマホ時のインタラクティブ領域:

- 最小 44 CSS px 相当
- 主要CTAは 52〜64px 相当
- 円形アクションボタンは直径 56〜72px
- ボタン同士の間隔は最低8px
- 誤タップが致命的な「転生」「リセット」「敗走」は12px以上離す

見た目が小さいボタンでも `Zone` は44px以上を確保する。

## 1.5 UI Scale

固定Canvas座標を全面廃止する必要はない。既存ゲームサイズを「design resolution」として残し、以下を切り替える。

- `phone-portrait`: 重要情報を残し、補助情報を折り畳む
- `phone-landscape`: 操作UIを左右下へ退避し、中央プレイ領域を拡大
- `wide`: 現在のコンセプトアート準拠画面を維持

文字サイズは一律縮小しない。優先度ごとに下限を定める。

| 種別 | portrait | landscape | wide |
|---|---:|---:|---:|
| 主要数値/タイマー | 22px以上 | 20px以上 | 22px以上 |
| CTA | 16px以上 | 15px以上 | 16px以上 |
| 本文 | 12px以上 | 11px以上 | 12px以上 |
| 補助ラベル | 9px以上 | 9px以上 | 10px以上 |

## 1.6 Orientation Change

端末回転でScene再起動しない。

- ゲーム状態維持
- Canvas resize
- UI containerの座標/scaleのみ再配置
- tweens中でも壊れない
- open drawer/modalは再配置して維持

`resize` / `orientationchange` を一本化し、100〜150ms程度のdebounceを入れる。

---

# 2. 共通実装構造

各ゲームに以下の責務を持つファイルを置く。

```text
src/
  responsive.ts     # mode判定 / safe area / resize購読
  layout.ts         # ゲーム固有の座標プリセット
  conceptArt.ts     # コンセプトアート寄せの描画
```

既存の `conceptArt.ts` が肥大化している場合、段階的に座標を `layout.ts` へ移す。

例:

```ts
export const potionLayout = {
  portrait: {
    hero: { x: 0.5, y: 0.32, scale: 1.0 },
    cauldron: { x: 0.5, y: 0.56, scale: 1.0 },
    order: { x: 0.5, y: 0.76 },
  },
  landscape: {
    hero: { x: 0.28, y: 0.42, scale: 1.0 },
    cauldron: { x: 0.32, y: 0.68, scale: 1.0 },
    order: { x: 0.76, y: 0.38 },
  },
} as const;
```

座標は可能な限り比率で持ち、最終的に `width * x` / `height * y` へ変換する。

---

# 3. 三国ポチポチ

## 3.1 縦持ち

### 主役
戦略マップを画面中央〜上2/3に置く。

### 配置

- Top Safe Area直下: 資源 / 功績 / 章進行
- 左サイドメニューは5項目常設をやめ、上部メニューボタンまたは2〜3項目へ圧縮
- 中央: 戦場背景 + 一本道/分岐ルート + 拠点ノード
- 下25〜30%: 武将3体、部隊戦力、勝率、出陣
- 「出陣」は最下段、片手でも押せる幅70%以上

### portraitで隠す/圧縮

- 長いキャッチコピー
- 報酬詳細の2行目
- 常時表示の商店/任務メニュー

### 目標
縦画面でも「戦場を見て、次の拠点を選び、武将を確認して出陣」が1画面で完結する。

## 3.2 横持ち

- 左60〜65%: 戦略マップ
- 右35〜40%: 選択中拠点 / 勝率 / 報酬 / 武将 / 出陣
- 資源は上端に薄く横並び
- 右下に巨大出陣
- mapの拠点間距離を広げ、背景の山/城/軍旗を見せる

## 3.3 ビジュアル強化

優先アセット:

1. `st-bg-campaign-map` — 夕暮れの中国大陸/街道/城塞、縦横でcrop可能
2. 主要武将の半身〜立ち絵差分
3. 拠点アイコン3〜5種
4. 赤旗 / 金粉 / 土煙の軽量FX

コンセプトアートとの差を埋めるポイント:

- 背景の景観がUIより大きく見える
- 章ルートはカード内ではなく景色の上に直接置く
- 武将カードは最低3体を見せる
- 出陣CTAが画面で最も強い操作物

---

# 4. Potion Workshop

## 4.1 縦持ち

### 配置

- 上: potion / essence / reputation
- 中央上: 錬金術師
- 中央下: 大釜。画面の主要入力
- 下: 本日の依頼 / おすすめ強化 / 生産ライン
- 詳細設備はBottom Sheet / Drawer

大釜は画面幅の35〜45%を目安にし、キャラと合わせて画面の50%以上をビジュアル領域にする。

## 4.2 横持ち

- 左50〜55%: 工房背景 + 錬金術師 + 大釜
- 右45〜50%: 注文 / おすすめ強化 / 工房Lv
- bottom: potion inventory / production
- drawerは右側から展開

## 4.3 ビジュアル強化

優先アセット:

1. `pw-bg-workshop-v2`
   - 木製棚、瓶、薬草、窓光
   - 中央〜左にキャラ/大釜の空き
   - 右側にUIを置ける暗め領域
2. 大釜のbrew 3フレーム差分
3. 魔法リング / 泡 / 星粒
4. 設備アイコンの統一セット

改善基準:

- 白いカード面積を画面の30%以下へ
- 背景を完全に隠す不透明カードを減らす
- 「タップで作る」ことが1秒で分かる
- 右パネルは木/羊皮紙/金属枠など世界観のある表現へ

---

# 5. カルマクエスト

## 5.1 縦持ち

- 上: YEAR / 評価 / 神託
- 中央上: 主人公 + 王都背景
- 中央: 羊皮紙イベント本文
- 右/下: 派閥評価は小型化
- 最下段: 選択肢を縦2段

重要:
主人公と羊皮紙を同じ高さで競合させず、人物→文章→選択の読み順を明確にする。

## 5.2 横持ち

- 左30%: 主人公 + 世界
- 中央40%: 物語本文
- 右30%: 派閥/カルマ/能力値
- 下: 選択肢2つを横並び

## 5.3 ビジュアル強化

優先アセット:

1. `kq-bg-royal-capital`
2. Hero立ち絵の派閥差分または色差分
3. 羊皮紙フレーム
4. 4派閥の紋章
5. カルマコンパス

改善基準:

- 「文章UI」ではなく「世界の中で選択している」絵になる
- 王都背景の空気遠近を残す
- 選択結果が派閥バーへアニメーションで伝播する

---

# 6. Color Match

## 6.1 縦持ち

縦持ちを基準画面とする。

- Top: SCORE / pause
- 左上〜中央: 円形TIME
- 中央: お題
- 中央〜下: 6色回答カードを2×3
- 右下: mascot
- Bottom: NEXT RULE

片手操作を考慮し、下段カードほど少し大きくしてもよい。

## 6.2 横持ち

- 左40%: TIME / SCORE / お題
- 右60%: 回答カード3×2
- mascotは右下端
- NEXT RULEは下端横帯

## 6.3 ビジュアル強化

- 空 / 城 / 虹はゲームプレイを邪魔しない低コントラスト背景
- 正解時にカードが弾ける
- FLOW突入時のみ背景彩度・星粒を増やす
- 連続正解時にCHAINタイポを中央へ一瞬出す
- スコア数字は常時最も読みやすい情報にする

---

# 7. 剣戟の森

## 7.1 横持ち

横持ちを主戦場とする。

- 左下: virtual stick
- 右下: 斬 / 技 / 跳 / 奥義
- 左上: portrait + HP / OUGI
- 上中央: stage / wave
- 右上: mission
- boss時: boss HPを上中央〜右へ

プレイ領域は画面の65%以上確保する。

## 7.2 縦持ち

縦でもプレイ不能にしない。

推奨:

- ゲームワールドを上60〜65%
- 操作UIを下35〜40%
- stick左下、斬/技を右下、跳/奥義をその上
- HP / stageは1段に圧縮
- missionは折り畳み式

縦時はカメラ横幅を少し狭くするか、プレイヤー前方の可視範囲を優先してcamera follow offsetを調整する。

## 7.3 ビジュアル強化

- 森の前景/中景/遠景を3層化
- boss登場時に背景を暗くして敵を大型化
- slash trailを強化
- COMBO / JUST / OUGIのタイポをキャラ付近へ
- 操作ボタンにアイコンアートを入れる

---

# 8. 覇拳伝

## 8.1 横持ち

横を基準とする。

- 左右キャラを画面高55〜70%で見せる
- 上: 左右HP /中央TIME
- 下: `打 / 蹴 / 気 / 奥義`
- 左下stickは移動/選択に必要な場合のみ
- 中央下は奥義ゲージ

## 8.2 縦持ち

- 上15%: mirrored HP + TIME
- 中央50〜55%: キャラ対峙
- 下30〜35%: 2×2大型行動ボタン
- ヒント文は戦闘中常設しない
- 読み勝ち/読み負けの瞬間だけタイポを中央表示

縦持ちは「格ゲーのミニチュア化」ではなく、コマンド選択型の対戦画面として成立させる。

## 8.3 ビジュアル強化

- 専用arena背景
- character hit pose / attack pose差分
- 拳衝突時の円形衝撃波
- OUGI時に背景を一時的に落とす
- Round / KO / 読み勝ちタイポを共通演出レイヤー化

---

# 9. テスト戦略

## 9.1 Viewport Matrix

最低限以下を自動/手動確認する。

| 種別 | viewport |
|---|---|
| iPhone portrait | 390×844 |
| iPhone compact portrait | 375×667 |
| Android portrait | 412×915 |
| iPhone landscape | 844×390 |
| Android landscape | 915×412 |
| Tablet | 768×1024 |
| Desktop | 1280×720 |

## 9.2 E2E最低条件

各ゲーム最低1本ずつ追加する。

共通確認:

- canvasがviewportからはみ出さない
- orientation change後もcanvasが存在
- 主要CTAがviewport内
- 主要CTAをタップ可能
- critical UI同士が極端に重ならない

アクション2作:

- landscapeで操作ボタンが全てvisible
- portraitでもプレイヤー操作が1回以上成立

## 9.3 Visual Regression

可能ならPlaywright screenshotを追加する。

候補:

```text
screenshots/
  portrait.png
  landscape.png
```

Pixel-perfectの差分をCIで即NGにはせず、最初はartifact保存と目視レビューに使う。

---

# 10. 実装PR順

既存方針の「1 PR = 1画面」に加えて、今回はレスポンシブ基盤を先行させる。

## PR-A: 共通スマホ基盤

対象: 6作品

- viewport / safe-area対応
- orientation判定
- resize lifecycle
- `LayoutMode`導入
- タッチ最小サイズルール
- 全作品でportrait / landscapeの切替が壊れない状態

Definition of Done:

- 6作のlint/typecheck/test/build成功
- Potion / 剣戟既存E2E成功
- 6作を390×844 / 844×390で起動できる

## PR-B: 縦基準4作品

対象:

1. Color Match
2. 三国ポチポチ
3. カルマクエスト
4. Potion Workshop

- portraitを完成形へ
- landscapeを2カラム中心に再配置
- 主要CTAを親指範囲へ

## PR-C: 横基準2作品

対象:

1. 剣戟の森
2. 覇拳伝

- landscapeを完成形へ
- portrait専用操作レイアウト
- アクション可視領域の確保

## PR-D以降: ビジュアルアセット置換

優先順:

1. 三国 背景 + 武将
2. Potion 工房背景 + 大釜FX
3. カルマ 王都 + 派閥紋章
4. 剣戟 森レイヤー + slash FX
5. 覇拳 Arena + attack pose
6. Color 背景 + mascot feedback

---

# 11. 完成判定

各作品は以下をすべて満たして初めてスマホ最適化完了とする。

- [ ] portraitで画面外に重要UIが出ない
- [ ] landscapeで重要UIがゲーム領域を過剰に覆わない
- [ ] Safe Areaに主要CTAが侵入しない
- [ ] orientation changeで状態を失わない
- [ ] 44px相当未満の必須タッチ領域がない
- [ ] 主要目的 / 現在状態 / 次の行動が3秒以内に理解できる
- [ ] コンセプトアートの主役が実画面でも最大級の視覚要素になっている
- [ ] PC/wide表示が既存より劣化していない
- [ ] lint / typecheck / unit / buildが成功
- [ ] 対象E2Eが成功

---

# 12. 実装時にやらないこと

- スマホ対応のためにゲームルールを変更しない
- 既存save schemaを不必要に変えない
- portrait/landscapeで別Sceneを作らない
- orientationごとに別DOMページを作らない
- 文字を小さくするだけで解決しない
- コンセプトアートの情報をすべて同時表示しようとしない
- 操作領域と演出領域を同じ座標に重ねない

レスポンシブ対応は「縮小」ではなく、**情報優先度を保った再配置**として実装する。

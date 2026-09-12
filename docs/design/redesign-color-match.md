# カラーマッチ — 再設計 v2

## 1. North Star

**色と文字のズレを瞬時に見抜き、ルール切替に適応してCHAINを伸ばす、60秒のポップな反射神経ゲーム。**

現状はコアルールと60秒構成が強い。再設計では「説明を読むパズル」ではなく、SCORE / TIME / CHAIN / 次ルールが大きく動くアーケードゲームとして見せる。

## 2. 1画面で伝えること

1. 今は文字の意味を見るのか、色を見るのか。
2. 残り時間はいくつか。
3. どこをタップ / ドラッグすればよいか。
4. CHAINがどれだけ続いているか。
5. 次にいつルールが変わるか。

## 3. 画面構成

### Top-right
- SCORE
- Best
- Pause

### Top-left
- 大きな円形TIME
- 残り10秒以下で色 / pulse変化

### Center-top
- 現在ルール
  - `文字の意味を見る`
  - `文字の色を見る`
- Rule iconを付ける

### Center
- 判定対象カードを最大要素にする
- 文字を大きく
- 回答カードは2×2で明快に配置

### Right / Bottom-right
- Mascot
- CHAIN
- FLOW / TURBO

### Bottom
- `NEXT RULE`
- 次切替までの秒数
- 次が意味 / 色どちらかを予告

## 4. 入力

スマホ:
- 回答カードをタップが第一候補
- ドラッグは代替操作として残してよい

PC:
- Click / Drag
- 将来的に1〜4キー対応も検討

入力方式はルール理解を邪魔しない。カードが最も大きなタップ対象になるようにする。

## 5. 60秒のテンポ

既存の段階構成を維持する。

- 0〜15秒: 内容
- 15〜30秒: 色
- 30〜45秒: 5秒周期
- 45〜60秒: 3秒周期

ただし見せ方を明確にする。

### Rule Shift
- 画面背景のaccentが短く変化
- `RULE SHIFT`
- 次の判定軸を0.5〜0.8秒表示
- プレイを止めすぎない

### Final 10 sec
- TIME pulse
- BGM / tick上昇
- SCORE / CHAINの視認性を上げる

## 6. CHAIN / FLOW

- 3 chain: 小さな反応
- 5 chain: FLOW開始
- 10 / 15 / 20: milestone
- ミス: chain breakを短く表示

FLOW中は:
- 背景に星 / 軌跡
- Mascotリアクション
- SCORE数字がpulse

派手さは回答カードの可読性を絶対に覆わない。

## 7. Result

大きく:
- SCORE
- BEST更新
- MAX CHAIN

補助:
- 正答率
- 平均反応時間
- 意味 / 色別正答率
- 切替直後正答率

次行動:
- Retry
- Weakness Practice（将来）
- Hubへ戻る

## 8. アート方向

- 明るい空 / 虹 / 星 / パステル
- 回答色は原色寄りで明確に識別
- Mascotはナビ役として右下固定
- UIは濃紺または白を土台にして、背景に埋もれない
- 子ども向けに寄りすぎず、アーケードのスコアアタック感を保つ

## 9. 必須アセット

P0:
- 判定カード4色UI
- Mascot 通常 / 成功 / ミス
- FLOW badge
- TIME / SCORE frame

P1:
- Rule Shift FX
- Chain milestone
- Result crown / medal

## 10. 現状との差分

活かす:
- 60秒 Challenge
- Rule switching
- Turbo streak
- Detailed result stats
- Drag input

変える:
- 上部テキスト中心HUD
- Timer / Scoreのサイズ
- Next ruleの存在感
- Mascotの役割
- 回答カードのタップ優先度

## 11. MVP PR

`feat(color): rebuild 60-second arcade play screen`

完了条件:
- TIME / SCORE / RULE / CHAINが1秒で読める
- 判定カードが画面最大の操作対象
- Rule Shiftを見落としにくい
- FLOW中も回答可読性を維持
- Resultで上達ポイントが理解できる
- 390px幅で片手操作可能

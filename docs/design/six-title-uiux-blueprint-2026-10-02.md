# 6タイトル UI/UX 統合設計図

作成日: 2026-10-02  
基準: `main` / `2c0861a67203569d495d6a114a07804897f13c88`  
状態: **2026-10-03 P0第一便を実装。残項目は下記Done条件で継続**

## 実装ステータス（2026-10-03）

| タイトル | 今回Done | 残る優先課題 | 次のDone条件 |
|---|---|---|---|
| Color Match | 6個別ボタン維持、60秒Challenge/20秒Practice、モード別結果CTA、タイマー世代競合防止 | 任意の正解/不正解マスコット差分、実機Safe Area | PR #306 exact-head CI、実iOS/Androidで開始→回転→結果→再挑戦を完走 |
| Fist Legend | 横持ちタイトルで全モードを再表示、チーム選択を44px化 | 800×600の覇者モード導線、mobile Resultの報酬/読み合い統計、fighter状態素材 | 390×844・844×390・800×600で選択→戦闘→結果→再戦、表示値がdesktopと一致 |
| Karma Quest | 未実装ショップ/持ち物を準備中表示に合うカーソルへ統一 | 年次報告の自動進行除去、12年表示整合、任意の年次背景 | 各年の結果→次へを手動完走し、回転/再読込で重複進行しない |
| Potion Workshop | 注文カードと黒板の評判値を実報酬計算へ統一 | 実機での縦横回転連打、任意素材なし | 街倍率1.0/1.5/2.0の表示と納品加算が一致し、回転/復帰で描画世代が逆転しない |
| Sangoku Tap | 敗走結果を予測lootでなく実持帰り額へ統一 | 結果表記の全layout統一、role/reward/route icon | clear/retreat/defeatの表示額と保存額が一致し、回転後も同一結果を表示 |
| Side Scroller | 偽のLV.28とWAVE n/3を廃止し、実HP/Waveへ統一 | 短辺600以下のstyle選択、Resultの再戦/見直し分離、10枠超inventory | style選択→戦闘→結果→再戦/見直しを両向きで完走し、Wave/Boss/Bestが実値一致 |

- P0では新規素材を必須にしない。P1素材は独立ファイル、独立pivot、状態別silhouetteで作る。
- OH-EDOの公開設定は本リポジトリ外の権限課題として分離し、今回変更しない。
- 共通Doneは unit、typecheck、build、Chromium、WebKit、390×844、375×667、844×390、console/page/request error 0。実機項目は実iOS/Android確認まで未検証扱いとする。

## 0. この設計図の扱い

この文書は、Color Match、Fist Legend、Karma Quest、Potion Workshop、Sangoku Tap、Side Scroller の既存実装・テスト・実画面を監査し、次の改善フェーズの判断基準を揃えるものです。

優先順位は次の通りです。

1. 表示と実挙動を一致させる
2. 縦・横・PCで同じ機能へ到達できるようにする
3. 初回と再訪の次の行動を明確にする
4. 結果を読める休止点と、再試行・見直し導線を作る
5. 既存モック、既存ルール、既存素材を活かす
6. 新機能、新経済、新規素材は別提案として扱う

この設計の承認前には、コード変更、画像生成、画像差し替えを行わない。

## 1. 共通設計原則

### 1.1 共通フロー

```text
初回: 目的理解 → 準備/選択 → プレイ → 結果理解 → 再試行または見直し
再訪: 保存結果の確認 → 最短の再開/再挑戦 → プレイ → 結果理解
```

- 画面全体タップによる意図しない即再戦を避け、結果には名前付きCTAを置く。
- 主CTAは各画面で原則1つ。同格の二択だけ2つを同じ強さにする。
- 副CTAは「戻る」ではなく、行先や目的が分かるラベルにする。
- 表示する報酬、確率、進捗、残り時間、スコアは、保存・精算に使う同じview modelから描画する。
- 画角ごとの独自計算、固定モック値、架空の報酬は使わない。
- 現行仕様に途中保存がない場合、「続きから」は表示しない。

### 1.2 情報の優先順位

全タイトルで、情報は次の順に配置する。

1. 今どこにいて、何を判断するか
2. 主CTAと、その結果
3. 現在値、費用、効果、リスク
4. 成長・保存される値
5. 装飾、補助情報、設定

### 1.3 代表viewportと入力

| 区分 | 代表枠 | 基本方針 |
|---|---:|---|
| スマホ縦 | 390×844 / 設計450×800 | 上から状況、舞台、判断、CTA。縦スクロールは準備・一覧だけ許可 |
| スマホ横 | 844×390 / 設計800×450 | 左を舞台、右または下を判断railにする |
| 小型スマホ | 375×667 | 情報を省略せず、装飾と余白を縮める |
| タブレット | 768×1024 | 縦仕様を基準に過度な引き伸ばしを避ける |
| PC | 1280×720内に800×450または800×600 | モバイルと同じ情報契約。hover/keyboardは補助のみ |

- 操作面は最低44 CSS px、主CTAは原則52–64 px。
- Safe Areaを避け、回転後も同じ機能・状態・選択へ到達できること。
- 背景・キャラ・UI文字・FXは分離し、UI文字をラスターへ焼き込まない。
- `normal / focus / pressed / selected / disabled / processing` は原則code-nativeで表現する。

### 1.4 共通Done条件

- 初回と再訪を、表示されたCTAだけで最後まで操作できる。
- 内部method呼び出しや直接state書換えだけをE2Eの合格根拠にしない。
- 縦、横、PCで機能が同値。回転で進行・報酬・評価が二重適用されない。
- CTA連打、タイムアウト同時入力、再描画、reloadでトランザクションが一度だけ成立する。
- 失敗時は状態を壊さず、理由を表示して再試行できる。
- 壊れた保存値、負数、NaN、旧schemaから安全な既定値へ復帰する。
- 素材読込失敗時も、code-native UIで主要操作を継続できる。
- Chromium / WebKit、unit、build、代表画面スクリーンショット、console/page/request error 0を確認する。
- 物理iOS/Androidのbrowser bar、Safe Area、`pagehide`、長時間idleは最終実機確認項目として残す。

---

## 2. Color Match

### 2.1 守る契約と直す不一致

- 6色の個別回答ボタンを維持する。縦2×3、横3×2。
- Challengeは60秒、Practiceは20秒固定。
- Challengeのルール進行は現行通り、0–15秒が文字の意味、15–30秒が文字色、30–45秒が5秒切替、45–60秒が3秒切替。
- Practiceは弱い方の1ルールだけを出題する。
- 日本語portraitで消えているPractice CTAを戻す。
- Practice中に存在しないNEXT RULEやRULE SHIFTを表示しない。
- HUDと結果のScoreを同じ0–100算式にする。
- `CHAIN`は「1秒未満の高速正解連続」に限定し、`FAST CHAIN / MAX FAST CHAIN`へ名称を揃える。
- 結果の「20秒練習」CTAは、本当に20秒Practiceを開始する。

### 2.2 初回・再訪フロー

```text
初回: Title → 60秒Challenge または 20秒Practice → Play → Result
      → もう一度60秒 / 弱点を20秒練習 / Title

再訪: Title（表記・Best復元）→ Challenge または弱点Practice → Result
```

- 初回専用チュートリアル画面は増やさない。
- Titleに一文ルール、表記4種、Challenge、Practice、Bestを置く。
- 再訪では実際の弱点判定結果をPractice CTAに明記する。

### 2.3 画面役割とCTA

| 画面 | 役割 | 主CTA | 副CTA | 情報優先 |
|---|---|---|---|---|
| Title | セッション選択 | 60秒チャレンジ | 弱点を20秒練習 | ルール→モード→表記→Best |
| Play | 今の判断基準を伝える | 6回答 | Titleへ | Current Rule→問題→回答→時間→Score/FAST CHAIN |
| Result | 成果と次の一手 | Challenge後はもう一度60秒、Practice後は60秒へ | 実対象の弱点Practice、Title | Grade/Score→正答率/速度→弱点→CTA |

### 2.4 リズム

Titleで休息し、15秒単位で緊張を上げ、最後の15秒を最大緊張にする。Resultでは完全に停止し、自動送りしない。成長は既存のBest Score、Best Turbo、累積ルール別成績だけとし、通貨・解除・報酬は追加しない。

### 2.5 代表枠

- 縦Title: タイトル0–90、マスコット90–300、説明310–410、表記430–560、Best575–615、Challenge625–685、Practice700–754。
- 縦Play: HUD0–92、現在ルール96–190、問題220–350、6回答390–700、下帯720–786。
- 横Play: 左20–410に時間・ルール・問題・マスコット、右425–780にScoreと6回答。
- PC: 800×450横構成を中央配置。機能数を変えない。

### 2.6 素材・パーツ

| 区分 | パーツ | 仕様 |
|---|---|---|
| 流用 | `cm-bg-fantasy-portrait.png` | 450×800、center anchor |
| 流用 | `cm-bg-fantasy-landscape.svg` | 800×450 viewBox、center anchor |
| 流用 | `cm-mascot.png` | 512²、anchor 0.5/0.5 |
| 流用 | `cm-turbo-badge.png` | 256²、HUD36 / FLOW64 |
| 流用 | 6回答カード | 個別code-nativeを維持。統合スプライト化しない |
| code-native | CTA、回答状態、TIME警告、RULE、FAST CHAIN、Grade | 44px以上、色と文字の両方で状態表示 |
| 任意P1 | mascot correct / miss | 各512²透明、同一キャンバス、足基準0.5/0.86 |
| 任意P1 | result medal | 256²透明、Grade文字は焼き込まない |

P0に新規画像は不要。

### 2.7 Done

- 表記は即保存しreload後復元。ChallengeだけBestを更新し、Practiceは更新しない。
- 1セッションにつき成績記録は1回。途中離脱は採点しない。
- 回転後もmode、duration、remaining、current rule、問題、件数を保持。
- Practice中はNEXT RULEなし。結果CTAから実際に20秒・固定1ルールを開始。
- HUD Scoreと結果Score、HUD FAST CHAINと結果MAX FAST CHAINが一致。
- 縦横でChallenge、Practice、6回答、結果の主副CTAを実タップするE2Eを持つ。

---

## 3. Fist Legend

### 3.1 守る契約と直す不一致

- 全4fighterは初期から使用可能のまま。ガチャ取得を編成権へ結び付けない。
- 60秒の拳・蹴・気の読み合い、奥義、交代、1戦1回の覇者を維持する。
- 800×600でも覇者selectorを消さない。
- 横スマホでも準備・相手・編成・モード選択を表示する。
- mobile Resultへ今回報酬、READ WINS、MAX STREAK、SPECIAL USEDを実値で渡す。
- ガチャは100石のまま。P0では戦闘能力や使用権を追加しない。

### 3.2 初回・再訪フロー

```text
初回: Portal → 準備（相性・相手・最大3人編成）→ Single Battle
      → 60秒Battle → Result → 同条件再戦 / 編成・相手を見直す

再訪: 準備（編成・石・勝数・Story復元）
      → Battle / Gauntlet / Story → Result → Retry/Next/準備
```

Gacha / Collectionは準備の副導線とし、対戦開始より強くしない。

### 3.3 画面役割とCTA

| 画面 | 役割 | 主CTA | 副CTA | 情報優先 |
|---|---|---|---|---|
| 準備 | モード・相手・編成 | 選択モード開始 | Gauntlet/Story、Collection、戻る | mode→tell/counter→編成→石/勝数 |
| Battle | 読み合い | 拳/蹴/気、条件時奥義 | 交代、覇者 | HP/TIME→敵tell→三すくみ→入力→special |
| Result | 結果理解 | 再戦/Next Rival/Next Chapter/Retry | 編成・相手を見直す | 勝敗→今回報酬→読み成績→進捗→CTA |
| Collection | 価格確認と履歴 | 1回引く（100） | Collection/準備 | 残高→結果→取得/重複 |

### 3.4 リズム

準備5–15秒を休息、tellごとの判断を緊張、奥義・覇者・低HP・残10秒を山場、Resultを余韻とする。Resultは自動送りしない。成長は石、勝数、Story進捗、最小Collection記録。

### 3.5 代表枠

- 縦Battle: 上12%にHP/TIME、敵24%、tell10%、自分24%、下26%に覇者・3入力・奥義。
- 横Battle: 上15%にHP/TIME、中央60%にVS、下25%にtell、3入力、交代・覇者・奥義。
- PC 800×600: 既存VS構図を維持し、下段へtell、3moves、special、switch、hajaを全て置く。
- 横Result: 左を決着絵、右を結果・報酬・読み・CTAにする。

### 3.6 素材・パーツ

| 区分 | パーツ | 仕様 |
|---|---|---|
| 流用 | `fl-bg-arena.png` | 1600×900、cover、center |
| 流用 | hero / enemy / gacha Ryuga | 384×512透明、pivot 0.5/0.94 |
| 流用 | `fl-fighter-{ryuga,renka,gaku,mei}.svg` | 384×512、runtime roster |
| code-native | HP、奥義、move、impact、guard、haja aura、CTA | 状態差分はtint/frame/text |
| 任意P1 | 4人＋敵のidle/attack/hit/win/lose | 384×512透明、bottom-center、同一silhouette |
| 任意P1 | Collection thumbnails | 11種、256²透明、center |
| 任意P1 | move icons | 7種、128²透明。状態別画像は作らない |

P0に新規画像は不要。既存WebP候補を採用する場合はmanifestとruntimeを一本化する。

### 3.7 保存とDone

- 既存の石、勝数、編成、Storyをreload後復元する。
- 最小Collection案を採用する場合は `item id / count / lastDrawId` だけ保存し、fighter使用権と分離する。
- ガチャは石-100とcount+1が同時に1回だけ成立。保存失敗時は消費しないかrollbackする。
- Battle途中reloadは準備へ戻り、報酬なし。途中Battle保存は別提案。
- Result連打で報酬二重付与なし。縦横PCで今回報酬と読み成績が同値。
- 390×844、844×390、800×600で準備→Battle→Result→Retry/見直しを可視CTAだけで通す。

---

## 4. Karma Quest

### 4.1 守る契約と直す不一致

- 承認済み10月画面、12年構成、選択結果の既存「次へ」、1.8秒応援＋0.7秒勝敗表示を維持する。
- 年次報告後の500ms自動進行をやめ、年次決算と「次の年へ」を置く。
- 今回の旅と、Best Year / Total Evaluationなどの恒久記録を混ぜない。
- 未実装の鍛冶・ショップを実装済み機能と同じ押せる主ナビに置かない。
- 現仕様では旅途中を保存しないため、「続きから」を表示しない。

### 4.2 初回・再訪フロー

```text
初回: Home → 年次依頼 → 選択結果「次へ」→ 任意の遭遇
      → 応援/戦闘 → 年次報告 → 年次決算「次の年へ」
      → …12年 → 最終結果 → もう一度旅へ / Home

再訪: Home（恒久記録）→ 新しい旅を始める
```

途中save案を採用するまでは、再訪時に途中旅を復元しない。

### 4.3 画面役割とCTA

| 画面 | 役割 | 主CTA | 副CTA | 情報優先 |
|---|---|---|---|---|
| Home | 旅開始と恒久記録 | 最初の依頼/新しい旅 | 遊び方、キャラ、図鑑、レイド、リーグ、音 | 依頼→説明→これまでの記録 |
| 年次依頼 | 意味ある二択 | 受諾 | 辞退（同格） | 年N/12→依頼→各選択の変化 |
| 選択結果 | 因果の理解 | 次へ | — | 結果絵→本文→4派閥差分 |
| 遭遇 | 短い変化 | A | B（同格） | ラベル＋効果を同一カード内 |
| 戦闘 | 短い参加感 | 応援 | — | 敵味方→残HP→応援 |
| 年次報告 | 意味付け | この内容で報告 | 神切替、記録選択 | 指示→神→候補→選択/予告評価 |
| 年次決算 | 休息・成長確認 | 次の年へ/結末を見る | — | 今回評価Δ→旅累計→次年Mandate→年録 |
| 最終結果 | 物語と再挑戦 | もう一度旅へ | Home | 称号/派閥/旅評価→年録→恒久記録 |

### 4.4 リズム

1年を「依頼判断→reactionで休息→遭遇判断→短い戦闘緊張→報告→年次決算で休息」とする。年次報告確定時に評価を一度だけ加算し、年次決算はread-only。次年CTAで再加算しない。

### 4.5 代表枠

- 縦: header12–112、本文/絵112–620、判断/結果カード620–734、主CTA734–792。
- 承認済みHomeの章ヘッダ、左rail、前景勇者、下部依頼カード、下部navを維持。
- 横/PC 800×450: 左8–382を絵・勇者、右400–782を本文・CTA。
- 報告は左に候補、右に神・選択・確定。確定後は同じ面を年次決算へ置換する。

### 4.6 素材・パーツ

| 区分 | パーツ | 仕様 |
|---|---|---|
| 流用 | capital home v3 / kingdom portrait v2 / dialogue / faction / reaction | portrait背景、center cover、既存crop維持 |
| 流用 | hero / elder / requester | hero 384×512ほか、bottom-center基準 |
| 流用 | 8依頼×accept/declineの16結果絵 | `outcomeArt` mappingを単一sourceにする |
| 流用 | 派閥icon | 4種128² |
| code-native | 紙面、罫線、神tab、CTA、評価seal/arrow/flash | processing中は見た目と入力をlock |

P0の新規ラスターは0。年次章扉などは承認後の任意P1。

### 4.7 保存とDone

- Best Yearは最大値のみ、Total Evaluationは年次報告確定ごとに1回、音設定は再訪後も復元。
- active journeyは保存しない。reload/back後はHomeから新しい旅。
- 素材準備失敗時はHome phaseを維持し、失敗・再試行を依頼カードに表示する。
- 結果絵失敗時は同じ依頼・年・karmaのまま再試行し、選択を適用しない。
- 報告連打、回転、resizeで評価、chronicle、legend countを二重付与しない。
- 年次決算は待っても自動進行せず、CTAだけで次年へ。12年目はfinalへ1回だけ。
- 初回から最終結果まで、縦横それぞれ可視CTA中心のE2Eを持つ。

### 4.8 別承認の途中save案

採用する場合だけ別PRで、年次決算確定後をcheckpointとする。依頼乱数途中、素材読込途中、報告選択途中は保存しない。Homeに「旅を続ける」「新しい旅」を分け、schema versionと破損時fallbackを用意する。

---

## 5. Potion Workshop

### 5.1 守る契約と直す不一致

- 経済バランスは変えない。
- 初回目標を、実際の学習順である「15まで調合→Apprentice購入→自動生産→order」にする。
- UPGRADE / EQUIP tabは即購入せず、費用と効果を確認する詳細を開く。
- Order報酬は固定`+1/+3`ではなく `contractReward` の実値を表示する。
- 転生前に、保持される項目とリセットされる項目を全て明示する。
- 黒板、PC footer、詳細誘導は同じ `nextObjective` を使う。

### 5.2 初回・再訪フロー

```text
初回: Workshop → TAP TO BREW（15まで）→ Apprentice詳細
      → BUY → 自動生産開始 → Order 1（120）→ 納品結果 → Workshop

再訪: Offline result → 工房へ → 保存stateから共通nextObjective
```

objectiveの優先順は、転生可能→初回15未達→Apprentice未購入→未納order→街需要generator→prestige progress。

### 5.3 画面役割とCTA

| 画面 | 役割 | 主CTA | 副CTA | 情報優先 |
|---|---|---|---|---|
| Workshop | 生産観察と調合 | TAPまたは現在objective | Orders/Upgrades/Equipment/Ascend | potion/秒/objective→CTA→管理 |
| Management detail | 購入判断 | BUY | Back | item/Lv→費用→before/after→所持 |
| Orders | 納品判断 | Deliver | Workshop | 必要数→実報酬→ready状態 |
| Order result | 消費と成長理解 | 工房へ | — | 消費→REP→倍率before/after→次目標 |
| Ascension | 不可逆選択 | 各街を選ぶ | Back | Essence→保持/リセット→街効果 |

### 5.4 リズム

能動調合で入力を学び、Apprentice購入で自動化の解放を見せる。中期はorderへ貯めるか設備へ使うかの既存選択、納品でREP倍率を結果表示、1Mで転生を山場とする。新通貨や新ルールは増やさない。

### 5.5 代表枠

- 縦450×800: header0–106、hero/cauldron106–510、objective/黒板、orders514–610、recommended624–686、bottom nav710–778。
- Management detailは下部sheet約420×280、主CTAをSafe Areaより上に置く。
- 横800×450: 左0–385をhero/cauldron/TAP、右394–782をobjective/orders/detail、管理行335–395、summary405–447。
- PC: 同じ左右2columnを中央配置。転生カードだけPC横並び、縦は縦積み。

### 5.6 素材・パーツ

| 区分 | パーツ | 仕様 |
|---|---|---|
| 流用 | `pw-bg-workshop.png` | 1600×900、center、portraitはcover crop |
| 流用 | stirring hero v2 | 640²、center、表示350²縦/238²横 |
| fallback | `pw-hero-alchemist.png` | 512²、center |
| 流用 | cauldron | 256²、表示260²縦/170²横 |
| 流用 | approved cat | 166×182、装飾専用 |
| code-native | management sheet、item row、cost/effect、BUY、Back、result、保持/リセット | row44px以上、CTA48px以上 |

P0の新規bitmapは0。状態はnormal/selected/affordable/disabled/pressed/purchasedで表す。

### 5.7 保存とDone

- 表示CTAだけでbrew→15→detail→BUY→order→deliver→result→Workshopを通す。
- tab openではstate/localStorage不変。BUYで費用とLvが正確に1回だけ更新。
- Order、転生を連打しても報酬・Essence・analyticsは1回。
- 全economy action後に即保存。offline rewardを同じsavedAt区間へ二重加算しない。
- 回転後もstateと開いていた文脈を保持するか、明示的にHomeへ復帰する。
- reward、click gain、productionを実計算関数と一致させる。
- 転生後reloadで保持・リセット契約が一致。Backは完全無変更。
- 不足・保存失敗時はstate/save/reward不変で、理由を表示し再試行できる。

---

## 6. Sangoku Tap

### 6.1 守る契約と直す不一致

- 3地域×10地点、分岐3/7、関門10、帰還は全額、敗走は未確保coinの半額、将・装備喪失なしを維持する。
- 横結果の敗走loot全額表示を、実精算の `floor(loot × 0.5)` に合わせる。
- 横campへ鍛錬、役割効果、分岐の勝率・期待収穫・相性を追加し、縦と同じ判断材料にする。
- Homeの`DEPLOY`は即出陣ではなくcampへ行くため、「戦略地図へ」に直す。
- active遠征がある場合は同じrun idを再開し、新規遠征を作らない。

### 6.2 初回・再訪フロー

```text
初回: Home → 戦略地図 → 地域/編成/鍛錬確認 → 出陣
      → road → 分岐3 → 分岐7 → 関門10 → Result
      → 次地域の戦略地図 / 拠点・武将と装備

再訪(active): Home「遠征を再開 n/10」→ 保存済みroad
再訪(no active): Home → 戦略地図（次の未clear地域を選択）
```

### 6.3 画面役割とCTA

| 画面 | 役割 | 主CTA | 副CTA | 情報優先 |
|---|---|---|---|---|
| Home | hubと再開判断 | 遠征再開 / 戦略地図へ | 武将・装備、武将登用、装備合成 | active run→記録→管理 |
| Camp | 地域・出陣判断 | `[地域名]へ出陣` | 編成、鍛錬、拠点 | 地域→勝率/報酬→編成→役割/鍛錬 |
| 編成 | 3人選択 | この編成で戦略地図へ | 拠点で装備を整える | 所持/rarity/役割効果→装備込みATK |
| 遠征 | risk/reward判断 | 進軍 / 関門へ | 帰還してn銭確保 | HP/地点→未確保→帰還/敗走額→次勝率 |
| 分岐 | route比較 | Road | Mountain（同格） | 勝率→期待収穫→相性 |
| Result | 精算事実と次行動 | 戦略地図・次地域 | 拠点・武将と装備 | status→到達→実確保→gear/merit→CTA |

### 6.4 リズム

Home/編成で休息、campで予告、地点1–2で緊張上昇、3で判断、4–6で再評価、7で判断、8–10で関門へクライマックス、Resultで精算と休息。確率・倍率・地点数は変えない。

### 6.5 代表枠

- 縦450×800: status0–76、舞台76–542、run summary542–620、CTA/fork620–714、副情報714–800。
- 横800×450: header0–64、左0–540を舞台、右540–800をdecision rail。
- 横Result: 左に部隊/到達、右に共通settlementと2 CTA。
- PC: 450×800を過度に拡大せず中央、または800×450横仕様。hoverなしでも完結。

### 6.6 素材・パーツ

| 区分 | パーツ | 仕様 |
|---|---|---|
| 流用 | `st-bg-battlefield.png` | 1200×800、center crop / cover |
| 流用 | approved Home hero / capital | 承認済み構図維持 |
| 流用 | generals | 3:4透明、pivot 0.5/0.96、contain |
| 流用 | boss | 3:4、pivot 0.5/0.96、通常敵と混用しない |
| 流用 | impact / city / deploy plate | FX center、marker center、CTA文字はcode-native |
| 任意P1 | role icons 4種 | 128²透明、表示24–32、状態別複製なし |
| 任意P1 | reward icons 3種 | 96²透明、表示18–28 |
| 任意P1 | route badges 3種 | 96²、色だけでなく形状差 |
| 任意P1 | settlement emblem | 256²透明、表示72–96 |

P0は新規画像不要。既存背景・武将・bossの再生成はしない。

### 6.7 保存とDone

- advance/route選択直後にactive run保存。回転・reload・Home再開でregion/step/hp/loot/route/fork/party一致。
- active run再開は同じrun id。分岐未選択状態も保存する。
- 帰還・敗走・clearは共通settlementを一度だけ算出し、表示額とcurrency差が一致。
- 敗走loot100は50、奇数はfloor。再描画・回転・連打・reloadで二重精算なし。
- 失敗で将、装備、既存coin、partyを失わないことをResultに明示する。
- Homeラベルと実遷移を一致させ、戻るだけでrun作成・精算しない。
- 縦横で鍛錬、role効果、route比較を操作・閲覧できる。

---

## 7. Side Scroller

### 7.1 守る契約と直す不一致

- 実ルールは無限Wave、Bossは5Waveごと、Swarmは7Waveごと。固定`LV.28`、`WAVE n/3`を使わない。
- Colorと同じく、既存の選択肢を画角理由で減らさない。短辺600以下でもCHAIN / DRAWを選べるようにする。
- Resultの全面タップ即再戦をやめ、再戦と見直しを分ける。
- 所持武器10件目以降へも到達できる一覧/ページを用意する。
- P0では存在しない戦闘後通貨報酬を表示しない。成長feedbackはReached / Best / New Record。
- portrait準備を回転警告で塞がず、縦layoutを持つ。

### 7.2 初回・再訪フロー

```text
初回: Loadout（空でも基本武器で出撃可）→ CHAIN / DRAW選択
      → Run → Result → 同装備で再戦 / 装備・流派を見直す

再訪: Best Wave・3slot・armor・前回styleを確認
      → 同装備で出撃 / 見直す → Run → Result
```

styleを永続化しない場合は「このRunのstyle」と明記し、保存済みと誤認させない。

### 7.3 画面役割とCTA

| 画面 | 役割 | 主CTA | 副CTA | 情報優先 |
|---|---|---|---|---|
| Loadout | 準備 | 出撃/流派選択へ | acquire、armor、inventory | current setup/style→出撃→全inventory |
| Style | 戦い方の宣言 | CHAIN | DRAW（同格） | 効果＋一文説明 |
| Battle | 生存と攻撃 | ATK | movement、他action | HP/OUGI→実Wave→敵→次Boss→Best |
| Wave clear | 休息予告 | 自動2.2秒 | — | WAVE CLEAR→NEXT→BOSS IN n |
| Result | 記録理解 | 同装備で再戦 | 装備・流派を見直す | Reached→Best→New Record→CTA |

### 7.4 リズム

準備→style宣言→通常Wave→2.2秒休息→Boss/Swarm→敗北→Resultとする。永続成長はBestと事前loadout。Run pickupは一時的であることを明記する。

### 7.5 代表枠

- PC 800×600: HUD上部、battlefield中央、controls下端。Result中央card＋2 CTA横並び。
- 横800×450: HUD約68、左movement、右ATK主（約86径）＋secondary controls。
- 縦450×800: HUD約98、battlefield、objective540–598、controls606以降。Styleは縦stack、Loadoutはscroll/page、Result CTAは縦stack。

### 7.6 素材・パーツ

| 区分 | パーツ | 仕様 |
|---|---|---|
| 流用 | forest background | 1600×900、runtime 1920×1080 |
| 流用 | hero | raw640×320、runtime260×130、center origin・足位置固定 |
| 流用 | boss | raw576×384、runtime300×200、body/feet基準 |
| 流用 | enemies / FX / portraits / icons | 現行runtimeを維持 |
| code-native | real Wave、next boss、Best、style cards、Result 2 CTA、inventory pager | normal/pressed/selected/focus |
| 任意P1 | dedicated hurt hero | 640×320透明、runtime260×130、同じ足pivot |

P0に新規ラスターは不要。

### 7.7 保存とDone

- Loadout変更は即保存し、10件以上のinventory全てへ到達できる。
- Run-only pickupは中断で失われることを明記し、中断でBest/currencyを更新しない。
- gameoverは1回だけ、Bestは単調増加、Result連打で遷移・報酬を二重実行しない。
- 再戦は保存loadoutを再利用し、見直しは同じ状態のLoadoutへ戻る。
- storage破損fallback。保存失敗でfreezeせず通知し、状態を壊さない。
- 初回準備→style→battle、Result→retry、Result→review、10件超inventory、回転、連打、reloadを可視E2Eにする。

### 7.8 確認が必要な既存契約

- 防具の「Runごと購入」という説明と、同条件retryで再課金されない挙動のどちらを正とするか。
- 戦闘後通貨報酬がないため、初期500を消費した後の経済停滞を許容するか。報酬追加は新しいバランス仕様として別承認にする。

---

## 8. 素材制作バックログ

### 8.1 先に行うもの

P0は全タイトルとも新規ラスターなしで進められる。先に必要なのは、実値の単一source化、CTA導線、縦横同機能化、保存・二重処理防止、code-native UI状態である。

### 8.2 方向承認後に制作候補とするもの

| 優先 | タイトル | 候補 | 必須度 |
|---:|---|---|---|
| P1 | Color | mascot correct/miss、result medal | 任意。feedback強化 |
| P1 | Fist | fighter状態差分、collection thumbnails、move icons | 任意。戦闘と図鑑の視認性 |
| P1 | Karma | 年次章扉背景 | 任意。既存結果絵で代替可 |
| P1 | Potion | なし | 既存素材で充足 |
| P1 | Sangoku | role/reward/route icons、settlement emblem | 任意。判断の速さ向上 |
| P1 | Side | hurt hero | 任意。被弾feedback |

制作時は、背景、キャラ、UI、FXを別ファイルにし、同一キャラの状態差分は同一canvas・同一pivot・同一silhouetteで作る。文字、数値、Grade、費用、報酬を画像に焼き込まない。

## 9. 実装へ進む前の確認事項

次の判断を確認した後に、コード改善と素材制作を開始する。

1. この文書のP0方針を6タイトル共通の実装基準としてよいか。
2. Fistの最小Collection保存をP0に含めるか、導線修正だけに留めるか。
3. Karmaの途中saveは今回は採用せず、別仕様・別PRのままでよいか。
4. Sideの防具契約は「購入は永続して同条件retry無料」か「各Runで再購入」か。
5. Sideの戦闘後通貨報酬は今回は追加しない方針でよいか。
6. P1素材はどのタイトルから制作するか。現状はいずれもP0必須ではない。

## 10. 承認後の推奨順序

1. 実値・精算・objective・表示用view modelを単一sourceへ統合
2. 初回/再訪/結果CTAと縦横の機能差を修正
3. 保存、中断、失敗、連打、回転のguardを実装
4. 可視CTA中心のunit/E2Eと代表画面QAを追加
5. P0完了後、承認されたP1素材を分離仕様で制作

この順序なら、素材制作前に画面の役割と必要寸法が確定し、重複生成やモック専用UIの再発を避けられる。

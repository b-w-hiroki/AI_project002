# 覇拳伝 — 実装設計書

初版確認日: 2026-10-19。実装基準: `c975eab`（PR #347までを含む作業ツリー。公開状態ではない）。
更新時は変更箇所と [変更記録](../../updates) を同じPRで更新する。運用は [文書更新手順](../../documentation-workflow.md)。
対になる文書: [仕様書](spec.md)。

## 起動と責務
[main.ts](../../../games/fist-legend/src/main.ts) は presentation / conceptArt / mobileLayout / hajaMode / artFidelity / visualPolish を組み込む。GameSceneの既存挙動をラップするため順序に注意する。
[battle](../../../games/fist-legend/src/logic/battle.ts) は相性、ダメージ、ゲージ、HPを扱う。
[team](../../../games/fist-legend/src/logic/team.ts)、[teamTactics](../../../games/fist-legend/src/logic/teamTactics.ts)、[opponent](../../../games/fist-legend/src/logic/opponent.ts)、[story](../../../games/fist-legend/src/logic/story.ts) が編成・相手・進行を担当。

## 戦闘補正
[haja](../../../games/fist-legend/src/logic/haja.ts) は通常戦闘の解決後に差分を補正する。三すくみの本体を置き換えない。
剛は与ダメージ+40%、柔は被ダメージ50%軽減、瞬は奥義加速と硬直短縮。持続は5000ms。
タイマー、交代、演出を跨いだ同一操作の二重適用を避ける。

## 永続化と描画
ホームは [ui/titleView.ts](../../../games/fist-legend/src/ui/titleView.ts) が生成・描画を担当する。mobileLayoutはSceneとViewの接続役として、TitleModel（編成・相手・通貨・勝利数）とTitleActions（選択・編成変更・各モード開始）を渡す。Viewから保存APIやGameSceneを直接呼び出さない。

タイトル専用の背景・イラスト・操作レイヤーを持ち、モデル・言語・画面寸法が変わった場合だけレイアウトと描画を更新する。title以外では専用レイヤーをすべて隠す。既存テクスチャfl-bg-arena/fl-hero-fighterを再利用し、背景はcover、主人公は高さ基準の均等スケールで配置する。テクスチャ欠損時は単色背景を残す。

文字とボタンは [ui/controls.ts](../../../games/fist-legend/src/ui/controls.ts) に分離し、ホーム・戦闘・結果が同じ部品を利用する。44px相当を目安にする既存ヒット領域と押下演出を維持する。共通レスポンシブ基盤は引き続きgames/shared/mobileを使う。
320×568の短い縦画面ではモード選択と通常技のヒット領域に72論理pxの最小高さを指定し、実表示で44px以上を確保する。相手選択など、縦方向の間隔が狭いボタンにはこの拡張を適用しない。縦画面の日本語モード説明は23論理pxとし、320px幅で実表示14px以上と所持情報まで8論理px以上の間隔を検査する。英語は長い文の折り返しを考慮して16論理pxを維持し、日本語より6論理px上に置いて所持情報との間隔を確保する。

結果画面は [ui/resultView.ts](../../../games/fist-legend/src/ui/resultView.ts) が生成・描画を担当する。ResultModelは勝敗・報酬・残高・編成・モード進行を受け取り、再戦／次戦とタイトル復帰はResultActions経由でSceneへ渡す。Viewは保存APIとGameSceneに依存しない。勝敗別の人物の濃淡、編成に応じた再挑戦の案内、3連戦・ストーリーのボタン文言を維持する。
タブレット・デスクトップの旧結果表示もGameScene.finishBattleで実HPに基づくWIN/LOSE/K.O./DOWNとfinishReasonを設定する。理由文は独立したTextで勝敗見出しの間に置き、人物絵は暗い結果パネルの背面に描く。presentationの戦績帯は結果ボタンより下へ置く。1024×768の時間切れ勝敗をChromium・WebKitのE2Eと画像で検査する。
600×600では旧結果画面の800論理px幅が縮小されるため、理由文を20論理pxにし、英字勝敗表示をY=136へ上げる。最終表示14px以上と理由文の上下非重複をE2Eと実画面画像で検査する。
同画面の旧結果ボタンは主を64論理px・20論理px文字でY=355、副を62論理px・20論理px文字でY=430に置く。最終タッチ領域44px以上、文字14px以上、ボタン間と戦績帯との非重複、下端側の実タップによる再挑戦とタイトル復帰をE2Eで確認する。
結果の次行動案内は縦持ちで27論理px、横持ちで15論理pxとし、320×568のCanvas最終縮小後も実表示で14px相当以上を確保する。短い縦画面の引き分け・敗北で画面左右、報酬、人物、主ボタンとの非重複をE2Eで検査する。
3連戦の3勝目と物語の最終章の勝利では、ResultViewの案内を通常の進行数からクリア表示へ切り替える。未完了や敗北では従来の進行数を残し、主ボタンの再演・再挑戦動作は変えない。320×568の完了結果をE2Eと実画面画像で確認する。handleResultPrimaryはphaseがresultのときだけ処理し、ボタンの短い押下遅延中に複数回入力されても最初の遷移後の入力を無視する。
3連戦の敗北・引き分け後はstartSeriesが1人目から始めるため、結果の戦術案内はlogic/opponentのretryTargetOpponentで同じ相手を参照する。Sceneの旧結果表示とスマホResultViewの双方に適用し、320×568の2戦目敗北から1戦目への再挑戦をE2Eと画像で確認する。
結果の決着理由は縦持ちで26論理pxとし、320×568のCanvas最終縮小後も実表示で14px相当以上を確保する。勝敗の英字見出しを縦持ちでY=179へ置き、決着理由と結果見出しの文字境界を分離する。時間切れ時のHP比較が画面左右に収まり、上下の見出しに重ならないことをE2Eで検査する。
英語の結果報酬枠ではラベルと所持数を17論理pxで上段に置き、下段の獲得報酬額と分離する。上段の文字に装飾線を重ねない。320×568で両ラベルが実表示10px相当以上、互いと報酬額に重ならず、報酬額が枠内に収まることをE2Eで検査する。日本語の文字サイズ・所持数位置・装飾線は維持する。
ResultViewは勝利以外かつ相性有利の得意者が編成にいない場合だけ、補助ボタンを「編成を変える」に表示変更し、既存のtitleコールバックでホームの編成選択へ戻す。入力Zoneは72論理pxで320×568の実表示44px相当以上とし、主ボタンと重ねない。主ボタンの再挑戦は従来どおりとする。

人物の均等スケールは [ui/art.ts](../../../games/fist-legend/src/ui/art.ts) で戦闘と結果から共用する。結果背景も縦横比を保つcover表示とし、画面比率に合わせた引き延ばしはしない。

戦闘HUDと操作は [ui/battleView.ts](../../../games/fist-legend/src/ui/battleView.ts) が生成・描画を担当する。BattleModelは読み取り用HP・奥義ゲージ、相手、編成・出場者、予兆、残り時間、応酬数を受け取る。BattleActionsは通常技・奥義・交代を既存のSceneへ渡す。ViewはGameSceneや保存APIへ直接依存しない。時間・ゲージ・予兆が変わるため、戦闘は従来どおりフレームごとに更新する。
縦持ちの最上段は自分HP・残り秒数・相手HPを独立した3つの文字オブジェクトに分け、23論理pxで同じ行に表示する。320px幅では実表示14px以上、左右余白8論理px以上、各項目の非重複、HPバーの上端まで重ならないことを検査する。ゲージの行は縦持ちで16論理px、横持ちで14論理pxとし、日本語では編成・応酬数・準備完了を日本語で表す。横持ちの詳細な出場者・相手情報は維持する。
縦持ちで再利用する奥義ボタンの入力Zoneは最小72論理pxとし、320×568の実表示で44px相当以上を確保する。上段の蹴ボタンとのヒット領域の間隔を残し、ゲージ満タン時に拡張した下端側のタップが奥義として受理されることをE2Eで検査する。満タンかつSceneが入力受付中の時だけボタン外周に静的な金色の枠を表示し、攻撃直後の入力待ち時間と奥義使用後は消す。通常技の案内枠とは別のGraphicsを使い、縦横どちらでも実際の奥義ボタン位置に追従する。

mobileLayoutはホーム・戦闘・結果Viewを生成してScene状態と接続し、表示切替と共通レスポンシブ基盤への接続を担当する。実際の戦闘人物の配置はScene側のスプライトを扱うため接続側に残し、戦闘判定・攻撃演出をViewへ移さない。

スマホ用の主要3画面はView分離済み。ガチャはSceneが生成と操作を保持し、[ui/gachaLayout.ts](../../../games/fist-legend/src/ui/gachaLayout.ts)が既存ノードの縦持ち配置と回転時の復元を担当する。人物画像は均等スケール、ボタンの縦持ちヒット領域は68論理pxへ拡張する。デスクトップ用既存画面、prototypeラップによる接続、他作品は移行対象外として残る。全作品のUI移行済みとは扱わない。

[logic/playGuide.ts](../../../games/fist-legend/src/logic/playGuide.ts)が最初の3応酬の案内と決着理由を作る。相性はteamTacticalReadの既存対応を再利用し、戦闘ルールや保存を変更しない。ResultModelへ実際のplayerHp/enemyHpを渡し、HPが残る時間判定をK.O.と誤表示しない。ホームのモード説明と案内は日本語・英語に対応する。
スマホ戦闘Viewは同じteamTacticalReadから有利な通常技を求め、最初の3応酬だけ該当ボタンの外周に静的な金色の枠を描く。4応酬目以降は枠を隠し、文章による三すくみ表示を残す。
縦持ちの予兆・有利技の2行案内は23論理pxとし、320×568の最終Canvas縮小後も実表示14px相当以上を確保する。日本語・英語とも文字境界が案内枠内に収まることをE2Eで検査する。横持ちは20論理pxを維持する。
4応酬目以降の三すくみ説明は左側が右側に有利と分かる「有利:」／「Beats:」を先頭に付ける。縦画面の案内枠と縁取りをともに380論理px幅にし、日英の320×568 E2Eと実画面画像で文字の余白を確認する。[presentation.ts](../../../games/fist-legend/src/presentation.ts) の読み勝ち・読み負け演出は現在のカメラ寸法で描画し、縦画面の文字をHUDと案内枠の間に収める。勝ち・負けの画面境界を別々の実画面画像で検査する。
縦画面の案内枠を高さ95論理px、文字の折り返し幅を340論理pxにし、Linux WebKitの英語文字幅でも左右55論理px以上の余白を確保する。結果見出しを5論理px下げ、英語の次の行動を20論理px下げて理由・報酬との間隔を確保する。英語の報酬欄は所持数を4論理px上げ、獲得額を14論理px左へ寄せて枠内に収める。
[progress](../../../games/fist-legend/src/logic/progress.ts): fist_legend_currency_v1 / fist_legend_win_count_v1 / fist_legend_team_v1 / fist_legend_story_progress_v1。
[gacha](../../../games/fist-legend/src/logic/gacha.ts) は排出率と抽選の純粋ロジック。GameSceneのrollGachaが通貨を消費して結果を表示する。gacha.ts自体に保存処理はない。
WebKitはCanvas fallback、その他はAUTO。回転後の描画消失と操作座標を両方検査する。
600×600のタブレット戦闘では旧Canvasの通常技を高さ62論理px、奥義・交代を高さ62論理pxかつ文字20論理pxにする。上下列は間隔を残す。横幅800px未満ではconceptArt・visualPolish・presentationの重複する装飾HUDを表示せず、旧HUDの予兆案内の背面に半透明の面を置く。WebKit E2Eで実表示44px以上の入力領域、14px以上の文字、列の非重複、拳の実タップを検査する。
旧HUDの案内文はGameScene.updateLegacyTellCopyで更新し、600〜799pxのタブレットでは21論理pxの文字でexchangeGuideから最初の3応酬の有利技と4応酬目以降の三すくみを表示する。mobileLayoutの幅切替時にも文面を更新する。800px以上の既存案内と承認モックの文面は維持し、600×600の日英E2Eで案内面内の文字境界と幅切替後の更新を検査する。
同じ条件の最初の3応酬では旧HUDのlegacyCounterRingをteamTacticalReadが示す技ボタンの外周に表示する。予兆・画面幅・応酬の変更で表示位置と可視性を更新し、4応酬目以降は消す。WebKit E2Eで日英の初期位置、予兆変更、幅切替、案内終了を検査する。

## 検証と参照
[tests](../../../games/fist-legend/tests)、[E2E](../../../games/fist-legend/e2e/game.spec.ts)、[覇者E2E](../../../games/fist-legend/e2e/haja.spec.ts)。
[構想資料](../../design/redesign-fist-legend.md) と本書の現行動作を区別する。

## 確認範囲・保留
現行コードと既存テストを照合した仕様の初版。本作の全機能を今回再プレイしたという意味ではない。
実機・外部Portal・公開の合否は [リリース資料](../../../RELEASE-CANDIDATE.md) と個別QA記録を参照する。

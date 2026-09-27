# CrazyGames 最終提出シート（2026-09-24）

## 0. 現在地

- release candidate: **v1.0.0-rc.1**
- source: main
- Browser E2E / WebKit Smoke / CrazyGames Readiness / CrazyGames Marketing Assets / GitHub Pages は、**mainの最新成功run**を使用する
- open PR: 0を投稿前に確認
- コード側の追加修正: Portal Previewで差異が出た場合のみ

## 1. 使用する最新artifact

### 投稿ZIP
**最新成功の Deploy to GitHub Pages run** にある `game-release-packages` を使用する。
- 6作品ZIP
- `BUILD-INFO.txt`
- `SHA256SUMS.txt`

古いartifact IDを固定参照しない。投稿直前にmain最新runのBUILD-INFOとcommitを確認する。

### Marketing Assets
**最新成功の CrazyGames Marketing Assets run** の各作品artifactを使用する。
- color-match-crazygames-marketing
- fist-legend-crazygames-marketing
- karma-quest-crazygames-marketing
- potion-workshop-crazygames-marketing
- sangoku-tap-crazygames-marketing
- side-scroller-crazygames-marketing

各作品に以下を含む。
- Landscape cover: 1920x1080
- Portrait cover: 800x1200
- Square cover: 800x800
- Landscape preview: 15〜20秒
- Portrait preview: 15〜20秒

## 2. 投稿順

問題切り分けをしやすくするため、軽量作品から順に登録する。

1. Color Match
2. Fist Legend
3. Potion Workshop
4. Side-scroller / Sword Forest
5. Sangoku Tap
6. Karma Quest

Karma Questはrelease ZIPが約66MBのため最後に確認する。2026-09-27の重複資産整理で約94MB→66MBへ削減済み。自動計測上の初期downloadは3.25MBで基準内。

## 3. 作品別登録情報

| Game | Portal title | Source folder | Marketing artifact | Tags |
| --- | --- | --- | --- | --- |
| Color Match | Color Match | `color-match` | `color-match-crazygames-marketing` | Puzzle, Brain Training, Casual, Reaction |
| Fist Legend | Fist Legend | `fist-legend` | `fist-legend-crazygames-marketing` | Fighting, Action, Arcade |
| Potion Workshop | Potion Workshop | `potion-workshop` | `potion-workshop-crazygames-marketing` | Idle, Clicker, Incremental, Casual |
| Sword Forest | Sword Forest | `side-scroller` | `side-scroller-crazygames-marketing` | Action, Survival, RPG |
| Sangoku Tap | Sangoku Tap | `sangoku-tap` | `sangoku-tap-crazygames-marketing` | Idle, Clicker, RPG, Casual |
| Karma Quest | Karma Quest | `karma-quest` | `karma-quest-crazygames-marketing` | RPG, Idle, Strategy, Casual |

英語Descriptionは `docs/submission.md` の各作品欄をそのまま使用する。

## 4. 1作品ごとのDeveloper Portal手順

各作品で以下を順に実施する。

- [ ] 新規ゲーム登録
- [ ] Titleを入力
- [ ] English Descriptionを入力
- [ ] Tags / Categoryを設定
- [ ] 対応デバイスをPC + Mobileとして設定
- [ ] 対象ZIPをアップロード
- [ ] Landscape / Portrait / Square coverを登録
- [ ] Landscape / Portrait previewを登録
- [ ] Portal Previewを起動
- [ ] 英語localeで起動する
- [ ] SDK初期化エラーがない
- [ ] Canvasがiframe内に収まる
- [ ] 初期downloadが50MB以下
- [ ] 主操作が完走できる
- [ ] 日本語文字の意図しない残存がない
- [ ] cover / previewの文字切れ・はみ出しがない
- [ ] PEGI 12相当の回答を確認
- [ ] Submit
- [ ] 審査URLをIssue #98へ記録

## 5. Portal Preview重点確認

### Color Match
- 英語見出しがカード内に収まる
- WORD MEANING / INK COLOR表示
- ドラッグ操作
- Turbo / Practice導線

### Fist Legend
- 英語タイトル/外枠
- 3人編成
- 戦闘中交代
- 奥義

### Potion Workshop
- locale切替
- Brew / 設備購入
- 街選択
- Ascension

### Sword Forest
- 仮想スティック
- Attack / Guard
- 武器切替
- 戦闘画面の収まり

### Sangoku Tap
- 編成
- 出陣
- 地域イベント
- 守将画面

### Karma Quest
- Home → Request → Battle → Report → Next Year
- 英語前面UI
- 縦画面での収まり
- release ZIP約66MBでも初期downloadが基準内かPortal実測

## 6. 自動検証済みのため再確認不要な項目

- 英語fallback実装
- CrazyGames SDK locale連動
- 主要iframeサイズ
- body user-select無効
- cross-promotion / custom fullscreen / window.open禁止UI
- 6作品の初期download自動計測
- cover 18枚の寸法
- preview 12本の時間・無音・50MB未満
- Chromium / WebKit主要フロー

Portal上で差異が出た場合のみコード側Issueへ戻す。

## 7. Issue #98 記録テンプレート

| Game | Submitted | Review URL | Public URL | Result | Platform feedback |
| --- | --- | --- | --- | --- | --- |
| Color Match |  |  |  |  |  |
| Fist Legend |  |  |  |  |  |
| Potion Workshop |  |  |  |  |  |
| Sword Forest |  |  |  |  |  |
| Sangoku Tap |  |  |  |  |  |
| Karma Quest |  |  |  |  |  |

## 8. 完了条件

CrazyGames:
- 6作品すべてPortal Preview通過
- PEGI確認完了
- 6作品すべてSubmit
- Issue #98へ審査URL / 公開URL / 結果を記録
- プラットフォーム固有修正が出た場合は個別Issue化

PLiCy:
- アカウント作成
- 6作品登録
- 公開URLをIssue #98へ記録

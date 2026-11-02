# PR #412 独立QA — 2026-10-27

## 対象と証拠

- 旧head: `06bef831dac534834099320175a4e196d5c92ad8`。
- [WebKit Smoke](https://github.com/b-w-hiroki/AI_project002/actions/runs/40424550151): 6ジョブ成功。
- [Browser E2E](https://github.com/b-w-hiroki/AI_project002/actions/runs/40424550160)、[Documentation](https://github.com/b-w-hiroki/AI_project002/actions/runs/40424550055)、[positive-controls](https://github.com/b-w-hiroki/AI_project002/actions/runs/40424550052): 成功。
- 同headのWebKit artifact `12698394378` / `12698662998`をダウンロードし、日英600×600結果・武将一覧画像をコードと照合した。旧head CIを今回の追補のCI成功には流用しない。

## 発見と修正

ローカルChromiumで600×600結果のWIN境界下端180.60997と理由文上端178.5が重なる既存検査失敗を2回再現した。演出終了後も同じ境界だった。画像の字面は分離しているがフォント差で余裕が不足するため、勝敗文字をY=136から130へ6論理px上げた。案内文・報酬・ルールは維持した。

全件回帰では320×568にも理由文上端229と勝敗文字下端229.5の境界重複を検出した。縦持ちViewの勝敗文字を179から173へ6論理px上げた。検査閾値は緩和していない。

英語600×600にも案内の14px以上、画面内への収まり、理由文とWIN・主ボタンとの非重複、再戦の実タップ検査を追加した。三国の600×600日英には見出し・説明・所持装備・先頭行の間隔、説明の左右収まり、タイトル復帰の実タップ検査を追加した。

## ローカル検証

- 両作lint / typecheck / build: 成功。単体: 覇拳伝62件、三国69件成功。
- 覇拳伝Chromium全32件: 31成功、上記320×568の1件失敗。修正後、失敗1件と関連3件は4/4成功。全件の再実行は新head CIで検査する。
- 三国Chromium全16件: 成功。
- 600×600の覇拳伝理由文・案内・主副ボタン文字は14.55px相当。主64 / 副62論理pxの入力領域は46.56 / 45.105px相当。日本語の主ボタン下端寄りで再戦、敗北後の副ボタン下端寄りでタイトル復帰を確認。
- ローカルWebKit実行環境はないため、追補のWebKitはGitHub CIで確認する。

## 画像

- [日本語結果](../../games/fist-legend/e2e/screenshots/small-tablet-result-time-win.png)
- [英語結果](../../games/fist-legend/e2e/screenshots/small-tablet-result-time-win-english.png)
- [短い縦画面の決着理由](../../games/fist-legend/e2e/screenshots/compact-portrait-result-hp-reason.png)
- [日本語武将一覧600×600](../../games/sangoku-tap/e2e/screenshots/compact-tablet-roster-ja.png)
- [英語武将一覧600×600](../../games/sangoku-tap/e2e/screenshots/compact-tablet-roster-en.png)

## 未達・ドラフト維持

600×600の三国武将一覧は従来の450×800全体を縮小する。ローカルChromiumで説明/所持装備は約11.64px、62論理pxの武将行は約40.09pxだった。間隔と復帰操作は成功したが、推奨44px操作領域と可読性には懸念が残る。8行の全件表示を維持したまま文字・行を拡大すると既存モックの縦構成に影響するため、ページ分割等の別の配置判断が必要。今回の間隔修正の合格で解決済みにしない。

物理iOS Safari、Android Chrome、人による初見プレイ、外部Portal Previewは未確認。初見試行の結果をAIの画面検査で代用しない。PRをドラフトのまま維持する。

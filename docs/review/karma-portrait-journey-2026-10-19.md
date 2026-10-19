# 縦画面の討伐・報告の仕上げ

対象: Karma Quest、日本語の縦450×800表示。今回のコードは `8d2a201`。

## 改善内容

- 討伐: 既存勇者バストアップを大きく表示し、能力・結果・声援を金枠と羊皮紙で整理。
- 報告: 羊皮紙の記録面、出来事と神様の選択印、既存評価のプレビューを配置。
- 新規画像なし。GameSceneの進行・声援・選択上限・報酬確定を再利用。

## ローカル確認

- lint、typecheck、build成功。単体14ファイル109件成功。
- Chromium: 討伐・報告画像、報告操作、横画面との回転、12年通しの5件成功。
- WebKit: 同じ対象5件を確認。追加した報告テストは、初期操作と回転後操作を描画より先に実行して失敗したため、起動準備と描画フレーム待ちを整え、再実行で成功。
- 英語の表示・開始の回帰2件成功。
- 報告操作: 320px幅で未選択送信防止、2件上限、解除、4行目選択、神様変更、縦横回転、送信を確認。
- Windows Chromium/WebKitの討伐・報告PNGを目視確認。
- Linux初回 [run 39218547912](https://github.com/b-w-hiroki/AI_project002/actions/runs/39218547912): 46件成功、変更前の討伐・報告画像基準2件が不一致。アップロードされた実画像を目視してOS固有の基準を更新。許容差は変更していない。
- Linux再検証 [run 39219639308](https://github.com/b-w-hiroki/AI_project002/actions/runs/39219639308)、head `a64026e`: **48件すべて成功（10.6分）**。

## 限界

確認画像: [討伐・WebKit](../../games/karma-quest/e2e/game.spec.ts-snapshots/karma-battle-mock-webkit-win32.png)、[報告・WebKit](../../games/karma-quest/e2e/game.spec.ts-snapshots/karma-report-mock-webkit-win32.png)。

物理端末、外部Portal未確認。モック完全一致の認定ではない。討伐の背景と演出、実機での最終可読性は引き続き改善候補。

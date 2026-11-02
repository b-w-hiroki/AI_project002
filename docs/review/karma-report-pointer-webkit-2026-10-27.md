# Karma Quest 報告のポインター所有者 — WebKit CI 記録

PR #412 の head `bbaff48adf658e82e8b3ce9be6929cc905a5bf38` に対する [WebKit Smoke](https://github.com/b-w-hiroki/AI_project002/actions/runs/40450521281) の初回では、報告のポインター所有者テストが選択解除を期待した時点で選択数1のままになり、51件成功・1件失敗となった。失敗時に遅延したresizeや入力中断が起きたかの記録はなく、原因は確定できない。

同じheadの失敗ジョブ単体の再実行では52件が成功した。WindowsのローカルWebKitで該当テストを5回繰り返し、5回とも成功した。これは断続的な失敗の解消や物理端末での動作を示すものではない。

再発時は入力ごとのポインターID、選択状態、resize・blur・hiddenの発生時刻を取得し、所有者解除と選択操作のどちらが影響したかを確かめる。既存のbattle→report時間切れの調査とは別件として扱う。

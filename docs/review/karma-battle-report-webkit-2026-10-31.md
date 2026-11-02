# Karma Quest battle → report — WebKit CI 調査

PR #412 の head `765dd88267d5825e3d24876e43b0597c6aac1aab` に対する [WebKit Smoke](https://github.com/b-w-hiroki/AI_project002/actions/runs/41163041865/job/124424577222) で、最高到達の保存テストがbattleからreportへ５秒以内に遷移せず、51件成功・１件失敗した。成果物の診断では、待機前後ともページはvisible・focusedでシーンはactive、フレームは43から123に進んだが、戦闘結果は未確定だった。旧診断はタイマー一覧を誤ったプロパティ名で参照しており、経過時間を取得できていない。

WindowsのローカルWebKitでは同じテスト３回中１回で５秒判定に失敗し、その後の３回は成功した。[失敗時の診断](karma-battle-report-webkit-2026-10-31.json)では、待機前の1800msタイマー経過83msに対し、約4.1秒後には1800msに達し戦闘結果が確定していた。その時点で次のタイマーが挿入待ちだった。フレームは28から130へ進み、観測時のactualFpsは約23.6だった。CIの戦闘結果未確定とは状態が異なるため、同一原因と断定しない。

PhaserのTimeStepは起動直後のクールダウン中、フレームdeltaを目標値以下に抑える。低フレームレートではゲーム内タイマーが実時間より遅く進む可能性があり、今回のローカル計測とは整合するが、失敗時のクールダウン値は未取得で確定できない。

追加の限定実験では、同じローカルWebKitで起動直後に1800msのシーンタイマーを作り、４秒間観測した。通常フレームでは約1843msで完了した。`requestAnimationFrame`のコールバックを人為的に40ms遅らせた別試行では、実時間4003msでタイマー経過1017ms、未完了、フレーム62、クールダウン58、rawDelta約62ms・平滑化後delta約17msだった。意図的な低フレーム条件で起動直後のゲーム内時間が実時間より遅れることを示すが、CIで同じ条件だった証拠ではない。実験は表示や製品コードを変更せず、物理端末の測定でもない。

診断の参照をPhaserの`_active`に直し、各タイマーのdelay・elapsed・pause状態とフレームのdelta・rawDelta・actualFps・クールダウンを記録する。期待するreport遷移と５秒の判定は変更していない。同じheadの失敗ジョブは再実行で成功したが、初回の原因は特定できていない。再発時はタイマーが進んでいるか、戦闘結果確定後の700ms待ちか、フレームと時間の関係を照合する。物理端末の結果ではない。

## 2026-11-01: 時間の責務と追加検証

初回失敗jobのログを再取得し、attempt 1のartifact **13027739502**を直接照合した（ZIP SHA256 `399272c87cb9487641125a340a30e2704101a186064ae796053b78baf839f6fc`）。同じrunの再実行artifact **13029300473**とは別物。初回のbefore/afterはwallTime 5167→9199ms、frame 43→123、sceneTime 5125→9157、結果未確定である。したがって最後の診断観測は約4032ms後であり、「5000msの期限超過」ログだけから5000ms時点の状態を断定できない。Playwright既定のpoll間隔は100/250/500/1000msに広がるため、期限直前に未観測の区間がある。

### 確認した実装

- `showBattlePhase`は1800msのScene Timerで声援を締め切り、同期の`autoBattle`で結果を確定する。音・カメラ・SDK通知・テキスト更新の後、700msのScene Timerを新規登録し、報告へ進む。ネットワーク応答待ちはこの経路にない。途中の例外や重い同期処理は競合仮説として残る。
- lockfileで解決されたPhaserの`src/time/Clock.js`では、`now`は入力フレームのtimestampであり、タイマーの累積時間ではない。TimerEvent.elapsedは`delta × Clock.timeScale × TimerEvent.timeScale`で進む。Clock.nowの実時間との一致だけではタイマーの正常進行を証明できない。
- `src/core/TimeStep.js`はrawDeltaを記録後、smoothStepが有効ならcooldown中またはinFocus=falseでdeltaを目標値以下に制限し、履歴で平均化する。visible/focusedの前後2点だけでは途中の中断・再クールダウンを除外できない。
- 新規タイマーは`_pendingInsertion`から次フレームのpreUpdateで`_active`へ移る。結果確定時の700msタイマー挿入待ちは通常の境界でも発生し、単独でデッドロックの証拠にはならない。

### 仮説と反証に必要な証拠

| 仮説 | 支持する観測 | 次回の判定材料 |
| --- | --- | --- |
| 低FPS＋時間補正で1800msに未到達 | 人為的RAF遅延の過去実験と整合。初回CIは80フレーム/約4秒 | rawTotalとdeltaTotal、cooldown、1800msタイマーelapsedの時系列 |
| 結果確定後の700ms待機が遅い | ローカル失敗は結果確定済み | 結果確定とreportのmilestone、700msのpending→active→elapsed |
| 非表示・フォーカス喪失・Scene停止 | 初回CIの前後はvisible/focused/activeで、支持なし | visibility/blur/focusイベント履歴、loopFocus、Clock/Sceneのpause・scale |
| 結果確定処理中の例外・長時間処理 | 初回CIは未確定で直接の証拠なし | page/console errors、結果確定済みなのに700msタイマー不在、最大フレーム間隔 |
| pollが期限前の遷移を取り逃す | 初回最終観測は約4032ms後 | report milestoneの実時間とpoll失敗を比較。期限は5000msを維持し100ms間隔へ変更 |

### 追加する限定検証

製品コードを変更せず、E2E専用`battleTiming.ts`で各postupdateのrawDelta・delta・Clock補正後deltaを累積する。100msごとの最大80サンプルと状態変化のmilestone、タイマー3キューのdelay/elapsed/hasDispatched、途中の中断、最大フレーム間隔を保存する。成功時も保存して失敗との比較に使う。監視開始は既存のreport待機直前なので戦闘開始からの全時間ではなく、initialのタイマーelapsedも合わせて読む。TimerEvent固有timeScaleは各タイマーの値を参照する。

対照試験は40msのRAF遅延と120フレームの合成cooldownを両ケースへ与え、smoothStepだけを切り替える。3500msの固定観測窓で、補正有効時のゲーム時間の遅れと、無効時の1800ms→700ms→reportを比較する。これは時間補正機構を分離するテストであり、初回CIの再現でもsmoothStep無効化の製品採用判断でもない。通常の最高到達テスト・12年通しは製品の時間設定と5秒条件を維持する。

ローカルのlint・typecheck・157単体テスト・buildは成功。ローカルChromiumはブラウザ起動時のsocket権限制限で未実行、WebKitは未設置のため未実行。追加コードのブラウザ合否は本PRの独立したChromium/WebKit CIで確認する。初回CIの根本原因は未確定のまま。

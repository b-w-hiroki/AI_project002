# Karma Quest 最新mainの実装再点検

対象基点: `bb25bf3`。リモートmainと一致、作業開始時の未保存変更なし。共通Studio PlaybookのREADME・IMPLEMENTATIONと、作品のCLAUDE・release gate・QA template・retention方針を確認。Windows / Node 24.11.1 / npm 11.6.2で、既存lockfileに対してnpm ciを実施した。未統合の依存更新PR #330は取り込んでいない。

## 発見・対応

1. **SDKの無期限待機でゲームが起動しない**: mainはSDK初期化をawaitするが、スクリプト取得とSDK.initにタイムアウトがなかった。応答を保留する単体テスト2件で修正前の失敗を確認。合計8秒の期限を設け、失敗時は既存の単体ゲーム動作へ戻す。遅れて完了したSDKから言語・フックが有効にならないよう、成功時だけ状態を確定する。通常の成功時の言語・連携は維持。
2. **開発依存の監査警告**: eslint→minimatch→brace-expansion 5.0.9にnpm audit high 1件。ランタイム依存ではない。PR #330のlockfileも5.0.9だったため、別の依存修正として扱う。

## 検証

- 変更前: typecheck / lint / 単体60件 / build / Chromium E2E38件成功。
- 変更後: typecheck / lint / 単体63件 / build成功。追加Chromium E2E1件成功。
- 変更後WebKit: CIと同じ6項目にSDK停止検査を加え7件成功。回転・音設定・選択・戦闘報告・段階読み込みと再試行を確認。
- 既存38件を変更後に再度一括実行したとは扱わない。通常起動、保存、リーグ・レイド、12年完走は基点の検査結果。
- 画面: [ホーム](karma-review-home-20261019.png)、[年代記](karma-review-final-20261019.png)、[SDK停止から復帰したWebKit会話](karma-sdk-timeout-webkit.png)。既存モック基準の画像比較は基点で成功。今回はUI・画像素材・ゲームループを変更していない。

対象はKarma Quest。全6作の最新テストを実行したという報告ではない。他作品にも類似SDKラッパーがあるため、横展開は各作品の検査を伴う別対応とする。実iPhone / Android、外部Portal Preview、実音・発熱は未確認。WebKit成功は実機合格ではない。

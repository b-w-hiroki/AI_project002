# 2026-09-07 mainと改修ZIPの統合確認

## 統合元

- GitHub main: `c0902db639bedcbfb5e42048295db2f9bc6461ce`
- 受領ZIPの完成コミット: `f9933bfedd1459850d93048fa65b1ec7875905f4`
- 共通基点: `078f19ae97db0eb8970c195a5485490295e0c1dd`

## 解決内容

- 剣戟: mainの1.5倍表示・当たり判定・ジャンプ-540・足場420・しゃがみ修正・演出位置を保持し、流派とボス挙動を合流。
- 工房: mainのヘッダー帯・設備カード・コスト/所持数表示を保持し、需要倍率・納品・評判・工房小物を合流。カードの生産量も需要倍率を反映。
- 他4作: ZIPの実装を適用。
- OGP、ハブサムネ、最新の戦闘ロジックと既存テストはmainを保持。
- ブラウザ検証スクリプトを通常の依存配置・既設Chrome指定に対応。三国の旧画面遷移を現行の地図導線に合わせた。

## 今回の結果と限界

- TypeScriptソース・ユニットテスト99ファイルをNode.jsのTypeScript変換パーサーで解析し、構文エラーなし。`syntax-results.json`参照。
- これは型検査・lint・Vitest・ビルドの成功を意味しない。
- ローカル依存パッケージの準備は実行環境の制約で完了できず、全テスト・ビルド・ブラウザ検証は未完了。
- 接続済みGitHubでのblob作成は403 `Resource not accessible by integration`。リモートブランチ・PR・Actions実行は未作成。
- `docs/review/`の既存画像・動画・325件/49件の成功記録は受領ZIPの過去記録であり、今回の統合後の実行結果ではない。

## 再実行

ネット接続と既設Chrome/Chromiumのある開発環境で、リポジトリ直下から実行:

```bash
GAME_CHROMIUM=/usr/bin/google-chrome bash scripts/verify-integration.sh
```

全6作品の依存取得、lint、型検査、Vitest、buildの後、主要画面・境界・三地域攻略を確認し画像を更新する。実機のタッチ操作・長期バランスは別途確認が必要。

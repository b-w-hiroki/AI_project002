# 設計判断ログ

## 2026-08-10
- 実行環境（ヘッドレスコンテナ、Playwright+Chromium あり、Unity/Unreal 不可）を踏まえ、ゲームはブラウザベース（HTML5/Canvas/JS）で開発する方針とした。
- セッション間で会話コンテキストは共有されないため、引き継ぎ情報はすべてリポジトリ内のファイル（CLAUDE.md / docs/）に残す運用とした。
- AI_project001 は現時点でこのセッションの GitHub 認証からアクセス不可。参照が必要な場合はアクセス権付与が必要。

- 販路戦略: 収益は CrazyGames（広告収益60%・非独占）、日本向け露出は PLiCy / GitHub Pages / X。unityroom は Unity/Godot 限定のため Phaser 製は投稿不可。日本には収益分配型ポータルがほぼ無い（アツマール終了済み）。
- ゲームは日英2言語対応（navigator.language で自動判定＋手動切替）。CrazyGames SDK はラッパー経由で、SDK が無い環境では no-op。

## 2026-08-11
- 転生システム: 累計100万調合で解放、エッセンス = floor(sqrt(累計/100万))、1個につき生産・クリック+10%（永続）。平方根スケールで転生を繰り返すほど周回が速くなる標準設計。
- GitHub Pages デプロイを GitHub Actions で自動化（main への push で typecheck→test→build→deploy）。vite base は './'。リポジトリ設定で Pages のソースを「GitHub Actions」にする必要あり（人間の作業）。

## 2026-08-12
- 実績システムは lifetimeBrewed/totalClicks/unlockedAchievements を転生時にも保持するフィールドとして追加（totalBrewed/potions/counts は転生でリセット、実績関連は永続）。
- クリック強化は既存の clickPower フィールドを購入のたびに+1する方式（コストは指数増加、baseCost 50 / growth 1.6）。新フィールドを増やさずシンプルに実装。
- サウンドは外部音源を使わず Web Audio API でその場合成（アセット0・軽量・著作権フリー）。AudioContext はユーザー操作後にのみ開始できるため遅延初期化。
- モバイル対応は Phaser の Scale.FIT + CENTER_BOTH のみで対応（タッチはPhaserのpointerイベントがマウス/タッチを統一的に扱うため追加実装不要）。ネイティブアプリ化はせず、あくまでブラウザのレスポンシブ対応に留める。
- typescript-eslint が TypeScript 7.x に未対応（2026-08時点、upstream issue #10940）のため、eslint実行時のみ typescript を 6.0.3 に固定。tsc本体（tsconfig経由のtypecheck）は引き続きプロジェクトのtypescriptバージョンに従う。
- OGP画像はPillow等の画像ライブラリが無い環境のため、Pythonのzlib/structで直接PNGバイトを生成した単色グラデーションのプレースホルダー。投稿前に差し替え推奨（docs/submission.mdに記載）。
- バンドルサイズ警告はPhaser本体が1.3MB超のため恒久的に発生する。manualChunksでアプリコードと分離してキャッシュ効率を上げた上で、chunkSizeWarningLimitを実態に合わせて調整（警告を黙らせるのではなく閾値を正しくする方針）。

## 2026-08-22
- 2本目のゲーム「剣戟の森」（横スクロールアクション、剣で敵を倒す）を追加。同一リポジトリ内 `games/side-scroller/` に完全独立の Phaser+TS+Vite プロジェクトとして配置（ルートのポーション工房とは node_modules/設定を共有しない）。既存の公開URL（ルート = ポーション工房）を壊さないため。
- 戦闘ロジック（ダメージ計算、無敵時間、攻撃クールダウン、射程判定、ゴール判定）は `src/logic/combat.ts` に純粋関数として分離し Vitest で単体テスト（19件）。Phaser 側の GameScene は物理演算・入力・描画のみを担当し、実際のダメージ判定はロジック層の関数呼び出しに委譲する設計は1本目のポーション工房と同じ方針を踏襲。
- スプライトは画像アセットを使わず Phaser の Graphics.generateTexture() でその場生成した単色矩形を使用（アセット0）。
- デプロイワークフローを拡張し、ルートと `games/side-scroller/` を両方ビルドして `dist/side-scroller/` にマージしてから Pages にアップロード。同じ GitHub Pages サイト配下に `/` と `/side-scroller/` として共存させる。
- 動作確認で「攻撃が敵に当たらない」ように見えた事象は、Playwright の `keyboard.press()` が非常に短い合成イベントで Phaser の JustDown 判定を取りこぼすケースがあったことと、敵の徘徊AIによりプレイヤーの向きに対して射程外に出ていたことが原因で、戦闘ロジック自体にバグは無かった（`keyboard.down()`/`up()` を分けて呼ぶテストで撃破・スコア加算まで確認済み）。

## 2026-08-24
- ポーション工房をリポジトリ直下から `games/potion-workshop/` に移動し、剣戟の森と構成を統一（両方とも `games/<name>/` の独立プロジェクト）。
- リポジトリ直下は Node プロジェクトをやめ、静的なゲーム一覧ハブページ（`index.html` 1枚、ビルド不要）に変更。旧ルートURL（ポーション工房が直接表示）は `/potion-workshop/` に変わる（今回は既存URLの互換維持よりも構成の一貫性を優先）。
- deploy.yml は両ゲームをビルドしてそれぞれ `/potion-workshop/`・`/side-scroller/` サブパスに配置し、ハブページと合わせて1つの dist にまとめてから Pages にアップロードする方式に変更。

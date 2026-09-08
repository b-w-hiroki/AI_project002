# AI_project002

AIフル活用でゲーム開発

ルート（https://b-w-hiroki.github.io/AI_project002/）はゲーム一覧のハブページ。

## 収録ゲーム

| ゲーム | 説明 | 公開URL | ソース |
|---|---|---|---|
| 🧪 ポーション工房 | 放置・育成ゲーム | https://b-w-hiroki.github.io/AI_project002/potion-workshop/ | `games/potion-workshop/` |
| ⚔️ 剣戟の森 | 剣で敵を倒す横スクロールアクション | https://b-w-hiroki.github.io/AI_project002/side-scroller/ | `games/side-scroller/` |
| 🎴 カラーマッチ | 文字の内容・色とカードを素早く一致させる認知力・反応速度ゲーム | https://b-w-hiroki.github.io/AI_project002/color-match/ | `games/color-match/` |
| 👊 覇拳伝 | 拳・蹴・気の3ボタンとじゃんけん相性、奥義ゲージで戦う格闘バトル | https://b-w-hiroki.github.io/AI_project002/fist-legend/ | `games/fist-legend/` |
| 🗡️ カルマクエスト | カルマ育成×討伐×神様への報告のサイクルで進める育成RPG | https://b-w-hiroki.github.io/AI_project002/karma-quest/ | `games/karma-quest/` |
| 🐎 三国ポチポチ | タップ進撃×武将ガチャ×装備合成のポチポチ系タップRPG | https://b-w-hiroki.github.io/AI_project002/sangoku-tap/ | `games/sangoku-tap/` |

各ゲームは独立した Phaser + TypeScript + Vite プロジェクト。開発ルールは `CLAUDE.md` を参照。

## ゲーム性・ビジュアル統合改修（2026-09-06）

- [統合設計と今回の実装範囲](docs/design/game-evolution.md)
- [画面と検証結果](docs/review/README.md)
- [三国ポチポチ第二段階：三地域攻略と鍛錬](docs/design/sangoku-campaign.md)
- [三国ポチポチの最新画面集](docs/review/sangoku-campaign/index.html)

三国ポチポチは編成・遠征・帰還、覇拳伝は敵の予兆と読み合い、カルマクエストは神様と報告、ポーション工房は需要と注文、剣戟の森は流派とボス行動、カラーマッチは60秒の段階出題を追加しています。大型機能や追加イラストは統合設計の「次段階」に区別しています。

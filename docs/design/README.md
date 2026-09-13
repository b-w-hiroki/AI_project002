# Design Index

## Current

画面・体験設計の最新版は **[AI Project 002 — コンセプトアート準拠・再設計](concept-art-redesign.md)** を起点にする。

次の実装フェーズは **[スマホ最適化 + ビジュアル強化 実装指示書](mobile-responsive-visual-implementation.md)** に従い、6作品を縦持ち / 横持ちの両方へ最適化した後、コンセプトアートとの差をアセット単位で詰める。

### 作品別

- [三国ポチポチ — 再設計 v2](redesign-sangoku.md)
- [剣戟の森 — 再設計 v2](redesign-side-scroller.md)
- [Potion Workshop — 再設計 v2](redesign-potion-workshop.md)
- [覇拳伝 — 再設計 v2](redesign-fist-legend.md)
- [カルマクエスト — 再設計 v2](redesign-karma-quest.md)
- [カラーマッチ — 再設計 v2](redesign-color-match.md)

## Foundation / History

- [ゲーム性 × ビジュアル 統合設計](game-evolution.md) — 2026-09-06時点のゲーム性・ロジック土台
- [三国 第二段階キャンペーン設計](sangoku-campaign.md)
- [三国 キャラクターアート設計](sangoku-character-art.md)
- [三国 演出設計](sangoku-staging.md)

## 実装優先順位

1. 共通スマホ基盤 — viewport / Safe Area / orientation / resize lifecycle
2. 縦基準4作品 — Color Match / 三国 / カルマ / Potion
3. 横基準2作品 — 剣戟 / 覇拳伝
4. 三国 — 背景 + 武将アート
5. Potion — 工房背景 + 大釜FX
6. カルマ — 王都背景 + 派閥紋章
7. 剣戟 — 森レイヤー + slash FX
8. 覇拳 — arena + attack pose
9. Color — 背景 + mascot feedback

今後は小さな装飾単位ではなく、**1 PR = 1つの完成条件を満たすまとまり**として進める。

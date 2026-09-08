export const REGIONS = [
  {
    id: "plains",
    name: "黎明の街道",
    subtitle: "旅立ちの章",
    threat: 0,
    reward: 1,
    tint: 0xffffff,
    accent: 0xe7bf76,
    boss: "街道の関門",
    hint: "守将を連れて、まずは帰還を覚えよう。",
  },
  {
    id: "pass",
    name: "翠嶺の峠",
    subtitle: "山越えの章",
    threat: 65,
    reward: 1.4,
    tint: 0xa2c7bb,
    accent: 0x9cd4bc,
    boss: "峠の砦",
    hint: "敵が強くなる。鍛錬と装備で備えよう。",
  },
  {
    id: "citadel",
    name: "紅蓮の城塞",
    subtitle: "決戦の章",
    threat: 135,
    reward: 1.9,
    tint: 0xcb9dab,
    accent: 0xf2a09a,
    boss: "城塞の大門",
    hint: "三地域の最終戦。帰還も立派な戦略。",
  },
] as const;
export type RegionId = (typeof REGIONS)[number]["id"];
export function regionById(id: unknown) {
  return REGIONS.find((r) => r.id === id) ?? REGIONS[0];
}

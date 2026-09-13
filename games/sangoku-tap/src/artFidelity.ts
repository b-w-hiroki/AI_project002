import Phaser from "phaser";
import { REGIONS, type RegionId } from "./logic/regions";
import { ExpeditionScene } from "./scenes/ExpeditionScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type Runtime = Phaser.Scene & {
  view?: "camp" | "formation" | "road" | "result";
  selectedRegion?: RegionId;
  party?: string[];
};

const GENERAL_ART: Readonly<Record<string, string>> = {
  gen_hakuen: "st-general-hakuen",
  gen_soujin: "st-general-soujin",
  gen_kohei: "st-general-kohei",
  gen_ashigaru: "st-general-ashigaru",
};

const roots = new WeakMap<object, Phaser.GameObjects.Container>();

function clear(scene: Runtime): void {
  roots.get(scene)?.destroy(true);
  roots.delete(scene);
}

function buildPortrait(scene: Runtime, root: Phaser.GameObjects.Container, selectedIndex: number): void {
  const g = scene.add.graphics().setScrollFactor(0);
  root.add(g);

  // 夕暮れの戦場に「今ここ」を作る。既存UIを塞がず、地図部分だけに光を重ねる。
  const nodePositions = [
    { x: 126, y: 506 },
    { x: 224, y: 408 },
    { x: 340, y: 286 },
  ];
  const selected = nodePositions[selectedIndex] ?? nodePositions[0]!;

  // 遠征路の小拠点を追加して、3点だけだったルートを「進軍している地図」に見せる。
  const route = [
    { x: 96, y: 530 },
    { x: 146, y: 486 },
    { x: 184, y: 447 },
    { x: 224, y: 408 },
    { x: 266, y: 365 },
    { x: 305, y: 325 },
    { x: 340, y: 286 },
  ];
  g.lineStyle(7, 0x3b160e, 0.34).beginPath();
  route.forEach((point, index) => index === 0 ? g.moveTo(point.x, point.y) : g.lineTo(point.x, point.y));
  g.strokePath();
  g.lineStyle(2, 0xffcf72, 0.58).beginPath();
  route.forEach((point, index) => index === 0 ? g.moveTo(point.x, point.y) : g.lineTo(point.x, point.y));
  g.strokePath();
  route.forEach((point, index) => {
    const active = index <= selectedIndex * 3;
    g.fillStyle(active ? 0xffd170 : 0x5b4638, active ? 0.95 : 0.64).fillCircle(point.x, point.y, index % 3 === 0 ? 5 : 3);
    if (active) g.lineStyle(1, 0xfff0b8, 0.72).strokeCircle(point.x, point.y, index % 3 === 0 ? 8 : 5);
  });

  // 攻略中ノードの熱量。コンセプトアートの大きな赤い戦場ノードを再現。
  g.fillStyle(0xe44f28, 0.12).fillCircle(selected.x, selected.y, 42);
  g.lineStyle(4, 0xff8c42, 0.72).strokeCircle(selected.x, selected.y, 31);
  g.lineStyle(1, 0xffe29b, 0.5).strokeCircle(selected.x, selected.y, 39);

  // 山間の火の粉。静止画でも奥行きが出る程度に限定する。
  const embers = [
    [92, 248], [117, 303], [158, 276], [205, 321], [252, 253], [288, 293], [371, 236], [404, 418],
  ] as const;
  embers.forEach(([x, y], i) => {
    g.fillStyle(i % 2 ? 0xffc45b : 0xff7138, 0.72).fillCircle(x, y, i % 3 === 0 ? 2.3 : 1.4);
  });

  // 守将を攻略先の横に見せる。文字カードより先に「誰を倒すか」が目に入る。
  if (scene.textures.exists("st-boss-gatekeeper")) {
    const bossHalo = scene.add.graphics().setScrollFactor(0);
    bossHalo.fillStyle(0x220b08, 0.72).fillCircle(395, 270, 51);
    bossHalo.lineStyle(2, 0xff9b4a, 0.72).strokeCircle(395, 270, 50);
    root.add(bossHalo);
    const boss = scene.add.image(395, 273, "st-boss-gatekeeper")
      .setDisplaySize(88, 112)
      .setAlpha(0.95)
      .setScrollFactor(0);
    root.add(boss);
  }

  // 部隊の先頭武将をルート上へ小さく置き、編成カードと地図を視覚的につなぐ。
  const leader = scene.party?.[0];
  const leaderKey = leader ? GENERAL_ART[leader] : undefined;
  if (leaderKey && scene.textures.exists(leaderKey)) {
    const marker = scene.add.graphics().setScrollFactor(0);
    marker.fillStyle(0x11100f, 0.9).fillCircle(selected.x - 35, selected.y + 25, 19);
    marker.lineStyle(2, 0xf4c46f, 0.85).strokeCircle(selected.x - 35, selected.y + 25, 19);
    root.add(marker);
    root.add(scene.add.image(selected.x - 35, selected.y + 27, leaderKey).setDisplaySize(29, 37).setScrollFactor(0));
  }
}

function buildLandscape(scene: Runtime, root: Phaser.GameObjects.Container, selectedIndex: number): void {
  const g = scene.add.graphics().setScrollFactor(0);
  root.add(g);

  // 横持ちは戦場を広く見せる。左右UIの間に、進軍路と攻略先だけを強く残す。
  const route = [
    { x: 96, y: 338 },
    { x: 190, y: 298 },
    { x: 286, y: 244 },
    { x: 390, y: 210 },
    { x: 500, y: 168 },
  ];
  g.lineStyle(9, 0x2c120d, 0.32).beginPath();
  route.forEach((point, index) => index === 0 ? g.moveTo(point.x, point.y) : g.lineTo(point.x, point.y));
  g.strokePath();
  g.lineStyle(3, 0xffc45e, 0.66).beginPath();
  route.forEach((point, index) => index === 0 ? g.moveTo(point.x, point.y) : g.lineTo(point.x, point.y));
  g.strokePath();
  route.forEach((point, index) => {
    const active = index <= Math.min(route.length - 1, selectedIndex + 2);
    g.fillStyle(active ? 0xffb341 : 0x6b5544, 0.95).fillCircle(point.x, point.y, index === route.length - 1 ? 8 : 5);
    g.lineStyle(2, 0xffedb0, active ? 0.7 : 0.25).strokeCircle(point.x, point.y, index === route.length - 1 ? 13 : 9);
  });

  // 右側の攻略先に守将の立ち絵を置き、戦闘への期待を先出しする。
  if (scene.textures.exists("st-boss-gatekeeper")) {
    const aura = scene.add.graphics().setScrollFactor(0);
    aura.fillStyle(0x5e160f, 0.25).fillCircle(690, 197, 74);
    aura.lineStyle(3, 0xff873f, 0.58).strokeCircle(690, 197, 70);
    root.add(aura);
    root.add(scene.add.image(690, 207, "st-boss-gatekeeper").setDisplaySize(126, 166).setScrollFactor(0).setAlpha(0.94));
  }

  const leader = scene.party?.[0];
  const leaderKey = leader ? GENERAL_ART[leader] : undefined;
  if (leaderKey && scene.textures.exists(leaderKey)) {
    const p = route[Math.min(route.length - 2, selectedIndex + 1)]!;
    const marker = scene.add.graphics().setScrollFactor(0);
    marker.fillStyle(0x17110f, 0.92).fillCircle(p.x, p.y, 24);
    marker.lineStyle(2, 0xf3c46c, 0.8).strokeCircle(p.x, p.y, 24);
    root.add(marker);
    root.add(scene.add.image(p.x, p.y + 2, leaderKey).setDisplaySize(38, 48).setScrollFactor(0));
  }
}

function build(scene: Runtime): void {
  clear(scene);
  if (scene.view !== "camp" || !scene.selectedRegion) return;

  const selectedIndex = Math.max(0, REGIONS.findIndex((region) => region.id === scene.selectedRegion));
  const root = scene.add.container(0, 0).setDepth(3350).setScrollFactor(0);
  roots.set(scene, root);

  const size = scene.scale.gameSize;
  const portrait = size.height >= size.width;
  if (portrait) buildPortrait(scene, root, selectedIndex);
  else buildLandscape(scene, root, selectedIndex);
}

export function installSangokuArtFidelity(): void {
  const proto = ExpeditionScene.prototype as unknown as MethodTable;
  const original = proto.render;
  if (!original || proto.__artFidelityRender) return;
  proto.__artFidelityRender = original;
  proto.render = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = original.apply(this, args);
    build(this as Runtime);
    return result;
  };
}

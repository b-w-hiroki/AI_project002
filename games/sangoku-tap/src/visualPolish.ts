import Phaser from "phaser";
import { isUnlocked } from "./logic/campaign";
import { newExpedition, victoryChance, type Expedition } from "./logic/expedition";
import { saveExpedition } from "./logic/expeditionSave";
import { GENERAL_POOL } from "./logic/general";
import { loadCurrency } from "./logic/progress";
import { REGIONS, regionById, type RegionId } from "./logic/regions";
import { ExpeditionScene } from "./scenes/ExpeditionScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type CampaignLike = { cleared: RegionId[]; merit: number; training: number };
type TroopLike = { ids: string[]; power: number; hp: number };
type Runtime = Phaser.Scene & {
  view?: "camp" | "formation" | "road" | "result";
  selectedRegion?: RegionId;
  campaign?: CampaignLike;
  party?: string[];
  run?: Expedition | null;
  settled?: boolean;
};

const ART: Readonly<Record<string, string>> = {
  gen_hakuen: "st-general-hakuen",
  gen_soujin: "st-general-soujin",
  gen_kohei: "st-general-kohei",
  gen_ashigaru: "st-general-ashigaru",
};

const roots = new WeakMap<object, Phaser.GameObjects.Container>();

function invoke(scene: Runtime, key: string, ...args: unknown[]): unknown {
  const fn = Reflect.get(scene, key);
  return typeof fn === "function" ? (fn as (...values: unknown[]) => unknown).apply(scene, args) : undefined;
}

function text(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  value: string,
  size: number,
  color = "#fff1d0",
  weight = "800",
): Phaser.GameObjects.Text {
  const label = scene.add
    .text(x, y, value, {
      fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", serif',
      fontSize: `${size}px`,
      fontStyle: weight,
      color,
      align: "center",
      lineSpacing: 4,
    })
    .setOrigin(0.5);
  root.add(label);
  return label;
}

function panel(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha = 0.78,
  border = 0xd9ae66,
): void {
  const g = scene.add.graphics();
  g.fillStyle(0x080707, alpha).fillRoundedRect(x - w / 2, y - h / 2, w, h, 12);
  g.fillStyle(0xffffff, 0.05).fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, Math.max(5, h * 0.18), 9);
  g.lineStyle(1.4, border, 0.7).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 12);
  root.add(g);
}

function button(
  scene: Runtime,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  value: string,
  onClick: () => void,
  enabled: boolean,
  accent: number,
): void {
  const g = scene.add.graphics();
  const paint = (down = false) => {
    g.clear();
    const fill = enabled ? (down ? 0x7e2117 : accent) : 0x302d2b;
    g.fillStyle(0x000000, 0.34).fillRoundedRect(x - w / 2 + 4, y - h / 2 + 5, w, h, 14);
    g.fillStyle(fill, 0.98).fillRoundedRect(x - w / 2, y - h / 2, w, h, 14);
    g.fillStyle(0xffe4a1, enabled ? 0.13 : 0.03).fillRoundedRect(x - w / 2 + 3, y - h / 2 + 3, w - 6, h * 0.3, 10);
    g.lineStyle(2, enabled ? 0xf2c069 : 0x655f59, enabled ? 0.92 : 0.4).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 14);
  };
  paint();
  root.add(g);
  text(scene, root, x, y - 1, value, enabled ? 17 : 14, enabled ? "#fff5dc" : "#8f8882", "900");
  const hit = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: enabled });
  root.add(hit);
  hit.on("pointerdown", () => {
    if (!enabled) return;
    paint(true);
    onClick();
  });
  hit.on("pointerup", () => paint(false));
  hit.on("pointerout", () => paint(false));
}

function clear(scene: Runtime): void {
  roots.get(scene)?.destroy(true);
  roots.delete(scene);
}

function build(scene: Runtime): void {
  clear(scene);
  if (scene.view !== "camp" || !scene.campaign || !scene.selectedRegion) return;

  const campaign = scene.campaign;
  const region = regionById(scene.selectedRegion);
  const troop = invoke(scene, "troop") as TroopLike | undefined;
  const canSortie = !!troop?.ids.length && isUnlocked(campaign as never, scene.selectedRegion);
  const preview = canSortie && troop ? newExpedition(troop as never, scene.selectedRegion) : null;
  const win = preview ? Math.round(victoryChance(preview) * 100) : 0;

  const root = scene.add.container(0, 0).setDepth(9000).setScrollFactor(0);
  roots.set(scene, root);

  // Let the illustrated battlefield carry the screen. Only top/bottom gradients remain opaque.
  if (scene.textures.exists("st-bg-battlefield")) {
    const bg = scene.add.image(225, 400, "st-bg-battlefield").setDisplaySize(1120, 800);
    root.add(bg);
  }
  const shade = scene.add.graphics();
  shade.fillGradientStyle(0x170908, 0x170908, 0x170908, 0x170908, 0.62, 0.62, 0, 0).fillRect(0, 0, 450, 128);
  shade.fillGradientStyle(0x080707, 0x080707, 0x080707, 0x080707, 0, 0, 0.82, 0.82).fillRect(0, 540, 450, 260);
  shade.fillStyle(0x3c160e, 0.12).fillRect(0, 0, 450, 800);
  root.add(shade);

  text(scene, root, 18, 29, "三国ポチポチ", 34, "#fff2d0", "900").setOrigin(0, 0.5).setStroke("#771f15", 6);
  text(scene, root, 20, 65, "Sangoku Tap — 武将ガチャ、天下への道", 9, "#f1cf96", "700").setOrigin(0, 0.5);
  text(scene, root, 21, 95, "乱世を駆け、英雄を集め、天下を掴め。", 11, "#fff0cf", "800").setOrigin(0, 0.5);

  const chips = [
    { x: 282, w: 76, value: `銭 ${loadCurrency()}` },
    { x: 358, w: 70, value: `功績 ${campaign.merit}` },
    { x: 420, w: 48, value: `${campaign.cleared.length}/3` },
  ];
  chips.forEach(({ x, w, value }) => {
    panel(scene, root, x, 29, w, 30, 0.82);
    text(scene, root, x, 29, value, 9, "#ffe6b0", "900");
  });

  // Lacquer navigation, matching the concept art silhouette without hiding the scenery.
  panel(scene, root, 34, 326, 58, 382, 0.8, 0xc89a52);
  ["遠征", "武将", "編成", "任務", "商店"].forEach((item, i) => {
    const y = 190 + i * 68;
    if (i === 0) {
      const hi = scene.add.graphics();
      hi.fillStyle(0x8d2b20, 0.93).fillRoundedRect(9, y - 25, 50, 50, 8);
      hi.lineStyle(1.2, 0xf0c16d, 0.78).strokeRoundedRect(9, y - 25, 50, 50, 8);
      root.add(hi);
    }
    text(scene, root, 34, y, item, 11, i === 0 ? "#fff0cc" : "#d9c49e", i === 0 ? "900" : "700");
    const active = item === "武将" || item === "編成";
    const hit = scene.add.zone(34, y, 52, 54).setInteractive({ useHandCursor: active });
    root.add(hit);
    hit.on("pointerdown", () => {
      if (item === "武将") scene.scene.start("GameScene");
      if (item === "編成") {
        scene.view = "formation";
        invoke(scene, "render");
      }
    });
  });

  // Campaign road is drawn directly over the landscape instead of inside a dark web-like card.
  const route = scene.add.graphics();
  route.lineStyle(6, 0x4d2516, 0.42).beginPath().moveTo(110, 505).lineTo(216, 413).lineTo(344, 286).strokePath();
  route.lineStyle(2, 0xffdc84, 0.95);
  for (let i = 0; i < 24; i++) {
    const t = i / 23;
    const first = t < 0.46;
    const u = first ? t / 0.46 : (t - 0.46) / 0.54;
    const x = first ? 110 + (216 - 110) * u : 216 + (344 - 216) * u;
    const y = first ? 505 + (413 - 505) * u : 413 + (286 - 413) * u;
    route.fillStyle(0xffe3a0, 0.92).fillCircle(x, y, i % 5 === 0 ? 4.5 : 2.2);
  }
  root.add(route);

  const points = [
    { x: 110, y: 505 },
    { x: 216, y: 413 },
    { x: 344, y: 286 },
  ];
  REGIONS.forEach((r, i) => {
    const p = points[i]!;
    const unlocked = isUnlocked(campaign as never, r.id);
    const selected = r.id === scene.selectedRegion;
    const cleared = campaign.cleared.includes(r.id);
    const mark = scene.add.graphics();
    mark.fillStyle(selected ? 0x9f271d : 0x20130f, 0.96).fillCircle(p.x, p.y, selected ? 26 : 21);
    mark.lineStyle(selected ? 4 : 2, unlocked ? 0xffcc73 : 0x69615b, unlocked ? 1 : 0.55).strokeCircle(p.x, p.y, selected ? 26 : 21);
    mark.fillStyle(unlocked ? (cleared ? 0xe0b152 : 0xc23c2d) : 0x54504d, 1).fillTriangle(p.x - 9, p.y + 9, p.x, p.y - 12, p.x + 9, p.y + 9);
    root.add(mark);
    text(scene, root, p.x, p.y - 42, cleared ? `第${i + 1}章  踏破` : unlocked ? `第${i + 1}章` : "未開放", 10, unlocked ? "#fff0c8" : "#aaa19a", "900");
    text(scene, root, p.x + (i === 2 ? -22 : 26), p.y + 32, r.name, 13, unlocked ? "#fff4d9" : "#9d958f", "900");
    const hit = scene.add.zone(p.x, p.y, 92, 82).setInteractive({ useHandCursor: unlocked });
    root.add(hit);
    hit.on("pointerdown", () => {
      if (!unlocked) return;
      scene.selectedRegion = r.id;
      invoke(scene, "render");
    });
  });

  text(scene, root, 406, 389, "三国、\nいざ統一へ", 13, "#fff0ce", "900").setAngle(-2).setLineSpacing(9);

  // Reward + formation dock keeps the bottom readable while preserving the battlefield above it.
  panel(scene, root, 225, 575, 388, 58, 0.78, region.accent);
  text(scene, root, 48, 564, "クリア報酬", 9, "#f1cc80", "900").setOrigin(0, 0.5);
  text(scene, root, 48, 585, `銭 ×${region.reward.toFixed(1)}  ·  功績+5  ·  Rare装備  ·  勝率 ${win}%`, 10, "#fff0cf", "800").setOrigin(0, 0.5);

  const party = scene.party ?? [];
  const xs = [83, 165, 247];
  party.slice(0, 3).forEach((id, i) => {
    const x = xs[i]!;
    panel(scene, root, x, 662, 72, 110, 0.9, i === 0 ? 0xf0be62 : 0x92734d);
    const key = ART[id];
    if (key && scene.textures.exists(key)) root.add(scene.add.image(x, 647, key).setDisplaySize(64, 82));
    const general = GENERAL_POOL.find((g) => g.id === id);
    text(scene, root, x, 691, general?.name ?? "武将", 9, "#fff0d2", "900");
    text(scene, root, x, 707, i === 0 ? "★★★★★" : "★★★★☆", 7, "#ffd15e", "900");
  });
  if (!party.length) text(scene, root, 165, 660, "編成で武将を選ぼう", 11, "#d7c29e", "700");

  panel(scene, root, 350, 662, 118, 110, 0.88, 0xc39d61);
  text(scene, root, 350, 630, "部隊戦力", 9, "#dcbf88", "900");
  text(scene, root, 350, 657, `${troop?.power ?? 0}`, 25, "#fff2d5", "900");
  text(scene, root, 350, 686, `勝率 ${win}%`, 10, win >= 70 ? "#9fe0b6" : "#efcb7a", "900");

  button(scene, root, 98, 756, 136, 54, "編成", () => {
    scene.view = "formation";
    invoke(scene, "render");
  }, true, 0x39464b);
  button(scene, root, 304, 756, 258, 58, `出陣  ${region.name}`, () => {
    if (!troop || !canSortie || !scene.selectedRegion) return;
    scene.run = newExpedition(troop as never, scene.selectedRegion);
    saveExpedition(scene.run);
    scene.settled = false;
    scene.view = "road";
    invoke(scene, "render");
  }, canSortie, 0xb42f22);
}

export function installSangokuVisualPolish(): void {
  const proto = ExpeditionScene.prototype as unknown as MethodTable;
  const original = proto.render;
  if (!original || proto.__conceptArtVisualQaRender) return;
  proto.__conceptArtVisualQaRender = original;
  proto.render = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = original.apply(this, args);
    const runtime = this as Runtime;
    this.time.delayedCall(0, () => build(runtime));
    return result;
  };
}

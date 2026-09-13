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

const ART: Record<string, string> = {
  gen_hakuen: "st-general-hakuen",
  gen_soujin: "st-general-soujin",
  gen_kohei: "st-general-kohei",
  gen_ashigaru: "st-general-ashigaru",
};
const roots = new WeakMap<object, Phaser.GameObjects.Container>();

function invoke(scene: Runtime, key: string, ...args: unknown[]): unknown {
  const fn = Reflect.get(scene, key);
  return typeof fn === "function" ? (fn as (...v: unknown[]) => unknown).apply(scene, args) : undefined;
}

function clear(scene: Runtime): void {
  roots.get(scene)?.destroy(true);
  roots.delete(scene);
}

function label(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  value: string,
  size: number,
  color = "#fff0d4",
  weight = "700",
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, value, {
    fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", serif',
    fontSize: `${size}px`,
    fontStyle: weight,
    color,
    align: "center",
    lineSpacing: 4,
  }).setOrigin(0.5);
  root.add(t);
  return t;
}

function plate(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  fill = 0x12100f,
  border = 0xd1a35b,
  alpha = 0.9,
  radius = 10,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.28).fillRoundedRect(x - w / 2 + 3, y - h / 2 + 4, w, h, radius);
  g.fillStyle(fill, alpha).fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  g.fillStyle(0xffffff, 0.06).fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, Math.max(5, h * 0.18), radius * 0.7);
  g.lineStyle(1.4, border, 0.76).strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  root.add(g);
  return g;
}

function button(
  scene: Runtime,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  onClick: () => void,
  enabled = true,
  accent = 0xa72f22,
): void {
  const bg = scene.add.graphics();
  const paint = (pressed = false) => {
    bg.clear();
    const color = !enabled ? 0x35302f : pressed ? 0x7f221b : accent;
    bg.fillStyle(0x000000, 0.34).fillRoundedRect(x - w / 2 + 3, y - h / 2 + 4, w, h, 14);
    bg.fillStyle(color, 0.98).fillRoundedRect(x - w / 2, y - h / 2, w, h, 14);
    bg.fillStyle(0xffe5b0, enabled ? 0.13 : 0.03).fillRoundedRect(x - w / 2 + 3, y - h / 2 + 3, w - 6, h * 0.32, 11);
    bg.lineStyle(2, enabled ? 0xe8ba69 : 0x68605a, enabled ? 0.9 : 0.42).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 14);
  };
  paint();
  root.add(bg);
  label(scene, root, x, y - 2, text, enabled ? 16 : 14, enabled ? "#fff1d3" : "#8e8680", "900");
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

function build(scene: Runtime): void {
  clear(scene);
  if (scene.view !== "camp" || !scene.campaign || !scene.selectedRegion) return;

  const root = scene.add.container(0, 0).setDepth(3200).setScrollFactor(0);
  roots.set(scene, root);
  const campaign = scene.campaign;
  const region = regionById(scene.selectedRegion);
  const troop = invoke(scene, "troop") as TroopLike | undefined;
  const canSortie = !!troop?.ids.length && isUnlocked(campaign as never, scene.selectedRegion);
  const preview = canSortie && troop ? newExpedition(troop as never, scene.selectedRegion) : null;
  const win = preview ? Math.round(victoryChance(preview) * 100) : 0;

  if (scene.textures.exists("st-bg-battlefield")) {
    const bg = scene.add.image(225, 400, "st-bg-battlefield").setDisplaySize(1060, 800).setDepth(0);
    root.add(bg);
  }
  const shade = scene.add.graphics();
  shade.fillGradientStyle(0x24110d, 0x24110d, 0x120b0a, 0x120b0a, 0.1, 0.1, 0.62, 0.62);
  shade.fillRect(0, 0, 450, 800);
  shade.fillStyle(0x140a08, 0.68).fillRect(0, 0, 450, 108);
  shade.fillStyle(0x0b0909, 0.72).fillRect(0, 574, 450, 226);
  root.add(shade);

  label(scene, root, 20, 28, "三国ポチポチ", 31, "#fff0d1", "900").setOrigin(0, 0.5).setStroke("#7d1f17", 5);
  label(scene, root, 21, 60, "Sangoku Tap — 武将を率い、天下への道へ", 9, "#e5c893", "700").setOrigin(0, 0.5);
  label(scene, root, 22, 89, "乱世を駆け、英雄を集め、天下を掴め。", 11, "#f0dfbd", "700").setOrigin(0, 0.5);

  const chips = [
    { x: 292, value: `銭 ${loadCurrency()}` },
    { x: 362, value: `功績 ${campaign.merit}` },
    { x: 417, value: `${campaign.cleared.length}/3` },
  ];
  chips.forEach((chip, i) => {
    plate(scene, root, chip.x, 28, i === 2 ? 48 : 68, 28, 0x171211, 0xd2a65f, 0.88, 9);
    label(scene, root, chip.x, 28, chip.value, i === 2 ? 9 : 10, "#f7deb1", "800");
  });

  plate(scene, root, 35, 332, 58, 420, 0x121212, 0xc99853, 0.92, 13);
  ["遠征", "武将", "編成", "任務", "商店"].forEach((item, i) => {
    const y = 184 + i * 72;
    if (i === 0) {
      const hi = scene.add.graphics();
      hi.fillStyle(0x8c2f24, 0.95).fillRoundedRect(10, y - 27, 50, 54, 9);
      hi.lineStyle(1, 0xf0c06d, 0.72).strokeRoundedRect(10, y - 27, 50, 54, 9);
      root.add(hi);
    }
    label(scene, root, 35, y, item, 12, i === 0 ? "#fff0c9" : "#d2bd99", i === 0 ? "900" : "700");
    const hit = scene.add.zone(35, y, 52, 58).setInteractive({ useHandCursor: item === "武将" || item === "編成" });
    root.add(hit);
    hit.on("pointerdown", () => {
      if (item === "武将") scene.scene.start("GameScene");
      if (item === "編成") {
        scene.view = "formation";
        invoke(scene, "render");
      }
    });
  });

  const map = scene.add.graphics();
  map.lineStyle(4, 0xf0c06a, 0.72).beginPath().moveTo(126, 506).lineTo(224, 408).lineTo(340, 286).strokePath();
  map.lineStyle(1.5, 0xffe0a0, 0.5);
  for (let i = 0; i < 18; i++) {
    const t = i / 17;
    const x = t < 0.46 ? 126 + (224 - 126) * (t / 0.46) : 224 + (340 - 224) * ((t - 0.46) / 0.54);
    const y = t < 0.46 ? 506 + (408 - 506) * (t / 0.46) : 408 + (286 - 408) * ((t - 0.46) / 0.54);
    map.fillStyle(0xffe7ac, 0.9).fillCircle(x, y, i % 4 === 0 ? 4 : 2);
  }
  root.add(map);

  const positions = [
    { x: 126, y: 506 },
    { x: 224, y: 408 },
    { x: 340, y: 286 },
  ];
  REGIONS.forEach((r, i) => {
    const p = positions[i]!;
    const unlocked = isUnlocked(campaign as never, r.id);
    const selected = r.id === scene.selectedRegion;
    const cleared = campaign.cleared.includes(r.id);
    const ring = scene.add.graphics();
    ring.fillStyle(selected ? 0x861f18 : 0x191516, 0.94).fillCircle(p.x, p.y, selected ? 24 : 20);
    ring.lineStyle(selected ? 4 : 2, unlocked ? 0xf1c36f : 0x6e6966, unlocked ? 0.96 : 0.55).strokeCircle(p.x, p.y, selected ? 24 : 20);
    ring.fillStyle(unlocked ? (cleared ? 0xd9ad52 : 0xb33527) : 0x4b4a4a, 1).fillRect(p.x - 7, p.y - 9, 14, 17);
    root.add(ring);
    label(scene, root, p.x + (i === 2 ? -4 : 6), p.y - 42, cleared ? `第${i + 1}章  踏破` : unlocked ? `第${i + 1}章` : "未開放", 10, unlocked ? "#ffe3ae" : "#aaa19a", "900");
    label(scene, root, p.x + (i === 0 ? 32 : i === 2 ? -24 : 34), p.y + 30, r.name, 13, unlocked ? "#fff0d0" : "#978e88", "900");
    const zone = scene.add.zone(p.x, p.y, 92, 78).setInteractive({ useHandCursor: unlocked });
    root.add(zone);
    zone.on("pointerdown", () => {
      if (!unlocked) return;
      scene.selectedRegion = r.id;
      invoke(scene, "render");
    });
  });

  label(scene, root, 417, 360, "乱世を駆け\n英雄を集め\n天下を掴め", 13, "#f3dfbe", "800").setAngle(-2).setLineSpacing(9);

  plate(scene, root, 222, 563, 342, 58, 0x171312, region.accent, 0.9, 11);
  label(scene, root, 70, 550, "クリア報酬", 10, "#e8c67e", "900").setOrigin(0, 0.5);
  label(scene, root, 70, 570, `銭 ×${region.reward.toFixed(1)}   功績 +5   Rare装備   勝率 ${win}%`, 11, "#fff0cf", "800").setOrigin(0, 0.5);

  const party = scene.party ?? [];
  const cardXs = [91, 181, 271];
  party.slice(0, 3).forEach((id, i) => {
    const x = cardXs[i]!;
    plate(scene, root, x, 652, 78, 112, 0x191416, i === 0 ? 0xf0be62 : 0x92734d, 0.96, 9);
    const key = ART[id];
    if (key && scene.textures.exists(key)) {
      const img = scene.add.image(x, 639, key).setDisplaySize(68, 82);
      root.add(img);
    }
    const general = GENERAL_POOL.find((g) => g.id === id);
    label(scene, root, x, 687, general?.name ?? "武将", 10, "#fff1d5", "900");
    label(scene, root, x, 704, i === 0 ? "★★★★★" : "★★★★☆", 8, "#ffd45f", "900");
  });
  if (!party.length) label(scene, root, 180, 650, "編成で武将を選ぼう", 12, "#d1c0a2", "700");

  plate(scene, root, 365, 650, 108, 112, 0x151313, 0x9f7f52, 0.94, 10);
  label(scene, root, 365, 620, "部隊", 10, "#d9bc84", "900");
  label(scene, root, 365, 647, `${troop?.power ?? 0}`, 25, "#fff0d1", "900");
  label(scene, root, 365, 674, `勝率 ${win}%`, 11, win >= 70 ? "#9fe0b6" : "#e6c777", "900");
  label(scene, root, 365, 695, `${region.boss}`, 9, "#cdb99a", "700");

  button(scene, root, 110, 750, 150, 54, "編成", () => {
    scene.view = "formation";
    invoke(scene, "render");
  }, true, 0x3e4b50);
  button(scene, root, 320, 750, 230, 58, `出陣  ${region.name}`, () => {
    if (!troop || !canSortie || !scene.selectedRegion) return;
    scene.run = newExpedition(troop as never, scene.selectedRegion);
    saveExpedition(scene.run);
    scene.settled = false;
    scene.view = "road";
    invoke(scene, "render");
  }, canSortie, 0xa82f22);
}

export function installSangokuConceptArtPass(): void {
  const proto = ExpeditionScene.prototype as unknown as MethodTable;
  const original = proto.render;
  if (!original || proto.__conceptArtFidelityRender) return;
  proto.__conceptArtFidelityRender = original;
  proto.render = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = original.apply(this, args);
    build(this as Runtime);
    return result;
  };
}

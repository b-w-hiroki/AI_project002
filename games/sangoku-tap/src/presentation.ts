import Phaser from "phaser";
import { GENERAL_POOL } from "./logic/general";
import { isUnlocked } from "./logic/campaign";
import {
  newExpedition,
  victoryChance,
  type Expedition,
} from "./logic/expedition";
import { saveExpedition } from "./logic/expeditionSave";
import { loadCurrency } from "./logic/progress";
import { regionById, type RegionId } from "./logic/regions";
import { ExpeditionScene } from "./scenes/ExpeditionScene";

type CampaignLike = {
  cleared: RegionId[];
  merit: number;
  training: number;
};

type TroopLike = {
  ids: string[];
  power: number;
  hp: number;
};

type ExpeditionRuntime = Phaser.Scene & {
  view?: "camp" | "formation" | "road" | "result";
  run: Expedition | null;
  selectedRegion?: RegionId;
  campaign?: CampaignLike;
  party?: string[];
  settled?: boolean;
};

type RoadHud = {
  root: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Graphics;
  status: Phaser.GameObjects.Text;
};

const hudByScene = new WeakMap<object, RoadHud>();
const campaignChromeByScene = new WeakMap<object, Phaser.GameObjects.Container>();

function invoke(scene: ExpeditionRuntime, key: string, ...args: unknown[]): unknown {
  const fn = Reflect.get(scene, key);
  if (typeof fn !== "function") return undefined;
  return (fn as (...values: unknown[]) => unknown).apply(scene, args);
}

function destroyAll(targets: Phaser.GameObjects.GameObject[]): void {
  for (const target of targets) target.destroy();
}

function clearCampaignChrome(scene: ExpeditionRuntime): void {
  campaignChromeByScene.get(scene)?.destroy(true);
  campaignChromeByScene.delete(scene);
}

function addPanel(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  border = 0xc5a46e,
  alpha = 0.96,
  radius = 14,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x050608, 0.3).fillRoundedRect(x - w / 2 + 3, y - h / 2 + 5, w, h, radius);
  g.fillStyle(fill, alpha).fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  g.fillStyle(0xffffff, 0.04).fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, Math.max(5, h * 0.14), radius * 0.75);
  g.lineStyle(1.3, border, 0.62).strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  root.add(g);
  return g;
}

function addText(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  value: string,
  size = 12,
  color = "#f9ecd3",
  weight = "700",
): Phaser.GameObjects.Text {
  const label = scene.add
    .text(x, y, value, {
      fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", serif',
      fontSize: `${size}px`,
      fontStyle: weight,
      color,
      align: "center",
    })
    .setOrigin(0.5);
  root.add(label);
  return label;
}

function addButton(
  scene: ExpeditionRuntime,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  active = true,
  accent = 0xa64232,
): void {
  const g = scene.add.graphics();
  const paint = (pressed = false) => {
    g.clear();
    g.fillStyle(active ? (pressed ? 0x6e2b25 : accent) : 0x332c2d, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 12);
    g.fillStyle(0xffffff, active ? 0.08 : 0.03).fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, h * 0.28, 9);
    g.lineStyle(1.4, active ? 0xe0b878 : 0x625858, active ? 0.82 : 0.4);
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 12);
  };
  paint();
  root.add(g);
  const text = addText(scene, root, x, y, label, 14, active ? "#fff0d2" : "#817873", "800");
  const hit = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: active });
  root.add(hit);
  hit.on("pointerdown", () => {
    if (!active) return;
    paint(true);
    onClick();
  });
  hit.on("pointerup", () => paint(false));
  hit.on("pointerout", () => paint(false));
  text.setDepth(1);
}

function buildCampaignChrome(scene: ExpeditionRuntime): void {
  clearCampaignChrome(scene);
  if (scene.view !== "camp" || !scene.campaign || !scene.selectedRegion) return;

  const campaign = scene.campaign;
  const region = regionById(scene.selectedRegion);
  const troop = invoke(scene, "troop") as TroopLike | undefined;
  const canSortie = !!troop?.ids.length && isUnlocked(campaign as never, scene.selectedRegion);
  const preview = canSortie && troop ? newExpedition(troop as never, scene.selectedRegion) : null;
  const win = preview ? Math.round(victoryChance(preview) * 100) : 0;

  const root = scene.add.container(0, 0).setDepth(205).setScrollFactor(0);
  campaignChromeByScene.set(scene, root);

  // A slim lacquer navigation rail makes the screen read as a strategy game rather than stacked web cards.
  addPanel(scene, root, 34, 370, 58, 486, 0x11171b, 0x9b7444, 0.98, 16);
  const nav = ["遠征", "武将", "編成", "任務", "商店"];
  nav.forEach((label, i) => {
    const y = 205 + i * 78;
    const selected = i === 0;
    if (selected) {
      const mark = scene.add.graphics();
      mark.fillStyle(0xb64535, 1).fillRoundedRect(8, y - 24, 52, 48, 10);
      mark.lineStyle(1, 0xe8bf7d, 0.75).strokeRoundedRect(8, y - 24, 52, 48, 10);
      root.add(mark);
    }
    addText(scene, root, 34, y, label, 11, selected ? "#fff0cf" : "#b9a98f", selected ? "900" : "700");
    if (label === "武将" || label === "編成") {
      const hit = scene.add.zone(34, y, 52, 52).setInteractive({ useHandCursor: true });
      root.add(hit);
      hit.on("pointerdown", () => {
        if (label === "武将") scene.scene.start("GameScene");
        else {
          scene.view = "formation";
          invoke(scene, "render");
        }
      });
    }
  });

  // Chapter plate floats over the map and gives the selected destination a strong focal point.
  addPanel(scene, root, 248, 119, 322, 62, 0x10191d, region.accent, 0.93, 12);
  addText(scene, root, 110, 108, `第${Math.min(3, campaign.cleared.length + 1)}章`, 11, "#d5b675", "900").setOrigin(0, 0.5);
  addText(scene, root, 248, 120, `${region.name}  —  ${region.boss}`, 18, "#fff0d1", "900");
  addText(scene, root, 388, 108, `攻略 ${campaign.cleared.length}/3`, 10, "#d9c39a", "800").setOrigin(1, 0.5);
  addText(scene, root, 388, 132, `功績 ${campaign.merit}  ·  ${loadCurrency()} 銭`, 10, "#d9c39a", "800").setOrigin(1, 0.5);

  // Cover the legacy lower stack and replace it with a single expedition dock.
  const blocker = scene.add.rectangle(225, 682, 450, 236, 0x0b1115, 0.985).setInteractive();
  root.add(blocker);
  addPanel(scene, root, 225, 680, 426, 210, 0x141d21, 0xc5a46e, 0.98, 18);
  addText(scene, root, 28, 598, "遠征部隊", 12, "#d6ba83", "900").setOrigin(0, 0.5);

  const party = scene.party ?? [];
  party.slice(0, 3).forEach((id, i) => {
    const x = 67 + i * 72;
    const ring = scene.add.graphics();
    ring.fillStyle(0x26383b, 1).fillCircle(x, 634, 25);
    ring.lineStyle(i === 0 ? 2.5 : 1.4, i === 0 ? 0xe0b66f : 0x84928b, 0.9).strokeCircle(x, 634, 25);
    root.add(ring);
    const general = GENERAL_POOL.find((g) => g.id === id);
    addText(scene, root, x, 630, general?.name.slice(0, 2) ?? "兵", 13, "#f7e7c4", "900");
    addText(scene, root, x, 667, i === 0 ? "主将" : "同行", 9, i === 0 ? "#e3bd75" : "#99aaa2", "800");
  });
  if (!party.length) addText(scene, root, 130, 638, "編成を選ぼう", 13, "#a89e8f", "700");

  addText(scene, root, 282, 608, "戦力", 9, "#a9bbb2", "800").setOrigin(0, 0.5);
  addText(scene, root, 282, 629, `${troop?.power ?? 0}`, 22, "#fff0d1", "900").setOrigin(0, 0.5);
  addText(scene, root, 360, 608, "勝率", 9, "#a9bbb2", "800").setOrigin(0, 0.5);
  addText(scene, root, 360, 629, `${win}%`, 22, win >= 70 ? "#9ad7b6" : win >= 45 ? "#e3c67f" : "#df8d79", "900").setOrigin(0, 0.5);

  addPanel(scene, root, 310, 671, 222, 44, 0x1e2b2d, region.accent, 0.96, 10);
  addText(scene, root, 216, 660, "踏破報酬", 9, "#b7c2b7", "800").setOrigin(0, 0.5);
  addText(scene, root, 216, 678, `銭 ×${region.reward.toFixed(1)}  ·  功績+5  ·  Rare装備`, 11, "#f0cc88", "800").setOrigin(0, 0.5);

  addButton(scene, root, 105, 732, 142, 48, "編成を変更", () => {
    scene.view = "formation";
    invoke(scene, "render");
  }, true, 0x43565a);
  addButton(scene, root, 314, 732, 214, 52, `${region.name}へ 出陣`, () => {
    if (!troop || !canSortie) return;
    scene.run = newExpedition(troop as never, scene.selectedRegion!);
    saveExpedition(scene.run);
    scene.settled = false;
    scene.view = "road";
    invoke(scene, "render");
  }, canSortie, 0xa64232);

  addText(scene, root, 225, 776, "進軍中はいつでも帰還可能  ·  敗走時は今回の収穫を半分確保", 9, "#8fa099", "700");
}

function ensureRoadHud(scene: ExpeditionRuntime): RoadHud {
  const cached = hudByScene.get(scene);
  if (cached) return cached;

  const frame = scene.add.graphics().setScrollFactor(0);
  const status = scene.add
    .text(225, 38, "", {
      fontFamily: "sans-serif",
      fontSize: "11px",
      fontStyle: "800",
      color: "#f7ddae",
      letterSpacing: 0.5,
    })
    .setOrigin(0.5)
    .setScrollFactor(0);
  const root = scene.add
    .container(0, 0, [frame, status])
    .setScrollFactor(0)
    .setDepth(170)
    .setVisible(false);
  const hud = { root, frame, status };
  hudByScene.set(scene, hud);
  return hud;
}

function refreshRoadHud(scene: ExpeditionRuntime): void {
  const hud = ensureRoadHud(scene);
  const run = scene.run;
  const active = scene.view === "road" && !!run && run.status === "active";
  hud.root.setVisible(active);
  if (!active || !run) return;

  const win = Math.round(victoryChance(run) * 100);
  const secured = Math.floor(run.loot / 2);
  const boss = run.step === 9;
  const next = run.fork ? "ROUTE CHOICE" : boss ? "BOSS GATE" : `NEXT ${run.step + 1}/10`;

  hud.frame.clear();
  hud.frame.fillStyle(0x0e181d, 0.94);
  hud.frame.fillRoundedRect(133, 25, 184, 26, 10);
  hud.frame.lineStyle(1.2, boss ? 0xe2a566 : 0xc5a46e, boss ? 0.9 : 0.55);
  hud.frame.strokeRoundedRect(133, 25, 184, 26, 10);
  hud.status.setText(`${next}  ·  WIN ${win}%  ·  ${run.loot}/${secured}銭`);
  hud.status.setColor(boss ? "#ffe0aa" : "#f7ddae");
}

function playBossIntro(scene: ExpeditionRuntime): void {
  const topBar = scene.add.rectangle(225, 88, 450, 24, 0x090a0d, 0).setScrollFactor(0).setDepth(180);
  const bottomBar = scene.add.rectangle(225, 532, 450, 24, 0x090a0d, 0).setScrollFactor(0).setDepth(180);
  const label = scene.add
    .text(225, 88, "決　戦", {
      fontFamily: "serif",
      fontSize: "14px",
      fontStyle: "700",
      color: "#f5d6a0",
      letterSpacing: 5,
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(181)
    .setAlpha(0);
  const flare = scene.add.rectangle(225, 316, 520, 3, 0xf3c27d, 0.9).setRotation(-0.18).setScrollFactor(0).setDepth(182).setScale(0.15, 1);

  scene.tweens.add({ targets: [topBar, bottomBar], alpha: 0.88, duration: 120 });
  scene.tweens.add({ targets: flare, scaleX: 1, alpha: 0, duration: 430, ease: "Cubic.easeOut", onComplete: () => flare.destroy() });
  scene.tweens.add({ targets: label, alpha: 1, duration: 160, yoyo: true, hold: 500 });
  scene.time.delayedCall(880, () => {
    scene.tweens.add({ targets: [topBar, bottomBar], alpha: 0, duration: 220, onComplete: () => destroyAll([topBar, bottomBar, label]) });
  });
}

function playBossResolution(scene: ExpeditionRuntime, cleared: boolean): void {
  const color = cleared ? 0xffd98a : 0xd8685b;
  const slash = scene.add.rectangle(225, 316, 560, cleared ? 7 : 4, color, 0.95).setRotation(cleared ? -0.35 : 0.24).setScrollFactor(0).setDepth(220).setScale(0.08, 1);
  const label = scene.add
    .text(225, 270, cleared ? "関 門 突 破" : "敗　走", {
      fontFamily: "serif",
      fontSize: cleared ? "28px" : "24px",
      fontStyle: "700",
      color: cleared ? "#fff0c5" : "#ffd0c8",
      stroke: "#24140f",
      strokeThickness: 6,
      letterSpacing: 3,
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(221)
    .setAlpha(0);

  scene.cameras.main.shake(cleared ? 190 : 120, cleared ? 0.005 : 0.003);
  scene.tweens.add({ targets: slash, scaleX: 1, duration: 110, ease: "Cubic.easeOut" });
  scene.tweens.add({ targets: label, alpha: 1, scale: { from: 1.18, to: 1 }, duration: 180, ease: "Back.easeOut" });
  scene.time.delayedCall(620, () => {
    scene.tweens.add({ targets: [slash, label], alpha: 0, duration: 220, onComplete: () => destroyAll([slash, label]) });
  });
}

export function installSangokuPresentation(): void {
  const proto = ExpeditionScene.prototype as unknown as Record<string, unknown>;
  const originalEntrance = Reflect.get(proto, "bossEntrance") as ((this: ExpeditionScene) => void) | undefined;
  const originalAdvance = Reflect.get(proto, "advance") as ((this: ExpeditionScene) => void) | undefined;
  const originalRender = Reflect.get(proto, "render") as ((this: ExpeditionScene) => void) | undefined;

  if (originalEntrance && !Reflect.get(proto, "__momentPassBossEntrance")) {
    Reflect.set(proto, "__momentPassBossEntrance", originalEntrance);
    Reflect.set(proto, "bossEntrance", function (this: ExpeditionScene) {
      originalEntrance.call(this);
      playBossIntro(this as unknown as ExpeditionRuntime);
    });
  }

  if (originalAdvance && !Reflect.get(proto, "__momentPassAdvance")) {
    Reflect.set(proto, "__momentPassAdvance", originalAdvance);
    Reflect.set(proto, "advance", function (this: ExpeditionScene) {
      const runtime = this as unknown as ExpeditionRuntime;
      const wasBoss = runtime.run?.step === 9;
      originalAdvance.call(this);
      if (wasBoss && runtime.run) sceneResolution(runtime);
    });
  }

  if (originalRender && !Reflect.get(proto, "__conceptCampaignRender")) {
    Reflect.set(proto, "__conceptCampaignRender", originalRender);
    Reflect.set(proto, "render", function (this: ExpeditionScene) {
      const runtime = this as unknown as ExpeditionRuntime;
      clearCampaignChrome(runtime);
      originalRender.call(this);
      refreshRoadHud(runtime);
      buildCampaignChrome(runtime);
    });
  }
}

function sceneResolution(scene: ExpeditionRuntime): void {
  const cleared = scene.run?.status === "clear";
  scene.time.delayedCall(120, () => playBossResolution(scene, cleared));
}

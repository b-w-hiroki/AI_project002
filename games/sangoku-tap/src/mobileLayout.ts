import Phaser from "phaser";
import { bindResponsiveScene, getResponsiveLayout, type ViewportLayout } from "../../shared/mobile";
import { GENERAL_POOL } from "./logic/general";
import {
  ROLES,
  newExpedition,
  returnExpedition,
  victoryChance,
  type Expedition,
} from "./logic/expedition";
import { saveExpedition, saveParty } from "./logic/expeditionSave";
import { loadCurrency, loadOwnedGenerals } from "./logic/progress";
import { isUnlocked, type Campaign } from "./logic/campaign";
import { REGIONS, regionById, type RegionId } from "./logic/regions";
import { ExpeditionScene } from "./scenes/ExpeditionScene";
import { GameScene } from "./scenes/GameScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type Troop = { ids: string[]; power: number; hp: number };
type Runtime = Phaser.Scene & {
  root?: Phaser.GameObjects.Container;
  view?: "camp" | "formation" | "road" | "result";
  campaign?: Campaign;
  selectedRegion?: RegionId;
  party?: string[];
  run?: Expedition | null;
  settled?: boolean;
  earnedMerit?: number;
  firstClear?: boolean;
};

const mobileRoots = new WeakMap<object, Phaser.GameObjects.Container>();
const boundScenes = new WeakSet<object>();
const ART: Record<string, string> = {
  gen_hakuen: "st-general-hakuen",
  gen_soujin: "st-general-soujin",
  gen_kohei: "st-general-kohei",
  gen_ashigaru: "st-general-ashigaru",
};

function invoke(scene: Runtime, key: string, ...args: unknown[]): unknown {
  const fn = Reflect.get(scene, key);
  return typeof fn === "function" ? (fn as (...values: unknown[]) => unknown).apply(scene, args) : undefined;
}

function label(scene: Phaser.Scene, root: Phaser.GameObjects.Container, x: number, y: number, value: string, size = 14, color = "#fff0d4", weight = "800"): Phaser.GameObjects.Text {
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

function panel(scene: Phaser.Scene, root: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, fill = 0x171313, border = 0xd4a65e, alpha = 0.93, radius = 12): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.3).fillRoundedRect(x - w / 2 + 3, y - h / 2 + 4, w, h, radius);
  g.fillStyle(fill, alpha).fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  g.fillStyle(0xffffff, 0.06).fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, Math.max(5, h * 0.16), radius * 0.7);
  g.lineStyle(1.5, border, 0.76).strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  root.add(g);
  return g;
}

function button(scene: Runtime, root: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, value: string, action: () => void, enabled = true, accent = 0xa72f22): void {
  const g = scene.add.graphics();
  const paint = (down = false) => {
    g.clear();
    const color = !enabled ? 0x373131 : down ? 0x7e221b : accent;
    g.fillStyle(0x000000, 0.3).fillRoundedRect(x - w / 2 + 3, y - h / 2 + 4, w, h, 13);
    g.fillStyle(color, 0.98).fillRoundedRect(x - w / 2, y - h / 2, w, h, 13);
    g.fillStyle(0xffffff, enabled ? 0.1 : 0.03).fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, h * 0.28, 10);
    g.lineStyle(1.7, enabled ? 0xe7ba70 : 0x66605d, enabled ? 0.84 : 0.4).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 13);
  };
  paint();
  root.add(g);
  label(scene, root, x, y, value, h >= 54 ? 15 : 12, enabled ? "#fff2d4" : "#8e8580", "900");
  const hit = scene.add.zone(x, y, w, Math.max(48, h)).setInteractive({ useHandCursor: enabled });
  root.add(hit);
  hit.on("pointerdown", () => { if (enabled) { paint(true); action(); } });
  hit.on("pointerup", () => paint(false));
  hit.on("pointerout", () => paint(false));
}

function portrait(scene: Phaser.Scene, root: Phaser.GameObjects.Container, id: string, x: number, y: number, w: number, h: number): void {
  panel(scene, root, x, y, w, h, 0x181416, 0x92734d, 0.96, 9);
  const key = ART[id];
  if (key && scene.textures.exists(key)) {
    const image = scene.add.image(x, y - 5, key).setDisplaySize(w - 10, h - 18);
    root.add(image);
  }
  const general = GENERAL_POOL.find((item) => item.id === id);
  label(scene, root, x, y + h / 2 - 10, general?.name ?? "武将", 9, "#fff1d5", "900");
}

function background(scene: Phaser.Scene, root: Phaser.GameObjects.Container, tint = 0xffffff): void {
  if (scene.textures.exists("st-bg-battlefield")) {
    const bg = scene.add.image(400, 225, "st-bg-battlefield").setDisplaySize(800, 450).setTint(tint);
    root.add(bg);
  } else {
    const g = scene.add.graphics();
    g.fillGradientStyle(0x4b2118, 0x8a4327, 0x19100e, 0x261611, 1, 1, 1, 1).fillRect(0, 0, 800, 450);
    root.add(g);
  }
  const shade = scene.add.graphics();
  shade.fillStyle(0x120b09, 0.56).fillRect(0, 0, 800, 66);
  shade.fillStyle(0x0a0808, 0.28).fillRect(0, 350, 800, 100);
  root.add(shade);
}

function destroyMobile(scene: Runtime): void {
  mobileRoots.get(scene)?.destroy(true);
  mobileRoots.delete(scene);
}

function header(scene: Runtime, root: Phaser.GameObjects.Container, title: string, subtitle: string): void {
  label(scene, root, 22, 25, title, 25, "#fff0d1", "900").setOrigin(0, 0.5).setStroke("#7d1f17", 5);
  label(scene, root, 24, 51, subtitle, 9, "#e5c893", "700").setOrigin(0, 0.5);
  if (scene.campaign) {
    panel(scene, root, 670, 29, 230, 38, 0x171211, 0xd2a65f, 0.9, 10);
    label(scene, root, 670, 29, `銭 ${loadCurrency()}   功績 ${scene.campaign.merit}   踏破 ${scene.campaign.cleared.length}/3`, 11, "#f7deb1", "900");
  }
}

function renderCamp(scene: Runtime, root: Phaser.GameObjects.Container): void {
  if (!scene.campaign || !scene.selectedRegion) return;
  const region = regionById(scene.selectedRegion);
  const troop = invoke(scene, "troop") as Troop | undefined;
  const canSortie = !!troop?.ids.length && isUnlocked(scene.campaign, scene.selectedRegion);
  const preview = canSortie && troop ? newExpedition(troop as never, scene.selectedRegion) : null;
  const win = preview ? Math.round(victoryChance(preview) * 100) : 0;

  header(scene, root, "三国ポチポチ", "戦略地図 — 武将を率い、天下への道を選べ");

  panel(scene, root, 285, 243, 520, 332, 0x17110f, region.accent, 0.62, 16);
  const map = scene.add.graphics();
  root.add(map);
  const pts = [{ x: 115, y: 330 }, { x: 285, y: 245 }, { x: 455, y: 145 }];
  map.lineStyle(5, 0xf0c06a, 0.7).beginPath().moveTo(115, 330).lineTo(285, 245).lineTo(455, 145).strokePath();
  for (let i = 0; i < 24; i++) {
    const t = i / 23;
    const x = t < 0.5 ? 115 + (285 - 115) * (t * 2) : 285 + (455 - 285) * ((t - 0.5) * 2);
    const y = t < 0.5 ? 330 + (245 - 330) * (t * 2) : 245 + (145 - 245) * ((t - 0.5) * 2);
    map.fillStyle(0xffe7ac, 0.8).fillCircle(x, y, i % 5 === 0 ? 4 : 2);
  }

  REGIONS.forEach((r, i) => {
    const p = pts[i]!;
    const unlocked = isUnlocked(scene.campaign!, r.id);
    const selected = r.id === scene.selectedRegion;
    const cleared = scene.campaign!.cleared.includes(r.id);
    map.fillStyle(selected ? 0x8c241b : 0x171313, 0.98).fillCircle(p.x, p.y, selected ? 29 : 24);
    map.lineStyle(selected ? 4 : 2, unlocked ? 0xf0c06a : 0x67615f, unlocked ? 0.95 : 0.5).strokeCircle(p.x, p.y, selected ? 29 : 24);
    map.fillStyle(unlocked ? (cleared ? 0xd6ad55 : 0xb33227) : 0x515050, 1).fillRect(p.x - 9, p.y - 9, 18, 19);
    label(scene, root, p.x, p.y - 43, cleared ? `第${i + 1}章 踏破` : unlocked ? `第${i + 1}章` : "未開放", 10, unlocked ? "#ffe4b2" : "#aaa19a", "900");
    label(scene, root, p.x, p.y + 40, r.name, 13, unlocked ? "#fff0d0" : "#978e88", "900");
    const hit = scene.add.zone(p.x, p.y, 105, 98).setInteractive({ useHandCursor: unlocked });
    root.add(hit);
    hit.on("pointerdown", () => {
      if (!unlocked) return;
      scene.selectedRegion = r.id;
      invoke(scene, "render");
    });
  });

  panel(scene, root, 665, 218, 240, 286, 0x141111, region.accent, 0.94, 15);
  label(scene, root, 665, 93, `第${REGIONS.findIndex((item) => item.id === region.id) + 1}章`, 10, "#dcb977", "900");
  label(scene, root, 665, 119, region.name, 23, "#fff0d1", "900");
  label(scene, root, 665, 148, region.subtitle, 10, "#dac6a7", "700");
  label(scene, root, 665, 177, `守将  ${region.boss}`, 12, "#f2cf98", "900");
  label(scene, root, 665, 209, `勝率  ${win}%`, 22, win >= 70 ? "#9fe0b6" : "#efc779", "900");
  label(scene, root, 665, 239, `収穫 ×${region.reward.toFixed(1)}\n初踏破 功績+5 / Rare装備`, 11, "#ebd6b0", "700");

  const party = scene.party ?? [];
  party.slice(0, 3).forEach((id, i) => portrait(scene, root, id, 596 + i * 70, 303, 62, 82));
  if (!party.length) label(scene, root, 665, 303, "編成で武将を選ぼう", 11, "#bfae92", "700");

  button(scene, root, 596, 389, 100, 50, "編成", () => { scene.view = "formation"; invoke(scene, "render"); }, true, 0x3d4b50);
  button(scene, root, 700, 389, 184, 54, "出陣", () => {
    if (!troop || !canSortie || !scene.selectedRegion) return;
    scene.run = newExpedition(troop as never, scene.selectedRegion);
    saveExpedition(scene.run);
    scene.settled = false;
    scene.view = "road";
    invoke(scene, "render");
  }, canSortie, 0xa72f22);
}

function renderFormation(scene: Runtime, root: Phaser.GameObjects.Container): void {
  if (!scene.campaign) return;
  header(scene, root, "遠征の支度", "3人を選び、役割を組み合わせる");
  const owned = loadOwnedGenerals();
  GENERAL_POOL.forEach((general, i) => {
    const x = 130 + (i % 2) * 250;
    const y = 140 + Math.floor(i / 2) * 135;
    const has = (owned[general.id] ?? 0) > 0;
    const selected = scene.party?.includes(general.id) ?? false;
    panel(scene, root, x, y, 225, 116, selected ? 0x493126 : 0x171313, selected ? 0xe9bd70 : 0x79664d, has ? 0.96 : 0.58, 13);
    if (ART[general.id] && scene.textures.exists(ART[general.id]!)) {
      const img = scene.add.image(x - 67, y - 2, ART[general.id]!).setDisplaySize(78, 102).setAlpha(has ? 1 : 0.4);
      root.add(img);
    }
    label(scene, root, x + 35, y - 29, `${selected ? "● " : ""}${general.name}  ${general.rarity}`, 13, has ? "#fff0d3" : "#8d8580", "900");
    label(scene, root, x + 35, y + 2, `${ROLES[general.id] ?? "武将"}`, 11, "#e1bd7d", "800");
    label(scene, root, x + 35, y + 28, has ? "タップで編成切替" : "未所持", 9, "#c4b59e", "700");
    const hit = scene.add.zone(x, y, 225, 116).setInteractive({ useHandCursor: has });
    root.add(hit);
    hit.on("pointerdown", () => {
      if (!has) return;
      const party = scene.party ?? [];
      if (selected) scene.party = party.filter((id) => id !== general.id);
      else if (party.length < 3) scene.party = [...party, general.id];
      saveParty(scene.party ?? []);
      invoke(scene, "render");
    });
  });

  const troop = invoke(scene, "troop") as Troop | undefined;
  panel(scene, root, 665, 220, 240, 300, 0x141111, 0xc09a59, 0.94, 15);
  label(scene, root, 665, 106, "遠征部隊", 12, "#dcb977", "900");
  label(scene, root, 665, 142, `${scene.party?.length ?? 0} / 3`, 27, "#fff0d1", "900");
  label(scene, root, 665, 183, `戦力 ${troop?.power ?? 0}`, 22, "#9fe0b6", "900");
  label(scene, root, 665, 225, "役割", 10, "#d4bd98", "900");
  label(scene, root, 665, 264, (scene.party ?? []).map((id) => ROLES[id] ?? "武将").join(" / ") || "未編成", 11, "#f0dfc0", "800");
  label(scene, root, 665, 306, "敗走しても\n武将・装備は失わない", 10, "#b9c8be", "700");
  button(scene, root, 665, 368, 205, 54, "戦略地図へ", () => { scene.view = "camp"; invoke(scene, "render"); }, !!scene.party?.length, 0xa72f22);
}

function renderRoad(scene: Runtime, root: Phaser.GameObjects.Container): void {
  const run = scene.run;
  if (!run) return;
  const region = regionById(run.regionId);
  const boss = run.step === 9;
  header(scene, root, region.name, `進軍 ${run.step}/10 — ${boss ? "FINAL ENCOUNTER" : run.route === "mountain" ? "山道" : "街道"}`);

  const stageShade = scene.add.graphics();
  stageShade.fillStyle(0x0c1012, 0.16).fillRect(0, 64, 535, 386);
  root.add(stageShade);
  run.troop.ids.forEach((id, i) => {
    const x = 90 + i * 92;
    const y = 310 - i * 18;
    const key = ART[id];
    if (key && scene.textures.exists(key)) {
      const img = scene.add.image(x, y, key).setDisplaySize(i === 0 ? 142 : 104, i === 0 ? 190 : 142);
      root.add(img);
    }
  });
  if (boss && scene.textures.exists("st-boss-gatekeeper")) {
    const enemy = scene.add.image(420, 230, "st-boss-gatekeeper").setDisplaySize(215, 285).setFlipX(true);
    root.add(enemy);
    label(scene, root, 420, 389, region.boss, 14, "#ffd1b9", "900");
  } else if (scene.textures.exists("st-general-ashigaru")) {
    [0, 1, 2].forEach((i) => {
      const enemy = scene.add.image(360 + i * 55, 272 + i * 13, "st-general-ashigaru").setDisplaySize(74, 100).setFlipX(true).setTint(0xc58f91);
      root.add(enemy);
    });
  }

  panel(scene, root, 665, 225, 240, 320, 0x111518, boss ? 0xb44737 : region.accent, 0.95, 15);
  label(scene, root, 665, 93, boss ? "関門戦" : "遠征状況", 12, "#e7c47e", "900");
  label(scene, root, 665, 132, `兵力 ${run.hp}`, 25, run.hp < 35 ? "#ef9d89" : "#eef0da", "900");
  label(scene, root, 665, 169, `持帰り予定 ${run.loot} 銭`, 13, "#f0ce8b", "900");
  label(scene, root, 665, 203, `次戦勝率 ${Math.round(victoryChance(run) * 100)}%`, 16, "#b9e0c7", "900");

  if (run.fork) {
    button(scene, root, 612, 265, 102, 52, "街道", () => invoke(scene, "route", "road"), true, 0x4a5960);
    button(scene, root, 718, 265, 102, 52, "山道 ×1.7", () => invoke(scene, "route", "mountain"), true, 0x78502f);
  } else {
    button(scene, root, 665, 267, 205, 56, boss ? "守将に挑む" : "進軍する", () => invoke(scene, "advance"), true, boss ? 0xa72f22 : 0x536b55);
  }
  button(scene, root, 665, 332, 205, 50, `${run.loot} 銭を確保して帰還`, () => {
    scene.run = returnExpedition(run);
    invoke(scene, "settle");
  }, true, 0x3d4b50);
  label(scene, root, 665, 385, `敗走時 ${Math.floor(run.loot / 2)} 銭\n進行は自動保存`, 10, "#aeb8b3", "700");
}

function renderResult(scene: Runtime, root: Phaser.GameObjects.Container): void {
  const run = scene.run;
  if (!run || !scene.campaign) return;
  header(scene, root, run.status === "clear" ? "関門突破" : run.status === "defeat" ? "遠征終了" : "無事帰還", "遠征の記録");
  panel(scene, root, 290, 240, 500, 310, 0x151313, 0xc7a159, 0.94, 16);
  run.troop.ids.forEach((id, i) => portrait(scene, root, id, 125 + i * 160, 215, 126, 170));
  label(scene, root, 290, 344, `到達 ${run.step}/10   ·   兵力 ${run.hp}`, 14, "#e8d6b8", "800");

  panel(scene, root, 665, 225, 240, 310, 0x151313, 0xd3a657, 0.96, 15);
  label(scene, root, 665, 105, "戦果", 11, "#dcb977", "900");
  label(scene, root, 665, 151, `${run.loot} 銭`, 30, "#f4cb7f", "900");
  label(scene, root, 665, 198, run.status === "clear" ? "Rare装備 +1" : run.status !== "defeat" && run.step >= 3 ? "Common装備 +1" : "装備報酬なし", 12, "#f1dfc0", "800");
  label(scene, root, 665, 234, `功績 +${scene.earnedMerit ?? 0}`, 16, "#9cdbc3", "900");
  button(scene, root, 665, 298, 205, 54, "戦略地図へ", () => {
    const next = REGIONS.find((r) => isUnlocked(scene.campaign!, r.id) && !scene.campaign!.cleared.includes(r.id));
    scene.view = "camp";
    scene.run = null;
    if (next) scene.selectedRegion = next.id;
    invoke(scene, "render");
  }, true, 0xa72f22);
  button(scene, root, 665, 360, 205, 48, "拠点へ", () => scene.scene.start("GameScene"), true, 0x3d4b50);
}

function renderLandscape(scene: Runtime): void {
  destroyMobile(scene);
  const layout = getResponsiveLayout(scene as never);
  if (!layout || layout.isPortrait) {
    scene.root?.setVisible(true);
    return;
  }
  scene.root?.setVisible(false);
  const root = scene.add.container(0, 0).setDepth(5000);
  mobileRoots.set(scene, root);
  const tint = regionById(scene.run?.regionId ?? scene.selectedRegion ?? "plains").tint;
  background(scene, root, tint);
  if (scene.view === "formation") renderFormation(scene, root);
  else if (scene.view === "road") renderRoad(scene, root);
  else if (scene.view === "result") renderResult(scene, root);
  else renderCamp(scene, root);
}

function bindExpeditionOrientation(scene: Runtime): void {
  if (boundScenes.has(scene)) return;
  boundScenes.add(scene);
  bindResponsiveScene(scene as never, (layout: ViewportLayout) => {
    const target = layout.isPortrait ? { width: 450, height: 800 } : { width: 800, height: 450 };
    if (scene.scale.gameSize.width !== target.width || scene.scale.gameSize.height !== target.height) {
      scene.scale.resize(target.width, target.height);
    }
    invoke(scene, "render");
  });
}

export function installSangokuMobileLayout(): void {
  const expeditionProto = ExpeditionScene.prototype as unknown as MethodTable;
  const originalCreate = expeditionProto.create;
  const originalRender = expeditionProto.render;
  if (originalCreate && !expeditionProto.__mobileCreate) {
    expeditionProto.__mobileCreate = originalCreate;
    expeditionProto.create = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalCreate.apply(this, args);
      bindExpeditionOrientation(this as Runtime);
      return result;
    };
  }
  if (originalRender && !expeditionProto.__mobileRender) {
    expeditionProto.__mobileRender = originalRender;
    expeditionProto.render = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      const result = originalRender.apply(this, args);
      renderLandscape(this as Runtime);
      return result;
    };
  }

  // Management screens remain portrait-first so gacha/equipment flows stay intact.
  const gameProto = GameScene.prototype as unknown as MethodTable;
  const gameCreate = gameProto.create;
  if (gameCreate && !gameProto.__mobileCreate) {
    gameProto.__mobileCreate = gameCreate;
    gameProto.create = function (this: Phaser.Scene, ...args: unknown[]): unknown {
      if (this.scale.gameSize.width !== 450 || this.scale.gameSize.height !== 800) this.scale.resize(450, 800);
      return gameCreate.apply(this, args);
    };
  }
}

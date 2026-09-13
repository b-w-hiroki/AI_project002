import Phaser from "phaser";
import { getResponsiveLayout } from "../../shared/mobile";
import { contractCost, fulfillContract } from "./logic/contracts";
import {
  GENERATORS,
  PRESTIGE_UNLOCK,
  buyClickUpgrades,
  buyGenerator,
  buyOfflineExtension,
  click,
  essenceMultiplier,
  essenceOnPrestige,
  formatNumber,
  generatorCost,
  offlineCapSec,
  offlineExtensionCost,
  prestige,
  productionPerSec,
  type GameState,
} from "./logic/economy";
import { save } from "./logic/save";
import { townForPrestige } from "./logic/towns";
import { IdleScene } from "./scenes/IdleScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type Runtime = Phaser.Scene & { state?: GameState };

type MobileUi = {
  root: Phaser.GameObjects.Container;
  orientation: "portrait" | "landscape";
  potionText: Phaser.GameObjects.Text;
  rateText: Phaser.GameObjects.Text;
  essenceText: Phaser.GameObjects.Text;
  reputationText: Phaser.GameObjects.Text;
  townText: Phaser.GameObjects.Text;
  orderTexts: Phaser.GameObjects.Text[];
  recommendationText: Phaser.GameObjects.Text;
  clickUpgradeText: Phaser.GameObjects.Text;
  offlineText: Phaser.GameObjects.Text;
  prestigeText: Phaser.GameObjects.Text;
  productionTexts: Phaser.GameObjects.Text[];
  prestigeBar: Phaser.GameObjects.Graphics;
  hero?: Phaser.GameObjects.Image;
  cauldron?: Phaser.GameObjects.Image;
  brewX: number;
  brewY: number;
};

const uiByScene = new WeakMap<object, MobileUi>();

function text(scene: Phaser.Scene, root: Phaser.GameObjects.Container, x: number, y: number, value: string, size: number, color = "#fff6e7", weight = "800"): Phaser.GameObjects.Text {
  const node = scene.add.text(x, y, value, {
    fontFamily: '"Hiragino Sans", "Yu Gothic", sans-serif',
    fontSize: `${size}px`,
    fontStyle: weight,
    color,
    align: "center",
    lineSpacing: 3,
  }).setOrigin(0.5);
  root.add(node);
  return node;
}

function panel(scene: Phaser.Scene, root: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, fill = 0x3d2c24, border = 0xd9b66c, alpha = 0.91, radius = 15): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x1b100c, 0.22).fillRoundedRect(x - w / 2 + 3, y - h / 2 + 5, w, h, radius);
  g.fillStyle(fill, alpha).fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  g.fillStyle(0xffffff, 0.08).fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, Math.max(6, h * 0.15), radius * 0.72);
  g.lineStyle(1.5, border, 0.72).strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  root.add(g);
  return g;
}

function hitButton(scene: Runtime, root: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, action: () => void): Phaser.GameObjects.Zone {
  const zone = scene.add.zone(x, y, Math.max(52, w), Math.max(52, h)).setInteractive({ useHandCursor: true });
  root.add(zone);
  zone.on("pointerdown", action);
  return zone;
}

function background(scene: Phaser.Scene, root: Phaser.GameObjects.Container, width: number, height: number): void {
  if (scene.textures.exists("pw-bg-workshop")) {
    const bg = scene.add.image(width / 2, height / 2, "pw-bg-workshop").setDisplaySize(width, height);
    root.add(bg);
  } else {
    const g = scene.add.graphics();
    g.fillGradientStyle(0xcceaff, 0xe8f7ff, 0xfff4d8, 0xf2d9b7, 1, 1, 1, 1).fillRect(0, 0, width, height);
    root.add(g);
  }
  const tint = scene.add.graphics();
  tint.fillStyle(0x4f2d19, 0.16).fillRect(0, 0, width, height);
  tint.fillStyle(0x281710, 0.52).fillRect(0, 0, width, 70);
  root.add(tint);
}

function addButtonChrome(scene: Phaser.Scene, root: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, accent: number): void {
  const g = scene.add.graphics();
  g.fillStyle(accent, 0.94).fillRoundedRect(x - w / 2, y - h / 2, w, h, 12);
  g.fillStyle(0xffffff, 0.1).fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, h * 0.25, 9);
  g.lineStyle(1.4, 0xffffff, 0.42).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 12);
  root.add(g);
}

function updateState(scene: Runtime, next: GameState | null): boolean {
  if (!next) return false;
  scene.state = next;
  save(next, localStorage, Date.now());
  return true;
}

function brew(scene: Runtime, ui: MobileUi): void {
  if (!scene.state) return;
  const gain = scene.state.clickPower * essenceMultiplier(scene.state);
  scene.state = click(scene.state);
  const targets = [ui.hero, ui.cauldron].filter(Boolean) as Phaser.GameObjects.GameObject[];
  if (targets.length) scene.tweens.add({ targets, scaleX: "*=0.95", scaleY: "*=0.95", duration: 70, yoyo: true, ease: "Sine.easeOut" });
  const popup = scene.add.text(ui.brewX, ui.brewY - 80, `+${formatNumber(gain)}`, {
    fontFamily: '"Hiragino Sans", "Yu Gothic", sans-serif',
    fontSize: "18px",
    fontStyle: "900",
    color: "#78ffd0",
    stroke: "#315747",
    strokeThickness: 4,
  }).setOrigin(0.5).setDepth(6000);
  ui.root.add(popup);
  scene.tweens.add({ targets: popup, y: popup.y - 36, alpha: 0, duration: 650, onComplete: () => popup.destroy() });
}

function recommended(state: GameState): { id: string; name: string; cost: number; count: number } {
  const options = GENERATORS.map((def) => ({
    id: def.id,
    name: def.name,
    cost: generatorCost(def, state.counts[def.id] ?? 0),
    count: state.counts[def.id] ?? 0,
  }));
  const affordable = options.filter((item) => item.cost <= state.potions);
  return (affordable.length ? affordable[affordable.length - 1] : options.sort((a, b) => a.cost - b.cost)[0])!;
}

function build(scene: Runtime, orientation: "portrait" | "landscape"): MobileUi {
  const old = uiByScene.get(scene);
  if (old) old.root.destroy(true);

  const portrait = orientation === "portrait";
  const width = portrait ? 450 : 800;
  const height = portrait ? 800 : 450;
  const root = scene.add.container(0, 0).setDepth(5600);
  background(scene, root, width, height);

  // Blocks all old fixed-layout controls while the responsive surface is active.
  const blocker = scene.add.zone(width / 2, height / 2, width, height).setInteractive();
  root.add(blocker);

  text(scene, root, 22, 26, "ポーション工房", portrait ? 25 : 27, "#fff7e5", "900").setOrigin(0, 0.5).setStroke("#60351f", 5);
  text(scene, root, 24, 52, "Potion Workshop — 錬金術師と工房を育てる", 9, "#f2d8aa", "700").setOrigin(0, 0.5);

  const potionText = text(scene, root, portrait ? 340 : 545, 25, "", portrait ? 15 : 16, "#fff2cd", "900");
  const essenceText = text(scene, root, portrait ? 340 : 665, 49, "", 10, "#e3c4ff", "900");
  const reputationText = text(scene, root, portrait ? 416 : 764, 49, "", 10, "#bff0cf", "900").setOrigin(1, 0.5);
  const townText = text(scene, root, portrait ? 110 : 694, 25, "", 10, "#f5dcae", "800");

  const heroX = portrait ? 165 : 150;
  const heroY = portrait ? 205 : 202;
  const brewX = portrait ? 225 : 335;
  const brewY = portrait ? 365 : 246;
  let hero: Phaser.GameObjects.Image | undefined;
  let cauldron: Phaser.GameObjects.Image | undefined;
  if (scene.textures.exists("pw-hero-alchemist")) {
    hero = scene.add.image(heroX, heroY, "pw-hero-alchemist").setDisplaySize(portrait ? 250 : 230, portrait ? 250 : 230);
    root.add(hero);
  }
  if (scene.textures.exists("pw-cauldron-icon")) {
    cauldron = scene.add.image(brewX, brewY, "pw-cauldron-icon").setDisplaySize(portrait ? 155 : 170, portrait ? 155 : 170);
    root.add(cauldron);
  } else {
    const pot = scene.add.graphics();
    pot.fillStyle(0x26303b, 1).fillEllipse(brewX, brewY, 145, 90);
    pot.fillStyle(0x7de6b0, 0.7).fillEllipse(brewX, brewY - 34, 118, 30);
    root.add(pot);
  }
  const glow = scene.add.graphics();
  glow.fillStyle(0x7de6b0, 0.16).fillCircle(brewX, brewY, portrait ? 90 : 100);
  glow.lineStyle(2, 0xd5ffd8, 0.48).strokeCircle(brewX, brewY, portrait ? 82 : 92);
  root.add(glow);
  text(scene, root, brewX, brewY + (portrait ? 92 : 99), "ポーション製造", 13, "#fff8df", "900");
  text(scene, root, brewX, brewY + (portrait ? 112 : 119), "TAP!", 18, "#9dffd0", "900");
  hitButton(scene, root, brewX, brewY, portrait ? 190 : 210, portrait ? 205 : 220, () => brew(scene, uiByScene.get(scene)!));

  const rateText = text(scene, root, portrait ? 225 : 250, portrait ? 493 : 390, "", 12, "#fff1d0", "900");

  const orderTexts: Phaser.GameObjects.Text[] = [];
  const productionTexts: Phaser.GameObjects.Text[] = [];
  let recommendationText: Phaser.GameObjects.Text;
  let clickUpgradeText: Phaser.GameObjects.Text;
  let offlineText: Phaser.GameObjects.Text;
  let prestigeText: Phaser.GameObjects.Text;
  const prestigeBar = scene.add.graphics();
  root.add(prestigeBar);

  if (portrait) {
    panel(scene, root, 225, 562, 420, 112, 0x423124, 0xd4b36e, 0.92, 15);
    text(scene, root, 38, 522, "本日の依頼", 10, "#f6dcaa", "900").setOrigin(0, 0.5);
    [0, 1].forEach((index) => {
      const x = index === 0 ? 120 : 330;
      addButtonChrome(scene, root, x, 564, 190, 66, index === 0 ? 0x3e765d : 0x4c6e8c);
      const labelNode = text(scene, root, x, 564, "", 10, "#ffffff", "900");
      orderTexts.push(labelNode);
      hitButton(scene, root, x, 564, 190, 66, () => {
        if (!scene.state) return;
        updateState(scene, fulfillContract(scene.state, index));
      });
    });

    panel(scene, root, 225, 655, 420, 62, 0x3c2d25, 0xd4b36e, 0.92, 14);
    recommendationText = text(scene, root, 178, 655, "", 11, "#fff2d6", "900");
    addButtonChrome(scene, root, 370, 655, 90, 42, 0x2e8f65);
    text(scene, root, 370, 655, "強化", 11, "#ffffff", "900");
    hitButton(scene, root, 370, 655, 90, 48, () => {
      if (!scene.state) return;
      const rec = recommended(scene.state);
      updateState(scene, buyGenerator(scene.state, rec.id));
    });

    panel(scene, root, 225, 728, 420, 70, 0x2f2927, 0x9b7d57, 0.9, 13);
    const mgmtX = [85, 225, 365];
    clickUpgradeText = text(scene, root, mgmtX[0]!, 718, "", 9, "#f9e8c9", "900");
    offlineText = text(scene, root, mgmtX[1]!, 718, "", 9, "#d7ecff", "900");
    prestigeText = text(scene, root, mgmtX[2]!, 718, "", 9, "#ead5ff", "900");
    hitButton(scene, root, mgmtX[0]!, 718, 118, 54, () => scene.state && updateState(scene, buyClickUpgrades(scene.state, 1)));
    hitButton(scene, root, mgmtX[1]!, 718, 118, 54, () => scene.state && updateState(scene, buyOfflineExtension(scene.state)));
    hitButton(scene, root, mgmtX[2]!, 718, 118, 54, () => scene.state && updateState(scene, prestige(scene.state)));

    const prodY = 780;
    GENERATORS.slice(0, 4).forEach((def, i) => {
      const x = 58 + i * 112;
      const p = text(scene, root, x, prodY, "", 8, "#fff7e5", "800");
      productionTexts.push(p);
    });
  } else {
    panel(scene, root, 588, 170, 388, 190, 0x423124, 0xd4b36e, 0.93, 16);
    text(scene, root, 420, 95, "本日の依頼", 10, "#f6dcaa", "900").setOrigin(0, 0.5);
    [0, 1].forEach((index) => {
      const y = 132 + index * 68;
      addButtonChrome(scene, root, 588, y, 340, 56, index === 0 ? 0x3e765d : 0x4c6e8c);
      const node = text(scene, root, 588, y, "", 11, "#ffffff", "900");
      orderTexts.push(node);
      hitButton(scene, root, 588, y, 340, 56, () => {
        if (!scene.state) return;
        updateState(scene, fulfillContract(scene.state, index));
      });
    });

    panel(scene, root, 588, 292, 388, 70, 0x3c2d25, 0xd4b36e, 0.93, 14);
    recommendationText = text(scene, root, 535, 292, "", 11, "#fff2d6", "900");
    addButtonChrome(scene, root, 720, 292, 90, 44, 0x2e8f65);
    text(scene, root, 720, 292, "強化", 11, "#ffffff", "900");
    hitButton(scene, root, 720, 292, 90, 50, () => {
      if (!scene.state) return;
      const rec = recommended(scene.state);
      updateState(scene, buyGenerator(scene.state, rec.id));
    });

    panel(scene, root, 588, 365, 388, 60, 0x2f2927, 0x9b7d57, 0.91, 13);
    clickUpgradeText = text(scene, root, 474, 365, "", 9, "#f9e8c9", "900");
    offlineText = text(scene, root, 590, 365, "", 9, "#d7ecff", "900");
    prestigeText = text(scene, root, 704, 365, "", 9, "#ead5ff", "900");
    hitButton(scene, root, 474, 365, 105, 52, () => scene.state && updateState(scene, buyClickUpgrades(scene.state, 1)));
    hitButton(scene, root, 590, 365, 105, 52, () => scene.state && updateState(scene, buyOfflineExtension(scene.state)));
    hitButton(scene, root, 704, 365, 105, 52, () => scene.state && updateState(scene, prestige(scene.state)));

    panel(scene, root, 400, 426, 760, 42, 0x2f2927, 0xa8895d, 0.9, 12);
    GENERATORS.slice(0, 6).forEach((def, i) => {
      const x = 85 + i * 126;
      const p = text(scene, root, x, 426, "", 8, "#fff7e5", "800");
      productionTexts.push(p);
    });
  }

  const ui: MobileUi = {
    root,
    orientation,
    potionText,
    rateText,
    essenceText,
    reputationText,
    townText,
    orderTexts,
    recommendationText,
    clickUpgradeText,
    offlineText,
    prestigeText,
    productionTexts,
    prestigeBar,
    hero,
    cauldron,
    brewX,
    brewY,
  };
  uiByScene.set(scene, ui);
  return ui;
}

function refresh(scene: Runtime): void {
  if (!scene.state) return;
  const layout = getResponsiveLayout(scene as never);
  if (!layout) return;
  const orientation = layout.isPortrait ? "portrait" : "landscape";
  let ui = uiByScene.get(scene);
  if (!ui || ui.orientation !== orientation) ui = build(scene, orientation);

  const state = scene.state;
  const rec = recommended(state);
  const rate = productionPerSec(state);
  const town = townForPrestige(state.prestigeCount);
  ui.potionText.setText(`${formatNumber(state.potions)} potions`);
  ui.rateText.setText(`+${formatNumber(rate)}/秒   ·   TAP +${formatNumber(state.clickPower * essenceMultiplier(state))}`);
  ui.essenceText.setText(`Essence ${formatNumber(state.essence)}`);
  ui.reputationText.setText(`REP ${state.reputation}`);
  ui.townText.setText(`🏘 ${town.name}`);

  ui.orderTexts.forEach((node, index) => {
    const done = state.completedContracts.includes(index);
    const cost = contractCost(state, index);
    node.setText(done
      ? `${index === 0 ? "常備薬" : "商隊納品"}\n納品済み ✓`
      : `${index === 0 ? "常備薬" : "商隊納品"}  ${formatNumber(cost)}\n+${index === 0 ? 1 : 3} 評判`);
    node.setAlpha(done ? 0.55 : 1);
  });

  ui.recommendationText.setText(`おすすめ  ${rec.name} Lv.${rec.count}\n次 ${formatNumber(rec.cost)}`);
  const clickCost = (() => {
    const next = buyClickUpgrades({ ...state, potions: Number.MAX_SAFE_INTEGER }, 1);
    if (!next) return 0;
    return Math.max(0, state.potions - (buyClickUpgrades(state, 1)?.potions ?? state.potions));
  })();
  ui.clickUpgradeText.setText(`TAP強化\nLv.${state.clickPower}${clickCost > 0 ? ` ${formatNumber(clickCost)}` : ""}`);
  const offlineCost = offlineExtensionCost(state);
  ui.offlineText.setText(`放置 ${Math.round(offlineCapSec(state) / 3600)}h\n${offlineCost === null ? "MAX" : `${offlineCost} Essence`}`);
  const essenceGain = essenceOnPrestige(state);
  ui.prestigeText.setText(`転生\n${essenceGain > 0 ? `+${essenceGain} Essence` : `${Math.floor((state.totalBrewed / PRESTIGE_UNLOCK) * 100)}%`}`);

  ui.prestigeBar.clear();
  const ratio = Phaser.Math.Clamp(state.totalBrewed / PRESTIGE_UNLOCK, 0, 1);
  const width = ui.orientation === "portrait" ? 105 : 95;
  const x = ui.orientation === "portrait" ? 365 : 704;
  const y = ui.orientation === "portrait" ? 746 : 393;
  ui.prestigeBar.fillStyle(0x4b3d57, 0.8).fillRoundedRect(x - width / 2, y, width, 5, 3);
  ui.prestigeBar.fillStyle(0xb77de6, 1).fillRoundedRect(x - width / 2, y, width * ratio, 5, 3);

  const defs = GENERATORS.slice(0, ui.productionTexts.length);
  ui.productionTexts.forEach((node, i) => {
    const def = defs[i]!;
    node.setText(`${def.name.replace("錬金術師", "錬金")}\n×${state.counts[def.id] ?? 0}`);
  });
}

export function installPotionMobileLayout(): void {
  const proto = IdleScene.prototype as unknown as MethodTable;
  const originalUpdate = proto.update;
  if (proto.__mobileLayoutUpdate) return;
  proto.__mobileLayoutUpdate = originalUpdate ?? (() => undefined);
  proto.update = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = originalUpdate?.apply(this, args);
    refresh(this as Runtime);
    return result;
  };
}

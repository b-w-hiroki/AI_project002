import Phaser from "phaser";
import { contractCost, demandMultiplier } from "./logic/contracts";
import {
  GENERATORS,
  PRESTIGE_UNLOCK,
  buyClickUpgrades,
  buyGenerator,
  clickUpgradeCostForQuantity,
  formatNumber,
  generatorCost,
  productionPerSec,
  type GameState,
} from "./logic/economy";
import { townForPrestige } from "./logic/towns";
import { sfx } from "./platform/audio";
import { IdleScene } from "./scenes/IdleScene";

type ActionCardLike = {
  container: Phaser.GameObjects.Container;
};

type GeneratorRowLike = {
  id: string;
  card: {
    container: Phaser.GameObjects.Container;
  };
};

type QuantityButtonLike = {
  rect: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
};

type IdleRuntime = Phaser.Scene & {
  state?: GameState;
  lang?: "ja" | "en";
  titleText?: Phaser.GameObjects.Text;
  potionText?: Phaser.GameObjects.Text;
  rateText?: Phaser.GameObjects.Text;
  essenceText?: Phaser.GameObjects.Text;
  townText?: Phaser.GameObjects.Text;
  brewText?: Phaser.GameObjects.Text | null;
  clickCard?: ActionCardLike;
  offlineCard?: ActionCardLike;
  prestigeCard?: ActionCardLike;
  prestigeGlow?: Phaser.GameObjects.Graphics;
  footerStatsText?: Phaser.GameObjects.Text;
  workshopDecor?: Phaser.GameObjects.Container;
  rows?: GeneratorRowLike[];
  qtyButtons?: QuantityButtonLike[];
};

type TapState = {
  lastAt: number;
  streak: number;
};

type UpgradeTarget =
  | { kind: "click"; cost: number; label: string; benefit: string }
  | { kind: "generator"; id: string; cost: number; label: string; benefit: string };

interface WorkshopConceptUi {
  root: Phaser.GameObjects.Container;
  cauldron: Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
  magicGlow: Phaser.GameObjects.Ellipse;
  workshopLabel: Phaser.GameObjects.Text;
  repText: Phaser.GameObjects.Text;
  speechText: Phaser.GameObjects.Text;
  ordersText: Phaser.GameObjects.Text;
  upgradeName: Phaser.GameObjects.Text;
  upgradeBenefit: Phaser.GameObjects.Text;
  upgradeCost: Phaser.GameObjects.Text;
  upgradeBg: Phaser.GameObjects.Graphics;
  beltTexts: Phaser.GameObjects.Text[];
  progressFill: Phaser.GameObjects.Graphics;
  progressText: Phaser.GameObjects.Text;
  activeDrawer: Phaser.GameObjects.Container | null;
}

const tapState = new WeakMap<object, TapState>();
const uiByScene = new WeakMap<object, WorkshopConceptUi>();
const heroByScene = new WeakMap<object, Phaser.GameObjects.Image>();

const CAULDRON_X = 205;
const CAULDRON_Y = 446;
const BURST_OFFSETS = [
  { x: -46, y: -8, r: 5 },
  { x: -28, y: -34, r: 4 },
  { x: 0, y: -48, r: 6 },
  { x: 30, y: -30, r: 4 },
  { x: 48, y: -5, r: 5 },
  { x: 12, y: -62, r: 3 },
] as const;

function ja(scene: IdleRuntime, japanese: string, english: string): string {
  return scene.lang === "en" ? english : japanese;
}

function invoke(scene: IdleRuntime, key: string, ...args: unknown[]): unknown {
  const candidate = Reflect.get(scene, key);
  if (typeof candidate !== "function") return undefined;
  return (candidate as (...params: unknown[]) => unknown).apply(scene, args);
}

function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  border: number,
  alpha = 0.95,
  radius = 18,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x514936, 0.14);
  g.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 5, w, h, radius);
  g.fillStyle(fill, alpha);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  g.fillStyle(0xffffff, 0.34);
  g.fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, Math.max(7, h * 0.15), radius * 0.72);
  g.lineStyle(1.5, border, 0.72);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  return g;
}

function text(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  size: number,
  color = "#493f36",
  weight = "700",
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, value, {
      fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
      fontSize: `${size}px`,
      fontStyle: weight,
      color,
    })
    .setOrigin(0.5);
}

function makeHitButton(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  accent = 0x2f8f68,
): { bg: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text; hit: Phaser.GameObjects.Zone } {
  const bg = scene.add.graphics();
  const paint = (down = false) => {
    bg.clear();
    bg.fillStyle(down ? Phaser.Display.Color.ValueToColor(accent).darken(12).color : accent, 1);
    bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 13);
    bg.fillStyle(0xffffff, down ? 0.08 : 0.2);
    bg.fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, h * 0.32, 10);
    bg.lineStyle(1.5, 0xffffff, 0.38);
    bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 13);
  };
  paint();
  const labelObj = text(scene, x, y, label, 13, "#ffffff", "800");
  const hit = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => {
    paint(true);
    onClick();
  });
  hit.on("pointerup", () => paint(false));
  hit.on("pointerout", () => paint(false));
  root.add([bg, labelObj, hit]);
  return { bg, label: labelObj, hit };
}

function findHero(scene: IdleRuntime): Phaser.GameObjects.Image | null {
  for (const child of scene.children.list) {
    if (child instanceof Phaser.GameObjects.Image && child.texture.key === "pw-hero-alchemist") return child;
  }
  return null;
}

function hideLegacyMainUi(scene: IdleRuntime): void {
  scene.rows?.forEach((row) => row.card.container.setVisible(false));
  scene.clickCard?.container.setVisible(false);
  scene.offlineCard?.container.setVisible(false);
  scene.prestigeCard?.container.setVisible(false);
  scene.prestigeGlow?.setVisible(false);
  scene.footerStatsText?.setVisible(false);
  scene.workshopDecor?.setVisible(false);
  scene.qtyButtons?.forEach((button) => {
    button.rect.setVisible(false);
    button.label.setVisible(false);
  });
  scene.brewText?.setVisible(false);
}

function makeCauldron(scene: IdleRuntime): Phaser.GameObjects.Image | Phaser.GameObjects.Arc {
  if (scene.textures.exists("pw-cauldron-icon")) {
    return scene.add
      .image(CAULDRON_X, CAULDRON_Y, "pw-cauldron-icon")
      .setDisplaySize(190, 190)
      .setDepth(92)
      .setInteractive({ useHandCursor: true });
  }
  return scene.add
    .circle(CAULDRON_X, CAULDRON_Y, 82, 0x202a2c, 1)
    .setStrokeStyle(4, 0x9bc7b5, 0.9)
    .setDepth(92)
    .setInteractive({ useHandCursor: true });
}

function buildConceptUi(scene: IdleRuntime): WorkshopConceptUi {
  const cached = uiByScene.get(scene);
  if (cached) return cached;

  hideLegacyMainUi(scene);

  scene.titleText?.setPosition(24, 22).setOrigin(0, 0.5).setFontSize(22).setColor("#42566a");
  scene.essenceText?.setPosition(520, 58).setOrigin(0, 0.5).setFontSize(11);
  scene.townText?.setPosition(786, 80);

  const hero = findHero(scene);
  if (hero) {
    scene.tweens.killTweensOf(hero);
    hero.setPosition(200, 266).setDisplaySize(300, 300).setDepth(88);
    scene.tweens.add({
      targets: hero,
      y: 258,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    heroByScene.set(scene, hero);
  }

  const root = scene.add.container(0, 0).setDepth(78);

  const heroPanel = panel(scene, 205, 351, 382, 500, 0xfff9ec, 0xd5b873, 0.8, 24);
  const managementPanel = panel(scene, 605, 351, 366, 500, 0xfffcf4, 0xc8aa68, 0.96, 22);
  const beltPanel = panel(scene, 400, 686, 772, 132, 0xfffbf1, 0xc8aa68, 0.98, 18);

  const heroTitle = text(scene, 205, 126, ja(scene, "今日も最高の一杯を", "Brew something wonderful"), 15, "#6f5a38", "800");
  const heroSub = text(scene, 205, 150, ja(scene, "大釜をタップして調合", "Tap the cauldron to brew"), 11, "#8a7656", "600");

  const speechBg = panel(scene, 324, 207, 146, 78, 0xffffff, 0xb7d9c8, 0.94, 16);
  const speechText = scene.add
    .text(324, 207, "", {
      fontFamily: '"Segoe UI", "Hiragino Sans", sans-serif',
      fontSize: "11px",
      fontStyle: "700",
      color: "#426052",
      align: "center",
      wordWrap: { width: 122, useAdvancedWrap: true },
    })
    .setOrigin(0.5);

  const magicGlow = scene.add.ellipse(CAULDRON_X, CAULDRON_Y - 8, 190, 112, 0x64efae, 0.22).setDepth(89);
  scene.tweens.add({
    targets: magicGlow,
    scaleX: 1.12,
    scaleY: 1.08,
    alpha: 0.36,
    duration: 980,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
  const cauldron = makeCauldron(scene);
  const brewCtaBg = scene.add.graphics();
  brewCtaBg.fillStyle(0x8f4b2d, 0.95);
  brewCtaBg.fillRoundedRect(125, 501, 160, 44, 18);
  brewCtaBg.fillStyle(0xffffff, 0.18);
  brewCtaBg.fillRoundedRect(128, 504, 154, 12, 14);
  brewCtaBg.lineStyle(2, 0xf6d495, 0.85);
  brewCtaBg.strokeRoundedRect(125, 501, 160, 44, 18);
  const brewCta = text(scene, 205, 523, ja(scene, "ポーション製造  TAP!", "BREW POTION  TAP!"), 14, "#fff7df", "900");

  cauldron.on("pointerdown", () => {
    invoke(scene, "onBrewTap", [cauldron]);
  });

  const workshopLabel = text(scene, 462, 124, "", 12, "#82683e", "900").setOrigin(0, 0.5);
  const repText = text(scene, 748, 124, "", 12, "#2f8f68", "900").setOrigin(1, 0.5);

  const ordersBox = panel(scene, 605, 190, 324, 110, 0xfff8e6, 0xd9bc75, 1, 16);
  const ordersTitle = text(scene, 465, 151, ja(scene, "本日の依頼", "TODAY'S ORDERS"), 13, "#775d2d", "900").setOrigin(0, 0.5);
  const ordersText = scene.add
    .text(465, 174, "", {
      fontFamily: '"Segoe UI", "Hiragino Sans", sans-serif',
      fontSize: "11px",
      color: "#5e5548",
      lineSpacing: 6,
    })
    .setOrigin(0, 0);
  const ordersHit = scene.add.zone(605, 190, 324, 110).setInteractive({ useHandCursor: true });
  ordersHit.on("pointerdown", () => invoke(scene, "showContracts"));

  const upgradeBox = panel(scene, 605, 342, 324, 162, 0xf6fbf7, 0x8bc6a9, 1, 18);
  const upgradeKicker = text(scene, 465, 280, ja(scene, "おすすめ強化", "RECOMMENDED UPGRADE"), 12, "#42745e", "900").setOrigin(0, 0.5);
  const upgradeName = text(scene, 465, 312, "", 16, "#314d41", "900").setOrigin(0, 0.5);
  const upgradeBenefit = text(scene, 465, 338, "", 11, "#668174", "700").setOrigin(0, 0.5);
  const upgradeCost = text(scene, 736, 312, "", 12, "#8b6b20", "900").setOrigin(1, 0.5);
  const upgradeBg = scene.add.graphics();
  const upgradeLabel = text(scene, 605, 391, ja(scene, "今すぐ強化", "UPGRADE NOW"), 13, "#ffffff", "900");
  const upgradeHit = scene.add.zone(605, 391, 270, 42).setInteractive({ useHandCursor: true });
  upgradeHit.on("pointerdown", () => performRecommendedUpgrade(scene));

  const equipment = makeHitButton(
    scene,
    root,
    535,
    458,
    136,
    38,
    ja(scene, "設備一覧", "EQUIPMENT"),
    () => openEquipmentDrawer(scene),
    0x557f9d,
  );
  const advanced = makeHitButton(
    scene,
    root,
    682,
    458,
    136,
    38,
    ja(scene, "その他強化", "MORE"),
    () => openAdvancedDrawer(scene),
    0x7d6a9d,
  );

  const beltTitle = text(scene, 28, 632, ja(scene, "工房の生産ライン", "PRODUCTION LINE"), 12, "#715d3f", "900").setOrigin(0, 0.5);
  const beltTexts: Phaser.GameObjects.Text[] = [];
  const beltGraphics = scene.add.graphics();
  const itemXs = [88, 236, 384, 532, 680];
  itemXs.forEach((x, index) => {
    const hue = index / 6;
    const accent = Phaser.Display.Color.HSVToRGB(hue, 0.42, 0.82).color;
    beltGraphics.fillStyle(accent, 0.13);
    beltGraphics.fillRoundedRect(x - 64, 647, 128, 55, 12);
    beltGraphics.lineStyle(1, accent, 0.42);
    beltGraphics.strokeRoundedRect(x - 64, 647, 128, 55, 12);
    beltGraphics.fillStyle(accent, 0.82);
    beltGraphics.fillCircle(x - 45, 674, 9);
    beltTexts.push(
      scene.add
        .text(x - 29, 657, "", {
          fontFamily: '"Segoe UI", "Hiragino Sans", sans-serif',
          fontSize: "9px",
          fontStyle: "800",
          color: "#52493d",
          lineSpacing: 3,
        })
        .setOrigin(0, 0),
    );
  });

  const progressTrack = scene.add.graphics();
  progressTrack.fillStyle(0xd9cfba, 0.7);
  progressTrack.fillRoundedRect(104, 720, 592, 8, 4);
  const progressFill = scene.add.graphics();
  const progressText = text(scene, 400, 741, "", 10, "#756449", "800");

  const bottomBlocker = scene.add.zone(400, 686, 772, 132).setInteractive();

  root.add([
    heroPanel,
    managementPanel,
    beltPanel,
    bottomBlocker,
    heroTitle,
    heroSub,
    speechBg,
    speechText,
    brewCtaBg,
    brewCta,
    workshopLabel,
    repText,
    ordersBox,
    ordersTitle,
    ordersText,
    ordersHit,
    upgradeBox,
    upgradeKicker,
    upgradeName,
    upgradeBenefit,
    upgradeCost,
    upgradeBg,
    upgradeLabel,
    upgradeHit,
    beltTitle,
    beltGraphics,
    ...beltTexts,
    progressTrack,
    progressFill,
    progressText,
  ]);
  // equipment / advanced は makeHitButton 内で既に root へ追加済み。
  equipment.hit.setDepth(2);
  advanced.hit.setDepth(2);

  const ui: WorkshopConceptUi = {
    root,
    cauldron,
    magicGlow,
    workshopLabel,
    repText,
    speechText,
    ordersText,
    upgradeName,
    upgradeBenefit,
    upgradeCost,
    upgradeBg,
    beltTexts,
    progressFill,
    progressText,
    activeDrawer: null,
  };
  uiByScene.set(scene, ui);
  refreshConceptUi(scene);
  return ui;
}

function recommendedUpgrade(state: GameState): UpgradeTarget {
  const clickCost = clickUpgradeCostForQuantity(state, 1);
  let best: UpgradeTarget = {
    kind: "click",
    cost: clickCost,
    label: `TAP Lv.${state.clickPower + 1}`,
    benefit: `TAP +1`,
  };
  for (const generator of GENERATORS) {
    const count = state.counts[generator.id] ?? 0;
    const cost = generatorCost(generator, count);
    if (cost < best.cost) {
      best = {
        kind: "generator",
        id: generator.id,
        cost,
        label: generator.name,
        benefit: `+${formatNumber(generator.baseRate * demandMultiplier(state.prestigeCount, generator.id))}/s`,
      };
    }
  }
  return best;
}

function performRecommendedUpgrade(scene: IdleRuntime): void {
  const state = scene.state;
  if (!state) return;
  const target = recommendedUpgrade(state);
  if (state.potions < target.cost) {
    invoke(
      scene,
      "spawnFloatingText",
      605,
      390,
      ja(scene, `あと ${formatNumber(target.cost - state.potions)}`, `Need ${formatNumber(target.cost - state.potions)}`),
      "#b46b4f",
    );
    return;
  }

  const beforeRate = productionPerSec(state);
  const next = target.kind === "generator" ? buyGenerator(state, target.id) : buyClickUpgrades(state, 1);
  if (!next) return;
  scene.state = next;
  invoke(scene, "playSound", sfx.buy);
  const afterRate = productionPerSec(next);
  const feedback =
    target.kind === "generator"
      ? `+${formatNumber(afterRate - beforeRate)}/s`
      : ja(scene, "TAP強化！", "TAP POWER UP!");
  invoke(scene, "spawnFloatingText", 605, 390, feedback, "#2f8f68");
}

function refreshConceptUi(scene: IdleRuntime): void {
  const state = scene.state;
  if (!state) return;
  const ui = uiByScene.get(scene) ?? buildConceptUi(scene);
  const town = townForPrestige(state.prestigeCount);
  const target = recommendedUpgrade(state);
  const affordable = state.potions >= target.cost;

  ui.workshopLabel.setText(
    scene.lang === "en"
      ? `WORKSHOP Lv.${state.prestigeCount + 1} · ${town.name}`
      : `工房 Lv.${state.prestigeCount + 1} · ${town.name}`,
  );
  ui.repText.setText(`REP ${state.reputation}  ·  +${formatNumber(productionPerSec(state))}/s`);
  ui.speechText.setText(
    affordable
      ? ja(scene, "強化できるよ！\n工房を育てよう！", "Upgrade ready!\nGrow the workshop!")
      : ja(scene, "大釜をタップして\n次の強化を目指そう！", "Tap the cauldron\nfor the next upgrade!")
  );

  const orderLines = [0, 1].map((index) => {
    const done = state.completedContracts.includes(index);
    const cost = contractCost(state, index);
    const name = index === 0 ? ja(scene, "村人の常備薬", "Village supplies") : ja(scene, "商隊への納品", "Caravan shipment");
    return done
      ? `✓ ${name}`
      : `□ ${name}  ${formatNumber(Math.min(state.potions, cost))}/${formatNumber(cost)}`;
  });
  ui.ordersText.setText(`${orderLines.join("\n")}\n${ja(scene, "タップで注文を確認", "Tap to view orders")}`);

  ui.upgradeName.setText(target.label);
  ui.upgradeBenefit.setText(
    target.kind === "generator"
      ? `${target.benefit}  ·  ${ja(scene, "自動生産", "auto production")}`
      : `${target.benefit}  ·  ${ja(scene, "手動調合", "manual brewing")}`,
  );
  ui.upgradeCost.setText(`${formatNumber(target.cost)} 🧪`);
  ui.upgradeBg.clear();
  ui.upgradeBg.fillStyle(affordable ? 0x2f9c6e : 0x8fa39a, 1);
  ui.upgradeBg.fillRoundedRect(470, 370, 270, 42, 13);
  ui.upgradeBg.fillStyle(0xffffff, 0.2);
  ui.upgradeBg.fillRoundedRect(472, 372, 266, 12, 10);
  ui.upgradeBg.lineStyle(1.5, affordable ? 0xcaf0dc : 0xd8e1dd, 0.7);
  ui.upgradeBg.strokeRoundedRect(470, 370, 270, 42, 13);

  const beltDefs = GENERATORS.slice(0, 5);
  beltDefs.forEach((generator, index) => {
    const count = state.counts[generator.id] ?? 0;
    const nominal = generator.baseRate * count * demandMultiplier(state.prestigeCount, generator.id);
    ui.beltTexts[index]?.setText(`${generator.name}\n×${count}  +${formatNumber(nominal)}/s`);
  });

  const ratio = Phaser.Math.Clamp(state.totalBrewed / PRESTIGE_UNLOCK, 0, 1);
  ui.progressFill.clear();
  if (ratio > 0) {
    ui.progressFill.fillStyle(ratio >= 1 ? 0xb56be0 : 0x57b98b, 1);
    ui.progressFill.fillRoundedRect(104, 720, Math.max(8, 592 * ratio), 8, 4);
  }
  ui.progressText.setText(
    ratio >= 1
      ? ja(scene, "工房発展 READY · 転生で新しい街へ", "WORKSHOP GROWTH READY · Ascend to a new town")
      : ja(scene, `工房の発展 ${Math.floor(ratio * 100)}%`, `WORKSHOP GROWTH ${Math.floor(ratio * 100)}%`),
  );
}

function closeDrawer(scene: IdleRuntime): void {
  const ui = uiByScene.get(scene);
  if (!ui?.activeDrawer) return;
  ui.activeDrawer.destroy(true);
  ui.activeDrawer = null;
  scene.rows?.forEach((row) => row.card.container.setVisible(false));
  scene.clickCard?.container.setVisible(false);
  scene.offlineCard?.container.setVisible(false);
  scene.prestigeCard?.container.setVisible(false);
  scene.qtyButtons?.forEach((button) => {
    button.rect.setVisible(false);
    button.label.setVisible(false);
  });
}

function drawerShell(scene: IdleRuntime, titleText: string): Phaser.GameObjects.Container {
  closeDrawer(scene);
  const drawer = scene.add.container(0, 0).setDepth(170);
  const shade = scene.add.rectangle(400, 380, 800, 760, 0x243a40, 0.58).setInteractive();
  const bg = panel(scene, 400, 380, 706, 590, 0xfffbf2, 0xc7a864, 1, 24);
  const titleObj = text(scene, 400, 111, titleText, 22, "#59482e", "900");
  const close = text(scene, 704, 112, "×", 28, "#6d604d", "700").setInteractive({ useHandCursor: true });
  shade.on("pointerdown", () => closeDrawer(scene));
  close.on("pointerdown", () => closeDrawer(scene));
  drawer.add([shade, bg, titleObj, close]);
  const ui = uiByScene.get(scene);
  if (ui) ui.activeDrawer = drawer;
  return drawer;
}

function openEquipmentDrawer(scene: IdleRuntime): void {
  const drawer = drawerShell(scene, ja(scene, "設備一覧", "EQUIPMENT"));
  const rows = scene.rows ?? [];
  rows.forEach((row, index) => {
    const col = index % 2;
    const r = Math.floor(index / 2);
    row.card.container
      .setPosition(col === 0 ? 220 : 580, 205 + r * 88)
      .setScale(0.78)
      .setVisible(true)
      .setDepth(185);
  });
  const hint = text(
    scene,
    400,
    590,
    ja(scene, "設備を買うと自動生産が増える · 明るいカードは購入可能", "Buy equipment to increase auto production · Lit cards are affordable"),
    11,
    "#7d705d",
    "700",
  );
  drawer.add(hint);
}

function drawerButton(
  scene: IdleRuntime,
  drawer: Phaser.GameObjects.Container,
  x: number,
  y: number,
  label: string,
  action: () => void,
): void {
  makeHitButton(scene, drawer, x, y, 150, 36, label, action, 0x637d9a);
}

function openAdvancedDrawer(scene: IdleRuntime): void {
  const drawer = drawerShell(scene, ja(scene, "工房管理", "WORKSHOP MANAGEMENT"));
  scene.clickCard?.container.setPosition(400, 245).setScale(1).setVisible(true).setDepth(185);
  scene.offlineCard?.container.setPosition(400, 340).setScale(1).setVisible(true).setDepth(185);
  scene.prestigeCard?.container.setPosition(400, 445).setScale(1).setVisible(true).setDepth(185);

  scene.qtyButtons?.forEach((button, index) => {
    button.rect.setPosition(290 + index * 55, 186).setVisible(true).setDepth(185);
    button.label.setPosition(290 + index * 55, 186).setVisible(true).setDepth(186);
  });

  drawerButton(scene, drawer, 315, 563, ja(scene, "セーブ書出", "EXPORT"), () => invoke(scene, "doExport"));
  drawerButton(scene, drawer, 485, 563, ja(scene, "セーブ読込", "IMPORT"), () => invoke(scene, "doImport"));
}

function brewBurst(scene: IdleRuntime): void {
  const ring = scene.add
    .ellipse(CAULDRON_X, CAULDRON_Y - 10, 170, 105, 0x77e8b7, 0)
    .setStrokeStyle(4, 0x7cf3c1, 0.82)
    .setDepth(120)
    .setScale(0.78);
  scene.tweens.add({
    targets: ring,
    scaleX: 1.25,
    scaleY: 1.2,
    alpha: 0,
    duration: 300,
    ease: "Cubic.easeOut",
    onComplete: () => ring.destroy(),
  });

  for (const offset of BURST_OFFSETS) {
    const spark = scene.add
      .circle(CAULDRON_X + offset.x, CAULDRON_Y - 20 + offset.y, offset.r, 0xcaffdf, 0.95)
      .setDepth(121);
    scene.tweens.add({
      targets: spark,
      x: spark.x + offset.x * 0.4,
      y: spark.y - 34,
      scale: 0.4,
      alpha: 0,
      duration: 280,
      ease: "Cubic.easeOut",
      onComplete: () => spark.destroy(),
    });
  }

  if (scene.potionText) {
    scene.tweens.killTweensOf(scene.potionText);
    scene.potionText.setScale(1);
    scene.tweens.add({
      targets: scene.potionText,
      scale: 1.09,
      duration: 75,
      yoyo: true,
      ease: "Sine.easeOut",
    });
  }
}

function showStreak(scene: Phaser.Scene, streak: number): void {
  if (streak < 3) return;
  const label = scene.add
    .text(CAULDRON_X, 566, `BREW ×${streak}`, {
      fontFamily: "sans-serif",
      fontSize: "14px",
      fontStyle: "900",
      color: "#fff8dc",
      backgroundColor: "rgba(31, 138, 99, 0.86)",
      padding: { x: 12, y: 5 },
    })
    .setOrigin(0.5)
    .setDepth(130)
    .setAlpha(0)
    .setScale(0.9);

  scene.tweens.add({
    targets: label,
    alpha: 1,
    scale: 1,
    y: 558,
    duration: 100,
    ease: "Back.easeOut",
    yoyo: true,
    hold: 180,
    onComplete: () => label.destroy(),
  });
}

function recordTap(scene: IdleRuntime): number {
  const now = scene.time.now;
  const previous = tapState.get(scene);
  const streak = previous && now - previous.lastAt <= 620 ? previous.streak + 1 : 1;
  tapState.set(scene, { lastAt: now, streak });
  return streak;
}

/**
 * コンセプトアート準拠のメイン画面へ再構成する。
 * 経済・保存・注文・転生ロジックは既存実装をそのまま利用し、presentation層だけで
 * 「錬金術師 + 大釜」を主役にし、管理機能を右側とドロワーへ整理する。
 */
export function installPotionPresentation(): void {
  const proto = IdleScene.prototype as unknown as Record<string, unknown>;

  const originalCreate = Reflect.get(proto, "create") as ((this: IdleScene) => void) | undefined;
  if (originalCreate && !Reflect.get(proto, "__conceptCreate")) {
    Reflect.set(proto, "__conceptCreate", originalCreate);
    Reflect.set(proto, "create", function (this: IdleScene) {
      originalCreate.call(this);
      buildConceptUi(this as unknown as IdleRuntime);
    });
  }

  const originalBrewTap = Reflect.get(proto, "onBrewTap") as
    | ((this: IdleScene, bounceTargets: Phaser.GameObjects.GameObject[], glow?: Phaser.GameObjects.Arc) => void)
    | undefined;
  if (originalBrewTap && !Reflect.get(proto, "__conceptBrewTap")) {
    Reflect.set(proto, "__conceptBrewTap", originalBrewTap);
    Reflect.set(proto, "onBrewTap", function (
      this: IdleScene,
      bounceTargets: Phaser.GameObjects.GameObject[],
      glow?: Phaser.GameObjects.Arc,
    ) {
      originalBrewTap.call(this, bounceTargets, glow);
      const runtime = this as unknown as IdleRuntime;
      brewBurst(runtime);
      showStreak(runtime, recordTap(runtime));
    });
  }

  const originalUpdate = Reflect.get(proto, "update") as
    | ((this: IdleScene, time: number, delta: number) => void)
    | undefined;
  if (!Reflect.get(proto, "__conceptUpdate")) {
    Reflect.set(proto, "__conceptUpdate", originalUpdate ?? (() => undefined));
    Reflect.set(proto, "update", function (this: IdleScene, time: number, delta: number) {
      originalUpdate?.call(this, time, delta);
      refreshConceptUi(this as unknown as IdleRuntime);
    });
  }
}

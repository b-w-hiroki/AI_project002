import Phaser from "phaser";
import { getResponsiveLayout } from "../../shared/mobile";
import { contractCost, contractReward, demandGenerator, fulfillContract } from "./logic/contracts";
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
  productionPerSec,
  type GameState,
} from "./logic/economy";
import { save } from "./logic/save";
import { generatorName, t, townName, type Lang } from "./logic/i18n";
import { townForState } from "./logic/towns";
import { IdleScene } from "./scenes/IdleScene";

type SceneMethod = (this: Phaser.Scene, ...args: unknown[]) => unknown;
type MethodTable = Record<string, SceneMethod | undefined>;
type Runtime = Phaser.Scene & { state?: GameState; lang?: Lang };

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
  blackboardText?: Phaser.GameObjects.Text;
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
  g.fillStyle(0x1b100c, 0.32).fillRoundedRect(x - w / 2 + 3, y - h / 2 + 4, w, h, 12);
  g.fillStyle(accent, 0.96).fillRoundedRect(x - w / 2, y - h / 2, w, h, 12);
  g.fillStyle(0x172a27, 0.16).fillRoundedRect(x - w / 2 + 5, y - h / 2 + 5, w - 10, h - 10, 8);
  g.fillStyle(0xffffff, 0.14).fillRoundedRect(x - w / 2 + 5, y - h / 2 + 5, w - 10, Math.max(7, h * 0.2), 8);
  g.lineStyle(2, 0xf4dfae, 0.62).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 12);
  g.lineStyle(1, 0xffffff, 0.28).strokeRoundedRect(x - w / 2 + 5, y - h / 2 + 5, w - 10, h - 10, 8);
  g.fillStyle(0xf4dfae, 0.7).fillCircle(x - w / 2 + 9, y, 2).fillCircle(x + w / 2 - 9, y, 2);
  root.add(g);
}

function addNavIcon(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  kind: "orders" | "upgrade" | "equipment" | "ascend",
): void {
  const g = scene.add.graphics();
  g.lineStyle(2.3, 0xffedba, 0.92);
  g.fillStyle(0xffedba, 0.16);
  if (kind === "orders") {
    g.fillRoundedRect(x - 10, y - 10, 20, 22, 3);
    g.strokeRoundedRect(x - 10, y - 10, 20, 22, 3);
    g.lineBetween(x - 6, y - 4, x + 6, y - 4);
    g.lineBetween(x - 6, y + 2, x + 4, y + 2);
  } else if (kind === "upgrade") {
    g.lineBetween(x - 9, y + 9, x + 8, y - 8);
    g.strokeCircle(x - 8, y + 9, 4);
    g.fillTriangle(x + 4, y - 10, x + 12, y - 12, x + 10, y - 4);
  } else if (kind === "equipment") {
    g.fillRoundedRect(x - 12, y - 7, 24, 17, 4);
    g.strokeRoundedRect(x - 12, y - 7, 24, 17, 4);
    g.strokeRect(x - 5, y - 12, 10, 5);
    g.lineBetween(x, y - 6, x, y + 9);
  } else {
    const points = Array.from({ length: 10 }, (_, index) => {
      const angle = -Math.PI / 2 + (Math.PI * index) / 5;
      const radius = index % 2 === 0 ? 12 : 5;
      return new Phaser.Math.Vector2(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    });
    g.fillPoints(points, true);
    g.strokePoints(points, true);
  }
  root.add(g);
}

function addWorkshopProps(scene: Phaser.Scene, root: Phaser.GameObjects.Container): void {
  const g = scene.add.graphics();
  // Foreground bottles and ingredient jars echo the approved home without
  // baking interactive UI into a single screenshot.
  const bottles: Array<[number, number, number, number]> = [
    [18, 392, 0x75e4ff, 18],
    [37, 405, 0xc78cff, 23],
    [414, 382, 0x78efae, 20],
    [433, 399, 0xffcc6f, 26],
  ];
  for (const [x, y, color, h] of bottles) {
    g.fillStyle(0x31231b, 0.88).fillRect(x - 3, y - h / 2 - 5, 6, 6);
    g.fillStyle(color, 0.72).fillRoundedRect(x - 7, y - h / 2, 14, h, 5);
    g.lineStyle(1.2, 0xfff0c7, 0.72).strokeRoundedRect(x - 7, y - h / 2, 14, h, 5);
    g.fillStyle(0xffffff, 0.38).fillCircle(x - 3, y - h / 2 + 5, 2);
  }
  g.fillStyle(0x65442c, 0.9).fillRoundedRect(364, 458, 76, 28, 4);
  g.lineStyle(1.5, 0xd9ad58, 0.65).strokeRoundedRect(364, 458, 76, 28, 4);
  g.lineBetween(402, 458, 402, 486);
  g.lineBetween(364, 472, 440, 472);
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

  // Tapの瞬間に「錬金が起きた」と読める魔法リングと光粒を出す。
  const magicColors = [0x78ffd0, 0x8ed8ff, 0xe4b8ff, 0xffdd85];
  [34, 52, 72].forEach((radius, index) => {
    const ring = scene.add.circle(ui.brewX, ui.brewY - 8, radius, magicColors[index]!, 0)
      .setStrokeStyle(index === 0 ? 5 : 3, magicColors[index]!, 0.78 - index * 0.12);
    ui.root.add(ring);
    scene.tweens.add({
      targets: ring,
      scale: 1.7 + index * 0.12,
      alpha: 0,
      duration: 260 + index * 70,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
  });
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI * 2 * i) / 10 + (i % 2 ? 0.18 : 0);
    const color = magicColors[i % magicColors.length]!;
    const mote = scene.add.circle(ui.brewX, ui.brewY - 18, i % 3 === 0 ? 5 : 3, color, 0.92);
    ui.root.add(mote);
    scene.tweens.add({
      targets: mote,
      x: ui.brewX + Math.cos(angle) * (58 + (i % 3) * 16),
      y: ui.brewY - 28 + Math.sin(angle) * 46 - (i % 2) * 14,
      alpha: 0,
      scale: 0.3,
      duration: 360 + i * 22,
      ease: "Cubic.easeOut",
      onComplete: () => mote.destroy(),
    });
  }

  const popup = scene.add.text(ui.brewX, ui.brewY - 80, `+${formatNumber(gain)}`, {
    fontFamily: '"Hiragino Sans", "Yu Gothic", sans-serif',
    fontSize: "18px",
    fontStyle: "900",
    color: "#78ffd0",
    stroke: "#315747",
    strokeThickness: 4,
  }).setOrigin(0.5).setDepth(6000);
  ui.root.add(popup);
  popup.setScale(0.72);
  scene.tweens.add({
    targets: popup,
    y: popup.y - 42,
    alpha: 0,
    scale: 1.12,
    duration: 650,
    ease: "Cubic.easeOut",
    onComplete: () => popup.destroy(),
  });
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

  const lang = scene.lang ?? "en";
  if (portrait) {
    const header = scene.add.graphics();
    const badgePoints = [
      new Phaser.Math.Vector2(35, 8),
      new Phaser.Math.Vector2(62, 35),
      new Phaser.Math.Vector2(35, 62),
      new Phaser.Math.Vector2(8, 35),
    ];
    header.fillStyle(0x130d0a, 0.88).fillRect(0, 0, 450, 106);
    header.lineStyle(2, 0xd9ad58, 0.88).lineBetween(0, 104, 450, 104);
    header.lineStyle(1, 0xffe4a7, 0.42).lineBetween(70, 67, 438, 67);
    header.fillStyle(0x1d4e75, 0.96).fillPoints(badgePoints, true);
    header.lineStyle(3, 0xe5bd67, 0.96).strokePoints(badgePoints, true);
    root.add(header);
    text(scene, root, 35, 35, "1", 26, "#fff4d2", "900").setStroke("#17334b", 3);
  }
  const titleX = portrait ? 78 : 104;
  text(scene, root, titleX, 24, t(lang, "title"), portrait ? 26 : 28, "#fff7e5", "900").setOrigin(0, 0.5).setStroke("#60351f", 5);
  text(scene, root, titleX, 52, lang === "ja" ? "Potion Workshop — 錬金術師と工房を育てる" : "Potion Workshop — Grow your alchemist and workshop", 17, "#f2d8aa", "700").setOrigin(0, 0.5);

  const potionText = text(scene, root, portrait ? 438 : 545, 22, "", portrait ? 22 : 19, "#fff2cd", "900").setOrigin(1, 0.5);
  const essenceText = text(scene, root, portrait ? 330 : 665, 82, "", portrait ? 22 : 19, "#e3c4ff", "900").setOrigin(1, 0.5);
  const reputationText = text(scene, root, portrait ? 438 : 764, 82, "", portrait ? 22 : 19, "#bff0cf", "900").setOrigin(1, 0.5);
  if (portrait) panel(scene, root, 225, 108, 420, 34, 0x2b1d18, 0xd9ad58, 0.84, 10);
  const townText = text(scene, root, portrait ? 225 : 694, portrait ? 108 : 25, "", portrait ? 18 : 18, "#f5dcae", "800")
    .setName("workshop-town-status");

  const heroX = portrait ? 225 : 150;
  const heroY = portrait ? 325 : 202;
  const brewX = portrait ? 225 : 335;
  const brewY = portrait ? 440 : 246;
  let hero: Phaser.GameObjects.Image | undefined;
  let cauldron: Phaser.GameObjects.Image | undefined;
  const heroKey = scene.textures.exists("pw-hero-stirring-v2")
    ? "pw-hero-stirring-v2"
    : "pw-hero-alchemist";
  if (scene.textures.exists(heroKey)) {
    hero = scene.add
      .image(portrait ? 230 : heroX, portrait ? 292 : heroY, heroKey)
      .setDisplaySize(portrait ? 350 : 238, portrait ? 350 : 238)
      .setName("workshop-hero");
    root.add(hero);
  }
  if (portrait && scene.textures.exists("pw-approved-cat-visible")) {
    root.add(
      scene.add
        .image(102, 408, "pw-approved-cat-visible")
        .setDisplaySize(150, 164)
        .setName("approved-workshop-cat"),
    );
  }
  if (scene.textures.exists("pw-cauldron-icon")) {
    cauldron = scene.add
      .image(brewX, brewY, "pw-cauldron-icon")
      .setDisplaySize(portrait ? 260 : 170, portrait ? 260 : 170)
      .setName("workshop-cauldron");
    root.add(cauldron);
  } else {
    const pot = scene.add.graphics();
    pot.fillStyle(0x26303b, 1).fillEllipse(brewX, brewY, 145, 90);
    pot.fillStyle(0x7de6b0, 0.7).fillEllipse(brewX, brewY - 34, 118, 30);
    root.add(pot);
  }
  const glow = scene.add.graphics();
  glow.fillStyle(0x7de6b0, 0.16).fillCircle(brewX, brewY, portrait ? 116 : 100);
  glow.lineStyle(2, 0xd5ffd8, 0.48).strokeCircle(brewX, brewY, portrait ? 108 : 92);
  root.add(glow);
  if (portrait) addButtonChrome(scene, root, brewX, brewY + 25, 196, 48, 0x1689a8);
  text(
    scene,
    root,
    brewX,
    brewY + (portrait ? 25 : 110),
    lang === "ja" ? "大釜をタップして調合" : "TAP TO BREW",
    20,
    "#b8ffd7",
    "900",
  );
  hitButton(scene, root, brewX, brewY, portrait ? 230 : 210, 220, () => brew(scene, uiByScene.get(scene)!))
    .setName("brew-hit-target");

  if (portrait) {
    const magic = scene.add.graphics();
    const bubbles: Array<[number, number, number, number]> = [
      [112, 355, 5, 0x88ffd0],
      [145, 392, 3, 0x84d8ff],
      [310, 350, 4, 0xe0b4ff],
      [328, 405, 6, 0x8fffd2],
      [119, 452, 3, 0xffdf86],
      [333, 463, 4, 0x8edcff],
    ];
    bubbles.forEach(([x, y, radius, color]) => {
      magic.fillStyle(color, 0.72).fillCircle(x, y, radius);
      magic.lineStyle(1, 0xffffff, 0.68).strokeCircle(x, y, radius);
    });
    root.add(magic);

    addWorkshopProps(scene, root);

    const board = scene.add.graphics();
    board.fillStyle(0x291f19, 0.96).fillRoundedRect(12, 449, 122, 70, 6);
    board.lineStyle(5, 0x745035, 1).strokeRoundedRect(12, 449, 122, 70, 6);
    board.lineStyle(1, 0xe8cf9d, 0.4).strokeRoundedRect(18, 455, 110, 58, 3);
    board.lineStyle(4, 0x68442c, 1).lineBetween(26, 521, 16, 539).lineBetween(120, 521, 130, 539);
    root.add(board);
    const blackboardText = scene.add.text(73, 484, "", {
      fontFamily: '"Segoe Print", "Yu Gothic", sans-serif',
      fontSize: "17px",
      fontStyle: "700",
      color: "#fff7d7",
      align: "center",
      lineSpacing: 2,
      wordWrap: { width: 104, useAdvancedWrap: true },
    }).setOrigin(0.5).setName("workshop-blackboard-text");
    root.add(blackboardText);
    root.setData("blackboardText", blackboardText);

  }

  if (portrait) panel(scene, root, 300, 486, 250, 30, 0x173f42, 0xd4b36e, 0.9, 9);
  const rateText = text(scene, root, portrait ? 300 : 250, portrait ? 486 : 390, "", portrait ? 17 : 18, "#fff1d0", "900")
    .setName("workshop-rate-status");

  const orderTexts: Phaser.GameObjects.Text[] = [];
  const productionTexts: Phaser.GameObjects.Text[] = [];
  let recommendationText: Phaser.GameObjects.Text;
  let clickUpgradeText: Phaser.GameObjects.Text;
  let offlineText: Phaser.GameObjects.Text;
  let prestigeText: Phaser.GameObjects.Text;
  const prestigeBar = scene.add.graphics();
  root.add(prestigeBar);

  if (portrait) {
    panel(scene, root, 225, 568, 420, 96, 0x423124, 0xd4b36e, 0.92, 15);
    text(scene, root, 38, 535, lang === "ja" ? "本日の依頼" : "TODAY'S ORDERS", 17, "#f6dcaa", "900")
      .setOrigin(0, 0.5)
      .setName("workshop-orders-label");
    [0, 1].forEach((index) => {
      const x = index === 0 ? 120 : 330;
      addButtonChrome(scene, root, x, 580, 190, 58, index === 0 ? 0x3e765d : 0x4c6e8c);
      const labelNode = text(scene, root, x, 580, "", 22, "#ffffff", "900")
        .setName(`workshop-order-${index}`);
      orderTexts.push(labelNode);
      hitButton(scene, root, x, 580, 190, 58, () => {
        if (!scene.state) return;
        updateState(scene, fulfillContract(scene.state, index));
      });
    });

    // The recommendation duplicated the upgrade/equipment tabs and forced
    // three competing action rows into short portrait. Keep its live value for
    // state refreshes, but disclose upgrades through the dedicated tabs.
    recommendationText = text(scene, root, 0, 0, "", 22, "#fff2d6", "900")
      .setName("workshop-recommendation-detail")
      .setVisible(false);

    panel(scene, root, 225, 702, 430, 78, 0x2f2927, 0x9b7d57, 0.94, 13);
    // Approved-home hierarchy: one large brew CTA plus four compact management tabs.
    // Every tab retains a real game action and a >= 44 px target.
    const navItems = [
      {
        x: 62,
        kind: "orders" as const,
        ja: "依頼",
        en: "ORDERS",
        action: () => {
          const show = Reflect.get(scene, "showContracts");
          if (typeof show === "function") show.call(scene);
        },
      },
      {
        x: 171,
        kind: "upgrade" as const,
        ja: "強化",
        en: "UPGRADE",
        action: () => scene.state && updateState(scene, buyClickUpgrades(scene.state, 1)),
      },
      {
        x: 280,
        kind: "equipment" as const,
        ja: "設備",
        en: "EQUIP",
        action: () => {
          if (!scene.state) return;
          const rec = recommended(scene.state);
          updateState(scene, buyGenerator(scene.state, rec.id));
        },
      },
      {
        x: 389,
        kind: "ascend" as const,
        ja: "転生",
        en: "ASCEND",
        action: () => {
          if (!scene.state || essenceOnPrestige(scene.state) <= 0) return;
          const show = Reflect.get(scene, "showTownChoice");
          if (typeof show === "function") show.call(scene);
        },
      },
    ];
    navItems.forEach((item, index) => {
      addButtonChrome(scene, root, item.x, 702, 100, 68, index === 0 ? 0x165f70 : 0x453126);
      addNavIcon(scene, root, item.x, 690, item.kind);
      text(scene, root, item.x, 721, lang === "ja" ? item.ja : item.en, 22, "#fff3d0", "900");
      hitButton(scene, root, item.x, 702, 100, 68, item.action).setName(`workshop-nav-${index}`);
    });
    clickUpgradeText = text(scene, root, 171, 780, "", 1, "#f9e8c9", "900").setVisible(false);
    offlineText = text(scene, root, 280, 780, "", 1, "#d7ecff", "900").setVisible(false);
    prestigeText = text(scene, root, 389, 780, "", 1, "#ead5ff", "900").setVisible(false);

  } else {
    panel(scene, root, 588, 170, 388, 190, 0x423124, 0xd4b36e, 0.93, 16);
    text(scene, root, 420, 95, lang === "ja" ? "本日の依頼" : "TODAY'S ORDERS", 17, "#f6dcaa", "900").setOrigin(0, 0.5);
    [0, 1].forEach((index) => {
      const y = 132 + index * 68;
      addButtonChrome(scene, root, 588, y, 340, 56, index === 0 ? 0x3e765d : 0x4c6e8c);
      const node = text(scene, root, 588, y, "", 19, "#ffffff", "900")
        .setName(`workshop-order-${index}`);
      orderTexts.push(node);
      hitButton(scene, root, 588, y, 340, 56, () => {
        if (!scene.state) return;
        updateState(scene, fulfillContract(scene.state, index));
      });
    });

    panel(scene, root, 588, 300, 388, 70, 0x3c2d25, 0xd4b36e, 0.93, 14);
    recommendationText = text(scene, root, 535, 300, "", 18, "#fff2d6", "900")
      .setName("workshop-landscape-recommendation");
    addButtonChrome(scene, root, 720, 300, 90, 44, 0x2e8f65);
    text(scene, root, 720, 300, lang === "ja" ? "強化" : "UPGRADE", 19, "#ffffff", "900");
    hitButton(scene, root, 720, 300, 90, 50, () => {
      if (!scene.state) return;
      const rec = recommended(scene.state);
      updateState(scene, buyGenerator(scene.state, rec.id));
    });

    panel(scene, root, 588, 380, 388, 60, 0x2f2927, 0x9b7d57, 0.91, 13);
    clickUpgradeText = text(scene, root, 474, 380, "", 17, "#f9e8c9", "900")
      .setName("workshop-landscape-management");
    offlineText = text(scene, root, 590, 380, "", 17, "#d7ecff", "900");
    prestigeText = text(scene, root, 704, 380, "", 17, "#ead5ff", "900");
    hitButton(scene, root, 474, 380, 105, 52, () => scene.state && updateState(scene, buyClickUpgrades(scene.state, 1)));
    hitButton(scene, root, 590, 380, 105, 52, () => scene.state && updateState(scene, buyOfflineExtension(scene.state)));
    hitButton(scene, root, 704, 380, 105, 52, () => {
      if (!scene.state || essenceOnPrestige(scene.state) <= 0) return;
      const show = Reflect.get(scene, "showTownChoice");
      if (typeof show === "function") show.call(scene);
    });

    // Generator counts belong to equipment detail. Keeping six tiny labels on
    // the main landscape surface made every action row compete for attention.
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
    blackboardText: root.getData("blackboardText") as Phaser.GameObjects.Text | undefined,
    hero,
    cauldron,
    brewX,
    brewY,
  };
  uiByScene.set(scene, ui);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => uiByScene.delete(scene));
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
  const lang = scene.lang ?? "en";
  const rec = recommended(state);
  const rate = productionPerSec(state);
  const town = townForState(state);
  ui.potionText.setText(`${formatNumber(state.potions)} ${lang === "ja" ? "ポーション" : "potions"}`);
  ui.rateText.setText(`+${formatNumber(rate)}${lang === "ja" ? "/秒" : "/sec"}   ·   ${lang === "ja" ? "調合" : "BREW"} +${formatNumber(state.clickPower * essenceMultiplier(state))}`);
  ui.essenceText.setText(`${lang === "ja" ? "エッセンス" : "Essence"} ${formatNumber(state.essence)}`);
  ui.reputationText.setText(`${lang === "ja" ? "評判" : "REP"} ${state.reputation}`);
  const demandedId = demandGenerator(state);
  const demandedName = demandedId ? GENERATORS.find(def => def.id === demandedId)?.name ?? demandedId : null;
  ui.townText.setText(`🏘 ${townName(lang, town.index, town.cycle, town.name)}${demandedName ? ` · ${generatorName(lang, demandedId!)}×1.5` : lang === "ja" ? " · 通常生産" : " · Standard production"}`);

  ui.orderTexts.forEach((node, index) => {
    const done = state.completedContracts.includes(index);
    const cost = contractCost(state, index);
    const orderName = lang === "ja"
      ? (index === 0 ? "常備薬" : "商隊納品")
      : (index === 0 ? "Village supplies" : "Caravan shipment");
    node.setText(done
      ? `${orderName}\n${lang === "ja" ? "納品済み" : "Delivered"} ✓`
      : `${orderName}  ${formatNumber(cost)}\n+${contractReward(state, index)} ${lang === "ja" ? "評判" : "REP"}`);
    node.setAlpha(done ? 0.55 : 1);
  });

  ui.recommendationText.setText(`${lang === "ja" ? "おすすめ" : "Recommended"}  ${generatorName(lang, rec.id)} Lv.${rec.count}\n${lang === "ja" ? "次" : "Next"} ${formatNumber(rec.cost)}`);
  if (ui.blackboardText) {
    const nextOrder = [0, 1].find(index => !state.completedContracts.includes(index));
    if (nextOrder === undefined) {
      ui.blackboardText.setText(lang === "ja" ? "本日の依頼\nすべて納品済み ✓" : "TODAY'S ORDERS\nALL DELIVERED ✓");
    } else {
      const cost = contractCost(state, nextOrder);
      ui.blackboardText.setText(
        lang === "ja"
          ? `次の依頼\n${formatNumber(Math.min(state.potions, cost))} / ${formatNumber(cost)}\n評判 +${contractReward(state, nextOrder)}`
          : `NEXT ORDER\n${formatNumber(Math.min(state.potions, cost))} / ${formatNumber(cost)}\nREP +${contractReward(state, nextOrder)}`,
      );
    }
  }
  const clickCost = (() => {
    const next = buyClickUpgrades({ ...state, potions: Number.MAX_SAFE_INTEGER }, 1);
    if (!next) return 0;
    return Math.max(0, state.potions - (buyClickUpgrades(state, 1)?.potions ?? state.potions));
  })();
  ui.clickUpgradeText.setText(`${lang === "ja" ? "調合強化" : "TAP POWER"}\nLv.${state.clickPower}${clickCost > 0 ? ` ${formatNumber(clickCost)}` : ""}`);
  const offlineCost = offlineExtensionCost(state);
  ui.offlineText.setText(`${lang === "ja" ? "放置" : "Offline"} ${Math.round(offlineCapSec(state) / 3600)}h\n${offlineCost === null ? "MAX" : `${offlineCost} ${lang === "ja" ? "エッセンス" : "Essence"}`}`);
  const essenceGain = essenceOnPrestige(state);
  ui.prestigeText.setText(`${lang === "ja" ? "転生" : "ASCEND"}\n${essenceGain > 0 ? `+${essenceGain} ${lang === "ja" ? "エッセンス" : "Essence"}` : `${Math.floor((state.totalBrewed / PRESTIGE_UNLOCK) * 100)}%`}`);

  ui.prestigeBar.clear();
  const ratio = Phaser.Math.Clamp(state.totalBrewed / PRESTIGE_UNLOCK, 0, 1);
  const width = ui.orientation === "portrait" ? 105 : 95;
  const x = ui.orientation === "portrait" ? 365 : 704;
  const y = ui.orientation === "portrait" ? 704 : 408;
  ui.prestigeBar.fillStyle(0x4b3d57, 0.8).fillRoundedRect(x - width / 2, y, width, 5, 3);
  ui.prestigeBar.fillStyle(0xb77de6, 1).fillRoundedRect(x - width / 2, y, width * ratio, 5, 3);

  const defs = GENERATORS.slice(0, ui.productionTexts.length);
  ui.productionTexts.forEach((node, i) => {
    const def = defs[i]!;
    const localized = generatorName(lang, def.id);
    node.setText(`${lang === "ja" ? localized.replace("錬金術師", "錬金") : localized}\n×${state.counts[def.id] ?? 0}`);
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

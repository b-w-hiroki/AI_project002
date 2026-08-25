import Phaser from "phaser";
import { ACHIEVEMENTS, checkNewAchievements, unlockAchievements } from "../logic/achievements";
import {
  applyOfflineProgress,
  buyClickUpgrades,
  buyGenerator,
  buyOfflineExtension,
  click,
  CLICK_UPGRADE_QUANTITIES,
  clickUpgradeCostForQuantity,
  essenceMultiplier,
  essenceOnPrestige,
  formatNumber,
  GameState,
  GENERATORS,
  generatorCost,
  maxAffordableClickUpgrades,
  newGame,
  offlineCapSec,
  offlineExtensionCost,
  prestige,
  PRESTIGE_UNLOCK,
  productionPerSec,
  tick,
} from "../logic/economy";
import { achievementName, detectLang, generatorName, Lang, t, toggleLang } from "../logic/i18n";
import {
  AnalyticsData,
  loadAnalytics,
  newAnalytics,
  recordPlaytime,
  recordPrestige,
  recordSessionStart,
  saveAnalytics,
} from "../logic/analytics";
import { exportSaveJson, load, parseSaveJson, save } from "../logic/save";
import { sfx } from "../platform/audio";
import { cg } from "../platform/crazygames";
import { RoundedRect, drawPanel, makeRoundedRect } from "../ui/theme";

const SAVE_INTERVAL_MS = 5_000;
const SOUND_PREF_KEY = "ai_project002_sound_v1";

/** ポーション工房 — メイン画面 */
export class IdleScene extends Phaser.Scene {
  private state: GameState = newGame();
  private analytics: AnalyticsData = newAnalytics();
  private lang: Lang = detectLang(navigator.language);
  private soundOn = localStorage.getItem(SOUND_PREF_KEY) !== "off";

  private titleText!: Phaser.GameObjects.Text;
  private potionText!: Phaser.GameObjects.Text;
  private rateText!: Phaser.GameObjects.Text;
  private essenceText!: Phaser.GameObjects.Text;
  private brewText!: Phaser.GameObjects.Text;
  private langText!: Phaser.GameObjects.Text;
  private soundText!: Phaser.GameObjects.Text;
  private clickUpgradeText!: Phaser.GameObjects.Text;
  private clickUpgradeButton!: RoundedRect;
  private offlineCapText!: Phaser.GameObjects.Text;
  private offlineCapButton!: RoundedRect;
  private prestigeButton!: RoundedRect;
  private prestigeText!: Phaser.GameObjects.Text;
  private buyQty = 1; // クリック強化の一括購入数。CLICK_UPGRADE_QUANTITIES のいずれか（Infinity = MAX）
  private qtyButtons: { qty: number; rect: RoundedRect }[] = [];
  private rows: {
    id: string;
    button: RoundedRect;
    label: Phaser.GameObjects.Text;
  }[] = [];

  private welcomeGained = 0;
  private lastSave = 0;

  constructor() {
    super("idle");
  }

  create(): void {
    this.analytics = recordSessionStart(loadAnalytics(localStorage), Date.now());
    saveAnalytics(this.analytics, localStorage);

    // セーブ復元＋オフライン進行
    const data = load(localStorage);
    if (data) {
      const elapsed = (Date.now() - data.savedAt) / 1000;
      const { state, gained } = applyOfflineProgress(data.state, elapsed);
      this.state = state;
      this.welcomeGained = gained;
    }

    this.buildBackground();
    this.buildHeader();
    this.buildBrewArea();
    this.buildGeneratorList();
    this.buildSaveTools();

    this.refreshStaticTexts();
    this.refreshUI();
    cg.gameplayStart();

    if (this.welcomeGained >= 1) {
      this.showWelcomeModal(this.welcomeGained);
    }
  }

  update(_time: number, delta: number): void {
    this.state = tick(this.state, delta / 1000);
    this.checkAchievements();
    this.refreshUI();

    this.lastSave += delta;
    if (this.lastSave >= SAVE_INTERVAL_MS) {
      this.lastSave = 0;
      save(this.state, localStorage, Date.now());
      this.analytics = recordPlaytime(this.analytics, SAVE_INTERVAL_MS / 1000, Date.now());
      saveAnalytics(this.analytics, localStorage);
    }
  }

  // ---- 画面構築 ----

  private buildBackground(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x0f1022, 0x0f1022, 0x162238, 0x162238, 1);
    g.fillRect(0, 0, 800, 760);
    const glow = this.add.graphics();
    glow.fillStyle(0x4ecca3, 0.06);
    glow.fillCircle(160, 230, 220);

    for (let i = 0; i < 14; i++) {
      const x = Phaser.Math.Between(20, 780);
      const y = Phaser.Math.Between(140, 700);
      const bubble = this.add.circle(x, y, Phaser.Math.Between(2, 5), 0x4ecca3, 0.15);
      this.tweens.add({
        targets: bubble,
        y: y - Phaser.Math.Between(30, 80),
        alpha: 0,
        duration: Phaser.Math.Between(4000, 9000),
        repeat: -1,
        delay: Phaser.Math.Between(0, 4000),
      });
    }
  }

  private buildHeader(): void {
    this.titleText = this.add
      .text(400, 26, "", { fontSize: "26px", color: "#e0e0ff" })
      .setOrigin(0.5);
    this.potionText = this.add
      .text(400, 62, "", { fontSize: "20px", color: "#4ecca3" })
      .setOrigin(0.5);
    this.rateText = this.add
      .text(400, 88, "", { fontSize: "13px", color: "#8888aa" })
      .setOrigin(0.5);
    this.essenceText = this.add
      .text(16, 14, "", { fontSize: "14px", color: "#d9a7ff" })
      .setOrigin(0, 0);

    // 右上ボタン群: 実績 / サウンド / 言語
    const achButton = this.makeSmallButton(600, 26, 90, "", () => this.showAchievementsModal());
    this.registerRefresh(() => achButton.label.setText(t(this.lang, "achievementsButton")));

    const soundButton = this.makeSmallButton(700, 26, 44, "", () => {
      this.soundOn = !this.soundOn;
      localStorage.setItem(SOUND_PREF_KEY, this.soundOn ? "on" : "off");
      this.refreshStaticTexts();
    });
    this.soundText = soundButton.label;

    const langButton = this.makeSmallButton(760, 26, 60, "", () => {
      this.lang = toggleLang(this.lang);
      this.refreshStaticTexts();
    });
    this.langText = langButton.label;
  }

  private buildBrewArea(): void {
    // 柔らかいグロー＋二重リングで単色円より奥行きを出す
    this.add.circle(160, 230, 78, 0x7b2cbf, 0.18);
    const ring = this.add.circle(160, 230, 70, 0x7b2cbf, 0).setStrokeStyle(2, 0xd9a7ff, 0.5);
    const brew = this.add
      .circle(160, 230, 65, 0x7b2cbf)
      .setStrokeStyle(2, 0x9d5fd6, 0.9)
      .setInteractive({ useHandCursor: true });
    this.brewText = this.add
      .text(160, 230, "", { fontSize: "22px", color: "#ffffff", fontStyle: "700" })
      .setOrigin(0.5);
    brew.on("pointerdown", () => {
      const gain = this.state.clickPower * essenceMultiplier(this.state);
      this.state = click(this.state);
      this.playSound(sfx.click);
      this.tweens.add({ targets: [brew, ring], scale: 0.92, duration: 60, yoyo: true });
      this.spawnFloatingText(160, 155, `+${formatNumber(gain)}`, "#4ecca3");
    });

    // 購入数セレクター（クリック強化に使う一括購入数）
    CLICK_UPGRADE_QUANTITIES.forEach((qty, i) => {
      const bx = 40 + i * 60;
      const rect = makeRoundedRect(this, bx, 322, 52, 26, qty === this.buyQty ? 0x5a3a8a : 0x2a2a4a, {
        radius: 8,
        borderWidth: 1,
      });
      const label = this.add
        .text(bx, 322, qty === Infinity ? t(this.lang, "buyQtyMax") : `x${qty}`, {
          fontSize: "12px",
          color: "#ccccdd",
        })
        .setOrigin(0.5);
      rect.on("pointerdown", () => {
        this.buyQty = qty;
        for (const b of this.qtyButtons) {
          b.rect.setFillStyle(b.qty === this.buyQty ? 0x5a3a8a : 0x2a2a4a);
        }
      });
      this.qtyButtons.push({ qty, rect });
      this.registerRefresh(() =>
        label.setText(qty === Infinity ? t(this.lang, "buyQtyMax") : `x${qty}`),
      );
    });

    // クリック強化（購入数セレクターに応じて一括購入）
    this.clickUpgradeButton = makeRoundedRect(this, 160, 375, 260, 56, 0x2a3a4a, {
      radius: 12,
      borderColor: 0x44586a,
    });
    this.clickUpgradeText = this.add
      .text(160, 375, "", { fontSize: "13px", color: "#ccccdd", align: "center" })
      .setOrigin(0.5);
    this.clickUpgradeButton.on("pointerdown", () => {
      const before = this.state.clickPower;
      const next = buyClickUpgrades(this.state, this.buyQty);
      if (next) {
        const gained = next.clickPower - before;
        this.state = next;
        this.playSound(sfx.buy);
        this.spawnFloatingText(160, 345, `+${gained} ⚡`, "#ffd166");
      }
    });

    // 放置上限拡張（essence消費、複数ソース加算式で将来の課金/バフ等にも対応できる設計）
    this.offlineCapButton = makeRoundedRect(this, 160, 440, 260, 44, 0x2a3a4a, {
      radius: 12,
      borderColor: 0x44586a,
    });
    this.offlineCapText = this.add
      .text(160, 440, "", { fontSize: "12px", color: "#ccccdd", align: "center" })
      .setOrigin(0.5);
    this.offlineCapButton.on("pointerdown", () => {
      const next = buyOfflineExtension(this.state);
      if (next) {
        this.state = next;
        save(this.state, localStorage, Date.now());
        this.playSound(sfx.buy);
        this.spawnFloatingText(160, 415, "+6h ⏳", "#7fd1ff");
      }
    });

    // 転生
    this.prestigeButton = makeRoundedRect(this, 160, 525, 260, 64, 0x3a2a5a, {
      radius: 14,
      borderColor: 0x7b2cbf,
    });
    this.prestigeText = this.add
      .text(160, 525, "", {
        fontSize: "12px",
        color: "#d9a7ff",
        align: "center",
        wordWrap: { width: 240 },
      })
      .setOrigin(0.5);
    this.prestigeButton.on("pointerdown", () => {
      const gained = essenceOnPrestige(this.state);
      if (gained <= 0) return;
      if (!window.confirm(t(this.lang, "prestigeConfirm", { n: formatNumber(gained) }))) return;
      const next = prestige(this.state);
      if (next) {
        this.state = next;
        save(this.state, localStorage, Date.now());
        this.analytics = recordPrestige(this.analytics, this.state.prestigeCount);
        saveAnalytics(this.analytics, localStorage);
        this.playSound(sfx.prestige);
        this.cameras.main.flash(600, 217, 167, 255);
      }
    });
  }

  private buildGeneratorList(): void {
    GENERATORS.forEach((g, i) => {
      const y = 130 + i * 62;
      const button = makeRoundedRect(this, 560, y, 400, 52, 0x2a2a4a, { radius: 10, borderColor: 0x44446a });
      const label = this.add
        .text(370, y - 16, "", { fontSize: "14px", color: "#ccccdd" })
        .setOrigin(0, 0);
      button.on("pointerdown", () => {
        const next = buyGenerator(this.state, g.id);
        if (next) {
          this.state = next;
          this.playSound(sfx.buy);
          this.tweens.add({ targets: [button, label], scaleX: 1.03, duration: 70, yoyo: true });
          this.spawnFloatingText(560, y - 30, `${generatorName(this.lang, g.id)} +1`, "#ffd166");
        }
      });
      this.rows.push({ id: g.id, button, label });
    });
  }

  private buildSaveTools(): void {
    const exportButton = this.makeSmallButton(220, 730, 200, "", () => this.doExport());
    this.registerRefresh(() => exportButton.label.setText(t(this.lang, "exportButton")));

    const importButton = this.makeSmallButton(440, 730, 200, "", () => this.doImport());
    this.registerRefresh(() => importButton.label.setText(t(this.lang, "importButton")));
  }

  // ---- 小さな汎用ボタン ----
  private refreshCallbacks: (() => void)[] = [];
  private registerRefresh(fn: () => void): void {
    this.refreshCallbacks.push(fn);
  }

  private makeSmallButton(
    x: number,
    y: number,
    width: number,
    initialText: string,
    onClick: () => void,
  ): { rect: RoundedRect; label: Phaser.GameObjects.Text } {
    const rect = makeRoundedRect(this, x, y, width, 32, 0x2a2a4a, { radius: 8, borderWidth: 1 });
    const label = this.add
      .text(x, y, initialText, { fontSize: "13px", color: "#ccccdd" })
      .setOrigin(0.5);
    rect.on("pointerdown", onClick);
    return { rect, label };
  }

  // ---- モーダル ----

  private showModal(bodyText: string, onClose?: () => void): void {
    const overlay = this.add.rectangle(400, 380, 800, 760, 0x000000, 0.7).setInteractive();
    const panel = drawPanel(this, 400, 380, 560, 420, { radius: 20, fillColor: 0x1a1a30, shadow: false });
    const text = this.add
      .text(400, 340, bodyText, {
        fontSize: "14px",
        color: "#e0e0ff",
        align: "center",
        wordWrap: { width: 500 },
      })
      .setOrigin(0.5);
    const closeBtn = this.makeSmallButton(400, 550, 140, t(this.lang, "closeButton"), () => {
      overlay.destroy();
      panel.destroy();
      text.destroy();
      closeBtn.rect.destroy();
      closeBtn.label.destroy();
      onClose?.();
    });
  }

  private showWelcomeModal(gained: number): void {
    this.showModal(
      `${t(this.lang, "welcomeTitle")}\n\n${t(this.lang, "welcomeBack", { n: formatNumber(gained) })}`,
    );
  }

  private showAchievementsModal(): void {
    const lines = ACHIEVEMENTS.map((a) => {
      const unlocked = this.state.unlockedAchievements.includes(a.id);
      return `${unlocked ? "✅" : "🔒"} ${achievementName(this.lang, a.id)}`;
    }).join("\n");
    this.showModal(`${t(this.lang, "achievementsTitle")}\n\n${lines}`);
  }

  // ---- セーブ書き出し/読み込み ----

  private doExport(): void {
    const json = exportSaveJson(this.state, Date.now());
    void navigator.clipboard?.writeText(json).catch(() => {});
    this.showModal(t(this.lang, "exportDone"));
  }

  private doImport(): void {
    const raw = window.prompt(t(this.lang, "importPrompt"));
    if (!raw) return;
    const parsed = parseSaveJson(raw);
    if (!parsed) {
      this.showModal(t(this.lang, "importFailed"));
      return;
    }
    this.state = parsed.state;
    save(this.state, localStorage, Date.now());
    this.showModal(t(this.lang, "importDone"));
  }

  // ---- 実績チェック ----

  private checkAchievements(): void {
    const newly = checkNewAchievements(this.state);
    if (newly.length === 0) return;
    this.state = unlockAchievements(this.state, newly);
    this.playSound(sfx.achievement);
    for (const id of newly) {
      this.spawnFloatingText(
        400,
        700,
        t(this.lang, "achievementUnlocked", { n: achievementName(this.lang, id) }),
        "#ffd166",
      );
    }
  }

  private playSound(fn: () => void): void {
    if (this.soundOn) fn();
  }

  /** クリック位置から浮かんで消えるテキスト演出 */
  private spawnFloatingText(x: number, y: number, text: string, color: string): void {
    const obj = this.add
      .text(x + Phaser.Math.Between(-20, 20), y, text, { fontSize: "16px", color })
      .setOrigin(0.5);
    this.tweens.add({
      targets: obj,
      y: y - 50,
      alpha: 0,
      duration: 900,
      onComplete: () => obj.destroy(),
    });
  }

  /** 言語・設定に依存する固定文言を更新 */
  private refreshStaticTexts(): void {
    this.titleText.setText(t(this.lang, "title"));
    this.brewText.setText(t(this.lang, "brew"));
    this.langText.setText(t(this.lang, "langButton"));
    this.soundText.setText(this.soundOn ? t(this.lang, "soundOn") : t(this.lang, "soundOff"));
    for (const fn of this.refreshCallbacks) fn();
  }

  private refreshUI(): void {
    this.potionText.setText(
      `${formatNumber(this.state.potions)} ${t(this.lang, "potions")}`,
    );
    this.rateText.setText(
      `${formatNumber(productionPerSec(this.state))} ${t(this.lang, "perSec")}`,
    );

    const bonusPct = Math.round(this.state.essence * 10);
    this.essenceText.setText(
      this.state.essence > 0
        ? `${t(this.lang, "essence")} ${formatNumber(this.state.essence)}\n${t(this.lang, "essenceBonus", { n: bonusPct.toString() })}`
        : "",
    );

    const affordableQty = maxAffordableClickUpgrades(this.state);
    const displayQty =
      this.buyQty === Infinity ? Math.max(affordableQty, 1) : this.buyQty;
    const clickCost = clickUpgradeCostForQuantity(this.state, displayQty);
    const clickAffordable = affordableQty >= 1;
    this.clickUpgradeText.setText(
      `${t(this.lang, "clickUpgrade")} (${this.state.clickPower})\n` +
        `${t(this.lang, "clickUpgradeDesc", { n: displayQty.toString() })}\n` +
        `${t(this.lang, "cost")}: ${formatNumber(clickCost)}`,
    );
    this.clickUpgradeButton.setFillStyle(clickAffordable ? 0x2f5848 : 0x2a3a4a);

    const capSec = offlineCapSec(this.state);
    const capHours = Math.round(capSec / 3600);
    const extCost = offlineExtensionCost(this.state);
    if (extCost === null) {
      this.offlineCapText.setText(t(this.lang, "offlineCapMaxed", { h: capHours.toString() }));
      this.offlineCapButton.setFillStyle(0x2a3a4a);
    } else {
      const capAffordable = this.state.essence >= extCost;
      this.offlineCapText.setText(
        `${t(this.lang, "offlineCapLabel", { h: capHours.toString() })}\n${t(this.lang, "offlineCapButton")}: ${formatNumber(extCost)}✨`,
      );
      this.offlineCapButton.setFillStyle(capAffordable ? 0x2f4858 : 0x2a3a4a);
    }

    const gained = essenceOnPrestige(this.state);
    if (gained > 0) {
      this.prestigeText.setText(t(this.lang, "prestige", { n: formatNumber(gained) }));
      this.prestigeButton.setFillStyle(0x5a3a8a);
    } else {
      this.prestigeText.setText(
        t(this.lang, "prestigeLocked", { n: formatNumber(PRESTIGE_UNLOCK) }),
      );
      this.prestigeButton.setFillStyle(0x3a2a5a);
    }

    for (const row of this.rows) {
      const def = GENERATORS.find((g) => g.id === row.id)!;
      const count = this.state.counts[row.id] ?? 0;
      const cost = generatorCost(def, count);
      const affordable = this.state.potions >= cost;
      row.label.setText(
        `${generatorName(this.lang, def.id)}  ×${count}\n` +
          `${t(this.lang, "cost")}: ${formatNumber(cost)}   +${formatNumber(def.baseRate)}${t(this.lang, "perSec")}`,
      );
      row.button.setFillStyle(affordable ? 0x2f4858 : 0x2a2a4a);
      row.label.setColor(affordable ? "#aaffdd" : "#777788");
    }
  }
}

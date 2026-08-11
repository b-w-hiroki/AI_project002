import Phaser from "phaser";
import {
  applyOfflineProgress,
  buyGenerator,
  click,
  essenceMultiplier,
  essenceOnPrestige,
  formatNumber,
  GameState,
  GENERATORS,
  generatorCost,
  newGame,
  prestige,
  PRESTIGE_UNLOCK,
  productionPerSec,
  tick,
} from "../logic/economy";
import { detectLang, generatorName, Lang, t, toggleLang } from "../logic/i18n";
import { load, save } from "../logic/save";
import { cg } from "../platform/crazygames";

const SAVE_INTERVAL_MS = 5_000;

/** ポーション工房 — メイン画面 */
export class IdleScene extends Phaser.Scene {
  private state: GameState = newGame();
  private lang: Lang = detectLang(navigator.language);
  private titleText!: Phaser.GameObjects.Text;
  private potionText!: Phaser.GameObjects.Text;
  private rateText!: Phaser.GameObjects.Text;
  private essenceText!: Phaser.GameObjects.Text;
  private brewText!: Phaser.GameObjects.Text;
  private langText!: Phaser.GameObjects.Text;
  private prestigeButton!: Phaser.GameObjects.Rectangle;
  private prestigeText!: Phaser.GameObjects.Text;
  private welcomeText?: Phaser.GameObjects.Text;
  private welcomeGained = 0;
  private rows: {
    id: string;
    button: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
  }[] = [];
  private lastSave = 0;

  constructor() {
    super("idle");
  }

  create(): void {
    // セーブ復元＋オフライン進行
    const data = load(localStorage);
    if (data) {
      const elapsed = (Date.now() - data.savedAt) / 1000;
      const { state, gained } = applyOfflineProgress(data.state, elapsed);
      this.state = state;
      if (gained >= 1) {
        this.welcomeGained = gained;
        this.welcomeText = this.add
          .text(400, 585, "", { fontSize: "14px", color: "#ffd166" })
          .setOrigin(0.5);
      }
    }

    // 背景の雰囲気（ゆっくり明滅する泡）
    for (let i = 0; i < 14; i++) {
      const x = Phaser.Math.Between(20, 780);
      const y = Phaser.Math.Between(120, 560);
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

    this.titleText = this.add
      .text(400, 30, "", { fontSize: "28px", color: "#e0e0ff" })
      .setOrigin(0.5);
    this.potionText = this.add
      .text(400, 70, "", { fontSize: "22px", color: "#4ecca3" })
      .setOrigin(0.5);
    this.rateText = this.add
      .text(400, 98, "", { fontSize: "14px", color: "#8888aa" })
      .setOrigin(0.5);
    this.essenceText = this.add
      .text(20, 20, "", { fontSize: "15px", color: "#d9a7ff" })
      .setOrigin(0, 0);

    // 言語切り替えボタン（右上）
    const langButton = this.add
      .rectangle(755, 30, 70, 32, 0x2a2a4a)
      .setStrokeStyle(1, 0x44446a)
      .setInteractive({ useHandCursor: true });
    this.langText = this.add
      .text(755, 30, "", { fontSize: "14px", color: "#ccccdd" })
      .setOrigin(0.5);
    langButton.on("pointerdown", () => {
      this.lang = toggleLang(this.lang);
      this.refreshStaticTexts();
    });

    // 調合ボタン
    const brew = this.add
      .circle(180, 300, 80, 0x7b2cbf)
      .setInteractive({ useHandCursor: true });
    this.brewText = this.add
      .text(180, 300, "", { fontSize: "24px", color: "#ffffff" })
      .setOrigin(0.5);
    brew.on("pointerdown", () => {
      const gain = this.state.clickPower * essenceMultiplier(this.state);
      this.state = click(this.state);
      this.tweens.add({ targets: brew, scale: 0.92, duration: 60, yoyo: true });
      this.spawnFloatingText(180, 210, `+${formatNumber(gain)}`, "#4ecca3");
    });

    // 設備購入ボタン
    GENERATORS.forEach((g, i) => {
      const y = 150 + i * 66;
      const button = this.add
        .rectangle(560, y, 400, 54, 0x2a2a4a)
        .setStrokeStyle(2, 0x44446a)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(370, y - 17, "", { fontSize: "15px", color: "#ccccdd" })
        .setOrigin(0, 0);
      button.on("pointerdown", () => {
        const next = buyGenerator(this.state, g.id);
        if (next) {
          this.state = next;
          cg.happytime();
          this.tweens.add({ targets: [button, label], scaleX: 1.03, duration: 70, yoyo: true });
          this.spawnFloatingText(560, y - 34, `${generatorName(this.lang, g.id)} +1`, "#ffd166");
        }
      });
      this.rows.push({ id: g.id, button, label });
    });

    // 転生ボタン（下部中央）
    this.prestigeButton = this.add
      .rectangle(180, 470, 280, 48, 0x3a2a5a)
      .setStrokeStyle(2, 0x7b2cbf)
      .setInteractive({ useHandCursor: true });
    this.prestigeText = this.add
      .text(180, 470, "", { fontSize: "14px", color: "#d9a7ff" })
      .setOrigin(0.5);
    this.prestigeButton.on("pointerdown", () => {
      const gained = essenceOnPrestige(this.state);
      if (gained <= 0) return;
      if (!window.confirm(t(this.lang, "prestigeConfirm", { n: formatNumber(gained) }))) return;
      const next = prestige(this.state);
      if (next) {
        this.state = next;
        save(this.state, localStorage, Date.now());
        cg.happytime();
        this.cameras.main.flash(600, 217, 167, 255);
      }
    });

    this.refreshStaticTexts();
    this.refreshUI();
    cg.gameplayStart();
  }

  update(_time: number, delta: number): void {
    this.state = tick(this.state, delta / 1000);
    this.refreshUI();

    this.lastSave += delta;
    if (this.lastSave >= SAVE_INTERVAL_MS) {
      this.lastSave = 0;
      save(this.state, localStorage, Date.now());
    }
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
      duration: 800,
      onComplete: () => obj.destroy(),
    });
  }

  /** 言語に依存する固定文言を更新 */
  private refreshStaticTexts(): void {
    this.titleText.setText(t(this.lang, "title"));
    this.brewText.setText(t(this.lang, "brew"));
    this.langText.setText(t(this.lang, "langButton"));
    this.welcomeText?.setText(
      t(this.lang, "welcomeBack", { n: formatNumber(this.welcomeGained) }),
    );
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

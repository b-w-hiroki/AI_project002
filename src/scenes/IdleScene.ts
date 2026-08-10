import Phaser from "phaser";
import {
  applyOfflineProgress,
  buyGenerator,
  click,
  formatNumber,
  GameState,
  GENERATORS,
  generatorCost,
  newGame,
  productionPerSec,
  tick,
} from "../logic/economy";
import { load, save } from "../logic/save";

const SAVE_INTERVAL_MS = 5_000;

/** ポーション工房 — 放置ゲーム MVP のメイン画面 */
export class IdleScene extends Phaser.Scene {
  private state: GameState = newGame();
  private potionText!: Phaser.GameObjects.Text;
  private rateText!: Phaser.GameObjects.Text;
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
        this.add
          .text(400, 570, `おかえりなさい！ 留守中に ${formatNumber(gained)} ポーション調合されました`, {
            fontSize: "14px",
            color: "#ffd166",
          })
          .setOrigin(0.5);
      }
    }

    this.add
      .text(400, 30, "🧪 ポーション工房", { fontSize: "28px", color: "#e0e0ff" })
      .setOrigin(0.5);

    this.potionText = this.add
      .text(400, 70, "", { fontSize: "22px", color: "#4ecca3" })
      .setOrigin(0.5);
    this.rateText = this.add
      .text(400, 98, "", { fontSize: "14px", color: "#8888aa" })
      .setOrigin(0.5);

    // 調合ボタン（クリックで生産）
    const brew = this.add
      .circle(180, 300, 80, 0x7b2cbf)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(180, 300, "調合！", { fontSize: "24px", color: "#ffffff" })
      .setOrigin(0.5);
    brew.on("pointerdown", () => {
      this.state = click(this.state);
      this.tweens.add({ targets: brew, scale: 0.92, duration: 60, yoyo: true });
    });

    // 設備購入ボタン
    GENERATORS.forEach((g, i) => {
      const y = 170 + i * 70;
      const button = this.add
        .rectangle(560, y, 400, 56, 0x2a2a4a)
        .setStrokeStyle(2, 0x44446a)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(370, y - 18, "", { fontSize: "15px", color: "#ccccdd" })
        .setOrigin(0, 0);
      button.on("pointerdown", () => {
        const next = buyGenerator(this.state, g.id);
        if (next) this.state = next;
      });
      this.rows.push({ id: g.id, button, label });
    });

    this.refreshUI();
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

  private refreshUI(): void {
    this.potionText.setText(`${formatNumber(this.state.potions)} ポーション`);
    this.rateText.setText(`${formatNumber(productionPerSec(this.state))} /秒`);
    for (const row of this.rows) {
      const def = GENERATORS.find((g) => g.id === row.id)!;
      const count = this.state.counts[row.id] ?? 0;
      const cost = generatorCost(def, count);
      const affordable = this.state.potions >= cost;
      row.label.setText(
        `${def.name}  ×${count}\nコスト: ${formatNumber(cost)}   +${formatNumber(def.baseRate)}/秒`,
      );
      row.button.setFillStyle(affordable ? 0x2f4858 : 0x2a2a4a);
      row.label.setColor(affordable ? "#aaffdd" : "#777788");
    }
  }
}

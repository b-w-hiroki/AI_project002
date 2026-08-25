import Phaser from "phaser";
import type { WeaponKind } from "../logic/combat";
import {
  ARMOR_TEMPLATES,
  BLACKSMITH_COST,
  DEFAULT_CHEST_WEIGHTS,
  WEAPON_TEMPLATES,
  assignLoadoutSlot,
  craftAtBlacksmith,
  effectiveStats,
  findTemplate,
  loadLoadout,
  newLoadoutSave,
  openChest,
  saveLoadout,
  type LoadoutSaveData,
} from "../logic/loadout";
import { buildOrientationWarning, isTouchDevice, makeTappable } from "../ui/touch";
import { ELEVATION, THEME, drawPanel, makeButton } from "../ui/theme";

const KIND_LABEL: Readonly<Record<WeaponKind, string>> = {
  melee: "近距離",
  mid: "中距離",
  ranged: "遠距離",
};

const RARITY_COLOR: Readonly<Record<string, string>> = {
  N: "#6a7a95",
  R: "#1f8a63",
  SR: "#2f8fd1",
  SSR: "#8a4fd1",
  UR: "#c98a12",
};

/**
 * アウトゲームのロードアウト画面。
 * 所持している武器個体（WeaponInstance）を近/中/遠の各スロットへ設定し、
 * 設定内容はステージ開始時に GameScene へ渡す。
 *
 * 宝箱・鍛治による入手は本画面から行えるようにし、獲得した個体は
 * localStorage（KVStore経由）へ永続化する。
 */
export class LoadoutScene extends Phaser.Scene {
  private data_: LoadoutSaveData = newLoadoutSave();
  private selectedInstanceId: string | null = null;
  private inventoryTexts: Phaser.GameObjects.GameObject[] = [];
  private slotTexts: Partial<Record<WeaponKind, Phaser.GameObjects.Text>> = {};
  private currencyText?: Phaser.GameObjects.Text;
  private hintText?: Phaser.GameObjects.Text;
  private armorTexts: { id: string; label: string; text: Phaser.GameObjects.Text }[] = [];
  private rarityBar!: Phaser.GameObjects.Graphics;
  private slotGlows: Partial<Record<WeaponKind, Phaser.GameObjects.Graphics>> = {};

  constructor() {
    super("LoadoutScene");
  }

  create(): void {
    this.data_ = loadLoadout(window.localStorage);
    if (this.data_.currency === 0 && this.data_.inventory.length === 0) {
      // 初回プレイ時のみ、遊び始められるよう少額の通貨を配布
      this.data_ = { ...this.data_, currency: 500 };
    }

    this.buildBackground();

    this.add
      .text(400, 34, "⚔️ 剣戟の森", { fontSize: "26px", color: THEME.textPrimary, fontStyle: "700" })
      .setOrigin(0.5, 0);
    this.add
      .text(400, 66, "ロードアウト設定 — 所持武器を選んでスロットに設定してください", {
        fontSize: "13px",
        color: THEME.textMuted,
      })
      .setOrigin(0.5, 0);

    drawPanel(this, 68, 24, 100, 32, { radius: 8, fillColor: 0x2a2210, borderColor: 0xffcc66, borderAlpha: 0.5 });
    this.currencyText = this.add
      .text(68, 24, "", { fontSize: "14px", color: "#ffcc66", fontStyle: "600" })
      .setOrigin(0.5);

    this.buildSlotPanel();
    this.buildInventoryPanel();
    this.buildAcquirePanel();
    this.buildArmorPanel();
    this.buildStartButton();
    this.hintText = this.add
      .text(400, 580, "", { fontSize: "13px", color: "#1f8a63", fontStyle: "600" })
      .setOrigin(0.5, 0);

    if (isTouchDevice(this)) buildOrientationWarning(this);

    this.refresh();
  }

  /** 淡い青空グラデーション＋うっすらとした放射状の光で、ソシャゲ調の明るいファンタジー基調にする */
  private buildBackground(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0xaee0ff, 0xaee0ff, 0xf3fbff, 0xf3fbff, 1);
    g.fillRect(0, 0, 800, 600);
    const glow = this.add.graphics();
    glow.fillStyle(0xffffff, 0.4);
    glow.fillCircle(400, -40, 260);
  }

  private persist(): void {
    saveLoadout(this.data_, window.localStorage);
  }

  private buildSlotPanel(): void {
    const kinds: WeaponKind[] = ["melee", "mid", "ranged"];
    const kindAccent: Record<WeaponKind, number> = { melee: 0xff6b8a, mid: 0xffd166, ranged: 0x7fd1ff };
    kinds.forEach((kind, i) => {
      const x = 140 + i * 180;
      const y = 130;
      drawPanel(this, x, y, 160, 90, { radius: 12, borderColor: kindAccent[kind], borderAlpha: 0.45 });
      this.add
        .text(x, y - 34, KIND_LABEL[kind], { fontSize: "12px", color: THEME.textMuted, fontStyle: "600" })
        .setOrigin(0.5);
      const text = this.add
        .text(x, y, "(未設定)", { fontSize: "13px", color: "#8a97a8", align: "center", wordWrap: { width: 150 } })
        .setOrigin(0.5);
      this.slotTexts[kind] = text;

      // 未設定スロットに気付きやすいよう、パネルの外周をゆっくりパルスさせるグローを重ねる
      const glow = this.add.graphics({ x, y });
      glow.lineStyle(3, kindAccent[kind], 1);
      glow.strokeRoundedRect(-84, -49, 168, 98, 14);
      this.slotGlows[kind] = glow;
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.15, to: 0.55 },
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      const zone = this.add.zone(x, y, 160, 90).setInteractive({ useHandCursor: true });
      zone.on("pointerdown", () => this.assignSelectedToSlot(kind));
    });
  }

  private buildInventoryPanel(): void {
    // スロットパネル（近/中/遠距離、下端y=175）との間に隙間を空け、枠線同士が接触しないようにする
    drawPanel(this, 245, 335, 460, 300, { radius: 14, fillColor: ELEVATION.zone, fillAlpha: 0.92, borderAlpha: 0.4 });
    this.add.text(20, 195, "🗡️ 所持武器（タップして選択）", { fontSize: "14px", color: THEME.textPrimary, fontStyle: "600" });
    // 所持武器のレアリティ内訳を積み上げバーで可視化する（実データはrefresh()で反映）
    this.rarityBar = this.add.graphics();
  }

  /** 所持武器のレアリティ別内訳を積み上げバーとして描画する */
  private renderRarityBar(): void {
    const order = ["N", "R", "SR", "SSR", "UR"] as const;
    const counts = order.map((r) => this.data_.inventory.filter((w) => w.rarity === r).length);
    const total = counts.reduce((a, b) => a + b, 0);
    const x0 = 20;
    const y = 218;
    const w = 440;
    const h = 6;
    this.rarityBar.clear();
    this.rarityBar.fillStyle(0xdde9f5, 1);
    this.rarityBar.fillRoundedRect(x0, y, w, h, 4);
    if (total === 0) return;
    let cx = x0;
    order.forEach((r, i) => {
      const cw = ((counts[i] ?? 0) / total) * w;
      if (cw <= 0) return;
      this.rarityBar.fillStyle(Phaser.Display.Color.ValueToColor(RARITY_COLOR[r] ?? "#8a97a8").color, 1);
      this.rarityBar.fillRect(cx, y, cw, h);
      cx += cw;
    });
  }

  private buildAcquirePanel(): void {
    // ボタンがゾーンパネルの外にはみ出さないよう、パネル上端(180)から十分な余白を確保する
    drawPanel(this, 640, 270, 300, 180, { radius: 14, fillColor: ELEVATION.zone, fillAlpha: 0.92, borderAlpha: 0.4 });
    const chestBtn = makeButton(this, 610, 200, 200, 30, "🎁 宝箱を開ける (100)", () => {
      if (this.data_.currency < 100) {
        this.setHint("通貨が足りません");
        return;
      }
      const instance = openChest(WEAPON_TEMPLATES, DEFAULT_CHEST_WEIGHTS);
      this.data_ = {
        ...this.data_,
        currency: this.data_.currency - 100,
        inventory: [...this.data_.inventory, instance],
      };
      this.persist();
      this.setHint(`${findTemplate(instance.templateId)?.name}(${instance.rarity}) を入手した！`);
      this.refresh();
    }, { fillColor: 0x2a3a2f, borderColor: 0x4ecca3, textColor: "#4ecca3", fontSize: "13px", radius: 8 });
    chestBtn.container.setDepth(1);

    let y = 231;
    for (const template of WEAPON_TEMPLATES) {
      const cost = BLACKSMITH_COST.N;
      this.add.text(500, y, `🔨 ${template.name} を鍛治(${cost})`, { fontSize: "12px", color: "#e0447a" });
      // 密なリスト（行間20px）のため高さは行間ぎりぎりまで、横幅は右端まで広げて妥協する
      makeTappable(this, 640, y + 6, 300, 18, () => this.craft(template.id));
      y += 20;
    }
  }

  /**
   * 防具はアウトゲームで固定Tierから1つ選ぶ方式（武器のようなレア度ロール/所持在庫は無い）。
   * 選択のたびにコストを支払い、選んだTierの耐久でステージに出撃する。
   */
  private buildArmorPanel(): void {
    drawPanel(this, 640, 448, 300, 130, { radius: 14, fillColor: ELEVATION.zone, fillAlpha: 0.92, borderAlpha: 0.4 });
    this.add.text(500, 390, "🛡️ 防具を選択（出撃ごとに購入）", { fontSize: "13px", color: THEME.textPrimary, fontStyle: "600" });
    let y = 413;
    for (const armor of ARMOR_TEMPLATES) {
      const label =
        armor.id === "none"
          ? "なし（耐久0）"
          : `${armor.name}（耐久${armor.maxDurability}） (${armor.cost})`;
      const text = this.add.text(500, y, label, { fontSize: "12px", color: "#2f8fd1" });
      makeTappable(this, 640, y + 6, 300, 18, () => this.selectArmor(armor.id));
      this.armorTexts.push({ id: armor.id, label, text });
      y += 20;
    }
  }

  private selectArmor(armorId: string): void {
    if (this.data_.selectedArmorId === armorId) return; // 既に選択中なら再課金しない
    const template = ARMOR_TEMPLATES.find((a) => a.id === armorId);
    if (!template) return;
    if (this.data_.currency < template.cost) {
      this.setHint("通貨が足りません");
      return;
    }
    this.data_ = {
      ...this.data_,
      currency: this.data_.currency - template.cost,
      selectedArmorId: armorId,
    };
    this.persist();
    this.setHint(`${template.name} を選択した`);
    this.refresh();
  }

  private craft(templateId: string): void {
    // 鍛治のUIを簡略化するため、本画面からは最も入手しやすい N 固定で発注する
    const crafted = craftAtBlacksmith(templateId, "N", this.data_.currency);
    if (!crafted) {
      this.setHint("通貨が足りません");
      return;
    }
    this.data_ = {
      ...this.data_,
      currency: this.data_.currency - crafted.cost,
      inventory: [...this.data_.inventory, crafted.instance],
    };
    this.persist();
    this.setHint(`${findTemplate(crafted.instance.templateId)?.name} を鍛治で入手した！`);
    this.refresh();
  }

  private buildStartButton(): void {
    makeButton(
      this,
      400,
      545,
      240,
      52,
      "▶ ステージ開始",
      () => {
        this.scene.start("GameScene", {
          loadout: this.data_.loadout,
          inventory: this.data_.inventory,
          baseEquipmentLevels: this.data_.baseEquipmentLevels,
          selectedArmorId: this.data_.selectedArmorId,
        });
      },
      { radius: 26, fillColor: 0x3a9d78, hoverColor: 0x4ecca3, textColor: "#0a0a12", fontSize: "18px" },
    );
  }

  private assignSelectedToSlot(kind: WeaponKind): void {
    if (!this.selectedInstanceId) {
      this.setHint("先に所持武器を選択してください");
      return;
    }
    const template = findTemplate(
      this.data_.inventory.find((w) => w.id === this.selectedInstanceId)?.templateId ?? "",
    );
    if (template && template.kind !== kind) {
      this.setHint(`${KIND_LABEL[kind]}スロットには装備できません`);
      return;
    }
    this.data_ = {
      ...this.data_,
      loadout: assignLoadoutSlot(this.data_.loadout, this.data_.inventory, kind, this.selectedInstanceId),
    };
    this.persist();
    this.refresh();
  }

  private setHint(text: string): void {
    this.hintText?.setText(text);
  }

  private refresh(): void {
    this.currencyText?.setText(`💰 ${this.data_.currency}`);
    this.renderRarityBar();

    for (const { id, label, text } of this.armorTexts) {
      const selected = id === this.data_.selectedArmorId;
      text.setColor(selected ? "#1f8a63" : "#2f8fd1").setText(selected ? `▶ ${label}` : label);
    }

    for (const kind of ["melee", "mid", "ranged"] as const) {
      const instanceId = this.data_.loadout[kind];
      const instance = this.data_.inventory.find((w) => w.id === instanceId);
      const text = this.slotTexts[kind];
      if (!text) continue;
      if (!instance) {
        text.setText("(未設定)").setColor("#62628a");
        this.slotGlows[kind]?.setVisible(true);
        continue;
      }
      const template = findTemplate(instance.templateId);
      text
        .setText(`${template?.name ?? "?"}\n[${instance.rarity}] +${instance.enhanceLevel}`)
        .setColor(RARITY_COLOR[instance.rarity] ?? "#8a97a8");
      this.slotGlows[kind]?.setVisible(false);
    }

    this.inventoryTexts.forEach((t) => t.destroy());
    this.inventoryTexts = [];
    this.data_.inventory.forEach((instance, i) => {
      const template = findTemplate(instance.templateId);
      const stats = effectiveStats(instance);
      const selected = instance.id === this.selectedInstanceId;
      // SR以上はソシャゲ的な★演出で高レアリティを一目で分かるようにする
      const rarityStars: Readonly<Record<string, string>> = { SR: "★", SSR: "★★", UR: "★★★" };
      const star = rarityStars[instance.rarity] ?? "";
      const label =
        `${selected ? "▶ " : "  "}${template?.name ?? "?"} [${instance.rarity}]${star ? ` ${star}` : ""} ` +
        `距離${stats.range.toFixed(0)} 力${stats.power.toFixed(1)} 速${stats.swingSpeedMs.toFixed(0)}ms ` +
        `範囲${stats.hitWidth.toFixed(0)} 重${stats.weight.toFixed(1)} コンボ${stats.comboHits}`;
      const y = 234 + i * 20;
      const text = this.add.text(20, y, label, { fontSize: "12px", color: selected ? "#1f8a63" : "#4a5a72" });
      const zone = makeTappable(this, 250, y + 6, 440, 18, () => {
        this.selectedInstanceId = instance.id;
        this.refresh();
      });
      this.inventoryTexts.push(text, zone);
    });

    if (this.data_.inventory.length === 0) {
      const text = this.add.text(20, 234, "（所持武器なし。宝箱か鍛治で入手してください）", {
        fontSize: "12px",
        color: "#62628a",
      });
      this.inventoryTexts.push(text);
    }
  }
}

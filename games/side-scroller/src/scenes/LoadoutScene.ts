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
import { RECOMMENDED_TAP_SIZE, buildOrientationWarning, isTouchDevice, makeTappable } from "../ui/touch";

const KIND_LABEL: Readonly<Record<WeaponKind, string>> = {
  melee: "近距離",
  mid: "中距離",
  ranged: "遠距離",
};

const RARITY_COLOR: Readonly<Record<string, string>> = {
  N: "#9a9ac0",
  R: "#4ecca3",
  SR: "#7fd1ff",
  SSR: "#c792ea",
  UR: "#ffcc66",
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

  constructor() {
    super("LoadoutScene");
  }

  create(): void {
    this.data_ = loadLoadout(window.localStorage);
    if (this.data_.currency === 0 && this.data_.inventory.length === 0) {
      // 初回プレイ時のみ、遊び始められるよう少額の通貨を配布
      this.data_ = { ...this.data_, currency: 500 };
    }

    this.add
      .text(400, 36, "⚔️ 剣戟の森 — ロードアウト設定", { fontSize: "22px", color: "#e8e8fb" })
      .setOrigin(0.5, 0);
    this.add
      .text(400, 66, "所持武器を選んでスロットに設定してください", {
        fontSize: "13px",
        color: "#9a9ac0",
      })
      .setOrigin(0.5, 0);

    this.currencyText = this.add.text(20, 20, "", { fontSize: "14px", color: "#ffcc66" });

    this.buildSlotPanel();
    this.buildInventoryPanel();
    this.buildAcquirePanel();
    this.buildArmorPanel();
    this.buildStartButton();
    this.hintText = this.add.text(400, 560, "", { fontSize: "13px", color: "#4ecca3" }).setOrigin(0.5, 0);

    if (isTouchDevice(this)) buildOrientationWarning(this);

    this.refresh();
  }

  private persist(): void {
    saveLoadout(this.data_, window.localStorage);
  }

  private buildSlotPanel(): void {
    const kinds: WeaponKind[] = ["melee", "mid", "ranged"];
    kinds.forEach((kind, i) => {
      const x = 140 + i * 180;
      const y = 130;
      this.add.rectangle(x, y, 160, 90, 0x15152a).setStrokeStyle(1, 0x2c2c50);
      this.add.text(x, y - 34, KIND_LABEL[kind], { fontSize: "13px", color: "#9a9ac0" }).setOrigin(0.5);
      const text = this.add
        .text(x, y, "(未設定)", { fontSize: "13px", color: "#e8e8fb", align: "center", wordWrap: { width: 150 } })
        .setOrigin(0.5);
      this.slotTexts[kind] = text;

      const zone = this.add.zone(x, y, 160, 90).setInteractive({ useHandCursor: true });
      zone.on("pointerdown", () => this.assignSelectedToSlot(kind));
    });
  }

  private buildInventoryPanel(): void {
    this.add.text(20, 180, "所持武器（クリックして選択）", { fontSize: "14px", color: "#e8e8fb" });
  }

  private buildAcquirePanel(): void {
    this.add.text(500, 180, "🎁 宝箱を開ける (100)", { fontSize: "14px", color: "#4ecca3" });
    // 単独ボタンなので推奨サイズいっぱいの当たり判定を取れる
    makeTappable(this, 610, 180 + 7, 220, RECOMMENDED_TAP_SIZE, () => {
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
    });

    let y = 210;
    for (const template of WEAPON_TEMPLATES) {
      const cost = BLACKSMITH_COST.N;
      this.add.text(500, y, `🔨 ${template.name} を鍛治(${cost})`, { fontSize: "12px", color: "#ff6b8a" });
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
    this.add.text(500, 355, "🛡️ 防具を選択（出撃ごとに購入）", { fontSize: "13px", color: "#e8e8fb" });
    let y = 378;
    for (const armor of ARMOR_TEMPLATES) {
      const label =
        armor.id === "none"
          ? "なし（耐久0）"
          : `${armor.name}（耐久${armor.maxDurability}） (${armor.cost})`;
      const text = this.add.text(500, y, label, { fontSize: "12px", color: "#7fd1ff" });
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
    const btn = this.add
      .text(400, 500, "▶ ステージ開始", { fontSize: "18px", color: "#0a0a12" })
      .setOrigin(0.5)
      .setPadding(16, 10)
      .setBackgroundColor("#4ecca3")
      .setInteractive({ useHandCursor: true });
    btn.on("pointerdown", () => {
      this.scene.start("GameScene", {
        loadout: this.data_.loadout,
        inventory: this.data_.inventory,
        baseEquipmentLevels: this.data_.baseEquipmentLevels,
        selectedArmorId: this.data_.selectedArmorId,
      });
    });
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

    for (const { id, label, text } of this.armorTexts) {
      const selected = id === this.data_.selectedArmorId;
      text.setColor(selected ? "#4ecca3" : "#7fd1ff").setText(selected ? `▶ ${label}` : label);
    }

    for (const kind of ["melee", "mid", "ranged"] as const) {
      const instanceId = this.data_.loadout[kind];
      const instance = this.data_.inventory.find((w) => w.id === instanceId);
      const text = this.slotTexts[kind];
      if (!text) continue;
      if (!instance) {
        text.setText("(未設定)").setColor("#62628a");
        continue;
      }
      const template = findTemplate(instance.templateId);
      text
        .setText(`${template?.name ?? "?"}\n[${instance.rarity}] +${instance.enhanceLevel}`)
        .setColor(RARITY_COLOR[instance.rarity] ?? "#e8e8fb");
    }

    this.inventoryTexts.forEach((t) => t.destroy());
    this.inventoryTexts = [];
    this.data_.inventory.forEach((instance, i) => {
      const template = findTemplate(instance.templateId);
      const stats = effectiveStats(instance);
      const selected = instance.id === this.selectedInstanceId;
      const label =
        `${selected ? "▶ " : "  "}${template?.name ?? "?"} [${instance.rarity}] ` +
        `距離${stats.range.toFixed(0)} 力${stats.power.toFixed(1)} 速${stats.swingSpeedMs.toFixed(0)}ms ` +
        `範囲${stats.hitWidth.toFixed(0)} 重${stats.weight.toFixed(1)} コンボ${stats.comboHits}`;
      const y = 205 + i * 20;
      const text = this.add.text(20, y, label, { fontSize: "12px", color: selected ? "#4ecca3" : "#c8c8e8" });
      const zone = makeTappable(this, 400, y + 6, 760, 18, () => {
        this.selectedInstanceId = instance.id;
        this.refresh();
      });
      this.inventoryTexts.push(text, zone);
    });

    if (this.data_.inventory.length === 0) {
      const text = this.add.text(20, 205, "（所持武器なし。宝箱か鍛治で入手してください）", {
        fontSize: "12px",
        color: "#62628a",
      });
      this.inventoryTexts.push(text);
    }
  }
}

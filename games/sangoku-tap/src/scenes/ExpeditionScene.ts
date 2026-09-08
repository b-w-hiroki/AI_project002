import Phaser from "phaser";
import { GENERAL_POOL } from "../logic/general";
import {
  addCurrency,
  addEquipment,
  loadCurrency,
  loadEquippedMap,
  loadOwnedGenerals,
  saveBestDistance,
} from "../logic/progress";
import {
  ROLES,
  ROLE_HINTS,
  buildTroop,
  validParty,
  newExpedition,
  chooseRoute,
  advanceExpedition,
  returnExpedition,
  expeditionReward,
  victoryChance,
  type Expedition,
} from "../logic/expedition";
import {
  ensureStarter,
  loadParty,
  saveParty,
  loadExpedition,
  saveExpedition,
} from "../logic/expeditionSave";
import { effectiveAtk } from "../logic/roster";
import { REGIONS, regionById, type RegionId } from "../logic/regions";
import {
  loadCampaign,
  saveCampaign,
  isUnlocked,
  trainedTroop,
  train,
  trainingCost,
  MAX_TRAINING,
  campaignReward,
  recordExpedition,
  type Campaign,
} from "../logic/campaign";
const ART: Record<string, string> = {
  gen_hakuen: "st-general-hakuen",
  gen_soujin: "st-general-soujin",
  gen_kohei: "st-general-kohei",
  gen_ashigaru: "st-general-ashigaru",
};
const INK = "#f9ecd3";
export class ExpeditionScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private party: string[] = [];
  private run: Expedition | null = null;
  private settled = false;
  private busy = false;
  private random: () => number = Math.random;
  private view: "camp" | "formation" | "road" | "result" = "camp";
  private campaign!: Campaign;
  private selectedRegion: RegionId = "plains";
  private earnedMerit = 0;
  private firstClear = false;
  private introRunId = "";
  constructor() {
    super("ExpeditionScene");
  }
  preload(): void {
    for (const key of [
      "st-bg-battlefield",
      "st-boss-gatekeeper",
      ...Object.values(ART),
    ])
      if (!this.textures.exists(key)) this.load.image(key, `images/${key}.png`);
  }
  create(): void {
    ensureStarter();
    this.party = validParty(loadParty(), loadOwnedGenerals());
    this.run = loadExpedition();
    this.campaign = loadCampaign();
    this.selectedRegion =
      this.run?.regionId ??
      REGIONS.find(
        (r) =>
          isUnlocked(this.campaign, r.id) &&
          !this.campaign.cleared.includes(r.id),
      )?.id ??
      "citadel";
    this.view = this.run ? "road" : "camp";
    this.settled = false;
    this.busy = false;
    this.render();
  }
  private text(
    x: number,
    y: number,
    value: string,
    size = 16,
    color = INK,
  ): Phaser.GameObjects.Text {
    const t = this.add
      .text(x, y, value, {
        fontFamily: "sans-serif",
        fontSize: `${size}px`,
        color,
        lineSpacing: 5,
        wordWrap: { width: 380, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);
    this.root.add(t);
    return t;
  }
  private panel(
    x: number,
    y: number,
    w: number,
    h: number,
    color = 0x231e21,
    alpha = 0.94,
  ): void {
    const g = this.add.graphics();
    g.fillStyle(color, alpha).fillRoundedRect(x - w / 2, y - h / 2, w, h, 16);
    g.lineStyle(1, 0xc5a46e, 0.45).strokeRoundedRect(
      x - w / 2,
      y - h / 2,
      w,
      h,
      16,
    );
    this.root.add(g);
  }
  private button(
    x: number,
    y: number,
    w: number,
    label: string,
    fn: () => void,
    active = true,
  ): void {
    this.panel(x, y, w, 48, active ? 0x963d32 : 0x30292a);
    this.text(x, y - 10, label, 16, active ? INK : "#827873");
    const hit = this.add
      .zone(x, y, w, 48)
      .setInteractive({ useHandCursor: active });
    this.root.add(hit);
    hit.on("pointerdown", () => {
      if (active && !this.busy) fn();
    });
  }
  private portrait(id: string, x: number, y: number, h: number): void {
    this.root.add(
      this.add.ellipse(x, y + h / 2 - 3, h * 0.65, 13, 0x100d16, 0.4),
    );
    if (ART[id] && this.textures.exists(ART[id]!)) {
      const actor = this.add.image(x, y, ART[id]!).setDisplaySize(h * 0.75, h);
      this.root.add(actor);
      if (this.view === "road")
        this.tweens.add({
          targets: actor,
          y: y - 4,
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
    } else {
      // Stylized militia: code-native silhouettes, not borrowed art from another general.
      const role = ROLES[id];
      const color =
        role === "守将" ? 0x467a83 : role === "商才" ? 0xbb8d4d : 0x786ba1;
      const g = this.add.graphics({ x, y });
      g.setScale(h / 150);
      g.fillStyle(0x252532)
        .fillRoundedRect(-25, 46, 19, 25, 6)
        .fillRoundedRect(7, 46, 19, 25, 6);
      g.lineStyle(2, 0x252532, 1);
      g.fillStyle(color).fillRoundedRect(-30, -8, 60, 66, 13);
      g.strokeRoundedRect(-30, -8, 60, 66, 13);
      g.fillStyle(0x293543).fillRoundedRect(-22, 10, 44, 35, 7);
      for (let row = 0; row < 3; row++) {
        g.lineStyle(2, 0xa2b0a7, 0.8).lineBetween(
          -17,
          17 + row * 9,
          17,
          17 + row * 9,
        );
      }
      g.fillStyle(color).fillCircle(-32, 4, 13).fillCircle(32, 4, 13);
      g.fillStyle(0xf1d2af).fillRoundedRect(-21, -52, 42, 45, 15);
      g.lineStyle(2, 0x352c29).strokeRoundedRect(-21, -52, 42, 45, 15);
      g.fillStyle(0x273947)
        .fillRoundedRect(-25, -65, 50, 22, 10)
        .fillRect(-29, -46, 58, 7);
      g.fillStyle(0xd4b774)
        .fillTriangle(-8, -64, 8, -64, 0, -78)
        .fillCircle(0, -48, 5);
      g.fillStyle(0x302a30).fillCircle(-8, -27, 2.5).fillCircle(8, -27, 2.5);
      g.lineStyle(2, 0x926b56).lineBetween(-4, -16, 4, -16);
      g.fillStyle(0xbb945a).fillRect(-28, 42, 56, 7);
      g.fillStyle(0xf5da91).fillRoundedRect(-6, 39, 12, 13, 2);
      if (role === "守将") {
        g.fillStyle(0x405261).fillRoundedRect(22, 13, 29, 44, 7);
        g.lineStyle(3, 0xd5b277).strokeRoundedRect(22, 13, 29, 44, 7);
        g.lineBetween(36, 20, 36, 49);
      } else {
        g.fillStyle(0x765132).fillRoundedRect(23, 24, 27, 28, 8);
        g.lineStyle(3, 0xe1bd78).lineBetween(26, 30, 44, 30);
        g.lineStyle(3, 0x655044).lineBetween(-38, 52, -38, -28);
        g.fillStyle(0xc7d2cf).fillTriangle(-44, -27, -32, -27, -38, -46);
      }
      this.root.add(g);
      if (this.view === "road" && this.run!.step > 0)
        this.tweens.add({ targets: g, y: y - 5, duration: 160, yoyo: true });
    }
  }
  private render(): void {
    // Rebuilding a screen must not leave infinite breathing tweens behind.
    this.tweens.killAll();
    this.root?.destroy(true);
    this.root = this.add.container(0, 0);
    this.cameras.main.setBackgroundColor(0x191821);
    if (this.textures.exists("st-bg-battlefield")) {
      const x = 225 - (this.run?.step ?? 0) * 12;
      const bg = this.add
        .image(x, 330, "st-bg-battlefield")
        .setDisplaySize(1050, 700)
        .setTint(regionById(this.run?.regionId ?? this.selectedRegion).tint)
        .setAlpha(this.view === "formation" ? 0.25 : 0.8);
      this.root.add(bg);
      if (this.view === "road" && (this.run?.step ?? 0) > 0) {
        bg.x = x + 12;
        this.tweens.add({ targets: bg, x, duration: 200 });
      }
    }
    if (this.view === "road") {
      this.renderRoad();
      return;
    }
    this.panel(225, 46, 414, 64, 0x18252a);
    this.text(
      225,
      23,
      this.view === "camp"
        ? "三国遠征録"
        : this.view === "formation"
          ? "遠征の支度"
          : this.view === "result"
            ? "遠征の記録"
            : "街道をゆく",
      25,
    );
    if (this.view === "camp") this.renderCampaign();
    else if (this.view === "formation") this.renderCamp();
    else this.renderResult();
  }
  private troop() {
    return trainedTroop(
      buildTroop(this.party, loadOwnedGenerals(), loadEquippedMap()),
      this.campaign,
    );
  }
  private renderCampaign(): void {
    const region = regionById(this.selectedRegion);
    const troop = this.troop();
    this.panel(225, 100, 414, 31, 0x18252a, 0.94);
    this.text(
      225,
      89,
      `攻略 ${this.campaign.cleared.length}/3  ·  功績 ${this.campaign.merit}  ·  ${loadCurrency()} 銭`,
      15,
      "#f3d29a",
    );
    // Code-native strategic map: topography, river and three linked destinations.
    this.panel(225, 236, 414, 236, 0x192e33, 0.97);
    const map = this.add.graphics();
    this.root.add(map);
    for (let i = 0; i < 7; i++) {
      const x = 40 + i * 54,
        y = 159 + (i % 3) * 48;
      map
        .lineStyle(1, 0x759b91, 0.24)
        .strokeTriangle(x, y + 30, x + 25, y - 13, x + 53, y + 30);
    }
    map
      .lineStyle(13, 0x558b9b, 0.23)
      .beginPath()
      .moveTo(130, 126)
      .lineTo(184, 194)
      .lineTo(152, 252)
      .lineTo(215, 350)
      .strokePath();
    const points = [
      { x: 83, y: 285 },
      { x: 224, y: 230 },
      { x: 363, y: 177 },
    ];
    map
      .lineStyle(3, 0xdfbd82, 0.5)
      .beginPath()
      .moveTo(83, 285)
      .lineTo(224, 230)
      .lineTo(363, 177)
      .strokePath();
    REGIONS.forEach((r, i) => {
      const p = points[i]!,
        unlocked = isUnlocked(this.campaign, r.id),
        selected = r.id === region.id;
      map
        .fillStyle(unlocked ? r.accent : 0x56636a, 0.15)
        .fillCircle(p.x, p.y, 30);
      map
        .lineStyle(selected ? 3 : 1, unlocked ? r.accent : 0x718087, 0.9)
        .strokeCircle(p.x, p.y, 25);
      map
        .fillStyle(unlocked ? r.accent : 0x718087)
        .fillRect(p.x - 11, p.y - 6, 22, 18)
        .fillRect(p.x - 15, p.y - 11, 8, 9)
        .fillRect(p.x - 4, p.y - 11, 8, 9)
        .fillRect(p.x + 7, p.y - 11, 8, 9);
      this.text(p.x, p.y + 32, r.name, 13, unlocked ? INK : "#99a6a9");
      this.text(
        p.x,
        p.y - 49,
        this.campaign.cleared.includes(r.id)
          ? "踏破"
          : unlocked
            ? `第${i + 1}章`
            : "未開放",
        12,
        unlocked ? "#f0d29b" : "#99a6a9",
      );
      const zone = this.add
        .zone(p.x, p.y, 108, 110)
        .setInteractive({ useHandCursor: unlocked });
      this.root.add(zone);
      zone.on("pointerdown", () => {
        if (unlocked) {
          this.selectedRegion = r.id;
          this.render();
        }
      });
    });
    this.panel(225, 390, 414, 61, 0x18252a, 0.94);
    this.text(225, 365, `${region.subtitle}  /  ${region.boss}`, 19);
    this.text(
      225,
      395,
      `収穫 ×${region.reward.toFixed(1)}  ·  初踏破 功績+5  ·  Rare装備`,
      14,
      "#f0d29b",
    );
    this.panel(225, 503, 414, 154, 0x18252a);
    this.party.forEach((id, i) => {
      const x = 91 + i * 132;
      this.portrait(id, x, 478, 72);
      this.text(x, 521, GENERAL_POOL.find((g) => g.id === id)!.name, 14);
      this.text(x, 544, ROLES[id]!, 12, "#dfbd7d");
    });
    if (!this.party.length)
      this.text(225, 484, "編成を開いて、仲間を選ぼう", 17);
    this.button(
      113,
      608,
      196,
      `編成 ${this.party.length}/3 · 戦力${troop.power}`,
      () => {
        this.view = "formation";
        this.render();
      },
    );
    const max = this.campaign.training >= MAX_TRAINING,
      cost = trainingCost(this.campaign.training);
    this.button(
      337,
      608,
      196,
      max
        ? "鍛錬 Lv.5 達成"
        : `鍛錬 Lv.${this.campaign.training} → ${this.campaign.training + 1}`,
      () => {
        this.campaign = train(this.campaign);
        saveCampaign(this.campaign);
        this.render();
      },
      !max && this.campaign.merit >= cost,
    );
    this.text(
      225,
      643,
      max
        ? "部隊戦力 +40% · 全地域で有効"
        : `鍛錬：功績${cost}消費で戦力+8%  ／  3地点ごとに功績+1`,
      12,
      "#e0caaa",
    );
    this.button(
      225,
      692,
      404,
      `${region.name}へ出陣`,
      () => {
        if (
          !isUnlocked(this.campaign, this.selectedRegion) ||
          !troop.ids.length
        )
          return;
        this.run = newExpedition(troop, this.selectedRegion);
        saveExpedition(this.run);
        this.settled = false;
        this.view = "road";
        this.render();
      },
      troop.ids.length > 0,
    );
    this.button(225, 752, 404, "拠点へ · 武将募集と装備", () =>
      this.scene.start("GameScene"),
    );
  }
  private renderCamp(): void {
    this.text(225, 90, "3人の役割で、旅の戦い方が変わる", 15, "#e0c38d");
    const owned = loadOwnedGenerals(),
      eq = loadEquippedMap();
    GENERAL_POOL.forEach((g, i) => {
      const x = 122 + (i % 2) * 206,
        y = 174 + Math.floor(i / 2) * 112;
      const selected = this.party.includes(g.id),
        has = (owned[g.id] ?? 0) > 0;
      this.panel(
        x,
        y,
        190,
        102,
        selected ? 0x52372e : 0x231e21,
        has ? 0.96 : 0.7,
      );
      this.portrait(g.id, x - 61, y - 2, 65);
      this.text(
        x + 22,
        y - 37,
        `${selected ? "● " : ""}${g.name}  ${g.rarity}`,
        14,
        has ? INK : "#a29387",
      );
      this.text(
        x + 22,
        y - 13,
        `${ROLES[g.id]} · ${has ? effectiveAtk(g, eq) : "未所持"}`,
        13,
        "#dfbd7d",
      );
      this.text(x + 22, y + 12, ROLE_HINTS[ROLES[g.id]!], 11);
      const hit = this.add
        .zone(x, y, 190, 102)
        .setInteractive({ useHandCursor: has });
      this.root.add(hit);
      hit.on("pointerdown", () => {
        if (!has) return;
        if (selected) this.party = this.party.filter((id) => id !== g.id);
        else if (this.party.length < 3) this.party.push(g.id);
        saveParty(this.party);
        this.render();
      });
    });
    const troop = this.troop();
    this.text(
      225,
      578,
      `編成 ${this.party.length}/3  ／ 戦力 ${troop.power}  ／ 所持 ${loadCurrency()} 銭`,
      15,
    );
    this.text(
      225,
      610,
      "帰還で収穫を全額確保。敗走では今回の収穫が半分に。\n獲得済みの武将・装備・コインは失いません。",
      12,
    ).setAlign("center");
    this.button(
      225,
      686,
      380,
      "この編成で戦略地図へ",
      () => {
        this.view = "camp";
        this.render();
      },
      this.party.length > 0,
    );
    this.button(225, 746, 380, "拠点へ戻る・装備を整える", () =>
      this.scene.start("GameScene"),
    );
  }
  private renderRoad(): void {
    const r = this.run!,
      region = regionById(r.regionId),
      boss = r.step === 9;
    // A compact route header leaves most of the canvas to the encounter stage.
    const shade = this.add.graphics();
    this.root.add(shade);
    shade.fillStyle(0x0e1721, boss ? 0.35 : 0.12).fillRect(0, 0, 450, 544);
    shade.fillStyle(0x102027, 0.96).fillRect(0, 0, 450, 75);
    this.text(24, 18, region.name, 18).setOrigin(0, 0);
    this.text(422, 21, `${r.step} / 10`, 16, "#eac68d").setOrigin(1, 0);
    shade.lineStyle(2, 0x526364).lineBetween(26, 60, 424, 60);
    for (let i = 0; i <= 10; i++)
      shade
        .fillStyle(i <= r.step ? region.accent : 0x526364)
        .fillCircle(26 + i * 39.8, 60, i === r.step ? 5 : 2.5);
    if (boss) {
      this.text(30, 99, "FINAL ENCOUNTER", 11, "#e5b586")
        .setOrigin(0, 0)
        .setLetterSpacing(2);
      this.text(30, 130, "関門\n守将", 31, "#fff0d0")
        .setOrigin(0, 0)
        .setLineSpacing(6);
      this.text(30, 224, region.boss, 12, "#e6bd92").setOrigin(0, 0);
    } else {
      this.text(
        225,
        105,
        r.route === "mountain"
          ? "山道を越える · 収穫1.7倍"
          : "夕暮れの街道を進む",
        15,
        "#fff1d6",
      ).setStroke("#263038", 3);
    }
    this.renderEnemy(boss);
    // Diagonal staging: the leader stands in front; companions recede behind.
    const positions = boss
      ? [
          { x: 89, y: 437, h: 184 },
          { x: 35, y: 468, h: 106 },
          { x: 154, y: 474, h: 98 },
        ]
      : [
          { x: 95, y: 422, h: 148 },
          { x: 184, y: 436, h: 108 },
          { x: 250, y: 407, h: 96 },
        ];
    r.troop.ids.forEach((id, i) => {
      const p = positions[i]!;
      const before = this.root.length;
      this.portrait(id, p.x, p.y, p.h);
      if (i === 0)
        for (const child of this.root.list.slice(before))
          child.setName("lead-actor");
    });
    // One quiet roster ribbon replaces scattered labels under each actor.
    const footer = this.add.graphics();
    this.root.add(footer);
    footer.fillStyle(0x102027, 0.98).fillRect(0, 542, 450, 258);
    this.text(
      24,
      551,
      r.troop.ids
        .map(
          (id) =>
            `${GENERAL_POOL.find((g) => g.id === id)!.name}・${ROLES[id]}`,
        )
        .join("  /  "),
      11,
      "#aabdb9",
    ).setOrigin(0, 0);
    this.text(
      24,
      577,
      `兵力 ${r.hp}`,
      24,
      r.hp < 35 ? "#ef9d89" : "#eef0da",
    ).setOrigin(0, 0);
    this.text(424, 581, `持帰り予定 ${r.loot} 銭`, 17, "#f0ce8b").setOrigin(
      1,
      0,
    );
    const bar = this.add.graphics();
    this.root.add(bar);
    bar.fillStyle(0x354948).fillRoundedRect(24, 613, 402, 5, 2);
    bar
      .fillStyle(r.hp < 35 ? 0xd57b67 : 0x8cc0aa)
      .fillRoundedRect(24, 613, (402 * r.hp) / 100, 5, 2);
    if (r.fork) {
      this.text(
        225,
        629,
        `分岐 · 次戦勝率 街道 ${Math.round(victoryChance({ ...r, route: "road" }) * 100)}% / 山道 ${Math.round(victoryChance({ ...r, route: "mountain" }) * 100)}%`,
        13,
        "#e3d2b4",
      );
      this.button(124, 676, 192, "街道へ", () => this.route("road"));
      this.button(326, 676, 192, "山道へ · 収穫1.7倍", () =>
        this.route("mountain"),
      );
    } else {
      this.text(
        225,
        629,
        `${boss ? "関門戦" : "次の戦闘"}の勝率 ${Math.round(victoryChance(r) * 100)}%`,
        13,
        "#e3d2b4",
      );
      this.button(225, 676, 402, boss ? "守将に挑む" : "進軍する", () =>
        this.advance(),
      );
    }
    const back = this.text(
      225,
      718,
      `帰還して ${r.loot} 銭を確保`,
      14,
      "#c2cbc4",
    );
    const hit = this.add
      .zone(225, 735, 402, 46)
      .setInteractive({ useHandCursor: true });
    this.root.add(hit);
    hit.on("pointerdown", () => {
      if (this.busy) return;
      this.run = returnExpedition(r);
      this.settle();
    });
    back.setName("retreat-label");
    this.text(
      225,
      766,
      `敗走時 ${Math.floor(r.loot / 2)} 銭 · 自動保存`,
      11,
      "#9eaaa5",
    );
    if (boss && this.introRunId !== r.id) this.bossEntrance();
  }
  private bossEntrance(): void {
    this.introRunId = this.run!.id;
    this.busy = true;
    const curtain = this.add
      .rectangle(225, 310, 450, 466, 0x0d121c, 0.92)
      .setName("boss-intro");
    this.root.add(curtain);
    const title = this.text(225, 255, "関 門 守 将", 34, "#f8d7a2");
    const subtitle = this.text(
      225,
      309,
      regionById(this.run!.regionId).boss,
      16,
      "#d5c1a3",
    );
    const enemy = this.root.getByName(
      "gatekeeper-boss",
    ) as Phaser.GameObjects.Image | null;
    if (enemy) {
      this.tweens.killTweensOf(enemy);
      enemy.setScale(enemy.scaleX * 1.08, enemy.scaleY * 1.08);
      this.tweens.add({
        targets: enemy,
        displayWidth: 281.25,
        displayHeight: 375,
        duration: 950,
        ease: "Sine.easeOut",
      });
    }
    this.tweens.add({
      targets: [curtain, title, subtitle],
      alpha: 0,
      delay: 420,
      duration: 550,
      onComplete: () => {
        curtain.destroy();
        title.destroy();
        subtitle.destroy();
        this.busy = false;
      },
    });
  }
  private advance(): void {
    if (this.busy || !this.run || this.run.status !== "active") return;
    this.busy = true;
    const previous = this.run,
      boss = previous.step === 9;
    this.run = advanceExpedition(previous, this.random);
    saveBestDistance(this.run.step);
    saveExpedition(this.run);
    if (boss) {
      // Credit once before the cinematic: a reload during the animation cannot lose rewards.
      this.settle(false);
      const actors = this.root.getAll("name", "lead-actor");
      this.tweens.add({
        targets: actors,
        x: "+=44",
        duration: 150,
        yoyo: true,
        hold: 160,
        ease: "Quad.easeOut",
      });
      const slash = this.add.graphics();
      this.root.add(slash);
      slash.lineStyle(9, 0xffe8b6, 0.9).lineBetween(188, 399, 381, 224);
      slash.lineStyle(3, 0xffffff).lineBetween(175, 412, 394, 211);
      slash.setAlpha(0);
      this.tweens.add({
        targets: slash,
        alpha: 1,
        delay: 150,
        duration: 80,
        yoyo: true,
        hold: 90,
      });
      this.cameras.main.shake(230, 0.004);
      const enemy = this.root.getByName("gatekeeper-boss");
      if (enemy && this.run.status === "clear")
        this.tweens.add({
          targets: enemy,
          alpha: 0.18,
          x: "+=20",
          delay: 300,
          duration: 380,
        });
      const verdict = this.text(
        225,
        462,
        this.run.status === "clear" ? "関 門 突 破" : "一 度 、 退 こ う",
        28,
        "#fff1c9",
      ).setStroke("#241920", 5);
      verdict.setAlpha(0);
      this.tweens.add({
        targets: verdict,
        alpha: 1,
        delay: 370,
        duration: 160,
      });
      this.time.delayedCall(1050, () => {
        this.busy = false;
        this.render();
      });
    } else {
      if (this.run.status !== "active") this.settle();
      else this.render();
      if (this.run.status === "active" && this.run.step === 9) return; // Entrance owns the input lock until it ends.
      const burst = this.text(225, 485, this.run.message, 13, "#fff0d0")
        .setStroke("#273038", 3)
        .setAlign("center");
      this.tweens.add({ targets: burst, y: 467, alpha: 0, duration: 650 });
      this.time.delayedCall(250, () => {
        this.busy = false;
      });
    }
  }
  private renderEnemy(boss: boolean): void {
    if (boss) {
      // Boss art dominates the encounter; ally portraits remain in the foreground.
      this.root.add(this.add.ellipse(298, 509, 226, 21, 0x100a13, 0.65));
      if (this.textures.exists("st-boss-gatekeeper")) {
        const enemy = this.add
          .image(298, 320, "st-boss-gatekeeper")
          .setDisplaySize(281.25, 375)
          .setName("gatekeeper-boss");
        this.root.add(enemy);
        this.tweens.add({
          targets: enemy,
          y: 317,
          duration: 1100,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      } else {
        // Missing optional artwork still leaves a recognizable armored silhouette.
        const g = this.add.graphics();
        this.root.add(g);
        g.fillStyle(0x47242c).fillRoundedRect(257, 283, 98, 130, 18);
        g.fillStyle(0x262c36)
          .fillRoundedRect(278, 225, 56, 67, 10)
          .fillRect(263, 402, 32, 48)
          .fillRect(317, 402, 32, 48);
        g.lineStyle(5, 0xc39a64).lineBetween(246, 238, 246, 439);
        g.fillStyle(0xc39a64).fillTriangle(218, 257, 257, 215, 265, 274);
      }
    } else {
      // Common opponents deliberately share the simple infantry silhouette.
      for (let i = 0; i < 2; i++) {
        const x = 332 + i * 44,
          y = 327 + i * 18;
        this.root.add(this.add.ellipse(x, y + 43, 42, 10, 0x160f17, 0.35));
        if (this.textures.exists("st-general-ashigaru")) {
          this.root.add(
            this.add
              .image(x, y, "st-general-ashigaru")
              .setDisplaySize(62, 84)
              .setFlipX(true)
              .setTint(0xc58f91)
              .setName("common-enemy"),
          );
        } else {
          const g = this.add.graphics();
          this.root.add(g);
          g.fillStyle(0x74434a)
            .fillRoundedRect(x - 14, y - 8, 28, 40, 7)
            .fillCircle(x, y - 21, 12);
          g.fillStyle(0x28313a)
            .fillRect(x - 12, y + 28, 9, 16)
            .fillRect(x + 3, y + 28, 9, 16);
        }
      }
      this.panel(353, 254, 104, 32, 0x4b252c, 0.92);
      this.text(353, 244, "敵兵", 14, "#ffd7bd");
    }
  }
  private route(route: "road" | "mountain"): void {
    this.run = chooseRoute(this.run!, route);
    saveExpedition(this.run);
    this.render();
  }
  private settle(present = true): void {
    if (this.settled) return;
    this.settled = true;
    const r = this.run!;
    this.firstClear =
      r.status === "clear" && !this.campaign.cleared.includes(r.regionId);
    this.earnedMerit = campaignReward(this.campaign, r);
    this.campaign = recordExpedition(this.campaign, r);
    saveCampaign(this.campaign);
    saveExpedition(null);
    addCurrency(expeditionReward(r));
    if (r.status === "clear") addEquipment("Rare");
    else if (r.status !== "defeat" && r.step >= 3) addEquipment("Common");
    this.view = "result";
    if (present) this.render();
  }
  private renderResult(): void {
    const r = this.run!;
    this.panel(225, 375, 404, 550);
    this.text(
      225,
      129,
      r.status === "clear"
        ? this.campaign.cleared.length === 3
          ? "三地域、完全踏破！"
          : "関門を突破！"
        : r.status === "defeat"
          ? "仲間と立て直そう"
          : "収穫を持ち帰った",
      25,
    );
    r.troop.ids.forEach((id, i) => this.portrait(id, 110 + i * 115, 287, 140));
    this.text(225, 385, `到達 ${r.step}/10  ／ 兵力 ${r.hp}`, 18);
    this.text(225, 428, `持ち帰り  ${expeditionReward(r)} 銭`, 29, "#f4cb7f");
    this.text(
      225,
      481,
      r.status === "clear"
        ? "Rare装備を1個入手"
        : r.status !== "defeat" && r.step >= 3
          ? "Common装備を1個入手"
          : r.status === "defeat"
            ? "今回の未確保コインの半分を回収"
            : "武将・装備はそのまま",
      16,
    );
    this.text(
      225,
      525,
      `功績 +${this.earnedMerit}  ／  所持 ${this.campaign.merit}`,
      21,
      "#9cdbc3",
    );
    const next = REGIONS.find(
      (region) =>
        isUnlocked(this.campaign, region.id) &&
        !this.campaign.cleared.includes(region.id),
    );
    this.text(
      225,
      560,
      this.firstClear && next
        ? `${next.name}が開放！`
        : this.campaign.merit >= trainingCost(this.campaign.training) &&
            this.campaign.training < MAX_TRAINING
          ? "鍛錬で部隊を強くできる！"
          : "3地点ごとに功績。帰還して少しずつ強く。",
      14,
    );
    this.button(225, 607, 348, "戦略地図へ · 次の攻略へ", () => {
      this.view = "camp";
      this.run = null;
      if (next) this.selectedRegion = next.id;
      this.render();
    });
    this.button(225, 696, 380, "拠点へ・ガチャと装備", () =>
      this.scene.start("GameScene"),
    );
  }
}

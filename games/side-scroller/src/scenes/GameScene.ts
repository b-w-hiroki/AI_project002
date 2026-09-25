import { styleMultiplier, bossPhase, type CombatStyle } from "../logic/style";
import Phaser from "phaser";
import {
  BuffKind,
  currentWeapon,
  ENEMY_TOUCH_DAMAGE,
  EnemyState,
  Facing,
  GameStatus,
  HIOUGI_DAMAGE_MULTIPLIER,
  HIOUGI_RANGE,
  ITEM_BUFF_DURATION_MS,
  OUGI_DAMAGE_MULTIPLIER,
  OUGI_GAUGE_MAX,
  OUGI_GAUGE_PER_HIT,
  OUGI_RANGE,
  PlayerState,
  SCORE_PER_KILL,
  SKILL_COOLDOWN_MS,
  SKILL_DAMAGE_MULTIPLIER,
  SKILL_RANGE,
  STAGE_BUFF_DURATION_MS,
  WEAPONS,
  WeaponDef,
  WeaponKind,
  addScore,
  applyBuff,
  applyRegen,
  buffDamageMultiplier,
  buffSpeedMultiplier,
  canUseHiougi,
  canUseOugi,
  canUseSkill,
  checkHiougiUnlock,
  damageEnemy,
  damagePlayer,
  gainArmor,
  gainComboStreak,
  gainOugiGauge,
  gameStatus,
  healPlayer,
  inAttackRange,
  isAttacking,
  isBuffActive,
  isHiougiActive,
  isInvulnerable,
  isOugiActive,
  newEnemy,
  newPlayer,
  setCustomWeapon,
  startAttack,
  superComboMultiplier,
  switchWeapon,
  tickRegen,
  useHiougi,
  useOugi,
  useSkill,
} from "../logic/combat";
import {
  CommandEvent,
  CommandToken,
  HIOUGI_COMMAND,
  matchesSequence,
  OUGI_COMMAND,
  pushCommandEvent,
} from "../logic/commandInput";
import {
  ITEM_DEFS,
  KVStore,
  Loadout,
  LoadoutSaveData,
  RunWeaponState,
  StageBuffOption,
  WeaponInstance,
  baseEquipmentStats,
  findArmorTemplate,
  findItemDef,
  findTemplate,
  loadLoadout,
  newLoadout,
  resolveSummon,
  rollStageBuffOptions,
  toWeaponDef,
  useItem,
  type ItemInventory,
} from "../logic/loadout";
import {
  bindHeldKey,
  bindVirtualJoystick,
  buildOrientationWarning,
  fakeKeyEvent,
  isTouchDevice,
  makeTappable,
} from "../ui/touch";
import { cg } from "../platform/crazygames";
import { bgm, sfx } from "../platform/audio";
import { THEME, TYPE, drawPanel, popOnChange } from "../ui/theme";
import { loadBestWave, saveBestWave } from "../logic/progress";
import { detectLang, itemName, stageBuffText, tr, weaponLabel, type Lang } from "../logic/i18n";
import { EnemySpawnSpec, EnemyType, WaveKind, pickupsForWave, rollWaveComposition } from "../logic/waves";

const GROUND_Y = 520;
/** ウェーブ式サバイバル用の固定サイズアリーナ幅。固定ゴールへ向かうステージ制から変更した */
const ARENA_WIDTH = 1600;
const WAVE_INTERMISSION_MS = 2200;
const MOVE_SPEED = 220;
/**
 * ジャンプ初速。-520 では足元の到達高さが 108px で、最も低い足場（y=420、上面 410）に 1.7px 届かなかったため
 * キャラ拡大に合わせて -540（到達高さ 117px）に微調整した。重力は 1200 のまま。
 */
const JUMP_VELOCITY = -540;
/** 攻撃判定の縦方向の許容差。異なる高さの足場にいる敵を誤って巻き込まないための上限 */
const ATTACK_RANGE_Y = 66;
const PROJECTILE_SPEED = 640;

/** アイテムID → 使用キーの割当（1/2/3は武器切替に使っているため別キーにする） */
const ITEM_KEY_BINDINGS: { itemId: string; code: number; label: string }[] = [
  { itemId: "potion", code: Phaser.Input.Keyboard.KeyCodes.Z, label: "Z" },
  { itemId: "power_charm", code: Phaser.Input.Keyboard.KeyCodes.V, label: "V" },
  { itemId: "haste_charm", code: Phaser.Input.Keyboard.KeyCodes.B, label: "B" },
];

interface EnemySprite {
  state: EnemyState;
  sprite: Phaser.Physics.Arcade.Sprite;
  patrolMinX: number;
  patrolMaxX: number;
  dir: 1 | -1;
  type: EnemyType;
  speedMul: number;
  boss: boolean;
  bornAt: number;
  bossDir: 1 | -1;
  lastBossPhase: string;
}

/**
 * 外部生成イラスト（docs/art-assets.md 参照）のテクスチャキー。
 * 読み込めなかった場合は従来どおり Graphics で描いたプレースホルダーにフォールバックする。
 */
const ART_BG_KEY = "sf-bg-forest";
const ART_HERO_KEY = "sf-hero-swordsman";
const ART_HERO_ATTACK_KEY = "sf-hero-swordsman-attack";
const ART_HERO_HURT_KEY = "sf-hero-swordsman-hurt";
const ART_ENEMY_NORMAL_KEY = "sf-enemy-normal";
const ART_ENEMY_AGILE_KEY = "sf-enemy-agile";
const ART_ENEMY_TANK_KEY = "sf-enemy-tank";
const ART_BOSS_KEY = "sf-boss-forest-guardian";
const GENERATED_BOSS_KEY = "sf-generated-boss-guardian";
const GENERATED_SLASH_KEY = "sf-generated-slash";
/** 元画像をゲーム内サイズへ縮小した派生テクスチャのキー（scale=1 のまま既存のスケール演出を使い回すため） */
const HERO_ART_TEXTURE = "hero-art";
const HERO_ATTACK_ART_TEXTURE = "hero-attack-art";
const HERO_HURT_ART_TEXTURE = "hero-hurt-art";
const ENEMY_NORMAL_ART_TEXTURE = "goblin-art";
const ENEMY_AGILE_ART_TEXTURE = "goblin-agile-art";
const ENEMY_TANK_ART_TEXTURE = "goblin-tank-art";
const BOSS_ART_TEXTURE = "forest-guardian-art";
/** HUD の描画深度（キャラ/攻撃演出より前面、オーバーレイ 100+ より背面） */
const HUD_DEPTH = 20;
/** コンセプト装飾(1770台)より手前、モバイル操作UI(2600+)より奥に戦闘FXをまとめる。 */
const COMBAT_FX_DEPTH = 1900;
const COMBAT_FLASH_DEPTH = 1950;
const COMBAT_SLASH_TEXTURE = "combat-slash-fx";
const COMBAT_HIT_TEXTURE = "combat-hit-fx";
/** 背景のパララックス係数（カメラより遅く流れる） */
const BG_SCROLL_FACTOR = 0.4;

/**
 * キャラクターの表示倍率。当初の 36×54(主人公)/40×40(ゴブリン) では緻密な背景に対して小さく見えたため
 * 1.5 倍（54×81 / 60×60）に拡大した。テクスチャ・当たり判定・演出のオフセットはすべてこの倍率で揃えている。
 * ジャンプ初速と最下段の足場も合わせて調整し、重力は1200を維持する。
 */
const CHAR_SCALE = 1.72;
/** フォールバック（Graphics描画）の人型テクスチャの元サイズ。CHAR_SCALE 倍して生成する */
const HUMANOID_BASE = { w: 30, h: 42 };
const HERO_ART_SIZE = { w: 36 * CHAR_SCALE, h: 54 * CHAR_SCALE }; // 54×81
const ENEMY_ART_SIZE = { w: 40 * CHAR_SCALE, h: 40 * CHAR_SCALE }; // 60×60

/**
 * プレイヤーの当たり判定（拡大前 18×32 / しゃがみ 20 を CHAR_SCALE 倍）。
 * オフセットはテクスチャごとに「体を横中央、足元をテクスチャ下端の 2px 上」に置くよう算出する。
 */
const PLAYER_BODY = { w: 27, h: 48, crouchH: 30 };
const ENEMY_BODY = { w: 27, h: 45 };
const FEET_MARGIN = 2;
/** しゃがみ時のスプライト縦スケール */
const CROUCH_SCALE_Y = 0.68;
function bodyOffsetFor(tex: { w: number; h: number }, body: { w: number; h: number }): { x: number; y: number } {
  return { x: (tex.w - body.w) / 2, y: tex.h - FEET_MARGIN - body.h };
}
const HUMANOID_TEX = { w: HUMANOID_BASE.w * CHAR_SCALE, h: HUMANOID_BASE.h * CHAR_SCALE }; // 45×63
const PLAYER_BODY_OFFSET = { fallback: bodyOffsetFor(HUMANOID_TEX, PLAYER_BODY), art: bodyOffsetFor(HERO_ART_SIZE, PLAYER_BODY) };
const ENEMY_BODY_OFFSET = { fallback: bodyOffsetFor(HUMANOID_TEX, ENEMY_BODY), art: bodyOffsetFor(ENEMY_ART_SIZE, ENEMY_BODY) };

/** 専用アートが読めない場合だけ使うタイプ別フォールバックティント */
const ENEMY_TYPE_TINT: Readonly<Record<EnemyType, number>> = {
  normal: 0xffffff,
  agile: 0x7fd1ff,
  tank: 0x8a4fd1,
};
const ENEMY_ART_TEXTURE: Readonly<Partial<Record<EnemyType, string>>> = {
  normal: ENEMY_NORMAL_ART_TEXTURE,
  agile: ENEMY_AGILE_ART_TEXTURE,
  tank: ENEMY_TANK_ART_TEXTURE,
};

interface Projectile {
  sprite: Phaser.Physics.Arcade.Sprite;
  spawnX: number;
  maxRange: number;
}

type PickupKind = "summonMedium" | "armor" | "item" | "stageBuff";

interface Pickup {
  kind: PickupKind;
  sprite: Phaser.Physics.Arcade.Sprite;
  collected: boolean;
  itemId?: string; // kind === "item" の場合のみ使用
}

const WEAPON_KEY_BINDINGS: { code: number; kind: WeaponKind }[] = [
  { code: Phaser.Input.Keyboard.KeyCodes.ONE, kind: "melee" },
  { code: Phaser.Input.Keyboard.KeyCodes.TWO, kind: "mid" },
  { code: Phaser.Input.Keyboard.KeyCodes.THREE, kind: "ranged" },
];

/** 剣戟の森 — 横スクロールアクションのメインシーン */
export class GameScene extends Phaser.Scene {
  readonly lang: Lang = detectLang();
  private combatStyle: CombatStyle = "chain";
  private styleChoosing = false;
  private lastStyleHit = -Infinity;
  private styleText!: Phaser.GameObjects.Text;
  private bossTell!: Phaser.GameObjects.Graphics;
  private playerState: PlayerState = newPlayer();
  private status: GameStatus = "playing";

  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private attackKey!: Phaser.Input.Keyboard.Key;
  private skillKey!: Phaser.Input.Keyboard.Key;
  private tipsKey!: Phaser.Input.Keyboard.Key;
  private restartKey!: Phaser.Input.Keyboard.Key;
  private weaponKeys: { key: Phaser.Input.Keyboard.Key; kind: WeaponKind }[] = [];
  private wave = 1;
  private waveEnemiesAlive = 0;
  private waveActive = true;
  private bestWave = 0;
  private gameOverHandled = false;
  private guardKey!: Phaser.Input.Keyboard.Key;
  private guarding = false;
  private guardIcon!: Phaser.GameObjects.Graphics;
  private lastGuardBlockAt = -Infinity;
  private crouching = false;
  private wasCrouching = false;
  private airJumpsUsed = 0;

  private enemies: EnemySprite[] = [];
  private projectiles: Projectile[] = [];
  private platforms!: Phaser.Physics.Arcade.StaticGroup;

  private healthText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private weaponText!: Phaser.GameObjects.Text;
  private skillText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private gaugeBarBg!: Phaser.GameObjects.Rectangle;
  private gaugeBarFill!: Phaser.GameObjects.Rectangle;
  private gaugeLabel!: Phaser.GameObjects.Text;
  private hiougiHint!: Phaser.GameObjects.Text;
  private tipsHint!: Phaser.GameObjects.Text;

  private statusPanel!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private restartText!: Phaser.GameObjects.Text;
  private virtualControls?: Phaser.GameObjects.Container;

  private tipsOverlay?: Phaser.GameObjects.Container;
  private tipsVisible = false;

  private commandBuffer: CommandEvent[] = [];

  private loadout: Loadout = newLoadout();
  private inventory: WeaponInstance[] = [];
  private baseEquipmentLevels: Record<WeaponKind, number> = { melee: 0, mid: 0, ranged: 0 };
  private selectedArmorId = "none";
  private runWeaponStates: Partial<Record<WeaponKind, RunWeaponState>> = {};
  private items: ItemInventory = {};
  private itemKeys: { itemId: string; key: Phaser.Input.Keyboard.Key; label: string }[] = [];

  private pickups: Pickup[] = [];
  private summonOverlay?: Phaser.GameObjects.Container;
  private summonOverlayTexts: Partial<Record<WeaponKind, Phaser.GameObjects.Text>> = {};
  private summonHintText?: Phaser.GameObjects.Text;
  private summonOverlayVisible = false;

  private stageBuffOverlay?: Phaser.GameObjects.Container;
  private stageBuffOverlayTexts: Phaser.GameObjects.Text[] = [];
  private stageBuffOverlayVisible = false;
  private currentStageBuffOptions: StageBuffOption[] = [];

  private itemsText!: Phaser.GameObjects.Text;

  constructor() {
    super("GameScene");
  }

  init(data?: {
    loadout?: Loadout;
    inventory?: WeaponInstance[];
    baseEquipmentLevels?: Record<WeaponKind, number>;
    selectedArmorId?: string;
  }): void {
    if (data?.loadout && data?.inventory) {
      this.loadout = data.loadout;
      this.inventory = data.inventory;
      this.baseEquipmentLevels = data.baseEquipmentLevels ?? { melee: 0, mid: 0, ranged: 0 };
      this.selectedArmorId = data.selectedArmorId ?? "none";
    } else {
      // R キーでのシーン再スタートなど、data を伴わずに開始された場合は保存済みのロードアウトを読み込む
      const saved: LoadoutSaveData = loadLoadout(window.localStorage as unknown as KVStore);
      this.loadout = saved.loadout;
      this.inventory = saved.inventory;
      this.baseEquipmentLevels = saved.baseEquipmentLevels;
      this.selectedArmorId = saved.selectedArmorId;
    }
  }

  preload(): void {
    // ChatGPT 等で生成したイラスト素材。台帳は docs/art-assets.md。
    // 404 などで読み込めなくても Phaser はエラーで止まらないので、使用箇所で textures.exists() を確認して
    // Graphics 描画のプレースホルダーにフォールバックする。
    this.load.image(ART_BG_KEY, "images/sf-bg-forest.png");
    this.load.image(ART_HERO_KEY, "images/sf-hero-swordsman.png");
    this.load.svg(ART_HERO_ATTACK_KEY, "images/sf-hero-swordsman-attack.svg");
    this.load.svg(ART_HERO_HURT_KEY, "images/sf-hero-swordsman-hurt.svg");
    this.load.image(ART_ENEMY_NORMAL_KEY, "images/sf-enemy-normal.png");
    this.load.svg(ART_ENEMY_AGILE_KEY, "images/sf-enemy-agile.svg");
    this.load.svg(ART_ENEMY_TANK_KEY, "images/sf-enemy-tank.svg");
    this.load.svg(ART_BOSS_KEY, "images/sf-boss-forest-guardian.svg");
    this.load.image(GENERATED_BOSS_KEY, "images/generated/characters/sf-boss-forest-guardian.webp");
    this.load.image(GENERATED_SLASH_KEY, "images/generated/effects/sf-fx-slash.webp");
  }

  create(): void {
    this.playerState = newPlayer();
    this.status = "playing";
    this.enemies = [];
    this.projectiles = [];
    this.commandBuffer = [];
    this.tipsVisible = false;
    this.runWeaponStates = {};
    this.items = { potion: 0, power_charm: 0, haste_charm: 0 };
    this.pickups = [];
    this.wave = 1;
    this.waveEnemiesAlive = 0;
    this.waveActive = true;
    this.gameOverHandled = false;
    this.bestWave = loadBestWave(window.localStorage as unknown as KVStore);

    for (const kind of ["melee", "mid", "ranged"] as const) {
      const stats = baseEquipmentStats(
        kind,
        this.baseEquipmentLevels[kind] ?? 0,
      );
      this.playerState = setCustomWeapon(
        this.playerState,
        kind,
        toWeaponDef(stats, kind),
      );
    }
    const armorTemplate = findArmorTemplate(this.selectedArmorId);
    if (armorTemplate.maxDurability > 0) {
      this.playerState = gainArmor(
        this.playerState,
        armorTemplate.maxDurability,
      );
    }

    this.physics.world.setBounds(0, 0, ARENA_WIDTH, 600);
    this.cameras.main.setBounds(0, 0, ARENA_WIDTH, 600);

    this.generateTextures();
    this.buildLevel();
    this.buildPlayer();
    this.buildHud();
    this.buildTipsOverlay();
    this.buildSummonOverlay();
    this.buildStageBuffOverlay();
    this.spawnWave(this.wave);

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.fadeIn(200);
    this.bossTell = this.add.graphics().setDepth(COMBAT_FX_DEPTH);
    this.styleText = this.add
      .text(400, 115, "", {
        fontSize: "15px",
        color: "#443129",
        backgroundColor: "#fff0cc",
        padding: { x: 12, y: 5 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);
    this.lastStyleHit = -Infinity;
    this.chooseCombatStyle();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.attackKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.X,
    );
    this.skillKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.C,
    );
    this.guardKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.SHIFT,
    );
    this.tipsKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.ENTER,
    );
    this.restartKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.R,
    );
    this.weaponKeys = WEAPON_KEY_BINDINGS.map(({ code, kind }) => ({
      key: this.input.keyboard!.addKey(code),
      kind,
    }));
    this.itemKeys = ITEM_KEY_BINDINGS.map(({ itemId, code, label }) => ({
      itemId,
      key: this.input.keyboard!.addKey(code),
      label,
    }));

    if (isTouchDevice(this)) {
      this.buildVirtualControls();
      buildOrientationWarning(this);
    }

    bgm.startBattle();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => bgm.stop());
  }

  /**
   * 通常プレイ（状態5）専用の仮想ボタン一式。
   * 既存の Key オブジェクトへ onDown/onUp を橋渡しするだけなので、
   * handleMovement/handleAttack 等の既存ロジックは一切変更していない。
   * 左半分=動的仮想スティック（触れた場所を中心に現れ、指の動きに追従して消える）、
   * 右下=攻撃・スキル・武器切替・アイテム使用。
   */
  private buildVirtualControls(): void {
    const controls = this.add.container(0, 0).setScrollFactor(0).setDepth(90).setName("virtual-controls");
    controls.add(bindVirtualJoystick(
      this,
      { x: 0, y: 0, width: 400, height: 600 },
      { left: this.cursors.left, right: this.cursors.right, up: this.cursors.up, down: this.cursors.down },
    ));

    controls.add(bindHeldKey(this, 730, 520, "X", this.attackKey, { radius: 40, color: 0xff6b8a, alpha: 0.5, fontSize: "20px" }));
    controls.add(bindHeldKey(this, 650, 500, "C", this.skillKey, { radius: 28, color: 0x7fd1ff, alpha: 0.5 }));

    WEAPON_KEY_BINDINGS.forEach((_binding, i) => {
      const key = this.weaponKeys[i]?.key;
      if (key) controls.add(bindHeldKey(this, 580 + i * 36, 450, `${i + 1}`, key, { radius: 16, fontSize: "13px" }));
    });
    ITEM_KEY_BINDINGS.forEach(({ label }, i) => {
      const key = this.itemKeys[i]?.key;
      if (key) controls.add(bindHeldKey(this, 580 + i * 36, 410, label, key, { radius: 16, fontSize: "13px", color: 0x7fffb0 }));
    });

    controls.add(bindHeldKey(this, 770, 24, "?", this.tipsKey, { radius: 18, fontSize: "14px" }));
    this.virtualControls = controls;
  }

  /**
   * キャラクター・地形用のスプライトをすべてその場で生成する（画像アセット不要）。
   * プレイヤーと敵は頭・胴・剣を持つ簡易シルエットにして、ただの矩形から一段引き上げる。
   */
  private generateTextures(): void {
    this.drawHumanoidTexture("hero", 0x4ecca3, 0x2f7d64);
    this.drawHumanoidTexture("goblin", 0xff6b6b, 0xa63c3c);
    // イラスト版（読み込めていれば）をゲーム内サイズに縮小した派生テクスチャを作る
    this.buildArtTexture(ART_HERO_KEY, HERO_ART_TEXTURE, HERO_ART_SIZE.w, HERO_ART_SIZE.h);
    this.buildArtTexture(ART_HERO_ATTACK_KEY, HERO_ATTACK_ART_TEXTURE, HERO_ART_SIZE.w, HERO_ART_SIZE.h);
    this.buildArtTexture(ART_HERO_HURT_KEY, HERO_HURT_ART_TEXTURE, HERO_ART_SIZE.w, HERO_ART_SIZE.h);
    this.buildArtTexture(ART_ENEMY_NORMAL_KEY, ENEMY_NORMAL_ART_TEXTURE, ENEMY_ART_SIZE.w, ENEMY_ART_SIZE.h);
    this.buildArtTexture(ART_ENEMY_AGILE_KEY, ENEMY_AGILE_ART_TEXTURE, ENEMY_ART_SIZE.w, ENEMY_ART_SIZE.h);
    this.buildArtTexture(ART_ENEMY_TANK_KEY, ENEMY_TANK_ART_TEXTURE, ENEMY_ART_SIZE.w, ENEMY_ART_SIZE.h);
    const bossSource = this.textures.exists(GENERATED_BOSS_KEY) ? GENERATED_BOSS_KEY : ART_BOSS_KEY;
    this.buildArtTexture(bossSource, BOSS_ART_TEXTURE, 160, 160);

    const tile = this.make.graphics({ x: 0, y: 0 }, false);
    tile.fillStyle(0xffffff, 1);
    tile.fillRect(0, 0, 64, 64);
    tile.generateTexture("solid", 64, 64);
    tile.destroy();

    const slash = this.make.graphics({ x: 0, y: 0 }, false);
    slash.fillStyle(0xffffff, 1);
    slash.fillRoundedRect(0, 0, WEAPONS.mid.range, 14, 7);
    slash.generateTexture("slash", WEAPONS.mid.range, 14);
    slash.destroy();

    const orb = this.make.graphics({ x: 0, y: 0 }, false);
    orb.fillStyle(0x7fd1ff, 1);
    orb.fillCircle(6, 6, 6);
    orb.generateTexture("orb", 12, 12);
    orb.destroy();

    // 戦闘演出は毎回Graphicsを描くだけでなく、専用テクスチャを一度生成してスプライトとして再利用する。
    if (this.textures.exists(GENERATED_SLASH_KEY) && !this.textures.exists(COMBAT_SLASH_TEXTURE)) {
      this.buildArtTexture(GENERATED_SLASH_KEY, COMBAT_SLASH_TEXTURE, 160, 96);
    }
    const slashFx = this.make.graphics({ x: 0, y: 0 }, false);
    slashFx.fillStyle(0xffffff, 0.18);
    slashFx.fillTriangle(8, 82, 148, 14, 104, 72);
    slashFx.lineStyle(10, 0xffffff, 0.9).lineBetween(12, 72, 146, 18);
    slashFx.lineStyle(4, 0xffffff, 1).lineBetween(20, 82, 154, 28);
    if (!this.textures.exists(COMBAT_SLASH_TEXTURE)) slashFx.generateTexture(COMBAT_SLASH_TEXTURE, 160, 96);
    slashFx.destroy();

    const hitFx = this.make.graphics({ x: 0, y: 0 }, false);
    hitFx.fillStyle(0xffffff, 0.92);
    hitFx.fillPoints([
      new Phaser.Math.Vector2(48, 2),
      new Phaser.Math.Vector2(58, 34),
      new Phaser.Math.Vector2(92, 20),
      new Phaser.Math.Vector2(66, 47),
      new Phaser.Math.Vector2(94, 65),
      new Phaser.Math.Vector2(60, 60),
      new Phaser.Math.Vector2(48, 94),
      new Phaser.Math.Vector2(38, 61),
      new Phaser.Math.Vector2(5, 75),
      new Phaser.Math.Vector2(30, 49),
      new Phaser.Math.Vector2(4, 31),
      new Phaser.Math.Vector2(37, 36),
    ], true);
    hitFx.fillStyle(0xffffff, 1).fillCircle(48, 48, 13);
    hitFx.generateTexture(COMBAT_HIT_TEXTURE, 96, 96);
    hitFx.destroy();

    this.drawPickupTexture("pickup_medium", 0xd9a7ff);
    this.drawPickupTexture("pickup_armor", 0x7fd1ff);
    this.drawPickupTexture("pickup_item", 0x7fffb0);
    this.drawPickupTexture("pickup_buff", 0xffd166);
  }

  /**
   * 読み込んだイラストを w×h のキャンバステクスチャへ縮小コピーする。
   * スプライトの scale を 1 に保てるので、しゃがみやヒット時の scale 演出・当たり判定サイズをそのまま流用できる。
   * 元画像が無ければ何もしない（呼び出し側は textures.exists(destKey) で判定する）。
   */
  private buildArtTexture(srcKey: string, destKey: string, w: number, h: number): void {
    if (this.textures.exists(destKey) || !this.textures.exists(srcKey)) return;
    const src = this.textures.get(srcKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const canvas = this.textures.createCanvas(destKey, w, h);
    if (!canvas) return;
    canvas.context.imageSmoothingEnabled = true;
    canvas.context.drawImage(src, 0, 0, w, h);
    canvas.refresh();
  }

  /** 召喚媒体/防具/アイテムのピックアップ用テクスチャ（星型のシンプルな輝き） */
  private drawPickupTexture(key: string, color: number): void {
    const gfx = this.make.graphics({ x: 0, y: 0 }, false);
    gfx.fillStyle(color, 1);
    gfx.fillCircle(10, 10, 8);
    gfx.fillStyle(0xffffff, 0.6);
    gfx.fillCircle(10, 10, 4);
    gfx.generateTexture(key, 20, 20);
    gfx.destroy();
  }

  /** 頭+胴+腕(剣)からなる簡易ヒューマノイドのテクスチャを生成（30×42 の元絵を CHAR_SCALE 倍で描く） */
  private drawHumanoidTexture(key: string, mainColor: number, shadeColor: number): void {
    const k = CHAR_SCALE;
    const w = HUMANOID_BASE.w * k;
    const h = HUMANOID_BASE.h * k;
    const gfx = this.make.graphics({ x: 0, y: 0 }, false);

    // 影
    gfx.fillStyle(0x000000, 0.25);
    gfx.fillEllipse(w / 2, h - 3 * k, 20 * k, 6 * k);

    // 胴体
    gfx.fillStyle(mainColor, 1);
    gfx.fillRoundedRect(6 * k, 16 * k, 18 * k, 22 * k, 4 * k);

    // 頭
    gfx.fillStyle(0xffe0bd, 1);
    gfx.fillCircle(w / 2, 10 * k, 9 * k);

    // 髪/兜（キャラの見分けをつけるための帯）
    gfx.fillStyle(shadeColor, 1);
    gfx.fillRoundedRect(4 * k, 12 * k, 22 * k, 6 * k, 3 * k);

    // 目
    gfx.fillStyle(0x1a1a1a, 1);
    gfx.fillCircle(w / 2 + 3 * k, 10 * k, 1.6 * k);

    // 腕（剣を握る側）
    gfx.fillStyle(shadeColor, 1);
    gfx.fillRoundedRect(20 * k, 20 * k, 6 * k, 14 * k, 3 * k);

    // 脚
    gfx.fillStyle(shadeColor, 1);
    gfx.fillRoundedRect(8 * k, 36 * k, 6 * k, 6 * k, 2 * k);
    gfx.fillRoundedRect(16 * k, 36 * k, 6 * k, 6 * k, 2 * k);

    gfx.generateTexture(key, w, h);
    gfx.destroy();
  }

  /** 固定ゴールへ向かうステージ制から、ウェーブ式サバイバル用の固定サイズアリーナに変更した */
  private buildLevel(): void {
    if (this.textures.exists(ART_BG_KEY)) {
      // 森ステージのイラスト背景（1920×600）。カメラより遅く流してパララックスにする。
      // 表示幅 = 800 + (ARENA_WIDTH - 800) * BG_SCROLL_FACTOR = 1120px < 1920px なので全域をカバーできる
      this.add.image(0, 0, ART_BG_KEY).setOrigin(0, 0).setDisplaySize(1920, 600).setScrollFactor(BG_SCROLL_FACTOR).setDepth(-2);
    } else {
      // フォールバック: 淡い青空グラデーション。ソシャゲ調の明るいファンタジー基調にする
      const sky = this.add.graphics();
      sky.fillGradientStyle(0xaee0ff, 0xaee0ff, 0xe8f6ff, 0xe8f6ff, 1);
      sky.fillRect(0, 0, ARENA_WIDTH, 600);
      sky.setDepth(-2);
    }

    this.platforms = this.physics.add.staticGroup();
    for (let x = 0; x < ARENA_WIDTH; x += 64) {
      this.platforms.create(x + 32, GROUND_Y + 32, "solid").setVisible(false);
    }
    this.add.rectangle(ARENA_WIDTH / 2, GROUND_Y + 32, ARENA_WIDTH, 64, 0x8b6b47);
    this.add.rectangle(ARENA_WIDTH / 2, GROUND_Y, ARENA_WIDTH, 4, 0x5cb85c);

    // 地上からのジャンプ到達高さ（117px）で乗れるのは y=420（上面 410）の足場。
    // y=340/360 の足場は隣の y=420 の足場から段差で登る。（260 の足場は元 y=400 で地上から届かなかったため 420 に下げた）
    const floatingPlatforms = [
      { x: 260, y: 420 },
      { x: 520, y: 340 },
      { x: 800, y: 420 },
      { x: 1080, y: 360 },
      { x: 1340, y: 420 },
    ];
    for (const p of floatingPlatforms) {
      // 雲のようなプラットフォームで空・ファンタジー感を強める
      const rect = this.add.rectangle(p.x, p.y, 140, 20, 0xffffff, 0.9);
      rect.setStrokeStyle(2, 0x9ecbef);
      rect.setDepth(1);
      this.platforms
        .create(p.x, p.y, "solid")
        .setDisplaySize(140, 20)
        .setSize(140, 20)
        .setVisible(false);
    }

    this.platforms.refresh();
  }

  private buildPlayer(): void {
    const useArt = this.textures.exists(HERO_ART_TEXTURE);
    this.player = this.physics.add.sprite(80, GROUND_Y - 60, useArt ? HERO_ART_TEXTURE : "hero");
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(3);
    const off = this.playerBodyOffset();
    this.player.setSize(PLAYER_BODY.w, PLAYER_BODY.h).setOffset(off.x, off.y);
    this.physics.add.collider(this.player, this.platforms);

    // ガード中に表示する盾アイコン（ローカル原点基準で一度だけ描画し、以後は位置だけ更新する）
    this.guardIcon = this.add.graphics();
    this.guardIcon.lineStyle(3, 0xffd166, 0.95);
    this.guardIcon.beginPath();
    this.guardIcon.arc(0, 0, 24, Phaser.Math.DegToRad(-60), Phaser.Math.DegToRad(60));
    this.guardIcon.strokePath();
    this.guardIcon.fillStyle(0xffd166, 0.18);
    this.guardIcon.slice(0, 0, 24, Phaser.Math.DegToRad(-60), Phaser.Math.DegToRad(60), false);
    this.guardIcon.fillPath();
    this.guardIcon.setDepth(COMBAT_FX_DEPTH);
    this.guardIcon.setVisible(false);
  }

  /** 使用中のプレイヤーテクスチャに応じた当たり判定オフセット（判定サイズ自体はどちらも同じ） */
  private playerBodyOffset(): { x: number; y: number } {
    const artKeys = [HERO_ART_TEXTURE, HERO_ATTACK_ART_TEXTURE, HERO_HURT_ART_TEXTURE];
    return artKeys.includes(this.player.texture.key) ? PLAYER_BODY_OFFSET.art : PLAYER_BODY_OFFSET.fallback;
  }

  /** 1体の敵を、抽選済みのスペックで指定位置にスポーンする */
  private spawnEnemy(
    wave: number,
    spec: EnemySpawnSpec,
    x: number,
    index: number,
  ): void {
    const boss = wave % 5 === 0;
    const typeArtTexture = ENEMY_ART_TEXTURE[spec.type];
    const artTexture = boss && this.textures.exists(BOSS_ART_TEXTURE) ? BOSS_ART_TEXTURE : typeArtTexture;
    const useArt = !!artTexture && this.textures.exists(artTexture);
    const sprite = this.physics.add.sprite(
      x,
      GROUND_Y - (boss ? 66 : 45),
      useArt ? artTexture! : "goblin",
    );
    sprite.setCollideWorldBounds(true);
    sprite.setDepth(2);
    const off = useArt ? ENEMY_BODY_OFFSET.art : ENEMY_BODY_OFFSET.fallback;
    sprite.setSize(ENEMY_BODY.w, ENEMY_BODY.h).setOffset(off.x, off.y);
    if (!useArt) sprite.setTint(ENEMY_TYPE_TINT[spec.type]);
    if (spec.type === "agile") sprite.setScale(0.96);
    if (spec.type === "tank" && !boss) sprite.setScale(1.28);
    if (boss) sprite.setScale(1.18);
    this.physics.add.collider(sprite, this.platforms);

    const patrolRadius = 80 * spec.speedMul;
    const enemy: EnemySprite = {
      state: newEnemy(`w${wave}-${index}`, spec.health, spec.defense),
      sprite,
      patrolMinX: Math.max(40, x - patrolRadius),
      patrolMaxX: Math.min(ARENA_WIDTH - 40, x + patrolRadius),
      dir: 1,
      type: spec.type,
      speedMul: spec.speedMul,
      boss,
      bornAt: this.time.now,
      bossDir: 1,
      lastBossPhase: "",
    };
    this.enemies.push(enemy);

    // すり抜けず物理的にぶつかるようにする（overlap のみだと敵の体を通り抜けてしまい、
    // 剣の間合いに留まれず「当たらない」と感じる原因になっていた）
    this.physics.add.collider(this.player, sprite, () =>
      this.onPlayerTouchEnemy(enemy),
    );
  }

  /**
   * ウェーブを開始する。`rollWaveComposition` で決まった敵編成（数・タイプ・強さにランダムな幅がある）
   * をアリーナ内のランダムな位置にスポーンし、ピックアップも合わせて配置する。
   * 全滅させると次のウェーブが始まる（onEnemyKilled参照）。
   */
  private spawnWave(wave: number): void {
    const composition = rollWaveComposition(wave);
    this.waveEnemiesAlive = composition.enemies.length;
    this.waveActive = true;
    composition.enemies.forEach((spec, i) => {
      const x =
        composition.kind === "boss"
          ? Math.round(ARENA_WIDTH * 0.7) // ボスは分かりやすく奥にどっしり配置
          : Phaser.Math.Between(200, ARENA_WIDTH - 100);
      this.spawnEnemy(wave, spec, x, i);
    });
    this.spawnWavePickups(wave);
    this.announceWave(wave, composition.kind);
  }

  private announceWave(wave: number, kind: WaveKind): void {
    const suffix = kind === "boss" ? " - BOSS!" : kind === "swarm" ? tr(this.lang, " - 大量発生!", " - SWARM!") : "";
    const color = kind === "boss" ? "#e0447a" : kind === "swarm" ? "#c98a12" : "#8a4fd1";
    this.spawnFloatingText(this.player.x, this.player.y - 105, `WAVE ${wave}${suffix}`, color);
  }

  /** 召喚媒体/防具/アイテム/ステージバフのピックアップをアリーナ内のランダムな位置に配置する */
  private spawnWavePickups(wave: number): void {
    const itemIds = ITEM_DEFS.map((i) => i.id);
    const pool: { kind: PickupKind; texture: string; itemId?: string }[] = [
      { kind: "summonMedium", texture: "pickup_medium" },
      { kind: "armor", texture: "pickup_armor" },
      { kind: "item", texture: "pickup_item", itemId: itemIds[Phaser.Math.Between(0, itemIds.length - 1)] },
      { kind: "stageBuff", texture: "pickup_buff" },
    ];
    const count = pickupsForWave(wave);
    for (let i = 0; i < count; i++) {
      const choice = pool[Phaser.Math.Between(0, pool.length - 1)];
      if (!choice) continue;
      const x = Phaser.Math.Between(150, ARENA_WIDTH - 150);
      this.spawnPickup(x, choice.kind, choice.texture, choice.itemId);
    }
  }

  private spawnPickup(x: number, kind: PickupKind, textureKey: string, itemId?: string): void {
    // プレイヤーの当たり判定（GROUND_Y-13〜+19、地面立ち時は概ねGROUND_Y-19〜+13）と
    // 確実に重なる高さに置き、ジャンプせず歩くだけで拾えるようにする
    const sprite = this.physics.add.sprite(x, GROUND_Y - 24, textureKey);
    (sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.tweens.add({
      targets: sprite,
      y: sprite.y - 6,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    const pickup: Pickup = { kind, sprite, collected: false, itemId };
    this.pickups.push(pickup);
    this.physics.add.overlap(this.player, sprite, () => this.onPickupCollected(pickup));
  }

  private buildHud(): void {
    // HUD はキャラ（depth 2〜3）や攻撃演出（〜6）より前面に出す。
    // buildHud 内で生成したオブジェクトのうち depth 未指定のものをまとめて持ち上げる
    const firstHudIndex = this.children.length;
    this.buildHudObjects();
    for (const child of this.children.list.slice(firstHudIndex)) {
      const obj = child as Phaser.GameObjects.GameObject & {
        depth?: number;
        setDepth?: (d: number) => unknown;
      };
      if (obj.depth === 0 && obj.setDepth) obj.setDepth(HUD_DEPTH);
    }
  }

  private buildHudObjects(): void {
    drawPanel(this, 150, 68, 284, 128, {
      radius: 14,
      fillColor: 0x17362f,
      fillAlpha: 0.86,
      borderColor: 0x8dc48e,
      borderAlpha: 0.7,
      scrollFactor: 0,
      shadow: false,
    });
    this.healthText = this.add
      .text(16, 12, "", { ...TYPE.numeric, fontSize: "18px", color: "#e0447a" })
      .setScrollFactor(0);
    this.scoreText = this.add
      .text(16, 34, "", { ...TYPE.body, fontSize: "14px", color: "#ffd56a", fontStyle: "700" })
      .setScrollFactor(0);
    this.weaponText = this.add
      .text(16, 54, "", { ...TYPE.body, color: "#9fe7d0" })
      .setScrollFactor(0);
    this.skillText = this.add
      .text(16, 72, "", { ...TYPE.small, color: THEME.textMuted })
      .setScrollFactor(0);
    this.comboText = this.add
      .text(16, 90, "", { ...TYPE.small, color: THEME.textMuted })
      .setScrollFactor(0);
    this.itemsText = this.add
      .text(16, 108, "", { ...TYPE.small, color: "#1f8a63" })
      .setScrollFactor(0);

    drawPanel(this, 660, 20, 228, 22, {
      radius: 11,
      fillColor: 0x17362f,
      fillAlpha: 0.9,
      borderColor: 0x8dc48e,
      borderAlpha: 0.7,
      scrollFactor: 0,
      shadow: false,
    });
    this.gaugeBarBg = this.add
      .rectangle(660, 20, 220, 16, 0x2a2a4a, 0)
      .setScrollFactor(0);
    this.gaugeBarFill = this.add
      .rectangle(660 - 108, 20, 0, 12, 0xd9a7ff)
      .setOrigin(0, 0.5)
      .setScrollFactor(0);
    this.gaugeLabel = this.add
      .text(660, 20, "", { fontSize: "11px", color: "#ffffff", fontStyle: "600" })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.hiougiHint = this.add
      .text(660, 38, "", { fontSize: "11px", color: "#c98a12" })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.tipsHint = this.add
      .text(400, 748, tr(this.lang, "Enterキーで操作方法を表示", "Press Enter for Controls"), { fontSize: "12px", color: "#7488a0" })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.statusPanel = drawPanel(this, 400, 300, 360, 140, {
      radius: 18,
      fillColor: 0xffffff,
      fillAlpha: 0.97,
      borderColor: 0xb98af0,
      borderAlpha: 0.7,
      scrollFactor: 0,
    }).setVisible(false);
    this.statusText = this.add
      .text(400, 280, "", { fontSize: "34px", color: "#2d3a52", align: "center", fontStyle: "700" })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.restartText = this.add
      .text(400, 325, "", { fontSize: "14px", color: "#7488a0", align: "center" })
      .setOrigin(0.5)
      .setScrollFactor(0);
    // ステータスパネル全体をタップ可能にする。表示中（gameover/cleared）以外は何もしない
    makeTappable(this, 400, 300, 360, 140, () => {
      if (this.status !== "playing") this.restartKey.onDown(fakeKeyEvent(this));
    }).setScrollFactor(0);
    this.refreshHud();
  }

  private buildTipsOverlay(): void {
    const overlay = this.add.container(0, 0).setScrollFactor(0).setDepth(100).setVisible(false);
    const bg = this.add
      .rectangle(400, 380, 800, 760, 0x3a5a78, 0.55)
      .setInteractive()
      .on("pointerdown", () => this.toggleTips());
    const panel = drawPanel(this, 400, 380, 560, 480, {
      radius: 20,
      fillColor: 0xffffff,
      fillAlpha: 0.98,
      borderColor: 0xb98af0,
      borderAlpha: 0.7,
      shadow: false,
    });
    const title = this.add
      .text(400, 170, tr(this.lang, "操作方法", "Controls"), { fontSize: "24px", color: "#2d3a52", fontStyle: "700" })
      .setOrigin(0.5);
    const body = this.add
      .text(
        400,
        380,
        (this.lang === "ja"
          ? [
              "← → : 移動　　↑ : ジャンプ　　↓ : しゃがみ",
              "X : 通常攻撃（装備中の武器で攻撃）",
              "1 / 2 / 3 : 武器切替（近接／中距離／遠距離）",
              "C : スキル発動（クールダウンあり）",
              "Shift : ガード（正面からの接触ダメージを防ぐ。移動・攻撃はできない）",
              "空中二段ジャンプのバフ中は空中でもう一度↑でジャンプできる",
              "Z / V / B : ポーション／剛力の護符／俊足の護符を使用",
              "",
              "必殺ゲージが満タンの時：",
              "↓ → X の順に入力で【奥義】発動",
              "",
              "秘奥義解放後、ゲージ満タンの時：",
              "↓ → ↓ → X の順に入力で【秘奥義】発動",
              "",
              "召喚媒体/ステージバフを拾うと一時停止して選択画面が開きます",
              "",
              "敵を全滅させるとウェーブクリア。少し休んだら次のウェーブが始まります",
              "ウェーブが進むほど敵の数・体力・防御力が上がっていきます。どこまで生き残れるか挑戦！",
              "水色=敏捷型（速いが打たれ弱い）　紫色=タンク型（遅いが硬い）",
              "5ウェーブごとにボス、7ウェーブごとに大量発生ウェーブが出現します",
              "R : ゲームオーバー後にリトライ",
            ]
          : [
              "← → : Move    ↑ : Jump    ↓ : Crouch",
              "X : Attack with the equipped weapon",
              "1 / 2 / 3 : Switch Melee / Mid-range / Ranged",
              "C : Skill (cooldown applies)",
              "Shift : Guard frontal contact damage; movement and attacks are disabled",
              "With Double Jump active, press ↑ again in midair",
              "Z / V / B : Potion / Power Charm / Haste Charm",
              "",
              "When the special gauge is full:",
              "Input ↓ → X to unleash OUGI",
              "",
              "After Hi-Ougi is unlocked with a full gauge:",
              "Input ↓ → ↓ → X to unleash HI-OUGI",
              "",
              "Picking up a Summon Medium or Stage Buff pauses the game for a choice",
              "",
              "Defeat every enemy to clear the wave. The next wave begins after a short break",
              "Enemy count, HP and defense rise with each wave. Survive as long as you can",
              "Cyan = Agile (fast/fragile)    Purple = Tank (slow/tough)",
              "Boss every 5 waves; swarm wave every 7 waves",
              "R : Retry after Game Over",
            ]
        ).join("\n"),
        { fontSize: "15px", color: "#3a4a5a", align: "center", lineSpacing: 8 },
      )
      .setOrigin(0.5);
    const closeHint = this.add
      .text(400, 590, tr(this.lang, "Enter でとじる", "Press Enter to Close"), { fontSize: "13px", color: "#7488a0" })
      .setOrigin(0.5);
    overlay.add([bg, panel, title, body, closeHint]);
    this.tipsOverlay = overlay;
  }

  private toggleTips(): void {
    this.tipsVisible = !this.tipsVisible;
    this.tipsOverlay?.setVisible(this.tipsVisible);
  }

  /** ヴァンサバ風の一時停止＋選択UI。召喚媒体を拾うと開き、呼び出す武器スロットを選ぶ */
  private buildSummonOverlay(): void {
    const overlay = this.add.container(0, 0).setScrollFactor(0).setDepth(110).setVisible(false);
    const bg = this.add
      .rectangle(400, 300, 800, 600, 0x3a5a78, 0.55)
      .setInteractive()
      .on("pointerdown", () => this.closeSummonOverlay());
    const panel = drawPanel(this, 400, 300, 560, 280, {
      radius: 18,
      fillColor: 0xffffff,
      fillAlpha: 0.98,
      borderColor: 0xd9a7ff,
      borderAlpha: 0.7,
      shadow: false,
    });
    const title = this.add
      .text(400, 190, tr(this.lang, "⚔️ 召喚媒体 — 呼び出す武器を選択", "⚔️ SUMMON MEDIUM — Choose a Weapon"), { fontSize: "18px", color: "#2d3a52", fontStyle: "700" })
      .setOrigin(0.5);
    overlay.add([bg, panel, title]);

    (["melee", "mid", "ranged"] as const).forEach((kind, i) => {
      const x = 250 + i * 150;
      const y = 300;
      const cardPanel = drawPanel(this, x, y, 130, 110, {
        radius: 12,
        fillColor: 0xeaf5ff,
        borderColor: 0x9ecbef,
        borderAlpha: 0.8,
        shadow: false,
      });
      const box = this.add
        .rectangle(x, y, 130, 110, 0xffffff, 0)
        .setInteractive({ useHandCursor: true })
        .on("pointerover", () =>
          cardPanel.lineStyle(2, 0xb98af0, 0.9).strokeRoundedRect(x - 65, y - 55, 130, 110, 12),
        )
        .on("pointerout", () =>
          cardPanel.lineStyle(1, 0x9ecbef, 0.8).strokeRoundedRect(x - 65, y - 55, 130, 110, 12),
        )
        .on("pointerdown", () => this.trySummon(kind));
      const label = this.add
        .text(x, y - 60, `${i + 1}: ${weaponLabel(this.lang, kind)}`, { fontSize: "12px", color: "#6a7a95" })
        .setOrigin(0.5);
      const text = this.add
        .text(x, y, "", {
          fontSize: "12px",
          color: "#3a4a5a",
          align: "center",
          wordWrap: { width: 116 },
        })
        .setOrigin(0.5);
      overlay.add([cardPanel, box, label, text]);
      this.summonOverlayTexts[kind] = text;
    });

    this.summonHintText = this.add
      .text(400, 410, tr(this.lang, "1 / 2 / 3 キー、またはクリックで選択", "Press 1 / 2 / 3 or Click to Choose"), { fontSize: "12px", color: "#7488a0" })
      .setOrigin(0.5);
    overlay.add(this.summonHintText);
    this.summonOverlay = overlay;
  }

  private refreshSummonOverlayTexts(): void {
    for (const kind of ["melee", "mid", "ranged"] as const) {
      const text = this.summonOverlayTexts[kind];
      if (!text) continue;
      const instanceId = this.loadout[kind];
      const instance = instanceId ? this.inventory.find((w) => w.id === instanceId) : undefined;
      if (!instance) {
        text.setText(tr(this.lang, "(未設定)\nロードアウトで設定してください", "(Not Set)\nConfigure it in Loadout")).setColor("#62628a");
        continue;
      }
      const template = findTemplate(instance.templateId);
      const run = this.runWeaponStates[kind];
      const stageLabel = run && run.instanceId === instance.id ? `${tr(this.lang, "召喚中", "Summoned")} stage${run.stage}` : tr(this.lang, "未召喚", "Not Summoned");
      text
        .setText(`${template?.name ?? "?"}\n[${instance.rarity}] ${stageLabel}`)
        .setColor("#3a4a5a");
    }
  }

  private openSummonOverlay(): void {
    this.summonOverlayVisible = true;
    this.physics.pause();
    this.refreshSummonOverlayTexts();
    this.summonHintText?.setText(tr(this.lang, "1 / 2 / 3 キー、またはクリックで選択", "Press 1 / 2 / 3 or Click to Choose"));
    this.summonOverlay?.setVisible(true);
  }

  private closeSummonOverlay(): void {
    this.summonOverlayVisible = false;
    this.summonOverlay?.setVisible(false);
    this.physics.resume();
  }

  private trySummon(kind: WeaponKind): void {
    const result = resolveSummon(this.loadout, this.inventory, kind, this.runWeaponStates[kind]);
    if (!result) {
      this.summonHintText?.setText(tr(this.lang, `${weaponLabel(this.lang, kind)}はロードアウト未設定です`, `${weaponLabel(this.lang, kind)} is not configured in Loadout`));
      return;
    }
    this.playerState = setCustomWeapon(this.playerState, kind, toWeaponDef(result.stats, kind));
    this.runWeaponStates = { ...this.runWeaponStates, [kind]: result.runState };
    this.closeSummonOverlay();
    this.playCatchAnimation(kind);
  }

  /** 空中に現れた武器をプレイヤーが受け取る演出 */
  private playCatchAnimation(kind: WeaponKind): void {
    const icon = this.add
      .sprite(this.player.x, this.player.y - 160, "orb")
      .setScale(1.8)
      .setTint(0xd9a7ff)
      .setDepth(COMBAT_FX_DEPTH);
    this.tweens.add({
      targets: icon,
      y: this.player.y - 15,
      duration: 260,
      ease: "Cubic.easeIn",
      onComplete: () => {
        icon.destroy();
        this.cameras.main.flash(150, 217, 167, 255);
        this.tweens.add({ targets: this.player, scale: 1.2, duration: 80, yoyo: true });
        this.spawnFloatingText(this.player.x, this.player.y - 75, `${weaponLabel(this.lang, kind)} ${tr(this.lang, "召喚！", "SUMMONED!")}`, "#d9a7ff");
      },
    });
  }

  /** 召喚媒体/防具/アイテム/ステージバフのピックアップを取得した時の処理 */
  private onPickupCollected(pickup: Pickup): void {
    if (pickup.collected) return;
    pickup.collected = true;
    pickup.sprite.disableBody(true, true);

    if (pickup.kind === "summonMedium") {
      this.openSummonOverlay();
      return;
    }
    if (pickup.kind === "armor") {
      this.playerState = gainArmor(this.playerState, 1);
      this.spawnFloatingText(this.player.x, this.player.y - 60, tr(this.lang, "🛡️ 防具+1", "🛡️ Armor +1"), "#7fd1ff");
      return;
    }
    if (pickup.kind === "stageBuff") {
      this.openStageBuffOverlay();
      return;
    }
    // item: 所持数を増やすだけ。使用は対応するキー（Z/V/B）で行う
    if (pickup.itemId) {
      this.items = { ...this.items, [pickup.itemId]: (this.items[pickup.itemId] ?? 0) + 1 };
      const name = itemName(this.lang, pickup.itemId, findItemDef(pickup.itemId)?.name ?? pickup.itemId);
      this.spawnFloatingText(this.player.x, this.player.y - 60, `📦 ${name}+1`, "#7fffb0");
    }
  }

  /** アイテム使用キー（Z/V/B）の入力処理 */
  private handleItemUse(time: number): void {
    for (const { itemId, key } of this.itemKeys) {
      if (!Phaser.Input.Keyboard.JustDown(key)) continue;
      const consumed = useItem(this.items, itemId);
      if (!consumed) {
        this.spawnFloatingText(this.player.x, this.player.y - 60, tr(this.lang, "所持していない", "Not owned"), "#ff6b8a");
        continue;
      }
      this.items = consumed;
      this.applyItemEffect(itemId, time);
    }
  }

  private applyItemEffect(itemId: string, time: number): void {
    const name = itemName(this.lang, itemId, findItemDef(itemId)?.name ?? itemId);
    if (itemId === "potion") {
      this.playerState = healPlayer(this.playerState, 1);
      this.spawnFloatingText(this.player.x, this.player.y - 60, `${name} ${tr(this.lang, "使用", "used")} ❤️`, "#ff6b8a");
      return;
    }
    const buffKind: BuffKind | null = itemId === "power_charm" ? "power" : itemId === "haste_charm" ? "haste" : null;
    if (buffKind) {
      this.playerState = applyBuff(this.playerState, buffKind, time, ITEM_BUFF_DURATION_MS);
      this.spawnFloatingText(this.player.x, this.player.y - 60, `${name} ${tr(this.lang, "使用", "used")} ✨`, "#ffd166");
    }
  }

  /** ヴァンサバ風の一時停止＋選択UI。ステージバフ（アウトゲーム設定とは独立したプール）から1つ選ぶ */
  private buildStageBuffOverlay(): void {
    const overlay = this.add.container(0, 0).setScrollFactor(0).setDepth(120).setVisible(false);
    const bg = this.add.rectangle(400, 300, 800, 600, 0x3a5a78, 0.55).setInteractive();
    const panel = drawPanel(this, 400, 300, 560, 280, {
      radius: 18,
      fillColor: 0xffffff,
      fillAlpha: 0.98,
      borderColor: 0xffd166,
      borderAlpha: 0.7,
      shadow: false,
    });
    const title = this.add
      .text(400, 190, tr(this.lang, "✨ ステージバフ — 1つ選択", "✨ STAGE BUFF — Choose One"), { fontSize: "18px", color: "#2d3a52", fontStyle: "700" })
      .setOrigin(0.5);
    overlay.add([bg, panel, title]);

    for (let i = 0; i < 3; i++) {
      const x = 250 + i * 150;
      const y = 300;
      const cardPanel = drawPanel(this, x, y, 130, 110, {
        radius: 12,
        fillColor: 0xeaf5ff,
        borderColor: 0x9ecbef,
        borderAlpha: 0.8,
        shadow: false,
      });
      const box = this.add
        .rectangle(x, y, 130, 110, 0xffffff, 0)
        .setInteractive({ useHandCursor: true })
        .on("pointerover", () =>
          cardPanel.lineStyle(2, 0xc98a12, 0.9).strokeRoundedRect(x - 65, y - 55, 130, 110, 12),
        )
        .on("pointerout", () =>
          cardPanel.lineStyle(1, 0x9ecbef, 0.8).strokeRoundedRect(x - 65, y - 55, 130, 110, 12),
        )
        .on("pointerdown", () => this.selectStageBuff(i));
      const text = this.add
        .text(x, y, "", { fontSize: "12px", color: "#3a4a5a", align: "center", wordWrap: { width: 116 } })
        .setOrigin(0.5);
      overlay.add([cardPanel, box, text]);
      this.stageBuffOverlayTexts.push(text);
    }

    this.stageBuffOverlay = overlay;
  }

  private openStageBuffOverlay(): void {
    this.currentStageBuffOptions = rollStageBuffOptions(3);
    this.currentStageBuffOptions.forEach((option, i) => {
      const localized = stageBuffText(this.lang, option.kind, option.label, option.desc);
      this.stageBuffOverlayTexts[i]?.setText(`${localized.label}\n${localized.desc}`);
    });
    this.stageBuffOverlayVisible = true;
    this.physics.pause();
    this.stageBuffOverlay?.setVisible(true);
  }

  private closeStageBuffOverlay(): void {
    this.stageBuffOverlayVisible = false;
    this.stageBuffOverlay?.setVisible(false);
    this.physics.resume();
  }

  private selectStageBuff(index: number): void {
    const option = this.currentStageBuffOptions[index];
    if (!option) return;
    const time = this.time.now;
    if (option.kind === "regen") {
      this.playerState = applyRegen(this.playerState, time, STAGE_BUFF_DURATION_MS);
    } else {
      this.playerState = applyBuff(this.playerState, option.kind, time, STAGE_BUFF_DURATION_MS);
    }
    this.closeStageBuffOverlay();
    this.cameras.main.flash(150, 255, 209, 102);
    this.spawnFloatingText(this.player.x, this.player.y - 75, `${option.label}！`, "#ffd166");
  }

  update(time: number): void {
    if (this.styleChoosing) return;
    if (Phaser.Input.Keyboard.JustDown(this.tipsKey)) {
      this.toggleTips();
    }
    if (this.tipsVisible) return; // TIPS表示中は操作を止める

    if (this.summonOverlayVisible) {
      // 召喚選択中は他の操作を止め、1/2/3キーでの選択のみ受け付ける
      for (const { key, kind } of this.weaponKeys) {
        if (Phaser.Input.Keyboard.JustDown(key)) this.trySummon(kind);
      }
      return;
    }

    if (this.stageBuffOverlayVisible) {
      // ステージバフ選択中は1/2/3キーで選択肢のインデックスを選ぶ
      this.weaponKeys.forEach(({ key }, i) => {
        if (Phaser.Input.Keyboard.JustDown(key)) this.selectStageBuff(i);
      });
      return;
    }

    if (this.status !== "playing") {
      if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
        this.scene.restart();
      }
      return;
    }

    this.playerState = tickRegen(this.playerState, time);
    this.handleGuard();
    this.handleMovement();
    this.handleWeaponSwitch();
    this.handleItemUse(time);
    this.handleSkill(time);
    this.handleAttack(time);
    this.handleSpecialMoves(time);
    this.updateEnemies();
    this.updateProjectiles();
    this.checkStatus();
    this.refreshHud();
  }

  private handleMovement(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const grounded = body.blocked.down;
    if (grounded) this.airJumpsUsed = 0; // 着地したら空中ジャンプの回数をリセット

    // しゃがみ: 地上で↓キー押しっぱなしの間だけ。当たり判定を低くし、移動速度を落とす
    this.crouching = grounded && this.cursors.down.isDown && !this.guarding;
    this.applyCrouchVisual(this.crouching);

    const speed = MOVE_SPEED * buffSpeedMultiplier(this.playerState, this.time.now) * (this.crouching ? 0.35 : 1);
    let vx = 0;
    if (this.guarding) {
      // ガード中は構えに集中するため移動不可
    } else if (this.cursors.left.isDown) {
      vx = -speed;
      this.playerState = { ...this.playerState, facing: -1 as Facing };
      this.player.setFlipX(true);
    } else if (this.cursors.right.isDown) {
      vx = speed;
      this.playerState = { ...this.playerState, facing: 1 as Facing };
      this.player.setFlipX(false);
    }
    body.setVelocityX(vx);

    if (this.cursors.up.isDown && grounded) {
      body.setVelocityY(JUMP_VELOCITY);
    } else if (
      Phaser.Input.Keyboard.JustDown(this.cursors.up) &&
      !grounded &&
      this.airJumpsUsed < 1 &&
      isBuffActive(this.playerState, "doubleJump", this.time.now)
    ) {
      // バフ「空中二段ジャンプ」中のみ、空中でもう一度だけジャンプできる
      body.setVelocityY(JUMP_VELOCITY * 0.85);
      this.airJumpsUsed += 1;
      this.spawnDoubleJumpFx();
    }

    // コマンド入力: ↓/前/後 のトークンをバッファに積む
    const now = this.time.now;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
      this.pushCommand("down", now);
    }
    const facing = this.playerState.facing;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) {
      this.pushCommand(facing === 1 ? "forward" : "back", now);
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) {
      this.pushCommand(facing === -1 ? "forward" : "back", now);
    }
  }

  /** しゃがみ状態が切り替わった時だけ当たり判定・見た目のサイズを更新する */
  private applyCrouchVisual(crouching: boolean): void {
    if (crouching === this.wasCrouching) return;
    this.wasCrouching = crouching;
    if (crouching) {
      this.layoutPlayerBody(PLAYER_BODY.crouchH, CROUCH_SCALE_Y);
    } else {
      this.layoutPlayerBody(PLAYER_BODY.h, 1);
    }
  }

  /**
   * プレイヤーの縦スケールと当たり判定の高さを「足元の位置を固定したまま」切り替える。
   * Arcade の Body は preUpdate でスプライトの scale を掛けて高さ・オフセットを再計算するため、
   * setScale(1, 0.68) の後に素の数値で setSize/setOffset すると体が縮んで足が地面から浮き、
   * blocked.down が外れてしゃがみが毎フレーム解除→再開を繰り返してしまう。
   * ここではスケール後の実寸が bodyH・足元 = 元の足元位置になるよう逆算して設定する。
   */
  private layoutPlayerBody(bodyH: number, scaleY: number): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const off = this.playerBodyOffset();
    const feetY = body.bottom;
    const halfH = this.player.height / 2; // scale 前のテクスチャ半分の高さ
    this.player.setScale(1, scaleY);
    this.player.y = feetY + FEET_MARGIN - halfH * scaleY; // 絵の下端を足元の少し下に合わせる
    const offY = halfH + (feetY - bodyH - this.player.y) / scaleY;
    body.setSize(PLAYER_BODY.w, bodyH / scaleY).setOffset(off.x, offY);
    body.updateFromGameObject();
    // postUpdate は「フレーム開始時の位置との差分」をスプライトに足すため、ここで動かした分が二重に反映されないよう基準も更新する
    body.prev.copy(body.position);
    body.prevFrame.copy(body.position);
  }

  private spawnDoubleJumpFx(): void {
    const burst = this.add.circle(this.player.x, this.player.y + 21, 4, 0x7fd1ff, 0.8);
    this.tweens.add({ targets: burst, scale: 3, alpha: 0, duration: 300, onComplete: () => burst.destroy() });
  }

  /** ガードの構え状態を更新する。攻撃・移動より先に呼び、他の処理から `this.guarding` を参照できるようにする */
  private handleGuard(): void {
    this.guarding = this.guardKey.isDown && !this.crouching;
    this.guardIcon.setVisible(this.guarding);
    if (this.guarding) {
      const facing = this.playerState.facing;
      this.guardIcon.setPosition(this.player.x + facing * 24, this.player.y - 9);
      this.guardIcon.setScale(facing === -1 ? -1 : 1, 1);
    }
  }

  private pushCommand(token: CommandToken, time: number): void {
    this.commandBuffer = pushCommandEvent(this.commandBuffer, token, time);
  }

  private handleWeaponSwitch(): void {
    for (const { key, kind } of this.weaponKeys) {
      if (Phaser.Input.Keyboard.JustDown(key) && this.playerState.equippedWeapon !== kind) {
        this.playerState = switchWeapon(this.playerState, kind);
        this.spawnFloatingText(this.player.x, this.player.y - 60, weaponLabel(this.lang, kind), "#7fd1ff");
      }
    }
  }

  private handleSkill(time: number): void {
    if (!Phaser.Input.Keyboard.JustDown(this.skillKey)) return;
    const next = useSkill(this.playerState, time);
    if (!next) return;
    this.playerState = next;
    sfx.skill();
    this.cameras.main.flash(150, 127, 209, 255);
    this.dashAttack(SKILL_RANGE, WEAPONS[this.playerState.equippedWeapon].damage * SKILL_DAMAGE_MULTIPLIER, time);
  }

  /** 専用アクション立ち絵へ一時的に差し替える。当たり判定は通常時と同じ。 */
  private showPlayerActionPose(textureKey: string, durationMs: number): void {
    if (!this.textures.exists(textureKey)) return;
    this.player.setTexture(textureKey);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const off = this.playerBodyOffset();
    body.setSize(PLAYER_BODY.w, this.crouching ? PLAYER_BODY.crouchH / CROUCH_SCALE_Y : PLAYER_BODY.h)
      .setOffset(off.x, off.y);
    this.time.delayedCall(durationMs, () => {
      if (this.player.texture.key !== textureKey) return;
      const normal = this.textures.exists(HERO_ART_TEXTURE) ? HERO_ART_TEXTURE : "hero";
      this.player.setTexture(normal);
      const normalOff = this.playerBodyOffset();
      body.setSize(PLAYER_BODY.w, this.crouching ? PLAYER_BODY.crouchH / CROUCH_SCALE_Y : PLAYER_BODY.h)
        .setOffset(normalOff.x, normalOff.y);
    });
  }

  /** スキル・奥義・秘奥義に共通の「その場で前方範囲を薙ぎ払う」処理 */
  private dashAttack(range: number, damage: number, time: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.state.alive) continue;
      if (Math.abs(enemy.sprite.y - this.player.y) > ATTACK_RANGE_Y * 1.5) continue;
      if (!inAttackRange(this.player.x, this.playerState.facing, enemy.sprite.x, range, 20)) continue;
      this.applyHit(enemy, damage, time, false);
    }
  }

  private handleAttack(time: number): void {
    if (this.guarding) return; // ガード中は攻撃できない
    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) {
      this.pushCommand("attack", time);
      this.tryTriggerSpecial(time);

      const next = startAttack(this.playerState, time);
      if (next) {
        this.playerState = next;
        sfx.slash();
        const weapon = currentWeapon(this.playerState);
        if (weapon.projectile) {
          this.spawnProjectile();
        } else {
          this.spawnAttackFx(weapon);
        }
      }
    }

    const weapon = currentWeapon(this.playerState);
    const attacking = isAttacking(this.playerState, time);
    if (!attacking || weapon.projectile) return;
    for (const enemy of this.enemies) {
      if (!enemy.state.alive) continue;
      if (Math.abs(enemy.sprite.y - this.player.y) > ATTACK_RANGE_Y) continue;
      if (!inAttackRange(this.player.x, this.playerState.facing, enemy.sprite.x, weapon.range)) continue;
      this.applyHit(enemy, weapon.damage, time, true);
    }
  }

  /**
   * 攻撃の発生を分かりやすくするための一回限りの斬撃エフェクト。
   * 以前は薄い半透明の矩形を毎フレーム表示/非表示するだけで視認性が低かったため、
   * 武器種の色を帯びた弧を勢いよく広げてフェードさせる方式に変更した。
   * 当たり判定自体は `inAttackRange` による距離判定のままで変更していない。
   */
  private spawnAttackFx(weapon: WeaponDef): void {
    const kindColor: Record<WeaponKind, number> = { melee: 0xff6b8a, mid: 0xffd166, ranged: 0x7fd1ff };
    const color = kindColor[weapon.kind];
    const facing = this.playerState.facing;
    this.showPlayerActionPose(HERO_ATTACK_ART_TEXTURE, Math.max(150, weapon.attackWindowMs + 40));
    const radius = weapon.range * 0.7;
    const slashSprite = this.add
      .image(this.player.x + facing * 26, this.player.y - 8, COMBAT_SLASH_TEXTURE)
      .setDepth(COMBAT_FX_DEPTH)
      .setTint(color)
      .setFlipX(facing < 0)
      .setScale(Math.max(0.55, weapon.range / 150), 0.72)
      .setAlpha(0.95);
    this.tweens.add({
      targets: slashSprite,
      x: slashSprite.x + facing * 20,
      scaleX: slashSprite.scaleX * 1.16,
      scaleY: slashSprite.scaleY * 1.08,
      alpha: 0,
      duration: Math.max(130, weapon.attackWindowMs),
      ease: "Cubic.easeOut",
      onComplete: () => slashSprite.destroy(),
    });

    const g = this.add.graphics({ x: this.player.x + facing * 21, y: this.player.y - 6 });
    g.setDepth(COMBAT_FX_DEPTH);
    g.lineStyle(5, color, 0.95);
    g.beginPath();
    g.arc(0, 0, radius, Phaser.Math.DegToRad(-50), Phaser.Math.DegToRad(50));
    g.strokePath();
    g.lineStyle(2, 0xffffff, 0.9);
    g.beginPath();
    g.arc(0, 0, radius, Phaser.Math.DegToRad(-50), Phaser.Math.DegToRad(50));
    g.strokePath();
    g.lineStyle(2, color, 0.45);
    g.beginPath();
    g.arc(0, 0, radius * 0.72, Phaser.Math.DegToRad(-62), Phaser.Math.DegToRad(62));
    g.strokePath();
    // Arcだけだと背景に溶けやすいので、斬撃の芯を太い白光で一本通す。
    g.lineStyle(8, 0xffffff, 0.72);
    g.lineBetween(6, 22, radius * 0.92, -24);
    g.lineStyle(4, color, 0.92);
    g.lineBetween(0, 27, radius, -29);
    g.fillStyle(color, 0.16);
    g.fillTriangle(2, 35, radius * 0.82, -18, radius * 0.44, 30);
    g.setScale(facing === -1 ? -0.5 : 0.5, 1);
    g.setAlpha(0.95);
    this.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: facing === -1 ? -1.15 : 1.15,
      duration: Math.max(120, weapon.attackWindowMs),
      ease: "Cubic.easeOut",
      onComplete: () => g.destroy(),
    });

    // プレイヤー自身にも一瞬の白フラッシュを入れ、攻撃の手応えを出す（scale/positionは変更しないので
    // しゃがみ演出やArcade物理のvelocity制御と競合しない）
    this.player.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.player.setAngle(facing * -7);
    this.tweens.killTweensOf(this.player);
    this.tweens.add({
      targets: this.player,
      angle: 0,
      duration: Math.max(90, weapon.attackWindowMs),
      ease: "Back.easeOut",
    });
    this.time.delayedCall(50, () => this.player.clearTint());
  }

  /** ↓→X（奥義） / ↓→↓→X（秘奥義）のコマンド成立を判定して発動する */
  private tryTriggerSpecial(time: number): void {
    if (matchesSequence(this.commandBuffer, HIOUGI_COMMAND) && canUseHiougi(this.playerState)) {
      const next = useHiougi(this.playerState, time);
      if (next) {
        this.playerState = next;
        this.commandBuffer = [];
        this.triggerBigAttackEffect(0xffd166, time, HIOUGI_RANGE, HIOUGI_DAMAGE_MULTIPLIER);
      }
      return;
    }
    if (matchesSequence(this.commandBuffer, OUGI_COMMAND) && canUseOugi(this.playerState)) {
      const next = useOugi(this.playerState, time);
      if (next) {
        this.playerState = next;
        this.commandBuffer = [];
        this.triggerBigAttackEffect(0xd9a7ff, time, OUGI_RANGE, OUGI_DAMAGE_MULTIPLIER);
      }
    }
  }

  private triggerBigAttackEffect(color: number, time: number, range: number, multiplier: number): void {
    this.cameras.main.flash(250, (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff);
    this.cameras.main.shake(200, 0.01);
    const burst = this.add.circle(this.player.x, this.player.y - 15, 10, color, 0.5).setDepth(COMBAT_FX_DEPTH);
    this.tweens.add({
      targets: burst,
      radius: range,
      alpha: 0,
      duration: 300,
      onComplete: () => burst.destroy(),
    });
    this.dashAttack(range, WEAPONS[this.playerState.equippedWeapon].damage * multiplier, time);
  }

  /** 奥義・秘奥義発動中の追加判定（コマンド不要で持続する範囲攻撃） */
  private handleSpecialMoves(time: number): void {
    if (isOugiActive(this.playerState, time)) {
      this.dashAttack(OUGI_RANGE, WEAPONS[this.playerState.equippedWeapon].damage * OUGI_DAMAGE_MULTIPLIER, time);
    }
    if (isHiougiActive(this.playerState, time)) {
      this.dashAttack(HIOUGI_RANGE, WEAPONS[this.playerState.equippedWeapon].damage * HIOUGI_DAMAGE_MULTIPLIER, time);
    }
  }

  /** 遠距離武器の飛翔体を発射する */
  private spawnProjectile(): void {
    const sprite = this.physics.add.sprite(this.player.x, this.player.y - 9, "orb").setDepth(COMBAT_FX_DEPTH);
    (sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    sprite.setVelocityX(PROJECTILE_SPEED * this.playerState.facing);
    const projectile: Projectile = {
      sprite,
      spawnX: this.player.x,
      maxRange: WEAPONS.ranged.range,
    };
    this.projectiles.push(projectile);

    for (const enemy of this.enemies) {
      this.physics.add.overlap(sprite, enemy.sprite, () => {
        if (!enemy.state.alive || !sprite.active) return;
        this.applyHit(enemy, WEAPONS.ranged.damage, this.time.now, true);
        sprite.destroy();
      });
    }
  }

  private updateProjectiles(): void {
    this.projectiles = this.projectiles.filter((p) => {
      if (!p.sprite.active) return false;
      if (Math.abs(p.sprite.x - p.spawnX) > p.maxRange) {
        p.sprite.destroy();
        return false;
      }
      return true;
    });
  }

  private updateEnemies(): void {
    this.bossTell.clear();
    this.styleText.setText(
      this.combatStyle === "chain"
        ? `${tr(this.lang, "連撃の型", "Combo Stance")} · ${tr(this.lang, "連続命中", "Hits")} ${this.playerState.comboStreak}`
        : `${tr(this.lang, "居合の型", "Draw Stance")} · ${this.time.now - this.lastStyleHit >= 1200 ? tr(this.lang, "一撃の準備ができた", "Strike Ready") : tr(this.lang, "間合いを取ろう", "Create Distance")}`,
    );
    for (const enemy of this.enemies) {
      if (!enemy.state.alive) {
        if (enemy.sprite.active) {
          enemy.sprite.setActive(false).setVisible(false);
          (enemy.sprite.body as Phaser.Physics.Arcade.Body).enable = false;
        }
        continue;
      }
      const body = enemy.sprite.body as Phaser.Physics.Arcade.Body;
      if (enemy.sprite.x <= enemy.patrolMinX) enemy.dir = 1;
      if (enemy.sprite.x >= enemy.patrolMaxX) enemy.dir = -1;
      if (enemy.boss) {
        const phase = bossPhase(this.time.now - enemy.bornAt);
        if (phase === "tell") {
          if (enemy.lastBossPhase !== "tell")
            enemy.bossDir = this.player.x < enemy.sprite.x ? -1 : 1;
          body.setVelocityX(0);
          this.bossTell
            .lineStyle(4, 0xd65e46, 0.8)
            .lineBetween(
              enemy.sprite.x,
              GROUND_Y - 5,
              enemy.sprite.x + enemy.bossDir * 220,
              GROUND_Y - 5,
            );
          this.bossTell
            .fillStyle(0xf5b96d, 0.8)
            .fillTriangle(
              enemy.sprite.x,
              enemy.sprite.y - 65,
              enemy.sprite.x - 7,
              enemy.sprite.y - 78,
              enemy.sprite.x + 7,
              enemy.sprite.y - 78,
            );
        } else if (phase === "charge") {
          if (enemy.lastBossPhase !== "charge") sfx.bossCharge();
          body.setVelocityX(enemy.bossDir * 330);
        } else body.setVelocityX(0);
        enemy.dir = enemy.bossDir;
        enemy.lastBossPhase = phase;
      } else body.setVelocityX(enemy.dir * 60 * enemy.speedMul);
      enemy.sprite.setFlipX(enemy.dir < 0);
    }
  }

  /**
   * ダメージを適用し、命中していれば演出・撃破処理・ゲージ加算まで行う。
   * 無被弾スーパーコンボの倍率をかけたダメージを敵に通し、敵側の防御力減衰は damageEnemy が担う。
   */
  private applyHit(
    enemy: EnemySprite,
    damage: number,
    time: number,
    grantsGauge: boolean,
  ): void {
    const wasAlive = enemy.state.alive;
    const prevHealth = enemy.state.health;
    const multiplier =
      superComboMultiplier(this.playerState.comboStreak) *
      buffDamageMultiplier(this.playerState, time) *
      styleMultiplier(
        this.combatStyle,
        this.playerState.comboStreak,
        time - this.lastStyleHit,
      );
    enemy.state = damageEnemy(
      enemy.state,
      Math.round(damage * multiplier),
      time,
    );
    if (enemy.state.health === prevHealth) return; // デバウンスで実際には未ヒット

    this.lastStyleHit = time;
    this.playerState = gainComboStreak(this.playerState, 1);
    this.onEnemyHit(enemy);
    if (grantsGauge) {
      this.playerState = gainOugiGauge(this.playerState, OUGI_GAUGE_PER_HIT);
    }
    if (wasAlive && !enemy.state.alive) {
      this.onEnemyKilled(enemy);
    }
  }

  /** 命中時の演出: 白発光・スパーク・短いノックバック */
  private onEnemyHit(enemy: EnemySprite): void {
    sfx.hit();
    const dedicatedArt = Object.values(ENEMY_ART_TEXTURE).includes(enemy.sprite.texture.key);
    enemy.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(80, () => {
      if (dedicatedArt) enemy.sprite.clearTint();
      else enemy.sprite.setTint(ENEMY_TYPE_TINT[enemy.type]).setTintMode(Phaser.TintModes.MULTIPLY);
    });
    const body = enemy.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(this.playerState.facing * 180);

    const sparkColor = enemy.type === "agile" ? 0x63e1e7 : enemy.type === "tank" ? 0xc0a4ff : 0xffd166;
    const hitSprite = this.add
      .image(enemy.sprite.x, enemy.sprite.y - 10, COMBAT_HIT_TEXTURE)
      .setDepth(COMBAT_FX_DEPTH)
      .setTint(sparkColor)
      .setScale(enemy.type === "tank" ? 0.72 : 0.56)
      .setAngle(Phaser.Math.Between(-18, 18));
    this.tweens.add({
      targets: hitSprite,
      alpha: 0,
      scale: hitSprite.scale * 1.55,
      angle: hitSprite.angle + 24,
      duration: 170,
      ease: "Cubic.easeOut",
      onComplete: () => hitSprite.destroy(),
    });
    for (let i = 0; i < 5; i++) {
      const spark = this.add.circle(enemy.sprite.x, enemy.sprite.y - 10, 3 + (i % 2), sparkColor, 0.85).setDepth(COMBAT_FX_DEPTH);
      this.tweens.add({
        targets: spark,
        x: enemy.sprite.x + Phaser.Math.Between(-28, 28),
        y: enemy.sprite.y + Phaser.Math.Between(-42, 18),
        alpha: 0,
        scale: 0.3,
        duration: 180 + i * 18,
        ease: "Cubic.easeOut",
        onComplete: () => spark.destroy(),
      });
    }

    this.tweens.add({
      targets: enemy.sprite,
      scaleX: "*=1.15",
      scaleY: "*=1.15",
      duration: 60,
      yoyo: true,
    });
  }

  private onPlayerTouchEnemy(enemy: EnemySprite): void {
    if (!enemy.state.alive) return;
    const now = this.time.now;
    if (isInvulnerable(this.playerState, now)) return;

    if (this.guarding && this.isFacingTarget(enemy.sprite.x)) {
      // ガードで正面からの接触ダメージを防ぐ。無敵時間は付与しないので連続ガードは可能
      if (now - this.lastGuardBlockAt > 150) {
        this.lastGuardBlockAt = now;
        this.playGuardBlockFx();
      }
      const body = enemy.sprite.body as Phaser.Physics.Arcade.Body;
      body.setVelocityX(-this.playerState.facing * 140);
      return;
    }

    this.playerState = damagePlayer(this.playerState, ENEMY_TOUCH_DAMAGE, now);
    sfx.hurt();
    this.playPlayerDamageFx(enemy.sprite.x);
    this.cameras.main.shake(120, 0.006);
    this.tweens.add({
      targets: this.player,
      alpha: 0.2,
      duration: 80,
      yoyo: true,
      repeat: 4,
    });
  }

  private playPlayerDamageFx(sourceX: number): void {
    const direction = sourceX >= this.player.x ? 1 : -1;
    this.showPlayerActionPose(HERO_HURT_ART_TEXTURE, 280);
    const hitSprite = this.add
      .image(this.player.x + direction * 8, this.player.y - 14, COMBAT_HIT_TEXTURE)
      .setDepth(COMBAT_FX_DEPTH)
      .setTint(0xff5f6d)
      .setFlipX(direction < 0)
      .setScale(0.68);
    this.tweens.add({
      targets: hitSprite,
      alpha: 0,
      scale: 1.05,
      x: hitSprite.x - direction * 14,
      duration: 210,
      ease: "Cubic.easeOut",
      onComplete: () => hitSprite.destroy(),
    });
    const impact = this.add.graphics({ x: this.player.x, y: this.player.y - 12 }).setDepth(COMBAT_FX_DEPTH);
    impact.lineStyle(5, 0xff5f6d, 0.9)
      .lineBetween(-24 * direction, -28, 18 * direction, 18)
      .lineBetween(-14 * direction, -34, 28 * direction, 8);
    impact.lineStyle(2, 0xffffff, 0.85)
      .lineBetween(-21 * direction, -26, 15 * direction, 14);
    const vignette = this.add.rectangle(
      this.cameras.main.midPoint.x,
      this.cameras.main.midPoint.y,
      this.cameras.main.width,
      this.cameras.main.height,
      0x9d1830,
      0.14,
    ).setScrollFactor(0).setDepth(COMBAT_FLASH_DEPTH);
    this.tweens.add({
      targets: impact,
      alpha: 0,
      scale: 1.7,
      duration: 220,
      onComplete: () => impact.destroy(),
    });
    this.tweens.add({
      targets: vignette,
      alpha: 0,
      duration: 240,
      onComplete: () => vignette.destroy(),
    });
  }

  /** プレイヤーが対象の方向を向いているか（ガードが前方からの攻撃のみ防ぐための判定） */
  private isFacingTarget(targetX: number): boolean {
    return (targetX - this.player.x) * this.playerState.facing >= -4;
  }

  private playGuardBlockFx(): void {
    sfx.guard();
    this.cameras.main.flash(80, 255, 209, 102);
    const spark = this.add.circle(this.player.x + this.playerState.facing * 24, this.player.y - 9, 10, 0xffd166, 0.6).setDepth(COMBAT_FX_DEPTH);
    this.tweens.add({ targets: spark, scale: 1.8, alpha: 0, duration: 200, onComplete: () => spark.destroy() });
  }

  private onEnemyKilled(enemy: EnemySprite): void {
    const burstColor = enemy.type === "agile" ? 0x66e6e8 : enemy.type === "tank" ? 0xb69cf4 : 0xffd166;
    this.cameras.main.shake(enemy.boss ? 150 : 70, enemy.boss ? 0.008 : 0.003);
    for (let i = 0; i < (enemy.boss ? 12 : 7); i++) {
      const shard = this.add.rectangle(
        enemy.sprite.x,
        enemy.sprite.y - 10,
        i % 2 ? 7 : 4,
        i % 2 ? 3 : 8,
        burstColor,
        0.9,
      ).setDepth(COMBAT_FX_DEPTH).setAngle(Phaser.Math.Between(0, 180));
      this.tweens.add({
        targets: shard,
        x: enemy.sprite.x + Phaser.Math.Between(-55, 55),
        y: enemy.sprite.y + Phaser.Math.Between(-65, 20),
        angle: shard.angle + Phaser.Math.Between(-140, 140),
        alpha: 0,
        scale: 0.25,
        duration: 260 + i * 14,
        ease: "Quad.easeOut",
        onComplete: () => shard.destroy(),
      });
    }
    this.tweens.add({
      targets: enemy.sprite,
      alpha: 0,
      angle: enemy.sprite.angle + this.playerState.facing * 14,
      scaleX: "*=0.7",
      scaleY: "*=0.7",
      duration: 150,
      ease: "Cubic.easeIn",
    });

    this.playerState = addScore(this.playerState, SCORE_PER_KILL);
    const unlocked = this.playerState.hiougiUnlocked;
    this.playerState = checkHiougiUnlock(this.playerState);
    if (!unlocked && this.playerState.hiougiUnlocked) {
      this.spawnFloatingText(this.player.x, this.player.y - 90, tr(this.lang, "秘奥義解放！", "HI-OUGI UNLOCKED!"), "#ffd166");
      this.cameras.main.flash(400, 255, 209, 102);
    }

    this.waveEnemiesAlive -= 1;
    if (this.waveEnemiesAlive <= 0 && this.waveActive) {
      this.waveActive = false;
      this.spawnFloatingText(this.player.x, this.player.y - 90, `WAVE ${this.wave} CLEAR!`, "#1f8a63");
      sfx.waveClear();
      this.cameras.main.flash(200, 127, 209, 255);
      cg.happytime();
      this.time.delayedCall(WAVE_INTERMISSION_MS, () => {
        if (this.status !== "playing") return; // 死亡直後などは次ウェーブを出さない
        this.wave += 1;
        this.spawnWave(this.wave);
      });
    }
  }

  private checkStatus(): void {
    // GOAL_X相当の到達判定は使わないため goalX に到達不可能な値を渡し、常に playing/gameover のみになる
    this.status = gameStatus(this.playerState, this.player.x, Number.POSITIVE_INFINITY);
    if (this.status === "gameover" && !this.gameOverHandled) {
      this.gameOverHandled = true;
      bgm.stop();
      saveBestWave(window.localStorage as unknown as KVStore, this.wave);
      this.bestWave = Math.max(this.bestWave, this.wave);
      this.statusText.setText("GAME OVER");
      this.restartText.setText(`${tr(this.lang, "到達", "Reached")}: Wave ${this.wave}  ${tr(this.lang, "ベスト", "Best")}: Wave ${this.bestWave}\n${tr(this.lang, "R キーでリトライ", "Press R to Retry")}`);
      this.virtualControls?.setVisible(false);
      this.statusPanel.setVisible(true);
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    }
  }

  /** クリック位置から浮かんで消えるテキスト演出 */
  private spawnFloatingText(x: number, y: number, text: string, color: string): void {
    // 明るい空背景の上でも読めるよう、白フチを付けて可読性を確保する
    const obj = this.add
      .text(x + Phaser.Math.Between(-20, 20), y, text, {
        fontSize: "16px",
        color,
        fontStyle: "700",
        stroke: "#ffffff",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(COMBAT_FX_DEPTH);
    this.tweens.add({
      targets: obj,
      y: y - 50,
      alpha: 0,
      duration: 900,
      onComplete: () => obj.destroy(),
    });
  }

  private refreshHud(): void {
    this.healthText.setText(
      `${"♥".repeat(this.playerState.health)}${"♡".repeat(this.playerState.maxHealth - this.playerState.health)}`,
    );
    this.scoreText.setText(`SCORE ${this.playerState.score}  WAVE ${this.wave}`);
    popOnChange(this, this.weaponText, `${tr(this.lang, "装備", "Weapon")}: ${weaponLabel(this.lang, this.playerState.equippedWeapon)} ${tr(this.lang, "（1/2/3で切替）", "(1/2/3 to switch)")}`);

    const now = this.time.now;
    const cdRemainingSec = Math.max(0, (SKILL_COOLDOWN_MS - (now - this.playerState.lastSkillAt)) / 1000);
    this.skillText.setText(
      cdRemainingSec > 0 ? `${tr(this.lang, "スキル: 準備中", "Skill: Cooldown")} ${cdRemainingSec.toFixed(1)}s` : tr(this.lang, "スキル: 使用可能（C）", "Skill: READY (C)"),
    );
    this.skillText.setColor(canUseSkill(this.playerState, now) ? "#1f8a63" : THEME.textMuted);

    const gaugeRatio = this.playerState.ougiGauge / OUGI_GAUGE_MAX;
    this.gaugeBarFill.width = 216 * gaugeRatio;
    this.gaugeLabel.setText(gaugeRatio >= 1 ? `${tr(this.lang, "奥義", "OUGI")} READY (↓→X)` : `${tr(this.lang, "必殺", "Special")} ${Math.floor(this.playerState.ougiGauge)}%`);
    this.gaugeBarFill.setFillStyle(gaugeRatio >= 1 ? 0xffd166 : 0xd9a7ff);
    this.hiougiHint.setText(this.playerState.hiougiUnlocked ? tr(this.lang, "秘奥義: ↓→↓→X で発動可", "HI-OUGI: ↓→↓→X") : "");

    const multiplier = superComboMultiplier(this.playerState.comboStreak);
    const armorLabel = this.playerState.armorCharges > 0 ? ` 🛡️${this.playerState.armorCharges}` : "";
    const buffLabels = [
      buffDamageMultiplier(this.playerState, now) > 1 ? "💪" : "",
      buffSpeedMultiplier(this.playerState, now) > 1 ? "⚡" : "",
      now < this.playerState.regenUntil ? "💚" : "",
    ]
      .filter(Boolean)
      .join("");
    this.comboText.setText(
      `${tr(this.lang, "コンボ", "Combo")} ${this.playerState.comboStreak}${multiplier > 1 ? ` ×${multiplier.toFixed(1)}` : ""}${armorLabel}${
        buffLabels ? ` ${buffLabels}` : ""
      }`,
    );
    this.comboText.setColor(multiplier > 1 ? "#c98a12" : THEME.textMuted);

    this.itemsText.setText(
      this.itemKeys
        .map(({ itemId, label }) => `${label}:${itemName(this.lang, itemId, findItemDef(itemId)?.name ?? itemId)}×${this.items[itemId] ?? 0}`)
        .join(" "),
    );
  }

  private chooseCombatStyle(): void {
    this.styleChoosing = true;
    this.physics.pause();
    const group = this.add.container(0, 0).setScrollFactor(0).setDepth(250);
    const shade = this.add
      .rectangle(400, 300, 800, 600, 0x102025, 0.8)
      .setInteractive();
    const title = this.add
      .text(400, 170, tr(this.lang, "今回の剣を、どう振るう？", "How will you wield your blade?"), {
        fontSize: "28px",
        color: "#fff0cc",
      })
      .setOrigin(0.5);
    group.add([shade, title]);
    (["chain", "draw"] as const).forEach((style, i) => {
      const x = 235 + i * 330;
      const panel = drawPanel(this, x, 320, 300, 190, {
        fillColor: i === 0 ? 0x234d55 : 0x503743,
        borderColor: 0xe1bf78,
        fillAlpha: 1,
      });
      const label = this.add
        .text(
          x,
          292,
          style === "chain"
            ? tr(this.lang, "連撃の型\n連続命中で最大 +60%", "Combo Stance\nChain hits for up to +60%")
            : tr(this.lang, "居合の型\n1.2秒間、命中なしで次撃 +90%", "Draw Stance\nNo hit for 1.2s: next strike +90%"),
          {
            fontSize: "18px",
            color: "#fff0d5",
            align: "center",
            lineSpacing: 18,
            wordWrap: { width: 268, useAdvancedWrap: true },
          },
        )
        .setOrigin(0.5);
      const tip = this.add
        .text(
          x,
          380,
          style === "chain"
            ? tr(this.lang, "攻めをつないで、押し切る", "Keep pressure and overwhelm them")
            : tr(this.lang, "間合いを取り、一撃を通す", "Create space and land one decisive strike"),
          { fontSize: "14px", color: "#e7d4b3" },
        )
        .setOrigin(0.5);
      const hit = this.add
        .zone(x, 320, 300, 190)
        .setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => {
        this.combatStyle = style;
        this.styleChoosing = false;
        group.destroy(true);
        this.physics.resume();
      });
      group.add([panel, label, tip, hit]);
    });
  }

}

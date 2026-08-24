import Phaser from "phaser";
import {
  currentWeapon,
  ENEMY_TOUCH_DAMAGE,
  EnemyState,
  Facing,
  GameStatus,
  HIOUGI_DAMAGE_MULTIPLIER,
  HIOUGI_RANGE,
  OUGI_DAMAGE_MULTIPLIER,
  OUGI_GAUGE_MAX,
  OUGI_GAUGE_PER_HIT,
  OUGI_RANGE,
  PlayerState,
  SCORE_PER_KILL,
  SKILL_COOLDOWN_MS,
  SKILL_DAMAGE_MULTIPLIER,
  SKILL_RANGE,
  WEAPONS,
  WeaponKind,
  addScore,
  canUseHiougi,
  canUseOugi,
  canUseSkill,
  checkHiougiUnlock,
  damageEnemy,
  damagePlayer,
  gainOugiGauge,
  gameStatus,
  inAttackRange,
  isAttacking,
  isHiougiActive,
  isInvulnerable,
  isOugiActive,
  newEnemy,
  newPlayer,
  startAttack,
  switchWeapon,
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

const GROUND_Y = 520;
const GOAL_X = 3200;
const MOVE_SPEED = 220;
const JUMP_VELOCITY = -520;
/** 攻撃判定の縦方向の許容差。異なる高さの足場にいる敵を誤って巻き込まないための上限 */
const ATTACK_RANGE_Y = 44;
const PROJECTILE_SPEED = 640;

interface EnemySprite {
  state: EnemyState;
  sprite: Phaser.Physics.Arcade.Sprite;
  patrolMinX: number;
  patrolMaxX: number;
  dir: 1 | -1;
}

interface Projectile {
  sprite: Phaser.Physics.Arcade.Sprite;
  spawnX: number;
  maxRange: number;
}

const WEAPON_KEY_BINDINGS: { code: number; kind: WeaponKind }[] = [
  { code: Phaser.Input.Keyboard.KeyCodes.ONE, kind: "melee" },
  { code: Phaser.Input.Keyboard.KeyCodes.TWO, kind: "mid" },
  { code: Phaser.Input.Keyboard.KeyCodes.THREE, kind: "ranged" },
];

const WEAPON_LABEL: Record<WeaponKind, string> = {
  melee: "近接",
  mid: "中距離",
  ranged: "遠距離",
};

/** 剣戟の森 — 横スクロールアクションのメインシーン */
export class GameScene extends Phaser.Scene {
  private playerState: PlayerState = newPlayer();
  private status: GameStatus = "playing";

  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private attackKey!: Phaser.Input.Keyboard.Key;
  private skillKey!: Phaser.Input.Keyboard.Key;
  private tipsKey!: Phaser.Input.Keyboard.Key;
  private restartKey!: Phaser.Input.Keyboard.Key;
  private weaponKeys: { key: Phaser.Input.Keyboard.Key; kind: WeaponKind }[] = [];
  private swordSlash!: Phaser.GameObjects.Rectangle;

  private enemies: EnemySprite[] = [];
  private projectiles: Projectile[] = [];
  private platforms!: Phaser.Physics.Arcade.StaticGroup;

  private healthText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private weaponText!: Phaser.GameObjects.Text;
  private skillText!: Phaser.GameObjects.Text;
  private gaugeBarBg!: Phaser.GameObjects.Rectangle;
  private gaugeBarFill!: Phaser.GameObjects.Rectangle;
  private gaugeLabel!: Phaser.GameObjects.Text;
  private hiougiHint!: Phaser.GameObjects.Text;
  private tipsHint!: Phaser.GameObjects.Text;

  private statusPanel!: Phaser.GameObjects.Rectangle;
  private statusText!: Phaser.GameObjects.Text;
  private restartText!: Phaser.GameObjects.Text;

  private tipsOverlay?: Phaser.GameObjects.Container;
  private tipsVisible = false;

  private commandBuffer: CommandEvent[] = [];

  constructor() {
    super("game");
  }

  create(): void {
    this.playerState = newPlayer();
    this.status = "playing";
    this.enemies = [];
    this.projectiles = [];
    this.commandBuffer = [];
    this.tipsVisible = false;

    this.physics.world.setBounds(0, 0, GOAL_X + 400, 600);
    this.cameras.main.setBounds(0, 0, GOAL_X + 400, 600);

    this.generateTextures();
    this.buildLevel();
    this.buildPlayer();
    this.buildEnemies();
    this.buildHud();
    this.buildTipsOverlay();

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.fadeIn(200);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.attackKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.skillKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    this.tipsKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.restartKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.weaponKeys = WEAPON_KEY_BINDINGS.map(({ code, kind }) => ({
      key: this.input.keyboard!.addKey(code),
      kind,
    }));
  }

  /**
   * キャラクター・地形用のスプライトをすべてその場で生成する（画像アセット不要）。
   * プレイヤーと敵は頭・胴・剣を持つ簡易シルエットにして、ただの矩形から一段引き上げる。
   */
  private generateTextures(): void {
    this.drawHumanoidTexture("hero", 0x4ecca3, 0x2f7d64);
    this.drawHumanoidTexture("goblin", 0xff6b6b, 0xa63c3c);

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
  }

  /** 頭+胴+腕(剣)からなる簡易ヒューマノイドのテクスチャを生成 */
  private drawHumanoidTexture(key: string, mainColor: number, shadeColor: number): void {
    const w = 30;
    const h = 42;
    const gfx = this.make.graphics({ x: 0, y: 0 }, false);

    // 影
    gfx.fillStyle(0x000000, 0.25);
    gfx.fillEllipse(w / 2, h - 3, 20, 6);

    // 胴体
    gfx.fillStyle(mainColor, 1);
    gfx.fillRoundedRect(6, 16, 18, 22, 4);

    // 頭
    gfx.fillStyle(0xffe0bd, 1);
    gfx.fillCircle(w / 2, 10, 9);

    // 髪/兜（キャラの見分けをつけるための帯）
    gfx.fillStyle(shadeColor, 1);
    gfx.fillRoundedRect(4, 12, 22, 6, 3);

    // 目
    gfx.fillStyle(0x1a1a1a, 1);
    gfx.fillCircle(w / 2 + 3, 10, 1.6);

    // 腕（剣を握る側）
    gfx.fillStyle(shadeColor, 1);
    gfx.fillRoundedRect(20, 20, 6, 14, 3);

    // 脚
    gfx.fillStyle(shadeColor, 1);
    gfx.fillRoundedRect(8, 36, 6, 6, 2);
    gfx.fillRoundedRect(16, 36, 6, 6, 2);

    gfx.generateTexture(key, w, h);
    gfx.destroy();
  }

  private buildLevel(): void {
    this.add.rectangle(GOAL_X / 2, 300, GOAL_X + 400, 600, 0x14142a);

    this.platforms = this.physics.add.staticGroup();
    for (let x = 0; x < GOAL_X + 400; x += 64) {
      this.platforms.create(x + 32, GROUND_Y + 32, "solid").setVisible(false);
    }
    this.add.rectangle((GOAL_X + 400) / 2, GROUND_Y + 32, GOAL_X + 400, 64, 0x2a2a4a);
    this.add.rectangle((GOAL_X + 400) / 2, GROUND_Y, GOAL_X + 400, 4, 0x3f6f5c);

    const floatingPlatforms = [
      { x: 500, y: 400 },
      { x: 900, y: 340 },
      { x: 1400, y: 420 },
      { x: 1900, y: 360 },
      { x: 2400, y: 420 },
      { x: 2800, y: 340 },
    ];
    for (const p of floatingPlatforms) {
      const rect = this.add.rectangle(p.x, p.y, 140, 20, 0x3a3a5a);
      rect.setStrokeStyle(2, 0x54547a);
      rect.setDepth(1);
      this.platforms
        .create(p.x, p.y, "solid")
        .setDisplaySize(140, 20)
        .setSize(140, 20)
        .setVisible(false);
    }

    this.platforms.refresh();

    this.add.rectangle(GOAL_X, GROUND_Y - 60, 6, 120, 0xcccccc);
    this.add.triangle(GOAL_X + 3, GROUND_Y - 100, 0, 0, 36, 10, 0, 20, 0xffd166).setOrigin(0, 0.5);
    this.add
      .text(GOAL_X, GROUND_Y - 140, "GOAL", { fontSize: "20px", color: "#ffd166" })
      .setOrigin(0.5);
  }

  private buildPlayer(): void {
    this.player = this.physics.add.sprite(80, GROUND_Y - 40, "hero");
    this.player.setCollideWorldBounds(true);
    this.player.setSize(18, 32).setOffset(6, 8);
    this.physics.add.collider(this.player, this.platforms);

    this.swordSlash = this.add.rectangle(0, 0, WEAPONS.mid.range, 14, 0xffffff, 0);
  }

  private buildEnemies(): void {
    const enemyXs = [420, 780, 1150, 1550, 2000, 2350, 2700, 3050];
    enemyXs.forEach((x, i) => {
      const sprite = this.physics.add.sprite(x, GROUND_Y - 30, "goblin");
      sprite.setCollideWorldBounds(true);
      sprite.setSize(18, 30).setOffset(6, 10);
      this.physics.add.collider(sprite, this.platforms);

      const enemy: EnemySprite = {
        state: newEnemy(`enemy-${i}`, 2),
        sprite,
        patrolMinX: x - 80,
        patrolMaxX: x + 80,
        dir: 1,
      };
      this.enemies.push(enemy);

      // すり抜けず物理的にぶつかるようにする（overlap のみだと敵の体を通り抜けてしまい、
      // 剣の間合いに留まれず「当たらない」と感じる原因になっていた）
      this.physics.add.collider(this.player, sprite, () => this.onPlayerTouchEnemy(enemy));
    });
  }

  private buildHud(): void {
    this.add.rectangle(130, 46, 240, 80, 0x14142a, 0.7).setScrollFactor(0).setOrigin(0.5);
    this.healthText = this.add
      .text(16, 12, "", { fontSize: "18px", color: "#ff6b8a" })
      .setScrollFactor(0);
    this.scoreText = this.add
      .text(16, 34, "", { fontSize: "14px", color: "#ffd166" })
      .setScrollFactor(0);
    this.weaponText = this.add
      .text(16, 54, "", { fontSize: "13px", color: "#7fd1ff" })
      .setScrollFactor(0);
    this.skillText = this.add
      .text(16, 72, "", { fontSize: "12px", color: "#aaaacc" })
      .setScrollFactor(0);

    this.gaugeBarBg = this.add
      .rectangle(660, 20, 220, 16, 0x2a2a4a)
      .setStrokeStyle(1, 0x54547a)
      .setScrollFactor(0);
    this.gaugeBarFill = this.add
      .rectangle(660 - 108, 20, 0, 12, 0xd9a7ff)
      .setOrigin(0, 0.5)
      .setScrollFactor(0);
    this.gaugeLabel = this.add
      .text(660, 20, "", { fontSize: "11px", color: "#ffffff" })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.hiougiHint = this.add
      .text(660, 38, "", { fontSize: "11px", color: "#ffd166" })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.tipsHint = this.add
      .text(400, 748, "Enterキーで操作方法を表示", { fontSize: "12px", color: "#666688" })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.statusPanel = this.add
      .rectangle(400, 300, 360, 140, 0x1e1e38, 0.92)
      .setStrokeStyle(2, 0x7b2cbf)
      .setScrollFactor(0)
      .setVisible(false);
    this.statusText = this.add
      .text(400, 280, "", { fontSize: "34px", color: "#ffffff", align: "center" })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.restartText = this.add
      .text(400, 325, "", { fontSize: "14px", color: "#aaaacc", align: "center" })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.refreshHud();
  }

  private buildTipsOverlay(): void {
    const overlay = this.add.container(0, 0).setScrollFactor(0).setDepth(100).setVisible(false);
    const bg = this.add.rectangle(400, 380, 800, 760, 0x000000, 0.75).setInteractive();
    const panel = this.add
      .rectangle(400, 380, 560, 480, 0x1e1e38)
      .setStrokeStyle(2, 0x7b2cbf);
    const title = this.add
      .text(400, 170, "操作方法", { fontSize: "24px", color: "#ffffff" })
      .setOrigin(0.5);
    const body = this.add
      .text(
        400,
        380,
        [
          "← → : 移動　　↑ : ジャンプ",
          "X : 通常攻撃（装備中の武器で攻撃）",
          "1 / 2 / 3 : 武器切替（近接／中距離／遠距離）",
          "C : スキル発動（クールダウンあり）",
          "",
          "必殺ゲージが満タンの時：",
          "↓ → X の順に入力で【奥義】発動",
          "",
          "秘奥義解放後、ゲージ満タンの時：",
          "↓ → ↓ → X の順に入力で【秘奥義】発動",
          "",
          "R : ゲームオーバー／クリア後にリトライ",
        ].join("\n"),
        { fontSize: "15px", color: "#e0e0ff", align: "center", lineSpacing: 8 },
      )
      .setOrigin(0.5);
    const closeHint = this.add
      .text(400, 590, "Enter でとじる", { fontSize: "13px", color: "#aaaacc" })
      .setOrigin(0.5);
    overlay.add([bg, panel, title, body, closeHint]);
    this.tipsOverlay = overlay;
  }

  private toggleTips(): void {
    this.tipsVisible = !this.tipsVisible;
    this.tipsOverlay?.setVisible(this.tipsVisible);
  }

  update(time: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.tipsKey)) {
      this.toggleTips();
    }
    if (this.tipsVisible) return; // TIPS表示中は操作を止める

    if (this.status !== "playing") {
      if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
        this.scene.restart();
      }
      return;
    }

    this.handleMovement();
    this.handleWeaponSwitch();
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
    let vx = 0;
    if (this.cursors.left.isDown) {
      vx = -MOVE_SPEED;
      this.playerState = { ...this.playerState, facing: -1 as Facing };
      this.player.setFlipX(true);
    } else if (this.cursors.right.isDown) {
      vx = MOVE_SPEED;
      this.playerState = { ...this.playerState, facing: 1 as Facing };
      this.player.setFlipX(false);
    }
    body.setVelocityX(vx);

    if (this.cursors.up.isDown && body.blocked.down) {
      body.setVelocityY(JUMP_VELOCITY);
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

  private pushCommand(token: CommandToken, time: number): void {
    this.commandBuffer = pushCommandEvent(this.commandBuffer, token, time);
  }

  private handleWeaponSwitch(): void {
    for (const { key, kind } of this.weaponKeys) {
      if (Phaser.Input.Keyboard.JustDown(key) && this.playerState.equippedWeapon !== kind) {
        this.playerState = switchWeapon(this.playerState, kind);
        this.spawnFloatingText(this.player.x, this.player.y - 40, WEAPON_LABEL[kind], "#7fd1ff");
      }
    }
  }

  private handleSkill(time: number): void {
    if (!Phaser.Input.Keyboard.JustDown(this.skillKey)) return;
    const next = useSkill(this.playerState, time);
    if (!next) return;
    this.playerState = next;
    this.cameras.main.flash(150, 127, 209, 255);
    this.dashAttack(SKILL_RANGE, WEAPONS[this.playerState.equippedWeapon].damage * SKILL_DAMAGE_MULTIPLIER, time);
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
    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) {
      this.pushCommand("attack", time);
      this.tryTriggerSpecial(time);

      const next = startAttack(this.playerState, time);
      if (next) {
        this.playerState = next;
        if (currentWeapon(this.playerState).projectile) {
          this.spawnProjectile();
        }
      }
    }

    const weapon = currentWeapon(this.playerState);
    const attacking = isAttacking(this.playerState, time);
    this.swordSlash.setPosition(
      this.player.x + this.playerState.facing * weapon.range * 0.5,
      this.player.y - 4,
    );
    this.swordSlash.setDisplaySize(weapon.range, 14);
    this.swordSlash.setFillStyle(0xffffff, attacking && !weapon.projectile ? 0.4 : 0);
    this.swordSlash.setScale(this.playerState.facing === -1 ? -1 : 1, 1);

    if (!attacking || weapon.projectile) return;
    for (const enemy of this.enemies) {
      if (!enemy.state.alive) continue;
      if (Math.abs(enemy.sprite.y - this.player.y) > ATTACK_RANGE_Y) continue;
      if (!inAttackRange(this.player.x, this.playerState.facing, enemy.sprite.x, weapon.range)) continue;
      this.applyHit(enemy, weapon.damage, time, true);
    }
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
    const burst = this.add.circle(this.player.x, this.player.y - 10, 10, color, 0.5);
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
    const sprite = this.physics.add.sprite(this.player.x, this.player.y - 6, "orb");
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
      body.setVelocityX(enemy.dir * 60);
      enemy.sprite.setFlipX(enemy.dir < 0);
    }
  }

  /** ダメージを適用し、命中していれば演出・撃破処理・ゲージ加算まで行う */
  private applyHit(enemy: EnemySprite, damage: number, time: number, grantsGauge: boolean): void {
    const wasAlive = enemy.state.alive;
    const prevHealth = enemy.state.health;
    enemy.state = damageEnemy(enemy.state, damage, time);
    if (enemy.state.health === prevHealth) return; // デバウンスで実際には未ヒット

    this.onEnemyHit(enemy);
    if (grantsGauge) {
      this.playerState = gainOugiGauge(this.playerState, OUGI_GAUGE_PER_HIT);
    }
    if (wasAlive && !enemy.state.alive) {
      this.onEnemyKilled(enemy);
    }
  }

  /** 命中時の演出: 敵を白く発光させてノックバックさせる */
  private onEnemyHit(enemy: EnemySprite): void {
    enemy.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(80, () => {
      enemy.sprite.clearTint();
      enemy.sprite.setTintMode(Phaser.TintModes.MULTIPLY);
    });
    const body = enemy.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(this.playerState.facing * 180);
    this.tweens.add({ targets: enemy.sprite, scale: 1.15, duration: 60, yoyo: true });
  }

  private onPlayerTouchEnemy(enemy: EnemySprite): void {
    if (!enemy.state.alive) return;
    const now = this.time.now;
    if (isInvulnerable(this.playerState, now)) return;
    this.playerState = damagePlayer(this.playerState, ENEMY_TOUCH_DAMAGE, now);
    this.cameras.main.shake(120, 0.006);
    this.tweens.add({
      targets: this.player,
      alpha: 0.2,
      duration: 80,
      yoyo: true,
      repeat: 4,
    });
  }

  private onEnemyKilled(_enemy: EnemySprite): void {
    this.playerState = addScore(this.playerState, SCORE_PER_KILL);
    const unlocked = this.playerState.hiougiUnlocked;
    this.playerState = checkHiougiUnlock(this.playerState);
    if (!unlocked && this.playerState.hiougiUnlocked) {
      this.spawnFloatingText(this.player.x, this.player.y - 60, "秘奥義解放！", "#ffd166");
      this.cameras.main.flash(400, 255, 209, 102);
    }
  }

  private checkStatus(): void {
    this.status = gameStatus(this.playerState, this.player.x, GOAL_X);
    if (this.status === "cleared") {
      this.statusText.setText("CLEAR!");
      this.restartText.setText("R キーでもう一度遊ぶ");
      this.statusPanel.setVisible(true);
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    } else if (this.status === "gameover") {
      this.statusText.setText("GAME OVER");
      this.restartText.setText("R キーでリトライ");
      this.statusPanel.setVisible(true);
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
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
      duration: 900,
      onComplete: () => obj.destroy(),
    });
  }

  private refreshHud(): void {
    this.healthText.setText(
      `${"♥".repeat(this.playerState.health)}${"♡".repeat(this.playerState.maxHealth - this.playerState.health)}`,
    );
    this.scoreText.setText(`SCORE ${this.playerState.score}`);
    this.weaponText.setText(`装備: ${WEAPON_LABEL[this.playerState.equippedWeapon]}（1/2/3で切替）`);

    const now = this.time.now;
    const cdRemainingSec = Math.max(0, (SKILL_COOLDOWN_MS - (now - this.playerState.lastSkillAt)) / 1000);
    this.skillText.setText(
      cdRemainingSec > 0 ? `スキル: 準備中 ${cdRemainingSec.toFixed(1)}s` : "スキル: 使用可能（C）",
    );
    this.skillText.setColor(canUseSkill(this.playerState, now) ? "#7fffb0" : "#aaaacc");

    const gaugeRatio = this.playerState.ougiGauge / OUGI_GAUGE_MAX;
    this.gaugeBarFill.width = 216 * gaugeRatio;
    this.gaugeLabel.setText(gaugeRatio >= 1 ? "奥義 READY (↓→X)" : `必殺 ${Math.floor(this.playerState.ougiGauge)}%`);
    this.gaugeBarFill.setFillStyle(gaugeRatio >= 1 ? 0xffd166 : 0xd9a7ff);
    this.hiougiHint.setText(this.playerState.hiougiUnlocked ? "秘奥義: ↓→↓→X で発動可" : "");
  }
}

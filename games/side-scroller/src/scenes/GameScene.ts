import Phaser from "phaser";
import {
  ATTACK_RANGE,
  ENEMY_TOUCH_DAMAGE,
  EnemyState,
  Facing,
  GameStatus,
  PlayerState,
  SCORE_PER_KILL,
  addScore,
  damageEnemy,
  damagePlayer,
  gameStatus,
  inAttackRange,
  isAttacking,
  isInvulnerable,
  newEnemy,
  newPlayer,
  startAttack,
} from "../logic/combat";

const GROUND_Y = 520;
const GOAL_X = 3200;
const MOVE_SPEED = 220;
const JUMP_VELOCITY = -520;

interface EnemySprite {
  state: EnemyState;
  sprite: Phaser.Physics.Arcade.Sprite;
  patrolMinX: number;
  patrolMaxX: number;
  dir: 1 | -1;
}

/** 剣戟の森 — 横スクロールアクションのメインシーン */
export class GameScene extends Phaser.Scene {
  private playerState: PlayerState = newPlayer();
  private status: GameStatus = "playing";

  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private attackKey!: Phaser.Input.Keyboard.Key;
  private swordHitbox!: Phaser.GameObjects.Rectangle;

  private enemies: EnemySprite[] = [];
  private platforms!: Phaser.Physics.Arcade.StaticGroup;

  private healthText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super("game");
  }

  create(): void {
    this.physics.world.setBounds(0, 0, GOAL_X + 400, 600);
    this.cameras.main.setBounds(0, 0, GOAL_X + 400, 600);

    this.generateTextures();
    this.buildLevel();
    this.buildPlayer();
    this.buildEnemies();
    this.buildHud();

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.attackKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);
  }

  /** スプライト用の単色矩形テクスチャをその場で生成する（画像アセット不要） */
  private generateTextures(): void {
    const gfx = this.make.graphics({ x: 0, y: 0 }, false);
    gfx.fillStyle(0xffffff, 1);
    gfx.fillRect(0, 0, 28, 40);
    gfx.generateTexture("actor-white", 28, 40);
    gfx.destroy();
  }

  private buildLevel(): void {
    this.add.rectangle(GOAL_X / 2, 300, GOAL_X + 400, 600, 0x14142a);

    this.platforms = this.physics.add.staticGroup();
    // 地面（複数タイルで敷き詰め）
    for (let x = 0; x < GOAL_X + 400; x += 64) {
      this.platforms
        .create(x + 32, GROUND_Y + 32, "actor-white")
        .setSize(64, 64)
        .setVisible(false);
    }
    this.add.rectangle((GOAL_X + 400) / 2, GROUND_Y + 32, GOAL_X + 400, 64, 0x2a2a4a);

    // 浮遊足場をいくつか配置
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
      this.platforms.create(p.x, p.y, "actor-white").setSize(140, 20).setVisible(false);
      rect.setDepth(1);
    }

    // 静的ボディのサイズ変更を物理エンジンに反映
    this.platforms.refresh();

    // ゴール旗
    this.add.rectangle(GOAL_X, GROUND_Y - 60, 12, 120, 0xffd166);
    this.add
      .text(GOAL_X, GROUND_Y - 140, "GOAL", { fontSize: "20px", color: "#ffd166" })
      .setOrigin(0.5);
  }

  private buildPlayer(): void {
    this.player = this.physics.add.sprite(80, GROUND_Y - 40, "actor-white");
    this.player.setDisplaySize(28, 40);
    this.player.setTint(0x4ecca3);
    this.player.setCollideWorldBounds(true);
    this.player.setSize(24, 36);
    this.physics.add.collider(this.player, this.platforms);

    this.swordHitbox = this.add.rectangle(0, 0, ATTACK_RANGE, 30, 0xffffff, 0);
  }

  private buildEnemies(): void {
    const enemyXs = [420, 780, 1150, 1550, 2000, 2350, 2700, 3050];
    enemyXs.forEach((x, i) => {
      const sprite = this.physics.add.sprite(x, GROUND_Y - 30, "actor-white");
      sprite.setDisplaySize(26, 34);
      sprite.setTint(0xff6b6b);
      sprite.setCollideWorldBounds(true);
      sprite.setSize(22, 30);
      this.physics.add.collider(sprite, this.platforms);

      const enemy: EnemySprite = {
        state: newEnemy(`enemy-${i}`, 2),
        sprite,
        patrolMinX: x - 80,
        patrolMaxX: x + 80,
        dir: 1,
      };
      this.enemies.push(enemy);

      this.physics.add.overlap(this.player, sprite, () => this.onPlayerTouchEnemy(enemy));
    });
  }

  private buildHud(): void {
    this.healthText = this.add
      .text(16, 16, "", { fontSize: "18px", color: "#e0e0ff" })
      .setScrollFactor(0);
    this.scoreText = this.add
      .text(16, 40, "", { fontSize: "16px", color: "#ffd166" })
      .setScrollFactor(0);
    this.statusText = this.add
      .text(400, 300, "", { fontSize: "36px", color: "#ffffff", align: "center" })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.refreshHud();
  }

  update(time: number): void {
    if (this.status !== "playing") return;

    this.handleMovement();
    this.handleAttack(time);
    this.updateEnemies();
    this.checkStatus();
    this.refreshHud();
  }

  private handleMovement(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    let vx = 0;
    if (this.cursors.left.isDown) {
      vx = -MOVE_SPEED;
      this.playerState = { ...this.playerState, facing: -1 as Facing };
    } else if (this.cursors.right.isDown) {
      vx = MOVE_SPEED;
      this.playerState = { ...this.playerState, facing: 1 as Facing };
    }
    body.setVelocityX(vx);

    if (this.cursors.up.isDown && body.blocked.down) {
      body.setVelocityY(JUMP_VELOCITY);
    }
  }

  private handleAttack(time: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) {
      const next = startAttack(this.playerState, time);
      if (next) this.playerState = next;
    }

    const attacking = isAttacking(this.playerState, time);
    this.swordHitbox.setPosition(
      this.player.x + this.playerState.facing * ATTACK_RANGE * 0.5,
      this.player.y,
    );
    this.swordHitbox.setFillStyle(0xffffff, attacking ? 0.35 : 0);

    if (!attacking) return;
    for (const enemy of this.enemies) {
      if (!enemy.state.alive) continue;
      if (!inAttackRange(this.player.x, this.playerState.facing, enemy.sprite.x)) continue;
      const before = enemy.state.alive;
      enemy.state = damageEnemy(enemy.state, 1, time);
      if (before && !enemy.state.alive) {
        this.onEnemyKilled(enemy);
      }
    }
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
    }
  }

  private onPlayerTouchEnemy(enemy: EnemySprite): void {
    if (!enemy.state.alive) return;
    const now = this.time.now;
    if (isInvulnerable(this.playerState, now)) return;
    this.playerState = damagePlayer(this.playerState, ENEMY_TOUCH_DAMAGE, now);
    this.cameras.main.shake(120, 0.005);
  }

  private onEnemyKilled(_enemy: EnemySprite): void {
    this.playerState = addScore(this.playerState, SCORE_PER_KILL);
  }

  private checkStatus(): void {
    this.status = gameStatus(this.playerState, this.player.x, GOAL_X);
    if (this.status === "cleared") {
      this.statusText.setText("CLEAR!");
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    } else if (this.status === "gameover") {
      this.statusText.setText("GAME OVER");
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    }
  }

  private refreshHud(): void {
    this.healthText.setText(`HP: ${"❤".repeat(this.playerState.health)}${"🖤".repeat(this.playerState.maxHealth - this.playerState.health)}`);
    this.scoreText.setText(`SCORE: ${this.playerState.score}`);
  }
}

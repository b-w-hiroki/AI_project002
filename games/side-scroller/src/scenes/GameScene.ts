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
/** 攻撃判定の縦方向の許容差。異なる高さの足場にいる敵を誤って巻き込まないための上限 */
const ATTACK_RANGE_Y = 44;

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
  private restartKey!: Phaser.Input.Keyboard.Key;
  private swordSlash!: Phaser.GameObjects.Rectangle;

  private enemies: EnemySprite[] = [];
  private platforms!: Phaser.Physics.Arcade.StaticGroup;

  private healthText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private statusPanel!: Phaser.GameObjects.Rectangle;
  private statusText!: Phaser.GameObjects.Text;
  private restartText!: Phaser.GameObjects.Text;

  constructor() {
    super("game");
  }

  create(): void {
    this.playerState = newPlayer();
    this.status = "playing";
    this.enemies = [];

    this.physics.world.setBounds(0, 0, GOAL_X + 400, 600);
    this.cameras.main.setBounds(0, 0, GOAL_X + 400, 600);

    this.generateTextures();
    this.buildLevel();
    this.buildPlayer();
    this.buildEnemies();
    this.buildHud();

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.fadeIn(200);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.attackKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.restartKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);
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
    slash.fillRoundedRect(0, 0, ATTACK_RANGE, 14, 7);
    slash.generateTexture("slash", ATTACK_RANGE, 14);
    slash.destroy();
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

    this.swordSlash = this.add.rectangle(0, 0, ATTACK_RANGE, 14, 0xffffff, 0);
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
    this.add.rectangle(110, 28, 200, 44, 0x14142a, 0.7).setScrollFactor(0).setOrigin(0.5);
    this.healthText = this.add
      .text(16, 12, "", { fontSize: "18px", color: "#ff6b8a" })
      .setScrollFactor(0);
    this.scoreText = this.add
      .text(16, 34, "", { fontSize: "14px", color: "#ffd166" })
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

  update(time: number): void {
    if (this.status !== "playing") {
      if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
        this.scene.restart();
      }
      return;
    }

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
  }

  private handleAttack(time: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) {
      const next = startAttack(this.playerState, time);
      if (next) this.playerState = next;
    }

    const attacking = isAttacking(this.playerState, time);
    this.swordSlash.setPosition(
      this.player.x + this.playerState.facing * ATTACK_RANGE * 0.5,
      this.player.y - 4,
    );
    this.swordSlash.setFillStyle(0xffffff, attacking ? 0.4 : 0);
    this.swordSlash.setScale(this.playerState.facing === -1 ? -1 : 1, 1);

    if (!attacking) return;
    for (const enemy of this.enemies) {
      if (!enemy.state.alive) continue;
      if (Math.abs(enemy.sprite.y - this.player.y) > ATTACK_RANGE_Y) continue;
      if (!inAttackRange(this.player.x, this.playerState.facing, enemy.sprite.x)) continue;

      const wasAlive = enemy.state.alive;
      const prevHealth = enemy.state.health;
      enemy.state = damageEnemy(enemy.state, 1, time);
      if (enemy.state.health === prevHealth) continue; // デバウンスで実際には未ヒット

      this.onEnemyHit(enemy);
      if (wasAlive && !enemy.state.alive) {
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
      enemy.sprite.setFlipX(enemy.dir < 0);
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

  private refreshHud(): void {
    this.healthText.setText(
      `${"♥".repeat(this.playerState.health)}${"♡".repeat(this.playerState.maxHealth - this.playerState.health)}`,
    );
    this.scoreText.setText(`SCORE ${this.playerState.score}`);
  }
}

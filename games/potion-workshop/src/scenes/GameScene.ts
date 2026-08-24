import Phaser from "phaser";
import { clampToBounds, PLAYER_SPEED } from "../logic/movement";

/**
 * 動作確認用の最小シーン:
 * カーソルキーで四角いプレイヤーを動かせる。
 */
export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor() {
    super("game");
  }

  create(): void {
    this.add
      .text(400, 40, "AI_project002 — 雛形動作確認", {
        fontSize: "24px",
        color: "#e0e0ff",
      })
      .setOrigin(0.5);

    this.player = this.add.rectangle(400, 300, 40, 40, 0x4ecca3);
    this.cursors = this.input.keyboard!.createCursorKeys();
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown) dx -= PLAYER_SPEED * dt;
    if (this.cursors.right.isDown) dx += PLAYER_SPEED * dt;
    if (this.cursors.up.isDown) dy -= PLAYER_SPEED * dt;
    if (this.cursors.down.isDown) dy += PLAYER_SPEED * dt;

    const next = clampToBounds(
      { x: this.player.x + dx, y: this.player.y + dy },
      { width: 800, height: 600, margin: 20 },
    );
    this.player.setPosition(next.x, next.y);
  }
}

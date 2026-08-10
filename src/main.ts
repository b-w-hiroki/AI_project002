import Phaser from "phaser";
import { initCrazyGames } from "./platform/crazygames";
import { IdleScene } from "./scenes/IdleScene";

// CrazyGames ポータル上でのみ SDK が有効化される（他環境では no-op）
void initCrazyGames();

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 800,
  height: 600,
  backgroundColor: "#1a1a2e",
  physics: {
    default: "arcade",
    arcade: { gravity: { x: 0, y: 0 } },
  },
  scene: [IdleScene],
});

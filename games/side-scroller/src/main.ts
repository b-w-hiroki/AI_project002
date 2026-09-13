import Phaser from "phaser";
import { installResponsiveGame } from "../../shared/mobile";
import { initCrazyGames } from "./platform/crazygames";
import { installSideScrollerPresentation } from "./presentation";
import { installSideConceptArtPass } from "./conceptArt";
import { installSideVisualPolish } from "./visualPolish";
import { GameScene } from "./scenes/GameScene";
import { LoadoutScene } from "./scenes/LoadoutScene";

// CrazyGames ポータル上でのみ SDK が有効化される（他環境では no-op）
void initCrazyGames();
installSideScrollerPresentation();
installSideConceptArtPass();
installSideVisualPolish();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 800,
  height: 600,
  backgroundColor: "#aee0ff",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 1200 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [LoadoutScene, GameScene],
});

installResponsiveGame(game, { baseWidth: 800, baseHeight: 600 });

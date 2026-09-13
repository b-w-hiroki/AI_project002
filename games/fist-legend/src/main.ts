import Phaser from "phaser";
import { installResponsiveGame } from "../../shared/mobile";
import { installFistLegendPresentation } from "./presentation";
import { installFistConceptArtPass } from "./conceptArt";
import { installFistVisualPolish } from "./visualPolish";
import { initCrazyGames } from "./platform/crazygames";
import { GameScene } from "./scenes/GameScene";

installFistLegendPresentation();
installFistConceptArtPass();
installFistVisualPolish();

// CrazyGames ポータル上でのみ SDK が有効化される（他環境では no-op）
void initCrazyGames();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 800,
  height: 600,
  backgroundColor: "#1a1410",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
});

installResponsiveGame(game, { baseWidth: 800, baseHeight: 600 });

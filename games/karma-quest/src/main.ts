import Phaser from "phaser";
import { installKarmaQuestPresentation } from "./presentation";
import { installKarmaConceptArtPass } from "./conceptArt";
import { installKarmaVisualPolish } from "./visualPolish";
import { installResponsiveViewport } from "./responsive";
import { initCrazyGames } from "./platform/crazygames";
import { GameScene } from "./scenes/GameScene";

installResponsiveViewport();
installKarmaQuestPresentation();
installKarmaConceptArtPass();
installKarmaVisualPolish();

// CrazyGames ポータル上でのみ SDK が有効化される（他環境では no-op）
void initCrazyGames();

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 450,
  height: 800,
  backgroundColor: "#14201c",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
});

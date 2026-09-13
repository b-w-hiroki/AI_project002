import Phaser from "phaser";
import { installResponsiveGame } from "../../shared/mobile";
import { installKarmaQuestPresentation } from "./presentation";
import { installKarmaConceptArtPass } from "./conceptArt";
import { installKarmaArtFidelity } from "./artFidelity";
import { installKarmaVisualPolish } from "./visualPolish";
import { installKarmaMobileLayout } from "./mobileLayout";
import { initCrazyGames } from "./platform/crazygames";
import { GameScene } from "./scenes/GameScene";

installKarmaQuestPresentation();
installKarmaConceptArtPass();
installKarmaVisualPolish();
installKarmaMobileLayout();
installKarmaArtFidelity();

// CrazyGames ポータル上でのみ SDK が有効化される（他環境では no-op）
void initCrazyGames();

const game = new Phaser.Game({
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

installResponsiveGame(game, { baseWidth: 450, baseHeight: 800 });

import { ExpeditionScene } from "./scenes/ExpeditionScene";
import Phaser from "phaser";
import { installResponsiveGame } from "../../shared/mobile";
import { initCrazyGames } from "./platform/crazygames";
import { installSangokuPresentation } from "./presentation";
import { installSangokuConceptArtPass } from "./conceptArt";
import { installSangokuArtFidelity } from "./artFidelity";
import { installSangokuVisualPolish } from "./visualPolish";
import { installSangokuMobileLayout } from "./mobileLayout";
import { GameScene } from "./scenes/GameScene";

// CrazyGames ポータル上でのみ SDK が有効化される（他環境では no-op）
void initCrazyGames();
installSangokuPresentation();
installSangokuConceptArtPass();
installSangokuArtFidelity();
installSangokuVisualPolish();
installSangokuMobileLayout();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 450,
  height: 800,
  backgroundColor: "#2a1a14",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [GameScene, ExpeditionScene],
});

installResponsiveGame(game, { baseWidth: 450, baseHeight: 800 });

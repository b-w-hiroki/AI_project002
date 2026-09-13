import Phaser from "phaser";
import { installResponsiveGame } from "../../shared/mobile";
import { initCrazyGames } from "./platform/crazygames";
import { installWallClockPersistence } from "./persistence";
import { installPotionPresentation } from "./presentation";
import { installPotionConceptArtPass } from "./conceptArt";
import { installPotionArtFidelity } from "./artFidelity";
import { installPotionVisualPolish } from "./visualPolish";
import { installPotionMobileLayout } from "./mobileLayout";
import { IdleScene } from "./scenes/IdleScene";

// CrazyGames ポータル上でのみ SDK が有効化される（他環境では no-op）
void initCrazyGames();
installPotionPresentation();
installPotionConceptArtPass();
installPotionVisualPolish();
installPotionMobileLayout();
installPotionArtFidelity();
installWallClockPersistence();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 800,
  height: 760,
  backgroundColor: "#1a1a2e",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 2,
  },
  scene: [IdleScene],
});

installResponsiveGame(game, {
  baseWidth: 800,
  baseHeight: 760,
  surface: {
    portrait: { width: 450, height: 800 },
    landscape: { width: 800, height: 450 },
  },
});

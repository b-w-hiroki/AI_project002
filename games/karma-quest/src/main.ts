import Phaser from "phaser";
import { installLocalTelemetry } from "../../shared/localTelemetry";
import { installResponsiveGame } from "../../shared/mobile";
import { installKarmaQuestPresentation } from "./presentation";
import { installKarmaConceptArtPass } from "./conceptArt";
import { installKarmaKingdomBackground } from "./kingdomBackground";
import { installKarmaMobileLayout } from "./mobileLayout";
import { initCrazyGames } from "./platform/crazygames";
import { GameScene } from "./scenes/GameScene";

installKarmaQuestPresentation();
installKarmaConceptArtPass();
installKarmaMobileLayout();
installKarmaKingdomBackground();

// CrazyGames ポータル上でのみ SDK が有効化される（他環境では no-op）
await initCrazyGames();
installLocalTelemetry("karma-quest");

// WebKit can lose the WebGL surface when the responsive controller swaps the
// portrait and landscape backing sizes. Canvas keeps Safari/WebKit rendering
// visible across rotation; Chromium-family browsers retain the normal AUTO path.
const webKitCanvasFallback = /AppleWebKit/i.test(navigator.userAgent)
  && !/(Chrome|Chromium|CriOS|Edg|OPR)/i.test(navigator.userAgent);

const game = new Phaser.Game({
  type: webKitCanvasFallback ? Phaser.CANVAS : Phaser.AUTO,
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

installResponsiveGame(game, {
  baseWidth: 450, baseHeight: 800,
  surface: { portrait: { width: 450, height: 800 }, landscape: { width: 800, height: 450 } },
});

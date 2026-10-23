import Phaser from "phaser";
type FighterSprite = Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
export function fitFighter(sprite: FighterSprite, height: number): void {
  // Uniform scaling keeps the source artwork's aspect ratio.
  sprite.setScale(sprite instanceof Phaser.GameObjects.Image ? height / sprite.height : height / 110);
}


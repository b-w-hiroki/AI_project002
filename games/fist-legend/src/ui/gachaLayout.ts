import type Phaser from "phaser";

type Node = Phaser.GameObjects.Text | Phaser.GameObjects.Image | Phaser.GameObjects.Graphics | Phaser.GameObjects.Container;
const original = new WeakMap<Node, { x: number; y: number; scaleX: number; scaleY: number }>();

/** Reflow existing controls; the Scene still owns drawing, currency and callbacks. */
export function layoutGacha(group: Phaser.GameObjects.Container, portrait: boolean, height: number): void {
  for (const child of group.list) {
    const node = child as Node;
    if (!original.has(node)) original.set(node, { x: node.x, y: node.y, scaleX: node.scaleX, scaleY: node.scaleY });
    const base = original.get(node)!;
    node.setPosition(base.x, base.y).setScale(base.scaleX, base.scaleY);
    if (node.name === "gacha-draw" || node.name === "gacha-back") {
      const button = node as Phaser.GameObjects.Container;
      const hitHeight = portrait ? 68 : button.height;
      (button.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setTo(0, (button.height - hitHeight) / 2, button.width, hitHeight);
    }
    if (!portrait) continue;
    switch (node.name) {
      case "gacha-panel": node.setPosition(-55, 50 - 120 * (height - 160) / 360).setScale(0.7, (height - 160) / 360); break;
      case "gacha-slot": node.setScale(0.72).setPosition(225 - 215 * 0.72, 315 - 300 * 0.72); break;
      case "gacha-placeholder": node.setPosition(225, 315); break;
      case "gacha-image": node.setPosition(225, 315).setScale(base.scaleX * 0.72, base.scaleY * 0.72); break;
      case "gacha-heading": node.setPosition(225, 110); break;
      case "gacha-cost": node.setPosition(225, 175).setScale(1.12); break;
      case "gachaResult": node.setPosition(225, 465); break;
      case "gachaBalance": node.setPosition(225, 510).setScale(1.2); break;
      case "gacha-draw": node.setPosition(225, height - 240).setScale(1.35); break;
      case "gacha-back": node.setPosition(225, height - 150).setScale(1.35); break;
    }
  }
}

import Phaser from "phaser";

export function text(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  size: number,
  color = "#ffffff",
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, value, {
      fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", "Yu Gothic", sans-serif',
      fontSize: `${size}px`,
      fontStyle: "800",
      color,
      align: "center",
      wordWrap: { width: 390, useAdvancedWrap: true },
    })
    .setOrigin(0.5);
}

export function button(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  color: number,
  onTap: () => void,
  emphasis = false,
  minHitHeight = 68,
): Phaser.GameObjects.Container {
  const isPrimary = emphasis || (color === 0xa9402d && width >= 300 && height >= 58);
  const shadow = scene.add.rectangle(3, 5, width, height, 0x120b09, 0.38).setStrokeStyle(1, 0x000000, 0.22);
  const bg = scene.add.rectangle(0, 0, width, height, color, 0.96).setStrokeStyle(3, 0x2b1713, 0.82);
  const rim = scene.add.rectangle(0, 0, width - 7, height - 7, color, 0).setStrokeStyle(1.5, 0xffd68c, 0.78);
  const shine = scene.add.rectangle(0, -height * 0.31, width - 12, Math.max(5, height * 0.16), 0xffffff, 0.13);
  const heraldry = scene.add.graphics();
  if (isPrimary) {
    heraldry.lineStyle(2, 0xffdd8a, 0.88);
    heraldry.lineBetween(-width / 2 + 24, -height / 2 + 6, width / 2 - 24, -height / 2 + 6);
    heraldry.lineBetween(-width / 2 + 24, height / 2 - 6, width / 2 - 24, height / 2 - 6);
    heraldry.fillStyle(0xffd36a, 0.92);
    heraldry.fillTriangle(-width / 2 + 8, 0, -width / 2 + 18, -8, -width / 2 + 18, 8);
    heraldry.fillTriangle(width / 2 - 8, 0, width / 2 - 18, -8, width / 2 - 18, 8);
  }
  const leftStud = scene.add.circle(-width / 2 + 10, 0, 2.5, 0xffd68c, 0.82);
  const rightStud = scene.add.circle(width / 2 - 10, 0, 2.5, 0xffd68c, 0.82);
  const labelText = text(scene, 0, 0, label, height >= 56 ? 24 : 22).setStroke("#351713", 3);
  const hitHeight = Math.max(minHitHeight, height);
  const hit = scene.add.zone(0, 0, width, hitHeight).setInteractive({ useHandCursor: true });
  const container = scene.add
    .container(x, y, [shadow, bg, rim, shine, heraldry, leftStud, rightStud, labelText, hit])
    .setSize(width, hitHeight);
  const release = () => {
    if (!isPrimary) container.setScale(1);
    bg.setFillStyle(color, 0.96);
    shine.setAlpha(0.13);
    shadow.setY(5);
  };
  hit.on("pointerdown", () => {
    if (isPrimary) {
      bg.setFillStyle(0x7f2d25, 0.98);
      shine.setAlpha(0.045);
      shadow.setY(2);
    } else {
      container.setScale(0.97);
    }
    if (isPrimary) {
      scene.time.delayedCall(70, () => {
        release();
        onTap();
      });
      return;
    }
    onTap();
  });
  hit.on("pointerup", release);
  hit.on("pointerout", release);
  root.add(container);
  return container;
}


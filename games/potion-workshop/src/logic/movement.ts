/**
 * ゲームロジックは Phaser に依存しない純粋関数として src/logic/ に置く。
 * こうすると Vitest で高速に単体テストできる。
 */

export const PLAYER_SPEED = 300; // px/sec

export interface Vec2 {
  x: number;
  y: number;
}

export interface Bounds {
  width: number;
  height: number;
  margin: number;
}

/** 画面外に出ないよう位置をクランプする */
export function clampToBounds(pos: Vec2, bounds: Bounds): Vec2 {
  return {
    x: Math.min(Math.max(pos.x, bounds.margin), bounds.width - bounds.margin),
    y: Math.min(Math.max(pos.y, bounds.margin), bounds.height - bounds.margin),
  };
}

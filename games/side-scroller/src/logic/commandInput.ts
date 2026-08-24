/**
 * 格闘ゲーム風のコマンド入力認識（Phaser 非依存の純粋関数）。
 * 「↓→X（下要素→前要素→攻撃ボタン）」のような、直近の入力トークン列が
 * 決められたシーケンスと一致するかを判定する。
 *
 * 前後（forward/back）は画面上の左右キーそのものではなく、プレイヤーの向きに対して
 * 相対的なトークンとして扱う（格闘ゲームのコマンドは常に「自キャラの前方」基準のため）。
 */

export type CommandToken = "down" | "forward" | "back" | "attack";

export interface CommandEvent {
  token: CommandToken;
  time: number;
}

/** この時間より前の入力はコマンド判定の対象から外す（溜め込み防止） */
export const COMMAND_BUFFER_WINDOW_MS = 900;
/** シーケンス内の各トークン間がこの時間を超えて空くと不成立にする */
export const COMMAND_TOKEN_GAP_MS = 450;

/** 奥義コマンド: ↓→X（下要素からの簡易波動拳コマンド） */
export const OUGI_COMMAND: readonly CommandToken[] = ["down", "forward", "attack"];
/** 秘奥義コマンド: ↓→↓→X（奥義コマンドの2連続、いわゆる真〜系の強化コマンド） */
export const HIOUGI_COMMAND: readonly CommandToken[] = [
  "down",
  "forward",
  "down",
  "forward",
  "attack",
];

/** 入力バッファに新しいトークンを積む。古い入力は同時に間引く */
export function pushCommandEvent(
  buffer: readonly CommandEvent[],
  token: CommandToken,
  time: number,
): CommandEvent[] {
  const trimmed = buffer.filter((e) => time - e.time <= COMMAND_BUFFER_WINDOW_MS);
  return [...trimmed, { token, time }];
}

/**
 * バッファの末尾が sequence と一致するか判定する。
 * 各トークン間の間隔が COMMAND_TOKEN_GAP_MS 以内であることも要求する
 * （ゆっくり別々に押しただけの偶然の一致を弾くため）。
 */
export function matchesSequence(
  buffer: readonly CommandEvent[],
  sequence: readonly CommandToken[],
): boolean {
  if (buffer.length < sequence.length) return false;
  const tail = buffer.slice(buffer.length - sequence.length);
  for (let i = 0; i < sequence.length; i++) {
    if (tail[i]!.token !== sequence[i]) return false;
  }
  for (let i = 1; i < tail.length; i++) {
    if (tail[i]!.time - tail[i - 1]!.time > COMMAND_TOKEN_GAP_MS) return false;
  }
  return true;
}

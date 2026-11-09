import type { PlayerId } from './players';
import { must } from './util';

/** あるラウンドの役割 */
export interface Roles {
  targetId: PlayerId;
  spotterId: PlayerId;
  /** 狙撃手。席順で観測手の次の人から並べる（回答順の初期値。SPEC 2.4） */
  sniperIds: PlayerId[];
}

/**
 * 本戦・延長戦の輪番（SPEC 2.1）。
 * 第rラウンド（0始まり）の標的は席順[r mod n]、観測手は席順[(r+1) mod n]。残り全員が狙撃手。
 */
export function rotationRoles(seatOrder: readonly PlayerId[], roundIndex: number): Roles {
  const n = seatOrder.length;
  if (n < 3) throw new Error(`rotationRoles: need at least 3 players, got ${n}`);
  const targetId = must(seatOrder[mod(roundIndex, n)], 'target');
  const spotterId = must(seatOrder[mod(roundIndex + 1, n)], 'spotter');
  const sniperIds = orderBySeatAfter(
    seatOrder,
    spotterId,
    seatOrder.filter((id) => id !== targetId && id !== spotterId),
  );
  return { targetId, spotterId, sniperIds };
}

/**
 * サドンデスの役割（SPEC 2.7）。
 * 標的は登録した順に参加者が務め、観測手は固定（直前の脱落者）。標的以外の参加者が狙撃手。
 */
export function suddenDeathRoles(
  seatOrder: readonly PlayerId[],
  targetOrder: readonly PlayerId[],
  turn: number,
  spotterId: PlayerId,
): Roles {
  const targetId = must(targetOrder[turn], `sudden death target at turn ${turn}`);
  const sniperIds = orderBySeatAfter(
    seatOrder,
    spotterId,
    targetOrder.filter((id) => id !== targetId),
  );
  return { targetId, spotterId, sniperIds };
}

/** ids を、席順で startAfterId の次の人から一周する順に並べる */
export function orderBySeatAfter(
  seatOrder: readonly PlayerId[],
  startAfterId: PlayerId,
  ids: readonly PlayerId[],
): PlayerId[] {
  const n = seatOrder.length;
  const start = seatOrder.indexOf(startAfterId);
  const position = (id: PlayerId) => mod(seatOrder.indexOf(id) - start - 1, n);
  return [...ids].sort((a, b) => position(a) - position(b));
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

// License-capacity math for clusters. A cluster caps its users
// (`total_max_license_users`). Neither the seat pool nor the business-unit quota has an
// "unlimited" state any more: a cap of 0, null, or undefined means ZERO seats / quota. Use
// `seatUtilization` below for both; `utilization` (null = uncapped) is kept only for callers
// that still opt into the legacy behaviour.
//
// Fleet-wide capacity totals come from the backend's `GET /clusters/summary` endpoint —
// there is no local fallback computation in this file any more.

export type CapLevel = 'none' | 'ok' | 'warn' | 'over';

export interface Utilization {
  used: number;
  cap: number | null; // null = uncapped
  ratio: number; // 0 when uncapped
  level: CapLevel;
  pct: number; // rounded %, 0 when uncapped
}

/** Clusters flip to "near" at 90% of a finite cap, "over" at 100%+. */
const NEAR = 0.9;

export function utilization(used?: number | null, cap?: number | null): Utilization {
  const u = Math.max(0, used ?? 0);
  const c = cap && cap > 0 ? cap : null;
  if (c == null) return { used: u, cap: null, ratio: 0, level: 'none', pct: 0 };
  const ratio = u / c;
  const level: CapLevel = ratio >= 1 ? 'over' : ratio >= NEAR ? 'warn' : 'ok';
  return { used: u, cap: c, ratio, level, pct: Math.round(ratio * 100) };
}

/**
 * Seat capacity math — a deliberate second implementation, not a variant of `utilization()`.
 *
 * `utilization()` above treats a cap of `0`/`null`/`undefined` as "uncapped"; it is the legacy
 * behaviour that `CapacityMeter`/`CapacityGauge` still offer when `finite` is not set. Every seat
 * and business-unit-quota display uses this function instead (spec §6.4): there is no "unlimited"
 * cap — `cap` is always a finite integer, and `0` means zero seats, not infinite ones. Flipping
 * `utilization()` itself would have to land in lockstep with the backend's `finiteCap()` (a
 * different repo), so this is a standalone function in the same file.
 */
export interface SeatUtilization {
  used: number;
  cap: number; // always a finite integer; 0 means zero seats, never "unlimited"
  ratio: number; // cap = 0 → 1 once anyone is using a seat, 0 when nobody is
  level: CapLevel; // shares CapLevel with utilization(), but never 'none'
  pct: number;
}

export function seatUtilization(used: number, cap: number): SeatUtilization {
  const u = Math.max(0, used);
  const c = Math.max(0, cap);
  const ratio = c === 0 ? (u > 0 ? 1 : 0) : u / c;
  const level: CapLevel = ratio >= 1 ? 'over' : ratio >= NEAR ? 'warn' : 'ok';
  return { used: u, cap: c, ratio, level, pct: Math.round(ratio * 100) };
}

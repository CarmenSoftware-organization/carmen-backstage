/**
 * Normalises a cluster's seat pool for display. The backend counts seat holders itself
 * (`users_count`) and exposes the cap as `total_max_license_users`; a cap of 0, null or absent
 * means ZERO seats — never "unlimited" (see `seatUtilization` in utils/capacity).
 */
export function toSeatPool(
  used: number | null | undefined,
  cap: number | null | undefined,
): { used: number; cap: number } {
  return { used: used ?? 0, cap: cap ?? 0 };
}

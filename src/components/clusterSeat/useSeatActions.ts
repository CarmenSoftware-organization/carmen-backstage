import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import clusterService from '../../services/clusterService';
import { useI18n } from '../../hooks/useI18n';
import { devLog, getErrorCode, getErrorDetail } from '../../utils/errorParser';
import type { ClusterUser } from '../../types';

export interface SeatLimitDetails {
  used?: number;
  cap?: number;
  adding?: number;
}

const asNumber = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

/**
 * `{ used, cap, adding }` of a SEAT_LIMIT_REACHED 403, or null for any other error.
 *
 * Assumed path: the gateway's StdResponse.error puts the error `details` in the body's `data`
 * field and the catalog code in `code`, so the counts live at `response.data.data`. The
 * `response.data.details` / `response.data.error.details` fallbacks cover envelope variants.
 *
 * ค่า used/cap อยู่ที่ response.data.data (StdResponse.error ใส่ details ลงฟิลด์ data)
 */
export const getSeatLimitDetails = (err: unknown): SeatLimitDetails | null => {
  if (getErrorCode(err) !== 'SEAT_LIMIT_REACHED') return null;
  const body = (err as { response?: { data?: unknown } })?.response?.data as
    | { data?: unknown; details?: unknown; error?: { details?: unknown } }
    | undefined;
  const candidates = [body?.data, body?.details, body?.error?.details];
  for (const c of candidates) {
    if (c && typeof c === 'object') {
      const { used, cap, adding } = c as Record<string, unknown>;
      if (asNumber(used) !== undefined || asNumber(cap) !== undefined) {
        return { used: asNumber(used), cap: asNumber(cap), adding: asNumber(adding) };
      }
    }
  }
  return {};
};

/** Best display name for a member row. */
export const seatUserLabel = (user: ClusterUser): string => {
  const full = [user.userInfo?.firstname, user.userInfo?.middlename, user.userInfo?.lastname]
    .filter(Boolean)
    .join(' ');
  return user.name || full || user.username || user.email || user.id;
};

/**
 * Release / restore a member's cluster seat with the toasts the spec asks for.
 * `onDone` runs after any call that reached the server and changed (or may have changed) state.
 */
export const useSeatActions = (clusterId: string, onDone: () => void) => {
  const { t } = useI18n();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const release = useCallback(
    async (user: ClusterUser) => {
      if (!user.user_id) return;
      setPendingId(user.id);
      try {
        const res = await clusterService.releaseSeat(clusterId, user.user_id);
        if ((res.released ?? []).length === 0) {
          toast.info(t('components.clusterSeat.releasedNone', { name: seatUserLabel(user) }));
        } else {
          toast.success(t('components.clusterSeat.releasedToast', { name: seatUserLabel(user) }));
        }
        onDone();
      } catch (err) {
        devLog('Release seat failed', err);
        toast.error(getErrorDetail(err, t));
      } finally {
        setPendingId(null);
      }
    },
    [clusterId, onDone, t],
  );

  const restore = useCallback(
    async (user: ClusterUser) => {
      if (!user.user_id) return;
      const name = seatUserLabel(user);
      setPendingId(user.id);
      try {
        const res = await clusterService.restoreSeat(clusterId, user.user_id);
        const restored = res.restored ?? [];
        const skipped = res.skipped ?? [];
        if (skipped.length === 0 && restored.length > 0) {
          toast.success(t('components.clusterSeat.restoredAll', { name }));
        } else if (restored.length > 0) {
          const byId = new Map((user.seat?.links ?? []).map((l) => [l.id, l.bu_code]));
          const codes = skipped.map((s) => byId.get(s.id) ?? s.id).join(', ');
          toast.warning(t('components.clusterSeat.restoredPartial', { name, codes }));
        } else {
          toast.info(t('components.clusterSeat.restoredNone', { name }));
        }
        onDone();
      } catch (err) {
        const limit = getSeatLimitDetails(err);
        if (limit) {
          toast.error(
            limit.used !== undefined && limit.cap !== undefined
              ? t('components.clusterSeat.limitReached', {
                  used: limit.used,
                  cap: limit.cap,
                  name,
                })
              : t('components.clusterSeat.limitReachedNoCounts'),
          );
        } else {
          devLog('Restore seat failed', err);
          toast.error(getErrorDetail(err, t));
        }
      } finally {
        setPendingId(null);
      }
    },
    [clusterId, onDone, t],
  );

  return { release, restore, pendingId };
};

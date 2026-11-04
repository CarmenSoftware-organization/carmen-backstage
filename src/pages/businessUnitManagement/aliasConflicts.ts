import { useEffect, useMemo, useState } from 'react';
import businessUnitService from '../../services/businessUnitService';
import { devLog } from '../../utils/errorParser';
import type { TFunction } from '../../i18n/types';
import type { BuAliasConflict } from '../../types';

const names = (c: BuAliasConflict) => c.conflicts_with.map((o) => `${o.name} (${o.alias_name})`).join(', ');

/** ประโยค "ต้องแก้เพราะ" ของหนึ่งแถว — ใช้ร่วมกันทั้งหน้ารวมและหน้า cluster admin */
export function aliasConflictReason(c: BuAliasConflict, t: TFunction): string {
  const hasClash = c.conflicts_with.length > 0;
  if (c.reason === 'too_long') {
    return hasClash
      ? t('pages.businessUnits.aliasConflicts.trimmedClash', { truncated: c.truncated_to ?? '', names: names(c) })
      : t('pages.businessUnits.aliasConflicts.tooLong');
  }
  return t('pages.businessUnits.aliasConflicts.duplicate', { names: names(c) });
}

/**
 * โหลดครั้งเดียวตอน mount. แถบนี้เป็นของเสริม: error ใด ๆ (รวมกรณี backend ยังไม่มี route
 * แล้วคำขอไปตกที่ `GET :business_unit_id` → 4xx) กลายเป็น `[]` แบบเงียบ ไม่ toast
 */
export function useAliasConflicts(clusterId?: string): { conflicts: BuAliasConflict[]; loading: boolean } {
  const [all, setAll] = useState<BuAliasConflict[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await businessUnitService.getAliasConflicts();
        if (!cancelled) setAll(data);
      } catch (err: unknown) {
        devLog('Error loading BU alias conflicts:', err);
        if (!cancelled) setAll([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const conflicts = useMemo(
    () => (clusterId ? all.filter((c) => c.cluster_id === clusterId) : all),
    [all, clusterId],
  );
  return { conflicts, loading };
}

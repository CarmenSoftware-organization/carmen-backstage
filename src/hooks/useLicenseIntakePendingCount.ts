import { useEffect, useRef, useState } from 'react';
import licenseIntakeService from '../services/licenseIntakeService';
import { devLog } from '../utils/errorParser';

/** Fired on `window` by the detail page after a confirm or reject. */
export const LICENSE_INTAKES_CHANGED_EVENT = 'license-intakes:changed';

/**
 * จำนวนใบขายที่รอดำเนินการ สำหรับป้ายบนเมนู — ดึงตอน mount และเมื่อมี event
 * `license-intakes:changed` เท่านั้น ไม่ poll
 *
 * `enabled` ต้องเป็น false เมื่อไม่มี `subscription.read`: การเรียกโดยไม่มีสิทธิ์ได้ 401
 * และระบบจะเตะผู้ใช้ออก. ล้มเหลวเงียบ (ป้ายหาย) และไม่ล้างค่าเดิม.
 *
 * Pending-intake count for the nav badge; generation counter drops stale responses.
 */
export function useLicenseIntakePendingCount(enabled: boolean): number {
  const [pending, setPending] = useState(0);
  const generationRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const load = () => {
      const generation = ++generationRef.current;
      licenseIntakeService
        .getSummary()
        .then((res) => {
          if (generation !== generationRef.current) return;
          const summary = res?.data ?? res;
          const n = Number(summary?.pending);
          setPending(Number.isFinite(n) && n > 0 ? n : 0);
        })
        .catch((err: unknown) => {
          if (generation !== generationRef.current) return;
          devLog('license intake pending count failed', err);
        });
    };

    load();
    window.addEventListener(LICENSE_INTAKES_CHANGED_EVENT, load);
    return () => {
      generationRef.current++;
      window.removeEventListener(LICENSE_INTAKES_CHANGED_EVENT, load);
    };
  }, [enabled]);

  return enabled ? pending : 0;
}

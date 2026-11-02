import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import applicationService from '../services/applicationService';
import { parseApiError } from '../utils/errorParser';
import { fetchAllPages } from '../utils/fetchAllPages';

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * ตัวเลือก Application สำหรับ dropdown ของหน้า analytics — โหลดครั้งเดียวตอน mount
 * ไม่ผูกกับช่วงวัน และใช้ร่วมกันทั้งหน้า dashboard และหน้า raw explorer
 * ดึงทุกหน้า (ไม่เพดาน 100) · BU ใช้ BusinessUnitCodePicker ค้นหาฝั่งเซิร์ฟเวอร์แทน
 * ความล้มเหลวแจ้งด้วย toast หนึ่งครั้งตามกฎข้อ 12
 */
export function useAnalyticsFilterOptions(): {
  appOptions: FilterOption[];
} {
  const [appOptions, setAppOptions] = useState<FilterOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const apps = await fetchAllPages(
          (page, perpage) => applicationService.getAll({ page, perpage }),
          { pageSize: 100, maxPages: 10, label: 'analyticsAppOptions' },
        );
        if (cancelled) return;
        setAppOptions(apps.map((a) => ({ value: a.id, label: a.name })));
      } catch (err) {
        if (!cancelled) toast.error(parseApiError(err).message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { appOptions };
}

/** ชื่อที่อ่านออกของตัวเลือกหนึ่งค่า — ถ้า dropdown ยังโหลดไม่เสร็จก็คืนค่าดิบไปก่อน */
export function optionLabel(options: FilterOption[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

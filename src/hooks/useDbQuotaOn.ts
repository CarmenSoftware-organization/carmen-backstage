import { DB_QUOTA_FLAG } from '../constants/featureFlags';
import { useFeature } from './useFeature';

/**
 * โควตา DB ของใบ STQ เปิดให้เห็นหรือไม่ — เปิดเฉพาะเมื่อ flag เป็น `active` (`inactive` ถือว่าปิดเหมือน `hide`
 * เพราะจุดที่คุมเป็นการ์ด/คอลัมน์ ไม่ใช่เมนู) · ปิดแล้วยังโชว์ขนาด DB ที่ใช้ไป แต่ไม่โชว์เพดาน/%/แถบ/แหล่งโควตา
 * Whether the STQ database quota is shown. Off still shows the DB size used, never the limit.
 * @returns true เมื่อ `license_storage_quota` เป็น `active`
 */
export function useDbQuotaOn(): boolean {
  return useFeature(DB_QUOTA_FLAG) === 'active';
}

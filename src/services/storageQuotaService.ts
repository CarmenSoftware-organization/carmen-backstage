import api from './api';
import type { BuStorageQuotaView, BuStorageUsage, StorageUsageListItem } from '../types';

const BU_BASE = (buId: string) => `/api-system/business-units/${buId}/storage-quota`;

/** ห่อด้วย envelope `{ data }` ของ gateway — คืนเฉพาะ data */
const unwrap = <T,>(body: { data?: T } | T): T =>
  ((body as { data?: T }).data ?? body) as T;

/** body ของ PUT — field ที่ไม่ส่ง = คงเดิม, โควตา null = ใช้ค่า default */
export interface StorageQuotaPatch {
  db_quota_bytes?: number | null;
  file_quota_bytes?: number | null;
  exempt?: boolean;
  note?: string | null;
}

const storageQuotaService = {
  get: async (buId: string): Promise<BuStorageQuotaView> => unwrap((await api.get(BU_BASE(buId))).data),

  update: async (buId: string, patch: StorageQuotaPatch): Promise<BuStorageQuotaView> =>
    unwrap((await api.put(BU_BASE(buId), patch)).data),

  /** วัดทันที (database + ไฟล์แนบ) — ช้าได้เพราะ gateway รอผลวัดจริง */
  measure: async (buId: string): Promise<BuStorageUsage> =>
    unwrap((await api.post(`${BU_BASE(buId)}/measure`)).data),

  listUsage: async (): Promise<StorageUsageListItem[]> =>
    unwrap((await api.get('/api-system/storage-usage')).data),
};

export default storageQuotaService;

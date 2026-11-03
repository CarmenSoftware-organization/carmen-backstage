import api from './api';
import type { BuStorageQuotaView, BuStorageUsage, StorageQuotaPatch, StorageUsageListItem } from '../types';

const BU_BASE = (buId: string) => `/api-system/business-units/${buId}/storage-quota`;

/** วัด schema ใหญ่ใช้เวลาเป็นนาที — axios instance กลางไม่มี timeout (รอไม่จำกัด) จึงตั้งเพดาน 5 นาทีเฉพาะการเรียกนี้ */
const MEASURE_TIMEOUT_MS = 5 * 60 * 1000;

const storageQuotaService = {
  get: async (buId: string): Promise<BuStorageQuotaView> => (await api.get(BU_BASE(buId))).data.data,

  update: async (buId: string, patch: StorageQuotaPatch): Promise<BuStorageQuotaView> =>
    (await api.put(BU_BASE(buId), patch)).data.data,

  /** วัดทันที (database + ไฟล์แนบ) — ช้าได้เพราะ gateway รอผลวัดจริง */
  measure: async (buId: string): Promise<BuStorageUsage> =>
    (await api.post(`${BU_BASE(buId)}/measure`, undefined, { timeout: MEASURE_TIMEOUT_MS })).data.data,

  listUsage: async (): Promise<StorageUsageListItem[]> =>
    (await api.get('/api-system/storage-usage')).data.data,
};

export default storageQuotaService;

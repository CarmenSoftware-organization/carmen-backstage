import api from './api';
import type {
  BuStorageQuotaView,
  BuStorageUsage,
  StorageQuotaPatch,
  StorageReclaimJob,
  StorageUsageListItem,
} from '../types';

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

  /** เริ่ม reclaim (VACUUM FULL) เบื้องหลัง — ตอบทันทีพร้อมงานที่ queued · 409 ถ้า pool เดียวกันมีงานทำอยู่ */
  startReclaim: async (buId: string): Promise<StorageReclaimJob> =>
    (await api.post(`${BU_BASE(buId)}/reclaim`)).data.data,

  /** งาน reclaim ล่าสุดของ BU (null เมื่อไม่เคยมี) */
  getReclaim: async (buId: string): Promise<StorageReclaimJob | null> =>
    (await api.get(`${BU_BASE(buId)}/reclaim`)).data.data ?? null,

  listUsage: async (): Promise<StorageUsageListItem[]> =>
    (await api.get('/api-system/storage-usage')).data.data,
};

export default storageQuotaService;

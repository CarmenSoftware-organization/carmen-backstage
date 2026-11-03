import api from './api';
import type {
  BuStorageQuotaView,
  BuStorageUsage,
  StorageQuotaPatch,
  StorageMeasureAllStatus,
  StorageReclaimJob,
  StorageUsageListItem,
} from '../types';

const BU_BASE = (buId: string) => `/api-system/business-units/${buId}/storage-quota`;

/** วัด schema ใหญ่ใช้เวลาเป็นนาที — axios instance กลางไม่มี timeout (รอไม่จำกัด) จึงตั้งเพดาน 5 นาทีเฉพาะการเรียกนี้ */
const MEASURE_TIMEOUT_MS = 5 * 60 * 1000;

const MEASURE_ALL = '/api-system/storage-usage/measure-all';

/** ดึงสถานะจาก body ของ 409 — gateway อาจห่อ `data` หรือส่งแบนก็ได้; ไม่พบ = undefined */
const statusFromConflict = (err: unknown): StorageMeasureAllStatus | undefined => {
  const body = (err as { response?: { data?: unknown } })?.response?.data as
    | (Partial<StorageMeasureAllStatus> & { data?: Partial<StorageMeasureAllStatus> })
    | undefined;
  const candidate = body?.data ?? body;
  return candidate && typeof candidate.running === 'boolean' ? (candidate as StorageMeasureAllStatus) : undefined;
};

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

  /** เริ่มวัดทุก BU เบื้องหลัง — 409 (มีงานรันอยู่) คืนสถานะปัจจุบันแทนการ throw */
  startMeasureAll: async (): Promise<StorageMeasureAllStatus> => {
    try {
      return (await api.post(MEASURE_ALL)).data.data;
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } })?.response?.status !== 409) throw err;
      return statusFromConflict(err) ?? (await storageQuotaService.getMeasureAll());
    }
  },

  /** สถานะงานวัดทุก BU (ต้องมี storage_quota.read — 401 เตะผู้ใช้ออก อย่าเรียกโดยไม่เช็กสิทธิ์) */
  getMeasureAll: async (): Promise<StorageMeasureAllStatus> => (await api.get(MEASURE_ALL)).data.data,

  listUsage: async (): Promise<StorageUsageListItem[]> =>
    (await api.get('/api-system/storage-usage')).data.data,
};

export default storageQuotaService;

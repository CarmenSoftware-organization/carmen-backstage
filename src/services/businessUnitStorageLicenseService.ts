import api from './api';
import { buildQuery } from '../utils/buildQuery';
import type {
  BuStorageLicense,
  BuStorageLicenseInput,
  BuStorageLicenseSummary,
  BuStorageLicensesResponse,
  BuStorageLicenseRow,
  PaginateParams,
} from '../types';

const BASE = (buId: string) => `/api-system/business-units/${encodeURIComponent(buId)}/storage-licenses`;

const BACKSTAGE_BASE = '/api-system/backstage/storage-licenses';

/** ค้นได้ที่เลขที่ใบ/เลขอ้างอิง (และ code/ชื่อ BU ที่ backend ค้นเพิ่มให้) — ส่งฟิลด์อื่นไปก็ถูกเมิน */
const defaultSearchFields = ['license_number', 'reference_no'];

/**
 * ใบโควตา storage (tb_business_unit_storage_license) — nested resource ใต้ business unit
 * เหมือน `businessUnitInterfaceLicenseService` แต่ไม่มีวันหมดอายุ: ใบใหม่แทนที่ใบเก่า
 * (`superseded_*`) ไม่ลบ เมธอดคืนค่าที่ unwrap `{ data }` แล้ว ยกเว้น `listBackstage`
 * ที่คืน envelope เต็มเพราะต้องใช้ `paginate`
 */
const businessUnitStorageLicenseService = {
  /** ใบทั้งหมดของ BU ใหม่สุดก่อน รวมใบที่ถูกแทนที่แล้ว (ประวัติ) */
  listByBu: async (buId: string): Promise<BuStorageLicense[]> => {
    const response = await api.get(BASE(buId));
    return response.data.data || response.data;
  },

  /** มุมมองรายใบทั้ง fleet — paginated */
  listBackstage: async (paginate: PaginateParams = {}): Promise<BuStorageLicensesResponse> => {
    const response = await api.get(`${BACKSTAGE_BASE}?${buildQuery(paginate, defaultSearchFields)}`);
    return response.data;
  },

  /** ตัวเลขสรุปทั้ง fleet — ไม่รับตัวกรอง */
  summary: async (): Promise<BuStorageLicenseSummary> => {
    const response = await api.get(`${BACKSTAGE_BASE}/summary`);
    return response.data.data || response.data;
  },

  /** ใบเดียวจาก id ล้วน — คืน `business_unit_id` ไว้ประกอบ path ของ update/remove */
  get: async (id: string): Promise<BuStorageLicenseRow> => {
    const response = await api.get(`${BACKSTAGE_BASE}/${encodeURIComponent(id)}`);
    return response.data.data || response.data;
  },

  /** ออกใบใหม่ — ใบที่ใช้งานอยู่ของ BU จะถูกแทนที่ (license_number ระบบออกให้) */
  create: async (buId: string, input: BuStorageLicenseInput): Promise<BuStorageLicense> => {
    const response = await api.post(BASE(buId), input);
    return response.data.data || response.data;
  },

  /** แก้ใบ — ส่ง `doc_version` เสมอเมื่อมี; 409 เมื่อชนกับที่แก้ไปก่อนหน้า */
  update: async (
    buId: string,
    id: string,
    input: Partial<BuStorageLicenseInput> & { doc_version?: number },
  ): Promise<BuStorageLicense> => {
    const response = await api.patch(`${BASE(buId)}/${encodeURIComponent(id)}`, input);
    return response.data.data || response.data;
  },

  /** ลบ — `doc_version` เป็น query param ที่ backend บังคับ */
  remove: async (buId: string, id: string, docVersion: number): Promise<unknown> => {
    const response = await api.delete(`${BASE(buId)}/${encodeURIComponent(id)}`, { params: { doc_version: docVersion } });
    return response.data;
  },
};

export default businessUnitStorageLicenseService;

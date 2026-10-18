import api from './api';
import { buildQuery } from '../utils/buildQuery';
import type { ClusterLicense, PaginateParams, BuQuotaLicensesResponse, LicenseFleetSummary } from '../types';

const BASE = (clusterId: string) => `/api-system/clusters/${clusterId}/licenses`;

const PLATFORM_BASE = '/api-system/platform/cluster-licenses';

/** ค้นได้ที่เลขที่ใบและเลขอ้างอิงเท่านั้น — backend ตั้ง default นี้ไว้ ส่งฟิลด์อื่นไปก็ถูกเมิน */
const defaultSearchFields = ['license_number', 'reference_no'];

/**
 * ใบซื้อโควตา BU ของ cluster (tb_cluster_license) — nested resource ใต้ cluster
 * รูปเดียวกับ `businessUnitLicenseService`: ไม่ paginate เอง คืน `response.data` ดิบ
 * (envelope `{ data }`) ให้ผู้เรียก unwrap ด้วย `data.data || data`
 */
const clusterLicenseService = {
  getAll: async (clusterId: string) => {
    const response = await api.get(BASE(clusterId));
    return response.data;
  },

  // มุมมองรายใบทั้ง fleet (ไม่ผูก cluster เดียว) — paginated ตัวเดียวกับ subscriptions/clusters
  listPlatform: async (paginate: PaginateParams = {}): Promise<BuQuotaLicensesResponse> => {
    const response = await api.get(`${PLATFORM_BASE}?${buildQuery(paginate, defaultSearchFields)}`);
    return response.data;
  },

  /**
   * ใบเดียวจาก id ล้วน — หน้าฟอร์มแก้ไขเปิดจาก deep link ได้โดยไม่ต้องรู้ cluster ล่วงหน้า
   * คืน `cluster_id` มาด้วย ผู้เรียกใช้มันประกอบ path ของ update/delete ซึ่งยังเป็น nested
   */
  getByIdPlatform: async (id: string) => {
    const response = await api.get(`${PLATFORM_BASE}/${id}`);
    return response.data;
  },

  // license_number ระบบออกให้เอง (เหมือน subscription_number) — ไม่อยู่ใน create DTO ของ backend
  create: async (
    clusterId: string,
    data: Omit<ClusterLicense, 'id' | 'cluster_id' | 'doc_version' | 'license_number'>,
  ) => {
    const response = await api.post(BASE(clusterId), data);
    return response.data;
  },

  // doc_version บังคับส่งเสมอ — backend คืน 409 ถ้าชนกับที่แก้ไปก่อนหน้า
  update: async (
    clusterId: string,
    id: string,
    data: Partial<ClusterLicense> & { doc_version: number },
  ) => {
    const response = await api.patch(`${BASE(clusterId)}/${id}`, data);
    return response.data;
  },

  delete: async (clusterId: string, id: string) => {
    const response = await api.delete(`${BASE(clusterId)}/${id}`);
    return response.data;
  },

  /**
   * ยกเลิกใบ — ใบยังอยู่ในบัญชีแต่หยุดให้โควตาทันที ต่างจาก `delete` ที่เอาใบออกจากสายตา
   * ไม่มีทางกลับ: ไม่มี endpoint uncancel ยกเลิกผิดใบต้องออกใบใหม่
   * doc_version บังคับ — 409 เมื่อชนกับคนที่แก้ใบเดียวกันอยู่ หรือเมื่อใบถูกยกเลิกไปแล้ว
   */
  cancel: async (
    clusterId: string,
    id: string,
    data: { doc_version: number; cancel_reason?: string },
  ) => {
    const response = await api.post(`${BASE(clusterId)}/${id}/cancel`, data);
    return response.data;
  },

  /** ตัวเลขสรุปทั้ง fleet สำหรับแถบการ์ดของ License Center — ไม่รับตัวกรอง (ต้องนิ่งกับตัวกรองของตาราง) */
  getPlatformSummary: async (): Promise<LicenseFleetSummary> => {
    const response = await api.get(`${PLATFORM_BASE}/summary`);
    return response.data.data || response.data;
  },

  /**
   * รายการใบโควตา BUที่ถูกลบแบบซ่อน (deleted_at ไม่ว่าง) — เฉพาะ platform superadmin
   * envelope เดียวกับ listPlatform; แถวมี `deleted_at` / `deleted_by_id` และชื่อผู้ลบที่ `audit.deleted`
   */
  listDeleted: async (paginate: PaginateParams = {}): Promise<BuQuotaLicensesResponse> => {
    const response = await api.get(`${PLATFORM_BASE}/deleted?${buildQuery(paginate, defaultSearchFields)}`);
    return response.data;
  },

  /** กู้คืนใบที่ลบแบบซ่อน — 409 `LICENSE_RESTORE_CONFLICT` เมื่อเลขชนกับใบที่ active อยู่ (ต้องมีสิทธิ์ subscription.manage) */
  restore: async (id: string): Promise<unknown> => {
    const response = await api.post(`${PLATFORM_BASE}/${id}/restore`);
    return response.data;
  },

  /**
   * ลบถาวร (ย้อนไม่ได้ เลขที่ใบจะไม่ถูกออกซ้ำ) — เฉพาะ platform superadmin
   * คืน `{ id, license_number }` (subscription ก็ใช้คีย์ license_number)
   * 409 `LICENSE_HARD_DELETE_ACTIVE` เมื่อแถวยัง active
   */
  hardDelete: async (id: string): Promise<unknown> => {
    const response = await api.delete(`${PLATFORM_BASE}/${id}/hard`);
    return response.data;
  },
};

export default clusterLicenseService;

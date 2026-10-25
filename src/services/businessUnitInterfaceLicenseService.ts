import api from './api';
import { buildQuery } from '../utils/buildQuery';
import type { InterfaceLicense, InterfaceLicensesResponse, PaginateParams, LicenseFleetSummary } from '../types';

const BASE = (buId: string) => `/api-system/business-units/${buId}/interface-licenses`;

const BACKSTAGE_BASE = '/api-system/backstage/interface-licenses';

/** ค้นได้ที่เลขที่ใบและเลขอ้างอิงเท่านั้น — backend ตั้ง default นี้ไว้ ส่งฟิลด์อื่นไปก็ถูกเมิน */
const defaultSearchFields = ['license_number', 'reference_no'];

/**
 * ใบสิทธิ์ interface (tb_business_unit_interface_license) — nested resource ใต้ business unit
 * เหมือน `businessUnitLicenseService` ไม่ paginate เอง คืน `response.data` ดิบ
 * (envelope `{ data }`) ให้ผู้เรียก unwrap ด้วย `data.data || data` ตามรูปแบบเดิมของ repo
 */
const businessUnitInterfaceLicenseService = {
  getAll: async (buId: string) => {
    const response = await api.get(BASE(buId));
    return response.data;
  },

  // มุมมองรายใบทั้ง fleet (ไม่ผูก BU เดียว) — paginated ตัวเดียวกับ subscriptions/clusters
  /**
   * `status` แยกจาก `PaginateParams` — backend รับ `?status=` (active/capped/scheduled/expired)
   * เพราะ `capped` ต้องรู้สถานะสัญญาแม่ ซึ่ง `advance` บนตารางเดียวแสดงไม่ได้
   */
  listBackstage: async (
    { status, ...paginate }: PaginateParams & { status?: string } = {},
  ): Promise<InterfaceLicensesResponse> => {
    const qs = buildQuery(paginate, defaultSearchFields);
    const statusQs = status ? `&status=${encodeURIComponent(status)}` : '';
    const response = await api.get(`${BACKSTAGE_BASE}?${qs}${statusQs}`);
    return response.data;
  },

  /**
   * ใบเดียวจาก id ล้วน — หน้าฟอร์มแก้ไขเปิดจาก deep link ได้โดยไม่ต้องรู้ BU ล่วงหน้า
   * คืน `business_unit_id` มาด้วย ผู้เรียกใช้มันประกอบ path ของ update/delete ซึ่งยังเป็น nested
   */
  getByIdBackstage: async (id: string) => {
    const response = await api.get(`${BACKSTAGE_BASE}/${id}`);
    return response.data;
  },

  // license_number ระบบออกให้เอง (เหมือน subscription_number) — ไม่อยู่ใน create DTO ของ backend
  // group/state/in_force/contract_state เป็นค่าที่ backend คำนวณ/join ให้ ไม่รับจาก client
  create: async (
    buId: string,
    data: Omit<
      InterfaceLicense,
      'id' | 'business_unit_id' | 'doc_version' | 'license_number' | 'group' | 'state' | 'in_force' | 'contract_state'
    >,
  ) => {
    const response = await api.post(BASE(buId), data);
    return response.data;
  },

  // doc_version บังคับส่งเสมอ — backend คืน 409 ถ้าชนกับที่แก้ไปก่อนหน้า
  // แก้ได้เฉพาะช่วงวันที่กับข้อมูลอ้างอิง — เปลี่ยนกลุ่ม/เลขที่ใบไม่ได้หลังสร้าง
  update: async (
    buId: string,
    id: string,
    data: Partial<Pick<InterfaceLicense, 'start_date' | 'end_date' | 'reference_no' | 'note'>> & {
      doc_version: number;
    },
  ) => {
    const response = await api.patch(`${BASE(buId)}/${id}`, data);
    return response.data;
  },

  delete: async (buId: string, id: string) => {
    const response = await api.delete(`${BASE(buId)}/${id}`);
    return response.data;
  },

  /** ตัวเลขสรุปทั้ง fleet สำหรับแถบการ์ดของ License Center — ไม่รับตัวกรอง (ต้องนิ่งกับตัวกรองของตาราง) */
  getBackstageSummary: async (): Promise<LicenseFleetSummary> => {
    const response = await api.get(`${BACKSTAGE_BASE}/summary`);
    return response.data.data || response.data;
  },

  /**
   * รายการใบ interfaceที่ถูกลบแบบซ่อน (deleted_at ไม่ว่าง) — เฉพาะ platform superadmin
   * envelope เดียวกับ listBackstage; แถวมี `deleted_at` / `deleted_by_id` และชื่อผู้ลบที่ `audit.deleted`
   */
  listDeleted: async (paginate: PaginateParams = {}): Promise<InterfaceLicensesResponse> => {
    const response = await api.get(`${BACKSTAGE_BASE}/deleted?${buildQuery(paginate, defaultSearchFields)}`);
    return response.data;
  },

  /** กู้คืนใบที่ลบแบบซ่อน — 409 `LICENSE_RESTORE_CONFLICT` เมื่อเลขชนกับใบที่ active อยู่ (ต้องมีสิทธิ์ subscription.manage) */
  restore: async (id: string): Promise<unknown> => {
    const response = await api.post(`${BACKSTAGE_BASE}/${id}/restore`);
    return response.data;
  },

  /**
   * ลบถาวร (ย้อนไม่ได้ เลขที่ใบจะไม่ถูกออกซ้ำ) — เฉพาะ platform superadmin
   * คืน `{ id, license_number }` (subscription ก็ใช้คีย์ license_number)
   * 409 `LICENSE_HARD_DELETE_ACTIVE` เมื่อแถวยัง active
   */
  hardDelete: async (id: string): Promise<unknown> => {
    const response = await api.delete(`${BACKSTAGE_BASE}/${id}/hard`);
    return response.data;
  },
};

export default businessUnitInterfaceLicenseService;

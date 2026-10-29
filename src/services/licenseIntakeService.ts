import api from './api';
import { buildQuery } from '../utils/buildQuery';
import type {
  PaginateParams,
  LicenseIntakesResponse,
  LicenseIntakeConfirmInput,
  LicenseIntakeRejectInput,
} from '../types';

// ตรงกับ search fields ฝั่ง backend (license-intake queue)
const defaultSearchFields = ['source_sale_id', 'ar_number'];

const BASE = '/api-system/backstage/license-intakes';

const seg = (v: string) => encodeURIComponent(v);

/**
 * คิวใบขายสิทธิ์ที่ license master ส่งมา — staff ยืนยันเข้า BU หรือปฏิเสธ
 * confirm/reject ส่ง doc_version ที่อ่านมา; ค่าเก่าได้ 409 LICENSE_INTAKE_NOT_PENDING
 * ทั้งสองคืน detail ล่าสุด
 */
const licenseIntakeService = {
  getAll: async (paginate: PaginateParams = {}): Promise<LicenseIntakesResponse> => {
    const response = await api.get(`${BASE}?${buildQuery(paginate, defaultSearchFields)}`);
    return response.data;
  },

  getSummary: async () => {
    const response = await api.get(`${BASE}/summary`);
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`${BASE}/${seg(id)}`);
    return response.data;
  },

  getBuLicenses: async (id: string, buId: string) => {
    const response = await api.get(`${BASE}/${seg(id)}/business-units/${seg(buId)}/licenses`);
    return response.data;
  },

  confirm: async (id: string, body: LicenseIntakeConfirmInput) => {
    const response = await api.post(`${BASE}/${seg(id)}/confirm`, body);
    return response.data;
  },

  reject: async (id: string, body: LicenseIntakeRejectInput) => {
    const response = await api.post(`${BASE}/${seg(id)}/reject`, body);
    return response.data;
  },
};

export default licenseIntakeService;

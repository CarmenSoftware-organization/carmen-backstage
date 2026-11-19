import api from './api';
import { buildQuery } from '../utils/buildQuery';
import type {
  AiCreditAdjustInput,
  AiCreditBalance,
  AiCreditLedgerResponse,
  AiCreditLicense,
  AiCreditLicenseInput,
  AiCreditSummaryResponse,
  PaginateParams,
} from '../types';

const BASE = (buId: string) => `/api-system/business-units/${encodeURIComponent(buId)}/ai-credit`;

const FLEET_BASE = '/api-system/backstage/ai-credit';

/**
 * AI credit ต่อ BU (โควตารายเดือนจาก subscription + ใบ top-up `AIC-` + ledger แบบ append-only)
 * เมธอดคืนค่าที่ unwrap `{ data }` แล้ว ยกเว้น `ledger` / `summary` ที่คืน envelope เต็มเพราะต้องใช้ `paginate`
 * การอ่านตรวจสิทธิ์ฝั่ง backend ตามขอบเขต cluster · การเขียนต้องมี `subscription.manage`
 */
const aiCreditService = {
  balance: async (buId: string): Promise<AiCreditBalance> => {
    const response = await api.get(BASE(buId));
    return response.data.data || response.data;
  },

  /** ledger ใหม่สุดก่อน — filter รองรับ entry_type / feature / month (YYYY-MM); perpage 1-100 */
  ledger: async (buId: string, paginate: PaginateParams = {}): Promise<AiCreditLedgerResponse> => {
    const response = await api.get(`${BASE(buId)}/ledger?${buildQuery(paginate)}`);
    return response.data;
  },

  /** ใบ top-up ทั้งหมด รวมใบที่ void (`deleted_at` มีค่า) */
  licenses: async (buId: string): Promise<AiCreditLicense[]> => {
    const response = await api.get(`${BASE(buId)}/licenses`);
    return response.data.data || response.data;
  },

  createLicense: async (buId: string, input: AiCreditLicenseInput): Promise<{ id: string; license_number: string }> => {
    const response = await api.post(`${BASE(buId)}/licenses`, input);
    return response.data.data || response.data;
  },

  /** void = soft delete — `doc_version` เป็น query param ที่ backend บังคับ; 409 เมื่อชนกัน */
  voidLicense: async (buId: string, id: string, docVersion: number): Promise<unknown> => {
    const response = await api.delete(`${BASE(buId)}/licenses/${encodeURIComponent(id)}`, {
      params: { doc_version: docVersion },
    });
    return response.data;
  },

  /** ปรับยอด pool top-up ± (ไม่แตะโควตารายเดือน) */
  adjust: async (buId: string, input: AiCreditAdjustInput): Promise<{ id: string }> => {
    const response = await api.post(`${BASE(buId)}/adjustments`, input);
    return response.data.data || response.data;
  },

  /** สรุปทั้ง fleet ภายในขอบเขตที่ผู้เรียกอ่านได้ — paginated */
  summary: async (paginate: PaginateParams = {}): Promise<AiCreditSummaryResponse> => {
    const response = await api.get(`${FLEET_BASE}/summary?${buildQuery(paginate)}`);
    return response.data;
  },
};

export default aiCreditService;

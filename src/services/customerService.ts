import api from './api';
import { buildQuery } from '../utils/buildQuery';
import type { PaginateParams, CustomersResponse, CustomerWriteInput } from '../types';

// ตรงกับ defaultSearchFields ฝั่ง backend (customer.service.ts)
const defaultSearchFields = ['ar_number', 'company_name', 'tax_no'];

const BASE = '/api-system/backstage/customers';

/**
 * Backstage customers (AR) — ลูกค้าหนึ่งรายผูกได้หลาย business unit
 *
 * update เป็น PUT (ไม่ใช่ PATCH) และ doc_version เป็น required ฝั่ง backend
 * link/unlink เป็น PUT/DELETE ใต้ `:id/business-units/:buId`
 */
const customerService = {
  getAll: async (paginate: PaginateParams = {}): Promise<CustomersResponse> => {
    const response = await api.get(`${BASE}?${buildQuery(paginate, defaultSearchFields)}`);
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`${BASE}/${id}`);
    return response.data;
  },

  create: async (data: CustomerWriteInput) => {
    const response = await api.post(BASE, data);
    return response.data;
  },

  update: async (id: string, data: CustomerWriteInput & { doc_version: number }) => {
    const response = await api.put(`${BASE}/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`${BASE}/${id}`);
    return response.data;
  },

  linkBusinessUnit: async (id: string, buId: string) => {
    const response = await api.put(`${BASE}/${id}/business-units/${buId}`);
    return response.data;
  },

  unlinkBusinessUnit: async (id: string, buId: string) => {
    const response = await api.delete(`${BASE}/${id}/business-units/${buId}`);
    return response.data;
  },
};

export default customerService;

import { usePagedSearch, type PagedPage, type PagedSearchResult } from './usePagedSearch';
import businessUnitService from '../services/businessUnitService';
import type { BusinessUnit } from '../types';

export interface BusinessUnitOption {
  id: string;
  code: string;
  name: string;
  cluster_name?: string | null;
  /** ลูกค้าที่ BU ผูกอยู่ — ส่งมาเฉพาะผู้เรียกระดับ backstage ทั้งระบบ (คีย์หาย ≠ ไม่มีลูกค้า) */
  customer?: BusinessUnit['customer'];
}

export type BusinessUnitSearchResult = PagedSearchResult<BusinessUnitOption>;

const toOption = (b: BusinessUnit): BusinessUnitOption => ({
  id: b.id,
  code: b.code,
  name: b.name,
  cluster_name: b.cluster_name ?? null,
  ...('customer' in b ? { customer: b.customer } : {}),
});

// ระดับ module = referentially stable (usePagedSearch ต้องการ)
const fetchBusinessUnitPage = async (args: {
  search: string;
  page: number;
  perpage: number;
}): Promise<PagedPage<BusinessUnitOption>> => {
  const response = await businessUnitService.getAll({
    page: args.page,
    perpage: args.perpage,
    search: args.search,
    sort: 'code:asc',
  });
  return {
    data: ((response.data || []) as BusinessUnit[]).map(toOption),
    paginate: response.paginate,
  };
};

/**
 * ค้นหา BU ฝั่ง server (name, code, description ผ่าน businessUnitService.getAll) ทีละ 20 รายการ
 * เรียงตาม code — `loadMore` ดึงหน้าถัดไปต่อท้าย · ไม่ยิงตอน `enabled` เป็น false
 * ผู้เรียกต้องส่ง `enabled` ตามสิทธิ์ของ endpoint (`cluster.read`): request ที่ไม่มีสิทธิ์อาจได้ 401 แล้วเตะผู้ใช้ออก
 */
export function useBusinessUnitSearch(query: string, enabled: boolean): BusinessUnitSearchResult {
  return usePagedSearch<BusinessUnitOption>(query, enabled, fetchBusinessUnitPage);
}

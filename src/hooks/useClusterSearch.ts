import { usePagedSearch, type PagedPage, type PagedSearchResult } from './usePagedSearch';
import clusterService from '../services/clusterService';
import type { Cluster } from '../types';

export interface ClusterOption {
  id: string;
  code: string;
  name: string;
}

export type ClusterSearchResult = PagedSearchResult<ClusterOption>;

export const toClusterOption = (c: Cluster): ClusterOption => ({ id: c.id, code: c.code, name: c.name });

// ระดับ module = referentially stable (usePagedSearch ต้องการ)
const fetchClusterPage = async (args: {
  search: string;
  page: number;
  perpage: number;
}): Promise<PagedPage<ClusterOption>> => {
  const response = await clusterService.getAll({
    page: args.page,
    perpage: args.perpage,
    search: args.search,
    sort: 'name:asc',
  });
  return {
    data: ((response.data || []) as Cluster[]).map(toClusterOption),
    paginate: response.paginate,
  };
};

/**
 * ค้นหา cluster ฝั่ง server (name, code ผ่าน clusterService.getAll) ทีละ 20 รายการ เรียงตาม name
 * ไม่ยิงตอน `enabled` เป็น false — ผู้เรียกต้องส่ง `enabled` ตามสิทธิ์เดิมของ endpoint
 */
export function useClusterSearch(query: string, enabled: boolean): ClusterSearchResult {
  return usePagedSearch<ClusterOption>(query, enabled, fetchClusterPage);
}

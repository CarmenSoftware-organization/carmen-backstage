import { usePagedSearch, type PagedPage, type PagedSearchResult } from './usePagedSearch';
import reportTemplateService, { type ReportTemplate } from '../services/reportTemplateService';

export interface ReportTemplateOption {
  id: string;
  name: string;
  report_group: string;
}

export type ReportTemplateSearchResult = PagedSearchResult<ReportTemplateOption>;

export const toReportTemplateOption = (t: ReportTemplate): ReportTemplateOption => ({
  id: t.id,
  name: t.name,
  report_group: t.report_group,
});

// ระดับ module = referentially stable (usePagedSearch ต้องการ)
const fetchReportTemplatePage = async (args: {
  search: string;
  page: number;
  perpage: number;
}): Promise<PagedPage<ReportTemplateOption>> => {
  const response = await reportTemplateService.getAll({
    page: args.page,
    perpage: args.perpage,
    search: args.search,
    sort: 'name:asc',
  });
  return {
    data: ((response.data || []) as ReportTemplate[]).map(toReportTemplateOption),
    paginate: response.paginate,
  };
};

/**
 * ค้นหา report template ฝั่ง server (name, description, report_group ผ่าน reportTemplateService.getAll)
 * ทีละ 20 รายการ เรียงตาม name · ไม่ยิงตอน `enabled` เป็น false
 */
export function useReportTemplateSearch(query: string, enabled: boolean): ReportTemplateSearchResult {
  return usePagedSearch<ReportTemplateOption>(query, enabled, fetchReportTemplatePage);
}

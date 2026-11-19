import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Download, Loader2, RotateCw, Sparkles } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { DataTable } from '../../components/ui/data-table';
import { EmptyState } from '../../components/EmptyState';
import { SearchInput } from '../../components/SearchInput';
import { TableSkeleton } from '../../components/TableSkeleton';
import { useGlobalShortcuts } from '../../components/KeyboardShortcuts';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useI18n } from '../../hooks/useI18n';
import { generateCSV, downloadCSV } from '../../utils/csvExport';
import { devLog } from '../../utils/errorParser';
import { readStoredPerpage } from '../../utils/pageRange';
import aiCreditService from '../../services/aiCreditService';
import { LICENSE_SECTION_IDS } from '../businessUnitEdit/LicenseSummaryStrip';
import type { AiCreditSummaryRow } from '../../types';
import type { ColumnDef } from '@tanstack/react-table';

const PAGE_KEY = 'page_ai_credit_summary';
const PERPAGE_KEY = 'perpage_ai_credit_summary';
const SORT_KEY = 'sort_ai_credit_summary';
const SEARCH_KEY = 'search_ai_credit_summary';

// BE รับ sort เฉพาะ id / code / name / created_at — คอลัมน์อื่น (cluster, ตัวเลข) คำนวณหลัง query จึงเรียงไม่ได้
const DEFAULT_SORT_ID = 'name';
const SORT_TIEBREAKER = 'id:asc';
const DEFAULT_SORT = `${DEFAULT_SORT_ID}:asc,${SORT_TIEBREAKER}`;
const withTiebreaker = (sort: string): string => {
  const s = sort.trim();
  if (!s) return DEFAULT_SORT;
  return s.split(/[;,]/).some((part) => part.trim().startsWith('id:')) ? s : `${s},${SORT_TIEBREAKER}`;
};

const buHref = (id: string) =>
  `/business-units/${encodeURIComponent(id)}/edit?tab=licenses#${LICENSE_SECTION_IDS.aiCredit}`;

/**
 * ตาราง AI credit ทั้ง fleet — server-side (Rule 13) แสดงเฉพาะ BU ที่มีสิทธิ์ (subscription ที่ให้ credit
 * หรือเคยมีใบ top-up) · ขอบเขต cluster ตัดที่ backend · กดแถวไปการ์ด AI credit ของ BU
 */
export function AiCreditSummaryTable() {
  const { t } = useI18n();

  const [rows, setRows] = useState<AiCreditSummaryRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState(() => localStorage.getItem(SEARCH_KEY) || '');
  const [paginate, setPaginate] = useState(() => ({
    page: Number(localStorage.getItem(PAGE_KEY)) || 1,
    perpage: readStoredPerpage(PERPAGE_KEY, 20),
    sort: withTiebreaker(localStorage.getItem(SORT_KEY) || ''),
  }));

  const resetPage = useCallback(() => {
    localStorage.setItem(PAGE_KEY, '1');
    setPaginate((p) => (p.page === 1 ? p : { ...p, page: 1 }));
  }, []);
  const [debouncedSearch, flushSearch] = useDebouncedValue(search, 400, resetPage);

  const searchInputRef = useRef<HTMLInputElement>(null);
  useGlobalShortcuts({ onSearch: () => searchInputRef.current?.focus() });

  // race guard: คำขอเก่าที่ตอบช้ากว่าไม่ทับผลของคำขอใหม่
  const requestSeq = useRef(0);
  const fetchRows = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const data = await aiCreditService.summary({
        page: paginate.page,
        perpage: paginate.perpage,
        sort: paginate.sort,
        // BE ค้น code/name ของ BU ให้เองเสมอ
        ...(debouncedSearch ? { search: debouncedSearch, searchfields: [] } : {}),
      });
      if (seq !== requestSeq.current) return;
      setRows(data.data);
      setTotalRows(data.paginate?.total ?? data.data.length);
      setLoadFailed(false);
    } catch (err: unknown) {
      if (seq !== requestSeq.current) return;
      setRows([]);
      setTotalRows(0);
      setLoadFailed(true);
      devLog('Failed to load AI credit summary:', err);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [paginate, debouncedSearch]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    localStorage.setItem(SEARCH_KEY, value);
  };
  const handleSearchClear = () => {
    setSearch('');
    localStorage.setItem(SEARCH_KEY, '');
    flushSearch('');
    resetPage();
  };
  const handlePaginateChange = ({ page, perpage }: { page: number; perpage: number }) => {
    localStorage.setItem(PERPAGE_KEY, String(perpage));
    localStorage.setItem(PAGE_KEY, String(page));
    setPaginate((p) => ({ ...p, page, perpage }));
  };
  const handleSortChange = (sort: string) => {
    const next = withTiebreaker(sort);
    localStorage.setItem(SORT_KEY, next);
    localStorage.setItem(PAGE_KEY, '1');
    setPaginate((p) => ({ ...p, sort: next, page: 1 }));
  };

  const handleExport = () => {
    const csv = generateCSV(
      rows.map((r) => ({
        bu_code: r.bu_code,
        bu_name: r.bu_name,
        cluster_name: r.cluster_name,
        monthly_used: r.monthly_used,
        monthly_quota: r.monthly_quota,
        topup_remaining: r.topup_remaining,
        available: r.available,
        low: r.low ? t('pages.aiCredit.low') : '',
      })),
      [
        { key: 'bu_code', label: t('pages.storageLicense.buCode') },
        { key: 'bu_name', label: t('entity.businessUnit.title') },
        { key: 'cluster_name', label: t('common.label.cluster') },
        { key: 'monthly_used', label: t('pages.aiCredit.monthlyUsed') },
        { key: 'monthly_quota', label: t('pages.aiCredit.fleetColMonthly') },
        { key: 'topup_remaining', label: t('pages.aiCredit.fleetColTopup') },
        { key: 'available', label: t('pages.aiCredit.fleetColAvailable') },
        { key: 'low', label: t('pages.aiCredit.low') },
      ],
    );
    downloadCSV(csv, `ai-credit-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const columns = useMemo<ColumnDef<AiCreditSummaryRow, unknown>[]>(
    () => [
      {
        id: 'name',
        accessorFn: (r) => r.bu_name,
        header: t('pages.aiCredit.fleetColBu'),
        meta: { card: 'title' },
        cell: ({ row }) => (
          <div className="flex flex-col">
            <Link to={buHref(row.original.business_unit_id)} className="text-primary hover:underline">
              {row.original.bu_name}
            </Link>
            <span className="text-xs text-muted-foreground font-mono">{row.original.bu_code}</span>
          </div>
        ),
      },
      {
        id: 'cluster_name',
        accessorFn: (r) => r.cluster_name,
        header: t('common.label.cluster'),
        enableSorting: false,
        cell: ({ row }) => <span>{row.original.cluster_name || '-'}</span>,
      },
      {
        id: 'monthly',
        header: t('pages.aiCredit.fleetColMonthly'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.monthly_quota > 0 ? (
            <span className="text-xs font-mono whitespace-nowrap">
              {row.original.monthly_used.toLocaleString()} / {row.original.monthly_quota.toLocaleString()}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{t('pages.aiCredit.noMonthlyQuota')}</span>
          ),
      },
      {
        id: 'topup_remaining',
        header: t('pages.aiCredit.fleetColTopup'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-xs font-mono whitespace-nowrap">{row.original.topup_remaining.toLocaleString()}</span>
        ),
      },
      {
        id: 'available',
        header: t('pages.aiCredit.fleetColAvailable'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-xs font-mono whitespace-nowrap">{row.original.available.toLocaleString()}</span>
        ),
      },
      {
        id: 'low',
        header: t('pages.aiCredit.low'),
        enableSorting: false,
        meta: { card: 'badge' },
        cell: ({ row }) => (row.original.low ? <Badge variant="warning">{t('pages.aiCredit.low')}</Badge> : null),
      },
    ],
    [t],
  );

  const filtered = !!search;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            ref={searchInputRef}
            value={search}
            onValueChange={handleSearchChange}
            onClear={handleSearchClear}
            placeholder={t('pages.licenses.searchLicensesPlaceholder')}
            className="min-w-0 flex-1 sm:max-w-sm"
          />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={loading || loadFailed || rows.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              {t('common.action.export')}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loadFailed ? (
          <EmptyState
            icon={AlertTriangle}
            title={t('pages.licenses.loadFailedTitle')}
            description={t('pages.licenses.loadFailedDescription')}
            action={
              <Button variant="outline" size="sm" onClick={() => fetchRows()} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCw className="mr-2 h-4 w-4" />}
                {loading ? t('pages.licenses.retryingEllipsis') : t('common.action.retry')}
              </Button>
            }
          />
        ) : loading && rows.length === 0 ? (
          <TableSkeleton columns={columns.length + 1} rows={paginate.perpage || 5} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title={t('pages.licenses.noLicensesTitle')}
            description={filtered ? t('pages.licenses.noLicensesMatchFilters') : t('pages.aiCredit.fleetNone')}
            action={
              filtered ? (
                <Button variant="outline" size="sm" onClick={handleSearchClear}>
                  {t('pages.licenses.clearFiltersAction')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="relative">
            {loading && (
              <div
                className="absolute inset-0 bg-background/50 flex items-center justify-center z-10"
                role="status"
                aria-label={t('pages.licenses.loadingLicensesAria')}
              >
                <div className="text-muted-foreground">{t('common.busy.loading')}</div>
              </div>
            )}
            <DataTable
              columns={columns}
              data={rows}
              serverSide
              tableLayout="auto"
              totalRows={totalRows}
              page={paginate.page}
              perpage={paginate.perpage}
              onPaginateChange={handlePaginateChange}
              onSortChange={handleSortChange}
              defaultSort={{ id: DEFAULT_SORT_ID, desc: false }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AiCreditSummaryTable;

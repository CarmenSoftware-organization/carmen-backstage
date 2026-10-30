import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useGlobalShortcuts } from '../components/KeyboardShortcuts';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { PageHeader } from '../components/PageHeader';
import licenseIntakeService from '../services/licenseIntakeService';
import { getErrorDetail, devLog } from '../utils/errorParser';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { DataTable } from '../components/ui/data-table';
import { Inbox, Download } from 'lucide-react';
import { toast } from 'sonner';
import { SearchInput } from '../components/SearchInput';
import { ListEmptyState } from '../components/ListEmptyState';
import { generateCSV, downloadCSV } from '../utils/csvExport';
import { TableSkeleton } from '../components/TableSkeleton';
import { DevDebugSheet } from '../components/ui/dev-debug-sheet';
import { useI18n } from '../hooks/useI18n';
import { LicenseSummaryBand, type SummaryBandItem } from './licenses/LicenseSummaryBand';
import { readStoredPerpage } from '../utils/pageRange';
import type {
  LicenseIntake,
  LicenseIntakeGroup,
  LicenseIntakeStatus,
  LicenseIntakeSummary,
  PaginateParams,
} from '../types';
import type { ColumnDef } from '@tanstack/react-table';

type StatusFilter = LicenseIntakeStatus | 'all';

const isStatusFilter = (v: string | null): v is StatusFilter =>
  v === 'all' || v === 'pending' || v === 'confirmed' || v === 'rejected';

// all = ไม่ส่งตัวกรอง · อื่น ๆ กรองบนคอลัมน์ status ของ intake (scalar column เท่านั้น)
const buildAdvance = (status: StatusFilter) =>
  status === 'all' ? '' : JSON.stringify({ where: { status } });

const STATUS_VARIANT: Record<LicenseIntakeStatus, 'warning' | 'success' | 'secondary'> = {
  pending: 'warning',
  confirmed: 'success',
  rejected: 'secondary',
};

// start/end_date เป็นวันปฏิทิน — ตัด YYYY-MM-DD ตรง ๆ ไม่ผ่าน Date กันวันเลื่อนตาม timezone
const dayOf = (v?: string | null): string => (v ? v.slice(0, 10) : '-');

const fmtDate = (v?: string | null): string => {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const periodOf = (row: LicenseIntake): string =>
  row.start_date || row.end_date ? `${dayOf(row.start_date)} → ${dayOf(row.end_date)}` : '-';

// summary มาได้ทั้ง {data:{...}} และก้อนเปล่า — รับทั้งสองรูป
const unwrapSummary = (raw: unknown): LicenseIntakeSummary | undefined => {
  const o = raw as { data?: unknown } | null;
  const s = (o && typeof o === 'object' && 'data' in o && o.data ? o.data : raw) as Partial<LicenseIntakeSummary> | null;
  if (!s || typeof s.pending !== 'number') return undefined;
  return { pending: s.pending, confirmed: s.confirmed ?? 0, rejected: s.rejected ?? 0 };
};

const GroupChips: React.FC<{ groups?: LicenseIntakeGroup[]; missingLabel: string; missingTitle: (code: string) => string }> = ({
  groups,
  missingLabel,
  missingTitle,
}) => {
  if (!groups || groups.length === 0) return <span className="text-muted-foreground">-</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {groups.map((g) =>
        g.missing ? (
          <Badge key={g.code} variant="outline" className="font-normal border-dashed text-muted-foreground" title={missingTitle(g.code)}>
            {g.code} ({missingLabel})
          </Badge>
        ) : (
          <Badge key={g.code} variant="outline" className="font-normal" title={g.code}>
            {g.name || g.code}
          </Badge>
        ),
      )}
    </div>
  );
};

const LicenseIntakeManagement: React.FC = () => {
  const { t } = useI18n();
  const [items, setItems] = useState<LicenseIntake[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<LicenseIntakeSummary | undefined>(undefined);
  const [summaryError, setSummaryError] = useState('');
  const [rawResponse, setRawResponse] = useState<unknown>(null);

  const storedSearch = localStorage.getItem('search_license_intakes') || '';
  const storedStatusRaw = localStorage.getItem('status_license_intakes');
  const storedStatus: StatusFilter = isStatusFilter(storedStatusRaw) ? storedStatusRaw : 'pending';
  const storedPage = Number(localStorage.getItem('page_license_intakes')) || 1;
  const storedSort = localStorage.getItem('sort_license_intakes') || 'created_at:desc';

  const [searchTerm, setSearchTerm] = useState(storedSearch);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(storedStatus);
  const [paginate, setPaginate] = useState<PaginateParams>({
    page: storedPage,
    perpage: readStoredPerpage('perpage_license_intakes', 10),
    search: storedSearch,
    sort: storedSort,
    advance: buildAdvance(storedStatus),
    filter: {},
  });

  // DataTable อ่าน defaultSort เป็นค่าเริ่มต้นครั้งเดียว — คำนวณจาก sort ที่กู้คืนมา
  // เพื่อให้ลูกศรหัวคอลัมน์ตรงกับลำดับแถวจริงหลังรีโหลด ('' = ผู้ใช้ล้างการเรียง)
  const [initialSort] = useState<{ id: string; desc: boolean } | undefined>(() => {
    const [id, dir] = storedSort.split(':');
    return id ? { id, desc: dir !== 'asc' } : undefined;
  });

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // กัน response เก่าทับใหม่เมื่อกดแถบสถานะ/พิมพ์ค้นหารัว ๆ
  const reqId = useRef(0);

  useGlobalShortcuts({ onSearch: () => searchInputRef.current?.focus() });

  useEffect(() => () => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const raw = await licenseIntakeService.getSummary();
      const s = unwrapSummary(raw);
      if (s) {
        setSummary(s);
        setSummaryError('');
      } else {
        setSummaryError(t('pages.licenseIntakes.summaryLoadFailed'));
      }
    } catch (err: unknown) {
      setSummaryError(t('pages.licenseIntakes.summaryLoadFailed'));
      devLog('Error fetching license intake summary:', err);
    }
  }, [t]);

  const fetchItems = useCallback(async (params: PaginateParams = paginate) => {
    const mine = ++reqId.current;
    try {
      setLoading(true);
      const data = await licenseIntakeService.getAll(params);
      if (mine !== reqId.current) return;
      setRawResponse(data);
      const list = data.data ?? [];
      setItems(list);
      setTotalRows(data.paginate?.total ?? data.total ?? list.length);
      setError('');
    } catch (err: unknown) {
      if (mine !== reqId.current) return;
      setError(t('pages.licenseIntakes.loadFailed', { detail: getErrorDetail(err, t) }));
      devLog('Error fetching license intakes:', err);
    } finally {
      if (mine === reqId.current) setLoading(false);
    }
  }, [paginate, t]);

  useEffect(() => {
    fetchItems(paginate);
  }, [fetchItems, paginate]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    localStorage.setItem('search_license_intakes', value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      localStorage.setItem('page_license_intakes', '1');
      setPaginate(prev => ({ ...prev, page: 1, search: value }));
    }, 400);
  };

  const handlePaginateChange = ({ page, perpage }: { page: number; perpage: number }) => {
    localStorage.setItem('perpage_license_intakes', String(perpage));
    localStorage.setItem('page_license_intakes', String(page));
    setPaginate(prev => ({ ...prev, page, perpage }));
  };

  const handleStatusFilter = (status: StatusFilter) => {
    setStatusFilter(status);
    localStorage.setItem('status_license_intakes', status);
    localStorage.setItem('page_license_intakes', '1');
    setPaginate(prev => ({ ...prev, page: 1, advance: buildAdvance(status), filter: {} }));
  };

  const handleSortChange = (sort: string) => {
    localStorage.setItem('sort_license_intakes', sort);
    localStorage.setItem('page_license_intakes', '1');
    setPaginate(prev => ({ ...prev, sort, page: 1 }));
  };

  const statusLabel = useCallback((s?: LicenseIntakeStatus) => {
    if (s === 'confirmed') return t('pages.licenseIntakes.statusConfirmed');
    if (s === 'rejected') return t('pages.licenseIntakes.statusRejected');
    return t('pages.licenseIntakes.statusPending');
  }, [t]);

  const groupNames = (groups?: LicenseIntakeGroup[]) =>
    (groups ?? []).map((g) => (g.missing ? `${g.code} (${t('pages.licenseIntakes.groupMissing')})` : g.name || g.code)).join('; ');

  const handleExport = () => {
    const rows = items.map((item) => ({
      source_sale_id: item.source_sale_id ?? '',
      ar_number: item.ar_number ?? '',
      customer: item.customer?.name ?? item.customer?.ar_number ?? '',
      status: statusLabel(item.status),
      seats: item.seats ?? '',
      modules: groupNames(item.module_groups),
      interfaces: groupNames(item.interface_groups),
      start_date: dayOf(item.start_date),
      end_date: dayOf(item.end_date),
      created_at: fmtDate(item.created_at ?? item.audit?.created?.at),
    }));
    const csv = generateCSV(rows, [
      { key: 'source_sale_id', label: t('pages.licenseIntakes.columnSaleId') },
      { key: 'ar_number', label: t('pages.licenseIntakes.columnArNumber') },
      { key: 'customer', label: t('pages.licenseIntakes.columnCustomer') },
      { key: 'status', label: t('common.status.label') },
      { key: 'seats', label: t('pages.licenseIntakes.columnSeats') },
      { key: 'modules', label: t('pages.licenseIntakes.columnModules') },
      { key: 'interfaces', label: t('pages.licenseIntakes.columnInterfaces') },
      { key: 'start_date', label: `${t('pages.licenseIntakes.columnPeriod')} (start)` },
      { key: 'end_date', label: `${t('pages.licenseIntakes.columnPeriod')} (end)` },
      { key: 'created_at', label: t('pages.licenseIntakes.columnReceived') },
    ]);
    downloadCSV(csv, `license-intakes-${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success(t('toast.exported'));
  };

  const columns = useMemo<ColumnDef<LicenseIntake, unknown>[]>(() => {
    const missingTitle = (code: string) => t('pages.licenseIntakes.groupMissingTitle', { code });
    const missingLabel = t('pages.licenseIntakes.groupMissing');
    return [
      {
        accessorKey: 'status',
        header: t('common.status.label'),
        meta: { card: 'badge' },
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANT[row.original.status] ?? 'secondary'}>{statusLabel(row.original.status)}</Badge>
        ),
      },
      {
        accessorKey: 'source_sale_id',
        header: t('pages.licenseIntakes.columnSaleId'),
        meta: { card: 'title' },
        cell: ({ row }) => (
          <Link
            to={`/license-intakes/${row.original.id}`}
            className="font-mono text-[13px] font-medium hover:underline"
          >
            {row.original.source_sale_id || row.original.id}
          </Link>
        ),
      },
      {
        accessorKey: 'ar_number',
        header: t('pages.licenseIntakes.columnArNumber'),
        cell: ({ row }) => row.original.ar_number
          ? <span className="font-mono text-xs">{row.original.ar_number}</span>
          : <span className="text-muted-foreground">-</span>,
      },
      {
        // ชื่อลูกค้ามาจาก join — เรียงฝั่ง server ไม่ได้
        id: 'customer',
        accessorFn: (row: LicenseIntake) => row.customer?.name ?? '',
        header: t('pages.licenseIntakes.columnCustomer'),
        enableSorting: false,
        cell: ({ row }) => row.original.customer
          ? (row.original.customer.name || row.original.customer.ar_number)
          : <Badge variant="outline" className="font-normal">{t('pages.licenseIntakes.customerNotFound')}</Badge>,
      },
      {
        accessorKey: 'seats',
        header: t('pages.licenseIntakes.columnSeats'),
        cell: ({ row }) => <span className="tabular-nums">{row.original.seats ?? '-'}</span>,
      },
      {
        id: 'modules',
        accessorFn: (row: LicenseIntake) => row.module_groups?.length ?? 0,
        header: t('pages.licenseIntakes.columnModules'),
        enableSorting: false,
        cell: ({ row }) => (
          <GroupChips groups={row.original.module_groups} missingLabel={missingLabel} missingTitle={missingTitle} />
        ),
      },
      {
        id: 'interfaces',
        accessorFn: (row: LicenseIntake) => row.interface_groups?.length ?? 0,
        header: t('pages.licenseIntakes.columnInterfaces'),
        enableSorting: false,
        cell: ({ row }) => (
          <GroupChips groups={row.original.interface_groups} missingLabel={missingLabel} missingTitle={missingTitle} />
        ),
      },
      {
        // ช่วงเวลา = start_date → end_date สองคอลัมน์ — เรียงตาม start_date
        id: 'start_date',
        accessorFn: (row: LicenseIntake) => row.start_date ?? '',
        header: t('pages.licenseIntakes.columnPeriod'),
        cell: ({ row }) => <span className="tabular-nums whitespace-nowrap text-xs">{periodOf(row.original)}</span>,
      },
      {
        accessorKey: 'created_at',
        header: t('pages.licenseIntakes.columnReceived'),
        cell: ({ row }) => <span className="tabular-nums text-xs">{fmtDate(row.original.created_at ?? row.original.audit?.created?.at)}</span>,
      },
    ];
  }, [t, statusLabel]);

  const bandItems: SummaryBandItem[] = [
    { key: 'pending', label: t('pages.licenseIntakes.summaryPending'), value: summary?.pending, color: 'text-warning', onClick: () => handleStatusFilter('pending'), active: statusFilter === 'pending' },
    { key: 'confirmed', label: t('pages.licenseIntakes.summaryConfirmed'), value: summary?.confirmed, color: 'text-success', onClick: () => handleStatusFilter('confirmed'), active: statusFilter === 'confirmed' },
    { key: 'rejected', label: t('pages.licenseIntakes.summaryRejected'), value: summary?.rejected, color: 'text-muted-foreground', onClick: () => handleStatusFilter('rejected'), active: statusFilter === 'rejected' },
    {
      key: 'all',
      label: t('pages.licenseIntakes.summaryAll'),
      value: summary ? summary.pending + summary.confirmed + summary.rejected : undefined,
      color: 'text-foreground',
      onClick: () => handleStatusFilter('all'),
      active: statusFilter === 'all',
    },
  ];

  const activeFilterCount = statusFilter === 'all' ? 0 : 1;

  return (
    <Layout>
      <div className="space-y-6 sm:space-y-8">
        <PageHeader
          title={t('pages.licenseIntakes.title')}
          subtitle={t('pages.licenseIntakes.subtitle')}
          actions={
            <Button variant="outline" size="sm" onClick={handleExport} disabled={loading || items.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              {t('common.action.exportCsv')}
            </Button>
          }
        />

        <LicenseSummaryBand
          items={bandItems}
          loading={!summary && !summaryError}
          error={summaryError}
          onRetry={fetchSummary}
        />

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-2">
              <SearchInput
                ref={searchInputRef}
                value={searchTerm}
                onValueChange={handleSearchChange}
                placeholder={t('pages.licenseIntakes.searchPlaceholder')}
                className="flex-1 sm:max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md" role="alert">{error}</div>}

            {!error && items.length === 0 && !loading ? (
              <ListEmptyState
                searchTerm={searchTerm}
                activeFilterCount={activeFilterCount}
                icon={Inbox}
                emptyTitle={t('pages.licenseIntakes.emptyTitle')}
                emptyDescription={t('pages.licenseIntakes.emptyDescription')}
              />
            ) : !error ? (
              <div className="relative">
                {loading && items.length === 0 ? (
                  <TableSkeleton columns={columns.length + 1} rows={paginate.perpage || 5} />
                ) : (
                  <>
                    {loading && (
                      <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10" role="status" aria-label={t('pages.licenseIntakes.loadingAria')}>
                        <div className="text-muted-foreground">{t('pages.licenseIntakes.loading')}</div>
                      </div>
                    )}
                    <DataTable
                      columns={columns}
                      data={items}
                      serverSide
                      tableLayout="auto"
                      totalRows={totalRows}
                      page={paginate.page}
                      perpage={paginate.perpage}
                      onPaginateChange={handlePaginateChange}
                      onSortChange={handleSortChange}
                      defaultSort={initialSort}
                    />
                  </>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <DevDebugSheet title="API Response" endpoint="GET /api-system/backstage/license-intakes" data={rawResponse} />
    </Layout>
  );
};

export default LicenseIntakeManagement;

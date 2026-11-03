import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Download, FileText, Loader2, Plus, RotateCw } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { DataTable } from '../../components/ui/data-table';
import { EmptyState } from '../../components/EmptyState';
import { SearchInput } from '../../components/SearchInput';
import { TableSkeleton } from '../../components/TableSkeleton';
import Can from '../../components/Can';
import { useGlobalShortcuts } from '../../components/KeyboardShortcuts';
import { useAuth } from '../../context/AuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useI18n } from '../../hooks/useI18n';
import { generateCSV, downloadCSV } from '../../utils/csvExport';
import { devLog } from '../../utils/errorParser';
import { auditColumns } from '../../components/auditColumns';
import { normalizeAudit, auditCsvFields } from '../../utils/audit';
import { formatBytes } from '../../utils/storageQuota';
import { readStoredPerpage } from '../../utils/pageRange';
import storageLicenseService from '../../services/businessUnitStorageLicenseService';
import backstageConfigService from '../../services/backstageConfigService';
import { LicenseSummaryBand, type SummaryBandItem } from './LicenseSummaryBand';
import type { BuStorageLicenseRow, BuStorageLicenseSummary, StorageQuotaConfig } from '../../types';
import type { ColumnDef } from '@tanstack/react-table';

const PAGE_KEY = 'page_storage_license';
const PERPAGE_KEY = 'perpage_storage_license';
const SORT_KEY = 'sort_storage_license';
const SEARCH_KEY = 'search_storage_license';

const DEFAULT_SORT_ID = 'created_at';
const DEFAULT_SORT_DESC = true;
// created_at ซ้ำกันได้ (migration ออกหลายใบพร้อมกัน) — id ตัดสินเสมอเพื่อให้หน้าไม่ซ้ำไม่หาย
const SORT_TIEBREAKER = 'id:asc';
const DEFAULT_SORT = `${DEFAULT_SORT_ID}:${DEFAULT_SORT_DESC ? 'desc' : 'asc'},${SORT_TIEBREAKER}`;

const withTiebreaker = (sort: string): string => {
  const s = sort.trim();
  if (!s) return DEFAULT_SORT;
  const alreadyHasId = s.split(/[;,]/).some((part) => part.trim().startsWith('id:'));
  return alreadyHasId ? s : `${s},${SORT_TIEBREAKER}`;
};

/** note ที่ migration ใส่ให้ใบที่แปลงมาจากโควตาที่ตั้งมือแบบเดิม */
const MIGRATED_NOTE = 'Migrated from manual quota';

type SourceKind = 'intake' | 'manual' | 'migrated';
const sourceOf = (r: BuStorageLicenseRow): SourceKind =>
  r.license_intake_id ? 'intake' : r.note === MIGRATED_NOTE ? 'migrated' : 'manual';

/**
 * ตารางใบ storage quota ทั้ง fleet — server-side (Rule 13) ไม่มีวันหมดอายุจึงไม่มี Days Left /
 * ตัวกรองวัน / ตัวกรองสถานะ และไม่มีมุมมอง "ลบแล้ว" (LicenseCenter ไม่ส่ง `deletedView` ให้แท็บนี้)
 * ใบใหม่แทนที่ใบเก่า (`superseded_*`) ไม่ลบ จึงเห็นเป็นสถานะ "ถูกแทนที่"
 */
export function StorageLicenseTable() {
  const { t } = useI18n();
  const { hasPermission } = useAuth();
  const canReadConfig = hasPermission('backstage_config.read');

  // ค่า default สดจาก config `storage_quota` — อ่านเฉพาะเมื่อมีสิทธิ์ เพราะ 401 จะเตะผู้ใช้ออกจากระบบ
  // ไม่มีสิทธิ์/อ่านไม่ได้ = ป้ายเปล่า ๆ "Default" ไม่มีขนาด
  const [defaults, setDefaults] = useState<{ db: number; file: number } | null>(null);
  useEffect(() => {
    if (!canReadConfig) return undefined;
    let cancelled = false;
    backstageConfigService
      .getByKey('storage_quota')
      .then((cfg) => {
        const v = (cfg?.value ?? {}) as Partial<StorageQuotaConfig>;
        if (!cancelled && typeof v.default_db_bytes === 'number' && typeof v.default_file_bytes === 'number') {
          setDefaults({ db: v.default_db_bytes, file: v.default_file_bytes });
        }
      })
      .catch((err: unknown) => devLog('Failed to load storage_quota default:', err));
    return () => { cancelled = true; };
  }, [canReadConfig]);

  const quotaLabel = useCallback(
    (bytes: number | null, def: number | undefined) => {
      if (bytes !== null) return formatBytes(bytes);
      return def === undefined
        ? t('pages.storageLicense.defaultNoSize')
        : t('pages.storageLicense.default', { size: formatBytes(def) });
    },
    [t],
  );

  const [rows, setRows] = useState<BuStorageLicenseRow[]>([]);
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

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const data = await storageLicenseService.listBackstage({
        page: paginate.page,
        perpage: paginate.perpage,
        sort: paginate.sort,
        // searchfields ว่าง = backend ค้นเลขที่ใบ/เลขอ้างอิง + code/ชื่อ BU ให้เอง (ค่า default ของ
        // service ค้นแค่สองฟิลด์แรก) · คีย์บนสายเป็นตัวเล็กล้วน service จัดการให้
        ...(debouncedSearch ? { search: debouncedSearch, searchfields: [] } : {}),
      });
      setRows(data.data);
      setTotalRows(data.paginate?.total ?? data.data.length);
      setLoadFailed(false);
    } catch (err: unknown) {
      // 0 ใบกับโหลดไม่ได้ต้องแยกกัน — ไม่ปล่อยแถวเก่าค้างหลัง error
      setRows([]);
      setTotalRows(0);
      setLoadFailed(true);
      devLog('Failed to load storage licenses:', err);
    } finally {
      setLoading(false);
    }
  }, [paginate, debouncedSearch]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  // แถบสรุป: ไม่ผูกกับค้นหา/หน้า — ตัวเลขทั้ง fleet นิ่งเสมอ
  const [summary, setSummary] = useState<BuStorageLicenseSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      setSummary(await storageLicenseService.summary());
      setSummaryError('');
    } catch (err: unknown) {
      setSummaryError(t('pages.licenses.loadFailedTitle'));
      devLog('Failed to load storage license summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, [t]);
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const summaryItems: SummaryBandItem[] = [
    { key: 'in_force', label: t('pages.storageLicense.inForce'), value: summary?.in_force, color: 'text-success' },
    { key: 'replaced', label: t('pages.storageLicense.replaced'), value: summary?.replaced, color: 'text-foreground' },
    {
      key: 'bus_without_license',
      label: t('pages.storageLicense.busWithoutLicense'),
      value: summary?.bus_without_license,
      color: summary?.bus_without_license ? 'text-warning' : 'text-muted-foreground',
    },
  ];

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

  const sourceLabel = useCallback(
    (r: BuStorageLicenseRow) => t(`pages.storageLicense.source.${sourceOf(r)}` as const),
    [t],
  );
  const statusText = useCallback(
    (r: BuStorageLicenseRow) =>
      r.superseded_at
        ? r.superseded_by
          ? `${t('pages.storageLicense.replaced')} → ${r.superseded_by.license_number}`
          : t('pages.storageLicense.replaced')
        : t('pages.storageLicense.inForce'),
    [t],
  );

  const handleExport = () => {
    const csvRows = rows.map((r) => ({
      license_number: r.license_number,
      bu_code: r.tb_business_unit.code,
      bu_name: r.tb_business_unit.name,
      cluster_name: r.tb_business_unit.cluster?.name ?? '',
      db_quota: quotaLabel(r.db_quota_bytes, defaults?.db),
      file_quota: quotaLabel(r.file_quota_bytes, defaults?.file),
      status: statusText(r),
      source: sourceLabel(r),
      reference_no: r.reference_no ?? '',
      ...auditCsvFields(normalizeAudit(r)),
    }));
    const csv = generateCSV(csvRows, [
      { key: 'license_number', label: t('pages.licenses.licenseNumber') },
      { key: 'bu_code', label: t('pages.storageLicense.buCode') },
      { key: 'bu_name', label: t('entity.businessUnit.title') },
      { key: 'cluster_name', label: t('common.label.cluster') },
      { key: 'db_quota', label: t('pages.storageLicense.dbQuota') },
      { key: 'file_quota', label: t('pages.storageLicense.fileQuota') },
      { key: 'status', label: t('common.status.label') },
      { key: 'source', label: t('pages.storageLicense.sourceColumn') },
      { key: 'reference_no', label: t('pages.licenses.referenceNoColumn') },
      { key: 'created_at', label: t('common.audit.createdAt') },
      { key: 'created_by', label: t('common.audit.createdBy') },
    ]);
    downloadCSV(csv, `storage-licenses-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const columns = useMemo<ColumnDef<BuStorageLicenseRow, unknown>[]>(() => {
    const [createdColumn] = auditColumns<BuStorageLicenseRow>({ t });
    return [
      {
        accessorKey: 'license_number',
        header: t('pages.licenses.licenseNumber'),
        meta: { card: 'title' },
        cell: ({ row }) => (
          <Link
            to={`/licenses/storage/${row.original.id}/edit`}
            className="text-primary hover:underline whitespace-nowrap"
          >
            {row.original.license_number}
          </Link>
        ),
      },
      {
        id: 'tb_business_unit.name',
        accessorFn: (r) => r.tb_business_unit.name,
        header: t('entity.businessUnit.title'),
        meta: { card: 'title' },
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span>{row.original.tb_business_unit.name}</span>
            <span className="text-xs text-muted-foreground font-mono">{row.original.tb_business_unit.code}</span>
          </div>
        ),
      },
      {
        id: 'tb_business_unit.cluster.name',
        accessorFn: (r) => r.tb_business_unit.cluster?.name ?? '',
        header: t('common.label.cluster'),
        cell: ({ row }) => <span>{row.original.tb_business_unit.cluster?.name || '-'}</span>,
      },
      {
        id: 'db_quota_bytes',
        accessorFn: (r) => r.db_quota_bytes ?? 0,
        header: t('pages.storageLicense.dbQuota'),
        cell: ({ row }) => (
          <span className={`text-xs whitespace-nowrap ${row.original.db_quota_bytes === null ? 'text-muted-foreground' : 'font-mono'}`}>
            {quotaLabel(row.original.db_quota_bytes, defaults?.db)}
          </span>
        ),
      },
      {
        id: 'file_quota_bytes',
        accessorFn: (r) => r.file_quota_bytes ?? 0,
        header: t('pages.storageLicense.fileQuota'),
        cell: ({ row }) => (
          <span className={`text-xs whitespace-nowrap ${row.original.file_quota_bytes === null ? 'text-muted-foreground' : 'font-mono'}`}>
            {quotaLabel(row.original.file_quota_bytes, defaults?.file)}
          </span>
        ),
      },
      {
        id: 'status',
        header: t('common.status.label'),
        enableSorting: false,
        meta: { card: 'badge' },
        cell: ({ row }) => {
          const r = row.original;
          if (!r.superseded_at) return <Badge variant="success">{t('pages.storageLicense.inForce')}</Badge>;
          return (
            <div className="flex flex-col items-start gap-0.5">
              <Badge variant="secondary">{t('pages.storageLicense.replaced')}</Badge>
              {r.superseded_by && (
                <span className="text-xs text-muted-foreground font-mono">→ {r.superseded_by.license_number}</span>
              )}
            </div>
          );
        },
      },
      {
        id: 'source',
        header: t('pages.storageLicense.sourceColumn'),
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          if (r.license_intake_id) {
            return (
              <Link to={`/license-intakes/${r.license_intake_id}`} className="text-xs text-primary hover:underline">
                {sourceLabel(r)}
              </Link>
            );
          }
          return <span className="text-xs text-muted-foreground">{sourceLabel(r)}</span>;
        },
      },
      createdColumn,
    ];
  }, [t, quotaLabel, defaults, sourceLabel]);

  const filtered = !!search;

  return (
    <div className="space-y-6 sm:space-y-8">
      <LicenseSummaryBand items={summaryItems} loading={summaryLoading} error={summaryError} onRetry={fetchSummary} />

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
              <Can permission="subscription.manage">
                <Button size="sm" asChild>
                  <Link to="/licenses/storage/new">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('pages.storageLicense.issue')}
                  </Link>
                </Button>
              </Can>
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
              icon={FileText}
              title={t('pages.licenses.noLicensesTitle')}
              description={filtered ? t('pages.licenses.noLicensesMatchFilters') : t('pages.storageLicense.noneYet')}
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
                stickyLeftColumns={2}
                totalRows={totalRows}
                page={paginate.page}
                perpage={paginate.perpage}
                onPaginateChange={handlePaginateChange}
                onSortChange={handleSortChange}
                defaultSort={{ id: DEFAULT_SORT_ID, desc: DEFAULT_SORT_DESC }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default StorageLicenseTable;

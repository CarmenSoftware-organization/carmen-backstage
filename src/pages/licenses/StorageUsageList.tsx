import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, HardDrive, RefreshCw, SearchX } from 'lucide-react';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import Layout from '../../components/Layout';
import { PageHeader } from '../../components/PageHeader';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import Can from '../../components/Can';
import { DataTable } from '../../components/ui/data-table';
import { TableSkeleton } from '../../components/TableSkeleton';
import { FetchErrorState } from '../../components/FetchErrorState';
import { EmptyState } from '../../components/EmptyState';
import { SearchInput } from '../../components/SearchInput';
import { useGlobalShortcuts } from '../../components/KeyboardShortcuts';
import { cn } from '../../lib/utils';
import { useI18n } from '../../hooks/useI18n';
import { useAuth } from '../../context/AuthContext';
import storageQuotaService from '../../services/storageQuotaService';
import { devLog, getErrorDetail } from '../../utils/errorParser';
import { generateCSV, downloadCSV } from '../../utils/csvExport';
import { formatBytes, usedPct } from '../../utils/storageQuota';
import type { StorageKind, StorageMeasureAllStatus, StorageUsageListItem } from '../../types';
import { StorageFlagBadge } from '../clusterAdmin/businessUnitForm/StorageMeter';
import { LicenseSummaryBand, type SummaryBandItem } from './LicenseSummaryBand';
import { Skeleton } from '../../components/ui/skeleton';

/** ระดับที่ถือว่า "ใกล้เต็ม" — ตรงกับสีเตือนของ StorageMeter */
const NEAR_PCT = 80;
/**
 * ปลายแถบคือ 120% ไม่ใช่ 100% — เส้น 80% และ 100% จึงอยู่ตำแหน่งเดียวกันทุกแถวและมองเห็นได้
 * แถวที่เกินโควตายังเห็นว่าเกินไปเท่าไร แทนที่จะชนขอบเท่ากันหมด
 */
const SCALE_PCT = 120;

type UsageFilter = 'near' | 'over' | 'blocked' | 'licensed';

const kindOf = (row: StorageUsageListItem, kind: StorageKind) => row.kinds.find((k) => k.kind === kind);
const pctOf = (row: StorageUsageListItem, kind: StorageKind): number | null => {
  const usage = kindOf(row, kind);
  return usage ? usedPct(usage) : null;
};
const isOver = (row: StorageUsageListItem) => row.kinds.some((k) => usedPct(k) >= 100);
const isNear = (row: StorageUsageListItem) => row.kinds.some((k) => {
  const p = usedPct(k);
  return p >= NEAR_PCT && p < 100;
});
const isBlocked = (row: StorageUsageListItem) => row.kinds.some((k) => k.blocking);

const FILTERS: Record<UsageFilter, (row: StorageUsageListItem) => boolean> = {
  near: isNear,
  over: isOver,
  blocked: isBlocked,
  licensed: (row) => !!row.license_number,
};

/** เซลล์ของหนึ่ง kind: ใช้ไป / โควตา + % บนแถบที่มีเส้น 80% กับ 100% — แถวปกติจางลง แถวที่ต้องดูเด่นขึ้น */
const KindCell: React.FC<{ row: StorageUsageListItem; kind: StorageKind }> = ({ row, kind }) => {
  const { t } = useI18n();
  const usage = kindOf(row, kind);
  if (!usage) return <span className="text-muted-foreground text-xs">{t('pages.storageQuota.notMeasured')}</span>;
  const pct = usedPct(usage);
  const tone = pct >= 100 ? 'over' : pct >= NEAR_PCT ? 'near' : 'ok';
  return (
    <div className="space-y-1 font-mono text-xs tabular-nums">
      <div className={cn(tone === 'ok' && 'text-muted-foreground')}>
        <span className={cn(tone !== 'ok' && 'text-foreground')}>{formatBytes(usage.used_bytes)}</span>
        {' / '}
        {formatBytes(usage.quota_bytes)}{' '}
        <span
          className={cn(
            tone === 'over' && 'text-destructive font-semibold',
            tone === 'near' && 'text-warning font-semibold',
          )}
        >
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="bg-muted relative h-1.5 w-36 overflow-hidden rounded-full" aria-hidden="true">
        <div
          className={cn(
            'h-full rounded-full',
            tone === 'over' ? 'bg-destructive' : tone === 'near' ? 'bg-warning' : 'bg-muted-foreground/40',
          )}
          style={{ width: `${(Math.min(SCALE_PCT, pct) / SCALE_PCT) * 100}%` }}
        />
        <span
          className="bg-border absolute inset-y-0 w-px"
          style={{ left: `${(NEAR_PCT / SCALE_PCT) * 100}%` }}
        />
        <span
          className="bg-foreground/50 absolute inset-y-0 w-px"
          style={{ left: `${(100 / SCALE_PCT) * 100}%` }}
        />
      </div>
      {usage.exceeded_at && (
        <div className="text-muted-foreground font-sans">
          {t('pages.storageQuota.exceededAt', { date: new Date(usage.exceeded_at).toLocaleDateString() })}
        </div>
      )}
    </div>
  );
};

interface KindTotal {
  used: number;
  quota: number;
  count: number;
}

/** ผลรวมทั้ง fleet ของหนึ่ง kind — นับเฉพาะ BU ที่มีผลวัดของ kind นั้น */
const totalOf = (rows: StorageUsageListItem[], kind: StorageKind): KindTotal =>
  rows.reduce<KindTotal>(
    (acc, row) => {
      const usage = kindOf(row, kind);
      if (!usage) return acc;
      return { used: acc.used + usage.used_bytes, quota: acc.quota + usage.quota_bytes, count: acc.count + 1 };
    },
    { used: 0, quota: 0, count: 0 },
  );

/**
 * การ์ดพื้นที่รวมทั้ง fleet: database กับไฟล์แนบ ใช้ไปรวมเทียบโควตาที่จัดสรรรวม
 * นับจากทุก BU ไม่ตามตัวกรอง — เป็นภาพรวมที่นิ่ง ไม่ใช่ผลรวมของแถวที่เห็น
 */
const StorageTotalsCard: React.FC<{ rows: StorageUsageListItem[]; loading: boolean }> = ({ rows, loading }) => {
  const { t } = useI18n();
  const kinds: { kind: StorageKind; label: string }[] = [
    { kind: 'database', label: t('pages.storageQuota.totalDatabase') },
    { kind: 'attachment', label: t('pages.storageQuota.totalAttachment') },
  ];
  return (
    <Card>
      <CardContent className="grid p-0 sm:grid-cols-2 sm:divide-x sm:divide-border">
        {kinds.map(({ kind, label }, i) => {
          const total = totalOf(rows, kind);
          const pct = total.quota > 0 ? (total.used / total.quota) * 100 : 0;
          return (
            <div key={kind} className={cn('space-y-2 p-4 sm:p-5', i > 0 && 'border-t border-border sm:border-t-0')}>
              <div className="text-muted-foreground text-xs font-medium">{label}</div>
              {loading ? (
                <>
                  <Skeleton className="h-7 w-28" />
                  <Skeleton className="h-3 w-48" />
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
                      {formatBytes(total.used)}
                    </span>
                    <span className="text-muted-foreground font-mono text-xs tabular-nums">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="bg-muted h-1.5 w-full max-w-xs overflow-hidden rounded-full" aria-hidden="true">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t('pages.storageQuota.totalOfAllocated', {
                      quota: formatBytes(total.quota),
                      count: total.count,
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

/**
 * รายการการใช้พื้นที่ของทุก BU เรียงจากเต็มสุด (ผลวัดที่เก็บไว้ ไม่วัดใหม่) — ทีม Carmen ใช้ดูว่า
 * BU ไหนใกล้เต็มก่อนเปิดสวิตช์ enforce · กดชื่อ BU ไปแท็บ Licenses เพื่อออกใบ storage/วัดทันที
 *
 * client-filtered list (rule 13): ชุดข้อมูลถูกจำกัดด้วยจำนวน BU และมาในการเรียกครั้งเดียว
 * จึงกรองในหน้าโดยไม่ debounce
 */
const StorageUsageList: React.FC = () => {
  const { t } = useI18n();
  const { hasPermission } = useAuth();
  const canOpenBu = hasPermission('cluster.update');
  const canReadQuota = hasPermission('storage_quota.read');
  const [rows, setRows] = useState<StorageUsageListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<UsageFilter | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [measureAll, setMeasureAll] = useState<StorageMeasureAllStatus | null>(null);
  const [startingMeasureAll, setStartingMeasureAll] = useState(false);
  const measureRunning = measureAll?.running === true;

  useGlobalShortcuts({ onSearch: () => searchInputRef.current?.focus() });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setRows((await storageQuotaService.listUsage()) ?? []);
    } catch (err: unknown) {
      setRows([]);
      setError(getErrorDetail(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // เปิดหน้าระหว่างงานวัดรันอยู่ → กลับมาแสดงความคืบหน้า (เรียกเฉพาะผู้มี storage_quota.read — 401 เตะผู้ใช้ออก)
  useEffect(() => {
    if (!canReadQuota) return;
    let cancelled = false;
    storageQuotaService
      .getMeasureAll()
      .then((status) => {
        if (!cancelled && status?.running) setMeasureAll(status);
      })
      .catch((err: unknown) => devLog('storage measure-all status', err));
    return () => {
      cancelled = true;
    };
  }, [canReadQuota]);

  // poll ทุก 5 วิขณะรัน; จบแล้ว toast + โหลดรายการใหม่ · cancelled กัน setState หลัง unmount
  useEffect(() => {
    if (!measureRunning || !canReadQuota) return;
    let cancelled = false;
    const timer = setInterval(() => {
      storageQuotaService
        .getMeasureAll()
        .then((status) => {
          if (cancelled || !status) return;
          setMeasureAll(status);
          if (status.running) return;
          clearInterval(timer);
          if (status.failed > 0) {
            toast.warning(
              t('pages.storageQuota.measureAllDoneWithFailures', { total: status.total, failed: status.failed }),
            );
          } else {
            toast.success(t('pages.storageQuota.measureAllDone', { total: status.total }));
          }
          void load();
        })
        .catch((err: unknown) => devLog('storage measure-all poll', err));
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [measureRunning, canReadQuota, load, t]);

  const handleMeasureAll = async () => {
    setStartingMeasureAll(true);
    try {
      setMeasureAll(await storageQuotaService.startMeasureAll());
    } catch (err: unknown) {
      toast.error(getErrorDetail(err));
    } finally {
      setStartingMeasureAll(false);
    }
  };

  const counts = useMemo(
    () => ({
      near: rows.filter(isNear).length,
      over: rows.filter(isOver).length,
      blocked: rows.filter(isBlocked).length,
      licensed: rows.filter(FILTERS.licensed).length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (row) =>
        (!filter || FILTERS[filter](row)) &&
        (!q || row.bu_code.toLowerCase().includes(q) || row.bu_name.toLowerCase().includes(q)),
    );
  }, [rows, search, filter]);

  const toggle = (key: UsageFilter) => setFilter((prev) => (prev === key ? null : key));

  const summaryItems: SummaryBandItem[] = [
    {
      key: 'all',
      label: t('pages.storageQuota.sumAll'),
      value: loading ? undefined : rows.length,
      color: 'text-foreground',
      onClick: () => setFilter(null),
      active: filter === null,
    },
    {
      key: 'near',
      label: t('pages.storageQuota.sumNear'),
      value: loading ? undefined : counts.near,
      color: counts.near ? 'text-warning' : 'text-muted-foreground',
      onClick: () => toggle('near'),
      active: filter === 'near',
    },
    {
      key: 'over',
      label: t('pages.storageQuota.sumOver'),
      value: loading ? undefined : counts.over,
      color: counts.over ? 'text-destructive' : 'text-muted-foreground',
      onClick: () => toggle('over'),
      active: filter === 'over',
    },
    {
      key: 'blocked',
      label: t('pages.storageQuota.sumBlocked'),
      value: loading ? undefined : counts.blocked,
      color: counts.blocked ? 'text-destructive' : 'text-muted-foreground',
      onClick: () => toggle('blocked'),
      active: filter === 'blocked',
    },
    {
      key: 'licensed',
      label: t('pages.storageQuota.sumLicensed'),
      value: loading ? undefined : counts.licensed,
      color: 'text-foreground',
      onClick: () => toggle('licensed'),
      active: filter === 'licensed',
    },
  ];

  const columns = useMemo<ColumnDef<StorageUsageListItem>[]>(
    () => [
      {
        id: 'bu',
        accessorFn: (row) => row.bu_code,
        header: t('pages.storageQuota.colBu'),
        meta: { card: 'title' },
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="font-medium">
              {canOpenBu ? (
                <Link
                  to={`/business-units/${encodeURIComponent(row.original.bu_id)}/edit?tab=licenses`}
                  className="text-primary hover:underline"
                >
                  {row.original.bu_code}
                </Link>
              ) : (
                row.original.bu_code
              )}
            </div>
            <div className="text-muted-foreground truncate text-xs">{row.original.bu_name}</div>
          </div>
        ),
      },
      {
        id: 'database',
        accessorFn: (row) => pctOf(row, 'database') ?? -1,
        header: t('pages.storageQuota.database'),
        cell: ({ row }) => <KindCell row={row.original} kind="database" />,
      },
      {
        id: 'attachment',
        accessorFn: (row) => pctOf(row, 'attachment') ?? -1,
        header: t('pages.storageQuota.attachment'),
        cell: ({ row }) => <KindCell row={row.original} kind="attachment" />,
      },
      {
        id: 'source',
        accessorFn: (row) => row.license_number ?? '',
        header: t('pages.storageQuota.colSource'),
        cell: ({ row }) =>
          row.original.license_number ? (
            <span className="font-mono text-xs">{row.original.license_number}</span>
          ) : (
            <span className="text-muted-foreground text-xs">{t('pages.storageQuota.sourceDefault')}</span>
          ),
      },
      {
        id: 'status',
        accessorFn: (row) => (isBlocked(row) ? 3 : isOver(row) ? 2 : row.exempt ? 1 : 0),
        header: t('pages.storageQuota.colStatus'),
        meta: { card: 'badge' },
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.exempt && <Badge variant="secondary">{t('pages.storageQuota.exemptBadge')}</Badge>}
            {isBlocked(row.original) && <Badge variant="destructive">{t('pages.storageQuota.blocking')}</Badge>}
            {Array.from(new Set(row.original.kinds.map((k) => k.flag).filter(Boolean))).map((f) => (
              <StorageFlagBadge key={f} flag={f} />
            ))}
          </div>
        ),
      },
      {
        id: 'measured_at',
        accessorFn: (row) => row.measured_at ?? '',
        header: t('pages.storageQuota.colMeasured'),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {row.original.measured_at
              ? new Date(row.original.measured_at).toLocaleString()
              : t('pages.storageQuota.neverMeasured')}
          </span>
        ),
      },
    ],
    [t, canOpenBu],
  );

  const handleExport = () => {
    const db = t('pages.storageQuota.database');
    const file = t('pages.storageQuota.attachment');
    const data = visible.map((row) => {
      const d = kindOf(row, 'database');
      const a = kindOf(row, 'attachment');
      return {
        bu_code: row.bu_code,
        bu_name: row.bu_name,
        db_used: d?.used_bytes ?? '',
        db_quota: d?.quota_bytes ?? '',
        db_pct: d ? usedPct(d).toFixed(1) : '',
        file_used: a?.used_bytes ?? '',
        file_quota: a?.quota_bytes ?? '',
        file_pct: a ? usedPct(a).toFixed(1) : '',
        source: row.license_number ?? t('pages.storageQuota.sourceDefault'),
        exempt: row.exempt ? 'yes' : 'no',
        blocked: isBlocked(row) ? 'yes' : 'no',
        measured_at: row.measured_at ?? '',
      };
    });
    const csv = generateCSV(data, [
      { key: 'bu_code', label: t('pages.storageQuota.colBu') },
      { key: 'bu_name', label: t('common.field.name') },
      { key: 'db_used', label: t('pages.storageQuota.csvUsedBytes', { kind: db }) },
      { key: 'db_quota', label: t('pages.storageQuota.csvQuotaBytes', { kind: db }) },
      { key: 'db_pct', label: t('pages.storageQuota.csvPct', { kind: db }) },
      { key: 'file_used', label: t('pages.storageQuota.csvUsedBytes', { kind: file }) },
      { key: 'file_quota', label: t('pages.storageQuota.csvQuotaBytes', { kind: file }) },
      { key: 'file_pct', label: t('pages.storageQuota.csvPct', { kind: file }) },
      { key: 'source', label: t('pages.storageQuota.colSource') },
      { key: 'exempt', label: t('pages.storageQuota.exemptBadge') },
      { key: 'blocked', label: t('pages.storageQuota.blocking') },
      { key: 'measured_at', label: t('pages.storageQuota.colMeasured') },
    ]);
    downloadCSV(csv, t('pages.storageQuota.csvFile'));
  };

  const clearFilters = () => {
    setSearch('');
    setFilter(null);
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        <PageHeader title={t('pages.storageQuota.listTitle')} subtitle={t('pages.storageQuota.listSubtitle')} />

        {!error && <StorageTotalsCard rows={rows} loading={loading && rows.length === 0} />}

        {!error && <LicenseSummaryBand items={summaryItems} loading={loading} error="" onRetry={load} />}

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput
                ref={searchInputRef}
                value={search}
                onValueChange={setSearch}
                onClear={() => setSearch('')}
                placeholder={t('pages.storageQuota.searchPlaceholder')}
                className="min-w-0 flex-1 sm:max-w-sm"
              />
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <Can permission="storage_quota.manage">
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => void handleMeasureAll()}
                    disabled={measureRunning || startingMeasureAll}
                  >
                    <RefreshCw
                      className={cn('mr-2 h-4 w-4', (measureRunning || startingMeasureAll) && 'animate-spin')}
                    />
                    {measureRunning
                      ? t('pages.storageQuota.measuringAll', {
                          done: measureAll?.done ?? 0,
                          total: measureAll?.total ?? 0,
                        })
                      : t('pages.storageQuota.measureAll')}
                  </Button>
                </Can>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={handleExport}
                  disabled={loading || visible.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {t('common.action.export')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {error ? (
              <div className="py-10">
                <FetchErrorState message={error} onRetry={load} />
              </div>
            ) : loading && rows.length === 0 ? (
              <TableSkeleton columns={6} rows={6} />
            ) : rows.length === 0 ? (
              <EmptyState icon={HardDrive} title={t('pages.storageQuota.listEmpty')} />
            ) : visible.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title={t('pages.storageQuota.listNoMatch')}
                description={t('pages.storageQuota.listNoMatchHint')}
                action={
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    {t('pages.storageQuota.clearFilters')}
                  </Button>
                }
              />
            ) : (
              <DataTable columns={columns} data={visible} tableLayout="auto" pageSize={50} />
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default StorageUsageList;

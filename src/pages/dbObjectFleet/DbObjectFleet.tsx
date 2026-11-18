import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layers, Loader2, Plus, RefreshCw } from 'lucide-react';
import Layout from '../../components/Layout';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../hooks/useI18n';
import sqlQueryService from '../../services/sqlQueryService';
import { fetchAllBusinessUnits } from '../../utils/fetchAllBusinessUnits';
import { mapWithConcurrency } from '../../utils/concurrent';
import { getErrorDetail } from '../../utils/errorParser';
import { cn } from '../../lib/utils';
import type { DbObjectKind } from '../../types';
import { ObjectList } from './ObjectList';
import { ObjectDetail } from './ObjectDetail';
import {
  buildFleetRows,
  matchesFilter,
  summarizeRows,
  type BuScan,
  type FleetBu,
  type RowFilter,
} from './fleetMatrix';
import { FLEET_CONCURRENCY, apiErrorMessage, withRateLimitRetry } from './fleetRequest';

/**
 * DB objects across BUs: reads every view / function / procedure of every BU, shows which BUs
 * lack an object or hold a different definition, and rolls one definition out to the BUs that
 * need it — tried on all of them with a rollback first, applied for real only after that passes.
 * Each BU is one request (one tenant transaction), so the page drives the fleet BU by BU.
 */
export default function DbObjectFleet() {
  const { t } = useI18n();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('sql_workbench.manage');

  const [bus, setBus] = useState<FleetBu[]>([]);
  const [busLoading, setBusLoading] = useState(true);
  const [busError, setBusError] = useState<string | null>(null);
  const [scans, setScans] = useState<Record<string, BuScan>>({});
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState<RowFilter>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | DbObjectKind>('all');
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const mountedRef = useRef(true);

  // Set in the body too: StrictMode runs mount → cleanup → mount, and a ref left false by the
  // first cleanup would drop every scan result for the life of the page.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const scan = useCallback(
    async (codes: string[]) => {
      if (codes.length === 0) return;
      setScanning(true);
      // A BU read before keeps its last result until the new one lands. Flipping it to loading
      // would drop it from the comparison, and an object held only by the BUs being re-read
      // (just applied everywhere, or just dropped) would vanish and close its open detail.
      setScans((prev) => ({
        ...prev,
        ...Object.fromEntries(
          codes.filter((c) => prev[c]?.state !== 'ok').map((c) => [c, { state: 'loading' } as BuScan]),
        ),
      }));
      await mapWithConcurrency(
        codes,
        FLEET_CONCURRENCY,
        (code) => withRateLimitRetry(() => sqlQueryService.getFingerprints(code)),
        (code, _i, res, err) => {
          if (!mountedRef.current) return;
          setScans((prev) => ({
            ...prev,
            [code]: err || !res
              ? { state: 'error', message: apiErrorMessage(err, t('pages.dbObjectFleet.scanFailed')) }
              : { state: 'ok', objects: res.objects },
          }));
        },
      );
      if (mountedRef.current) setScanning(false);
    },
    [t],
  );

  useEffect(() => {
    let stale = false;
    (async () => {
      try {
        const all = await fetchAllBusinessUnits({ sort: 'code:asc', label: 'DbObjectFleet.bus' });
        if (stale) return;
        const list = all
          .filter((b) => b.is_active && b.db_schema)
          .map((b) => ({ code: b.code, name: b.name, schema: b.db_schema as string }));
        setBus(list);
        setBusLoading(false);
        void scan(list.map((b) => b.code));
      } catch (err) {
        if (stale) return;
        setBusError(t('pages.dbObjectFleet.loadBuFailed', { detail: getErrorDetail(err, t) }));
        setBusLoading(false);
      }
    })();
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => buildFleetRows(bus, scans), [bus, scans]);
  const summary = useMemo(() => summarizeRows(rows), [rows]);
  const scannedOk = bus.filter((b) => scans[b.code]?.state === 'ok').length;
  const scanErrors = bus.filter((b) => scans[b.code]?.state === 'error');
  const scannedDone = bus.filter((b) => scans[b.code] && scans[b.code].state !== 'loading').length;

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        matchesFilter(r, filter) &&
        (typeFilter === 'all' || r.type === typeFilter) &&
        (!q || r.name.toLowerCase().includes(q)),
    );
  }, [rows, filter, typeFilter, search]);

  const selectedRow = selectedKey ? rows.find((r) => r.key === selectedKey) ?? null : null;

  // Below `lg` the detail stacks under the list, out of sight — bring it up when one is picked.
  const detailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectedKey && !creating) return;
    if (typeof window.matchMedia !== 'function' || !window.matchMedia('(max-width: 1023px)').matches) return;
    detailRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [selectedKey, creating]);
  const onApplied = useCallback((codes: string[]) => void scan(codes), [scan]);

  const filterTiles: { key: RowFilter; label: string; value: number; tone: string }[] = [
    { key: 'all', label: t('pages.dbObjectFleet.tileAll'), value: summary.total, tone: '' },
    { key: 'same', label: t('pages.dbObjectFleet.tileSame'), value: summary.same, tone: 'text-success' },
    { key: 'missing', label: t('pages.dbObjectFleet.tileMissing'), value: summary.missing, tone: 'text-warning' },
    { key: 'differs', label: t('pages.dbObjectFleet.tileDiffers'), value: summary.differs, tone: 'text-info' },
  ];

  return (
    <Layout>
      <div className="space-y-4">
        <PageHeader
          title={t('pages.dbObjectFleet.title')}
          subtitle={t('pages.dbObjectFleet.subtitle')}
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={busLoading || scanning || busy || bus.length === 0}
                onClick={() => void scan(bus.map((b) => b.code))}
              >
                {scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                {t('pages.dbObjectFleet.rescan')}
              </Button>
              {canManage && (
                <Button
                  size="sm"
                  disabled={busLoading || scanning || busy || scannedOk === 0}
                  onClick={() => {
                    setSelectedKey(null);
                    setCreating(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t('pages.dbObjectFleet.newObject')}
                </Button>
              )}
            </>
          }
        />

        {busError && (
          <p role="alert" className="text-destructive text-sm">
            {busError}
          </p>
        )}

        <Card className="space-y-3 p-4">
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" role="status">
            {busLoading ? (
              <span>{t('pages.dbObjectFleet.loadingBus')}</span>
            ) : (
              <span>
                {t('pages.dbObjectFleet.scanProgress', { done: scannedDone, total: bus.length, ok: scannedOk })}
              </span>
            )}
            {scanErrors.length > 0 && (
              <span className="text-destructive">
                {t('pages.dbObjectFleet.scanErrors', {
                  count: scanErrors.length,
                  bus: scanErrors.map((b) => b.code).join(', '),
                })}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label={t('pages.dbObjectFleet.filterAria')}>
            {filterTiles.map((tile) => (
              <button
                key={tile.key}
                type="button"
                aria-pressed={filter === tile.key}
                onClick={() => setFilter(tile.key)}
                className={cn(
                  'rounded-md border px-3 py-2 text-left transition-colors',
                  filter === tile.key ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                )}
              >
                <span className={cn('block font-mono text-2xl font-semibold tabular-nums', tile.tone)}>
                  {scannedOk > 0 ? tile.value : '-'}
                </span>
                <span className="text-muted-foreground text-xs">{tile.label}</span>
              </button>
            ))}
          </div>
        </Card>

        {!busLoading && bus.length === 0 && !busError ? (
          <EmptyState icon={Layers} title={t('pages.dbObjectFleet.noBus')} />
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
            <div className={cn(busy && 'pointer-events-none opacity-60')} aria-disabled={busy || undefined}>
              <ObjectList
                rows={visibleRows}
                scannedBus={scannedOk}
                selectedKey={creating ? null : selectedKey}
                onSelect={(key) => {
                  setCreating(false);
                  setSelectedKey(key);
                }}
                search={search}
                onSearchChange={setSearch}
                typeFilter={typeFilter}
                onTypeFilterChange={setTypeFilter}
              />
            </div>
            <div ref={detailRef} className="min-w-0 scroll-mt-20">
              {creating || selectedRow ? (
                <ObjectDetail
                  key={creating ? 'new' : selectedRow?.key}
                  row={creating ? null : selectedRow}
                  bus={bus}
                  scans={scans}
                  canManage={canManage}
                  onApplied={onApplied}
                  onBusyChange={setBusy}
                />
              ) : (
                <div className="text-muted-foreground flex min-h-[16rem] items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm">
                  {t('pages.dbObjectFleet.pickObject')}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { PageHeader } from '../../components/PageHeader';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { TableSkeleton } from '../../components/TableSkeleton';
import { FetchErrorState } from '../../components/FetchErrorState';
import { cn } from '../../lib/utils';
import { useI18n } from '../../hooks/useI18n';
import { useAuth } from '../../context/AuthContext';
import storageQuotaService from '../../services/storageQuotaService';
import { getErrorDetail } from '../../utils/errorParser';
import { formatBytes, usedPct } from '../../utils/storageQuota';
import type { StorageKind, StorageUsageListItem } from '../../types';
import { StorageFlagBadge } from '../clusterAdmin/businessUnitForm/StorageMeter';

/** เซลล์ของหนึ่ง kind: ใช้ไป / โควตา + % (เกิน 100% เป็นสีแดง) */
const KindCell: React.FC<{ row: StorageUsageListItem; kind: StorageKind }> = ({ row, kind }) => {
  const { t } = useI18n();
  const usage = row.kinds.find((k) => k.kind === kind);
  if (!usage) return <span className="text-muted-foreground">{t('pages.storageQuota.notMeasured')}</span>;
  const pct = usedPct(usage);
  return (
    <div className="space-y-1 font-mono text-xs tabular-nums">
      <div>
        {formatBytes(usage.used_bytes)} / {formatBytes(usage.quota_bytes)}{' '}
        <span className={cn(pct >= 100 ? 'text-destructive font-semibold' : 'text-muted-foreground')}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="bg-muted h-1.5 w-32 overflow-hidden rounded-full" aria-hidden="true">
        <div
          className={cn('h-full', pct >= 100 ? 'bg-destructive' : pct >= 80 ? 'bg-warning' : 'bg-primary')}
          style={{ width: `${Math.min(100, pct)}%` }}
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

/**
 * รายการการใช้พื้นที่ของทุก BU เรียงจากเต็มสุด (ผลวัดที่เก็บไว้ ไม่วัดใหม่) — ทีม Carmen ใช้ดูว่า
 * BU ไหนใกล้เต็มก่อนเปิดสวิตช์ enforce · กดชื่อ BU ไปแท็บ Licenses เพื่อตั้งโควตา/วัดทันที
 */
const StorageUsageList: React.FC = () => {
  const { t } = useI18n();
  const { hasPermission } = useAuth();
  const canOpenBu = hasPermission('cluster.update');
  const [rows, setRows] = useState<StorageUsageListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setRows(await storageQuotaService.listUsage());
    } catch (err: unknown) {
      setError(getErrorDetail(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        <PageHeader title={t('pages.storageQuota.listTitle')} subtitle={t('pages.storageQuota.listSubtitle')} />
        <Card>
          <CardContent className="p-0">
            {error ? (
              <div className="py-10">
                <FetchErrorState message={error} onRetry={load} />
              </div>
            ) : loading ? (
              <TableSkeleton columns={5} rows={6} />
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground p-6 text-sm">{t('pages.storageQuota.listEmpty')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('pages.storageQuota.colBu')}</TableHead>
                    <TableHead>{t('pages.storageQuota.database')}</TableHead>
                    <TableHead>{t('pages.storageQuota.attachment')}</TableHead>
                    <TableHead>{t('pages.storageQuota.colStatus')}</TableHead>
                    <TableHead>{t('pages.storageQuota.colMeasured')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.bu_id}>
                      <TableCell>
                        <div className="font-medium">
                          {canOpenBu ? (
                            <Link
                              to={`/business-units/${row.bu_id}/edit?tab=licenses`}
                              className="text-primary hover:underline"
                            >
                              {row.bu_code}
                            </Link>
                          ) : (
                            row.bu_code
                          )}
                        </div>
                        <div className="text-muted-foreground text-xs">{row.bu_name}</div>
                      </TableCell>
                      <TableCell><KindCell row={row} kind="database" /></TableCell>
                      <TableCell><KindCell row={row} kind="attachment" /></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {row.exempt && <Badge variant="secondary">{t('pages.storageQuota.exemptBadge')}</Badge>}
                          {row.kinds.some((k) => k.blocking) && (
                            <Badge variant="destructive">{t('pages.storageQuota.blocking')}</Badge>
                          )}
                          {Array.from(new Set(row.kinds.map((k) => k.flag).filter(Boolean))).map((f) => (
                            <StorageFlagBadge key={f} flag={f} />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {row.measured_at ? new Date(row.measured_at).toLocaleString() : t('pages.storageQuota.neverMeasured')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default StorageUsageList;

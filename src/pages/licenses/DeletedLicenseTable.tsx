import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Archive, Loader2, MoreHorizontal, RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { DataTable } from '../../components/ui/data-table';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { EmptyState } from '../../components/EmptyState';
import { TableSkeleton } from '../../components/TableSkeleton';
import { TypeToConfirmDialog } from '../../components/TypeToConfirmDialog';
import { AuditMeta } from '../../components/AuditMeta';
import Can from '../../components/Can';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../hooks/useI18n';
import { devLog, licenseActionErrorMessage } from '../../utils/errorParser';
import { isUnknownActor, normalizeAudit, type AuditActor } from '../../utils/audit';
import { fmtCoverageRange } from './licenseDates';
import businessUnitLicenseService from '../../services/businessUnitLicenseService';
import clusterLicenseService from '../../services/clusterLicenseService';
import businessUnitInterfaceLicenseService from '../../services/businessUnitInterfaceLicenseService';
import subscriptionService from '../../services/subscriptionService';
import type { PaginateParams } from '../../types';
import type { TKey } from '../../i18n/types';

export type DeletedLicenseKind = 'subscription' | 'seat' | 'bu-quota' | 'interface';

/** service ของแต่ละชนิด — ทั้งสี่ตัวมี listDeleted/restore/hardDelete รูปเดียวกัน (Task 6) */
const SERVICES = {
  subscription: subscriptionService,
  seat: businessUnitLicenseService,
  'bu-quota': clusterLicenseService,
  interface: businessUnitInterfaceLicenseService,
} as const;

/** เจ้าของใบเป็น cluster เฉพาะใบโควตา BU — ชนิดอื่นเจ้าของคือ BU (สัญญาก็ผูกหนึ่ง BU) */
const OWNER_LABEL_KEYS: Record<DeletedLicenseKind, TKey> = {
  subscription: 'entity.businessUnit.title',
  seat: 'entity.businessUnit.title',
  'bu-quota': 'common.label.cluster',
  interface: 'entity.businessUnit.title',
};

/**
 * แถวกลางของตาราง — ทุกชนิดถูกแปลงมารูปนี้ที่ `toDeletedRow` ที่เดียว
 * The table's single row shape — every kind is mapped here once, in `toDeletedRow`.
 */
interface DeletedRow {
  id: string;
  number: string;
  owner_code: string;
  owner_name: string;
  start_date: string;
  end_date: string;
  deleted?: AuditActor;
}

function toDeletedRow(kind: DeletedLicenseKind, raw: unknown): DeletedRow {
  const r = raw as Record<string, string | undefined> & { id: string };
  const [ownerCode, ownerName] =
    kind === 'subscription' ? [r.bu_code, r.bu_name]
      : kind === 'bu-quota' ? [r.cluster_code, r.cluster_name]
        : [r.business_unit_code, r.business_unit_name];
  return {
    id: r.id,
    // สัญญาใช้ subscription_number ใบอื่นใช้ license_number — ค่านี้คือค่าที่ต้องพิมพ์ยืนยันด้วย
    number: (kind === 'subscription' ? r.subscription_number : r.license_number) ?? '',
    owner_code: ownerCode ?? '',
    owner_name: ownerName ?? '',
    start_date: r.start_date ?? '',
    end_date: r.end_date ?? '',
    deleted: normalizeAudit(raw).deleted,
  };
}

const SORT_TIEBREAKER = 'id:asc';

/**
 * ค่า sort ว่าง = ไม่ส่ง (backend เรียง `deleted_at desc` เอง) · ค่าอื่นต่อ tiebreaker `id` ให้หน้าไม่ซ้ำ/ไม่หาย
 * Empty sort = omit it (backend defaults to `deleted_at desc`); otherwise append the `id` tiebreaker.
 */
const withTiebreaker = (sort: string): string => (sort ? `${sort},${SORT_TIEBREAKER}` : '');

export interface DeletedLicenseTableProps {
  kind: DeletedLicenseKind;
}

/**
 * ตารางใบที่ถูกลบแบบซ่อนของชนิดหนึ่ง (superadmin เท่านั้น — LicenseCenter เป็นคนกั้นสวิตช์)
 * ต่อแถว: กู้คืน (`subscription.manage`) และลบถาวรแบบพิมพ์เลขใบยืนยัน (`isSuperAdmin`)
 *
 * Soft-deleted licences of one kind (superadmin only — LicenseCenter gates the toggle). Per row:
 * restore (`subscription.manage`) and type-to-confirm hard delete (`isSuperAdmin`).
 */
export function DeletedLicenseTable({ kind }: DeletedLicenseTableProps) {
  const { t } = useI18n();
  const { isSuperAdmin } = useAuth();
  const service = SERVICES[kind];
  const ownerLabel = t(OWNER_LABEL_KEYS[kind]);

  const [rows, setRows] = useState<DeletedRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [paginate, setPaginate] = useState({ page: 1, perpage: 20, sort: '' });
  const [restoreRow, setRestoreRow] = useState<DeletedRow | null>(null);
  const [hardDeleteRow, setHardDeleteRow] = useState<DeletedRow | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params: PaginateParams = {
        page: paginate.page,
        perpage: paginate.perpage,
        ...(paginate.sort ? { sort: paginate.sort } : {}),
      };
      const data = await service.listDeleted(params);
      setRows((data.data as unknown[]).map((r) => toDeletedRow(kind, r)));
      setTotalRows(data.paginate?.total ?? data.data.length);
      setLoadFailed(false);
    } catch (err: unknown) {
      setRows([]);
      setTotalRows(0);
      setLoadFailed(true);
      devLog(`Failed to load deleted ${kind} licenses:`, err);
    } finally {
      setLoading(false);
    }
  }, [kind, service, paginate]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  /**
   * โหลดใหม่หลังกู้คืน/ลบสำเร็จ — ถ้าแถวที่หายไปเป็นแถวสุดท้ายของหน้า ≥2 ให้ถอยหนึ่งหน้า
   * (setPaginate ทำให้ fetch เอง) ไม่งั้นหน้าเดิมว่างแล้วขึ้น "ไม่มีใบที่ลบ" ทั้งที่ยังมีหน้าก่อนหน้า
   * Reload after a successful action; step back a page when the last row of page ≥2 went away.
   */
  const reloadAfterAction = async () => {
    if (rows.length === 1 && paginate.page > 1) {
      setPaginate((p) => ({ ...p, page: p.page - 1 }));
    } else {
      await fetchRows();
    }
  };

  const handleRestore = async () => {
    if (!restoreRow) return;
    try {
      await service.restore(restoreRow.id);
      toast.success(t('pages.licenses.deleted.restored'));
      await reloadAfterAction();
    } catch (err: unknown) {
      toast.error(licenseActionErrorMessage(err, t));
    } finally {
      setRestoreRow(null);
    }
  };

  const handleHardDelete = async () => {
    if (!hardDeleteRow) return;
    setBusy(true);
    try {
      await service.hardDelete(hardDeleteRow.id);
      toast.success(t('pages.licenses.deleted.hardDeleted'));
      setHardDeleteRow(null);
      await reloadAfterAction();
    } catch (err: unknown) {
      toast.error(licenseActionErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo<ColumnDef<DeletedRow, unknown>[]>(() => [
    {
      // id = ชื่อคอลัมน์จริงบนสาย (DataTable ส่ง id นี้เป็นค่า sort ตรง ๆ)
      id: kind === 'subscription' ? 'subscription_number' : 'license_number',
      accessorKey: 'number',
      header: t('pages.licenses.licenseNumber'),
      meta: { card: 'title' },
      cell: ({ row }) => <span className="font-mono text-xs whitespace-nowrap">{row.original.number}</span>,
    },
    {
      // เจ้าของเป็น relation — สัญญาที่ลบแล้วเรียงด้วย bu_* ไม่ได้ (422) ปิดทุกชนิดให้ตารางนี้พูดแบบเดียวกัน
      id: 'owner',
      accessorKey: 'owner_name',
      header: ownerLabel,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span>{row.original.owner_name || '-'}</span>
          <span className="text-xs text-muted-foreground font-mono">{row.original.owner_code}</span>
        </div>
      ),
    },
    {
      id: 'end_date',
      accessorKey: 'end_date',
      header: t('pages.licenses.coverageColumn'),
      cell: ({ row }) => (
        <span className="text-xs whitespace-nowrap">
          {fmtCoverageRange(row.original.start_date, row.original.end_date, t('common.state.noExpiry'))}
        </span>
      ),
    },
    {
      id: 'deleted_at',
      accessorFn: (r) => r.deleted?.at ?? '',
      header: t('pages.licenses.deleted.deletedAt'),
      cell: ({ row }) => <AuditMeta variant="cell" actor={{ at: row.original.deleted?.at }} />,
    },
    {
      id: 'deleted_by',
      accessorFn: (r) => r.deleted?.name ?? '',
      header: t('pages.licenses.deleted.deletedBy'),
      enableSorting: false,
      cell: ({ row }) => {
        const name = row.original.deleted?.name;
        return (
          <span className="text-xs text-muted-foreground">
            {!name ? '-' : isUnknownActor(name) ? t('common.state.unknownUser') : name}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      meta: { headerClassName: 'w-10', cellClassName: 'text-center p-0', card: 'actions' },
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={t('common.action.rowActions', { name: row.original.number })}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <Can permission="subscription.manage">
              <DropdownMenuItem onClick={() => setRestoreRow(row.original)} className="cursor-pointer">
                <RotateCcw className="mr-2 h-4 w-4" />
                {t('pages.licenses.deleted.restore')}
              </DropdownMenuItem>
            </Can>
            {isSuperAdmin && (
              <DropdownMenuItem
                onClick={() => setHardDeleteRow(row.original)}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('pages.licenses.deleted.hardDelete')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [kind, t, ownerLabel, isSuperAdmin]);

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          {loadFailed ? (
            <EmptyState
              icon={AlertTriangle}
              title={t('pages.licenses.loadFailedTitle')}
              description={t('pages.licenses.loadFailedDescription')}
              action={
                <Button variant="outline" size="sm" onClick={() => fetchRows()} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCw className="mr-2 h-4 w-4" />}
                  {t('common.action.retry')}
                </Button>
              }
            />
          ) : loading && rows.length === 0 ? (
            // +1 เผื่อคอลัมน์ลำดับแถวที่ DataTable ใส่ให้เองเสมอ
            <TableSkeleton columns={columns.length + 1} rows={5} />
          ) : rows.length === 0 ? (
            <EmptyState icon={Archive} title={t('pages.licenses.deleted.empty')} />
          ) : (
            <div className="relative">
              {loading && (
                <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10"
                     role="status" aria-label={t('pages.licenses.loadingLicensesAria')}>
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
                onPaginateChange={({ page, perpage }) => setPaginate((p) => ({ ...p, page, perpage }))}
                onSortChange={(sort) => setPaginate((p) => ({ ...p, sort: withTiebreaker(sort), page: 1 }))}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={restoreRow !== null}
        onOpenChange={(open) => { if (!open) setRestoreRow(null); }}
        title={t('pages.licenses.deleted.restore')}
        description={t('pages.licenses.deleted.restoreConfirm')}
        confirmText={t('pages.licenses.deleted.restore')}
        onConfirm={handleRestore}
      />

      <TypeToConfirmDialog
        open={hardDeleteRow !== null}
        onOpenChange={(open) => { if (!open) setHardDeleteRow(null); }}
        title={t('pages.licenses.deleted.hardDeleteTitle')}
        description={t('pages.licenses.deleted.hardDeleteWarning')}
        confirmValue={hardDeleteRow?.number ?? ''}
        confirmLabel={t('pages.licenses.deleted.hardDelete')}
        inputLabel={t('pages.licenses.deleted.hardDeleteType', { number: hardDeleteRow?.number ?? '' })}
        busy={busy}
        onConfirm={handleHardDelete}
      />
    </>
  );
}

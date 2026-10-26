import React, { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { MoreHorizontal, Trash2, Users } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { DataTable } from '../../components/ui/data-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { ListEmptyState } from '../../components/ListEmptyState';
import { TableSkeleton } from '../../components/TableSkeleton';
import clusterService from '../../services/clusterService';
import { parseApiError } from '../../utils/errorParser';
import { auditColumns } from '../../components/auditColumns';
import { useI18n } from '../../hooks/useI18n';
import { ROLE_LABEL_KEYS, roleLabel } from '../../utils/roleLabels';
import { SeatCell } from '../../components/clusterSeat/SeatCell';
import { SeatActions } from '../../components/clusterSeat/SeatActions';
import type { ClusterUser } from '../../types';
import type { ColumnDef } from '@tanstack/react-table';

const ROLES = ['admin', 'user'] as const;

function displayName(member: ClusterUser): string {
  const parts = [member.userInfo?.firstname, member.userInfo?.middlename, member.userInfo?.lastname].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return member.name || member.username || '-';
}

interface MembersTableProps {
  members: ClusterUser[];
  loading: boolean;
  /** Narrows the already-loaded rows. Task 9 sets this when a duplicate invitation is rejected. */
  searchTerm: string;
  onChanged: () => void;
  clusterId: string;
  /** The signed-in user's id — SeatActions warns on self-release. */
  currentUserId?: string;
  /** Called after a seat release/restore: the parent refetches members and the seat pool. */
  onSeatChanged: () => void;
}

/**
 * Cluster membership table for the cluster-admin Users page. The role/remove writes need no
 * `clusterId` — the membership row id (`member.id`) already scopes `updateClusterUser` /
 * `deleteClusterUser` to the right record; `clusterId` is here only for the seat actions.
 *
 * Seat release/restore acts on the member's BU links (not on the membership row), so rows never
 * disappear from this list when a seat is released. The reason Status/Deactivate stay absent
 * (below) is unchanged.
 *
 * No Status column and no Activate/Deactivate action, deliberately: `GET
 * /api-system/user/clusters/:clusterId` (`cluster.service.ts` on the backend) hard-filters to
 * `is_active: true` and never selects the column, so `member.is_active` is always `undefined`
 * here — a Status column could only ever render one value, and every row would show
 * "Inactive" with an "Activate" action that no-ops. Deactivating would be worse: the row would
 * vanish from a list that cannot show inactive members, leaving no way to reactivate from this
 * page. Do not re-add either without the backend first returning `is_active` from this endpoint.
 */
const MembersTable: React.FC<MembersTableProps> = ({
  members, loading, searchTerm, onChanged, clusterId, currentUserId, onSeatChanged,
}) => {
  const { t } = useI18n();
  const [removeTarget, setRemoveTarget] = useState<ClusterUser | null>(null);
  const [seatHoldersOnly, setSeatHoldersOnly] = useState(false);

  // Old backends send no `seat`; then the column and filter would only ever show "No seat".
  const hasSeatData = useMemo(() => members.some((m) => m.seat !== undefined), [members]);

  const rows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const base = hasSeatData && seatHoldersOnly ? members.filter((m) => m.seat?.holds) : members;
    if (!q) return base;
    return base.filter(
      (m) =>
        (m.email ?? '').toLowerCase().includes(q) ||
        (m.username ?? '').toLowerCase().includes(q) ||
        (m.name ?? '').toLowerCase().includes(q),
    );
  }, [members, searchTerm, seatHoldersOnly, hasSeatData]);

  const handleRoleChange = useCallback(async (member: ClusterUser, role: string) => {
    try {
      await clusterService.updateClusterUser(member.id, { role });
      toast.success(t('pages.clusterAdmin.roleUpdated'));
      onChanged();
    } catch (err: unknown) {
      const { message } = parseApiError(err, t);
      toast.error(t('pages.clusterAdmin.roleUpdateFailed'), { description: message });
    }
  }, [onChanged, t]);

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    try {
      await clusterService.deleteClusterUser(removeTarget.id);
      toast.success(t('pages.clusterAdmin.memberRemoved'));
      setRemoveTarget(null);
      onChanged();
    } catch (err: unknown) {
      const { message } = parseApiError(err, t);
      toast.error(t('pages.clusterAdmin.memberRemoveFailed'), { description: message });
    }
  };

  const columns = useMemo<ColumnDef<ClusterUser, unknown>[]>(() => {
    const [createdColumn, updatedColumn] = auditColumns<ClusterUser>({ t });
    return [
      {
        id: 'name',
        header: t('common.field.name'),
        accessorFn: (row) => displayName(row),
        meta: { card: 'title' },
        cell: ({ row }) => <span>{displayName(row.original)}</span>,
      },
      {
        accessorKey: 'email',
        header: t('common.field.email'),
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.email || '-'}</span>,
      },
      {
        accessorKey: 'role',
        // "Cluster Role" ไม่ใช่ "Role" เฉย ๆ เพราะผู้ใช้คนเดียวถือได้ทั้งบทบาทระดับ cluster
        // (ตารางนี้) และบทบาทระดับ BU (คอลัมน์ "BU Role" ในหน้า Business Unit) — ตาราง
        // Invitations ข้างกันใช้ชื่อนี้อยู่แล้ว สองตารางในหน้าเดียวกันจึงเรียกของอย่างเดียวกันเหมือนกัน
        header: t('common.label.clusterRole'),
        // w-36 ไม่ใช่ w-28: "Cluster Role" ต้องการ 95px + ไอคอน sort 13px แต่ w-28 (112px)
        // หัก padding แล้วเหลือ 88px หัวคอลัมน์จึงห่อเป็นสองบรรทัด
        meta: { headerClassName: 'w-36', cellClassName: 'w-36' },
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            {roleLabel(t, row.original.role)}
          </Badge>
        ),
      },
      ...(hasSeatData ? [{
        id: 'seat',
        header: t('pages.clusters.columnSeat'),
        enableSorting: false,
        // Buttons live in this cell, not in the pinned actions column — they made that column
        // too wide at 390px.
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-2">
            <SeatCell seat={row.original.seat} />
            <SeatActions user={row.original} clusterId={clusterId} currentUserId={currentUserId} onDone={onSeatChanged} />
          </div>
        ),
      } satisfies ColumnDef<ClusterUser, unknown>] : []),
      createdColumn,
      updatedColumn,
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { headerClassName: 'w-10', cellClassName: 'w-10', card: 'actions' },
        cell: ({ row }) => {
          const member = row.original;
          const currentRole = member.role ?? 'user';
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('common.action.rowActions', { name: displayName(member) })}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {ROLES.filter((r) => r !== currentRole).map((r) => (
                  <DropdownMenuItem
                    key={r}
                    onClick={() => void handleRoleChange(member, r)}
                    className="cursor-pointer"
                  >
                    {t('pages.clusterAdmin.makeRole', { role: t(ROLE_LABEL_KEYS[r]) })}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setRemoveTarget(member)}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('common.action.remove')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ];
  }, [handleRoleChange, t, clusterId, currentUserId, onSeatChanged, hasSeatData]);

  if (loading && members.length === 0) {
    // +1 accounts for the `#` row-index column DataTable always prepends.
    return <TableSkeleton columns={columns.length + 1} rows={5} />;
  }

  const seatFilter = !hasSeatData ? null : (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={seatHoldersOnly ? 'secondary' : 'outline'}
        size="sm"
        aria-pressed={seatHoldersOnly}
        onClick={() => setSeatHoldersOnly((v) => !v)}
      >
        {t('pages.clusters.seatHoldersOnly')}
      </Button>
    </div>
  );

  if (!loading && rows.length === 0) {
    return (
      <>
        {seatFilter}
        <ListEmptyState
          searchTerm={searchTerm}
          activeFilterCount={hasSeatData && seatHoldersOnly ? 1 : 0}
          icon={Users}
          emptyTitle={t('pages.clusterAdmin.noMembersYet')}
          emptyDescription={t('pages.clusterAdmin.inviteToAccessHint')}
        />
      </>
    );
  }

  return (
    <div className="relative">
      {seatFilter}
      {loading && members.length > 0 && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10" role="status" aria-label={t('pages.clusterAdmin.loadingMembersAria')}>
          <div className="text-muted-foreground">{t('pages.clusterAdmin.loadingMembers')}</div>
        </div>
      )}
      <DataTable columns={columns} data={rows} tableLayout="auto" />

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}
        title={t('pages.clusterAdmin.removeMemberTitle')}
        description={t('pages.clusterAdmin.removeMemberConfirm', { name: removeTarget ? displayName(removeTarget) : '' })}
        confirmText={t('common.action.remove')}
        confirmVariant="destructive"
        onConfirm={handleConfirmRemove}
      />
    </div>
  );
};

export default MembersTable;

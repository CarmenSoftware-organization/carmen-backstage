import React, { useState } from 'react';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { useI18n } from '../../hooks/useI18n';
import { seatUserLabel, useSeatActions } from './useSeatActions';
import type { ClusterUser } from '../../types';

interface SeatActionsProps {
  user: ClusterUser;
  clusterId: string;
  /** The signed-in user's id, to warn on self-release. */
  currentUserId?: string;
  onDone: () => void;
}

export const SeatActions: React.FC<SeatActionsProps> = ({
  user,
  clusterId,
  currentUserId,
  onDone,
}) => {
  const { t } = useI18n();
  const { release, restore, pendingId } = useSeatActions(clusterId, onDone);
  const [confirm, setConfirm] = useState<'release' | 'restore' | null>(null);

  const seat = user.seat;
  if (!seat || !user.user_id) return null;

  const canRelease = seat.holds;
  const canRestore = seat.links.some((l) => l.released);
  if (!canRelease && !canRestore) return null;

  const name = seatUserLabel(user);
  const isSelf = !!currentUserId && user.user_id === currentUserId;
  const busy = pendingId === user.id;

  return (
    <>
      <div className="flex items-center gap-2">
        {canRelease && (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirm('release')}>
            {t('components.clusterSeat.release')}
          </Button>
        )}
        {canRestore && (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirm('restore')}>
            {t('components.clusterSeat.restore')}
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirm === 'release'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('components.clusterSeat.releaseTitle')}
        description={
          t('components.clusterSeat.releaseDescription', { name }) +
          (isSelf ? ` ${t('components.clusterSeat.releaseSelfWarning')}` : '')
        }
        confirmText={t('components.clusterSeat.release')}
        confirmVariant="destructive"
        onConfirm={async () => {
          await release(user);
          setConfirm(null);
        }}
      />
      <ConfirmDialog
        open={confirm === 'restore'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('components.clusterSeat.restoreTitle')}
        description={t('components.clusterSeat.restoreDescription', { name })}
        confirmText={t('components.clusterSeat.restore')}
        onConfirm={async () => {
          await restore(user);
          setConfirm(null);
        }}
      />
    </>
  );
};

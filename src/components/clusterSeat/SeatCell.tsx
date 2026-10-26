import React from 'react';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { useI18n } from '../../hooks/useI18n';
import type { ClusterUserSeat } from '../../types';

interface SeatCellProps {
  /** Undefined when the backend predates seat management — nothing is rendered. */
  seat: ClusterUserSeat | undefined;
  /**
   * Drops the Holds seat / No seat badge for plain text. Holding a seat is the normal state of a
   * member, so a green badge on every row of the cluster-admin Users table shouted about nothing;
   * there the BU codes alone say "holds", and colour is kept for released links — the one state
   * an admin has to act on. The platform-side Users section keeps the badge.
   */
  quiet?: boolean;
}

export const SeatCell: React.FC<SeatCellProps> = ({ seat, quiet = false }) => {
  const { t } = useI18n();
  if (!seat) return null;

  const status = seat.holds ? t('components.clusterSeat.holdsSeat') : t('components.clusterSeat.noSeat');

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {quiet ? (
        seat.holds ? (
          <span className="sr-only">{status}</span>
        ) : (
          <span className="text-muted-foreground text-xs">{status}</span>
        )
      ) : (
        <Badge variant={seat.holds ? 'success' : 'secondary'}>{status}</Badge>
      )}
      {seat.links.map((link) => {
        const muted = link.released || !link.is_active || !link.bu_is_active;
        const note = link.released
          ? t('components.clusterSeat.released')
          : !link.bu_is_active || !link.is_active
            ? t('components.clusterSeat.inactive')
            : undefined;
        return (
          <span
            key={link.id}
            title={note ? `${link.bu_name} (${note})` : link.bu_name}
            className={cn(
              'font-mono text-[11px]',
              !muted
                ? 'text-foreground'
                : quiet && link.released
                  ? 'text-warning line-through'
                  : 'text-muted-foreground line-through',
            )}
          >
            {link.bu_code}
          </span>
        );
      })}
    </div>
  );
};

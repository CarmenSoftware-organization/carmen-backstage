import React from 'react';
import { Badge } from '../ui/badge';
import { useI18n } from '../../hooks/useI18n';
import type { ClusterUserSeat } from '../../types';

interface SeatCellProps {
  /** Undefined when the backend predates seat management — nothing is rendered. */
  seat: ClusterUserSeat | undefined;
}

export const SeatCell: React.FC<SeatCellProps> = ({ seat }) => {
  const { t } = useI18n();
  if (!seat) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={seat.holds ? 'success' : 'secondary'}>
        {seat.holds ? t('components.clusterSeat.holdsSeat') : t('components.clusterSeat.noSeat')}
      </Badge>
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
            className={`font-mono text-[11px] ${muted ? 'text-muted-foreground line-through' : 'text-foreground'}`}
          >
            {link.bu_code}
          </span>
        );
      })}
    </div>
  );
};

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';

interface SeatOverQuotaBannerProps {
  used: number;
  cap: number;
  /** Seat holders present in the member list; when below `used`, the rest are hidden holders. */
  listedHolders?: number;
}

export const SeatOverQuotaBanner: React.FC<SeatOverQuotaBannerProps> = ({ used, cap, listedHolders }) => {
  const { t } = useI18n();
  if (!(used > cap)) return null;
  const hidden = listedHolders !== undefined && used > listedHolders ? used - listedHolders : 0;

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      <div className="space-y-1">
        <p>{t('components.clusterSeat.overQuota', { used, cap, over: used - cap })}</p>
        {hidden > 0 && <p>{t('components.clusterSeat.hiddenHolders', { hidden })}</p>}
      </div>
    </div>
  );
};

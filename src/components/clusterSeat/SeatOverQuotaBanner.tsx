import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';

interface SeatOverQuotaBannerProps {
  used: number;
  cap: number;
}

export const SeatOverQuotaBanner: React.FC<SeatOverQuotaBannerProps> = ({ used, cap }) => {
  const { t } = useI18n();
  if (!(used > cap)) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      <p>{t('components.clusterSeat.overQuota', { used, cap, over: used - cap })}</p>
    </div>
  );
};

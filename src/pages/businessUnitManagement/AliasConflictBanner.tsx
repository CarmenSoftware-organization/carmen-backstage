import { AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useI18n } from '../../hooks/useI18n';

interface AliasConflictBannerProps {
  count: number;
  active: boolean;
  onToggle: () => void;
}

export function AliasConflictBanner({ count, active, onToggle }: AliasConflictBannerProps) {
  const { t } = useI18n();
  if (count === 0) return null;
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <span>{t('pages.businessUnits.aliasConflicts.banner', { count })}</span>
      </div>
      <Button variant="outline" size="sm" className="shrink-0 self-start sm:self-auto" onClick={onToggle}>
        {active ? t('pages.businessUnits.aliasConflicts.showAll') : t('pages.businessUnits.aliasConflicts.view')}
      </Button>
    </div>
  );
}

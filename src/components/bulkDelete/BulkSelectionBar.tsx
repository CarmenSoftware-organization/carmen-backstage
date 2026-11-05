import React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useI18n } from '../../hooks/useI18n';

interface Props {
  count: number;
  skippedCount: number;
  onDelete: () => void;
  onClear: () => void;
}

/** แถบเหนือตารางเมื่อมีแถวถูกเลือก — รูปเดียวกับของ UserManagement */
export const BulkSelectionBar: React.FC<Props> = ({ count, skippedCount, onDelete, onClear }) => {
  const { t } = useI18n();
  if (count === 0) return null;
  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2"
      role="region"
      aria-label={t('common.bulk.barAria')}
    >
      <span className="text-sm font-medium">{t('common.state.nSelected', { count })}</span>
      {skippedCount > 0 && (
        <span className="text-xs text-muted-foreground">{t('common.bulk.skipped', { count: skippedCount })}</span>
      )}
      <div className="ml-auto flex items-center gap-2">
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          {t('common.action.delete')}
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear}>
          {t('common.action.clear')}
        </Button>
      </div>
    </div>
  );
};

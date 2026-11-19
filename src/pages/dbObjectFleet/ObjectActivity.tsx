import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import dbObjectService from '../../services/dbObjectService';
import type { DbObjectActivityEntry } from '../../types';
import { ActivityList } from './ActivityList';

interface ObjectActivityProps {
  dbObjectId: string;
  /** Bumped by the detail after each action, so what was just done shows up. */
  refreshKey: number;
}

/** Everything recorded about one definition: added, edited, approved, tried and applied. */
export function ObjectActivity({ dbObjectId, refreshKey }: ObjectActivityProps) {
  const { t } = useI18n();
  const [entries, setEntries] = useState<DbObjectActivityEntry[] | null>(null);

  useEffect(() => {
    let current = true;
    dbObjectService
      .activity(dbObjectId)
      .then((rows) => current && setEntries(rows))
      .catch(() => current && setEntries([]));
    return () => {
      current = false;
    };
  }, [dbObjectId, refreshKey]);

  return (
    <details className="rounded-md border text-xs">
      <summary className="cursor-pointer px-3 py-1.5 font-medium">
        {t('pages.dbObjectFleet.activityLabel', { count: entries?.length ?? 0 })}
      </summary>
      {entries === null ? (
        <p className="text-muted-foreground flex items-center gap-2 border-t px-3 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        </p>
      ) : entries.length === 0 ? (
        <p className="text-muted-foreground border-t px-3 py-2">{t('pages.dbObjectFleet.activityEmpty')}</p>
      ) : (
        <div className="max-h-80 overflow-auto border-t">
          <ActivityList entries={entries} />
        </div>
      )}
    </details>
  );
}

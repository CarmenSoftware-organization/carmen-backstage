import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/ui/sheet';
import { useI18n } from '../../hooks/useI18n';
import dbObjectService from '../../services/dbObjectService';
import type { DbObjectActivityEntry } from '../../types';
import { ActivityList } from './ActivityList';
import { apiErrorMessage } from './fleetRequest';

interface ActivitySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PER_PAGE = 50;

/**
 * Everything done on the DB objects page, newest first — including definitions already removed
 * from the central store and migration files that were only read.
 */
export function ActivitySheet({ open, onOpenChange }: ActivitySheetProps) {
  const { t } = useI18n();
  const [entries, setEntries] = useState<DbObjectActivityEntry[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (next: number) => {
      setLoading(true);
      try {
        const res = await dbObjectService.activityRecent(next, PER_PAGE);
        setEntries((prev) => (next === 1 ? res.data : [...prev, ...res.data]));
        setPage(next);
        setTotal(res.paginate.total);
      } catch (err) {
        toast.error(apiErrorMessage(err, t('pages.dbObjectFleet.activityLoadFailed')));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  // Fresh on every open: what was done since the last look is what someone opens it for.
  useEffect(() => {
    if (open) void load(1);
  }, [open, load]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{t('pages.dbObjectFleet.activityAll')}</SheetTitle>
          <SheetDescription>{t('pages.dbObjectFleet.activityAllHint')}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 rounded-md border">
          {entries.length === 0 ? (
            <p className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-xs">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : t('pages.dbObjectFleet.activityEmpty')}
            </p>
          ) : (
            <ActivityList entries={entries} showObject />
          )}
        </div>
        {entries.length < total && (
          <Button variant="outline" size="sm" className="mt-3" disabled={loading} onClick={() => void load(page + 1)}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('pages.dbObjectFleet.activityLoadMore', { shown: entries.length, total })}
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}

import { useState } from 'react';
import { Code2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useI18n } from '../../hooks/useI18n';
import type { TKey } from '../../i18n/types';
import dbObjectService from '../../services/dbObjectService';
import type { DbObjectActivityEntry, DbObjectActivityOperation } from '../../types';
import { SqlDiffView } from './SqlDiffView';
import { withStableBodyTag } from './fleetMatrix';
import { apiErrorMessage } from './fleetRequest';

interface ActivityListProps {
  entries: DbObjectActivityEntry[];
  /** Name the object on each entry — the page-wide list needs it, the list of one object does not. */
  showObject?: boolean;
}

const OPERATION_KEYS: Record<DbObjectActivityOperation, TKey> = {
  create: 'pages.dbObjectFleet.opCreate',
  upload_read: 'pages.dbObjectFleet.opUploadRead',
  upload_add: 'pages.dbObjectFleet.opUploadAdd',
  update: 'pages.dbObjectFleet.opUpdate',
  approve: 'pages.dbObjectFleet.opApprove',
  remove: 'pages.dbObjectFleet.opRemove',
  import: 'pages.dbObjectFleet.opImport',
  apply: 'pages.dbObjectFleet.opApply',
  drop: 'pages.dbObjectFleet.opDrop',
  dry_run_apply: 'pages.dbObjectFleet.opDryRunApply',
  dry_run_drop: 'pages.dbObjectFleet.opDryRunDrop',
};

const fmtTime = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
};

// "view:v_a()" → "v_a" / "function:f_x(p int)" → "f_x(p int)"
const objectName = (key: string): string => key.replace(/^[a-z]+:/, '').replace(/\(\)$/, '');

/**
 * Entries of the DB objects activity log: when, what, where (BU), the result, who and from which
 * address — and, where the entry kept the code, the code before and after it in a popup.
 */
export function ActivityList({ entries, showObject = false }: ActivityListProps) {
  const { t } = useI18n();
  const [code, setCode] = useState<{ title: string; before: string; after: string } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const openCode = async (entry: DbObjectActivityEntry) => {
    setLoadingId(entry.id);
    try {
      const d = await dbObjectService.activityDetail(entry.id);
      setCode({
        title: `${entry.operation ? t(OPERATION_KEYS[entry.operation]) : ''} · ${fmtTime(entry.created_at)}`,
        before: withStableBodyTag(d.before_ddl ?? ''),
        after: withStableBodyTag(d.after_ddl ?? ''),
      });
    } catch (err) {
      toast.error(apiErrorMessage(err, t('pages.dbObjectFleet.activityLoadFailed')));
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <>
      <ul className="divide-y">
        {entries.map((e) => (
          <li key={e.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2 text-xs">
            <span className="text-muted-foreground w-40 shrink-0 tabular-nums">{fmtTime(e.created_at)}</span>
            <span className="min-w-0 flex-1 space-y-0.5">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium">{e.operation ? t(OPERATION_KEYS[e.operation]) : (e.action ?? '')}</span>
                {showObject && e.object && <span className="font-mono break-all">{objectName(e.object)}</span>}
                {e.bu_code && (
                  <Badge variant="outline" className="font-mono">
                    {e.bu_code}
                  </Badge>
                )}
                {e.success !== null && (
                  <Badge variant={e.success ? 'success' : 'destructive'}>
                    {e.success ? t('pages.dbObjectFleet.activityOk') : t('pages.dbObjectFleet.activityFailed')}
                  </Badge>
                )}
                {e.file_name && <span className="text-muted-foreground font-mono break-all">{e.file_name}</span>}
                {e.doc_version !== null && (
                  <span className="text-muted-foreground">
                    {t('pages.dbObjectFleet.activityVersion', { version: e.doc_version })}
                  </span>
                )}
              </span>
              {e.error && <span className="text-destructive-ink block break-all">{e.error}</span>}
              <span className="text-muted-foreground block">
                {e.actor?.name ?? t('pages.dbObjectFleet.activityUnknownActor')}
                {e.ip_address ? ` · ${e.ip_address}` : ''}
              </span>
            </span>
            {e.has_code && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px]"
                disabled={loadingId !== null}
                onClick={() => void openCode(e)}
              >
                {loadingId === e.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Code2 className="mr-1 h-3 w-3" />}
                {t('pages.dbObjectFleet.activityShowCode')}
              </Button>
            )}
          </li>
        ))}
      </ul>

      <Dialog open={code !== null} onOpenChange={(o) => !o && setCode(null)}>
        <DialogContent className="sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>{code?.title}</DialogTitle>
            <DialogDescription>{t('pages.dbObjectFleet.activityCodeHint')}</DialogDescription>
          </DialogHeader>
          <div className="text-muted-foreground hidden grid-cols-2 gap-4 text-xs font-medium md:grid">
            <span>{t('pages.dbObjectFleet.activityBefore')}</span>
            <span>{t('pages.dbObjectFleet.activityAfter')}</span>
          </div>
          {code && <SqlDiffView original={code.before} current={code.after} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

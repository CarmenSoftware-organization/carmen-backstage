import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { useI18n } from '../../hooks/useI18n';
import dbObjectService from '../../services/dbObjectService';
import { pickImportBu, type FleetBu, type UnregisteredObject } from './fleetMatrix';
import { apiErrorMessage } from './fleetRequest';

interface ImportPanelProps {
  /**
   * Objects to copy in from a BU: the ones the registry lacks, and registry rows that must be
   * imported again (`stale`).
   */
  unregistered: UnregisteredObject[];
  bus: FleetBu[];
  canAuthor: boolean;
  /** The registry changed — the page reloads it. */
  onImported: () => void;
}

/**
 * Objects the registry should take from a BU — the ones it lacks, and rows saved before
 * structured definitions — and the one action on them: copy them in from a chosen BU, exactly as
 * that BU holds them. This is how the registry is first filled, and how old rows are upgraded.
 */
export function ImportPanel({ unregistered, bus, canAuthor, onImported }: ImportPanelProps) {
  const { t } = useI18n();
  const [buCode, setBuCode] = useState<string | null>(() => pickImportBu(unregistered));
  const [importing, setImporting] = useState(false);

  const holders = useMemo(() => {
    const codes = new Set<string>();
    for (const o of unregistered) for (const c of o.bus) codes.add(c);
    return bus.filter((b) => codes.has(b.code));
  }, [unregistered, bus]);
  useEffect(() => {
    if (!buCode || !holders.some((b) => b.code === buCode)) setBuCode(pickImportBu(unregistered));
  }, [buCode, holders, unregistered]);

  const fromBu = useMemo(() => unregistered.filter((o) => buCode && o.bus.includes(buCode)), [unregistered, buCode]);

  const runImport = async () => {
    if (!buCode || fromBu.length === 0) return;
    setImporting(true);
    try {
      const res = await dbObjectService.importFromBu(
        buCode,
        fromBu.map(({ type, name, identity_args }) => ({ type, name, identity_args })),
      );
      toast.success(t('pages.dbObjectFleet.imported', { count: res.created + res.updated, bu: buCode }));
      onImported();
    } catch (err) {
      toast.error(apiErrorMessage(err, t('pages.dbObjectFleet.importFailed')));
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="min-w-0 space-y-4 rounded-lg border p-4" aria-label={t('pages.dbObjectFleet.importAria')}>
      <header className="space-y-1">
        <h2 className="text-base font-semibold">{t('pages.dbObjectFleet.importTitle')}</h2>
        <p className="text-muted-foreground text-xs">{t('pages.dbObjectFleet.importHint')}</p>
      </header>

      {unregistered.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('pages.dbObjectFleet.importNone')}</p>
      ) : (
        <>
          {canAuthor && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="space-y-1 text-xs">
                <span className="block font-medium">{t('pages.dbObjectFleet.importFrom')}</span>
                <select
                  className="border-input bg-background h-9 rounded-md border px-2 font-mono text-xs"
                  value={buCode ?? ''}
                  disabled={importing}
                  onChange={(e) => setBuCode(e.target.value)}
                >
                  {holders.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.code} ({unregistered.filter((o) => o.bus.includes(b.code)).length})
                    </option>
                  ))}
                </select>
              </label>
              <Button disabled={importing || fromBu.length === 0} onClick={runImport}>
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                {t('pages.dbObjectFleet.importButton', { count: fromBu.length })}
              </Button>
            </div>
          )}
          <div className="max-h-[28rem] overflow-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-muted-foreground text-left">
                  <th className="px-2 py-1.5 font-medium">{t('pages.dbObjectFleet.colObject')}</th>
                  <th className="px-2 py-1.5 font-medium">{t('pages.dbObjectFleet.colFoundIn')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {unregistered.map((o) => (
                  <tr key={o.key} className={buCode && !o.bus.includes(buCode) ? 'opacity-50' : undefined}>
                    <td className="px-2 py-1.5">
                      <span className="font-mono break-all">{o.name}</span>
                      {o.stale && (
                        <Badge variant="warning" className="ml-2">
                          {t('pages.dbObjectFleet.importStale')}
                        </Badge>
                      )}
                      <span className="text-muted-foreground block text-[11px]">
                        {o.type}
                        {o.identity_args ? ` (${o.identity_args})` : ''}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-2 py-1.5 font-mono text-[11px]">{o.bus.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

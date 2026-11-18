import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, FlaskConical, GitCompare, Loader2, Rocket, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useI18n } from '../../hooks/useI18n';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import sqlQueryService from '../../services/sqlQueryService';
import { mapWithConcurrency } from '../../utils/concurrent';
import { cn } from '../../lib/utils';
import { SqlEditor } from '../sqlWorkbench/SqlEditor';
import { SqlDiffView } from './SqlDiffView';
import { defaultTargets, pickSourceBu, runSignature, type BuScan, type FleetBu, type FleetRow } from './fleetMatrix';
import { FLEET_CONCURRENCY, apiErrorMessage, isLockTimeout, withRateLimitRetry } from './fleetRequest';
import { CAN_AUTHOR_SQL } from './fleetPolicy';

type RunMode = 'dry' | 'commit';
type RunResult = { state: 'running' } | { state: 'ok'; ms: number } | { state: 'error'; message: string };

interface ObjectDetailProps {
  /** The object being rolled out; null = writing a new one from scratch. */
  row: FleetRow | null;
  bus: FleetBu[];
  scans: Record<string, BuScan>;
  canManage: boolean;
  /** BUs that a real apply touched — the page rescans them. */
  onApplied: (codes: string[]) => void;
  /** True while a dry-run or apply is in flight, so the page can lock navigation. */
  onBusyChange: (busy: boolean) => void;
}

const NEW_OBJECT_TEMPLATE = `-- No schema names: each BU runs this in its own schema.
CREATE OR REPLACE VIEW v_new_view AS
SELECT id, code, name
  FROM tb_location;
`;

/**
 * One object across the fleet: which BUs have which variant, the definition to roll out (taken
 * from a source BU, editable), and the two-step rollout — try on every target BU with a
 * rollback, then apply for real only when that exact SQL passed on exactly those BUs.
 */
export function ObjectDetail({ row, bus, scans, canManage, onApplied, onBusyChange }: ObjectDetailProps) {
  const { t } = useI18n();
  const canAuthor = canManage && CAN_AUTHOR_SQL;
  const okBus = useMemo(() => bus.filter((b) => scans[b.code]?.state === 'ok').map((b) => b.code), [bus, scans]);

  const [sourceBu, setSourceBu] = useState<string | null>(() => (row ? pickSourceBu(row) : null));
  const [sqlText, setSqlText] = useState(row ? '' : NEW_OBJECT_TEMPLATE);
  const [sourceText, setSourceText] = useState(row ? '' : NEW_OBJECT_TEMPLATE);
  const [defLoading, setDefLoading] = useState(false);
  const [defError, setDefError] = useState<string | null>(null);
  const [targets, setTargets] = useState<string[]>(() => (row ? defaultTargets(row, pickSourceBu(row)) : okBus));
  const [results, setResults] = useState<Record<string, RunResult>>({});
  const [lastMode, setLastMode] = useState<RunMode | null>(null);
  const [running, setRunning] = useState(false);
  const [passedSignature, setPassedSignature] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [diff, setDiff] = useState<{ bu: string; text: string } | null>(null);
  const [diffLoadingBu, setDiffLoadingBu] = useState<string | null>(null);

  // Leaving the page mid-run stops new BUs from being started; the ones in flight finish.
  // Reset in the body: StrictMode's mount → cleanup → mount would otherwise leave it true and
  // every run would stop before its first BU.
  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);
  useEffect(() => onBusyChange(running), [running, onBusyChange]);
  // Unmounted in the same render that ends a run, the effect above never reports `false`.
  useEffect(() => () => onBusyChange(false), [onBusyChange]);
  useUnsavedChanges(canManage && sqlText !== sourceText);

  // Load the source BU's definition whenever the source changes.
  useEffect(() => {
    if (!row || !sourceBu) return;
    let stale = false;
    setDefLoading(true);
    setDefError(null);
    sqlQueryService
      .getPortableDefinition(sourceBu, { type: row.type, name: row.name, identity_args: row.identity_args })
      .then((d) => {
        if (stale) return;
        setSqlText(d.definition);
        setSourceText(d.definition);
      })
      .catch((err) => {
        if (!stale) setDefError(apiErrorMessage(err, t('pages.dbObjectFleet.loadDefinitionFailed')));
      })
      .finally(() => {
        if (!stale) setDefLoading(false);
      });
    return () => {
      stale = true;
    };
    // row identity is the object key; re-running on every rescan would discard edits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.key, sourceBu]);

  // The source BU already holds exactly what was read from it, so it is no target — until the
  // SQL is edited (a new version, or a DROP). From then on the source and every BU sharing its
  // variant would change too, so all of them can be picked and compared.
  const edited = row !== null && sqlText !== sourceText;
  const lockedSource = edited ? null : sourceBu;
  useEffect(() => {
    if (lockedSource) setTargets((prev) => (prev.includes(lockedSource) ? prev.filter((c) => c !== lockedSource) : prev));
  }, [lockedSource]);

  const signature = runSignature(sqlText, targets);
  const canApply = canManage && !running && targets.length > 0 && passedSignature === signature;
  const failedBus = Object.entries(results)
    .filter(([, r]) => r.state === 'error')
    .map(([code]) => code);

  const chooseSource = (code: string) => {
    if (!row || code === sourceBu) return;
    setSourceBu(code);
    setTargets(defaultTargets(row, code));
    setResults({});
    setPassedSignature(null);
  };

  const toggleTarget = (code: string) =>
    setTargets((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code].sort()));

  const runOn = useCallback(
    async (mode: RunMode) => {
      const codes = [...targets];
      const text = sqlText;
      if (codes.length === 0 || !text.trim()) return;
      setRunning(true);
      setLastMode(mode);
      setPassedSignature(null);
      setResults(Object.fromEntries(codes.map((c) => [c, { state: 'running' } as RunResult])));
      let failed = 0;
      await mapWithConcurrency(
        codes,
        FLEET_CONCURRENCY,
        (code) => {
          if (cancelledRef.current) return Promise.reject(new Error(t('pages.dbObjectFleet.cancelled')));
          return withRateLimitRetry(() => sqlQueryService.applyPortableDdl(code, text, mode === 'dry'));
        },
        (code, _i, res, err) => {
          if (err) failed++;
          if (cancelledRef.current) return;
          setResults((prev) => ({
            ...prev,
            [code]: err
              ? { state: 'error', message: apiErrorMessage(err, t('pages.dbObjectFleet.applyFailed')) }
              : { state: 'ok', ms: res?.duration_ms ?? 0 },
          }));
        },
      );
      if (cancelledRef.current) return;
      setRunning(false);
      const passed = codes.length - failed;
      if (mode === 'dry') {
        if (failed === 0) {
          setPassedSignature(runSignature(text, codes));
          toast.success(t('pages.dbObjectFleet.dryRunPassed', { count: codes.length }));
        } else {
          toast.warning(t('pages.dbObjectFleet.dryRunFailedSome', { failed, total: codes.length }));
        }
      } else {
        if (passed > 0) setSourceText(text);
        onApplied(codes);
        if (failed === 0) toast.success(t('pages.dbObjectFleet.appliedAll', { count: codes.length }));
        else toast.warning(t('pages.dbObjectFleet.appliedSome', { passed, failed, total: codes.length }));
      }
    },
    [targets, sqlText, t, onApplied],
  );

  const openDiff = async (code: string) => {
    if (!row) return;
    setDiffLoadingBu(code);
    try {
      const d = await sqlQueryService.getPortableDefinition(code, {
        type: row.type,
        name: row.name,
        identity_args: row.identity_args,
      });
      setDiff({ bu: code, text: d.definition });
    } catch (err) {
      toast.error(apiErrorMessage(err, t('pages.dbObjectFleet.loadDefinitionFailed')));
    } finally {
      setDiffLoadingBu(null);
    }
  };

  const variantOf = (code: string) => row?.variants.find((v) => v.bus.includes(code)) ?? null;
  const sourceHash = row && sourceBu ? row.byBu[sourceBu] : undefined;

  return (
    <section className="min-w-0 space-y-4 rounded-lg border p-4" aria-label={t('pages.dbObjectFleet.detailAria')}>
      <header className="space-y-1">
        <h2 className="font-mono text-base font-semibold break-all">
          {row ? row.name : t('pages.dbObjectFleet.newObjectTitle')}
          {row?.identity_args ? <span className="text-muted-foreground font-normal">({row.identity_args})</span> : null}
        </h2>
        <p className="text-muted-foreground text-xs">
          {row
            ? t('pages.dbObjectFleet.detailSubtitle', {
                present: okBus.length - row.missing.length,
                total: okBus.length,
                variants: row.variants.length,
              })
            : t('pages.dbObjectFleet.newObjectHint')}
        </p>
      </header>

      {/* Definition to roll out */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium">{t('pages.dbObjectFleet.definitionLabel')}</span>
          {row && sourceBu && (
            <span className="text-muted-foreground">
              {t('pages.dbObjectFleet.definitionFrom', { bu: sourceBu })}
              {sqlText !== sourceText && ` · ${t('pages.dbObjectFleet.edited')}`}
            </span>
          )}
          {defLoading && <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" aria-hidden />}
        </div>
        {defError && (
          <p role="alert" className="text-destructive text-xs">
            {defError}
          </p>
        )}
        <div className="flex h-[22rem] flex-col overflow-hidden rounded-md border">
          <SqlEditor
            value={sqlText}
            readOnly={!canAuthor}
            onChange={(v) => {
              setSqlText(v);
            }}
          />
        </div>
        {canAuthor && <p className="text-muted-foreground text-[11px]">{t('pages.dbObjectFleet.definitionRules')}</p>}
      </div>

      {/* BUs: presence, target selection, results */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium">
            {t('pages.dbObjectFleet.targetsLabel', { count: targets.length })}
          </span>
          {canManage && (
            <div className="ml-auto flex flex-wrap gap-1">
              {row && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  disabled={running}
                  onClick={() => setTargets(defaultTargets(row, lockedSource))}
                >
                  {t('pages.dbObjectFleet.selectChanging')}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                disabled={running}
                onClick={() => setTargets(okBus.filter((c) => c !== lockedSource))}
              >
                {t('pages.dbObjectFleet.selectAll')}
              </Button>
              {failedBus.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  disabled={running}
                  onClick={() => setTargets([...failedBus].sort())}
                >
                  {t('pages.dbObjectFleet.selectFailed', { count: failedBus.length })}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                disabled={running}
                onClick={() => setTargets([])}
              >
                {t('pages.dbObjectFleet.selectNone')}
              </Button>
            </div>
          )}
        </div>

        <div className="max-h-[22rem] overflow-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr className="text-muted-foreground text-left">
                {canManage && <th className="w-8 px-2 py-1.5" aria-label={t('pages.dbObjectFleet.colTarget')} />}
                <th className="px-2 py-1.5 font-medium">{t('pages.dbObjectFleet.colBu')}</th>
                <th className="px-2 py-1.5 font-medium">{t('pages.dbObjectFleet.colNow')}</th>
                <th className="px-2 py-1.5 font-medium">{t('pages.dbObjectFleet.colResult')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {bus.map((b) => {
                const scan = scans[b.code];
                const variant = variantOf(b.code);
                const isSource = b.code === sourceBu;
                const result = results[b.code];
                const scannedOk = scan?.state === 'ok';
                return (
                  <tr key={b.code} className={cn(isSource && 'bg-info/5')}>
                    {canManage && (
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={targets.includes(b.code)}
                          disabled={running || !scannedOk || b.code === lockedSource}
                          onChange={() => toggleTarget(b.code)}
                          aria-label={t('pages.dbObjectFleet.targetAria', { bu: b.code })}
                        />
                      </td>
                    )}
                    <td className="px-2 py-1.5">
                      <span className="font-mono">{b.code}</span>
                      <span className="text-muted-foreground block max-w-[14rem] truncate text-[11px]">{b.name}</span>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        {!scan || scan.state === 'loading' ? (
                          <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" aria-label={t('pages.dbObjectFleet.scanningAria')} />
                        ) : scan.state === 'error' ? (
                          <Badge variant="destructive" title={scan.message}>
                            {t('pages.dbObjectFleet.unreadable')}
                          </Badge>
                        ) : !row ? null : variant ? (
                          <Badge variant={variant.hash === sourceHash ? 'secondary' : 'info'}>
                            {t('pages.dbObjectFleet.variant', { label: variant.label })}
                          </Badge>
                        ) : (
                          <Badge variant="warning">{t('pages.dbObjectFleet.absent')}</Badge>
                        )}
                        {isSource && <Badge variant="outline">{t('pages.dbObjectFleet.source')}</Badge>}
                        {/* only a BU holding another variant is worth switching to */}
                        {row && variant && !isSource && variant.hash !== sourceHash && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-[11px]"
                            disabled={running}
                            onClick={() => chooseSource(b.code)}
                          >
                            {t('pages.dbObjectFleet.useAsSource')}
                          </Button>
                        )}
                        {/* …or comparing — unless the SQL was edited: then every BU holding the object differs from it */}
                        {row && variant && (edited || (!isSource && variant.hash !== sourceHash)) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-[11px]"
                            disabled={diffLoadingBu !== null}
                            onClick={() => openDiff(b.code)}
                            aria-label={t('pages.dbObjectFleet.compareAria', { bu: b.code })}
                          >
                            {diffLoadingBu === b.code ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <GitCompare className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      {result?.state === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                      {result?.state === 'ok' && (
                        <span className="text-success inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                          {lastMode === 'dry' ? t('pages.dbObjectFleet.resultDryOk') : t('pages.dbObjectFleet.resultApplied')}
                        </span>
                      )}
                      {result?.state === 'error' && (
                        <span className="text-destructive flex items-start gap-1 break-words">
                          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span>
                            {result.message}
                            {isLockTimeout(result.message) && (
                              <span className="text-muted-foreground block">{t('pages.dbObjectFleet.lockTimeoutHint')}</span>
                            )}
                          </span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {canManage && (
        <div className="flex flex-wrap items-center gap-3 border-t pt-3">
          <Button
            variant="outline"
            disabled={running || targets.length === 0 || !sqlText.trim() || defLoading}
            onClick={() => runOn('dry')}
          >
            {running && lastMode === 'dry' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FlaskConical className="mr-2 h-4 w-4" />
            )}
            {t('pages.dbObjectFleet.dryRun', { count: targets.length })}
          </Button>
          <Button disabled={!canApply} onClick={() => setConfirmOpen(true)}>
            {running && lastMode === 'commit' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="mr-2 h-4 w-4" />
            )}
            {t('pages.dbObjectFleet.apply', { count: targets.length })}
          </Button>
          <p className="text-muted-foreground text-xs">
            {canApply ? t('pages.dbObjectFleet.applyReady') : t('pages.dbObjectFleet.applyNeedsDryRun')}
          </p>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('pages.dbObjectFleet.confirmTitle', { count: targets.length })}
        description={t('pages.dbObjectFleet.confirmDescription', {
          name: row?.name ?? t('pages.dbObjectFleet.newObjectTitle'),
          bus: targets.join(', '),
        })}
        confirmText={t('pages.dbObjectFleet.confirmApply')}
        onConfirm={() => {
          setConfirmOpen(false);
          void runOn('commit');
        }}
      />

      <Dialog open={diff !== null} onOpenChange={(o) => !o && setDiff(null)}>
        <DialogContent className="sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>{t('pages.dbObjectFleet.diffTitle', { bu: diff?.bu ?? '' })}</DialogTitle>
            <DialogDescription>{t('pages.dbObjectFleet.diffDescription', { bu: diff?.bu ?? '' })}</DialogDescription>
          </DialogHeader>
          {diff && <SqlDiffView original={diff.text} current={sqlText} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}

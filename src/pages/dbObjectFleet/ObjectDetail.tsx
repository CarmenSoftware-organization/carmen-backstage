import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, FlaskConical, GitCompare, Loader2, Rocket, Save, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useI18n } from '../../hooks/useI18n';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import sqlQueryService from '../../services/sqlQueryService';
import dbObjectService from '../../services/dbObjectService';
import { mapWithConcurrency } from '../../utils/concurrent';
import type { DbObjectKind } from '../../types';
import { SqlEditor } from '../sqlWorkbench/SqlEditor';
import { SqlDiffView } from './SqlDiffView';
import { defaultTargets, runSignature, type BuScan, type BuStatus, type FleetBu, type FleetRow } from './fleetMatrix';
import { FLEET_CONCURRENCY, apiErrorMessage, isLockTimeout, withRateLimitRetry } from './fleetRequest';

type RunMode = 'dry' | 'commit';
type RunResult = { state: 'running' } | { state: 'ok'; ms: number } | { state: 'error'; message: string };

interface ObjectDetailProps {
  /** The registry definition being worked on; null = writing a new one. */
  row: FleetRow | null;
  bus: FleetBu[];
  scans: Record<string, BuScan>;
  /** May create / edit / remove registry definitions (db_object.manage). */
  canAuthor: boolean;
  /** May dry-run and apply to BUs (sql_workbench.manage). */
  canApply: boolean;
  /** The registry changed; `selectId` is the row to show afterwards (null = none). */
  onRegistryChanged: (selectId: string | null) => void;
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

const KINDS: DbObjectKind[] = ['view', 'function', 'procedure'];
const isConflict = (err: unknown): boolean => (err as { response?: { status?: number } })?.response?.status === 409;

/**
 * One registry definition: its text (edited and saved here), how every BU stands against it,
 * and the two-step rollout of the saved text — try on every target BU with a rollback, then
 * apply for real only when that exact text passed on exactly those BUs.
 */
export function ObjectDetail({
  row,
  bus,
  scans,
  canAuthor,
  canApply,
  onRegistryChanged,
  onApplied,
  onBusyChange,
}: ObjectDetailProps) {
  const { t } = useI18n();
  const okBus = useMemo(() => bus.filter((b) => scans[b.code]?.state === 'ok').map((b) => b.code), [bus, scans]);

  const [sqlText, setSqlText] = useState(row ? '' : NEW_OBJECT_TEMPLATE);
  const [savedText, setSavedText] = useState(row ? '' : NEW_OBJECT_TEMPLATE);
  const [docVersion, setDocVersion] = useState<number | undefined>(undefined);
  const [newKind, setNewKind] = useState<DbObjectKind>('view');
  const [newName, setNewName] = useState('');
  const [newArgs, setNewArgs] = useState('');
  const [defLoading, setDefLoading] = useState(false);
  const [defError, setDefError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [targets, setTargets] = useState<string[]>(() => (row ? defaultTargets(row) : []));
  const [results, setResults] = useState<Record<string, RunResult>>({});
  const [lastMode, setLastMode] = useState<RunMode | null>(null);
  const [running, setRunning] = useState(false);
  const [passedSignature, setPassedSignature] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
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

  const dirty = sqlText !== savedText;
  useUnsavedChanges(canAuthor && (dirty || (!row && newName.trim() !== '')));

  const loadEntry = useCallback(
    async (id: string) => {
      setDefLoading(true);
      setDefError(null);
      try {
        const entry = await dbObjectService.get(id);
        if (cancelledRef.current) return;
        setSqlText(entry.definition);
        setSavedText(entry.definition);
        setDocVersion(entry.doc_version);
      } catch (err) {
        if (!cancelledRef.current) setDefError(apiErrorMessage(err, t('pages.dbObjectFleet.loadDefinitionFailed')));
      } finally {
        if (!cancelledRef.current) setDefLoading(false);
      }
    },
    [t],
  );
  // Load once per definition; a rescan or a registry reload of the same row must not discard edits.
  useEffect(() => {
    if (row) void loadEntry(row.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id]);

  const save = async () => {
    if (!sqlText.trim()) return;
    setSaving(true);
    try {
      if (row) {
        const entry = await dbObjectService.update(row.id, { definition: sqlText, doc_version: docVersion });
        setSqlText(entry.definition);
        setSavedText(entry.definition);
        setDocVersion(entry.doc_version);
        setPassedSignature(null);
        setResults({});
        toast.success(t('pages.dbObjectFleet.saved'));
        onRegistryChanged(row.id);
      } else {
        const entry = await dbObjectService.create({
          type: newKind,
          name: newName.trim(),
          identity_args: newKind === 'view' ? '' : newArgs.trim(),
          definition: sqlText,
        });
        toast.success(t('pages.dbObjectFleet.created'));
        // leave the "new" form clean so the unsaved-changes guard does not fire on the switch
        setSavedText(sqlText);
        setNewName('');
        onRegistryChanged(entry.id);
      }
    } catch (err) {
      if (row && isConflict(err)) {
        toast.error(t('pages.dbObjectFleet.conflict'));
        void loadEntry(row.id);
      } else {
        toast.error(apiErrorMessage(err, t('pages.dbObjectFleet.saveFailed')));
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!row) return;
    try {
      await dbObjectService.remove(row.id);
      toast.success(t('pages.dbObjectFleet.removed'));
      onRegistryChanged(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, t('pages.dbObjectFleet.removeFailed')));
    }
  };

  const signature = runSignature(savedText, targets);
  const applyUnlocked = canApply && !dirty && !running && targets.length > 0 && passedSignature === signature;
  const failedBus = Object.entries(results)
    .filter(([, r]) => r.state === 'error')
    .map(([code]) => code);

  const toggleTarget = (code: string) =>
    setTargets((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code].sort()));

  const runOn = useCallback(
    async (mode: RunMode) => {
      const codes = [...targets];
      const text = savedText;
      if (!row || codes.length === 0 || !text.trim()) return;
      setRunning(true);
      setLastMode(mode);
      setPassedSignature(null);
      setResults(Object.fromEntries(codes.map((c) => [c, { state: 'running' } as RunResult])));
      const passedBus: string[] = [];
      await mapWithConcurrency(
        codes,
        FLEET_CONCURRENCY,
        (code) => {
          if (cancelledRef.current) return Promise.reject(new Error(t('pages.dbObjectFleet.cancelled')));
          return withRateLimitRetry(() => sqlQueryService.applyPortableDdl(code, text, mode === 'dry'));
        },
        (code, _i, res, err) => {
          if (!err) passedBus.push(code);
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
      const failed = codes.length - passedBus.length;
      if (mode === 'dry') {
        setRunning(false);
        if (failed === 0) {
          setPassedSignature(runSignature(text, codes));
          toast.success(t('pages.dbObjectFleet.dryRunPassed', { count: codes.length }));
        } else {
          toast.warning(t('pages.dbObjectFleet.dryRunFailedSome', { failed, total: codes.length }));
        }
        return;
      }
      // Postgres stores its own rendering of what was applied. Read it back from one BU that took
      // it, so the registry fingerprint equals what a scan of those BUs returns from now on.
      if (passedBus.length > 0 && canAuthor) {
        try {
          const res = await dbObjectService.importFromBu(passedBus.sort()[0], [
            { type: row.type, name: row.name, identity_args: row.identity_args },
          ]);
          if (res.updated > 0 && !cancelledRef.current) await loadEntry(row.id);
        } catch {
          // The apply itself succeeded; an unsettled fingerprint only shows those BUs as out of date.
        }
      }
      if (cancelledRef.current) return;
      setRunning(false);
      onRegistryChanged(row.id);
      onApplied(codes);
      if (failed === 0) toast.success(t('pages.dbObjectFleet.appliedAll', { count: codes.length }));
      else toast.warning(t('pages.dbObjectFleet.appliedSome', { passed: passedBus.length, failed, total: codes.length }));
    },
    [targets, savedText, row, canAuthor, t, onApplied, onRegistryChanged, loadEntry],
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

  const statusBadge = (status: BuStatus) =>
    status === 'match' ? (
      <Badge variant="success">{t('pages.dbObjectFleet.buMatch')}</Badge>
    ) : status === 'outdated' ? (
      <Badge variant="info">{t('pages.dbObjectFleet.buOutdated')}</Badge>
    ) : (
      <Badge variant="warning">{t('pages.dbObjectFleet.buMissing')}</Badge>
    );

  const canSave = canAuthor && !saving && !running && sqlText.trim() !== '' && (row ? dirty : newName.trim() !== '');

  return (
    <section className="min-w-0 space-y-4 rounded-lg border p-4" aria-label={t('pages.dbObjectFleet.detailAria')}>
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="font-mono text-base font-semibold break-all">
            {row ? row.name : t('pages.dbObjectFleet.newObjectTitle')}
            {row?.identity_args ? <span className="text-muted-foreground font-normal">({row.identity_args})</span> : null}
          </h2>
          <p className="text-muted-foreground text-xs">
            {row
              ? t('pages.dbObjectFleet.detailSubtitle', {
                  match: okBus.length - row.outdated.length - row.missing.length,
                  total: okBus.length,
                })
              : t('pages.dbObjectFleet.newObjectHint')}
          </p>
        </div>
        {row && canAuthor && (
          <Button variant="outline" size="sm" disabled={running || saving} onClick={() => setRemoveOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            {t('pages.dbObjectFleet.remove')}
          </Button>
        )}
      </header>

      {!row && (
        <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)]">
          <label className="space-y-1 text-xs">
            <span className="block font-medium">{t('pages.dbObjectFleet.fieldKind')}</span>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as DbObjectKind)}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="block font-medium">{t('pages.dbObjectFleet.fieldName')}</span>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="v_new_view"
              className="h-9 font-mono text-xs"
            />
          </label>
          {newKind !== 'view' && (
            <label className="space-y-1 text-xs">
              <span className="block font-medium">{t('pages.dbObjectFleet.fieldArgs')}</span>
              <Input
                value={newArgs}
                onChange={(e) => setNewArgs(e.target.value)}
                placeholder="p_date_from date, p_date_to date"
                className="h-9 font-mono text-xs"
              />
            </label>
          )}
        </div>
      )}

      {/* The registry definition */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium">{t('pages.dbObjectFleet.definitionLabel')}</span>
          {row && dirty && <span className="text-warning">{t('pages.dbObjectFleet.unsaved')}</span>}
          {defLoading && <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" aria-hidden />}
          {canAuthor && (
            <Button size="sm" className="ml-auto h-7" disabled={!canSave} onClick={save}>
              {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
              {row ? t('pages.dbObjectFleet.save') : t('pages.dbObjectFleet.create')}
            </Button>
          )}
        </div>
        {defError && (
          <p role="alert" className="text-destructive text-xs">
            {defError}
          </p>
        )}
        <div className="flex h-[22rem] flex-col overflow-hidden rounded-md border">
          <SqlEditor value={sqlText} readOnly={!canAuthor} onChange={setSqlText} />
        </div>
        {canAuthor && <p className="text-muted-foreground text-[11px]">{t('pages.dbObjectFleet.definitionRules')}</p>}
      </div>

      {/* BUs: how each stands against the registry, target selection, results */}
      {row && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium">
              {canApply ? t('pages.dbObjectFleet.targetsLabel', { count: targets.length }) : t('pages.dbObjectFleet.busLabel')}
            </span>
            {canApply && (
              <div className="ml-auto flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={running} onClick={() => setTargets(defaultTargets(row))}>
                  {t('pages.dbObjectFleet.selectNeeding')}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={running} onClick={() => setTargets([...okBus].sort())}>
                  {t('pages.dbObjectFleet.selectAll')}
                </Button>
                {failedBus.length > 0 && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={running} onClick={() => setTargets([...failedBus].sort())}>
                    {t('pages.dbObjectFleet.selectFailed', { count: failedBus.length })}
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={running} onClick={() => setTargets([])}>
                  {t('pages.dbObjectFleet.selectNone')}
                </Button>
              </div>
            )}
          </div>

          <div className="max-h-[22rem] overflow-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-muted-foreground text-left">
                  {canApply && <th className="w-8 px-2 py-1.5" aria-label={t('pages.dbObjectFleet.colTarget')} />}
                  <th className="px-2 py-1.5 font-medium">{t('pages.dbObjectFleet.colBu')}</th>
                  <th className="px-2 py-1.5 font-medium">{t('pages.dbObjectFleet.colStatus')}</th>
                  <th className="px-2 py-1.5 font-medium">{t('pages.dbObjectFleet.colResult')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {bus.map((b) => {
                  const scan = scans[b.code];
                  const status = row.statusByBu[b.code];
                  const result = results[b.code];
                  return (
                    <tr key={b.code}>
                      {canApply && (
                        <td className="px-2 py-1.5">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary"
                            checked={targets.includes(b.code)}
                            disabled={running || scan?.state !== 'ok'}
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
                          ) : status ? (
                            statusBadge(status)
                          ) : null}
                          {/* a BU holding the object is worth comparing when it differs, or when the text here is unsaved */}
                          {status && status !== 'missing' && (status === 'outdated' || dirty) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 text-[11px]"
                              disabled={diffLoadingBu !== null}
                              onClick={() => openDiff(b.code)}
                              aria-label={t('pages.dbObjectFleet.compareAria', { bu: b.code })}
                            >
                              {diffLoadingBu === b.code ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitCompare className="h-3 w-3" />}
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
      )}

      {row && canApply && (
        <div className="flex flex-wrap items-center gap-3 border-t pt-3">
          <Button
            variant="outline"
            disabled={running || dirty || targets.length === 0 || !savedText.trim() || defLoading}
            onClick={() => runOn('dry')}
          >
            {running && lastMode === 'dry' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
            {t('pages.dbObjectFleet.dryRun', { count: targets.length })}
          </Button>
          <Button disabled={!applyUnlocked} onClick={() => setConfirmOpen(true)}>
            {running && lastMode === 'commit' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
            {t('pages.dbObjectFleet.apply', { count: targets.length })}
          </Button>
          <p className="text-muted-foreground text-xs">
            {dirty
              ? t('pages.dbObjectFleet.applyNeedsSave')
              : applyUnlocked
                ? t('pages.dbObjectFleet.applyReady')
                : t('pages.dbObjectFleet.applyNeedsDryRun')}
          </p>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('pages.dbObjectFleet.confirmTitle', { count: targets.length })}
        description={t('pages.dbObjectFleet.confirmDescription', { name: row?.name ?? '', bus: targets.join(', ') })}
        confirmText={t('pages.dbObjectFleet.confirmApply')}
        onConfirm={() => {
          setConfirmOpen(false);
          void runOn('commit');
        }}
      />

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={t('pages.dbObjectFleet.removeTitle')}
        description={t('pages.dbObjectFleet.removeDescription', { name: row?.name ?? '' })}
        confirmText={t('pages.dbObjectFleet.remove')}
        onConfirm={async () => {
          await remove();
          setRemoveOpen(false);
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

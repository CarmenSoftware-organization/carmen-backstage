import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  CheckCircle2,
  FlaskConical,
  GitCompare,
  Loader2,
  Rocket,
  Save,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useI18n } from '../../hooks/useI18n';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import sqlQueryService from '../../services/sqlQueryService';
import dbObjectService from '../../services/dbObjectService';
import { mapWithConcurrency } from '../../utils/concurrent';
import type { DbObjectDeployLogRow, DbObjectRegistryEntry, DbObjectSpec } from '../../types';
import { SqlEditor } from '../sqlWorkbench/SqlEditor';
import { SqlDiffView } from './SqlDiffView';
import { SpecForm, blankSpec } from './SpecForm';
import { defaultTargets, runSignature, type BuScan, type BuStatus, type FleetBu, type FleetRow } from './fleetMatrix';
import { FLEET_CONCURRENCY, apiErrorMessage, isLockTimeout, withRateLimitRetry } from './fleetRequest';

type RunKind = 'dry' | 'apply' | 'drop';
type RunResult = { state: 'running' } | { state: 'ok'; ms: number } | { state: 'error'; message: string };

interface ObjectDetailProps {
  /** The registry definition being worked on; null = writing a new one. */
  row: FleetRow | null;
  bus: FleetBu[];
  scans: Record<string, BuScan>;
  /** May create / edit / remove registry definitions (db_object.manage). */
  canAuthor: boolean;
  /** Opens the import panel — where a row without a structured form is imported again. */
  onOpenImport: () => void;
  /** May approve a definition for a real rollout (db_object.approve). */
  canApprove: boolean;
  /** May dry-run and apply to BUs (sql_workbench.manage). */
  canApply: boolean;
  /** The registry changed; `selectId` is the row to show afterwards (null = none). */
  onRegistryChanged: (selectId: string | null) => void;
  /** BUs that a real apply touched — the page rescans them. */
  onApplied: (codes: string[]) => void;
  /** True while a dry-run or apply is in flight, so the page can lock navigation. */
  onBusyChange: (busy: boolean) => void;
}

const NEW_VIEW_BODY = `SELECT id, code, name
  FROM tb_location`;

const isConflict = (err: unknown): boolean => (err as { response?: { status?: number } })?.response?.status === 409;
const sameSpec = (a: DbObjectSpec | null, b: DbObjectSpec | null): boolean => JSON.stringify(a) === JSON.stringify(b);
const fmtTime = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
};

/**
 * One registry definition. Its metadata is a form and its body an editor — the DDL header is
 * composed by the backend. The saved definition must be approved before it can be applied for
 * real; rolling it out is still two steps (try on every target with a rollback, then apply),
 * and every real rollout lands in the history below.
 */
export function ObjectDetail({
  row,
  bus,
  scans,
  canAuthor,
  onOpenImport,
  canApprove,
  canApply,
  onRegistryChanged,
  onApplied,
  onBusyChange,
}: ObjectDetailProps) {
  const { t } = useI18n();
  const okBus = useMemo(() => bus.filter((b) => scans[b.code]?.state === 'ok').map((b) => b.code), [bus, scans]);

  const [entry, setEntry] = useState<DbObjectRegistryEntry | null>(null);
  const [spec, setSpec] = useState<DbObjectSpec | null>(() => (row ? null : blankSpec('view', '', NEW_VIEW_BODY)));
  const [defLoading, setDefLoading] = useState(false);
  const [defError, setDefError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [targets, setTargets] = useState<string[]>(() => (row ? defaultTargets(row) : []));
  const [results, setResults] = useState<Record<string, RunResult>>({});
  const [lastRun, setLastRun] = useState<RunKind | null>(null);
  const [running, setRunning] = useState(false);
  const [passedSignature, setPassedSignature] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'apply' | 'drop' | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [diff, setDiff] = useState<{ bu: string; text: string } | null>(null);
  const [diffLoadingBu, setDiffLoadingBu] = useState<string | null>(null);
  const [log, setLog] = useState<DbObjectDeployLogRow[] | null>(null);

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

  const savedSpec = entry?.spec ?? null;
  const dirty = row ? spec !== null && !sameSpec(spec, savedSpec) : false;
  const [newTouched, setNewTouched] = useState(false);
  useUnsavedChanges(canAuthor && (dirty || (!row && newTouched)));

  const adopt = useCallback((e: DbObjectRegistryEntry) => {
    setEntry(e);
    setSpec(e.spec);
  }, []);

  const loadLog = useCallback(async (id: string) => {
    try {
      const rows = await dbObjectService.deployLog(id);
      if (!cancelledRef.current) setLog(rows);
    } catch {
      if (!cancelledRef.current) setLog([]);
    }
  }, []);

  const loadEntry = useCallback(
    async (id: string) => {
      setDefLoading(true);
      setDefError(null);
      try {
        const e = await dbObjectService.get(id);
        if (!cancelledRef.current) adopt(e);
      } catch (err) {
        if (!cancelledRef.current) setDefError(apiErrorMessage(err, t('pages.dbObjectFleet.loadDefinitionFailed')));
      } finally {
        if (!cancelledRef.current) setDefLoading(false);
      }
    },
    [t, adopt],
  );
  // Load once per definition; a rescan or a registry reload of the same row must not discard edits.
  useEffect(() => {
    if (!row) return;
    void loadEntry(row.id);
    void loadLog(row.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id]);

  const resetRun = () => {
    setPassedSignature(null);
    setResults({});
  };

  const save = async () => {
    if (!spec || !spec.body.trim()) return;
    setSaving(true);
    try {
      if (row) {
        adopt(await dbObjectService.update(row.id, { spec, doc_version: entry?.doc_version }));
        resetRun();
        toast.success(t('pages.dbObjectFleet.saved'));
        onRegistryChanged(row.id);
      } else {
        const created = await dbObjectService.create({ spec: { ...spec, name: spec.name.trim() } });
        toast.success(t('pages.dbObjectFleet.created'));
        setNewTouched(false);
        onRegistryChanged(created.id);
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

  const approve = async () => {
    if (!row || !entry) return;
    setApproving(true);
    try {
      adopt(await dbObjectService.approve(row.id, entry.doc_version));
      toast.success(t('pages.dbObjectFleet.approved'));
      onRegistryChanged(row.id);
    } catch (err) {
      if (isConflict(err)) {
        toast.error(t('pages.dbObjectFleet.conflict'));
        void loadEntry(row.id);
      } else {
        toast.error(apiErrorMessage(err, t('pages.dbObjectFleet.approveFailed')));
      }
    } finally {
      setApproving(false);
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

  const approved = entry?.approved === true;
  const hasSpec = entry ? entry.spec !== null : true;
  const signature = runSignature(entry?.hash ?? '', targets);
  const dryPassed = passedSignature === signature;
  const ready = canApply && !!entry && hasSpec && !dirty && !running && targets.length > 0;
  const applyUnlocked = ready && approved && dryPassed;
  const failedBus = Object.entries(results)
    .filter(([, r]) => r.state === 'error')
    .map(([code]) => code);

  const toggleTarget = (code: string) =>
    setTargets((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code].sort()));

  const runOn = useCallback(
    async (kind: RunKind) => {
      const codes = [...targets];
      if (!row || !entry || codes.length === 0) return;
      const hash = entry.hash;
      setRunning(true);
      setLastRun(kind);
      setPassedSignature(null);
      setResults(Object.fromEntries(codes.map((c) => [c, { state: 'running' } as RunResult])));
      const passedBus: string[] = [];
      await mapWithConcurrency(
        codes,
        FLEET_CONCURRENCY,
        (code) => {
          if (cancelledRef.current) return Promise.reject(new Error(t('pages.dbObjectFleet.cancelled')));
          return withRateLimitRetry(() =>
            dbObjectService.applyToBu(code, row.id, kind === 'drop' ? 'drop' : 'apply', kind === 'dry'),
          );
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
      if (kind === 'dry') {
        setRunning(false);
        if (failed === 0) {
          setPassedSignature(runSignature(hash, codes));
          toast.success(t('pages.dbObjectFleet.dryRunPassed', { count: codes.length }));
        } else {
          toast.warning(t('pages.dbObjectFleet.dryRunFailedSome', { failed, total: codes.length }));
        }
        return;
      }
      // Postgres reprints a view when it stores it, so read it back from one BU that took it:
      // the registry fingerprint then equals what a scan of those BUs returns. A routine body
      // is stored verbatim and needs no such step.
      if (kind === 'apply' && row.type === 'view' && passedBus.length > 0 && canAuthor) {
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
      void loadLog(row.id);
      onRegistryChanged(row.id);
      onApplied(codes);
      const counts = { passed: passedBus.length, failed, total: codes.length, count: codes.length };
      if (failed === 0) {
        toast.success(t(kind === 'drop' ? 'pages.dbObjectFleet.droppedAll' : 'pages.dbObjectFleet.appliedAll', counts));
      } else {
        toast.warning(t(kind === 'drop' ? 'pages.dbObjectFleet.droppedSome' : 'pages.dbObjectFleet.appliedSome', counts));
      }
    },
    [targets, row, entry, canAuthor, t, onApplied, onRegistryChanged, loadEntry, loadLog],
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

  const editable = canAuthor && hasSpec;
  const canSave =
    editable && !saving && !running && !!spec && spec.body.trim() !== '' && (row ? dirty : spec.name.trim() !== '');
  const applyHint = !hasSpec
    ? t('pages.dbObjectFleet.needsReimport')
    : dirty
      ? t('pages.dbObjectFleet.applyNeedsSave')
      : !approved
        ? t('pages.dbObjectFleet.applyNeedsApproval')
        : applyUnlocked
          ? t('pages.dbObjectFleet.applyReady')
          : t('pages.dbObjectFleet.applyNeedsDryRun');

  return (
    <section className="min-w-0 space-y-4 rounded-lg border p-4" aria-label={t('pages.dbObjectFleet.detailAria')}>
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="flex flex-wrap items-center gap-2 font-mono text-base font-semibold break-all">
            <span>
              {row ? row.name : t('pages.dbObjectFleet.newObjectTitle')}
              {row?.identity_args ? <span className="text-muted-foreground font-normal">({row.identity_args})</span> : null}
            </span>
            {row && entry && hasSpec && (
              <Badge variant={approved && !dirty ? 'success' : 'warning'} className="font-sans">
                {approved && !dirty ? t('pages.dbObjectFleet.approvedBadge') : t('pages.dbObjectFleet.pendingBadge')}
              </Badge>
            )}
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
        {row && canApprove && entry && hasSpec && !approved && (
          <Button size="sm" disabled={dirty || approving || running} onClick={approve}>
            {approving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BadgeCheck className="mr-2 h-4 w-4" />}
            {t('pages.dbObjectFleet.approve')}
          </Button>
        )}
        {row && canAuthor && (
          <Button variant="outline" size="sm" disabled={running || saving} onClick={() => setRemoveOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            {t('pages.dbObjectFleet.remove')}
          </Button>
        )}
      </header>

      {defError && (
        <p role="alert" className="text-destructive text-xs">
          {defError}
        </p>
      )}
      {entry && !hasSpec && (
        <div role="alert" className="text-warning flex flex-wrap items-center gap-3 text-xs">
          <span>{t('pages.dbObjectFleet.needsReimport')}</span>
          {canAuthor && (
            <Button size="sm" variant="outline" className="h-7" onClick={onOpenImport}>
              {t('pages.dbObjectFleet.staleBannerAction')}
            </Button>
          )}
        </div>
      )}

      {spec && (
        <SpecForm
          spec={spec}
          isNew={!row}
          readOnly={!editable}
          onChange={(next) => {
            setSpec(next);
            if (!row) setNewTouched(true);
          }}
        />
      )}

      {/* The body — the only free-form SQL of a definition */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium">{t('pages.dbObjectFleet.bodyLabel')}</span>
          {row && dirty && <span className="text-warning">{t('pages.dbObjectFleet.unsaved')}</span>}
          {defLoading && <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" aria-hidden />}
          {editable && (
            <Button size="sm" className="ml-auto h-7" disabled={!canSave} onClick={save}>
              {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
              {row ? t('pages.dbObjectFleet.save') : t('pages.dbObjectFleet.create')}
            </Button>
          )}
        </div>
        <div className="flex h-[20rem] flex-col overflow-hidden rounded-md border">
          <SqlEditor
            value={spec?.body ?? entry?.definition ?? ''}
            readOnly={!editable || !spec}
            onChange={(body) => {
              if (!spec) return;
              setSpec({ ...spec, body });
              if (!row) setNewTouched(true);
            }}
          />
        </div>
        {editable && <p className="text-muted-foreground text-[11px]">{t('pages.dbObjectFleet.bodyRules')}</p>}
        {entry && hasSpec && (
          <details className="rounded-md border text-xs">
            <summary className="cursor-pointer px-3 py-1.5 font-medium">{t('pages.dbObjectFleet.composedLabel')}</summary>
            <pre className="bg-muted/40 max-h-64 overflow-auto border-t p-3 font-mono text-[11px] whitespace-pre-wrap">
              {entry.definition}
            </pre>
          </details>
        )}
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
                          {status === 'outdated' && (
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
                            {lastRun === 'dry'
                              ? t('pages.dbObjectFleet.resultDryOk')
                              : lastRun === 'drop'
                                ? t('pages.dbObjectFleet.resultDropped')
                                : t('pages.dbObjectFleet.resultApplied')}
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
          <Button variant="outline" disabled={!ready || defLoading} onClick={() => runOn('dry')}>
            {running && lastRun === 'dry' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
            {t('pages.dbObjectFleet.dryRun', { count: targets.length })}
          </Button>
          <Button disabled={!applyUnlocked} onClick={() => setConfirm('apply')}>
            {running && lastRun === 'apply' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
            {t('pages.dbObjectFleet.apply', { count: targets.length })}
          </Button>
          <Button variant="outline" className="text-destructive" disabled={!ready || !approved} onClick={() => setConfirm('drop')}>
            {running && lastRun === 'drop' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            {t('pages.dbObjectFleet.drop', { count: targets.length })}
          </Button>
          <p className="text-muted-foreground basis-full text-xs">{applyHint}</p>
        </div>
      )}

      {/* Every real rollout of this definition */}
      {row && (
        <details className="rounded-md border text-xs">
          <summary className="cursor-pointer px-3 py-1.5 font-medium">
            {t('pages.dbObjectFleet.historyLabel', { count: log?.length ?? 0 })}
          </summary>
          {!log || log.length === 0 ? (
            <p className="text-muted-foreground border-t px-3 py-2">{t('pages.dbObjectFleet.historyEmpty')}</p>
          ) : (
            <div className="max-h-64 overflow-auto border-t">
              <table className="w-full">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="text-muted-foreground text-left">
                    <th className="px-2 py-1.5 font-medium">{t('pages.dbObjectFleet.colWhen')}</th>
                    <th className="px-2 py-1.5 font-medium">{t('pages.dbObjectFleet.colBu')}</th>
                    <th className="px-2 py-1.5 font-medium">{t('pages.dbObjectFleet.colAction')}</th>
                    <th className="px-2 py-1.5 font-medium">{t('pages.dbObjectFleet.colVersion')}</th>
                    <th className="px-2 py-1.5 font-medium">{t('pages.dbObjectFleet.colResult')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {log.map((l) => (
                    <tr key={l.id}>
                      <td className="px-2 py-1 whitespace-nowrap">{fmtTime(l.created_at)}</td>
                      <td className="px-2 py-1 font-mono">{l.bu_code}</td>
                      <td className="px-2 py-1">{l.action}</td>
                      <td className="px-2 py-1 font-mono">
                        v{l.doc_version} · {l.hash}
                      </td>
                      <td className={l.success ? 'text-success px-2 py-1' : 'text-destructive px-2 py-1 break-words'}>
                        {l.success ? t('pages.dbObjectFleet.logOk') : (l.error ?? t('pages.dbObjectFleet.applyFailed'))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
      )}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t(confirm === 'drop' ? 'pages.dbObjectFleet.dropTitle' : 'pages.dbObjectFleet.confirmTitle', { count: targets.length })}
        description={t(
          confirm === 'drop' ? 'pages.dbObjectFleet.dropDescription' : 'pages.dbObjectFleet.confirmDescription',
          { name: row?.name ?? '', bus: targets.join(', ') },
        )}
        confirmText={t(confirm === 'drop' ? 'pages.dbObjectFleet.confirmDrop' : 'pages.dbObjectFleet.confirmApply')}
        onConfirm={() => {
          const kind = confirm;
          setConfirm(null);
          if (kind) void runOn(kind);
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
          {diff && <SqlDiffView original={diff.text} current={entry?.definition ?? ''} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}

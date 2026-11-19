import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useI18n } from '../../hooks/useI18n';
import type { DbObjectArg, DbObjectRoutineSpec, DbObjectSpec } from '../../types';

interface SpecFormProps {
  spec: DbObjectSpec;
  onChange: (spec: DbObjectSpec) => void;
  readOnly: boolean;
}

const KINDS = ['view', 'function', 'procedure'] as const;
const MODES: DbObjectArg['mode'][] = ['in', 'out', 'inout', 'variadic', 'table'];
const selectClass = 'border-input bg-background h-9 w-full rounded-md border px-2 text-sm disabled:opacity-60';

/**
 * Everything of a definition except its body: fixed choices and short fields. The DDL header is
 * composed by the backend from these, so nothing here is free-form SQL beyond a type name or a
 * default expression — and those are parsed on save. Kind and name identify the object, so they
 * only show here: a new object comes from an uploaded migration file (UploadPanel).
 */
export function SpecForm({ spec, onChange, readOnly }: SpecFormProps) {
  const { t } = useI18n();
  const routine = spec.type === 'view' ? null : spec;
  const patch = (p: Partial<DbObjectRoutineSpec>) => routine && onChange({ ...routine, ...p });
  const setArg = (i: number, p: Partial<DbObjectArg>) =>
    patch({ args: routine!.args.map((a, n) => (n === i ? { ...a, ...p } : a)) });
  const hasTable = !!routine?.args.some((a) => a.mode === 'table');

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <label className="space-y-1 text-xs">
          <span className="block font-medium">{t('pages.dbObjectFleet.fieldKind')}</span>
          <select className={selectClass} value={spec.type} disabled>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="block font-medium">{t('pages.dbObjectFleet.fieldName')}</span>
          <Input value={spec.name} disabled className="h-9 font-mono text-xs" />
        </label>
      </div>

      {routine && (
        <>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{t('pages.dbObjectFleet.fieldArgs')}</span>
              {!readOnly && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 text-[11px]"
                  onClick={() => patch({ args: [...routine.args, { name: '', type: 'text', mode: 'in' }] })}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  {t('pages.dbObjectFleet.addArg')}
                </Button>
              )}
            </div>
            {routine.args.length === 0 ? (
              <p className="text-muted-foreground text-[11px]">{t('pages.dbObjectFleet.noArgs')}</p>
            ) : (
              <ul className="space-y-1" aria-label={t('pages.dbObjectFleet.fieldArgs')}>
                {routine.args.map((a, i) => (
                  <li key={i} className="grid grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_2rem] gap-1">
                    <select
                      className={selectClass}
                      value={a.mode}
                      disabled={readOnly}
                      aria-label={t('pages.dbObjectFleet.argMode', { n: i + 1 })}
                      onChange={(e) => setArg(i, { mode: e.target.value as DbObjectArg['mode'] })}
                    >
                      {MODES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={a.name}
                      disabled={readOnly}
                      aria-label={t('pages.dbObjectFleet.argName', { n: i + 1 })}
                      placeholder={t('pages.dbObjectFleet.argNamePh')}
                      onChange={(e) => setArg(i, { name: e.target.value })}
                      className="h-9 font-mono text-xs"
                    />
                    <Input
                      value={a.type}
                      disabled={readOnly}
                      aria-label={t('pages.dbObjectFleet.argType', { n: i + 1 })}
                      placeholder="uuid"
                      onChange={(e) => setArg(i, { type: e.target.value })}
                      className="h-9 font-mono text-xs"
                    />
                    <Input
                      value={a.default ?? ''}
                      disabled={readOnly || a.mode === 'out' || a.mode === 'table'}
                      aria-label={t('pages.dbObjectFleet.argDefault', { n: i + 1 })}
                      placeholder={t('pages.dbObjectFleet.argDefaultPh')}
                      onChange={(e) => setArg(i, { default: e.target.value || null })}
                      className="h-9 font-mono text-xs"
                    />
                    {!readOnly && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-8"
                        aria-label={t('pages.dbObjectFleet.removeArg', { n: i + 1 })}
                        onClick={() => patch({ args: routine.args.filter((_, n) => n !== i) })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {routine.type === 'function' && (
              <label className="space-y-1 text-xs">
                <span className="block font-medium">{t('pages.dbObjectFleet.fieldReturns')}</span>
                <Input
                  value={hasTable ? '' : (routine.returns ?? '')}
                  disabled={readOnly || hasTable}
                  placeholder={hasTable ? t('pages.dbObjectFleet.returnsTable') : 'integer'}
                  onChange={(e) => patch({ returns: e.target.value })}
                  className="h-9 font-mono text-xs"
                />
              </label>
            )}
            <label className="space-y-1 text-xs">
              <span className="block font-medium">{t('pages.dbObjectFleet.fieldLanguage')}</span>
              <select
                className={selectClass}
                value={routine.language}
                disabled={readOnly}
                onChange={(e) => patch({ language: e.target.value as DbObjectRoutineSpec['language'] })}
              >
                <option value="sql">sql</option>
                <option value="plpgsql">plpgsql</option>
              </select>
            </label>
            {routine.type === 'function' && (
              <label className="space-y-1 text-xs">
                <span className="block font-medium">{t('pages.dbObjectFleet.fieldVolatility')}</span>
                <select
                  className={selectClass}
                  value={routine.volatility}
                  disabled={readOnly}
                  onChange={(e) => patch({ volatility: e.target.value as DbObjectRoutineSpec['volatility'] })}
                >
                  <option value="volatile">volatile</option>
                  <option value="stable">stable</option>
                  <option value="immutable">immutable</option>
                </select>
              </label>
            )}
            <div className="flex flex-col justify-end gap-1 text-xs">
              {routine.type === 'function' && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={routine.strict}
                    disabled={readOnly}
                    onChange={(e) => patch({ strict: e.target.checked })}
                  />
                  {t('pages.dbObjectFleet.fieldStrict')}
                </label>
              )}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={routine.pin_search_path}
                  disabled={readOnly}
                  onChange={(e) => patch({ pin_search_path: e.target.checked })}
                />
                {t('pages.dbObjectFleet.fieldPin')}
              </label>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

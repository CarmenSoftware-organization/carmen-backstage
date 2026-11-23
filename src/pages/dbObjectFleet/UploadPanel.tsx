import { useState } from 'react';
import { FileUp, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { useI18n } from '../../hooks/useI18n';
import dbObjectService from '../../services/dbObjectService';
import type { DbObjectUploadResult, DbObjectUploadStatus } from '../../types';
import type { FleetBu } from './fleetMatrix';
import { apiErrorMessage } from './fleetRequest';

interface UploadPanelProps {
  bus: FleetBu[];
  /** Objects were added; `selectId` is the first of them, to show afterwards. */
  onCreated: (selectId: string | null) => void;
}

// Matches the gateway's limit on sql_text; the largest tenant migration so far is ~63 KB.
const MAX_BYTES = 1_000_000;

const readText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsText(file);
  });

/**
 * New definitions come from a migration file. The file is tried in a chosen BU and rolled back —
 * that BU does not change — and what it made is read back from the BU's catalog, so each new
 * definition is exactly what the file creates. Objects the registry already has are only listed:
 * changing one is done on its own page. Added definitions start unapproved, like any change.
 */
export function UploadPanel({ bus, onCreated }: UploadPanelProps) {
  const { t } = useI18n();
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [buCode, setBuCode] = useState<string>(() => bus[0]?.code ?? '');
  const [fileError, setFileError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DbObjectUploadResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [adding, setAdding] = useState(false);

  const pick = async (picked: File | undefined) => {
    setPreview(null);
    setFileError(null);
    setFile(null);
    if (!picked) return;
    if (/\.down\.sql$/i.test(picked.name)) return setFileError(t('pages.dbObjectFleet.uploadDownFile'));
    if (picked.size > MAX_BYTES) return setFileError(t('pages.dbObjectFleet.uploadTooBig'));
    try {
      setFile({ name: picked.name, text: await readText(picked) });
    } catch {
      setFileError(t('pages.dbObjectFleet.uploadReadFailed'));
    }
  };

  const send = (dryRun: boolean) =>
    dbObjectService.uploadFile({ buCode, sqlText: file?.text ?? '', fileName: file?.name, dryRun });

  const check = async () => {
    if (!file || !buCode) return;
    setChecking(true);
    setPreview(null);
    try {
      setPreview(await send(true));
    } catch (err) {
      toast.error(apiErrorMessage(err, t('pages.dbObjectFleet.uploadCheckFailed')));
    } finally {
      setChecking(false);
    }
  };

  const add = async () => {
    if (!file || !preview) return;
    setAdding(true);
    try {
      const res = await send(false);
      const made = res.objects.filter((o) => o.status === 'created');
      toast.success(t('pages.dbObjectFleet.uploadCreated', { count: made.length }));
      onCreated(made[0]?.id ?? null);
    } catch (err) {
      toast.error(apiErrorMessage(err, t('pages.dbObjectFleet.uploadCreateFailed')));
    } finally {
      setAdding(false);
    }
  };

  const fresh = preview?.objects.filter((o) => o.status === 'new').length ?? 0;
  const statusBadge = (status: DbObjectUploadStatus) =>
    status === 'new' ? (
      <Badge variant="info">{t('pages.dbObjectFleet.uploadStatusNew')}</Badge>
    ) : status === 'same' ? (
      <Badge variant="secondary">{t('pages.dbObjectFleet.uploadStatusSame')}</Badge>
    ) : (
      <Badge variant="warning">{t('pages.dbObjectFleet.uploadStatusDiffers')}</Badge>
    );

  return (
    <section className="min-w-0 space-y-4 rounded-lg border p-4" aria-label={t('pages.dbObjectFleet.uploadTitle')}>
      <header className="space-y-1">
        <h2 className="text-base font-semibold">{t('pages.dbObjectFleet.uploadTitle')}</h2>
        <p className="text-muted-foreground text-xs">{t('pages.dbObjectFleet.uploadHint')}</p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 space-y-1 text-xs">
          <span className="block font-medium">{t('pages.dbObjectFleet.uploadFile')}</span>
          <input
            type="file"
            accept=".sql,text/plain"
            disabled={checking || adding}
            onChange={(e) => void pick(e.target.files?.[0])}
            className="border-input bg-background file:bg-muted block h-9 w-full rounded-md border px-2 text-xs file:mr-3 file:h-full file:border-0 file:px-2 file:text-xs"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="block font-medium">{t('pages.dbObjectFleet.uploadTryIn')}</span>
          <select
            className="border-input bg-background h-9 rounded-md border px-2 font-mono text-xs"
            value={buCode}
            disabled={checking || adding}
            onChange={(e) => {
              setBuCode(e.target.value);
              setPreview(null);
            }}
          >
            {bus.map((b) => (
              <option key={b.code} value={b.code}>
                {b.code}
              </option>
            ))}
          </select>
        </label>
        <Button variant="outline" disabled={!file || !buCode || checking || adding} onClick={check}>
          {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
          {t('pages.dbObjectFleet.uploadCheck')}
        </Button>
      </div>
      {fileError && (
        <p role="alert" className="text-destructive-ink text-xs">
          {fileError}
        </p>
      )}

      {preview && (
        <div className="space-y-3">
          <div className="max-h-[24rem] overflow-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-muted-foreground text-left">
                  <th className="px-2 py-1.5 font-medium">{t('pages.dbObjectFleet.colObject')}</th>
                  <th className="px-2 py-1.5 font-medium">{t('pages.dbObjectFleet.colStatus')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.objects.map((o) => (
                  <tr key={`${o.type}:${o.name}(${o.identity_args})`}>
                    <td className="px-2 py-1.5">
                      <span className="font-mono break-all">{o.name}</span>
                      <span className="text-muted-foreground block text-[11px]">
                        {o.type}
                        {o.identity_args ? ` (${o.identity_args})` : ''}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      {statusBadge(o.status)}
                      {o.status === 'differs' && (
                        <span className="text-muted-foreground block pt-0.5 text-[11px]">
                          {t('pages.dbObjectFleet.uploadDiffersHint')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.not_stored.length > 0 && (
            <details className="rounded-md border text-xs">
              <summary className="cursor-pointer px-3 py-1.5 font-medium">
                {t('pages.dbObjectFleet.uploadNotStored', { count: preview.not_stored.length })}
              </summary>
              <pre className="bg-muted/40 max-h-40 overflow-auto border-t p-3 font-mono text-[11px] whitespace-pre-wrap">
                {preview.not_stored.join(';\n')}
              </pre>
            </details>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={fresh === 0 || adding} onClick={add}>
              {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {t('pages.dbObjectFleet.uploadCreate', { count: fresh })}
            </Button>
            <p className="text-muted-foreground text-xs">
              {fresh === 0 ? t('pages.dbObjectFleet.uploadNothingNew') : t('pages.dbObjectFleet.uploadCreateHint')}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

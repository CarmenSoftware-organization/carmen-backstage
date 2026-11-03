import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { useI18n } from '../../../hooks/useI18n';
import { useAuth } from '../../../context/AuthContext';
import storageQuotaService from '../../../services/storageQuotaService';
import { getErrorDetail } from '../../../utils/errorParser';
import {
  MIN_QUOTA_BYTES,
  bytesToGb,
  bytesToGbInput,
  gbInputToBytes,
} from '../../../utils/storageQuota';
import type { BuStorageQuotaView } from '../../../types';
import { StorageMeter } from './StorageMeter';

interface BuStorageQuotaCardProps {
  buId: string;
}

interface QuotaForm {
  db: string;
  file: string;
  exempt: boolean;
  note: string;
}

const toForm = (view: BuStorageQuotaView): QuotaForm => ({
  db: bytesToGbInput(view.quota.db_quota_bytes),
  file: bytesToGbInput(view.quota.file_quota_bytes),
  exempt: view.quota.exempt,
  note: view.quota.note ?? '',
});

/**
 * การ์ดโควตาพื้นที่เก็บข้อมูลของ BU (ฝั่งทีม Carmen เท่านั้น) — แถบ database + ไฟล์แนบ,
 * ช่องตั้งโควตาเป็น GB (ว่าง = ค่า default), สวิตช์ยกเว้นการบล็อก และปุ่มวัดทันที
 * แสดงเมื่อมีสิทธิ์ `storage_quota.read` · แก้/วัดต้องมี `storage_quota.manage`
 */
export function BuStorageQuotaCard({ buId }: BuStorageQuotaCardProps) {
  const { t } = useI18n();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('storage_quota.manage');
  const [view, setView] = useState<BuStorageQuotaView | null>(null);
  const [form, setForm] = useState<QuotaForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ db?: string; file?: string }>({});

  const apply = useCallback((next: BuStorageQuotaView) => {
    setView(next);
    setForm(toForm(next));
    setFieldErrors({});
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      apply(await storageQuotaService.get(buId));
    } catch (err: unknown) {
      setError(getErrorDetail(err));
    } finally {
      setLoading(false);
    }
  }, [buId, apply]);

  useEffect(() => {
    void load();
  }, [load]);

  const validate = (value: string): string | undefined => {
    const bytes = gbInputToBytes(value);
    if (bytes === null) return undefined;
    if (Number.isNaN(bytes) || bytes < MIN_QUOTA_BYTES) return t('pages.storageQuota.quotaMin');
    return undefined;
  };

  const handleSave = async () => {
    if (!form) return;
    const errors = { db: validate(form.db), file: validate(form.file) };
    setFieldErrors(errors);
    if (errors.db || errors.file) return;
    try {
      setSaving(true);
      apply(
        await storageQuotaService.update(buId, {
          db_quota_bytes: gbInputToBytes(form.db),
          file_quota_bytes: gbInputToBytes(form.file),
          exempt: form.exempt,
          note: form.note.trim() === '' ? null : form.note.trim(),
        }),
      );
      toast.success(t('pages.storageQuota.saved'));
    } catch (err: unknown) {
      toast.error(getErrorDetail(err));
    } finally {
      setSaving(false);
    }
  };

  const handleMeasure = async () => {
    try {
      setMeasuring(true);
      await storageQuotaService.measure(buId);
      // วัดเสร็จแล้วโหลดใหม่ทั้งก้อน เพื่อให้ผลวัดกับโควตาที่แสดงมาจากชุดเดียวกัน
      // แต่ไม่ทับฟอร์มที่ผู้ใช้กำลังแก้ค้างอยู่ — ใช้เฉพาะ usage
      const fresh = await storageQuotaService.get(buId);
      setView(fresh);
      toast.success(t('pages.storageQuota.measured'));
    } catch (err: unknown) {
      toast.error(getErrorDetail(err));
    } finally {
      setMeasuring(false);
    }
  };

  const dirty = !!view && !!form && JSON.stringify(form) !== JSON.stringify(toForm(view));
  const usageOf = (kind: 'database' | 'attachment') => view?.usage.kinds.find((k) => k.kind === kind);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{t('pages.storageQuota.cardTitle')}</h3>
          <p className="text-muted-foreground text-sm">{t('pages.storageQuota.cardDesc')}</p>
        </div>
        {canManage && (
          <Button variant="outline" size="sm" onClick={handleMeasure} disabled={measuring || loading}>
            {measuring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {measuring ? t('pages.storageQuota.measuring') : t('pages.storageQuota.measureNow')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-muted-foreground text-xs" role="status">{t('common.busy.loadingEllipsis')}</p>
        ) : error || !view || !form ? (
          <p className="text-destructive text-sm" role="alert">{error}</p>
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2">
              <StorageMeter label={t('pages.storageQuota.database')} usage={usageOf('database')} />
              <StorageMeter label={t('pages.storageQuota.attachment')} usage={usageOf('attachment')} />
            </div>
            {!view.usage.enforce && (
              <p className="text-muted-foreground text-xs">{t('pages.storageQuota.enforceOff')}</p>
            )}

            <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bu-storage-db-gb">{t('pages.storageQuota.dbQuotaGb')}</Label>
                <Input
                  id="bu-storage-db-gb"
                  type="number"
                  min={1}
                  step="any"
                  inputMode="decimal"
                  disabled={!canManage || saving}
                  placeholder={t('pages.storageQuota.defaultPlaceholder', { gb: bytesToGb(view.defaults.db_bytes) })}
                  value={form.db}
                  onChange={(e) => setForm({ ...form, db: e.target.value })}
                  className={fieldErrors.db ? 'border-destructive' : ''}
                />
                {fieldErrors.db && <p className="text-destructive text-xs">{fieldErrors.db}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bu-storage-file-gb">{t('pages.storageQuota.fileQuotaGb')}</Label>
                <Input
                  id="bu-storage-file-gb"
                  type="number"
                  min={1}
                  step="any"
                  inputMode="decimal"
                  disabled={!canManage || saving}
                  placeholder={t('pages.storageQuota.defaultPlaceholder', { gb: bytesToGb(view.defaults.file_bytes) })}
                  value={form.file}
                  onChange={(e) => setForm({ ...form, file: e.target.value })}
                  className={fieldErrors.file ? 'border-destructive' : ''}
                />
                {fieldErrors.file && <p className="text-destructive text-xs">{fieldErrors.file}</p>}
              </div>
              <label className="flex items-center gap-2 rounded-md border border-input p-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={form.exempt}
                  disabled={!canManage || saving}
                  onChange={(e) => setForm({ ...form, exempt: e.target.checked })}
                />
                <span>
                  {t('pages.storageQuota.exempt')}
                  <span className="text-muted-foreground block text-xs">{t('pages.storageQuota.exemptHint')}</span>
                </span>
              </label>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="bu-storage-note">{t('pages.storageQuota.note')}</Label>
                <Input
                  id="bu-storage-note"
                  maxLength={2000}
                  disabled={!canManage || saving}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </div>
            </div>
            {canManage && (
              <div className="flex justify-end">
                <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {saving ? t('common.busy.saving') : t('common.action.saveChanges')}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

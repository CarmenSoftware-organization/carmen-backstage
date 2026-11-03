import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eraser, FilePlus2, Loader2, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { useI18n } from '../../../hooks/useI18n';
import { useAuth } from '../../../context/AuthContext';
import Can from '../../../components/Can';
import storageQuotaService from '../../../services/storageQuotaService';
import { getErrorDetail } from '../../../utils/errorParser';
import { formatBytes } from '../../../utils/storageQuota';
import type { BuStorageQuotaView, StorageQuotaPatch, StorageReclaimJob } from '../../../types';
import { StorageMeter } from './StorageMeter';

interface BuStorageQuotaCardProps {
  buId: string;
}

/** ช่วง poll สถานะงาน reclaim ขณะ queued/running */
const RECLAIM_POLL_MS = 5000;

const RECLAIM_STATUS_KEY = {
  queued: 'pages.storageQuota.reclaimQueued',
  running: 'pages.storageQuota.reclaimRunning',
  done: 'pages.storageQuota.reclaimDone',
  failed: 'pages.storageQuota.reclaimFailed',
} as const;

const isActiveJob = (job: StorageReclaimJob | null): boolean =>
  job?.status === 'queued' || job?.status === 'running';

interface QuotaForm {
  exempt: boolean;
  note: string;
}

const toForm = (view: BuStorageQuotaView): QuotaForm => ({
  exempt: view.quota.exempt,
  note: view.quota.note ?? '',
});

/**
 * การ์ดโควตาพื้นที่เก็บข้อมูลของ BU (ฝั่งทีม Carmen เท่านั้น) — แถบ database + ไฟล์แนบ
 * พร้อมแหล่งของโควตา (ลิงก์ใบ storage หรือ "Default"), ปุ่มออก/เปลี่ยนใบ (`subscription.manage`),
 * สวิตช์ยกเว้นการบล็อก + หมายเหตุ และปุ่มวัดทันที
 * โควตาแก้ที่ใบ storage ไม่ใช่ที่การ์ดนี้ · แสดงเมื่อมีสิทธิ์ `storage_quota.read` · แก้/วัดต้องมี `storage_quota.manage`
 */
export function BuStorageQuotaCard({ buId }: BuStorageQuotaCardProps) {
  const { t } = useI18n();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const canManage = hasPermission('storage_quota.manage');
  const [view, setView] = useState<BuStorageQuotaView | null>(null);
  const [form, setForm] = useState<QuotaForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [job, setJob] = useState<StorageReclaimJob | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const jobActive = isActiveJob(job);
  // สถานะที่เห็นล่าสุด — วัดใหม่เฉพาะตอนเห็นงานเปลี่ยนจาก queued/running เป็น done (ไม่วัดตอนโหลดงานเก่าที่ done อยู่แล้ว)
  const prevActiveRef = useRef(false);

  const apply = useCallback((next: BuStorageQuotaView) => {
    setView(next);
    setForm(toForm(next));
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

  // โหลดงาน reclaim ล่าสุดตอนเปิดการ์ด (ล้มเหลวเงียบ ๆ — ไม่กระทบส่วนอื่นของการ์ด)
  useEffect(() => {
    let cancelled = false;
    storageQuotaService
      .getReclaim(buId)
      .then((latest) => {
        if (cancelled) return;
        prevActiveRef.current = isActiveJob(latest);
        setJob(latest);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [buId]);

  // poll ทุก 5 วิขณะงาน queued/running · หยุดเมื่อเสร็จ/ล้มเหลว หรือ unmount
  useEffect(() => {
    if (!jobActive) return;
    let cancelled = false;
    const timer = setInterval(() => {
      storageQuotaService
        .getReclaim(buId)
        .then((latest) => {
          if (!cancelled) setJob(latest);
        })
        .catch(() => undefined);
    }, RECLAIM_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [buId, jobActive]);

  // งานเพิ่งจบ: done → วัดซ้ำครั้งเดียวแล้วรีเฟรชแถบ · failed → แจ้งเตือน
  useEffect(() => {
    const wasActive = prevActiveRef.current;
    prevActiveRef.current = jobActive;
    if (!wasActive || jobActive || !job) return;
    if (job.status === 'failed') {
      toast.error(t('pages.storageQuota.reclaimFailedToast'));
      return;
    }
    if (job.status === 'done' && canManage) {
      void (async () => {
        try {
          const measured = await storageQuotaService.measure(buId);
          setView((v) => (v ? { ...v, usage: measured } : v));
          toast.success(t('pages.storageQuota.reclaimDoneToast'));
        } catch (err: unknown) {
          toast.error(getErrorDetail(err));
        }
      })();
    }
  }, [job, jobActive, buId, t, canManage]);

  const handleReclaim = async () => {
    try {
      const started = await storageQuotaService.startReclaim(buId);
      prevActiveRef.current = true;
      setJob(started);
      setConfirmOpen(false);
      toast.success(t('pages.storageQuota.reclaimStarted'));
    } catch (err: unknown) {
      setConfirmOpen(false);
      toast.error(getErrorDetail(err));
    }
  };

  const buildPatch = (f: QuotaForm, v: BuStorageQuotaView): StorageQuotaPatch => {
    const loaded = toForm(v);
    const patch: StorageQuotaPatch = {};
    if (f.exempt !== loaded.exempt) patch.exempt = f.exempt;
    if (f.note !== loaded.note) patch.note = f.note.trim() === '' ? null : f.note.trim();
    return patch;
  };

  const handleSave = async () => {
    if (!form || !view) return;
    const patch = buildPatch(form, view);
    if (Object.keys(patch).length === 0) return;
    try {
      setSaving(true);
      // ส่งเฉพาะ field ที่ผู้ใช้แก้จริง (exempt / note)
      apply(await storageQuotaService.update(buId, patch));
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
      const measured = await storageQuotaService.measure(buId);
      // รวมผลวัดเข้ากับ view ปัจจุบัน ไม่ GET ซ้ำ และไม่แตะฟอร์มที่ผู้ใช้แก้ค้างอยู่
      setView((v) => (v ? { ...v, usage: measured } : v));
      if (measured.kinds.some((k) => k.flag === 'measure_failed')) {
        toast.warning(t('pages.storageQuota.measuredWithFailure'));
      } else {
        toast.success(t('pages.storageQuota.measured'));
      }
    } catch (err: unknown) {
      toast.error(getErrorDetail(err));
    } finally {
      setMeasuring(false);
    }
  };

  // ปุ่มบันทึกเปิดเมื่อมี patch จริงเท่านั้น (ตรงกับที่ handleSave จะส่ง)
  const dirty = !!view && !!form && Object.keys(buildPatch(form, view)).length > 0;
  const sourceOf = (kind: 'database' | 'attachment') => {
    const q = view?.quota;
    if (!q) return null;
    if (q.source?.[kind] === 'default') return <span>{t('pages.storageQuota.sourceDefault')}</span>;
    if (q.license && (!q.source || q.source[kind] === 'license')) {
      return (
        <Link to={`/licenses/storage/${q.license.id}/edit`} className="text-primary hover:underline">
          {q.license.license_number}
        </Link>
      );
    }
    return null; // backend เก่ายังไม่ส่ง license/source — ไม่แสดงแหล่ง
  };
  const usageOf = (kind: 'database' | 'attachment') => view?.usage.kinds.find((k) => k.kind === kind);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{t('pages.storageQuota.cardTitle')}</h3>
          <p className="text-muted-foreground text-sm">{t('pages.storageQuota.cardDesc')}</p>
        </div>
        {(canManage || !!view) && (
          <div className="flex flex-wrap gap-2">
            <Can permission="subscription.manage">
              <Button
                variant="outline"
                size="sm"
                disabled={loading || !view}
                onClick={() => navigate(`/licenses/storage/new?bu=${encodeURIComponent(buId)}`)}
              >
                <FilePlus2 className="mr-2 h-4 w-4" />
                {view?.quota.license ? t('pages.storageQuota.replaceLicense') : t('pages.storageQuota.issueLicense')}
              </Button>
            </Can>
            {canManage && (
              <>
            <Button variant="outline" size="sm" onClick={handleMeasure} disabled={measuring || loading}>
              {measuring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {measuring ? t('pages.storageQuota.measuring') : t('pages.storageQuota.measureNow')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)} disabled={jobActive || loading}>
              {jobActive ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eraser className="mr-2 h-4 w-4" />}
              {t('pages.storageQuota.reclaimAction')}
            </Button>
              </>
            )}
          </div>
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
              <div className="space-y-1">
                <StorageMeter label={t('pages.storageQuota.database')} usage={usageOf('database')} />
                <p className="text-muted-foreground text-xs empty:hidden">{sourceOf('database')}</p>
              </div>
              <div className="space-y-1">
                <StorageMeter label={t('pages.storageQuota.attachment')} usage={usageOf('attachment')} />
                <p className="text-muted-foreground text-xs empty:hidden">{sourceOf('attachment')}</p>
              </div>
            </div>
            {!view.usage.enforce && (
              <p className="text-muted-foreground text-xs">{t('pages.storageQuota.enforceOff')}</p>
            )}

            {job && (
              <div className="space-y-1 border-t pt-4 text-sm" role="status">
                <p className="font-medium">
                  {t('pages.storageQuota.reclaimTitle')}
                  {': '}
                  <span className={job.status === 'failed' ? 'text-destructive' : ''}>
                    {t(RECLAIM_STATUS_KEY[job.status])}
                  </span>
                </p>
                {job.bytes_before !== null && (
                  <p className="text-muted-foreground text-xs">
                    {t('pages.storageQuota.reclaimBefore')}: {formatBytes(job.bytes_before)}
                    {job.bytes_after !== null && (
                      <>
                        {' → '}
                        {t('pages.storageQuota.reclaimAfter')}: {formatBytes(job.bytes_after)}
                      </>
                    )}
                  </p>
                )}
                {job.started_at && (
                  <p className="text-muted-foreground text-xs">
                    {t('pages.storageQuota.reclaimStartedAt', { date: new Date(job.started_at).toLocaleString() })}
                    {job.finished_at &&
                      ` · ${t('pages.storageQuota.reclaimFinishedAt', { date: new Date(job.finished_at).toLocaleString() })}`}
                  </p>
                )}
                {job.skipped_tables?.length > 0 && (
                  <p className="text-warning text-xs break-words">
                    {t('pages.storageQuota.reclaimSkipped', { tables: job.skipped_tables.join(', ') })}
                  </p>
                )}
                {job.status === 'failed' && job.error && (
                  <p className="text-destructive text-xs break-words">{job.error}</p>
                )}
              </div>
            )}

            <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
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
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('pages.storageQuota.reclaimConfirmTitle')}
        description={t('pages.storageQuota.reclaimConfirmDescription')}
        confirmText={t('pages.storageQuota.reclaimConfirmAction')}
        onConfirm={handleReclaim}
      />
    </Card>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Eraser, FilePlus2, Loader2, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
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
import { LicenseSectionHeader } from '../../businessUnitEdit/LicenseSectionHeader';
import { relativeTime } from '../../../utils/relativeTime';

interface BuStorageQuotaCardProps {
  buId: string;
  /**
   * รายงานข้อมูลที่การ์ดถืออยู่ขึ้นไปให้หน้าแม่ (แถบสรุปบนหัวแท็บ) — การ์ดยังเป็นเจ้าของการโหลด
   * ผู้เรียกส่ง setter ของ useState ได้ตรง ๆ (ต้องเสถียร ไม่งั้น effect ยิงทุก render)
   */
  onStateChange?: (state: { view: BuStorageQuotaView | null; loading: boolean }) => void;
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
export function BuStorageQuotaCard({ buId, onStateChange }: BuStorageQuotaCardProps) {
  const { t } = useI18n();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const canManage = hasPermission('storage_quota.manage');
  const [view, setView] = useState<BuStorageQuotaView | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
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
    // มีค่าที่บันทึกไว้แล้ว (ยกเว้นอยู่ / มีหมายเหตุ) = เปิดส่วนตั้งค่าไว้ให้เห็น ไม่ซ่อนข้อมูลที่มีอยู่จริง
    // เปิดได้อย่างเดียว ไม่ปิดให้ — ผู้ใช้ที่กางไว้แล้วบันทึกต้องไม่เห็นส่วนนี้หุบเอง
    if (next.quota.exempt || (next.quota.note ?? '').trim() !== '') setAdminOpen(true);
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

  // ส่งทุกครั้งที่ view เปลี่ยน รวมผลวัดใหม่/reclaim — แถบสรุปจึงไม่ค้างค่าเก่าหลังกด Measure now
  useEffect(() => {
    onStateChange?.({ view, loading });
  }, [view, loading, onStateChange]);

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

  // ทั้งสอง kind วัดในรอบเดียวกันแทบทุกครั้ง — เวลาเดียวกันขึ้นบรรทัดเดียวบนหัวการ์ด ต่างกันค่อยกลับไปวาดรายแถบ
  const kinds = view?.usage.kinds ?? [];
  const sharedMeasuredAt =
    kinds.length > 0 && kinds.every((k) => k.measured_at === kinds[0].measured_at) ? kinds[0].measured_at : null;

  return (
    <Card>
      <LicenseSectionHeader
        title={t('pages.storageQuota.cardTitle')}
        facts={
          loading ? (
            t('common.busy.loadingEllipsis')
          ) : sharedMeasuredAt ? (
            <span title={new Date(sharedMeasuredAt).toLocaleString()}>
              {t('pages.storageQuota.measuredAt', { date: relativeTime(sharedMeasuredAt, new Date(), t) })}
            </span>
          ) : null
        }
        actions={
          canManage || !!view ? (
            <>
              <Can permission="subscription.manage">
                <Button
                  size="sm"
                  disabled={loading || !view}
                  onClick={() => navigate(`/licenses/storage/new?bu=${encodeURIComponent(buId)}`)}
                >
                  <FilePlus2 className="mr-2 h-4 w-4" />
                  {view?.quota.license ? t('pages.storageQuota.replaceLicense') : t('pages.storageQuota.issueLicense')}
                </Button>
              </Can>
              {canManage && (
                <Button variant="outline" size="sm" onClick={handleMeasure} disabled={measuring || loading}>
                  {measuring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  {measuring ? t('pages.storageQuota.measuring') : t('pages.storageQuota.measureNow')}
                </Button>
              )}
            </>
          ) : undefined
        }
      >
        {view && !view.usage.enforce && (
          <p className="text-muted-foreground text-xs">{t('pages.storageQuota.enforceOff')}</p>
        )}
      </LicenseSectionHeader>
      {!loading && (
      <CardContent className="space-y-4">
        {error || !view || !form ? (
          <p className="text-destructive text-sm" role="alert">{error}</p>
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2">
              {(['database', 'attachment'] as const).map((kind) => {
                const source = sourceOf(kind);
                return (
                  <div key={kind} className="space-y-1">
                    <StorageMeter
                      label={t(kind === 'database' ? 'pages.storageQuota.database' : 'pages.storageQuota.attachment')}
                      usage={usageOf(kind)}
                      showMeasuredAt={!sharedMeasuredAt}
                    />
                    {source && (
                      <p className="text-muted-foreground text-xs">
                        {t('pages.storageQuota.colSource')}: {source}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ตั้งค่าที่แตะไม่บ่อย (ยกเว้นการบล็อก · หมายเหตุ · reclaim) พับไว้ — แท็บนี้มีไว้อ่านสิทธิ์
                ไม่ใช่ฟอร์ม · ตอนพับยังบอกสถานะที่สำคัญผ่านป้ายบนแถวหัว เพื่อไม่ให้ "ยกเว้นอยู่" ถูกซ่อน
                · `<details>` จริงจึงได้คีย์บอร์ด/screen reader ฟรี ไม่ต้องเพิ่ม primitive */}
            <details
              className="group/admin border-t pt-3"
              open={adminOpen}
              onToggle={(e) => setAdminOpen(e.currentTarget.open)}
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 rounded-sm text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open/admin:rotate-90" aria-hidden="true" />
                {t('pages.storageQuota.adminSection')}
                {form.exempt && <Badge variant="warning">{t('pages.storageQuota.exemptBadge')}</Badge>}
                {job && (
                  <Badge variant={job.status === 'failed' ? 'destructive' : 'secondary'}>
                    {t(RECLAIM_STATUS_KEY[job.status])}
                  </Badge>
                )}
              </summary>
              <div className="space-y-4 pt-4">
                <label className="flex items-center gap-2 rounded-md border border-input p-2 text-sm">
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
                <div className="space-y-1.5">
                  <Label htmlFor="bu-storage-note">{t('pages.storageQuota.note')}</Label>
                  <Input
                    id="bu-storage-note"
                    maxLength={2000}
                    disabled={!canManage || saving}
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                  />
                </div>
                {canManage && (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* reclaim เป็นงานหนักที่ต้องยืนยัน — อยู่ในส่วนบำรุงรักษา ไม่ยืนเท่ากับ Measure now บนหัว */}
                    <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)} disabled={jobActive}>
                      {jobActive ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eraser className="mr-2 h-4 w-4" />}
                      {t('pages.storageQuota.reclaimAction')}
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {saving ? t('common.busy.saving') : t('common.action.saveChanges')}
                    </Button>
                  </div>
                )}
                {job && (
                  <div className="space-y-1 text-sm" role="status">
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
              </div>
            </details>
          </>
        )}
      </CardContent>
      )}
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

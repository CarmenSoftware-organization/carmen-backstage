import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2, Save, SearchX, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import Layout from '../../components/Layout';
import Can from '../../components/Can';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { BusinessUnitPicker } from '../../components/BusinessUnitPicker';
import { ReadOnlyField } from '../../components/ReadOnlyField';
import { useGlobalShortcuts } from '../../components/KeyboardShortcuts';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { DevDebugSheet } from '../../components/ui/dev-debug-sheet';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Skeleton } from '../../components/ui/skeleton';
import { Textarea } from '../../components/ui/textarea';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../hooks/useI18n';
import { useStorageQuotaDefaults } from '../../hooks/useStorageQuotaDefaults';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import type { BusinessUnitOption } from '../../hooks/useBusinessUnitSearch';
import businessUnitService from '../../services/businessUnitService';
import storageLicenseService from '../../services/businessUnitStorageLicenseService';
import { normalizeAudit } from '../../utils/audit';
import { getDocVersion, isVersionConflict, notifyVersionConflict } from '../../utils/docVersion';
import { devLog, getErrorDetail, isNotFoundError, parseApiError } from '../../utils/errorParser';
import { bytesToGbInput, formatBytes, gbInputToBytes, isValidQuotaInput } from '../../utils/storageQuota';
import { storageLicenseSource } from './storageLicenseSource';
import type { BuStorageLicense, BuStorageLicenseRow } from '../../types';

const LIST_PATH = '/licenses?tab=storage';

interface FormState {
  db: string;
  file: string;
  reference_no: string;
  note: string;
}

const EMPTY_FORM: FormState = { db: '', file: '', reference_no: '', note: '' };

const formFromLicense = (l: BuStorageLicense): FormState => ({
  db: bytesToGbInput(l.db_quota_bytes),
  file: bytesToGbInput(l.file_quota_bytes),
  reference_no: l.reference_no ?? '',
  note: l.note ?? '',
});

/** GB (ข้อความจากช่องกรอก) → ไบต์จำนวนเต็ม; '' = null */
const toBytes = (gb: string): number | null => {
  const b = gbInputToBytes(gb);
  return b === null ? null : Math.round(b);
};

// ป้ายสถานะมีแค่สองค่า — ใบไม่มีวันที่ จึงไม่มีสถานะ expired/scheduled และไม่ใช้ IssuedLicensePlate
// (แผ่นนั้นวาดแถบช่วงวันที่/วันคงเหลือ ซึ่งไม่มีความหมายกับใบนี้)
interface StoragePlateProps {
  row: BuStorageLicenseRow;
  inForce: boolean;
  dbLabel: string;
  fileLabel: string;
  sourceLabel: string;
}

const StoragePlate: React.FC<StoragePlateProps> = ({ row, inForce, dbLabel, fileLabel, sourceLabel }) => {
  const { t } = useI18n();
  const cell = (label: string, value: React.ReactNode) => (
    <div className="min-w-0 space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium">{value}</dd>
    </div>
  );
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="font-mono text-base">{row.license_number}</CardTitle>
        <Badge variant={inForce ? 'success' : 'secondary'}>
          {inForce ? t('pages.storageLicense.inForce') : t('pages.storageLicense.replaced')}
        </Badge>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cell(
            t('pages.storageLicense.form.businessUnit'),
            `${row.tb_business_unit.code} · ${row.tb_business_unit.name}`,
          )}
          {cell(t('pages.storageLicense.dbQuota'), dbLabel)}
          {cell(t('pages.storageLicense.fileQuota'), fileLabel)}
          {cell(t('pages.storageLicense.sourceColumn'), sourceLabel)}
        </dl>
      </CardContent>
    </Card>
  );
};

interface StorageLicenseFormProps {
  mode: 'create' | 'edit';
}

/**
 * ออก/แก้ใบ storage quota — ไม่มีวันที่ ไม่มีวันหมดอายุ (O3) · ใบใหม่แทนที่ใบที่ใช้อยู่ของ BU ทันที (O4)
 * แก้ได้เฉพาะใบที่ยังใช้อยู่ (`superseded_at` เป็น null) ใบที่ถูกแทนที่เปิดอ่านอย่างเดียว
 * ลบใบที่ใช้อยู่ = BU กลับไปใช้ค่า default ไม่ได้ปลุกใบก่อนหน้า (O10)
 */
const StorageLicenseForm: React.FC<StorageLicenseFormProps> = ({ mode }) => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('subscription.manage');
  const isNew = mode === 'create';
  const defaults = useStorageQuotaDefaults();

  const [bu, setBu] = useState<BusinessUnitOption | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [savedForm, setSavedForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<BuStorageLicenseRow | null>(null);
  const [rawResponse, setRawResponse] = useState<unknown>(null);
  const [docVersion, setDocVersion] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(!isNew);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // ใบที่ใช้อยู่ของ BU ที่เลือก (โหมดสร้าง) — undefined = ยังไม่รู้/อ่านไม่ได้ ไม่ใช่ "ไม่มี"
  const [current, setCurrent] = useState<BuStorageLicense | null | undefined>(undefined);

  // ใบที่ถูกแทนที่แล้วแก้ไม่ได้ (backend ตอบ 409 STORAGE_LICENSE_NOT_IN_FORCE)
  const replaced = !isNew && !!detail?.superseded_at;
  const canEditFields = canEdit && !replaced;

  const hasChanges = canEditFields && JSON.stringify(form) !== JSON.stringify(savedForm);
  useUnsavedChanges(hasChanges);

  // ── โหมดสร้าง: เติม BU จาก ?bu= ──
  const prefilledBu = searchParams.get('bu') ?? '';
  useEffect(() => {
    if (!isNew || !prefilledBu) return undefined;
    let cancelled = false;
    businessUnitService
      .getById(prefilledBu)
      .then((raw: { data?: Record<string, unknown> } & Record<string, unknown>) => {
        const d = (raw?.data ?? raw) as { id?: string; code?: string; name?: string; cluster_name?: string | null; cluster?: { name?: string } };
        if (cancelled) return;
        setBu({
          id: d.id ?? prefilledBu,
          code: d.code ?? prefilledBu,
          name: d.name ?? '',
          cluster_name: d.cluster_name ?? d.cluster?.name ?? null,
        });
      })
      .catch((err: unknown) => {
        devLog('Failed to load prefilled business unit:', err);
        // อ่านชื่อไม่ได้ (ไม่มีสิทธิ์ cluster.read) ก็ยังออกใบให้ id นี้ได้ — โชว์ id แทนชื่อ
        if (!cancelled) setBu({ id: prefilledBu, code: prefilledBu, name: '' });
      });
    return () => { cancelled = true; };
  }, [isNew, prefilledBu]);

  // ── โหมดสร้าง: ใบที่ใช้อยู่ของ BU ที่เลือก ──
  const buId = bu?.id;
  useEffect(() => {
    if (!isNew || !buId) { setCurrent(undefined); return undefined; }
    let stale = false;
    storageLicenseService
      .listByBu(buId)
      .then((list) => { if (!stale) setCurrent(list.find((l) => !l.superseded_at) ?? null); })
      .catch((err: unknown) => {
        devLog('Failed to read current storage licence:', err);
        if (!stale) setCurrent(undefined);
      });
    return () => { stale = true; };
  }, [isNew, buId]);

  // ── โหมดแก้ไข ──
  const load = useCallback(async () => {
    if (isNew || !id) return;
    try {
      setLoading(true);
      setNotFound(false);
      const row = await storageLicenseService.get(id);
      if (!row?.id) { setNotFound(true); return; }
      setRawResponse(row);
      setDetail(row);
      setDocVersion(getDocVersion(row));
      const loaded = formFromLicense(row);
      setForm(loaded);
      setSavedForm(loaded);
      setFieldErrors({});
      setError('');
    } catch (err: unknown) {
      if (isNotFoundError(err)) setNotFound(true);
      else setError(t('pages.licenses.loadFailedDetail') + getErrorDetail(err, t));
    } finally {
      setLoading(false);
    }
  }, [id, isNew, t]);

  useEffect(() => { void load(); }, [load]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setError('');
  };

  // ช่อง GB ตรวจด้วย isValidQuotaInput (validateField เดาจากชื่อช่อง ไม่รู้จักโควตา)
  const quotaError = (value: string): string =>
    isValidQuotaInput(value, true) ? '' : t('pages.storageLicense.form.quotaMin');

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'db' || name === 'file') setFieldErrors((p) => ({ ...p, [name]: quotaError(value), figures: '' }));
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setFieldErrors((p) => ({ ...p, [e.target.name]: '', figures: '' }));
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (isNew && !bu) next.bu = t('pages.storageLicense.form.buRequired');
    const dbErr = quotaError(form.db);
    const fileErr = quotaError(form.file);
    if (dbErr) next.db = dbErr;
    if (fileErr) next.file = fileErr;
    if (!dbErr && !fileErr && form.db.trim() === '' && form.file.trim() === '') {
      next.figures = t('pages.storageLicense.form.needOneFigure');
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildPayload = () => ({
    db_quota_bytes: toBytes(form.db),
    file_quota_bytes: toBytes(form.file),
    // ส่ง null เมื่อเคลียร์ช่อง เพื่อให้ล้างค่าเดิมได้ตอนแก้
    reference_no: form.reference_no.trim() || null,
    note: form.note.trim() || null,
  });

  const applyApiError = (err: unknown, prefixKey: 'pages.licenses.saveFailedPrefix') => {
    const { fields } = parseApiError(err, t);
    if (fields && Object.keys(fields).length > 0) setFieldErrors((p) => ({ ...p, ...fields }));
    else setError(t(prefixKey) + getErrorDetail(err, t));
  };

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isNew || !canEdit || saving) return;
    if (!validate() || !bu) return;
    setSaving(true);
    setError('');
    try {
      await storageLicenseService.create(bu.id, buildPayload());
      toast.success(t('toast.saved'));
      // ออกสำเร็จแล้ว ไม่ต้องให้ตัวป้องกัน unsaved ขวาง
      setSavedForm(form);
      navigate(LIST_PATH);
    } catch (err: unknown) {
      applyApiError(err, 'pages.licenses.saveFailedPrefix');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (isNew || !canEditFields || !detail || saving) return;
    if (!validate()) return;
    if (docVersion == null) { setError(t('pages.licenses.missingDocVersionOrOwner')); return; }
    setSaving(true);
    setError('');
    try {
      await storageLicenseService.update(detail.business_unit_id, detail.id, { ...buildPayload(), doc_version: docVersion });
      toast.success(t('toast.saved'));
      await load();
    } catch (err: unknown) {
      if (isVersionConflict(err)) {
        notifyVersionConflict(t);
        await load();
      } else if (isNotFoundError(err)) {
        setNotFound(true);
      } else {
        applyApiError(err, 'pages.licenses.saveFailedPrefix');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isNew || !canEdit || !detail) return;
    if (docVersion == null) { setError(t('pages.licenses.missingDocVersionOrOwner')); return; }
    try {
      await storageLicenseService.remove(detail.business_unit_id, detail.id, docVersion);
      toast.success(t('toast.deleted'));
      setSavedForm(form);
      navigate(LIST_PATH);
    } catch (err: unknown) {
      if (isVersionConflict(err)) {
        notifyVersionConflict(t);
        await load();
      } else if (isNotFoundError(err)) {
        setNotFound(true);
      } else {
        setError(t('pages.licenses.saveFailedPrefix') + getErrorDetail(err, t));
      }
    }
  };

  const handleCancelEdit = () => {
    if (isNew) navigate(LIST_PATH);
    else { setForm(savedForm); setFieldErrors({}); setError(''); }
  };

  useGlobalShortcuts({
    onSave: () => { if (hasChanges && !saving) { if (isNew) void handleCreate(); else void handleSave(); } },
    onCancel: () => { if (hasChanges) handleCancelEdit(); },
  });

  // ป้าย "ค่าเริ่มต้น" ใต้ช่อง — ไม่มีสิทธิ์อ่าน config = ป้ายไม่มีขนาด ไม่เดาเลข
  const blankHint = (def: number | undefined): string =>
    def === undefined
      ? t('pages.storageLicense.form.blankHintNoSize')
      : t('pages.storageLicense.form.blankHint', { size: formatBytes(def) });
  const quotaLabel = (bytes: number | null, def: number | undefined): string => {
    if (bytes !== null) return formatBytes(bytes);
    return def === undefined
      ? t('pages.storageLicense.defaultNoSize')
      : t('pages.storageLicense.default', { size: formatBytes(def) });
  };

  if (loading) {
    return (
      <Layout>
        <div className="space-y-4 sm:space-y-6" role="status" aria-label={t('pages.licenses.loadingAria')}>
          <div className="flex items-center gap-3 sm:gap-4">
            <Skeleton className="h-9 w-9 rounded-md" />
            <div className="flex-1">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-4 w-56 mt-2" />
            </div>
          </div>
          <Card>
            <CardContent className="space-y-4 pt-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (notFound) {
    return (
      <Layout>
        <div className="space-y-4 sm:space-y-6">
          <PageHeader backTo={LIST_PATH} title={t('pages.storageLicense.form.planeTitle')} />
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={SearchX}
                title={t('pages.licenses.notFoundTitle')}
                description={t('pages.licenses.notFoundDescription')}
                action={
                  <Button size="sm" onClick={() => navigate(LIST_PATH)}>
                    {t('pages.licenses.backToLicenses')}
                  </Button>
                }
              />
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const editing = isNew ? canEdit : canEditFields;
  const showUnsavedBar = hasChanges && !isNew;

  return (
    <Layout>
      <div className={`space-y-4 sm:space-y-6${showUnsavedBar ? ' pb-24' : ''}`}>
        {isNew ? (
          <PageHeader
            backTo={LIST_PATH}
            title={t('pages.storageLicense.form.newTitle')}
            subtitle={t('pages.storageLicense.form.newSubtitle')}
          />
        ) : (
          <PageHeader
            backTo={LIST_PATH}
            title={detail?.license_number || t('pages.licenses.unnamedLicense')}
            subtitle={detail ? `${detail.tb_business_unit.code} · ${detail.tb_business_unit.name}` : undefined}
            audit={normalizeAudit(detail)}
          />
        )}

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md" role="alert">{error}</div>
        )}

        {!isNew && detail && (
          <StoragePlate
            row={detail}
            inForce={!replaced}
            dbLabel={quotaLabel(detail.db_quota_bytes, defaults?.db)}
            fileLabel={quotaLabel(detail.file_quota_bytes, defaults?.file)}
            sourceLabel={t(`pages.storageLicense.source.${storageLicenseSource(detail)}` as const)}
          />
        )}

        {replaced && detail && (
          <div className="border-warning/40 bg-warning/10 text-foreground flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border p-3 text-sm">
            <span>
              {t('pages.storageLicense.form.replacedBanner', { number: detail.superseded_by?.license_number ?? '-' })}
            </span>
            {detail.superseded_by && (
              <Link
                to={`/licenses/storage/${detail.superseded_by.id}/edit`}
                className="font-medium underline underline-offset-2"
              >
                {t('pages.storageLicense.form.openReplacement', { number: detail.superseded_by.license_number })}
              </Link>
            )}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-4 lg:grid-cols-2">
                {isNew && (
                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="storage-bu">{t('pages.storageLicense.form.businessUnit')}</Label>
                    <BusinessUnitPicker
                      id="storage-bu"
                      value={bu}
                      onChange={(next) => { setBu(next); setFieldErrors((p) => ({ ...p, bu: '' })); }}
                      // GET /api-system/business-units ใช้สิทธิ์ cluster.read — ไม่มี = เหลือแค่ BU ที่เติมมาจาก ?bu=
                      canSearch={hasPermission('cluster.read')}
                      placeholder={t('pages.storageLicense.form.businessUnitPlaceholder')}
                      disabled={!canEdit}
                    />
                    {fieldErrors.bu && <p className="text-destructive text-xs">{fieldErrors.bu}</p>}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="db">{t('pages.storageLicense.form.dbQuotaGb')}</Label>
                  {editing ? (
                    <Input
                      id="db"
                      name="db"
                      type="number"
                      inputMode="decimal"
                      min={1}
                      step="any"
                      value={form.db}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      onFocus={handleFocus}
                      aria-invalid={!!fieldErrors.db}
                    />
                  ) : (
                    <ReadOnlyField value={form.db ? `${form.db} GB` : quotaLabel(null, defaults?.db)} />
                  )}
                  {editing && <p className="text-muted-foreground text-xs">{blankHint(defaults?.db)}</p>}
                  {fieldErrors.db && <p className="text-destructive text-xs">{fieldErrors.db}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="file">{t('pages.storageLicense.form.fileQuotaGb')}</Label>
                  {editing ? (
                    <Input
                      id="file"
                      name="file"
                      type="number"
                      inputMode="decimal"
                      min={1}
                      step="any"
                      value={form.file}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      onFocus={handleFocus}
                      aria-invalid={!!fieldErrors.file}
                    />
                  ) : (
                    <ReadOnlyField value={form.file ? `${form.file} GB` : quotaLabel(null, defaults?.file)} />
                  )}
                  {editing && <p className="text-muted-foreground text-xs">{blankHint(defaults?.file)}</p>}
                  {fieldErrors.file && <p className="text-destructive text-xs">{fieldErrors.file}</p>}
                </div>

                {fieldErrors.figures && (
                  <p className="text-destructive text-xs lg:col-span-2" role="alert">{fieldErrors.figures}</p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="reference_no">{t('pages.storageLicense.form.referenceNo')}</Label>
                  {editing ? (
                    <Input id="reference_no" name="reference_no" value={form.reference_no} onChange={handleChange} />
                  ) : (
                    <ReadOnlyField value={form.reference_no} />
                  )}
                </div>

                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="note">{t('pages.storageLicense.form.note')}</Label>
                  {editing ? (
                    <Textarea id="note" name="note" rows={3} value={form.note} onChange={handleChange} />
                  ) : (
                    <ReadOnlyField value={form.note} className="h-auto min-h-9 whitespace-pre-wrap py-2" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {isNew && current && (
            <p className="text-sm text-warning" role="status">
              {t('pages.storageLicense.form.replacesNotice', { number: current.license_number })}
            </p>
          )}

          {isNew && (
            <div className="flex gap-3">
              <Can permission="subscription.manage">
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {saving ? t('common.busy.creating') : t('pages.storageLicense.form.issueSubmit')}
                </Button>
              </Can>
              <Button type="button" size="sm" variant="outline" onClick={() => navigate(LIST_PATH)}>
                <X className="mr-2 h-4 w-4" />
                {t('common.cancel')}
              </Button>
            </div>
          )}
        </form>

        {!isNew && detail && canEdit && (
          <Can permission="subscription.manage">
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={saving}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('pages.storageLicense.form.deleteAction')}
              </Button>
            </div>
          </Can>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('pages.storageLicense.form.deleteAction')}
        description={
          replaced
            ? t('pages.storageLicense.form.deleteReplacedBody')
            : t('pages.storageLicense.form.deleteInForceBody')
        }
        confirmVariant="destructive"
        onConfirm={handleDelete}
      />

      {showUnsavedBar && (
        <div className="unsaved-bar fixed bottom-0 left-0 right-0 z-40 md:left-16 lg:left-60">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-warning" />
              <span>{t('common.state.unsavedChanges')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleCancelEdit} disabled={saving}>
                <X className="mr-2 h-4 w-4" />
                {t('common.cancel')}
              </Button>
              <Can permission="subscription.manage">
                <Button
                  type="button"
                  size="sm"
                  disabled={saving}
                  onClick={() => void handleSave()}
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {saving ? t('common.busy.saving') : t('common.action.saveChanges')}
                </Button>
              </Can>
            </div>
          </div>
        </div>
      )}

      {!isNew && <DevDebugSheet title="Storage License Debug" fabClassName={showUnsavedBar ? 'bottom-20' : undefined} data={rawResponse} />}
    </Layout>
  );
};

export default StorageLicenseForm;

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGlobalShortcuts } from '../components/KeyboardShortcuts';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { PageHeader } from '../components/PageHeader';
import customerService from '../services/customerService';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { DevDebugSheet } from '../components/ui/dev-debug-sheet';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/ui/skeleton';
import Can from '../components/Can';
import { Save, Pencil, X, Loader2, SearchX } from 'lucide-react';
import { toast } from 'sonner';
import { parseApiError, isNotFoundError, devLog } from '../utils/errorParser';
import { getDocVersion, isVersionConflict, notifyVersionConflict } from '../utils/docVersion';
import { normalizeAudit } from '../utils/audit';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../hooks/useI18n';
import CustomerBusinessUnitsCard from './customerEdit/CustomerBusinessUnitsCard';
import CustomerLicensesCard from './customerEdit/CustomerLicensesCard';
import { customerErrorKind } from './customerEdit/customerErrors';
import type { CustomerBusinessUnit, CustomerStatus, CustomerWriteInput } from '../types';

/** key ที่ฟอร์มรู้จักใน `billing_address` — key อื่นที่ backend/ระบบอื่นเก็บไว้ถูกคงไว้ตอนบันทึก */
const ADDRESS_KEYS = ['line1', 'line2', 'city', 'province', 'postal_code', 'country'] as const;
type AddressKey = typeof ADDRESS_KEYS[number];

interface CustomerFormData {
  ar_number: string;
  company_name: string;
  tax_no: string;
  status: CustomerStatus;
  note: string;
  address: Record<AddressKey, string>;
}

const emptyAddress = (): Record<AddressKey, string> =>
  ({ line1: '', line2: '', city: '', province: '', postal_code: '', country: '' });

const emptyForm = (): CustomerFormData => ({
  ar_number: '',
  company_name: '',
  tax_no: '',
  status: 'active',
  note: '',
  address: emptyAddress(),
});

const AR_MAX = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const readAddress = (raw: unknown): Record<AddressKey, string> => {
  const out = emptyAddress();
  if (raw && typeof raw === 'object') {
    for (const k of ADDRESS_KEYS) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === 'string') out[k] = v;
    }
  }
  return out;
};

/**
 * billing_address เป็น object อิสระฝั่ง backend — ทับเฉพาะ key ที่ฟอร์มรู้จัก คง key อื่นของเดิมไว้
 * (ไม่งั้นการบันทึกจากหน้านี้จะลบข้อมูลที่ระบบอื่นเขียนไว้เงียบ ๆ) · ผลว่างทั้งก้อน = null
 */
const buildAddress = (form: CustomerFormData, original: Record<string, unknown> | null): Record<string, unknown> | null => {
  const merged: Record<string, unknown> = { ...(original ?? {}) };
  for (const k of ADDRESS_KEYS) {
    const v = form.address[k].trim();
    if (v) merged[k] = v;
    else delete merged[k];
  }
  return Object.keys(merged).length > 0 ? merged : null;
};

const RecordRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-4">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="break-words text-sm">{children}</dd>
  </div>
);

const CustomerEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const isNew = !id;
  const { hasPermission } = useAuth();
  // ลิงก์ "Create customer" จากคิว license intake ส่ง ?ar_number= มา — prefill เฉพาะโหมดสร้างใหม่
  const [searchParams] = useSearchParams();
  const prefillAr = isNew ? (searchParams.get('ar_number') ?? '').trim() : '';

  const [formData, setFormData] = useState<CustomerFormData>(() => ({ ...emptyForm(), ar_number: prefillAr }));
  // baseline เดียวกับ formData ตอนเริ่ม — ไม่งั้นหน้านี้ "ยังไม่บันทึก" ตั้งแต่เปิด และ Cancel ทิ้ง prefill
  const [savedFormData, setSavedFormData] = useState<CustomerFormData>(() => ({ ...emptyForm(), ar_number: prefillAr }));
  const [loading, setLoading] = useState(!isNew);
  const [editing, setEditing] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [rawResponse, setRawResponse] = useState<unknown>(null);
  const [customerRecord, setCustomerRecord] = useState<unknown>(null);
  const [businessUnits, setBusinessUnits] = useState<CustomerBusinessUnit[]>([]);
  const [billingOriginal, setBillingOriginal] = useState<Record<string, unknown> | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [docVersion, setDocVersion] = useState<number | undefined>(undefined);

  const formRef = useRef<HTMLFormElement>(null);
  // กัน response ของ fetch เก่าทับของใหม่ (ลิงก์/ยกเลิกผูกเรียก refetch ซ้อนได้)
  const reqId = useRef(0);

  const hasChanges = editing && JSON.stringify(formData) !== JSON.stringify(savedFormData);
  useUnsavedChanges(hasChanges);

  const handleEditToggle = () => {
    setSavedFormData(formData);
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setFormData(savedFormData);
    setEditing(false);
    setError('');
    setFieldErrors({});
  };

  useGlobalShortcuts({
    onSave: () => { if (editing && !saving) formRef.current?.requestSubmit(); },
    onCancel: () => { if (editing && !isNew) handleCancelEdit(); },
  });

  /**
   * `keepForm` = refetch หลังผูก/ยกเลิกผูก BU: อัปเดตเฉพาะรายชื่อ BU ไม่แตะฟอร์ม ไม่โชว์ skeleton
   * (ไม่งั้นการ์ด BU ที่กำลังทำงานอยู่จะถูกถอดออกกลางคัน และสิ่งที่ผู้ใช้พิมพ์ค้างในฟอร์มหาย)
   */
  const fetchCustomer = useCallback(async (opts: { keepForm?: boolean } = {}) => {
    if (!id) return;
    // id ที่ไม่ใช่ UUID ไม่มีทางเป็นลูกค้า — ไม่ยิงคำขอ (กัน path แปลก ๆ ไปถึง backend)
    if (!UUID_RE.test(id)) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const mine = ++reqId.current;
    try {
      if (!opts.keepForm) setLoading(true);
      setNotFound(false);
      const data = await customerService.getById(id);
      if (mine !== reqId.current) return;
      setRawResponse(data);
      const row = data?.data ?? data;
      if (!row?.id) {
        setNotFound(true);
        return;
      }
      setBusinessUnits(Array.isArray(row.business_units) ? row.business_units : []);
      if (opts.keepForm) return;
      const loaded: CustomerFormData = {
        ar_number: row.ar_number ?? '',
        company_name: row.company_name ?? '',
        tax_no: row.tax_no ?? '',
        status: row.status === 'inactive' ? 'inactive' : 'active',
        note: row.note ?? '',
        address: readAddress(row.billing_address),
      };
      setFormData(loaded);
      setSavedFormData(loaded);
      setBillingOriginal(row.billing_address && typeof row.billing_address === 'object' ? row.billing_address : null);
      setDocVersion(getDocVersion(row));
      setCustomerRecord(row);
    } catch (err: unknown) {
      if (mine !== reqId.current) return;
      if (isNotFoundError(err)) {
        setNotFound(true);
      } else {
        setError(t('pages.customers.loadFailedOne', { detail: parseApiError(err, t).message }));
      }
    } finally {
      if (mine === reqId.current && !opts.keepForm) setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    if (!isNew) fetchCustomer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
    if (fieldErrors[name]) setFieldErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const key = e.target.name as AddressKey;
    setFormData(prev => ({ ...prev, address: { ...prev.address, [key]: e.target.value } }));
    setError('');
  };

  const arError = (value: string): string => {
    const v = value.trim();
    if (!v) return t('pages.customers.arRequired');
    if (v.length > AR_MAX) return t('pages.customers.arTooLong');
    return '';
  };

  const handleArBlur = () => {
    const err = arError(formData.ar_number);
    if (err) setFieldErrors(prev => ({ ...prev, ar_number: err }));
  };

  const validateBeforeSubmit = (): boolean => {
    const errors: Record<string, string> = {};
    const ar = arError(formData.ar_number);
    if (ar) errors.ar_number = ar;
    if (Object.keys(errors).length > 0) {
      setFieldErrors(prev => ({ ...prev, ...errors }));
      return false;
    }
    return true;
  };

  const buildPayload = (): CustomerWriteInput => ({
    ar_number: formData.ar_number.trim(),
    company_name: formData.company_name.trim() || null,
    tax_no: formData.tax_no.trim() || null,
    billing_address: buildAddress(formData, billingOriginal),
    status: formData.status,
    note: formData.note.trim() || null,
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Ctrl/Cmd+S และ Enter ในช่องข้อความเดินเข้า handler นี้โดยไม่ผ่านปุ่ม Save ที่ครอบด้วย <Can>
    if (!hasPermission('customer.manage')) return;
    if (!validateBeforeSubmit()) return;

    setSaving(true);
    setError('');

    try {
      if (isNew) {
        const created = await customerService.create(buildPayload());
        const row = created?.data ?? created;
        toast.success(t('pages.customers.createdToast'));
        navigate(`/customers/${row.id}/edit`, { replace: true });
      } else {
        // doc_version บังคับฝั่ง backend — 0 คือค่า @default ของคอลัมน์เมื่อ GET ไม่ส่งมา
        await customerService.update(id!, { ...buildPayload(), doc_version: docVersion ?? 0 });
        toast.success(t('pages.customers.savedToast'));
        setSavedFormData(formData);
        setEditing(false);
        fetchCustomer();
      }
    } catch (err) {
      if (isNotFoundError(err)) {
        setNotFound(true);
        return;
      }
      // เช็ก stale doc_version ก่อน — เป็น 409 เหมือนกับ AR ซ้ำ แต่คนละเรื่อง
      if (isVersionConflict(err)) {
        notifyVersionConflict(t);
        fetchCustomer();
        return;
      }
      if (customerErrorKind(err) === 'ar_exists') {
        setFieldErrors(prev => ({ ...prev, ar_number: t('pages.customers.arExists') }));
        return;
      }
      const { message, fields } = parseApiError(err, t);
      if (fields) setFieldErrors(fields);
      setError(message);
      devLog('saveCustomer', err);
    } finally {
      setSaving(false);
    }
  };

  const headerTitle = isNew
    ? t('pages.customers.newTitle')
    : formData.company_name || formData.ar_number || t('pages.customers.singularTitle');

  if (loading) {
    return (
      <Layout>
        <div className="space-y-4 sm:space-y-6" role="status" aria-label={t('pages.customers.loadingOneAria')}>
          <div className="flex items-center gap-3 sm:gap-4">
            <Skeleton className="h-9 w-9 rounded-md" />
            <div className="flex-1">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-4 w-56 mt-2" />
            </div>
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
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
          <PageHeader backTo="/customers" title={t('pages.customers.singularTitle')} />
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={SearchX}
                title={t('pages.customers.notFoundTitle')}
                description={t('pages.customers.notFoundDescription')}
                action={
                  <Button size="sm" onClick={() => navigate('/customers')}>
                    {t('pages.customers.backToList')}
                  </Button>
                }
              />
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const addressLabels: Record<AddressKey, string> = {
    line1: t('pages.customers.addressLine1'),
    line2: t('pages.customers.addressLine2'),
    city: t('pages.customers.addressCity'),
    province: t('pages.customers.addressProvince'),
    postal_code: t('pages.customers.addressPostalCode'),
    country: t('pages.customers.addressCountry'),
  };
  const addressText = ADDRESS_KEYS.map((k) => formData.address[k]).filter(Boolean).join(', ');

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 pb-24">
        <PageHeader
          backTo="/customers"
          title={headerTitle}
          subtitle={isNew ? t('pages.customers.newSubtitle') : formData.company_name ? formData.ar_number : undefined}
          audit={normalizeAudit(customerRecord)}
          actions={
            !isNew && !editing && (
              <Can permission="customer.manage">
                <Button variant="outline" size="sm" onClick={handleEditToggle}>
                  <Pencil className="mr-2 h-4 w-4" />
                  {t('common.action.edit')}
                </Button>
              </Can>
            )
          }
        />

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md" role="alert">{error}</div>
        )}

        {editing ? (
          <form ref={formRef} onSubmit={handleSubmit}>
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ar_number">{t('pages.customers.arNumber')} <span className="text-destructive">*</span></Label>
                    <Input
                      id="ar_number"
                      name="ar_number"
                      value={formData.ar_number}
                      onChange={handleChange}
                      onBlur={handleArBlur}
                      placeholder={t('pages.customers.arPlaceholder')}
                      maxLength={AR_MAX + 10}
                      className={fieldErrors.ar_number ? 'border-destructive font-mono' : 'font-mono'}
                    />
                    {fieldErrors.ar_number
                      ? <p className="text-xs text-destructive">{fieldErrors.ar_number}</p>
                      : <p className="text-xs text-muted-foreground">{t('pages.customers.arHint')}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">{t('common.status.label')}</Label>
                    <label className="flex min-h-11 items-center gap-2">
                      <input
                        type="checkbox"
                        id="status"
                        name="status"
                        checked={formData.status === 'active'}
                        onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.checked ? 'active' : 'inactive' }))}
                        className="h-4 w-4 rounded border-input"
                      />
                      <span className="text-sm">{t('common.status.active')}</span>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company_name">{t('pages.customers.companyName')}</Label>
                    <Input
                      id="company_name"
                      name="company_name"
                      value={formData.company_name}
                      onChange={handleChange}
                      placeholder={t('pages.customers.companyPlaceholder')}
                      maxLength={255}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tax_no">{t('pages.customers.taxNo')}</Label>
                    <Input
                      id="tax_no"
                      name="tax_no"
                      value={formData.tax_no}
                      onChange={handleChange}
                      placeholder={t('pages.customers.taxNoPlaceholder')}
                      maxLength={30}
                      className="font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-3 border-t pt-4">
                  <h3 className="text-sm font-semibold">{t('pages.customers.billingAddress')}</h3>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {ADDRESS_KEYS.map((k) => (
                      <div key={k} className={k === 'line1' || k === 'line2' ? 'space-y-2 lg:col-span-2' : 'space-y-2'}>
                        <Label htmlFor={`address_${k}`}>{addressLabels[k]}</Label>
                        <Input id={`address_${k}`} name={k} value={formData.address[k]} onChange={handleAddressChange} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 border-t pt-4">
                  <Label htmlFor="note">{t('common.field.note')}</Label>
                  <Textarea
                    id="note"
                    name="note"
                    value={formData.note}
                    onChange={handleChange}
                    placeholder={t('pages.customers.notePlaceholder')}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </form>
        ) : (
          <Card>
            <CardContent className="space-y-5 p-4 sm:p-6">
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-mono text-base font-medium sm:text-lg">{formData.ar_number}</p>
                <Badge variant={formData.status === 'active' ? 'success' : 'secondary'}>
                  {formData.status === 'active' ? t('common.status.active') : t('common.status.inactive')}
                </Badge>
              </div>
              <dl className="space-y-3 border-t pt-4">
                <RecordRow label={t('pages.customers.companyName')}>{formData.company_name || '-'}</RecordRow>
                <RecordRow label={t('pages.customers.taxNo')}>
                  {formData.tax_no ? <span className="font-mono">{formData.tax_no}</span> : '-'}
                </RecordRow>
                <RecordRow label={t('pages.customers.billingAddress')}>{addressText || '-'}</RecordRow>
                {formData.note && <RecordRow label={t('common.field.note')}>{formData.note}</RecordRow>}
              </dl>
            </CardContent>
          </Card>
        )}

        {isNew ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground sm:p-6">
              {t('pages.customers.buSaveFirst')}
            </CardContent>
          </Card>
        ) : (
          <>
            <CustomerBusinessUnitsCard
              customerId={id!}
              businessUnits={businessUnits}
              onChanged={() => fetchCustomer({ keepForm: true })}
            />
            <CustomerLicensesCard businessUnits={businessUnits} />
          </>
        )}
      </div>

      {editing && (
        <div className="unsaved-bar fixed bottom-0 left-0 right-0 md:left-16 lg:left-60 z-40">
          <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              {hasChanges ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-warning animate-pulse" />
                  <span>{t('common.state.unsavedChanges')}</span>
                </>
              ) : (
                <span className="text-muted-foreground">{t('common.state.noChanges')}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={isNew ? () => navigate('/customers') : handleCancelEdit}
                disabled={saving}
              >
                <X className="mr-2 h-4 w-4" />
                {t('common.cancel')}
              </Button>
              <Can permission="customer.manage">
                <Button type="button" size="sm" disabled={saving || (!isNew && !hasChanges)} onClick={() => formRef.current?.requestSubmit()}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {saving ? t('common.busy.saving') : isNew ? t('pages.customers.createCustomer') : t('common.action.saveChanges')}
                </Button>
              </Can>
            </div>
          </div>
        </div>
      )}

      <DevDebugSheet
        title="Customer Debug"
        fabClassName={editing ? 'bottom-20' : undefined}
        tabs={[
          {
            key: 'customer',
            label: 'Customer',
            data: isNew ? null : rawResponse,
            endpoint: isNew ? 'New customer (not yet saved)' : `GET /api-system/backstage/customers/${id}`,
          },
        ]}
      />
    </Layout>
  );
};

export default CustomerEdit;

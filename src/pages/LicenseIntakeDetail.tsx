import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { PageHeader } from '../components/PageHeader';
import licenseIntakeService from '../services/licenseIntakeService';
import { parseApiError, isNotFoundError, devLog } from '../utils/errorParser';
import { getDocVersion, isVersionConflict, notifyVersionConflict } from '../utils/docVersion';
import { LICENSE_INTAKES_CHANGED_EVENT } from '../hooks/useLicenseIntakePendingCount';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../hooks/useI18n';
import Can from '../components/Can';
import { BusinessUnitPicker } from '../components/BusinessUnitPicker';
import type { BusinessUnitOption } from '../hooks/useBusinessUnitSearch';
import { EmptyState } from '../components/EmptyState';
import { FetchErrorState } from '../components/FetchErrorState';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { DevDebugSheet } from '../components/ui/dev-debug-sheet';
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';
import { Check, SearchX, X } from 'lucide-react';
import { toast } from 'sonner';
import IntakeSoldCard from './licenseIntakes/IntakeSoldCard';
import IntakeOverlapPanel from './licenseIntakes/IntakeOverlapPanel';
import RejectIntakeDialog from './licenseIntakes/RejectIntakeDialog';
import { fmtDateTime } from './licenseIntakes/format';
import type { LicenseIntakeBuLicenses, LicenseIntakeDetail as IntakeDetail, LicenseIntakeStatus } from '../types';

const STATUS_VARIANT: Record<LicenseIntakeStatus, 'warning' | 'success' | 'secondary'> = {
  pending: 'warning',
  confirmed: 'success',
  rejected: 'secondary',
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-4">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="break-words text-sm">{children}</dd>
  </div>
);

const LicenseIntakeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { hasPermission } = useAuth();

  const [intake, setIntake] = useState<IntakeDetail | null>(null);
  const [rawResponse, setRawResponse] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  // doc_version อยู่ state ของตัวเอง ไม่ปนกับข้อมูลหน้า
  const [docVersion, setDocVersion] = useState<number | undefined>(undefined);

  const [selectedBu, setSelectedBu] = useState<BusinessUnitOption | null>(null);
  const [buLicenses, setBuLicenses] = useState<LicenseIntakeBuLicenses | null>(null);
  const [buLoading, setBuLoading] = useState(false);
  const [buError, setBuError] = useState('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  // กัน response ของ fetch เก่าทับของใหม่
  const reqId = useRef(0);
  const buReqId = useRef(0);

  const fetchIntake = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!id) return;
      const mine = ++reqId.current;
      try {
        if (!opts.silent) setLoading(true);
        setError('');
        setNotFound(false);
        const data = await licenseIntakeService.getById(id);
        if (mine !== reqId.current) return;
        setRawResponse(data);
        const row = (data?.data ?? data) as IntakeDetail | undefined;
        if (!row?.id) {
          setNotFound(true);
          return;
        }
        setIntake(row);
        setDocVersion(getDocVersion(row));
      } catch (err: unknown) {
        if (mine !== reqId.current) return;
        if (isNotFoundError(err)) setNotFound(true);
        else setError(t('pages.licenseIntakes.loadFailedOne', { detail: parseApiError(err, t).message }));
      } finally {
        if (mine === reqId.current && !opts.silent) setLoading(false);
      }
    },
    [id, t],
  );

  useEffect(() => {
    fetchIntake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchBuLicenses = useCallback(
    async (buId: string) => {
      if (!id) return;
      const mine = ++buReqId.current;
      setBuLoading(true);
      setBuError('');
      setBuLicenses(null);
      try {
        const data = await licenseIntakeService.getBuLicenses(id, buId);
        if (mine !== buReqId.current) return;
        setBuLicenses((data?.data ?? data) as LicenseIntakeBuLicenses);
      } catch (err: unknown) {
        if (mine !== buReqId.current) return;
        setBuError(parseApiError(err, t).message);
      } finally {
        if (mine === buReqId.current) setBuLoading(false);
      }
    },
    [id, t],
  );

  const pickBu = (bu: BusinessUnitOption | null) => {
    setSelectedBu(bu);
    if (bu) {
      fetchBuLicenses(bu.id);
    } else {
      buReqId.current++;
      setBuLicenses(null);
      setBuError('');
      setBuLoading(false);
    }
  };

  const status = intake?.status;
  const isPending = status === 'pending';
  const anyOverlap = buLicenses?.any_overlap === true;
  // overlap_warning_shown ต้องเป็นสิ่งที่หน้าจอแสดงจริง — ยืนยันได้เมื่อโหลดภาพรวมของ BU สำเร็จแล้วเท่านั้น
  const canConfirm = !!selectedBu && !!buLicenses && !buLoading && !buError && docVersion !== undefined;

  const suggested = useMemo<BusinessUnitOption[]>(
    () =>
      (intake?.suggested_business_units ?? []).map((b) => ({
        id: b.id,
        code: b.code,
        name: b.name,
        cluster_name: b.cluster_name,
      })),
    [intake?.suggested_business_units],
  );

  const afterAction = () => {
    window.dispatchEvent(new Event(LICENSE_INTAKES_CHANGED_EVENT));
  };

  // ทุก error (รวม network timeout) ต้อง refetch ให้หน้าสะท้อนสถานะจริง และไม่ retry อัตโนมัติ
  const handleActionError = (err: unknown) => {
    devLog('LicenseIntakeDetail action failed', err);
    if (isVersionConflict(err)) {
      notifyVersionConflict(t);
    } else if (!(err as { response?: unknown })?.response) {
      // ไม่มี response = timeout/เครือข่าย: ผลฝั่ง server ไม่แน่นอน
      toast.error(t('pages.licenseIntakes.actionUncertain'), { description: parseApiError(err, t).message });
    } else {
      // NOT_PENDING, BU_NOT_FOUND, CUSTOMER_MISSING, BU_CUSTOMER_MISMATCH, GROUP_UNAVAILABLE,
      // NO_MAIN_CONTRACT, SCOPE_DENIED: ข้อความจาก catalog ของ backend อธิบายเหตุผลได้ตรงที่สุด
      toast.error(parseApiError(err, t).message);
    }
    fetchIntake({ silent: true });
    if (selectedBu) fetchBuLicenses(selectedBu.id);
  };

  const handleConfirm = async () => {
    if (!id || !selectedBu || docVersion === undefined) return;
    try {
      await licenseIntakeService.confirm(id, {
        business_unit_id: selectedBu.id,
        doc_version: docVersion,
        overlap_warning_shown: anyOverlap,
      });
      toast.success(t('pages.licenseIntakes.confirmedToast', { name: selectedBu.name }));
      setConfirmOpen(false);
      setSelectedBu(null);
      setBuLicenses(null);
      afterAction();
      await fetchIntake({ silent: true });
    } catch (err: unknown) {
      setConfirmOpen(false);
      handleActionError(err);
    }
  };

  const handleReject = async (reason: string) => {
    if (!id || docVersion === undefined) return;
    try {
      await licenseIntakeService.reject(id, { reason, doc_version: docVersion });
      toast.success(t('pages.licenseIntakes.rejectedToast'));
      setRejectOpen(false);
      setSelectedBu(null);
      setBuLicenses(null);
      afterAction();
      await fetchIntake({ silent: true });
    } catch (err: unknown) {
      setRejectOpen(false);
      handleActionError(err);
    }
  };

  if (notFound) {
    return (
      <Layout>
        <PageHeader title={t('pages.licenseIntakes.singularTitle')} backTo="/license-intakes" />
        <EmptyState
          icon={SearchX}
          title={t('pages.licenseIntakes.notFoundTitle')}
          description={t('pages.licenseIntakes.notFoundDescription')}
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/license-intakes">{t('pages.licenseIntakes.backToList')}</Link>
            </Button>
          }
        />
      </Layout>
    );
  }

  const statusLabel =
    status === 'pending'
      ? t('pages.licenseIntakes.statusPending')
      : status === 'confirmed'
        ? t('pages.licenseIntakes.statusConfirmed')
        : status === 'rejected'
          ? t('pages.licenseIntakes.statusRejected')
          : '';

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title={intake?.source_sale_id || t('pages.licenseIntakes.singularTitle')}
          subtitle={intake?.ar_number ? t('pages.licenseIntakes.detailSubtitle', { ar: intake.ar_number }) : undefined}
          backTo="/license-intakes"
          afterTitle={
            status ? (
              <Badge variant={STATUS_VARIANT[status]}>{statusLabel}</Badge>
            ) : undefined
          }
        />

        {loading && !intake && (
          <div className="space-y-3" aria-label={t('pages.licenseIntakes.loadingOneAria')}>
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {error && !intake && (
          <FetchErrorState message={error} onRetry={() => fetchIntake()} />
        )}

        {intake && (
          <>
            <IntakeSoldCard intake={intake} />

            {isPending && (
              <Can permission="subscription.approve">
                <Card>
                  <CardHeader className="pb-2">
                    <h2 className="text-base font-semibold">{t('pages.licenseIntakes.decisionTitle')}</h2>
                    <p className="text-sm text-muted-foreground">{t('pages.licenseIntakes.decisionDescription')}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="intake-bu">{t('pages.licenseIntakes.targetBu')}</Label>
                      <BusinessUnitPicker
                        id="intake-bu"
                        value={selectedBu}
                        onChange={pickBu}
                        suggested={suggested}
                        // GET /api-system/business-units ถูกคุมด้วย cluster.read (ตามเส้นทาง /business-units)
                        // ผู้ถือ subscription.approve อาจไม่มีสิทธิ์นี้ → ไม่ยิง request เลย เหลือแค่ suggested
                        canSearch={hasPermission('cluster.read')}
                      />
                      {suggested.length === 0 && (
                        <p className="text-xs text-muted-foreground">{t('pages.licenseIntakes.noSuggested')}</p>
                      )}
                    </div>

                    {selectedBu && (
                      <IntakeOverlapPanel
                        buName={selectedBu.name}
                        data={buLicenses}
                        loading={buLoading}
                        error={buError}
                        onRetry={() => fetchBuLicenses(selectedBu.id)}
                      />
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      <Button size="sm" disabled={!canConfirm} onClick={() => setConfirmOpen(true)}>
                        <Check className="mr-2 h-4 w-4" />
                        {t('pages.licenseIntakes.confirmButton')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={docVersion === undefined}
                        onClick={() => setRejectOpen(true)}
                      >
                        <X className="mr-2 h-4 w-4" />
                        {t('pages.licenseIntakes.rejectButton')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Can>
            )}

            {status === 'confirmed' && (
              <Card>
                <CardHeader className="pb-2">
                  <h2 className="text-base font-semibold">{t('pages.licenseIntakes.confirmedTitle')}</h2>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-3">
                    <Row label={t('pages.licenseIntakes.targetBu')}>
                      {intake.business_unit ? (
                        <span className="flex flex-col">
                          <span>{intake.business_unit.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">{intake.business_unit.code}</span>
                        </span>
                      ) : (
                        '-'
                      )}
                    </Row>
                    <Row label={t('pages.licenseIntakes.confirmedBy')}>
                      {intake.confirmed_by?.name || intake.confirmed_by?.id || '-'}
                    </Row>
                    <Row label={t('pages.licenseIntakes.confirmedAt')}>{fmtDateTime(intake.confirmed_at)}</Row>
                    <Row label={t('pages.licenseIntakes.overlapShown')}>
                      {intake.overlap_warning_shown == null
                        ? '-'
                        : intake.overlap_warning_shown
                          ? t('pages.licenseIntakes.yes')
                          : t('pages.licenseIntakes.no')}
                    </Row>
                    <Row label={t('pages.licenseIntakes.producedTitle')}>
                      <ProducedLinks produced={intake.produced} />
                    </Row>
                  </dl>
                </CardContent>
              </Card>
            )}

            {status === 'rejected' && (
              <Card>
                <CardHeader className="pb-2">
                  <h2 className="text-base font-semibold">{t('pages.licenseIntakes.rejectedTitle')}</h2>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-3">
                    <Row label={t('pages.licenseIntakes.rejectReasonLabel')}>
                      <span className="whitespace-pre-wrap">{intake.reject_reason || '-'}</span>
                    </Row>
                    <Row label={t('pages.licenseIntakes.rejectedBy')}>
                      {intake.rejected_by?.name || intake.rejected_by?.id || '-'}
                    </Row>
                    <Row label={t('pages.licenseIntakes.rejectedAt')}>{fmtDateTime(intake.rejected_at)}</Row>
                  </dl>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('pages.licenseIntakes.confirmDialogTitle')}
        description={
          selectedBu
            ? `${t('pages.licenseIntakes.confirmDialogDescription', { name: selectedBu.name, code: selectedBu.code })}${
                anyOverlap ? ` ${t('pages.licenseIntakes.confirmDialogStacking')}` : ''
              }`
            : ''
        }
        confirmText={t('pages.licenseIntakes.confirmButton')}
        onConfirm={handleConfirm}
      />
      <RejectIntakeDialog open={rejectOpen} onOpenChange={setRejectOpen} onSubmit={handleReject} />

      <DevDebugSheet
        title="License Intake Debug"
        tabs={[
          {
            key: 'intake',
            label: 'Intake',
            data: rawResponse,
            endpoint: `GET /api-system/backstage/license-intakes/${id}`,
          },
          { key: 'bu', label: 'BU licences', data: buLicenses },
        ]}
      />
    </Layout>
  );
};

const ProducedLinks: React.FC<{ produced?: IntakeDetail['produced'] }> = ({ produced }) => {
  const { t } = useI18n();
  const subs = produced?.subscriptions ?? [];
  const seats = produced?.seats ?? [];
  const ifaces = produced?.interfaces ?? [];
  if (subs.length + seats.length + ifaces.length === 0) return <span>-</span>;
  // เส้นทางเหล่านี้ใช้ subscription.read เหมือนหน้านี้ จึงลิงก์ได้เลยโดยไม่ต้องเช็คสิทธิ์เพิ่ม
  const linkClass = 'font-mono text-primary underline underline-offset-2';
  return (
    <ul className="space-y-1">
      {subs.map((s) => (
        <li key={s.id}>
          <span className="mr-2 text-muted-foreground">{t('pages.licenseIntakes.producedSubscription')}</span>
          <Link to={`/licenses/subscriptions/${encodeURIComponent(s.id)}/edit`} className={linkClass}>
            {s.subscription_number || s.id}
          </Link>
        </li>
      ))}
      {seats.map((s) => (
        <li key={s.id}>
          <span className="mr-2 text-muted-foreground">{t('pages.licenseIntakes.producedSeat')}</span>
          <Link to={`/licenses/seats/${encodeURIComponent(s.id)}/edit`} className={linkClass}>
            {s.license_number || s.id}
          </Link>
        </li>
      ))}
      {ifaces.map((i) => (
        <li key={i.id}>
          <span className="mr-2 text-muted-foreground">
            {t('pages.licenseIntakes.producedInterface')}
            {i.group_code ? ` (${i.group_code})` : ''}
          </span>
          <Link to={`/licenses/interface/${encodeURIComponent(i.id)}/edit`} className={linkClass}>
            {i.license_number || i.id}
          </Link>
        </li>
      ))}
    </ul>
  );
};

export default LicenseIntakeDetail;

import React from 'react';
import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import Can from '../../components/Can';
import { useI18n } from '../../hooks/useI18n';
import type { LicenseIntakeDetail, LicenseIntakeGroup } from '../../types';
import { fmtDateTime, periodOf } from './format';

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-4">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="break-words text-sm">{children}</dd>
  </div>
);

const GroupChips: React.FC<{ groups?: LicenseIntakeGroup[]; codes?: string[] }> = ({ groups, codes }) => {
  const { t } = useI18n();
  // groups มาจาก backend (resolve ด้วย code) — ถ้าไม่มีให้ตกไปที่ code ดิบ
  const list: LicenseIntakeGroup[] =
    groups && groups.length > 0 ? groups : (codes ?? []).map((code) => ({ code }));
  if (list.length === 0) return <span className="text-muted-foreground">-</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {list.map((g) =>
        g.missing ? (
          <Badge
            key={g.code}
            variant="outline"
            className="border-dashed font-normal text-muted-foreground"
            title={t('pages.licenseIntakes.groupMissingTitle', { code: g.code })}
          >
            {g.code} ({t('pages.licenseIntakes.groupMissing')})
          </Badge>
        ) : (
          <Badge key={g.code} variant="outline" className="font-normal" title={g.code}>
            {g.name || g.code}
          </Badge>
        ),
      )}
    </div>
  );
};

/** สิ่งที่ license master ขายมา — อ่านอย่างเดียว */
const IntakeSoldCard: React.FC<{ intake: LicenseIntakeDetail }> = ({ intake }) => {
  const { t } = useI18n();
  const customer = intake.customer;
  return (
    <Card>
      <CardHeader className="pb-2">
        <h2 className="text-base font-semibold">{t('pages.licenseIntakes.soldTitle')}</h2>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3">
          <Row label={t('pages.licenseIntakes.columnSaleId')}>
            <span className="font-mono">{intake.source_sale_id || '-'}</span>
          </Row>
          <Row label={t('pages.licenseIntakes.columnCustomer')}>
            {customer ? (
              <span className="flex flex-col">
                <span className="font-mono">{customer.ar_number}</span>
                {customer.name && <span className="text-xs text-muted-foreground">{customer.name}</span>}
              </span>
            ) : (
              <span className="flex flex-wrap items-center gap-3">
                <span className="flex flex-col">
                  <span className="font-mono">{intake.ar_number || '-'}</span>
                  <Badge variant="warning" className="w-fit">{t('pages.licenseIntakes.customerNotFound')}</Badge>
                </span>
                {intake.ar_number && intake.status === 'pending' && (
                  <Can permission="customer.manage">
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/customers/new?ar_number=${encodeURIComponent(intake.ar_number)}`}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        {t('pages.licenseIntakes.createCustomer')}
                      </Link>
                    </Button>
                  </Can>
                )}
              </span>
            )}
          </Row>
          <Row label={t('pages.licenseIntakes.columnSeats')}>{intake.seats ?? '-'}</Row>
          <Row label={t('pages.licenseIntakes.columnModules')}>
            <GroupChips groups={intake.module_groups} codes={intake.module_group_codes} />
          </Row>
          <Row label={t('pages.licenseIntakes.columnInterfaces')}>
            <GroupChips groups={intake.interface_groups} codes={intake.interface_group_codes} />
          </Row>
          <Row label={t('pages.licenseIntakes.columnPeriod')}>{periodOf(intake.start_date, intake.end_date)}</Row>
          <Row label={t('pages.licenseIntakes.note')}>
            {intake.note ? <span className="whitespace-pre-wrap">{intake.note}</span> : '-'}
          </Row>
          <Row label={t('pages.licenseIntakes.columnReceived')}>{fmtDateTime(intake.created_at)}</Row>
        </dl>
      </CardContent>
    </Card>
  );
};

export default IntakeSoldCard;

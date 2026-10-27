import { Card, CardHeader, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { useI18n } from '../../../hooks/useI18n';
import { useExpiryThresholds } from '../../../context/ExpiryThresholdContext';
import { daysLeft, fmtDate, isPerpetual } from '../../licenses/licenseDates';
import type { InterfaceLicense } from '../../../types';
import { LicenseTimeline, useCoverageWindow } from '../../businessUnitEdit/LicenseTimeline';
import { LicenseTile, LicenseTileGrid } from './LicenseTile';

interface BuInterfaceLicensesCardProps {
  licenses: InterfaceLicense[];
  loading: boolean;
  now?: Date;
}

/**
 * แท็บ Interface ของ cluster admin — ใบสิทธิ์ interface ของ BU นี้เป็นแผ่น ชุดเดียวกับแท็บ Modules อ่านอย่างเดียว
 *
 * การ์ดฝั่ง platform (`BusinessUnitInterfaceLicensesCard`) นำแถวด้วยรหัส group เพราะผู้ดูแลที่นั่นออกใบด้วยรหัส
 * ที่นี่ผู้อ่านถามว่า "BU นี้ต่อกับระบบไหนได้บ้าง" ชื่อ interface จึงขึ้นก่อน รหัสและเลขใบเป็นของรอง
 *
 * สถานะมาจาก `in_force` ของ backend เท่านั้น (ห้ามคำนวณเอง): ใบที่ยังอยู่ในช่วงวันแต่สัญญาหลักไม่ active
 * คือ "ถูกสัญญาครอบ" ซึ่งเป็นกรณีเดียวที่ cluster admin ต้องลงมือ — ป้ายเตือนจึงขึ้นบนแผ่นนั้นตรง ๆ
 */
export function BuInterfaceLicensesCard({ licenses, loading, now = new Date() }: BuInterfaceLicensesCardProps) {
  const { t } = useI18n();
  const { thresholds } = useExpiryThresholds();
  const window = useCoverageWindow(now);
  const soonMs = thresholds.interface_days * 24 * 60 * 60 * 1000;
  const inForce = licenses.filter((l) => l.in_force).length;
  const capped = licenses.filter((l) => l.state === 'active' && !l.in_force);

  return (
    <Card>
      <CardHeader className="space-y-3">
        <h3 className="sr-only">{t('pages.businessUnits.interfaceLicensesTitle')}</h3>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs" role="status">
            {loading
              ? t('common.busy.loadingEllipsis')
              : t('pages.businessUnits.interfaceInForceCount', { count: inForce, total: licenses.length })}
          </p>
          {!loading && licenses.length > 0 && (
            <LicenseTimeline
              variant="group"
              items={licenses.map((l) => ({ start_date: l.start_date, end_date: l.end_date, live: l.in_force }))}
              window={window}
              now={now}
            />
          )}
        </div>
        {capped.length > 0 && (
          <p className="text-warning text-xs">
            {t('pages.businessUnits.interfaceCappedHint', { state: t(`common.status.${capped[0].contract_state}`) })}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {!loading && licenses.length === 0 ? (
          <p className="text-muted-foreground text-xs">{t('pages.businessUnits.noInterfaceLicenses')}</p>
        ) : (
          <LicenseTileGrid>
            {licenses.map((l) => {
              const soon = l.in_force && !isPerpetual(l.end_date) && Date.parse(l.end_date) - now.getTime() <= soonMs;
              return (
                <LicenseTile
                  key={l.id}
                  // `group` อาจไม่ถูก pack มาจาก endpoint ราย BU — ตกไปใช้ id แทนการ throw ทั้งแท็บ
                  name={l.group?.name || l.group?.code || l.license_feature_group_id}
                  code={l.group?.code ?? ''}
                  reference={l.license_number}
                  muted={!l.in_force}
                  when={
                    l.state === 'scheduled'
                      ? t('pages.clusterAdmin.moduleFrom', { date: fmtDate(l.start_date) })
                      : isPerpetual(l.end_date)
                        ? t('common.state.noExpiry')
                        : t('pages.clusterAdmin.moduleUntil', { date: fmtDate(l.end_date) })
                  }
                  badges={
                    <>
                      {soon && <Badge variant="warning">{t('common.state.daysLeft', { count: daysLeft(l.end_date, now) })}</Badge>}
                      {!l.in_force && l.state === 'active' && <Badge variant="warning">{t('pages.businessUnits.interfaceCapped')}</Badge>}
                      {l.state === 'scheduled' && <Badge variant="secondary">{t('common.status.scheduled')}</Badge>}
                      {l.state === 'expired' && <Badge variant="destructive">{t('common.status.expired')}</Badge>}
                    </>
                  }
                />
              );
            })}
          </LicenseTileGrid>
        )}
      </CardContent>
    </Card>
  );
}

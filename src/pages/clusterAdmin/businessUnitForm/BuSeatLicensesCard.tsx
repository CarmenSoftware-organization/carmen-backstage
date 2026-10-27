import { Link } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { sumActiveLicenses, licenseStatus, isExpiringSoon, isMigratedPlaceholder } from '../../../utils/buLicense';
import { daysLeft, fmtCoverageRange } from '../../licenses/licenseDates';
import { useI18n } from '../../../hooks/useI18n';
import { useExpiryThresholds } from '../../../context/ExpiryThresholdContext';
import type { BusinessUnitLicense, BuLicenseStatus } from '../../../types';

interface BuSeatLicensesCardProps {
  licenses: BusinessUnitLicense[];
  loading: boolean;
  /** ผู้เรียกตัดสิน URL — cluster admin เข้า `/licenses/*` ไม่ได้ ดู `BusinessUnitLicensesCard` */
  manageHref: string;
  /** pool ระดับ cluster จาก `bu.cluster_seat` — ไม่มี = backend ไม่ส่งมา ไม่วาดการแจกแจง */
  clusterSeat?: { used: number; cap: number };
  /**
   * สถานะ BU ตามที่บันทึกไว้ (ไม่ใช่ค่าที่กำลังแก้ในฟอร์ม) — view `v_business_unit_seat` ไม่นับ BU
   * ที่ inactive เข้า pool ใบของ BU นี้จึงสมทบ 0 แม้จะยังอยู่ในช่วงวัน
   */
  buActive: boolean;
  now?: Date;
}

const statusVariant = (s: BuLicenseStatus) =>
  s === 'active' ? 'success' : s === 'expired' ? 'destructive' : 'secondary';

/**
 * แท็บ Seats ของ cluster admin — ใบที่นั่งของ BU นี้ (`tb_business_unit_license`) ทีละใบ อ่านอย่างเดียว
 *
 * การ์ดฝั่ง platform (`BusinessUnitLicensesCard`) แสดงแค่ผลรวม เพราะที่นั่นใบถูกจัดการใน License Center
 * ที่เปิดดูได้ แต่ shell นี้เข้า License Center ไม่ได้ ถ้าไม่วาดรายใบที่นี่ cluster admin จะเห็นแค่ตัวเลข
 * โดยไม่รู้ว่ามาจากใบไหนหรือใบไหนหมดแล้ว
 */
export function BuSeatLicensesCard({ licenses, loading, manageHref, clusterSeat, buActive, now = new Date() }: BuSeatLicensesCardProps) {
  const { t } = useI18n();
  const { thresholds } = useExpiryThresholds();
  const activeSeats = sumActiveLicenses(licenses, now);
  const activeCount = licenses.filter((l) => licenseStatus(l, now) === 'active').length;
  // pool = ผลรวมใบที่ใช้ได้ของทุก BU ที่ active ใน cluster (`clusterSeatPools` อ่าน view เดียวกับ
  // `licenseStatus` — ขอบวันนับรวมทั้งสองด้าน) ส่วนที่ไม่ใช่ของ BU นี้จึงเป็นของ BU อื่นทั้งหมด
  // clamp ที่ 0 กันช่วงที่ ledger กับ cluster_seat โหลดคนละจังหวะแล้วตัวเลขสวนกันชั่วคราว
  const ownContribution = buActive ? activeSeats : 0;
  const fromOthers = clusterSeat ? Math.max(0, clusterSeat.cap - ownContribution) : 0;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-sm font-semibold">{t('pages.clusterAdmin.seatLicensesTitle')}</h3>
          {loading ? (
            <p className="text-xs text-muted-foreground">{t('common.busy.loadingEllipsis')}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {activeCount === 1
                ? t('pages.businessUnits.seatsFromActiveLicenseOne', { count: activeSeats, activeCount })
                : t('pages.businessUnits.seatsFromActiveLicenseMany', { count: activeSeats, activeCount })}
            </p>
          )}
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to={manageHref}>{t('common.action.manageLicences')}</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* ที่นั่งเป็น pool ร่วมทั้ง cluster: BU ที่ไม่ได้ซื้อเองเลยก็ยังเชิญผู้ใช้ได้ เพราะใช้จากใบของ BU อื่น
            โดยไม่แจกแจง "0 seats" ข้างบนจะอ่านเหมือน BU นี้ใช้งานไม่ได้ ขัดกับ 11 / 15 บนแผ่นป้าย */}
        {clusterSeat && !loading && (
          <div className="space-y-2 rounded-md border bg-muted/30 px-3 py-2">
            <dl className="grid grid-cols-3 gap-3 text-xs">
              <div className="min-w-0 space-y-0.5">
                <dt className="text-muted-foreground">{t('pages.clusterAdmin.seatSourceOwn')}</dt>
                <dd className="text-sm font-semibold tabular-nums">{ownContribution}</dd>
              </div>
              <div className="min-w-0 space-y-0.5">
                <dt className="text-muted-foreground">{t('pages.clusterAdmin.seatSourceOthers')}</dt>
                <dd className="text-sm font-semibold tabular-nums">{fromOthers}</dd>
              </div>
              <div className="min-w-0 space-y-0.5">
                <dt className="text-muted-foreground">{t('pages.clusterAdmin.seatSourcePool')}</dt>
                <dd className="text-sm font-semibold tabular-nums">
                  {clusterSeat.cap}{' '}
                  <span className="text-muted-foreground text-xs font-normal">
                    {t('pages.clusterAdmin.seatSourcePoolUsed', { used: clusterSeat.used })}
                  </span>
                </dd>
              </div>
            </dl>
            <p className="text-muted-foreground text-xs">
              {buActive ? t('pages.clusterAdmin.seatSourceNote') : t('pages.clusterAdmin.seatSourceInactive')}
            </p>
          </div>
        )}
        {!loading && licenses.length === 0 && (
          <p className="text-muted-foreground text-xs">{t('pages.clusterAdmin.noSeatLicenses')}</p>
        )}
        {licenses.map((l) => {
          const status = licenseStatus(l, now);
          return (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs">
              <div className="min-w-0 space-y-0.5">
                <div className="font-mono">{l.license_number}</div>
                <div className="text-muted-foreground">
                  {fmtCoverageRange(l.start_date, l.end_date, t('common.state.noExpiry'))}
                  {' · '}
                  {t('pages.clusterAdmin.seatLicenseRowSeats', { count: l.licensed_users })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isMigratedPlaceholder(l) && <Badge variant="warning">{t('pages.licenses.endDateRequiredBadge')}</Badge>}
                {isExpiringSoon(l, thresholds.seat_days, now) && (
                  <Badge variant="warning">{t('common.state.daysLeft', { count: daysLeft(l.end_date, now) })}</Badge>
                )}
                <Badge variant={statusVariant(status)}>{t(`common.status.${status}`)}</Badge>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

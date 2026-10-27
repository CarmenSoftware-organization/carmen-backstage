import { Card, CardHeader, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { sumActiveLicenses, licenseStatus, isExpiringSoon, isMigratedPlaceholder } from '../../../utils/buLicense';
import { daysLeft, fmtCoverageRange } from '../../licenses/licenseDates';
import { useI18n } from '../../../hooks/useI18n';
import { useExpiryThresholds } from '../../../context/ExpiryThresholdContext';
import type { BusinessUnitLicense, BuLicenseStatus } from '../../../types';

interface BuSeatLicensesCardProps {
  licenses: BusinessUnitLicense[];
  loading: boolean;
  /** pool ระดับ cluster จาก `bu.cluster_seat` — ไม่มี = backend ไม่ส่งมา ตกไปเป็นบรรทัดสรุปเดิม */
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

/** `swatch` = สีของส่วนนี้บนแถบสัดส่วนด้านล่าง ทำหน้าที่เป็น legend โดยไม่ต้องมีบล็อก legend แยก */
function Term({ label, value, suffix, swatch }: { label: string; value: number; suffix?: string; swatch?: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-muted-foreground flex items-start gap-1.5 text-xs">
        {swatch && <span className={`mt-1 size-2 shrink-0 rounded-full ${swatch}`} aria-hidden="true" />}
        {label}
      </dt>
      <dd className="font-mono text-xl font-semibold tabular-nums leading-none">
        {value.toLocaleString()}
        {suffix && (
          <>
            {' '}
            <span className="text-muted-foreground font-sans text-xs font-normal">{suffix}</span>
          </>
        )}
      </dd>
    </div>
  );
}

const Operator = ({ children }: { children: string }) => (
  <span className="text-muted-foreground self-end pb-0.5 font-mono text-base" aria-hidden="true">{children}</span>
);

/**
 * แท็บ Seats ของ cluster admin — ที่มาของที่นั่งเป็นสมการ แล้วตามด้วยใบที่นั่งของ BU นี้ทีละใบ อ่านอย่างเดียว
 *
 * ที่นั่งเป็น pool ร่วมทั้ง cluster (`cluster_seat.cap` = ผลรวมใบที่ใช้ได้ของทุก BU ที่ active) BU ที่ไม่ได้
 * ซื้อเองเลยก็ยังเชิญผู้ใช้ได้ ถ้าบอกแค่ "0 seats" มันจะอ่านเหมือน BU นี้ใช้งานไม่ได้ ขัดกับ 11 / 15
 * บนแผ่นป้าย สมการ "BU นี้ + BU อื่น = พูล" จึงขึ้นก่อนรายการใบ และแทนบรรทัดสรุปเดิมทั้งบรรทัด
 *
 * รายใบต้องวาดที่นี่ เพราะ shell นี้เข้า License Center ไม่ได้ — การ์ดฝั่ง platform แสดงแค่ผลรวม
 */
export function BuSeatLicensesCard({ licenses, loading, clusterSeat, buActive, now = new Date() }: BuSeatLicensesCardProps) {
  const { t } = useI18n();
  const { thresholds } = useExpiryThresholds();
  const activeSeats = sumActiveLicenses(licenses, now);
  const activeCount = licenses.filter((l) => licenseStatus(l, now) === 'active').length;
  // `clusterSeatPools` อ่าน view เดียวกับ `licenseStatus` (ขอบวันนับรวมทั้งสองด้าน) ส่วนที่ไม่ใช่ของ
  // BU นี้จึงเป็นของ BU อื่นทั้งหมด · clamp ที่ 0 กันช่วงที่ ledger กับ cluster_seat โหลดคนละจังหวะ
  const own = buActive ? activeSeats : 0;
  const cap = clusterSeat?.cap ?? 0;
  const others = Math.max(0, cap - own);
  const ownPct = cap > 0 ? Math.min(100, (own / cap) * 100) : 0;

  return (
    <Card>
      <CardHeader className="space-y-3">
        {loading ? (
          <p className="text-muted-foreground text-xs" role="status">{t('common.busy.loadingEllipsis')}</p>
        ) : clusterSeat ? (
          <>
            <dl className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 sm:max-w-xl">
              <Term label={t('pages.clusterAdmin.seatSourceOwn')} value={own} swatch={cap > 0 ? 'bg-primary' : undefined} />
              <Operator>+</Operator>
              <Term label={t('pages.clusterAdmin.seatSourceOthers')} value={others} swatch={cap > 0 ? 'bg-primary/30' : undefined} />
              <Operator>=</Operator>
              <Term
                label={t('pages.clusterAdmin.seatSourcePool')}
                value={cap}
                suffix={t('pages.clusterAdmin.seatSourcePoolUsed', { used: clusterSeat.used })}
              />
            </dl>
            {/* แถบเป็นของแถม ตัวเลขข้างบนเป็นตัวหลัก (กติกาเดียวกับ SeatMeter) จึง aria-hidden ·
                สัดส่วนคือ "ใครจ่ายพูล" ไม่ใช่ "ใช้ไปเท่าไร" — การใช้อยู่ที่แผ่นป้ายแล้ว */}
            {cap > 0 && (
              <div className="bg-muted flex h-1.5 overflow-hidden rounded-full sm:max-w-xl" aria-hidden="true">
                <div className="bg-primary h-full" style={{ width: `${ownPct}%` }} />
                <div className="bg-primary/30 h-full flex-1" />
              </div>
            )}
            <p className="text-muted-foreground text-xs">
              {buActive ? t('pages.clusterAdmin.seatSourceNote') : t('pages.clusterAdmin.seatSourceInactive')}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground text-xs">
            {activeCount === 1
              ? t('pages.businessUnits.seatsFromActiveLicenseOne', { count: activeSeats, activeCount })
              : t('pages.businessUnits.seatsFromActiveLicenseMany', { count: activeSeats, activeCount })}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2 border-t pt-4">
        {/* หัวข้อของรายการใบ ไม่ใช่ของการ์ด — สมการด้านบนถูกตั้งชื่อด้วยแท็บ Seats ที่เพิ่งกดแล้ว */}
        <h3 className="text-muted-foreground text-[11px] font-bold tracking-[0.13em] uppercase">
          {t('pages.clusterAdmin.seatLicensesTitle')}
        </h3>
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

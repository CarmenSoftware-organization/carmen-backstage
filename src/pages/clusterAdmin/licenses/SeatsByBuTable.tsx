import { Link } from 'react-router-dom';
import { RefreshCw, Users } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import { sumActiveLicenses, licenseStatus, isExpiringSoon } from '../../../utils/buLicense';
import { isPerpetual, fmtDate, daysLeft } from '../../licenses/licenseDates';
import { useI18n } from '../../../hooks/useI18n';
import { useExpiryThresholds } from '../../../context/ExpiryThresholdContext';
import type { SeatRow } from '../../licenses/useClusterSeatLicenses';

export interface SeatsByBuTableProps {
  rows: SeatRow[];
  loading: boolean;
  clusterId: string;
  onRetry: () => void;
}

/**
 * วันที่ที่นั่งของ BU นี้จะเริ่มหาย = ใบ active ที่หมดอายุก่อนใคร ไม่ใช่ใบที่หมดทีหลังสุด
 * ผลรวมที่นั่งจะลดลงในวันนั้น การแสดงใบที่ยาวที่สุดจะทำให้คนวางแผนช้าไปทั้งช่วง
 */
function earliestExpiry(row: SeatRow, now: Date, seatDays: number): { date: string | null; soon: boolean } {
  const active = row.licenses.filter((l) => licenseStatus(l, now) === 'active' && !isPerpetual(l.end_date));
  if (active.length === 0) return { date: null, soon: false };
  const first = active.reduce((a, b) => (Date.parse(a.end_date) <= Date.parse(b.end_date) ? a : b));
  return { date: first.end_date, soon: isExpiringSoon(first, seatDays, now) };
}

/**
 * ที่นั่งของทุก BU ในคลัสเตอร์เป็นตารางเดียว แทนหนึ่งการ์ดต่อหนึ่ง BU แบบหน้า platform
 *
 * cluster admin มาที่หน้านี้เพื่อเทียบ BU ต่อ BU ("หน่วยไหนยังไม่ได้ซื้อ" · "ของใครหมดก่อน")
 * ซึ่งเป็นงานอ่านแนวนอน การ์ดต่อหน่วยบังคับให้เลื่อนหาแล้วจำ
 *
 * หน้า platform (`licenses/sections/SeatSection.tsx`) เคยใช้การ์ดต่อ BU ด้วยเหตุผลว่าที่นั่นมี
 * ปุ่มเพิ่ม/แก้/ลบต่อใบ — ตอนนี้มันเป็นตารางเดียวเหมือนกันแล้ว โดยวางปุ่มไว้ในแถวหัวกลุ่มและแถว
 * ของใบ ตารางนี้ยังต่างจากของหน้านั้นตรงที่ไม่มีทางเขียนเลยและไม่กาง "ใบ" ออกมาให้เห็น: cluster
 * admin ถามว่า "พอไหม" ส่วน platform admin ถามว่า "ออกใบไหนไปแล้วบ้าง"
 *
 * แถวที่โหลดใบไม่สำเร็จต้องอ่านว่า "ไม่รู้" ไม่ใช่ 0 — ในระบบนี้ 0 ที่นั่งแปลว่าเชิญผู้ใช้ใหม่
 * ไม่ได้จริง การกลืน error เป็น 0 คือการโกหกผู้ใช้ (กติกาเดียวกับ useClusterSeatLicenses)
 */
export function SeatsByBuTable({ rows, loading, clusterId, onRetry }: SeatsByBuTableProps) {
  const { t } = useI18n();
  const { thresholds } = useExpiryThresholds();
  const now = new Date();
  const failedCount = rows.filter((r) => r.failed).length;

  const computed = rows.map((row) => ({
    row,
    seats: row.failed ? 0 : sumActiveLicenses(row.licenses, now),
    activeCount: row.failed ? 0 : row.licenses.filter((l) => licenseStatus(l, now) === 'active').length,
  }));
  const totalSeats = computed.reduce((n, c) => n + c.seats, 0);
  const unpurchased = computed.filter((c) => !c.row.failed && c.activeCount === 0).length;
  // แถบสัดส่วนวาดเฉพาะเมื่อรู้ครบทุก BU — ผลรวมที่ขาดบางหน่วยทำให้ทุกแถบยาวเกินจริง
  const showShare = failedCount === 0 && totalSeats > 0;

  return (
    <Card className="p-0">
      {/* หัวการ์ดรูปเดียวกับ CoverageCard/CollapsibleGroupCard — หน้านี้ต้องอ่านเป็นแอปเดียว */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4 sm:px-6 sm:py-5">
        <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1.5 text-[11px] font-bold tracking-[0.13em] uppercase">
          <Users className="size-3.5" aria-hidden="true" />
          {t('pages.clusterAdmin.seatsByBusinessUnitLabel')}
        </span>
        {!loading && unpurchased > 0 && (
          <span className="text-muted-foreground text-xs tabular-nums">
            {t('pages.clusterAdmin.seatsNotPurchasedSummary', { count: unpurchased, total: rows.length })}
          </span>
        )}
        {failedCount > 0 && (
          <Button variant="outline" size="sm" className="ml-auto" onClick={onRetry} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('common.action.retry')}
          </Button>
        )}
      </div>

      <div className="border-t p-4 sm:px-6 sm:py-4">
        {loading && rows.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t('pages.clusterAdmin.clusterHasNoBusinessUnitsYet')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            {/* ความกว้างที่เหลือไปตกที่คอลัมน์สุดท้าย (`w-full`) ไม่ใช่คอลัมน์ชื่อ — ไม่งั้นที่ 1440px
                ชื่อ BU กับตัวเลขของมันห่างกันครึ่งจอ ตาต้องกระโดดข้ามช่องว่างทุกแถว */}
            <table className="text-sm [&_th]:whitespace-nowrap">
              <thead>
                <tr className="text-muted-foreground text-xs">
                  <th className="py-1.5 pr-6 pl-2 text-left font-medium">{t('entity.businessUnit.title')}</th>
                  <th className="px-2 py-1.5 text-left font-medium">{t('common.field.seats')}</th>
                  <th className="px-2 py-1.5 text-right font-medium">{t('pages.clusterAdmin.licencesLabel')}</th>
                  <th className="w-full py-1.5 pr-2 pl-6 text-left font-medium">{t('pages.clusterAdmin.endsColumn')}</th>
                </tr>
              </thead>
              <tbody>
                {computed.map(({ row, seats, activeCount }) => {
                  const { date, soon } = earliestExpiry(row, now, thresholds.seat_days);
                  const none = !row.failed && activeCount === 0;
                  return (
                    <tr key={row.bu.id} className="border-b last:border-0">
                      {/* ลิงก์กินพื้นที่แตะของทั้งแถว (`-my-3 py-3`) — วัดที่ 390px แล้วตัวอักษร
                          เปล่า ๆ ให้เป้าแตะแค่ 17px ซึ่งเล็กเกินสำหรับนิ้ว */}
                      <td className="py-3 pr-6 pl-2 whitespace-nowrap">
                        <Link
                          to={`/cluster-admin/${clusterId}/business-units/${row.bu.id}/edit`}
                          className="text-primary -my-3 inline-block py-3 hover:underline"
                        >
                          {row.bu.name || row.bu.code || t('pages.clusterAdmin.unnamed')}
                        </Link>
                        {row.bu.is_hq && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">
                            {t('common.label.hq')}
                          </Badge>
                        )}
                      </td>

                      {row.failed ? (
                        <td className="text-muted-foreground px-2 py-3 text-sm" colSpan={3}>
                          {t('pages.clusterAdmin.couldNotLoadLicencesForBu')}
                        </td>
                      ) : (
                        <>
                          <td className="px-2 py-3">
                            <div className="flex items-center gap-3">
                              <span
                                className={`w-8 text-right font-mono tabular-nums ${none ? 'text-muted-foreground' : ''}`}
                              >
                                {seats}
                              </span>
                              {/* แถวที่ไม่มีที่นั่งเว้นช่องไว้แทนรางเปล่า — ป้าย Not purchased บอกเรื่องนี้แล้ว */}
                              {showShare && seats === 0 && <div className="w-24" aria-hidden="true" />}
                              {showShare && seats > 0 && (
                                // สัดส่วนของสระที่นั่งทั้งคลัสเตอร์ — สีกลาง ไม่ใช่สีสถานะ: ส่วนแบ่งมาก
                                // ไม่ได้แปลว่าดีหรือแย่ (สีสถานะของสระอยู่บนแถบด้านบนของหน้าแล้ว)
                                <div
                                  className="bg-muted h-1.5 w-24 overflow-hidden rounded-full"
                                  role="img"
                                  aria-label={t('pages.clusterAdmin.seatShareAria', { seats, total: totalSeats })}
                                >
                                  <div
                                    className="bg-muted-foreground/60 h-full rounded-full"
                                    style={{ width: `${(seats / totalSeats) * 100}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="text-muted-foreground px-2 py-3 text-right font-mono tabular-nums">
                            {activeCount || '—'}
                          </td>
                          <td className="py-3 pr-2 pl-6 whitespace-nowrap">
                            {none ? (
                              <Badge variant="outline" className="text-muted-foreground font-normal">
                                {t('pages.clusterAdmin.notPurchased')}
                              </Badge>
                            ) : date == null ? (
                              <span className="text-muted-foreground">{t('common.state.noExpiry')}</span>
                            ) : (
                              <span className="inline-flex items-center gap-2 tabular-nums">
                                {fmtDate(date)}
                                {soon && (
                                  <Badge variant="warning" className="text-[10px]">
                                    {t('common.state.daysLeft', { count: daysLeft(date, now) })}
                                  </Badge>
                                )}
                              </span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

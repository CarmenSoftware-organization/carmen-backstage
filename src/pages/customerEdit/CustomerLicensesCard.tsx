import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import businessUnitLicenseService from '../../services/businessUnitLicenseService';
import businessUnitInterfaceLicenseService from '../../services/businessUnitInterfaceLicenseService';
import { useBusinessUnitSubscriptions } from '../businessUnitEdit/useBusinessUnitSubscriptions';
import { sumActiveLicenses, licenseStatus } from '../../utils/buLicense';
import { fmtCoverageRange } from '../licenses/licenseDates';
import { devLog } from '../../utils/errorParser';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../hooks/useI18n';
import type { BusinessUnitLicense, CustomerBusinessUnit, InterfaceLicense } from '../../types';

const unwrap = <T,>(res: unknown): T[] => {
  const r = res as { data?: unknown } | T[] | null | undefined;
  if (Array.isArray(r)) return r;
  return Array.isArray(r?.data) ? (r!.data as T[]) : [];
};

const stateVariant = (s: string) => (s === 'active' ? 'success' : s === 'expired' ? 'destructive' : 'secondary');

/**
 * ใบอนุญาตของ BU หนึ่งตัว — ใช้ fetch เดิมของหน้า BU (ที่นั่ง · สัญญา · interface) ไม่มี endpoint ใหม่
 * สถานะทุกป้ายมาจาก backend (`sub.state`, `in_force`) ยกเว้นที่นั่งซึ่ง backend ไม่ส่ง state มา
 * จึงใช้ `licenseStatus` ตัวเดียวกับหน้า BU (end_date นับรวมทั้งวัน — ห้ามคำนวณวันเองที่นี่)
 */
function BuLicenses({ bu }: { bu: CustomerBusinessUnit }) {
  const { t } = useI18n();
  const subs = useBusinessUnitSubscriptions(bu.id);
  const [seats, setSeats] = useState<BusinessUnitLicense[]>([]);
  const [ifaces, setIfaces] = useState<InterfaceLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // กัน response เก่าทับใหม่เมื่อ bu เปลี่ยนกลางคัน
  const reqId = useRef(0);

  useEffect(() => {
    const mine = ++reqId.current;
    setLoading(true);
    setFailed(false);
    Promise.all([
      businessUnitLicenseService.getAll(bu.id),
      businessUnitInterfaceLicenseService.getAll(bu.id),
    ])
      .then(([s, i]) => {
        if (mine !== reqId.current) return;
        setSeats(unwrap<BusinessUnitLicense>(s));
        setIfaces(unwrap<InterfaceLicense>(i));
      })
      .catch((err) => {
        if (mine !== reqId.current) return;
        devLog('Failed to load licences for customer BU:', err);
        setFailed(true);
      })
      .finally(() => { if (mine === reqId.current) setLoading(false); });
  }, [bu.id]);

  const now = new Date();
  const activeLicenses = seats.filter((l) => licenseStatus(l, now) === 'active');

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to={`/business-units/${bu.id}/edit`}
          className="text-sm font-medium hover:underline"
          title={t('pages.customers.licenseOpenBu')}
        >
          {bu.name} <span className="font-mono text-xs text-muted-foreground">{bu.code}</span>
        </Link>
      </div>

      {failed ? (
        <p className="text-xs text-destructive">{t('pages.customers.licensesLoadFailed')}</p>
      ) : loading ? (
        <p className="text-xs text-muted-foreground" role="status">{t('common.busy.loadingEllipsis')}</p>
      ) : (
        <dl className="space-y-3 text-xs">
          <div>
            <dt className="font-medium text-muted-foreground">{t('pages.customers.licenseSeats')}</dt>
            <dd>
              {t('pages.customers.licenseSeatsValue', {
                count: sumActiveLicenses(seats, now),
                licenses: activeLicenses.length,
              })}
            </dd>
          </div>

          <div>
            <dt className="font-medium text-muted-foreground">{t('pages.customers.licenseSubscriptions')}</dt>
            <dd className="space-y-1.5 pt-0.5">
              {subs.loading ? (
                <span className="text-muted-foreground">{t('common.busy.loadingEllipsis')}</span>
              ) : subs.failed ? (
                <span className="text-destructive">{t('pages.customers.licensesLoadFailed')}</span>
              ) : subs.items.length === 0 ? (
                <span className="text-muted-foreground">{t('pages.customers.licenseNoSubscriptions')}</span>
              ) : (
                subs.items.map((sub) => (
                  <div key={sub.id} className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/licenses/subscriptions/${sub.id}/edit`} className="font-mono hover:underline">
                        {sub.subscription_number}
                      </Link>
                      <span className="text-muted-foreground">
                        {fmtCoverageRange(sub.start_date, sub.end_date, t('common.state.noExpiry'))}
                      </span>
                      <Badge variant={stateVariant(sub.state)}>{t(`common.status.${sub.state}`)}</Badge>
                    </div>
                    {/* groups ไม่มี (backend เก่า) = ไม่วาด ไม่ใช่ "ไม่มีโมดูล" */}
                    {sub.groups && sub.groups.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {sub.groups.map((g) => (
                          <Badge key={g.id} variant="outline" className="font-normal" title={g.code}>{g.name}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </dd>
          </div>

          <div>
            <dt className="font-medium text-muted-foreground">{t('pages.customers.licenseInterface')}</dt>
            <dd className="space-y-1 pt-0.5">
              {ifaces.length === 0 ? (
                <span className="text-muted-foreground">{t('pages.customers.licenseNoInterface')}</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {ifaces.map((l) => (
                    <Badge
                      key={l.id}
                      variant={l.in_force ? 'success' : 'outline'}
                      className="font-normal"
                      title={l.license_number}
                    >
                      {l.group?.name ?? l.license_number}
                      {l.in_force && ` · ${t('pages.customers.licenseInForce')}`}
                    </Badge>
                  ))}
                </div>
              )}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}

interface Props {
  businessUnits: CustomerBusinessUnit[];
}

/**
 * ใบอนุญาตรวม (อ่านอย่างเดียว) ของ BU ที่ผูกกับลูกค้า — แก้ไม่ได้ที่นี่ ไปที่ License Center
 *
 * เช็ก `subscription.read` ก่อนยิง ไม่ใช่แค่ก่อนวาด: ผู้ใช้ที่ไม่มีสิทธิ์ได้ 401 จาก gateway ซึ่ง
 * tokenRefresh แยกจาก token หมดอายุไม่ออกแล้วเตะออกจากระบบ (เหตุผลเดียวกับ useBusinessUnitSubscriptions)
 * การ์ดจึงไม่ปรากฏเลยสำหรับผู้ที่มีแค่ `customer.read`
 */
export default function CustomerLicensesCard({ businessUnits }: Props) {
  const { t } = useI18n();
  const { hasPermission } = useAuth();
  if (!hasPermission('subscription.read')) return null;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <h3 className="text-sm font-semibold">{t('pages.customers.licensesTitle')}</h3>
        <p className="text-xs text-muted-foreground">{t('pages.customers.licensesDescription')}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {businessUnits.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('pages.customers.licensesEmpty')}</p>
        ) : (
          businessUnits.map((bu) => <BuLicenses key={bu.id} bu={bu} />)
        )}
      </CardContent>
    </Card>
  );
}

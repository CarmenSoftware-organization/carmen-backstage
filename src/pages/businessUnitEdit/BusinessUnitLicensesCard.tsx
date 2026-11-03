import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { licenseStatus, isExpiringSoon } from '../../utils/buLicense';
import { daysLeft } from '../licenses/licenseDates';
import { useI18n } from '../../hooks/useI18n';
import { useExpiryThresholds } from '../../context/ExpiryThresholdContext';
import type { BusinessUnitLicense, Subscription } from '../../types';
import type { BusinessUnitSubscriptions } from './useBusinessUnitSubscriptions';
import { LicenseTimeline, useCoverageWindow } from './LicenseTimeline';
import { SubscriptionRows } from './SubscriptionRows';
import { LicenseSectionHeader } from './LicenseSectionHeader';

interface BusinessUnitLicensesCardProps {
  licenses: BusinessUnitLicense[];
  loading: boolean;
  /**
   * ปลายทางของปุ่ม "Manage licences" — **ผู้เรียกเป็นคนตัดสิน ห้ามการ์ดประกอบ URL เอง**
   * การ์ดนี้ถูกใช้สอง shell และ cluster admin ไม่มี `subscription.read` จึงเข้า `/licenses/*` ไม่ได้
   */
  manageHref: string;
  /**
   * ปลายทางของปุ่ม "New subscription" — **ผู้เรียกเป็นคนตัดสินเช่นเดียวกับ `manageHref`**
   * ไม่ส่งมา = ไม่มีปุ่ม ซึ่งเป็นค่าตั้งต้นโดยเจตนา: การ์ดนี้ถูกใช้สอง shell และ cluster admin
   * ไม่มี `subscription.manage` จึงผ่าน `PrivateRoute` ของ `/licenses/subscriptions/new` ไม่ได้
   * ผู้เรียกที่ส่งค่านี้ต้องครอบด้วย `<Can permission="subscription.manage">` เองด้วย
   */
  createHref?: string;
  /**
   * สัญญา (subscription) ที่ออกให้ BU นี้ — **ไม่ส่งมา = ไม่มีรายการ** เหลือแค่สรุปที่นั่งเหมือนเดิม
   * ผู้เรียกฝั่ง platform ส่งจาก `useBusinessUnitSubscriptions` ซึ่งยิงคำขอเฉพาะเมื่อมี
   * `subscription.read` · shell ของ cluster admin ไม่มีสิทธิ์นั้นและเข้า `/licenses/subscriptions/*`
   * ไม่ได้ จึงไม่ส่งมา — แต่ละแถวมีลิงก์ไปหน้าสัญญานั้น
   */
  subscriptions?: BusinessUnitSubscriptions;
  /**
   * ปลายทางของแถวสัญญา — ค่าตั้งต้นคือหน้าสัญญา `/licenses/subscriptions/:id/edit` (shell platform)
   * shell ของ cluster admin เข้า route นั้นไม่ได้ (บังคับ `subscription.read`) จึงส่ง `() => undefined`
   * ให้แถวเป็นข้อความเฉย ๆ — ผู้เรียกตัดสิน URL เองเหมือน `manageHref`/`createHref`
   */
  subscriptionHref?: (sub: Subscription) => string | undefined;
  now?: Date;
}

/**
 * สรุปที่นั่งของ BU — **อ่านอย่างเดียว** การออก/แก้/ลบใบย้ายไปที่ License Center ทั้งหมดแล้ว
 * เพื่อไม่ให้มีสองที่ที่เขียนของเดียวกันแล้วเพี้ยนจากกัน
 */
export default function BusinessUnitLicensesCard({
  licenses, loading, manageHref, createHref, subscriptions, now = new Date(),
  subscriptionHref = (sub) => `/licenses/subscriptions/${sub.id}/edit`,
}: BusinessUnitLicensesCardProps) {
  const { t } = useI18n();
  const { thresholds } = useExpiryThresholds();
  const soonMs = thresholds.subscription_days * 24 * 60 * 60 * 1000;
  const activeCount = licenses.filter((l) => licenseStatus(l, now) === 'active').length;
  const soon = licenses.filter((l) => isExpiringSoon(l, thresholds.seat_days, now));
  const window = useCoverageWindow(now);
  const subItems = subscriptions?.items ?? [];

  return (
    <Card>
      <LicenseSectionHeader
        title={t('pages.businessUnits.userLicensesTitle')}
        facts={
          loading
            ? t('common.busy.loadingEllipsis')
            /* จำนวนที่นั่งและพูล cluster อยู่ในช่องแรกของ LicenseSummaryStrip บนหัวแท็บแล้ว —
               การ์ดเหลือแค่จำนวนใบ ไม่งั้นตัวเลขชุดเดียวกันขึ้นสองที่ห่างกันไม่ถึงหนึ่งจอ */
            : activeCount === 1
              ? t('pages.businessUnits.activeLicenseCountOne', { count: activeCount })
              : t('pages.businessUnits.activeLicenseCountMany', { count: activeCount })
        }
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link to={manageHref}>{t('common.action.manageLicences')}</Link>
            </Button>
            {createHref && (
              <Button asChild size="sm">
                <Link to={createHref}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('common.action.newSubscription')}
                </Link>
              </Button>
            )}
          </>
        }
      >
        {/* แกนเวลารวมบนหัวการ์ดขึ้นเฉพาะเมื่อมี **มากกว่าหนึ่ง** สัญญา — ใบเดียวแถบนี้เหมือนแถบในแถว
            ทุกพิกเซล วาดซ้ำสองเส้นเป็นแค่เสียงรบกวน · ประโยชน์ของมันคือเห็นช่องโหว่/การทับซ้อนระหว่างใบ
            · shell ของ cluster admin ไม่ส่ง `subscriptions` มา จึงไม่ขึ้นที่นั่น */}
        {subscriptions && !subscriptions.loading && subItems.length > 1 && (
          <LicenseTimeline
            variant="group"
            items={subItems.map((sub) => ({ start_date: sub.start_date, end_date: sub.end_date, live: sub.state === 'active' }))}
            window={window}
            now={now}
          />
        )}
        {soon.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {soon.map((l) => (
              <Badge key={l.id} variant="warning">{t('common.state.daysLeft', { count: daysLeft(l.end_date, now) })}</Badge>
            ))}
          </div>
        )}
      </LicenseSectionHeader>
      <CardContent className="space-y-2">
        {subscriptions ? (
          <SubscriptionRows
            subscriptions={subscriptions}
            subscriptionHref={subscriptionHref}
            window={window}
            soonMs={soonMs}
            showGroups
            showFeatureCount={false}
            now={now}
          />
        ) : (
          <p className="text-muted-foreground text-xs">{t('pages.businessUnits.seatsManagedInLicenseCenter')}</p>
        )}
      </CardContent>
    </Card>
  );
}

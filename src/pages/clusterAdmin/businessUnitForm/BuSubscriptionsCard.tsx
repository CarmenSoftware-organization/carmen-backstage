import { Card, CardHeader, CardContent } from '../../../components/ui/card';
import { useI18n } from '../../../hooks/useI18n';
import { useExpiryThresholds } from '../../../context/ExpiryThresholdContext';
import type { BusinessUnitSubscriptions } from '../../businessUnitEdit/useBusinessUnitSubscriptions';
import { LicenseTimeline, useCoverageWindow } from '../../businessUnitEdit/LicenseTimeline';
import { SubscriptionRows } from '../../businessUnitEdit/SubscriptionRows';

interface BuSubscriptionsCardProps {
  subscriptions: BusinessUnitSubscriptions;
  now?: Date;
}

/**
 * แท็บ Features ของ cluster admin — สัญญาของ BU นี้และกลุ่ม feature ที่แต่ละใบถือ อ่านอย่างเดียว
 * แถวไม่เป็นลิงก์: หน้าสัญญาอยู่ใต้ `/licenses/*` ซึ่ง shell นี้ไม่มี `subscription.read`
 */
export function BuSubscriptionsCard({ subscriptions, now = new Date() }: BuSubscriptionsCardProps) {
  const { t } = useI18n();
  const { thresholds } = useExpiryThresholds();
  const window = useCoverageWindow(now);
  const items = subscriptions.items;

  return (
    <Card>
      {/* ปุ่ม Manage licences อยู่ที่แถวแท็บย่อยแท็บเดียว ไม่ซ้ำในทุกการ์ด · ชื่อการ์ดซ้ำกับแท็บที่เพิ่งกด
          จึงเหลือไว้ให้ screen reader เท่านั้น */}
      <CardHeader className="space-y-1">
        <div className="min-w-0 space-y-1">
          <h3 className="sr-only">{t('pages.clusterAdmin.coverageSubscriptionsLabel')}</h3>
          {!subscriptions.loading && items.length > 0 && (
            <LicenseTimeline
              variant="group"
              items={items.map((sub) => ({ start_date: sub.start_date, end_date: sub.end_date, live: sub.state === 'active' }))}
              window={window}
              now={now}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <SubscriptionRows
          subscriptions={subscriptions}
          subscriptionHref={() => undefined}
          window={window}
          soonMs={thresholds.subscription_days * 24 * 60 * 60 * 1000}
          showGroups
          now={now}
        />
      </CardContent>
    </Card>
  );
}

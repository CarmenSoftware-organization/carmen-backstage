import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { daysLeft, fmtCoverageRange } from '../licenses/licenseDates';
import { useI18n } from '../../hooks/useI18n';
import type { Subscription } from '../../types';
import type { BusinessUnitSubscriptions } from './useBusinessUnitSubscriptions';
import { LicenseTimeline, type useCoverageWindow } from './LicenseTimeline';

interface SubscriptionRowsProps {
  subscriptions: BusinessUnitSubscriptions;
  /** ไม่มี href = แถวเป็นข้อความเฉย ๆ (shell ของ cluster admin เข้าหน้าสัญญาไม่ได้) */
  subscriptionHref: (sub: Subscription) => string | undefined;
  window: ReturnType<typeof useCoverageWindow>;
  /** เกณฑ์ "ใกล้หมด" เป็น ms จาก `thresholds.subscription_days` */
  soonMs: number;
  /**
   * วาดกลุ่ม feature ที่สัญญาถือใต้แต่ละแถว — opt-in เพราะการ์ดฝั่ง platform ไม่วาด ·
   * `groups` ไม่มี (backend เก่า) = ไม่วาดอะไร ห้ามอ่านเป็น "ไม่มีกลุ่ม"
   */
  showGroups?: boolean;
  now: Date;
}

const stateVariant = (s: Subscription['state']) =>
  s === 'active' ? 'success' : s === 'expired' ? 'destructive' : 'secondary';

/**
 * รายการสัญญาของ BU พร้อมสถานะโหลด/ล้ม/ว่าง — ใช้ร่วมระหว่าง `BusinessUnitLicensesCard` (platform)
 * กับแท็บ Features ของ cluster admin ซึ่งแยกสัญญาออกจากใบที่นั่ง
 */
export function SubscriptionRows({ subscriptions, subscriptionHref, window, soonMs, showGroups = false, now }: SubscriptionRowsProps) {
  const { t } = useI18n();

  return (
    <>
      {subscriptions.loading && (
        <p className="text-muted-foreground text-xs" role="status">{t('common.busy.loadingEllipsis')}</p>
      )}
      {!subscriptions.loading && subscriptions.failed && (
        <p className="text-destructive text-xs">{t('pages.businessUnits.subscriptionsLoadFailed')}</p>
      )}
      {!subscriptions.loading && !subscriptions.failed && subscriptions.items.length === 0 && (
        <p className="text-muted-foreground text-xs">{t('pages.businessUnits.noSubscriptions')}</p>
      )}
      {subscriptions.items.map((sub) => {
        const left = new Date(sub.end_date).getTime() - now.getTime();
        // ป้ายนับถอยหลังขึ้นเฉพาะสัญญาที่ยังใช้ได้ — ใบที่หมด/ปิดแล้วไม่มีอะไรให้นับ
        const soon = sub.state === 'active' && left <= soonMs;
        const href = subscriptionHref(sub);
        const groups = showGroups ? sub.groups : undefined;
        const rowClass = 'flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs';
        const body = (
          <>
            <div className="min-w-0 space-y-0.5">
              <div className={href ? 'font-mono group-hover:underline' : 'font-mono'}>{sub.subscription_number}</div>
              <div className="text-muted-foreground">
                {fmtCoverageRange(sub.start_date, sub.end_date, t('common.state.noExpiry'))}
                {' · '}
                {/* ไม่โชว์ที่นั่งรายแถว: `seat_used/seat_cap` ของสัญญาคือพูลระดับ cluster ซึ่งขึ้นเป็น
                    บรรทัด "Cluster pool" บนหัวการ์ดอยู่แล้ว ซ้ำทุกแถวจะอ่านผิดว่าเป็นของใบนั้น */}
                {sub.feature_count === 1
                  ? t('pages.businessUnits.subscriptionRowOne', { count: sub.feature_count })
                  : t('pages.businessUnits.subscriptionRowMany', { count: sub.feature_count })}
              </div>
              {groups && groups.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {groups.map((g) => (
                    <Badge key={g.id} variant="outline" className="font-normal" title={g.code}>{g.name}</Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <LicenseTimeline
                variant="item"
                items={[{ start_date: sub.start_date, end_date: sub.end_date, live: sub.state === 'active' }]}
                window={window}
                now={now}
                label={t('pages.licenses.coverageBarLabel', { text: fmtCoverageRange(sub.start_date, sub.end_date, t('common.state.noExpiry')) })}
              />
              {soon && <Badge variant="warning">{t('common.state.daysLeft', { count: daysLeft(sub.end_date, now) })}</Badge>}
              <Badge variant={stateVariant(sub.state)}>{t(`common.status.${sub.state}`)}</Badge>
              {href && (
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              )}
            </div>
          </>
        );
        /* ทั้งแถวเป็นลิงก์ไปหน้าสัญญา ไม่ใช่แค่เลขที่ — เป้ากดกว้างกว่าและตรงกับที่ผู้ใช้คาด
           จากแถวรายการ · ยังเป็น <a> จริงจึงเปิดแท็บใหม่/คลิกกลางได้ · ไม่มี href = shell นี้
           ไปหน้าสัญญาไม่ได้ วาดเป็นแถวเฉย ๆ */
        return href ? (
          <Link
            key={sub.id}
            to={href}
            aria-label={t('pages.businessUnits.openSubscription', { number: sub.subscription_number })}
            className={`group ${rowClass} transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
          >
            {body}
          </Link>
        ) : (
          <div key={sub.id} className={rowClass}>{body}</div>
        );
      })}
    </>
  );
}

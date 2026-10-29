import { Card, CardHeader, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { useI18n } from '../../../hooks/useI18n';
import { useExpiryThresholds } from '../../../context/ExpiryThresholdContext';
import { daysLeft, fmtDate, isPerpetual } from '../../licenses/licenseDates';
import type { Subscription } from '../../../types';
import type { BusinessUnitSubscriptions } from '../../businessUnitEdit/useBusinessUnitSubscriptions';
import { LicenseTimeline, useCoverageWindow } from '../../businessUnitEdit/LicenseTimeline';
import { SubscriptionRows } from '../../businessUnitEdit/SubscriptionRows';
import { LicenseTile, LicenseTileGrid } from './LicenseTile';

interface BuSubscriptionsCardProps {
  subscriptions: BusinessUnitSubscriptions;
  now?: Date;
}

interface ModuleHolding {
  id: string;
  code: string;
  name: string;
  /** สัญญาที่ตัดสินสถานะของ module นี้ — ใบที่ใช้ได้อยู่ซึ่งหมดทีหลังสุด ไม่มีจึงตกไปใบอื่น */
  sub: Subscription;
}

/** ใบที่ใช้ได้อยู่ชนะเสมอ ในกลุ่มเดียวกันใบที่หมดทีหลังชนะ — คือวันที่ module นี้จะหยุดใช้ได้จริง */
const better = (a: Subscription, b: Subscription) => {
  const live = (s: Subscription) => (s.state === 'active' ? 1 : 0);
  if (live(a) !== live(b)) return live(a) > live(b) ? a : b;
  return Date.parse(a.end_date) >= Date.parse(b.end_date) ? a : b;
};

/**
 * แท็บ Modules ของ cluster admin — **module ที่ BU นี้ซื้อ** ขึ้นก่อน แล้วสัญญาที่ให้ module เหล่านั้นตามมาเป็นส่วนรอง
 *
 * ลูกค้าซื้อเป็น module ไม่ใช่เป็นสัญญา คำถามแรกของคนที่เปิดแท็บนี้จึงเป็น "BU นี้มีอะไรใช้ ใช้ได้ถึงเมื่อไร"
 * แผ่น module ตอบตรงนั้นโดยไม่ต้องไล่ป้ายในแต่ละแถวสัญญา · อ่านอย่างเดียว แถวสัญญาไม่เป็นลิงก์
 * เพราะหน้าสัญญาอยู่ใต้ `/licenses/*` ซึ่ง shell นี้ไม่มี `subscription.read`
 *
 * backend ที่ยังไม่ส่ง `groups` (ไม่มีฟิลด์ ≠ ไม่มี module) ไม่วาดแผ่น และให้แถวสัญญาแสดงจำนวน feature แทน
 */
export function BuSubscriptionsCard({ subscriptions, now = new Date() }: BuSubscriptionsCardProps) {
  const { t } = useI18n();
  const { thresholds } = useExpiryThresholds();
  const window = useCoverageWindow(now);
  const items = subscriptions.items;
  const soonMs = thresholds.subscription_days * 24 * 60 * 60 * 1000;
  const groupsKnown = items.length > 0 && items.every((sub) => Array.isArray(sub.groups));

  const holdings = new Map<string, ModuleHolding>();
  if (groupsKnown) {
    for (const sub of items) {
      for (const g of sub.groups!) {
        const prev = holdings.get(g.id);
        holdings.set(g.id, { ...g, sub: prev ? better(prev.sub, sub) : sub });
      }
    }
  }
  const modules = Array.from(holdings.values());
  const inForce = modules.filter((m) => m.sub.state === 'active').length;

  return (
    <Card>
      {/* ปุ่ม Manage licences อยู่ที่แถวแท็บย่อยแท็บเดียว · ชื่อการ์ดซ้ำกับแท็บที่เพิ่งกด จึงเหลือให้ screen reader */}
      <CardHeader className="space-y-3">
        <h3 className="sr-only">{t('pages.clusterAdmin.licenseTypeFeatures')}</h3>
        {groupsKnown && (
          <>
            <p className="text-muted-foreground text-xs">
              {t(inForce === 1 ? 'pages.clusterAdmin.modulesInForceOne' : 'pages.clusterAdmin.modulesInForceMany', { count: inForce })}
            </p>
            {modules.length === 0 ? (
              <p className="text-muted-foreground text-xs">{t('pages.clusterAdmin.noModulesOnSubscriptions')}</p>
            ) : (
              <LicenseTileGrid>
                {modules.map((m) => {
                  const live = m.sub.state === 'active';
                  const soon = live && !isPerpetual(m.sub.end_date) && Date.parse(m.sub.end_date) - now.getTime() <= soonMs;
                  return (
                    <LicenseTile
                      key={m.id}
                      name={m.name}
                      code={m.code}
                      muted={!live}
                      when={
                        // ใบที่ยังไม่ถึงวันเริ่ม (state 'scheduled') บอกวันเริ่มแทนวันสิ้นสุด
                        Date.parse(m.sub.start_date) > now.getTime()
                          ? t('pages.clusterAdmin.moduleFrom', { date: fmtDate(m.sub.start_date) })
                          : isPerpetual(m.sub.end_date)
                            ? t('common.state.noExpiry')
                            : t('pages.clusterAdmin.moduleUntil', { date: fmtDate(m.sub.end_date) })
                      }
                      badges={
                        <>
                          {soon && <Badge variant="warning">{t('common.state.daysLeft', { count: daysLeft(m.sub.end_date, now) })}</Badge>}
                          {!live && <Badge variant={m.sub.state === 'expired' ? 'destructive' : m.sub.state === 'scheduled' ? 'info' : 'secondary'}>{t(`common.status.${m.sub.state}`)}</Badge>}
                        </>
                      }
                    />
                  );
                })}
              </LicenseTileGrid>
            )}
          </>
        )}
      </CardHeader>
      <CardContent className="space-y-2 border-t pt-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-muted-foreground text-[11px] font-bold tracking-[0.13em] uppercase">
            {t('pages.clusterAdmin.coverageSubscriptionsLabel')}
          </h3>
          {!subscriptions.loading && items.length > 0 && (
            <LicenseTimeline
              variant="group"
              items={items.map((sub) => ({ start_date: sub.start_date, end_date: sub.end_date, live: sub.state === 'active' }))}
              window={window}
              now={now}
            />
          )}
        </div>
        {/* module อยู่บนแผ่นด้านบนแล้ว แถวสัญญาจึงไม่ทวนป้าย module และไม่บอกจำนวน feature
            ยกเว้น backend เก่าที่ไม่มี groups — ตอนนั้นจำนวน feature คือข้อมูลเดียวที่มี */}
        <SubscriptionRows
          subscriptions={subscriptions}
          subscriptionHref={() => undefined}
          window={window}
          soonMs={soonMs}
          showFeatureCount={!groupsKnown && items.length > 0}
          now={now}
        />
      </CardContent>
    </Card>
  );
}

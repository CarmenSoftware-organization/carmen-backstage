import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, RefreshCw } from 'lucide-react';
import Layout from '../components/Layout';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { DevDebugSheet } from '../components/ui/dev-debug-sheet';
import clusterService from '../services/clusterService';
import businessUnitService from '../services/businessUnitService';
import userService from '../services/userService';
import applicationService from '../services/applicationService';
import newsService from '../services/newsService';
import subscriptionService from '../services/subscriptionService';
import licenseIntakeService from '../services/licenseIntakeService';
import reportTemplateService from '../services/reportTemplateService';
import { parseApiError } from '../utils/errorParser';
import { formatClock } from '../utils/relativeTime';
import { useI18n } from '../hooks/useI18n';
import { useAuth } from '../context/AuthContext';
import { useFeatureFlags } from '../context/FeatureFlagContext';
import type { PaginateParams } from '../types';
import { fetchActivity, ACTIVITY_SOURCES, unwrapTotal, type ActivityItem } from './dashboard/activity';
import { ActivityStream } from './dashboard/ActivityStream';
import { CountsRail, type DomainCount } from './dashboard/CountsRail';
import { AttentionBand, type AttentionItem } from './dashboard/AttentionBand';

type ListService = { getAll: (p: PaginateParams) => Promise<unknown> };

const emptyCounts = (): Record<string, DomainCount> =>
  Object.fromEntries(ACTIVITY_SOURCES.map((s) => [s.key, { active: null, total: null }]));

const Dashboard: React.FC = () => {
  const { t } = useI18n();
  const [counts, setCounts] = useState<Record<string, DomainCount>>(emptyCounts);
  const [countsLoading, setCountsLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityFailed, setActivityFailed] = useState<string[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState(false);
  const activityHadErrorRef = useRef(false);
  // --- attention band: what needs someone today ---
  // Each source is gated on the permission (and feature flag) of the page it links to: firing a
  // summary request without the permission gets a 401, and the interceptor signs the user out.
  const { hasPermission } = useAuth();
  const { flagOf, isReady: flagsReady } = useFeatureFlags();
  const canSubs = flagsReady && hasPermission('subscription.read') && flagOf('licenses') === 'active';
  const canIntakes = flagsReady && hasPermission('subscription.read') && flagOf('license_intakes') === 'active';
  const canQuota = flagsReady && hasPermission('cluster.read') && flagOf('clusters') === 'active';
  type Slot = { count: number | null; failed: boolean };
  const unknown: Slot = { count: null, failed: false };
  const [attn, setAttn] = useState<Record<'expired' | 'expiring' | 'intakes' | 'quota', Slot>>({
    expired: unknown, expiring: unknown, intakes: unknown, quota: unknown,
  });
  const [attnLoading, setAttnLoading] = useState(true);
  const loadAttention = useCallback(async () => {
    setAttnLoading(true);
    const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const settle = async <K extends keyof typeof attn>(keys: K[], run: () => Promise<Record<K, number | null>>) => {
      try {
        const res = await run();
        setAttn((prev) => {
          const next = { ...prev };
          // A field the backend didn't send is unknown, not zero.
          for (const k of keys) next[k] = res[k] === null ? { count: null, failed: true } : { count: res[k], failed: false };
          return next;
        });
      } catch {
        setAttn((prev) => {
          const next = { ...prev };
          for (const k of keys) next[k] = { count: null, failed: true };
          return next;
        });
      }
    };
    await Promise.all([
      canSubs &&
        settle(['expired', 'expiring'], async () => {
          const s = await subscriptionService.getSummary();
          return { expired: num(s?.expired), expiring: num(s?.expiring_soon) };
        }),
      canIntakes &&
        settle(['intakes'], async () => {
          const res = await licenseIntakeService.getSummary();
          return { intakes: num((res?.data ?? res)?.pending) };
        }),
      canQuota &&
        settle(['quota'], async () => {
          const f = await clusterService.getFleetSummary();
          return { quota: num(f?.expiring_soon) };
        }),
    ]);
    setAttnLoading(false);
  }, [canSubs, canIntakes, canQuota]);

  useEffect(() => {
    if (flagsReady) loadAttention();
  }, [flagsReady, loadAttention]);

  const attentionItems: AttentionItem[] = [
    canSubs && { key: 'expired', labelKey: 'pages.dashboard.attentionExpired', areaKey: 'pages.dashboard.areaSubscriptions', ...attn.expired, href: '/licenses?tab=subscription&filter=expired', tone: 'destructive' },
    canSubs && { key: 'expiring', labelKey: 'pages.dashboard.attentionExpiring', areaKey: 'pages.dashboard.areaSubscriptions', ...attn.expiring, href: '/licenses?tab=subscription&filter=expiring', tone: 'warning' },
    canIntakes && { key: 'intakes', labelKey: 'pages.dashboard.attentionIntakes', areaKey: 'pages.dashboard.areaIntakes', ...attn.intakes, href: '/license-intakes?filter=pending', tone: 'info' },
    canQuota && { key: 'quota', labelKey: 'pages.dashboard.attentionQuota', areaKey: 'pages.dashboard.areaQuota', ...attn.quota, href: '/clusters?filter=quota-expiring', tone: 'warning' },
  ].filter(Boolean) as AttentionItem[];

  // When the page last got data back. A feed of "what changed" is only as good as its age.
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const updatedAtRef = useRef<string | null>(null);
  const markUpdated = useCallback(() => {
    const now = new Date().toISOString();
    updatedAtRef.current = now;
    setUpdatedAt(now);
  }, []);

  // --- per-domain active / total counts (populate the rail) ---
  const loadCounts = useCallback(async () => {
    setCountsLoading(true);

    const where = (w: Record<string, unknown>) => JSON.stringify({ where: { ...w, deleted_at: null } });

    const loadDomain = async (key: string, service: ListService, activeWhere: Record<string, unknown>) => {
      try {
        const [totalRes, activeRes] = await Promise.all([
          service.getAll({ page: 1, perpage: 1, advance: where({}) }),
          service.getAll({ page: 1, perpage: 1, advance: where(activeWhere) }),
        ]);
        setCounts((prev) => ({
          ...prev,
          [key]: { active: unwrapTotal(activeRes), total: unwrapTotal(totalRes) },
        }));
      } catch {
        // Unknown, not zero: CountsRail marks this row and keeps the domains that loaded.
        setCounts((prev) => ({ ...prev, [key]: { active: null, total: null, failed: true } }));
      }
    };

    await Promise.all([
      loadDomain('clusters', clusterService, { is_active: true }),
      loadDomain('business-units', businessUnitService, { is_active: true }),
      loadDomain('users', userService, { is_active: true }),
      loadDomain('applications', applicationService, { is_active: true }),
      loadDomain('report-templates', reportTemplateService, { is_active: true }),
      loadDomain('news', newsService, { status: 'published' }),
    ]);

    setCountsLoading(false);
    markUpdated();
  }, [markUpdated]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  // --- unified recent-activity stream ---
  const loadActivity = useCallback(() => {
    setActivityLoading(true);
    setActivityError(false);
    fetchActivity()
      .then(({ items, failedDomains }) => {
        setActivity(items);
        setActivityFailed(failedDomains);
        markUpdated();
        if (activityHadErrorRef.current) {
          toast.success(t('pages.dashboard.activityReloaded'));
        }
        activityHadErrorRef.current = false;
      })
      .catch((err) => {
        if (activityHadErrorRef.current) {
          toast.error(parseApiError(err).message);
        }
        activityHadErrorRef.current = true;
        setActivityFailed([]);
        setActivityError(true);
      })
      .finally(() => setActivityLoading(false));
  }, [t, markUpdated]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const refreshing = countsLoading || activityLoading || (attentionItems.length > 0 && attnLoading);
  const refreshAll = useCallback(() => {
    loadAttention();
    loadCounts();
    loadActivity();
  }, [loadAttention, loadCounts, loadActivity]);

  // Coming back to a tab left open for a while: reload rather than show an old picture as current.
  useEffect(() => {
    const STALE_MS = 60_000;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const last = updatedAtRef.current ? Date.parse(updatedAtRef.current) : 0;
      if (Date.now() - last > STALE_MS) refreshAll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshAll]);

  const countsFailed = ACTIVITY_SOURCES.filter((s) => counts[s.key]?.failed).length;
  const countsError = countsFailed === ACTIVITY_SOURCES.length;

  return (
    <Layout>
      {/* Full width of the shell (carmen-blue-backstage-ui-design rule 1): the rail sits at the right
          edge, so the header's Refresh lands over the rail it refreshes. */}
      <div className="space-y-6">
        <PageHeader
          title={t('pages.dashboard.title')}
          subtitle={t('pages.dashboard.subtitle')}
          actions={
            <>
              {updatedAt && (
                <span className="text-muted-foreground text-xs tabular-nums">
                  {t('pages.dashboard.updatedAt', { time: formatClock(updatedAt) })}
                </span>
              )}
              <Button variant="outline" size="sm" onClick={refreshAll} disabled={refreshing}>
                {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                {t('pages.dashboard.refresh')}
              </Button>
            </>
          }
        />

        <AttentionBand items={attentionItems} loading={attnLoading} />

        {/* The stream takes the rest of the width; each row keeps its meta beside the name
            (ActivityStream caps the name column) so a wide screen opens no gulf between them. */}
        {/* grid-cols-1 is load-bearing below lg: without it the single implicit column is an
            auto track that sizes to max-content, and a long activity line scrolls the page. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_236px]">
          <ActivityStream
            items={activity}
            loading={activityLoading}
            error={activityError}
            failedDomains={activityFailed}
            onRetry={loadActivity}
          />
          <aside className="self-start lg:sticky lg:top-4">
            <CountsRail counts={counts} loading={countsLoading} error={countsError} onRetry={loadCounts} />
          </aside>
        </div>

        <DevDebugSheet
          title={t('pages.dashboard.debugTitle')}
          endpoint="GET /api-system/*/list?sort=updated_at:desc"
          data={{ counts, activity }}
        />
      </div>
    </Layout>
  );
};

export default Dashboard;

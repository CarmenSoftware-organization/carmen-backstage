import { Link } from 'react-router-dom';
import { TriangleAlert } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { FetchErrorState } from '../../components/FetchErrorState';
import { useI18n } from '../../hooks/useI18n';
import { ACTIVITY_SOURCES } from './activity';

export interface DomainCount {
  active: number | null;
  total: number | null;
  /** The last load of this domain failed — its numbers are unknown, not zero. */
  failed?: boolean;
}

interface CountsRailProps {
  counts: Record<string, DomainCount>;
  loading?: boolean;
  error?: boolean;
  onRetry: () => void;
}

/**
 * Slim at-a-glance rail: active / total per domain. There is no grand total — a sum of clusters,
 * users and news items is not a quantity anyone acts on (removed with the attention band).
 * `error` means every domain failed; a partial failure is read from `counts[*].failed`
 * and marked on its own row, so the domains that did load keep their numbers.
 */
export function CountsRail({ counts, loading, error, onRetry }: CountsRailProps) {
  const { t } = useI18n();
  const failedLabels = ACTIVITY_SOURCES.filter((s) => counts[s.key]?.failed).map((s) => t(s.labelKey));
  const partial = !error && !loading && failedLabels.length > 0;
  return (
    <Card className="overflow-hidden p-0">
      <div className="text-muted-foreground border-b px-3.5 py-2.5 text-[11px] font-bold tracking-[0.13em] uppercase">
        {t('pages.dashboard.estate')}
      </div>
      {!error && (
        // Without this the rail's "6 / 6" leaves the reader to guess which number is which.
        <div className="text-muted-foreground flex items-baseline justify-between gap-2 px-3.5 pt-2 pb-0.5 text-[11px]">
          <span>{t('pages.dashboard.countsDomain')}</span>
          <span>{t('pages.dashboard.countsLegend')}</span>
        </div>
      )}
      {error ? (
        <FetchErrorState message={t('pages.dashboard.estateLoadFailed')} onRetry={onRetry} className="px-3.5 py-6" />
      ) : loading ? (
        <div role="status" aria-label={t('pages.dashboard.loadingEstate')}>
          <DomainRows counts={counts} />
        </div>
      ) : (
        <>
          <DomainRows counts={counts} />
          {partial && (
            <div role="alert" className="border-t px-3.5 py-2.5 text-xs">
              <p className="text-muted-foreground">
                {t('pages.dashboard.estatePartial', { domains: failedLabels.join(', ') })}
              </p>
              <button type="button" onClick={onRetry} className="text-primary mt-1 underline underline-offset-2">
                {t('common.tryAgain')}
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function DomainRows({ counts }: { counts: Record<string, DomainCount> }) {
  const { t } = useI18n();
  return (
    <div>
      {ACTIVITY_SOURCES.map((s) => {
        const c = counts[s.key] ?? { active: null, total: null };
        const Icon = s.icon;
        return (
          <Link
            key={s.key}
            to={s.path}
            className="hover:bg-primary/[0.04] flex items-center gap-2.5 border-t px-3.5 py-2 first:border-t-0"
          >
            <span className="text-muted-foreground grid size-[22px] shrink-0 place-items-center rounded-md">
              <Icon className="size-[13px]" />
            </span>
            <span className="text-foreground/90 flex-1 truncate text-xs">{t(s.labelKey)}</span>
            {c.failed ? (
              <span className="text-warning inline-flex items-center gap-1 text-xs">
                <TriangleAlert className="size-3.5" aria-hidden="true" />
                {t('pages.dashboard.domainUnavailable')}
              </span>
            ) : (
              <span
                className="font-mono text-xs tabular-nums"
                aria-label={
                  c.active != null && c.total != null
                    ? t(s.key === 'news' ? 'pages.dashboard.countsPublishedOf' : 'pages.dashboard.countsActiveOf', {
                        active: c.active,
                        total: c.total,
                      })
                    : undefined
                }
              >
                <span className="text-foreground font-semibold">{c.active ?? '-'}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="text-muted-foreground">{c.total ?? '-'}</span>
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

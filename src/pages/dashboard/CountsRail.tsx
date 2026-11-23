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
  governed: number | null;
  loading?: boolean;
  error?: boolean;
  onRetry: () => void;
}

/**
 * Slim at-a-glance rail: total records governed + active / total per domain.
 * `error` means every domain failed; a partial failure is read from `counts[*].failed`
 * and marked on its own row, so the domains that did load keep their numbers.
 */
export function CountsRail({ counts, governed, loading, error, onRetry }: CountsRailProps) {
  const { t } = useI18n();
  const failedLabels = ACTIVITY_SOURCES.filter((s) => counts[s.key]?.failed).map((s) => t(s.labelKey));
  const partial = !error && !loading && failedLabels.length > 0;
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b px-3.5 py-3">
        <div className="text-muted-foreground text-[11px] font-bold uppercase tracking-[0.13em]">{t('pages.dashboard.estate')}</div>
        <div className="mt-0.5 font-mono text-2xl font-semibold tabular-nums tracking-tight">
          {error ? '-' : governed ?? '-'}
          <span className="text-muted-foreground ml-1.5 font-sans text-[11px] font-normal">{t('pages.dashboard.recordsGoverned')}</span>
        </div>
      </div>
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
              <span className="font-mono text-xs tabular-nums">
                <span className="text-foreground font-semibold">{c.active ?? '-'}</span>
                <span className="text-muted-foreground/60"> / </span>
                <span className="text-muted-foreground">{c.total ?? '-'}</span>
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

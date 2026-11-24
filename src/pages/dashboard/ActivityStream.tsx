import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, History, TriangleAlert } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Skeleton } from '../../components/ui/skeleton';
import { FetchErrorState } from '../../components/FetchErrorState';
import { formatClock, dayGroup } from '../../utils/relativeTime';
import { useI18n } from '../../hooks/useI18n';
import type { TKey } from '../../i18n/types';
import { ACTIVITY_SOURCES, foldRuns, type ActivityItem, type ActivityVerb, type ActivityEntry } from './activity';

// The verb is deliberately *quiet* — the entity name is what people scan for. Colour
// lives on the timeline dot, the word itself rides the right margin as plain meta text.
// "updated" is the default and nearly every row is one (created only means "never edited
// since", activity.ts deriveVerb), so it is drawn as the exception rule says: neutral dot,
// no visible word (screen readers still get it). Only created/published stand out.
const VERB: Record<ActivityVerb, { dot: string; key: TKey; quiet?: boolean }> = {
  created: { dot: 'bg-success', key: 'pages.dashboard.verbCreated' },
  updated: { dot: 'bg-muted-foreground/40', key: 'pages.dashboard.verbUpdated', quiet: true },
  published: { dot: 'bg-warning', key: 'pages.dashboard.verbPublished' },
};

interface ActivityStreamProps {
  items: ActivityItem[];
  loading: boolean;
  error: boolean;
  /** Domains whose fetch failed while the rest loaded. Their rows are missing from `items`. */
  failedDomains?: string[];
  onRetry: () => void;
}

export function ActivityStream({ items, loading, error, failedDomains = [], onRetry }: ActivityStreamProps) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<string>('all');

  const perDomain = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of items) m[it.domainKey] = (m[it.domainKey] ?? 0) + 1;
    return m;
  }, [items]);

  const failed = new Set(failedDomains);
  // A refresh can empty the domain the filter points at, and its chip goes with it; fall
  // back to everything rather than strand the reader on a filter they can no longer see.
  const activeFilter = filter === 'all' || (perDomain[filter] ?? 0) > 0 || failed.has(filter) ? filter : 'all';
  const shown = activeFilter === 'all' ? items : items.filter((i) => i.domainKey === activeFilter);
  const failedLabels = ACTIVITY_SOURCES.filter((s) => failed.has(s.key)).map((s) => t(s.labelKey));

  // No counts on the chips: the Estate rail is the one place this page states how many of
  // anything there are. A chip number meant "rows in this stream", the rail's meant
  // "active / total", and a Clusters chip of 0 beside a rail of 6 / 6 read as a contradiction.
  // A domain with nothing in the stream gets no chip at all, rather than a faded one whose
  // zero was the very thing nobody could read. A failed domain keeps its chip: unknown is
  // not empty, and the chip is where its warning shows.
  const chips = [{ key: 'all', label: t('pages.dashboard.filterAll') }].concat(
    ACTIVITY_SOURCES.filter((s) => (perDomain[s.key] ?? 0) > 0 || failed.has(s.key)).map((s) => ({
      key: s.key,
      label: t(s.labelKey),
    })),
  );

  return (
    <div>
      {/* filter chips */}
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label={t('pages.dashboard.filterAria')}>
        {chips.map((c) => {
          const on = activeFilter === c.key;
          const unavailable = failed.has(c.key);
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(c.key)}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors',
                on
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:border-input hover:text-foreground',
              )}
            >
              {c.label}
              {unavailable && (
                <>
                  <TriangleAlert className={cn('size-3.5', !on && 'text-warning-ink')} aria-hidden="true" />
                  <span className="sr-only">{t('pages.dashboard.domainUnavailable')}</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {!loading && !error && failedLabels.length > 0 && (
        <div
          role="alert"
          className="border-warning/40 bg-warning/10 mb-3 flex flex-wrap items-start gap-x-2 gap-y-1 rounded-md border px-3 py-2 text-xs"
        >
          <TriangleAlert className="text-warning-ink mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            {t('pages.dashboard.activityPartial', { domains: failedLabels.join(', ') })}
          </span>
          <button type="button" onClick={onRetry} className="text-primary inline-flex min-h-6 items-center underline underline-offset-2">
            {t('common.tryAgain')}
          </button>
        </div>
      )}

      {loading ? (
        <StreamSkeleton />
      ) : error ? (
        // Note for future readers: this trades exact inline text-wrap (button riding the
        // last line with the message) for FetchErrorState's flex-wrap layout, where the
        // button can drop to its own centered line at narrow widths. Accepted deliberately
        // to keep a single error/retry implementation — see Task 10 report for the trade-off.
        <FetchErrorState
          message={t('pages.dashboard.activityLoadFailed')}
          onRetry={onRetry}
          className="rounded-lg border border-dashed py-14"
        />
      ) : shown.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed py-14 text-center">
          <History className="text-muted-foreground/60 size-6" />
          <p className="text-foreground text-sm font-medium">{t('pages.dashboard.emptyTitle')}</p>
          <p className="text-xs">{t('pages.dashboard.emptyBody')}</p>
        </div>
      ) : (
        <Timeline items={shown} />
      )}
    </div>
  );
}

function Timeline({ items }: { items: ActivityItem[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const now = new Date();
  const entries = foldRuns(items);
  const first = (e: ActivityEntry) => (e.kind === 'one' ? e.item : e.items[0]);
  let lastDay = '';

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Row cap on wide streams: name 32rem + meta 16rem + icon, chevron, gaps and padding
  // (28+16+3×12+20 px = 6.25rem). Capping the row rather than the name keeps the chevron and
  // the hover band beside the content instead of ~600px away at the stream's right edge.
  const rowCap = '@2xl:max-w-[54.25rem]';

  // @container: the verb/actor column switches on the stream's own width, not the screen's —
  // at a 768px screen the sidebar leaves the stream ~470px, too narrow for a 16rem meta column.
  return (
    <div className="@container">
      {entries.map((e, i) => {
        const it = first(e);
        const g = dayGroup(it.at, now, t);
        const header = g.key !== lastDay;
        lastDay = g.key;
        // เทียบด้วย `key` ซึ่งไม่ขึ้นกับภาษา — ถ้าเทียบด้วย label การสลับภาษาจะทำให้กลุ่มวันแตก
        const nextIsNewDay = i === entries.length - 1 || dayGroup(first(entries[i + 1]).at, now).key !== g.key;
        const verb = VERB[it.verb];
        const Icon = it.icon;
        const isRun = e.kind === 'run';
        const expanded = isRun && open.has(e.key);
        const listId = isRun ? `run-${e.key}` : undefined;

        // Verb and actor: under the name on a narrow stream, their own column on a wide one.
        const metaInline = (
          <span className="@2xl:hidden">
            {verb.quiet ? '' : ` · ${t(verb.key)}`}
            {it.who ? ` · ${t('pages.dashboard.by', { who: it.who })}` : ''}
          </span>
        );
        // Fixed widths on purpose: the verbs form a scannable column, and a row
        // with no known actor must not shift its verb out of that column.
        const metaColumn = (
          <span className="text-muted-foreground mt-[3px] hidden w-64 shrink-0 items-baseline gap-1.5 self-start text-xs @2xl:flex">
            <span className="text-foreground/70 w-[4.75rem] shrink-0 font-medium">{verb.quiet ? '' : t(verb.key)}</span>
            {it.who && <span className="truncate">{t('pages.dashboard.by', { who: it.who })}</span>}
          </span>
        );
        // The quiet verb, for screen readers only. It must be a direct child of the flex row:
        // an sr-only span is position:absolute, and nested in the truncated meta line its static
        // position sits past the line's end, escapes the clip and widens the page (706px at 390).
        const quietVerb = verb.quiet ? <span className="sr-only">{t(verb.key)}</span> : null;
        const iconTile = (
          <span className="bg-primary/[0.06] text-muted-foreground grid size-7 shrink-0 place-items-center rounded-lg">
            <Icon className="size-[15px]" />
          </span>
        );

        return (
          <div key={isRun ? `run:${e.key}` : `${it.domainKey}:${it.id}`}>
            {header && (
              <div className="bg-background text-muted-foreground sticky top-0 z-[1] flex items-baseline gap-2 pb-2 pt-3.5 text-[11px] font-bold uppercase tracking-[0.12em]">
                {g.label}
              </div>
            )}
            <div className="grid grid-cols-[3.25rem_1.25rem_1fr] items-start">
              <div className="text-muted-foreground pt-3 text-right font-mono text-[11px] tabular-nums">
                {formatClock(it.at)}
              </div>
              {/* rail + dot — the dot centres on the title line (20px down: my-0.5 + py-2 +
                  half a 20px line box), matching the clock in the column to its left. */}
              <div className="relative flex justify-center self-stretch">
                <span
                  className={cn(
                    'bg-border absolute w-px',
                    header ? 'top-5' : 'top-0',
                    nextIsNewDay ? 'h-5' : 'bottom-0',
                  )}
                  aria-hidden="true"
                />
                <span
                  className={cn('relative z-[1] mt-[15px] size-2.5 rounded-full ring-2 ring-background', verb.dot)}
                  aria-hidden="true"
                />
              </div>
              {/* body */}
              {isRun ? (
                <div className="min-w-0">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={listId}
                    aria-label={t(expanded ? 'pages.dashboard.groupHide' : 'pages.dashboard.groupShow', {
                      count: e.items.length,
                    })}
                    onClick={() => toggle(e.key)}
                    className={cn('group hover:bg-primary/5 my-0.5 flex w-full min-w-0 items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors', rowCap)}
                  >
                    {iconTile}
                    <span className="min-w-0 flex-1">
                      <span className="text-foreground block truncate text-sm font-semibold leading-5">
                        {t('pages.dashboard.groupSummary', { count: e.items.length, domain: t(it.domainLabelKey) })}
                      </span>
                      <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                        {e.items
                          .slice(0, 3)
                          .map((x) => x.name || (x.nameFallbackKey ? t(x.nameFallbackKey) : ''))
                          .join(', ')}
                        {e.items.length > 3 ? ', …' : ''}
                        {metaInline}
                      </span>
                    </span>
                    {quietVerb}
                    {metaColumn}
                    <ChevronDown
                      className={cn(
                        'text-muted-foreground ml-auto size-4 shrink-0 transition-transform',
                        expanded && 'rotate-180',
                      )}
                      aria-hidden="true"
                    />
                  </button>
                  {expanded && (
                    <ul id={listId} className="mb-1 ml-[2.875rem] border-l pl-2 @2xl:max-w-[51.375rem]">
                      {e.items.map((x) => (
                        <li key={`${x.domainKey}:${x.id}`}>
                          <Link
                            to={x.href}
                            className="hover:bg-primary/5 text-foreground flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors"
                          >
                            <span className="truncate">{x.name || (x.nameFallbackKey ? t(x.nameFallbackKey) : '')}</span>
                            {x.code && <span className="text-muted-foreground shrink-0 font-mono text-xs">{x.code}</span>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <Link
                  to={it.href}
                  // min-w-0: as a grid item this link defaults to min-width:auto and would
                  // otherwise refuse to shrink below the longest word in the meta line.
                  className={cn('group hover:bg-primary/5 my-0.5 flex min-w-0 items-center gap-3 rounded-lg px-2.5 py-2 transition-colors', rowCap)}
                >
                  {iconTile}
                  <span className="min-w-0 flex-1">
                    <span className="text-foreground block truncate text-sm font-semibold leading-5">
                      {it.name || (it.nameFallbackKey ? t(it.nameFallbackKey) : '')}
                      {it.code && <span className="text-muted-foreground ml-1.5 font-mono text-xs font-medium">{it.code}</span>}
                    </span>
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      <span className="text-foreground/80 font-medium">{t(it.domainLabelKey)}</span>
                      {metaInline}
                    </span>
                  </span>
                  {quietVerb}
                  {metaColumn}
                  <ChevronRight className="text-muted-foreground/50 group-hover:text-primary ml-auto size-4 shrink-0 opacity-0 transition group-hover:opacity-100" />
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StreamSkeleton() {
  const { t } = useI18n();
  return (
    <div className="space-y-2" role="status" aria-label={t('pages.dashboard.loadingActivity')}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2.5 py-2">
          <Skeleton className="size-7 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

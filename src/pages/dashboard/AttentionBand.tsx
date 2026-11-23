import { Link } from 'react-router-dom';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Skeleton } from '../../components/ui/skeleton';
import { useI18n } from '../../hooks/useI18n';
import type { TKey } from '../../i18n/types';

export type AttentionTone = 'destructive' | 'warning' | 'info';

export interface AttentionItem {
  key: string;
  /** Plural-aware label, rendered with `{ count }`; the number itself is drawn separately. */
  labelKey: TKey;
  /** The area this counter checks, named in the all-clear line ("checked licenses, …"). */
  areaKey: TKey;
  /** null while unknown — loading, or the check failed. */
  count: number | null;
  failed: boolean;
  /** The list this count describes, pre-filtered (see useHandoffParam). */
  href: string;
  tone: AttentionTone;
}

interface AttentionBandProps {
  /** Only the counters this user may read; empty means the band is not drawn at all. */
  items: AttentionItem[];
  loading: boolean;
}

// The tone lives on the box, never on the figure. As text on their own 5-10% tint, amber
// measures ~3:1 and red 4.2:1 light / 2.9:1 dark, all under 4.5:1 (an 18px semibold
// figure is not "large" text). So the figure stays Ink and the tinted box and border carry the
// state, while the label beside the figure keeps it from depending on colour alone.
// The failed-check icon is Ink too: amber on the amber tint is 2.77:1 in light, under 3:1.
const TONE: Record<AttentionTone, string> = {
  destructive: 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10',
  warning: 'border-warning/40 bg-warning/10 hover:bg-warning/15',
  info: 'border-info/30 bg-info/5 hover:bg-info/10',
};

/**
 * What needs someone today, above everything else on the Dashboard. Only counters that are not
 * zero are drawn, in severity order; when every check came back zero the band collapses to one
 * line that names what was checked — so "all clear" never claims more than it looked at. A check
 * that failed is drawn as unknown, and suppresses the all-clear line: a failure is not a zero.
 */
export function AttentionBand({ items, loading }: AttentionBandProps) {
  const { t } = useI18n();
  if (items.length === 0) return null;

  if (loading && items.every((i) => i.count === null && !i.failed)) {
    return (
      <div role="status" aria-label={t('pages.dashboard.attentionLoading')}>
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
    );
  }

  const shown = items.filter((i) => i.failed || (i.count ?? 0) > 0);

  if (shown.length === 0) {
    const areas = items.map((i) => t(i.areaKey)).filter((a, i, all) => all.indexOf(a) === i).join(', ');
    return (
      <section
        aria-label={t('pages.dashboard.attentionAria')}
        className="text-muted-foreground flex min-h-11 items-center gap-2 rounded-lg border px-3.5 text-sm"
      >
        <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0">
          <span className="text-foreground font-medium">{t('pages.dashboard.attentionClear')}</span>
          <span> · {t('pages.dashboard.attentionChecked', { areas })}</span>
        </span>
      </section>
    );
  }

  return (
    <section aria-label={t('pages.dashboard.attentionAria')}>
      <ul className="flex flex-wrap gap-2">
        {shown.map((item) => {
          const tone = TONE[item.failed ? 'warning' : item.tone];
          return (
            <li key={item.key}>
              <Link
                to={item.href}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2.5 rounded-lg border px-3.5 py-1.5 text-sm transition-colors',
                  tone,
                )}
              >
                {item.failed ? (
                  <TriangleAlert className="text-foreground size-4 shrink-0" aria-hidden="true" />
                ) : (
                  <span className="text-foreground font-mono text-lg leading-none font-semibold tabular-nums">
                    {item.count}
                  </span>
                )}
                <span className="text-foreground">
                  {t(item.labelKey, { count: item.failed ? 2 : (item.count ?? 0) })}
                  {item.failed && (
                    <span className="text-muted-foreground"> · {t('pages.dashboard.attentionUnchecked')}</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// src/pages/tenantSeed/SeedFleetSummary.tsx
import React from 'react';
import { Card } from '../../components/ui/card';
import { cn } from '../../lib/utils';
import { useI18n } from '../../hooks/useI18n';
import type { SeedFleetCounts } from './seedRowState';

interface SeedFleetSummaryProps {
  counts: SeedFleetCounts;
  /** BUs that have a DB — the ones Check all can answer for. */
  checkable: number;
  actions: React.ReactNode;
}

function Legend({ color, label, value, emphasis = false }: { color: string; label: string; value: number; emphasis?: boolean }) {
  return (
    <span className="text-muted-foreground flex items-center gap-2 text-xs">
      <span className="size-2 rounded-full" style={{ background: color }} />
      {label}
      <span
        className={cn(
          'font-mono font-semibold tabular-nums',
          emphasis ? 'text-warning-ink text-[15px]' : 'text-foreground text-[13px]',
        )}
      >
        {value}
      </span>
    </span>
  );
}

/** Fleet-wide tenant seed state: how many tenant DBs are fully seeded / missing rows / errored. */
export function SeedFleetSummary({ counts, checkable, actions }: SeedFleetSummaryProps) {
  const { t } = useI18n();
  const checked = counts.seeded + counts.missing + counts.error > 0;
  const pct = (n: number) => (checkable > 0 ? (n / checkable) * 100 : 0);

  return (
    <Card className="@container p-4 sm:p-5">
      {/* เหมือน FleetSync ของ /tenant-migrations: ตัดสินจากความกว้างของการ์ด — แคบ = ซ้อนกัน ·
          @xl = ตัวเลข|แถบ ปุ่มแถวล่าง · @4xl = สามช่องแถวเดียว ปุ่มเรียงแนวนอน */}
      <div className="grid items-center gap-x-6 gap-y-4 @xl:grid-cols-[auto_1fr] @4xl:grid-cols-[auto_1fr_auto]">
        <div className="border-border @xl:border-r @xl:pr-6">
          <div className="font-mono text-3xl font-semibold tabular-nums tracking-tight">
            {checked ? counts.seeded : '-'}
            <span className="text-muted-foreground text-base font-medium"> / {checkable}</span>
          </div>
          <div className="text-muted-foreground mt-1 text-[11px] font-medium uppercase tracking-[0.12em]">
            {t('pages.tenantSeed.tenantsSeeded')}
          </div>
        </div>

        <div className="min-w-0">
          <div
            className="bg-muted flex h-3 overflow-hidden rounded-full"
            role="img"
            aria-label={
              checked
                ? t('pages.tenantSeed.chartAria', { seeded: counts.seeded, missing: counts.missing, errored: counts.error })
                : t('pages.tenantSeed.notCheckedAria')
            }
          >
            <span className="bg-success" style={{ width: `${pct(counts.seeded)}%` }} />
            <span className="bg-warning" style={{ width: `${pct(counts.missing)}%` }} />
            <span className="bg-destructive" style={{ width: `${pct(counts.error)}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            {checked ? (
              <>
                <Legend color="hsl(var(--success))" label={t('pages.tenantSeed.legendSeeded')} value={counts.seeded} />
                <Legend
                  color="hsl(var(--warning))"
                  label={t('pages.tenantSeed.legendMissing')}
                  value={counts.missing}
                  emphasis={counts.missing > 0}
                />
                {counts.error > 0 && (
                  <Legend color="hsl(var(--destructive))" label={t('pages.tenantSeed.legendError')} value={counts.error} />
                )}
                {counts.missingRows > 0 && (
                  <span className="text-muted-foreground flex items-baseline gap-1.5 text-xs">
                    ·
                    <span className="text-warning-ink font-mono text-[13px] font-semibold tabular-nums">{counts.missingRows}</span>
                    {t('pages.tenantSeed.missingRows')}
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground text-xs">{t('pages.tenantSeed.notCheckedYet')}</span>
            )}
            {counts.no_db > 0 && (
              <Legend color="hsl(var(--muted-foreground))" label={t('pages.tenantSeed.legendNoDb')} value={counts.no_db} />
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 @xl:col-span-2 @4xl:col-span-1">{actions}</div>
      </div>
    </Card>
  );
}

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { FetchErrorState } from '../../components/FetchErrorState';
import { Skeleton } from '../../components/ui/skeleton';
import { useI18n } from '../../hooks/useI18n';
import type { LicenseIntakeBuLicenses } from '../../types';
import { periodOf } from './format';

interface RowProps {
  title: React.ReactNode;
  sub?: React.ReactNode;
  start?: string;
  end?: string;
  state?: string;
  overlaps?: boolean;
}

const LicenseRow: React.FC<RowProps> = ({ title, sub, start, end, state, overlaps }) => {
  const { t } = useI18n();
  return (
    <li
      className={
        overlaps
          ? 'flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/60 bg-warning/10 px-3 py-2 text-sm'
          : 'flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm'
      }
    >
      <span className="flex min-w-0 flex-col gap-1">
        <span className="font-mono">{title}</span>
        {sub}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{periodOf(start, end)}</span>
        {state && <Badge variant="outline">{state}</Badge>}
        {overlaps && <Badge variant="warning">{t('pages.licenseIntakes.overlapFlag')}</Badge>}
      </span>
    </li>
  );
};

const Section: React.FC<{ heading: string; empty: string; count: number; children: React.ReactNode }> = ({
  heading,
  empty,
  count,
  children,
}) => (
  <div className="space-y-2">
    <h3 className="text-sm font-medium">{heading}</h3>
    {count === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : <ul className="space-y-2">{children}</ul>}
  </div>
);

interface IntakeOverlapPanelProps {
  buName: string;
  data: LicenseIntakeBuLicenses | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
}

/** ใบสิทธิ์ที่ BU ที่เลือกมีอยู่แล้ว — แถวที่ซ้อนช่วงเวลากับใบขายถูกติดธง */
const IntakeOverlapPanel: React.FC<IntakeOverlapPanelProps> = ({ buName, data, loading, error, onRetry }) => {
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="space-y-2" aria-label={t('pages.licenseIntakes.overlapLoadingAria')}>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }
  if (error) {
    return (
      <FetchErrorState
        message={t('pages.licenseIntakes.overlapLoadFailed', { detail: error })}
        onRetry={onRetry}
        className="justify-start"
      />
    );
  }
  if (!data) return null;

  const seats = data.seats ?? [];
  const subs = data.subscriptions ?? [];
  const ifaces = data.interfaces ?? [];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">{t('pages.licenseIntakes.overlapTitle', { name: buName })}</h3>
      {data.any_overlap && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-warning/60 bg-warning/10 p-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t('pages.licenseIntakes.overlapWarning')}</span>
        </div>
      )}
      <Section heading={t('pages.licenseIntakes.overlapSeats')} empty={t('pages.licenseIntakes.overlapNone')} count={seats.length}>
        {seats.map((s) => (
          <LicenseRow
            key={s.id}
            title={s.number || s.id}
            sub={
              s.licensed_users != null && (
                <span className="text-xs text-muted-foreground">
                  {t('pages.licenseIntakes.overlapSeatCount', { count: s.licensed_users })}
                </span>
              )
            }
            start={s.start_date}
            end={s.end_date}
            state={s.state}
            overlaps={s.overlaps}
          />
        ))}
      </Section>
      <Section heading={t('pages.licenseIntakes.overlapSubscriptions')} empty={t('pages.licenseIntakes.overlapNone')} count={subs.length}>
        {subs.map((s) => (
          <LicenseRow
            key={s.id}
            title={s.number || s.id}
            sub={
              s.groups && s.groups.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {s.groups.map((g) => (
                    <Badge key={g.code} variant="outline" className="font-normal" title={g.code}>
                      {g.name || g.code}
                    </Badge>
                  ))}
                </span>
              ) : undefined
            }
            start={s.start_date}
            end={s.end_date}
            state={s.state}
            overlaps={s.overlaps}
          />
        ))}
      </Section>
      <Section heading={t('pages.licenseIntakes.overlapInterfaces')} empty={t('pages.licenseIntakes.overlapNone')} count={ifaces.length}>
        {ifaces.map((i) => (
          <LicenseRow
            key={i.id}
            title={i.number || i.id}
            sub={
              i.group && (
                <Badge variant="outline" className="w-fit font-normal" title={i.group.code}>
                  {i.group.name || i.group.code}
                </Badge>
              )
            }
            start={i.start_date}
            end={i.end_date}
            state={i.state}
            overlaps={i.overlaps}
          />
        ))}
      </Section>
    </div>
  );
};

export default IntakeOverlapPanel;

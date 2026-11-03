import type { ReactNode } from 'react';
import { Card } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { cn } from '../../lib/utils';
import { useI18n } from '../../hooks/useI18n';
import { useExpiryThresholds } from '../../context/ExpiryThresholdContext';
import { sumActiveLicenses, licenseStatus } from '../../utils/buLicense';
import { formatBytes, usedPct } from '../../utils/storageQuota';
import { daysLeft, fmtDate, isPerpetual } from '../licenses/licenseDates';
import type { BusinessUnitLicense, BuStorageQuotaView, InterfaceLicense, StorageKind } from '../../types';

/** id ของแต่ละส่วนบนแท็บ — ช่องในแถบกดแล้วเลื่อนไปหา · ผู้เรียกห่อ slot ด้วย id เดียวกันนี้ */
export const LICENSE_SECTION_IDS = {
  seats: 'bu-licenses-seats',
  interfaces: 'bu-licenses-interfaces',
  storage: 'bu-licenses-storage',
} as const;

type Tone = 'default' | 'warning' | 'destructive';

const DAY_MS = 24 * 60 * 60 * 1000;

const toneText = (tone: Tone) =>
  tone === 'destructive' ? 'text-destructive' : tone === 'warning' ? 'text-warning' : 'text-muted-foreground';
const toneBar = (tone: Tone) =>
  tone === 'destructive' ? 'bg-destructive' : tone === 'warning' ? 'bg-warning' : 'bg-primary';

interface CellProps {
  target: string;
  label: string;
  loading: boolean;
  value?: ReactNode;
  unit?: ReactNode;
  /** 0–100 · ไม่ส่ง = ไม่มีแถบ (เช่น interface ไม่มีเพดาน) */
  meterPct?: number;
  status?: ReactNode;
  tone?: Tone;
}

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

/**
 * ช่องหนึ่งของแถบ — เป็น <button> ไม่ใช่ลิงก์ hash: URL ของหน้านี้ถือ `?tab=` อยู่ และ hash ที่
 * ไม่ตรง route จะทำให้ปุ่ม back ของเบราว์เซอร์ต้องกดสองครั้ง
 */
function Cell({ target, label, loading, value, unit, meterPct, status, tone = 'default' }: CellProps) {
  return (
    <button
      type="button"
      onClick={() => scrollToSection(target)}
      className="group flex min-w-0 flex-col gap-1.5 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
    >
      <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-[0.1em]">{label}</span>
      {loading ? (
        <>
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-3 w-32" />
        </>
      ) : (
        <>
          <span className="flex flex-wrap items-baseline gap-x-1.5">
            <span className={cn('font-mono text-2xl font-semibold tabular-nums tracking-tight', tone === 'destructive' && 'text-destructive')}>
              {value}
            </span>
            {unit && <span className="text-muted-foreground text-xs">{unit}</span>}
          </span>
          {meterPct !== undefined && (
            <span className="bg-muted block h-1.5 overflow-hidden rounded-full" aria-hidden="true">
              <span className={cn('block h-full', toneBar(tone))} style={{ width: `${Math.min(100, Math.max(0, meterPct))}%` }} />
            </span>
          )}
          {status && <span className={cn('text-xs', toneText(tone))}>{status}</span>}
        </>
      )}
    </button>
  );
}

interface LicenseSummaryStripProps {
  seatLicenses: BusinessUnitLicense[];
  seatsLoading: boolean;
  clusterSeat?: { used: number; cap: number };
  interfaceLicenses: InterfaceLicense[];
  interfacesLoading: boolean;
  /**
   * `undefined` = ผู้ใช้ไม่มี `storage_quota.read` → ไม่มีช่อง storage (แถบเหลือ 2 ช่อง)
   * `null` = มีสิทธิ์แต่ยังโหลดไม่เสร็จหรือโหลดล้ม → ช่องขึ้น skeleton / ขีด
   */
  storage?: { view: BuStorageQuotaView | null; loading: boolean };
  now?: Date;
}

/**
 * แถบสรุปบนหัวแท็บ Licenses — ตอบ "BU นี้ใช้สิทธิ์อะไรได้ เหลือเท่าไร หมดเมื่อไร" ในที่เดียว
 * ทุกช่องคำนวณจากข้อมูลที่หน้านี้โหลดอยู่แล้วของ BU เดียว (ชุดจำกัด) ไม่ใช่ rollup ทั้ง registry
 * จึงไม่ขัดกับ `agent-os/standards/pages/summary-band.md`
 * ตัวเลขใหญ่มีที่นี่ที่เดียว — การ์ดด้านล่างเป็นรายละเอียด
 */
export function LicenseSummaryStrip({
  seatLicenses,
  seatsLoading,
  clusterSeat,
  interfaceLicenses,
  interfacesLoading,
  storage,
  now = new Date(),
}: LicenseSummaryStripProps) {
  const { t } = useI18n();
  const { thresholds } = useExpiryThresholds();

  const endsText = (end: string | null): string => {
    if (!end) return t('pages.businessUnits.licStripNoneInForce');
    if (isPerpetual(end)) return t('common.state.noExpiry');
    return `${t('pages.businessUnits.licStripEnds', { date: fmtDate(end) })} · ${t('common.state.daysLeft', { count: daysLeft(end, now) })}`;
  };
  const earliest = (ends: string[]): string | null =>
    ends.length === 0 ? null : ends.reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b));
  const endTone = (end: string | null, days: number): Tone =>
    end && !isPerpetual(end) && Date.parse(end) - now.getTime() <= days * DAY_MS ? 'warning' : 'default';

  // ── Seats ──────────────────────────────────────────────────────────────
  const activeSeatLicenses = seatLicenses.filter((l) => licenseStatus(l, now) === 'active');
  const seats = sumActiveLicenses(seatLicenses, now);
  const seatEnd = earliest(activeSeatLicenses.map((l) => l.end_date));
  const poolOver = clusterSeat ? clusterSeat.used > clusterSeat.cap : false;
  const poolPct = clusterSeat && clusterSeat.cap > 0 ? (clusterSeat.used / clusterSeat.cap) * 100 : undefined;
  const seatTone: Tone = poolOver ? 'destructive' : activeSeatLicenses.length === 0 ? 'warning' : endTone(seatEnd, thresholds.seat_days);

  // ── Interfaces — สถานะมาจาก backend (`in_force`) ห้ามคำนวณจากวันที่เอง ──────────
  const inForce = interfaceLicenses.filter((l) => l.in_force);
  const ifEnd = earliest(inForce.map((l) => l.end_date));
  const ifTone: Tone = endTone(ifEnd, thresholds.interface_days);

  // ── Storage — ช่องเดียวสรุปด้วย kind ที่เต็มที่สุด ────────────────────────────
  const kinds = storage?.view?.usage.kinds ?? [];
  const fullest = kinds.length === 0 ? null : kinds.reduce((a, b) => (usedPct(a) >= usedPct(b) ? a : b));
  const fullestPct = fullest ? usedPct(fullest) : 0;
  const blocked = kinds.some((k) => k.blocking);
  const storageTone: Tone = blocked || fullestPct >= 100 ? 'destructive' : fullestPct >= 80 ? 'warning' : 'default';
  const kindLabel = (k: StorageKind) =>
    t(k === 'database' ? 'pages.storageQuota.database' : 'pages.storageQuota.attachment');

  return (
    <Card className="gap-0 p-0">
      <div className={cn('grid divide-y sm:divide-x sm:divide-y-0', storage ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
        <Cell
          target={LICENSE_SECTION_IDS.seats}
          label={t('pages.businessUnits.licStripSeats')}
          loading={seatsLoading}
          value={seats}
          unit={t('pages.businessUnits.licStripSeatUnit')}
          meterPct={poolPct}
          tone={seatTone}
          status={
            <>
              {clusterSeat && (
                <span className="block">
                  {t('pages.businessUnits.clusterPoolSeatsUsed', { used: clusterSeat.used, cap: clusterSeat.cap })}
                </span>
              )}
              <span className="block">{endsText(seatEnd)}</span>
            </>
          }
        />
        <Cell
          target={LICENSE_SECTION_IDS.interfaces}
          label={t('pages.businessUnits.licStripInterfaces')}
          loading={interfacesLoading}
          value={inForce.length}
          unit={
            interfaceLicenses.length > 0
              ? t('pages.businessUnits.licStripOfTotalInForce', { total: interfaceLicenses.length })
              : undefined
          }
          tone={ifTone}
          status={interfaceLicenses.length === 0 ? t('pages.businessUnits.licStripNoneIssued') : endsText(ifEnd)}
        />
        {storage && (
          <Cell
            target={LICENSE_SECTION_IDS.storage}
            label={t('pages.storageQuota.cardTitle')}
            loading={storage.loading}
            value={fullest ? `${fullestPct.toFixed(1)}%` : '—'}
            unit={fullest ? t('pages.businessUnits.licStripOfQuota') : undefined}
            meterPct={fullest ? fullestPct : undefined}
            tone={storageTone}
            status={
              blocked
                ? t('pages.storageQuota.blocking')
                : fullest
                  ? `${kindLabel(fullest.kind)}: ${formatBytes(fullest.used_bytes)} / ${formatBytes(fullest.quota_bytes)}`
                  : t('pages.storageQuota.notMeasured')
            }
          />
        )}
      </div>
    </Card>
  );
}

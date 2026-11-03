import { cn } from '../../../lib/utils';
import { Badge } from '../../../components/ui/badge';
import { useI18n } from '../../../hooks/useI18n';
import { formatBytes, usedPct } from '../../../utils/storageQuota';
import type { StorageKindUsage } from '../../../types';

interface StorageMeterProps {
  label: string;
  usage: StorageKindUsage | undefined;
  /** ปิดเมื่อผู้เรียกพิมพ์เวลาวัดรวมไว้ที่หัวการ์ดแล้ว (ทุก kind วัดเวลาเดียวกัน) — ไม่งั้นบรรทัดซ้ำทุกแถบ */
  showMeasuredAt?: boolean;
}

/** `shared_schema` / `null_schema` / `measure_failed` → ป้ายอธิบายสั้น ๆ */
export function StorageFlagBadge({ flag }: { flag: string | null }) {
  const { t } = useI18n();
  if (!flag) return null;
  const label =
    flag === 'shared_schema'
      ? t('pages.storageQuota.flagShared')
      : flag === 'null_schema'
        ? t('pages.storageQuota.flagNull')
        : flag === 'measure_failed'
          ? t('pages.storageQuota.flagFailed')
          : flag;
  return <Badge variant="warning">{label}</Badge>;
}

/**
 * แถบโควตาของหนึ่ง kind — ใช้ไป / โควตา / % · เกิน 100% แถบเต็มสีแดง ส่วน % จริงอยู่ในตัวเลข
 * แถบเป็นของแถม (aria-hidden) ตัวเลขเป็นตัวหลักเหมือน SeatMeter
 */
export function StorageMeter({ label, usage, showMeasuredAt = true }: StorageMeterProps) {
  const { t } = useI18n();
  if (!usage) {
    return (
      <div className="space-y-1">
        <div className="text-sm font-medium">{label}</div>
        <p className="text-muted-foreground text-xs">{t('pages.storageQuota.notMeasured')}</p>
      </div>
    );
  }
  const pct = usedPct(usage);
  const over = pct >= 100;
  const near = pct >= 80;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        <StorageFlagBadge flag={usage.flag} />
        {usage.blocking && <Badge variant="destructive">{t('pages.storageQuota.blocking')}</Badge>}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2 font-mono tabular-nums">
        <span className={cn('text-base font-semibold', over && 'text-destructive')}>{formatBytes(usage.used_bytes)}</span>
        <span className="text-muted-foreground text-sm">/ {formatBytes(usage.quota_bytes)}</span>
        <span className={cn('text-sm', over ? 'text-destructive font-semibold' : 'text-muted-foreground')}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full" aria-hidden="true">
        <div
          className={cn('h-full', over ? 'bg-destructive' : near ? 'bg-warning' : 'bg-primary')}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className="text-muted-foreground space-y-0.5 text-xs empty:hidden">
        {usage.exceeded_at && (
          <p>{t('pages.storageQuota.exceededAt', { date: new Date(usage.exceeded_at).toLocaleString() })}</p>
        )}
        {usage.grace_ends_at && (
          <p>{t('pages.storageQuota.graceEndsAt', { date: new Date(usage.grace_ends_at).toLocaleString() })}</p>
        )}
        {showMeasuredAt && (
          <p>{t('pages.storageQuota.measuredAt', { date: new Date(usage.measured_at).toLocaleString() })}</p>
        )}
      </div>
    </div>
  );
}

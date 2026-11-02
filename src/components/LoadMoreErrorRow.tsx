import React from 'react';
import { cn } from '../lib/utils';
import { useI18n } from '../hooks/useI18n';

/**
 * แถวท้าย dropdown ของ picker เมื่อโหลดหน้าถัดไปพัง — แถวที่โหลดแล้วยังแสดงอยู่ข้างบน
 * ปุ่ม Retry เรียก `loadMore` ซ้ำ (usePagedSearch คง `hasMore` ไว้ให้)
 */
export const LoadMoreErrorRow: React.FC<{ message: string; onRetry: () => void; className?: string }> = ({
  message, onRetry, className,
}) => {
  const { t } = useI18n();
  return (
    <div role="presentation" className={cn('flex items-center justify-between gap-2 border-t px-3 py-2 text-xs text-destructive', className)}>
      <span className="min-w-0 truncate" aria-live="polite">{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded font-medium underline-offset-2 hover:underline"
      >
        {t('common.action.retry')}
      </button>
    </div>
  );
};

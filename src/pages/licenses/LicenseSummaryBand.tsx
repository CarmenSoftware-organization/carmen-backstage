import React from 'react';
import { Archive, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { cn } from '../../lib/utils';
import { FetchErrorState } from '../../components/FetchErrorState';

export interface SummaryBandItem {
  key: string;
  label: string;
  value: number | undefined;
  /** คลาสสีของตัวเลข เช่น `text-success` */
  color: string;
  /** ไม่ส่ง = การ์ดอ่านอย่างเดียว */
  onClick?: () => void;
  active?: boolean;
  /** กดไม่ได้ชั่วคราว — ต้องมี `disabledHint` บอกเหตุผลเสมอ ไม่ใช่กดแล้วเงียบ */
  disabled?: boolean;
  disabledHint?: string;
  /**
   * `view` = การ์ดนี้พาไป "มุมมองอื่น" (ใบที่ลบแล้ว) ไม่ใช่ตัวกรองของตารางเดิม — วาดไอคอน
   * Archive หน้าป้ายและลูกศรท้ายป้ายให้ต่างจากการ์ดกรองที่หน้าตาเหมือนกันหมด
   */
  variant?: 'filter' | 'view';
}

interface LicenseSummaryBandProps {
  items: SummaryBandItem[];
  loading: boolean;
  error: string;
  onRetry: () => void;
}

/**
 * แถบตัวเลขสรุปเหนือตารางใบทุกแท็บของ License Center (สัญญา · ที่นั่ง · โควตา BU · interface)
 * ใช้ร่วมกันเพื่อให้ทั้งห้าแท็บพูดภาษาเดียวกัน: การ์ดกรองกดแล้วกรองตารางด้านล่าง การ์ด "ลบแล้ว"
 * กดแล้วสลับไปมุมมองใบที่ลบ (superadmin) — แทนปุ่ม "Show deleted" ที่เคยลอยอยู่แถวของมันเอง
 *
 * ตัวเลขที่ป้อนเข้ามาต้องไม่ผ่านตัวกรองของตาราง (ดูเหตุผลใน doc ของ `SubscriptionSummary`)
 */
export const LicenseSummaryBand: React.FC<LicenseSummaryBandProps> = ({ items, loading, error, onRetry }) => {
  if (error) {
    return (
      <Card>
        <CardContent className="p-0">
          <FetchErrorState message={error} onRetry={onRetry} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-wrap divide-x divide-border">
          {items.map(({ key, label, value, color, onClick, active, disabled, disabledHint, variant }) => {
            const isView = variant === 'view';
            const clickable = !!onClick && !disabled;
            const body = (
              <>
                <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  {isView && <Archive className="h-3.5 w-3.5" aria-hidden />}
                  <span>{label}</span>
                  {isView && clickable && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  {loading && value === undefined ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <span className={cn('text-2xl sm:text-3xl font-bold tracking-tight', color)}>
                      {value ?? 0}
                    </span>
                  )}
                </div>
              </>
            );
            // lg:basis-0 + flex-1 = แบ่งเท่ากันทุกการ์ดในแถวเดียว ไม่ว่าจะมี 4, 5 หรือ 7 ใบ (ใบโควตามี
            // superseded/cancelled เพิ่ม) — basis คงที่แบบเดิม (1/5) ทำให้ 7 ใบล้นขึ้นแถวที่สอง
            const box = 'flex-1 basis-1/2 p-4 text-left sm:basis-1/4 sm:p-6 lg:basis-0';

            if (!clickable) {
              return (
                <div
                  key={key}
                  className={cn(box, active && 'bg-muted', disabled && 'opacity-50')}
                  title={disabled ? disabledHint : undefined}
                >
                  {body}
                </div>
              );
            }
            return (
              <button
                key={key}
                type="button"
                onClick={onClick}
                aria-pressed={active}
                className={cn(
                  box,
                  'transition-colors hover:bg-muted focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
                  active && 'bg-muted',
                )}
              >
                {body}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * สีตัวเลขของการ์ด "ลบแล้ว" — 0 คือสถานะปกติที่สุด จึงจางลง · มีใบที่ลบก็แค่ตัวเลขปกติ ไม่ใช่สีแดง
 * เพราะใบที่ลบไม่ใช่ปัญหาที่ต้องรีบแก้ (เดิมเป็น `text-destructive` ทุกค่าแม้แต่ 0)
 */
export const deletedCountColor = (value: number | undefined): string =>
  value ? 'text-foreground' : 'text-muted-foreground';

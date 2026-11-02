import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RotateCw, Search, X } from 'lucide-react';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { cn } from '../lib/utils';
import { useBusinessUnitSearch, type BusinessUnitOption } from '../hooks/useBusinessUnitSearch';
import { isNearBottom } from '../hooks/usePagedSearch';
import { LoadMoreErrorRow } from './LoadMoreErrorRow';
import { hydrateByKeys, useHydratedOptions } from '../hooks/useHydratedOptions';
import businessUnitService from '../services/businessUnitService';
import type { BusinessUnit } from '../types';
import { useI18n } from '../hooks/useI18n';

interface BusinessUnitMultiSelectProps {
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  /**
   * Which BU field `value`/`onChange` key by. Defaults to `'id'` — the genuine foreign key
   * used by every existing caller (e.g. NewsEdit.tsx's `business_unit_ids`). Pass `'code'`
   * only when the consumer's field is actually a BU *code* (e.g. cronjob job_config's
   * `bu_codes`, which a backend resolves by code, not id) — this only changes which one
   * `value` is compared and written against.
   */
  keyBy?: 'id' | 'code';
  /** Notifies the parent when the results dropdown opens or closes, so a surrounding Dialog can keep Escape from closing it while the dropdown is open. */
  onOpenChange?: (open: boolean) => void;
}

const toOption = (b: BusinessUnit): BusinessUnitOption => ({
  id: b.id,
  code: b.code,
  name: b.name,
  cluster_name: b.cluster_name ?? null,
});

/**
 * Multi-BU picker. Search is server-side (opens a dropdown, 20 per page, infinite scroll);
 * selected values that are not on the loaded page are hydrated by key so their chips still
 * show names. A value that can't be found stays in `value` and renders as a muted chip.
 */
export const BusinessUnitMultiSelect: React.FC<BusinessUnitMultiSelectProps> = ({
  value, onChange, disabled, keyBy = 'id', onOpenChange,
}) => {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [open, setOpenState] = useState(false);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const openRef = useRef(false);
  // จุดเดียวที่สถานะเปิดเปลี่ยน — รายงานเฉพาะเมื่อค่าเปลี่ยนจริง (แบบเดียวกับ ClusterPicker.changeOpen)
  const setOpen = useCallback((next: boolean) => {
    if (openRef.current === next) return;
    openRef.current = next;
    setOpenState(next);
    onOpenChangeRef.current?.(next);
  }, []);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // disabled ขณะ dropdown เปิด (เช่น Ctrl+S ระหว่างเปิด) → dropdown หายไป ต้องรายงานปิด
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled, setOpen]);
  // ถอด component ขณะ dropdown เปิด → ปลดการกัน Escape ของผู้ครอบ
  useEffect(() => () => {
    if (openRef.current) {
      openRef.current = false;
      onOpenChangeRef.current?.(false);
    }
  }, []);

  const keyOf = useCallback(
    (b: BusinessUnitOption) => (keyBy === 'code' ? b.code : b.id),
    [keyBy],
  );

  const {
    results, loading, loadingMore, hasMore, loadMore, error, loadMoreError,
  } = useBusinessUnitSearch(search, open && !disabled);

  // แถวที่ติ๊กจากผลค้นหา — จำไว้เพื่อให้ chip มีชื่อทันทีแม้ผลค้นหาจะเปลี่ยนไปแล้ว (ไม่ต้อง hydrate ซ้ำ)
  const [pickedRows, setPickedRows] = useState<BusinessUnitOption[]>([]);
  const known = useMemo(() => [...pickedRows, ...results], [pickedRows, results]);

  const { byKey, pending, missing, failed, retry: retryHydrate } = useHydratedOptions<BusinessUnitOption>(
    value,
    keyOf,
    (keys) =>
      hydrateByKeys<BusinessUnitOption>(keys, keyBy, async ({ advance, perpage }) => {
        const res = await businessUnitService.getAll({ page: 1, perpage, advance });
        return {
          data: ((res.data || []) as BusinessUnit[]).map(toOption),
          paginate: res.paginate,
        };
      }),
    { known },
  );

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Marks the Escape as handled so page-level shortcuts (useGlobalShortcuts skips
      // defaultPrevented) don't also cancel. A surrounding Radix Dialog dismisses on a
      // capture-phase listener that runs before this one — it guards via onEscapeKeyDown
      // and the onOpenChange prop (see TemplateEditDialog).
      e.preventDefault();
      setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, setOpen]);

  const toggleKey = (key: string, row?: BusinessUnitOption) => {
    if (disabled) return;
    if (value.includes(key)) {
      onChange(value.filter((v) => v !== key));
    } else {
      if (row) setPickedRows((prev) => (prev.some((p) => keyOf(p) === key) ? prev : [...prev, row]));
      onChange([...value, key]);
    }
  };

  const handleListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // หน้าถัดไปพัง → รอปุ่ม Retry ไม่ยิงซ้ำทุกครั้งที่เลื่อน
    if (isNearBottom(e.currentTarget) && hasMore && !loadingMore && !loadMoreError) loadMore();
  };

  const renderChip = (key: string) => {
    const bu = byKey.get(key);
    const isPending = pending.has(key);
    const isMissing = !bu && missing.has(key);
    // โหลดไม่สำเร็จ (เครือข่าย/5xx) ≠ ไม่พบจริง — บอกต่างกันและให้กดลองใหม่ได้
    const isFailed = isMissing && failed.has(key);

    if (isPending && keyBy === 'id') {
      return (
        <Badge key={key} variant="secondary" className="text-xs gap-1 pr-1">
          <Skeleton className="h-3 w-24" />
          {!disabled && (
            <button
              type="button"
              onClick={() => toggleKey(key)}
              className="ml-0.5 hover:text-foreground"
              aria-label={t('common.action.removeAria', { name: key })}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      );
    }

    // ไม่พบ: code แสดงตามเดิม · id ย่อแบบเดียวกับ user (`Not found · <8 ตัวแรก>`) ไม่โชว์ UUID เต็ม
    const missingLabel = t(isFailed ? 'components.businessUnitPicker.loadFailed' : 'components.businessUnitPicker.notFound');
    const label = bu
      ? `${bu.code} - ${bu.name}`
      : isMissing && keyBy === 'id'
        ? `${missingLabel} · ${key.slice(0, 8)}`
        : key;
    return (
      <Badge
        key={key}
        variant="secondary"
        className={cn('text-xs gap-1 pr-1', isMissing && 'text-muted-foreground')}
        title={isMissing ? `${missingLabel} · ${key}` : undefined}
      >
        {label}
        {isFailed && (
          <button
            type="button"
            onClick={retryHydrate}
            className="ml-0.5 hover:text-foreground"
            aria-label={t('common.action.retry')}
            title={t('common.action.retry')}
          >
            <RotateCw className="h-3 w-3" />
          </button>
        )}
        {!disabled && (
          <button
            type="button"
            onClick={() => toggleKey(key)}
            className="ml-0.5 hover:text-foreground"
            aria-label={t('common.action.removeAria', { name: bu?.name ?? key })}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </Badge>
    );
  };

  return (
    <div ref={wrapperRef} className="relative space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.length === 0 ? (
          <span className="text-xs text-muted-foreground">{t('components.businessUnitMultiSelect.noneSelected')}</span>
        ) : (
          value.map(renderChip)
        )}
      </div>

      {!disabled && (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('common.state.searchBusinessUnits')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              className="pl-9"
              aria-label={t('common.state.searchBusinessUnitsAria')}
            />
          </div>

          {open && (
            <div
              onScroll={handleListScroll}
              className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-input bg-popover shadow-md divide-y"
            >
              {loading ? (
                <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('components.businessUnitPicker.searchingEllipsis')}
                </div>
              ) : error ? (
                <p className="px-3 py-4 text-sm text-destructive">{error}</p>
              ) : results.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t('common.state.noBusinessUnitsFound')}</p>
              ) : (
                <>
                  {results.map((bu) => (
                    <label key={bu.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={value.includes(keyOf(bu))}
                        onChange={() => toggleKey(keyOf(bu), bu)}
                        className="h-4 w-4 rounded border-input"
                      />
                      <span className="text-sm">{bu.code} - {bu.name}</span>
                    </label>
                  ))}
                  {loadingMore && (
                    <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('components.businessUnitPicker.loadingMore')}
                    </div>
                  )}
                  {!loadingMore && loadMoreError && (
                    <LoadMoreErrorRow message={loadMoreError} onRetry={loadMore} className="border-t-0" />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

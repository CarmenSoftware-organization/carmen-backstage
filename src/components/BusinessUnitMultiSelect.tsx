import React, { useCallback, useMemo, useState } from 'react';
import { Check, RotateCw, Search, X } from 'lucide-react';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { cn } from '../lib/utils';
import { useBusinessUnitSearch, type BusinessUnitOption } from '../hooks/useBusinessUnitSearch';
import { hydrateByKeys, useHydratedOptions } from '../hooks/useHydratedOptions';
import businessUnitService from '../services/businessUnitService';
import type { BusinessUnit } from '../types';
import { useI18n } from '../hooks/useI18n';
import { useTypeahead } from './typeahead/useTypeahead';
import { TypeaheadAnnouncer, TypeaheadFooter, TypeaheadStatus } from './typeahead/TypeaheadStatus';

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
  const [searchOpen, setSearchOpen] = useState(false);

  const keyOf = useCallback(
    (b: BusinessUnitOption) => (keyBy === 'code' ? b.code : b.id),
    [keyBy],
  );

  const {
    results, loading, loadingMore, hasMore, loadMore, error, loadMoreError,
  } = useBusinessUnitSearch(search, searchOpen && !disabled);

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

  const rows = !loading && !error ? results : [];

  const ta = useTypeahead<BusinessUnitOption>({
    items: rows,
    getKey: (b) => b.id,
    isSelected: (b) => value.includes(keyOf(b)),
    onPick: (b) => toggleKey(keyOf(b), b),
    closeOnPick: false,
    disabled,
    onOpenChange: (o) => { setSearchOpen(o); onOpenChange?.(o); },
    hasMore, loadingMore, loadMoreError: loadMoreError || undefined, loadMore,
  });

  const toggleKey = (key: string, row?: BusinessUnitOption) => {
    if (disabled) return;
    if (value.includes(key)) {
      onChange(value.filter((v) => v !== key));
    } else {
      if (row) setPickedRows((prev) => (prev.some((p) => keyOf(p) === key) ? prev : [...prev, row]));
      onChange([...value, key]);
    }
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
      ? `${bu.name} (${bu.code})`
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

  const statusProps = {
    loading,
    error: error || undefined,
    empty: rows.length === 0,
    searchingLabel: t('components.businessUnitPicker.searchingEllipsis'),
    emptyLabel: t('common.state.noBusinessUnitsFound'),
  };
  const footerProps = {
    loadingMore,
    loadMoreError: loadMoreError || undefined,
    loadingMoreLabel: t('components.businessUnitPicker.loadingMore'),
  };

  return (
    <div {...ta.getWrapperProps({ className: 'relative space-y-2' })}>
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
              {...ta.getInputProps()}
              placeholder={t('common.state.searchBusinessUnits')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); ta.setOpen(true); }}
              className="pl-9"
              aria-label={t('common.state.searchBusinessUnitsAria')}
            />
          </div>

          <TypeaheadAnnouncer open={ta.open} status={statusProps} footer={rows.length > 0 ? footerProps : undefined} />
          {ta.open && (
            <div
              {...ta.listProps}
              aria-multiselectable
              className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-input bg-popover shadow-md divide-y"
            >
              {rows.map((bu, i) => {
                const checked = value.includes(keyOf(bu));
                return (
                  <div
                    key={bu.id}
                    {...ta.getOptionProps(bu, i)}
                    className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 data-[active]:bg-accent data-[active]:text-accent-foreground"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border border-input',
                        checked && 'border-primary bg-primary text-primary-foreground',
                      )}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </span>
                    <span>{bu.name} <span className="font-mono text-xs text-muted-foreground">({bu.code})</span></span>
                  </div>
                );
              })}
              <TypeaheadStatus {...statusProps} />
              {rows.length > 0 && (
                <TypeaheadFooter {...footerProps} onRetry={loadMore} className="border-t-0" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

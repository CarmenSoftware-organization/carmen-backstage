import React, { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useBusinessUnitSearch, type BusinessUnitOption } from '../hooks/useBusinessUnitSearch';
import { useI18n } from '../hooks/useI18n';
import { useTypeahead } from './typeahead/useTypeahead';
import { TypeaheadFooter, TypeaheadStatus } from './typeahead/TypeaheadStatus';

interface BusinessUnitPickerProps {
  value: BusinessUnitOption | null;
  onChange: (next: BusinessUnitOption | null) => void;
  /** BU ที่แนะนำ (ลูกค้าเดียวกับใบขาย) — แสดงเป็นกลุ่มแรก */
  suggested?: BusinessUnitOption[];
  /**
   * เปิดการค้นหา BU ทั้งระบบหรือไม่ — ส่งผลลัพธ์ของ hasPermission('cluster.read')
   * (สิทธิ์ของ GET /api-system/business-units) · false = เลือกได้เฉพาะ `suggested`
   * และไม่ยิง request เลย (request ที่ไม่มีสิทธิ์อาจได้ 401 แล้วเตะผู้ใช้ออก)
   */
  canSearch: boolean;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  /** คืนเหตุผล (ข้อความสั้น) เมื่อแถวนี้ต้องแสดงแต่กดไม่ได้ เช่น "ผูกอยู่แล้ว" · คืน null = เลือกได้ */
  getDisabledReason?: (b: BusinessUnitOption) => string | null;
  /** เปลี่ยนค่าเมื่อต้องการให้ดึงผลค้นหาใหม่ (เช่นหลังผูก BU แล้วสถานะแถวเปลี่ยน) */
  refreshKey?: number;
  /** Reports the dropdown's real open state so a surrounding Dialog/Sheet can guard Escape. */
  onOpenChange?: (open: boolean) => void;
}

const optionLabel = (b: BusinessUnitOption) => `${b.code} · ${b.name}`;

const OptionBody: React.FC<{ b: BusinessUnitOption; disabledReason?: string | null }> = ({ b, disabledReason }) => (
  <>
    <span className="flex min-w-0 flex-col">
      <span className="truncate">{b.name}</span>
      <span className="truncate font-mono text-xs text-muted-foreground">
        {b.code}
        {b.cluster_name ? ` · ${b.cluster_name}` : ''}
      </span>
    </span>
    {disabledReason && <span className="shrink-0 text-xs text-muted-foreground">{disabledReason}</span>}
  </>
);

const optionClass = (disabledReason: string | null | undefined) =>
  cn(
    'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm',
    disabledReason
      ? 'cursor-not-allowed opacity-60'
      : 'hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground',
  );

/**
 * Single-BU typeahead (clone of CustomerPicker) with a "suggested" group on top.
 * Server search is gated by `canSearch`; failures surface inside the dropdown only.
 */
export const BusinessUnitPicker: React.FC<BusinessUnitPickerProps> = ({
  value,
  onChange,
  suggested = [],
  canSearch,
  placeholder,
  disabled = false,
  id,
  ariaLabel,
  getDisabledReason,
  refreshKey,
  onOpenChange,
}) => {
  const { t } = useI18n();
  const effectivePlaceholder = placeholder ?? t('components.businessUnitPicker.defaultPlaceholder');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const {
    results, loading, loadingMore, hasMore, loadMore, refresh, error: searchError, loadMoreError,
  } = useBusinessUnitSearch(query, searchOpen && !disabled && canSearch);

  // ข้ามรอบแรก — ผลค้นหาโหลดเองตอนเปิด dropdown อยู่แล้ว
  const lastRefreshKeyRef = useRef(refreshKey);
  useEffect(() => {
    if (lastRefreshKeyRef.current === refreshKey) return;
    lastRefreshKeyRef.current = refreshKey;
    refresh();
  }, [refreshKey, refresh]);

  const q = query.trim().toLowerCase();
  const suggestedShown = suggested.filter(
    (b) => !q || b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q),
  );
  const suggestedIds = new Set(suggested.map((b) => b.id));
  const otherResults = canSearch && !loading && !searchError ? results.filter((b) => !suggestedIds.has(b.id)) : [];
  const rows = [...suggestedShown, ...otherResults];
  const nothing = rows.length === 0;

  const ta = useTypeahead<BusinessUnitOption>({
    items: rows,
    getKey: (b) => b.id,
    isDisabled: (b) => !!getDisabledReason?.(b),
    onPick: (b) => {
      onChange(b);
      setQuery('');
    },
    disabled,
    hidden: !!value,
    onOpenChange: (o) => { setSearchOpen(o); onOpenChange?.(o); },
    hasMore, loadingMore, loadMoreError: loadMoreError || undefined, loadMore,
  });

  const clearSelection = () => {
    onChange(null);
    setQuery('');
    ta.requestFocus();
  };

  if (value) {
    return (
      <div
        className={cn(
          'flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs',
          disabled && 'bg-muted/50',
        )}
      >
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{value.name}</span>
          <span className="truncate font-mono text-xs text-muted-foreground">
            {value.code}
            {value.cluster_name ? ` · ${value.cluster_name}` : ''}
          </span>
        </span>
        {!disabled && (
          <button
            type="button"
            onClick={clearSelection}
            className="shrink-0 rounded hover:text-destructive"
            aria-label={t('components.businessUnitPicker.clearSelectedAria', { name: optionLabel(value) })}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  const offset = suggestedShown.length;

  return (
    <div {...ta.getWrapperProps({ className: 'relative' })}>
      <div
        className={cn(
          'flex min-h-9 w-full items-center gap-1 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-xs focus-within:outline-hidden focus-within:ring-1 focus-within:ring-ring',
          disabled && 'bg-muted/50 cursor-not-allowed',
        )}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          {...ta.getInputProps()}
          id={id}
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            ta.setOpen(true);
          }}
          placeholder={effectivePlaceholder}
          aria-label={ariaLabel}
          className="min-w-0 flex-1 bg-transparent outline-hidden placeholder:text-muted-foreground"
        />
      </div>

      {ta.open && (
        <div
          {...ta.listProps}
          className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-input bg-popover shadow-md"
        >
          {suggestedShown.length > 0 && (
            <div role="presentation" className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">
              {t('components.businessUnitPicker.suggestedHeading')}
            </div>
          )}
          {suggestedShown.map((b, i) => {
            const reason = getDisabledReason?.(b);
            return (
              <button type="button" key={b.id} {...ta.getOptionProps(b, i)} className={optionClass(reason)}>
                <OptionBody b={b} disabledReason={reason} />
              </button>
            );
          })}
          {otherResults.length > 0 && suggestedShown.length > 0 && (
            <div role="presentation" className="border-t px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">
              {t('components.businessUnitPicker.allHeading')}
            </div>
          )}
          {otherResults.map((b, i) => {
            const reason = getDisabledReason?.(b);
            return (
              <button type="button" key={b.id} {...ta.getOptionProps(b, offset + i)} className={optionClass(reason)}>
                <OptionBody b={b} disabledReason={reason} />
              </button>
            );
          })}
          <TypeaheadStatus
            loading={canSearch && loading}
            error={canSearch ? (searchError || undefined) : undefined}
            empty={nothing}
            searchingLabel={t('components.businessUnitPicker.searchingEllipsis')}
            emptyLabel={
              !canSearch
                ? t('components.businessUnitPicker.noSuggested')
                : query
                  ? t('components.businessUnitPicker.noMatch', { query })
                  : t('components.businessUnitPicker.typeToSearch')
            }
          />
          {otherResults.length > 0 && (
            <TypeaheadFooter
              loadingMore={loadingMore}
              loadMoreError={loadMoreError || undefined}
              onRetry={loadMore}
              loadingMoreLabel={t('components.businessUnitPicker.loadingMore')}
            />
          )}
        </div>
      )}
    </div>
  );
};

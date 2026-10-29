import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useBusinessUnitSearch, type BusinessUnitOption } from '../hooks/useBusinessUnitSearch';
import { useI18n } from '../hooks/useI18n';

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
}

const optionLabel = (b: BusinessUnitOption) => `${b.code} · ${b.name}`;

const OptionButton: React.FC<{ b: BusinessUnitOption; onPick: (b: BusinessUnitOption) => void }> = ({ b, onPick }) => (
  <button
    type="button"
    onClick={() => onPick(b)}
    className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
  >
    <span className="flex min-w-0 flex-col">
      <span className="truncate">{b.name}</span>
      <span className="truncate font-mono text-xs text-muted-foreground">
        {b.code}
        {b.cluster_name ? ` · ${b.cluster_name}` : ''}
      </span>
    </span>
  </button>
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
}) => {
  const { t } = useI18n();
  const effectivePlaceholder = placeholder ?? t('components.businessUnitPicker.defaultPlaceholder');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const changeOpen = useCallback((next: boolean) => setOpen(next), []);

  const { results, loading, error: searchError } = useBusinessUnitSearch(query, open && !disabled && canSearch);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) changeOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, changeOpen]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') changeOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, changeOpen]);

  const select = (b: BusinessUnitOption) => {
    onChange(b);
    setQuery('');
    changeOpen(false);
  };

  const clearSelection = () => {
    onChange(null);
    setQuery('');
    inputRef.current?.focus();
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
          <span className="truncate font-mono text-xs text-muted-foreground">{value.code}</span>
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

  const q = query.trim().toLowerCase();
  const suggestedShown = suggested.filter(
    (b) => !q || b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q),
  );
  const suggestedIds = new Set(suggested.map((b) => b.id));
  const otherResults = results.filter((b) => !suggestedIds.has(b.id));
  const nothing = suggestedShown.length === 0 && otherResults.length === 0;

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className={cn(
          'flex min-h-9 w-full items-center gap-1 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-xs focus-within:outline-hidden focus-within:ring-1 focus-within:ring-ring',
          disabled && 'bg-muted/50 cursor-not-allowed',
        )}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            changeOpen(true);
          }}
          onFocus={() => changeOpen(true)}
          placeholder={effectivePlaceholder}
          aria-label={ariaLabel}
          className="flex-1 bg-transparent outline-hidden placeholder:text-muted-foreground"
        />
      </div>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-input bg-popover shadow-md">
          {suggestedShown.length > 0 && (
            <div>
              <div className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                {t('components.businessUnitPicker.suggestedHeading')}
              </div>
              <ul className="pb-1">
                {suggestedShown.map((b) => (
                  <li key={b.id}>
                    <OptionButton b={b} onPick={select} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {canSearch && loading && (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('components.businessUnitPicker.searchingEllipsis')}
            </div>
          )}
          {canSearch && !loading && searchError && (
            <div className="px-3 py-4 text-sm text-destructive">{searchError}</div>
          )}
          {canSearch && !loading && !searchError && otherResults.length > 0 && (
            <div>
              {suggestedShown.length > 0 && (
                <div className="border-t px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                  {t('components.businessUnitPicker.allHeading')}
                </div>
              )}
              <ul className="py-1">
                {otherResults.map((b) => (
                  <li key={b.id}>
                    <OptionButton b={b} onPick={select} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!loading && !searchError && nothing && (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              {!canSearch
                ? t('components.businessUnitPicker.noSuggested')
                : query
                  ? t('components.businessUnitPicker.noMatch', { query })
                  : t('components.businessUnitPicker.typeToSearch')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useClusterSearch, toClusterOption, type ClusterOption } from '../hooks/useClusterSearch';
import { isNearBottom } from '../hooks/usePagedSearch';
import { hydrateByKeys, useHydratedOptions } from '../hooks/useHydratedOptions';
import clusterService from '../services/clusterService';
import { useI18n } from '../hooks/useI18n';
import type { Cluster } from '../types';

interface PinnedRow {
  value: string;
  label: string;
}

interface ClusterPickerProps {
  /** cluster id · '' = none */
  value: string;
  onChange: (id: string, option: ClusterOption | null) => void;
  /** เปิดค้นหา cluster ฝั่ง server หรือไม่ — ส่งผลของสิทธิ์เดิมของ endpoint (false = ไม่ยิง request) */
  canSearch: boolean;
  /** แถวคงที่เหนือผลค้นหา เช่น "All clusters" — เลือกแล้วแจ้ง onChange(value, null) */
  pinned?: PinnedRow[];
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  /** แจ้งสถานะเปิดจริงของ dropdown — ให้ Dialog/Sheet ที่ครอบอยู่กัน Escape ไม่ให้ปิดทั้งชั้น */
  onOpenChange?: (open: boolean) => void;
}

const EMPTY_PINNED: PinnedRow[] = [];

// ระดับ module = stable
const fetchByIds = (ids: string[]) =>
  hydrateByKeys<ClusterOption>(ids, 'id', async ({ advance, perpage }) => {
    const res = await clusterService.getAll({ page: 1, perpage, advance });
    return { data: ((res.data || []) as Cluster[]).map(toClusterOption), paginate: res.paginate };
  });
const keyOfOption = (o: ClusterOption) => o.id;

const ClusterRowButton: React.FC<{ c: ClusterOption; onPick: (c: ClusterOption) => void }> = ({ c, onPick }) => (
  <button
    type="button"
    onClick={() => onPick(c)}
    className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
  >
    <span className="flex min-w-0 flex-col">
      <span className="truncate">{c.name}</span>
      <span className="truncate font-mono text-xs text-muted-foreground">{c.code}</span>
    </span>
  </button>
);

/**
 * Single-cluster typeahead เก็บค่าเป็น cluster id — ค้นหาฝั่ง server + lazy load
 * `value` ที่อยู่นอกหน้าแรกถูก hydrate ด้วย id หนึ่งครั้ง แล้วแจ้ง onChange(id, option) หนึ่งครั้ง
 * id ที่ hydrate ไม่เจอจะ**คงค่าไว้** แสดงเป็น id + ข้อความ not-found (ไม่ reset)
 */
export const ClusterPicker: React.FC<ClusterPickerProps> = ({
  value, onChange, canSearch, pinned = EMPTY_PINNED, id, placeholder, disabled = false, ariaLabel, className, onOpenChange,
}) => {
  const { t } = useI18n();
  const effectivePlaceholder = placeholder ?? t('components.clusterPicker.defaultPlaceholder');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<ClusterOption | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const openRef = useRef(false);
  const reportedRef = useRef('');

  // จุดเดียวที่สถานะเปิดเปลี่ยน — รายงานเฉพาะเมื่อค่าเปลี่ยนจริง
  const changeOpen = useCallback((next: boolean) => {
    if (openRef.current === next) return;
    openRef.current = next;
    setOpen(next);
    onOpenChangeRef.current?.(next);
  }, []);

  // ถอด component ขณะ dropdown เปิด → ปลดการกัน Escape ของผู้ครอบ
  useEffect(() => () => {
    if (openRef.current) {
      openRef.current = false;
      onOpenChangeRef.current?.(false);
    }
  }, []);

  const pinnedMatch = pinned.find((p) => p.value === value) ?? null;
  const hydrateKeys = value && !pinnedMatch ? [value] : [];
  const { byKey, pending, missing } = useHydratedOptions<ClusterOption>(hydrateKeys, keyOfOption, fetchByIds);

  const pickedHere = picked && picked.id === value ? picked : null;
  const resolved = value && !pinnedMatch ? (pickedHere ?? byKey.get(value) ?? null) : null;
  const isPending = !!value && !pinnedMatch && !resolved && pending.has(value);
  const isMissing = !!value && !pinnedMatch && !resolved && missing.has(value);

  // hydrate เสร็จ → แจ้งชื่อหนึ่งครั้งต่อ id · ไม่แจ้งเมื่อ missing
  useEffect(() => {
    if (!value || pinnedMatch) { reportedRef.current = ''; return; }
    if (!resolved || reportedRef.current === value) return;
    reportedRef.current = value;
    onChangeRef.current(value, resolved);
  }, [value, pinnedMatch, resolved]);

  const { results, loading, loadingMore, hasMore, loadMore, error: searchError } =
    useClusterSearch(query, open && !disabled && canSearch);

  const handleListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isNearBottom(e.currentTarget) && hasMore && !loadingMore) loadMore();
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) changeOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // ทำเครื่องหมายว่าจัดการแล้ว เพื่อให้ shortcut ระดับหน้าที่ข้าม defaultPrevented ไม่ทำงานซ้ำ
      e.preventDefault();
      changeOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, changeOpen]);

  const selectCluster = (c: ClusterOption) => {
    setPicked(c);
    reportedRef.current = c.id;
    onChange(c.id, c);
    setQuery('');
    changeOpen(false);
  };

  const selectPinned = (p: PinnedRow) => {
    setPicked(null);
    reportedRef.current = '';
    onChange(p.value, null);
    setQuery('');
    changeOpen(false);
  };

  const clearSelection = () => {
    setPicked(null);
    reportedRef.current = '';
    onChange('', null);
    setQuery('');
    inputRef.current?.focus();
  };

  const showChip = !!pinnedMatch || !!value;

  // ทุกสถานะที่ dropdown มองไม่เห็น (disabled / แสดง chip) ต้องรายงานปิด — ไม่พึ่งเหตุการณ์คลิก/คีย์
  useEffect(() => {
    if (disabled || showChip) changeOpen(false);
  }, [disabled, showChip, changeOpen]);

  if (showChip) {
    const title = pinnedMatch ? pinnedMatch.label : (resolved?.name ?? value);
    const sub = resolved ? resolved.code : null;
    const canClear = !disabled && !(pinnedMatch && pinnedMatch.value === '');
    return (
      <div className={cn('min-w-0', className)}>
        <div
          className={cn(
            'flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs',
            disabled && 'bg-muted/50',
            (isMissing || isPending) && 'text-muted-foreground',
          )}
        >
          <span className="flex min-w-0 flex-col">
            <span className={cn('truncate', isMissing && 'italic')}>{title}</span>
            {sub && <span className="truncate font-mono text-xs text-muted-foreground">{sub}</span>}
          </span>
          {canClear && (
            <button
              type="button"
              onClick={clearSelection}
              className="shrink-0 rounded hover:text-destructive"
              aria-label={t('components.clusterPicker.clearSelectedAria', { name: title })}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {isMissing && (
          <p className="mt-1 text-xs text-muted-foreground">{t('components.clusterPicker.notFound')}</p>
        )}
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const pinnedShown = pinned.filter((p) => !q || p.label.toLowerCase().includes(q));
  const nothing = pinnedShown.length === 0 && results.length === 0;

  return (
    <div ref={wrapperRef} className={cn('relative min-w-0', className)}>
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
          className="min-w-0 flex-1 bg-transparent outline-hidden placeholder:text-muted-foreground"
        />
      </div>

      {open && !disabled && (
        <div
          onScroll={handleListScroll}
          className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-input bg-popover shadow-md"
        >
          {pinnedShown.length > 0 && (
            <ul className="py-1">
              {pinnedShown.map((p) => (
                <li key={`pinned:${p.value}`}>
                  <button
                    type="button"
                    onClick={() => selectPinned(p)}
                    className="flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="truncate">{p.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {canSearch && loading && (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('components.clusterPicker.searchingEllipsis')}
            </div>
          )}
          {canSearch && !loading && searchError && (
            <div className="px-3 py-4 text-sm text-destructive">{searchError}</div>
          )}
          {canSearch && !loading && !searchError && results.length > 0 && (
            <div className={cn(pinnedShown.length > 0 && 'border-t')}>
              <ul className="py-1">
                {results.map((c) => (
                  <li key={c.id}>
                    <ClusterRowButton c={c} onPick={selectCluster} />
                  </li>
                ))}
              </ul>
              {loadingMore && (
                <div className="flex items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('components.clusterPicker.loadingMore')}
                </div>
              )}
            </div>
          )}
          {!loading && !searchError && nothing && canSearch && (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              {query
                ? t('components.clusterPicker.noMatch', { query })
                : t('components.clusterPicker.typeToSearch')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

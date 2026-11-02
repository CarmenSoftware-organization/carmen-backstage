import React, { useEffect, useRef, useState } from 'react';
import { Search, X, RotateCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { useClusterSearch, toClusterOption, type ClusterOption } from '../hooks/useClusterSearch';
import { useTypeahead } from './typeahead/useTypeahead';
import { TypeaheadFooter, TypeaheadStatus } from './typeahead/TypeaheadStatus';
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
  /** option ที่หน้าถืออยู่แล้วสำหรับ `value` (เช่น hydrate ไว้เองตอน Sheet ปิด) — ตรงกับ id = picker ไม่ดึงซ้ำ */
  knownOption?: ClusterOption | null;
  /** ช่องนี้มี error — `aria-invalid` + ขอบสี destructive */
  invalid?: boolean;
  /** โฟกัสช่องค้นหาตอน mount (เช่นแก้ inline ที่เพิ่งกดเข้าโหมดแก้) */
  autoFocus?: boolean;
}

const EMPTY_PINNED: PinnedRow[] = [];

// ระดับ module = stable
export const fetchClustersByIds = (ids: string[]) =>
  hydrateByKeys<ClusterOption>(ids, 'id', async ({ advance, perpage }) => {
    const res = await clusterService.getAll({ page: 1, perpage, advance });
    return { data: ((res.data || []) as Cluster[]).map(toClusterOption), paginate: res.paginate };
  });
export const keyOfOption = (o: ClusterOption) => o.id;

/** hydrate cluster จาก id เดียว — ใช้ใน picker และหน้าที่ต้องแสดงชื่อตอน picker ยังไม่ mount (เช่นอยู่ใน Sheet ที่ปิด) · id '' = ไม่ยิง request */
export function useClusterById(
  id: string,
  /** แถวที่ผู้เรียกถืออยู่แล้ว (เช่น option ที่ picker เพิ่งแจ้งมา) — ตรงกับ id = ไม่ยิง request */
  known?: ClusterOption | null,
): { option: ClusterOption | null; pending: boolean; missing: boolean; failed: boolean; retry: () => void } {
  const { byKey, pending, missing, failed, retry } = useHydratedOptions<ClusterOption>(
    id ? [id] : [],
    keyOfOption,
    fetchClustersByIds,
    { known: known ? [known] : null },
  );
  const option = id ? (byKey.get(id) ?? null) : null;
  return {
    option,
    pending: !!id && !option && pending.has(id),
    missing: !!id && !option && missing.has(id),
    // โหลดไม่สำเร็จ (เครือข่าย/5xx) — ต่างจาก "ไม่พบ": แสดงปุ่มลองใหม่ได้
    failed: !!id && !option && failed.has(id),
    retry,
  };
}

type Row = { kind: 'pinned'; p: PinnedRow } | { kind: 'cluster'; c: ClusterOption };
const rowKey = (r: Row) => (r.kind === 'pinned' ? `pinned:${r.p.value}` : r.c.id);

/**
 * Single-cluster typeahead เก็บค่าเป็น cluster id — ค้นหาฝั่ง server + lazy load
 * `value` ที่อยู่นอกหน้าแรกถูก hydrate ด้วย id หนึ่งครั้ง แล้วแจ้ง onChange(id, option) หนึ่งครั้ง
 * id ที่ hydrate ไม่เจอจะ**คงค่าไว้** แสดงเป็น id + ข้อความ not-found (ไม่ reset)
 */
export const ClusterPicker: React.FC<ClusterPickerProps> = ({
  value, onChange, canSearch, pinned = EMPTY_PINNED, id, placeholder, disabled = false, ariaLabel, className, onOpenChange,
  knownOption, invalid = false, autoFocus = false,
}) => {
  const { t } = useI18n();
  const [picked, setPicked] = useState<ClusterOption | null>(null);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const reportedRef = useRef('');

  const pinnedMatch = pinned.find((p) => p.value === value) ?? null;
  // pinned '' (เช่น "All clusters") ไม่ใช่ chip — แสดงเป็น placeholder ของช่องค้นหา
  const effectivePlaceholder = value === '' && pinnedMatch
    ? pinnedMatch.label
    : (placeholder ?? t('components.clusterPicker.defaultPlaceholder'));
  const pickedHere = picked && picked.id === value ? picked : null;
  const knownHere = knownOption && knownOption.id === value ? knownOption : null;
  const { option: hydrated, pending: hydPending, missing: hydMissing, failed: hydFailed, retry: retryHydrate } =
    useClusterById(pinnedMatch ? '' : value, pickedHere ?? knownHere);

  const resolved = value && !pinnedMatch ? (pickedHere ?? hydrated) : null;
  const isPending = !!value && !pinnedMatch && !resolved && hydPending;
  const isMissing = !!value && !pinnedMatch && !resolved && hydMissing;
  const isFailed = isMissing && hydFailed;

  // hydrate เสร็จ → แจ้งชื่อหนึ่งครั้งต่อ id · ไม่แจ้งเมื่อ missing
  useEffect(() => {
    if (!value || pinnedMatch) { reportedRef.current = ''; return; }
    if (!resolved || reportedRef.current === value) return;
    reportedRef.current = value;
    onChangeRef.current(value, resolved);
  }, [value, pinnedMatch, resolved]);

  const showChip = !!value;
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const { results, loading, loadingMore, hasMore, loadMore, error: searchError, loadMoreError } =
    useClusterSearch(query, searchOpen && !disabled && canSearch);

  const q = query.trim().toLowerCase();
  const pinnedShown = pinned.filter((p) => !q || p.label.toLowerCase().includes(q));
  const resultsShown = canSearch && !loading && !searchError ? results : [];
  const rows: Row[] = [
    ...pinnedShown.map((p): Row => ({ kind: 'pinned', p })),
    ...resultsShown.map((c): Row => ({ kind: 'cluster', c })),
  ];

  const ta = useTypeahead<Row>({
    items: rows,
    getKey: rowKey,
    onPick: (r) => (r.kind === 'pinned' ? selectPinned(r.p) : selectCluster(r.c)),
    disabled,
    hidden: showChip,
    onOpenChange: (o) => { setSearchOpen(o); onOpenChange?.(o); },
    autoFocus,
    hasMore, loadingMore, loadMoreError, loadMore,
  });

  const selectCluster = (c: ClusterOption) => {
    setPicked(c);
    reportedRef.current = c.id;
    onChange(c.id, c);
    setQuery('');
  };

  const selectPinned = (p: PinnedRow) => {
    setPicked(null);
    reportedRef.current = '';
    onChange(p.value, null);
    setQuery('');
  };

  const clearSelection = () => {
    setPicked(null);
    reportedRef.current = '';
    onChange('', null);
    setQuery('');
    ta.requestFocus();
  };

  if (showChip) {
    // id ที่หาไม่เจอ: ย่อแบบเดียวกับ user (`Not found · <8 ตัวแรก>`) ไม่โชว์ UUID เต็ม
    const title = pinnedMatch
      ? pinnedMatch.label
      : (resolved?.name ??
        (isMissing
          ? `${t(isFailed ? 'components.clusterPicker.loadFailed' : 'components.clusterPicker.notFound')} · ${value.slice(0, 8)}`
          : value));
    const sub = resolved ? resolved.code : null;
    const canClear = !disabled;
    return (
      <div className={cn('min-w-0', className)}>
        <div
          title={isMissing ? value : undefined}
          className={cn(
            'flex min-h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-1.5 text-sm shadow-xs',
            invalid ? 'border-destructive' : 'border-input',
            disabled && 'bg-muted/50',
            (isMissing || isPending) && 'text-muted-foreground',
          )}
        >
          <span className="flex min-w-0 flex-col">
            <span className={cn('truncate', isMissing && 'italic')}>{title}</span>
            {sub && <span className="truncate font-mono text-xs text-muted-foreground">{sub}</span>}
          </span>
          {isFailed && (
            <button
              type="button"
              onClick={retryHydrate}
              className="shrink-0 rounded hover:text-foreground"
              aria-label={t('common.action.retry')}
              title={t('common.action.retry')}
            >
              <RotateCw className="h-4 w-4" />
            </button>
          )}
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
      </div>
    );
  }

  const nothing = rows.length === 0;

  return (
    <div {...ta.wrapperProps} className={cn('relative min-w-0', className)}>
      <div
        className={cn(
          'flex min-h-9 w-full items-center gap-1 rounded-md border bg-transparent px-2 py-1.5 text-sm shadow-xs focus-within:outline-hidden focus-within:ring-1 focus-within:ring-ring',
          invalid ? 'border-destructive' : 'border-input',
          disabled && 'bg-muted/50 cursor-not-allowed',
        )}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          {...ta.inputProps}
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
          aria-invalid={invalid || undefined}
          className="min-w-0 flex-1 bg-transparent outline-hidden placeholder:text-muted-foreground"
        />
      </div>

      {ta.open && (
        <div
          {...ta.listProps}
          className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-input bg-popover shadow-md"
        >
          {rows.map((r, i) => (
            <React.Fragment key={rowKey(r)}>
              {r.kind === 'cluster' && i === pinnedShown.length && pinnedShown.length > 0 && (
                <div role="presentation" className="border-t" />
              )}
              <button
                type="button"
                {...ta.getOptionProps(r, i)}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
              >
                {r.kind === 'pinned' ? (
                  <span className="truncate">{r.p.label}</span>
                ) : (
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{r.c.name}</span>
                    <span className="truncate font-mono text-xs text-muted-foreground">{r.c.code}</span>
                  </span>
                )}
              </button>
            </React.Fragment>
          ))}
          {canSearch && (
            <TypeaheadStatus
              loading={loading}
              error={searchError ?? undefined}
              empty={nothing}
              searchingLabel={t('components.clusterPicker.searchingEllipsis')}
              emptyLabel={query ? t('components.clusterPicker.noMatch', { query }) : t('components.clusterPicker.typeToSearch')}
            />
          )}
          {resultsShown.length > 0 && (
            <TypeaheadFooter
              loadingMore={loadingMore}
              loadMoreError={loadMoreError ?? undefined}
              onRetry={loadMore}
              loadingMoreLabel={t('components.clusterPicker.loadingMore')}
            />
          )}
        </div>
      )}
    </div>
  );
};

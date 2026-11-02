import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Search, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { LoadMoreErrorRow } from './LoadMoreErrorRow';
import { cn } from '../lib/utils';
import { buHueColor, buInitials } from '../utils/buHue';
import { useI18n } from '../hooks/useI18n';
import { useBusinessUnitSearch, type BusinessUnitOption } from '../hooks/useBusinessUnitSearch';
import { isNearBottom } from '../hooks/usePagedSearch';

const RECENT_KEY = 'sqlwb_recent_bus_v2';
const RECENT_MAX = 5;

function readRecent(): BusinessUnitOption[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (x): x is BusinessUnitOption =>
          !!x &&
          typeof x === 'object' &&
          typeof x.id === 'string' &&
          typeof x.code === 'string' &&
          typeof x.name === 'string',
      )
      .slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

function writeRecent(bus: BusinessUnitOption[]) {
  // ใส่ทีละตัว: ตัวท้ายสุดของ `bus` กลายเป็นล่าสุด
  let next = readRecent();
  for (const bu of bus) {
    const entry = {
      id: bu.id,
      code: bu.code,
      name: bu.name,
      cluster_name: bu.cluster_name ?? null,
    };
    next = [entry, ...next.filter((r) => r.code !== bu.code)].slice(0, RECENT_MAX);
  }
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / disabled storage */
  }
}

interface Section {
  key: string;
  label: string | null;
  recent?: boolean;
  items: BusinessUnitOption[];
}

interface BuSwitcherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCode: string;
  onSelect: (bu: BusinessUnitOption) => void;
  /**
   * เลือกได้หลาย BU ในครั้งเดียว — คลิก/Enter สลับติ๊กแทนที่จะปิดกล่องทันที และต้องกดยืนยันเอง
   * ต้องมาคู่กับ `onSelectMany` ไม่งั้นการยืนยันจะไม่มีที่ลง
   */
  multiple?: boolean;
  /** เรียกครั้งเดียวตอนกดยืนยันในโหมด multiple — เรียงตาม code ไม่ใช่ลำดับที่กด (ข้ามคำค้นไม่มี "ลำดับที่แสดง") */
  onSelectMany?: (bus: BusinessUnitOption[]) => void;
}

/**
 * Command-palette BU switcher. ค้นหาฝั่ง server เอง (code / name / description) ทีละ 20 รายการ
 * เรียงตาม code แล้วโหลดหน้าถัดไปตอนเลื่อนถึงท้าย — ผู้เรียกไม่ต้องส่งรายการ BU มา
 * Recents (เก็บเป็น object ต่อ browser) ปักไว้บนสุดตอนยังไม่พิมพ์ค้นหา
 *
 * โหมด `multiple` เปิดการเลือกหลาย BU ในครั้งเดียว (ผู้เรียกใช้รันเป็นชุด) โหมดปกติไม่เปลี่ยน
 * พฤติกรรมเลย: คลิกแล้วเลือกและปิดกล่องทันทีเหมือนเดิม
 */
export function BuSwitcher({
  open,
  onOpenChange,
  currentCode,
  onSelect,
  multiple = false,
  onSelectMany,
}: BuSwitcherProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(0);
  // ติ๊กไว้เป็น object (key ด้วย code) เพื่อให้คงอยู่ข้ามการเปลี่ยนคำค้น
  const [checked, setChecked] = useState<BusinessUnitOption[]>([]);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optId = (i: number) => `${baseId}-opt-${i}`;
  // Scroll only after arrow-key moves: hover-driven scrolling could reach the bottom and fire loadMore
  const keyboardMoveRef = useRef(false);

  // Reset the query (and any pending multi-selection) each time the palette opens.
  useEffect(() => {
    if (open) {
      setSearch('');
      setChecked([]);
    }
  }, [open]);

  const query = search.trim();
  const { results, loading, loadingMore, error, loadMoreError, hasMore, total, resultsQuery, loadMore, refresh } =
    useBusinessUnitSearch(query, open);
  // results เป็นของคำค้นที่ debounce แล้ว ส่วน `query` เป็นคำค้นสด — ช่วงที่ต่างกัน (หรือกำลังโหลด) แถวที่เห็นเป็นของคำค้นเก่า
  // จึงไม่แสดงและไม่ให้ Enter เลือก (ใน SQL Workbench เลือกผิดแถว = ต่อผิด tenant)
  const stale = query !== resultsQuery;
  const pending = loading || stale;

  const { sections, flat } = useMemo(() => {
    const sections: Section[] = [];
    let items = pending ? [] : results;
    if (!query && !stale) {
      // `open` is a dep so recents re-read from storage each time the palette opens.
      const recents = open ? readRecent() : [];
      if (recents.length) {
        const recentSet = new Set(recents.map((r) => r.code));
        items = items.filter((b) => !recentSet.has(b.code));
        sections.push({
          key: 'recent',
          label: t('switcher.recent'),
          recent: true,
          items: recents,
        });
      }
    }
    sections.push({ key: 'results', label: null, items });
    return { sections, flat: sections.flatMap((s) => s.items) };
  }, [results, pending, stale, query, open, t]);

  // Keep the active index in range and scrolled into view.
  useEffect(() => {
    setActive((i) => (flat.length ? Math.min(i, flat.length - 1) : 0));
  }, [flat.length]);
  // คำค้นเปลี่ยน / หน้าแรกของผลลัพธ์ชุดใหม่มาถึง → กลับไปแถวแรก (loadMore ไม่ reset)
  useEffect(() => {
    setActive(0);
  }, [search, loading]);
  useEffect(() => {
    if (!keyboardMoveRef.current) return;
    keyboardMoveRef.current = false;
    rowRefs.current[active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const select = (bu: BusinessUnitOption) => {
    if (multiple) {
      setChecked((prev) =>
        prev.some((c) => c.code === bu.code) ? prev.filter((c) => c.code !== bu.code) : [...prev, bu],
      );
      return;
    }
    writeRecent([bu]);
    onSelect(bu);
    onOpenChange(false);
  };

  /**
   * ยืนยันการเลือกหลายตัว — ส่งกลับเรียงตาม code เพราะข้ามคำค้นไม่มี "ลำดับที่แสดง"
   * ผู้เรียกใช้รันไล่ตามลำดับนี้ ซึ่งคาดเดาได้และตรงกับลำดับในรายการ
   */
  const confirmMany = () => {
    if (checked.length === 0) return;
    const sorted = [...checked].sort((a, b) => a.code.localeCompare(b.code));
    writeRecent(sorted);
    onSelectMany?.(sorted);
    onOpenChange(false);
  };

  const handleListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // หน้าถัดไปพัง → รอปุ่ม Retry ไม่ยิงซ้ำทุกครั้งที่เลื่อน
    if (isNearBottom(e.currentTarget) && hasMore && !loadingMore && !loadMoreError) loadMore();
  };

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      keyboardMoveRef.current = true;
      if (flat.length) setActive((i) => (i + 1) % flat.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      keyboardMoveRef.current = true;
      if (flat.length) setActive((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // ⌘/Ctrl+Enter = ยืนยันทั้งชุด — ไม่ขึ้นกับผลค้นหา จึงใช้ได้เสมอเมื่อมีที่ติ๊กไว้
      if (multiple && (e.metaKey || e.ctrlKey)) {
        confirmMany();
        return;
      }
      // Enter เปล่า = สลับติ๊กแถวที่อยู่ — ระหว่าง pending แถวผลลัพธ์จาก server เป็นของคำค้นเก่า จึงเลือกได้เฉพาะแถว Recent
      if (pending && active >= recentCount) return;
      const bu = flat[active];
      if (bu) select(bu);
    }
    // Escape is handled by Radix Dialog (closes the palette).
  };

  const recentCount = sections.find((sec) => sec.recent)?.items.length ?? 0;
  let flatIndex = -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[12vh] max-w-xl translate-y-0 gap-0 overflow-hidden p-0 [&>button]:hidden">
        <DialogTitle className="sr-only">{t('switcher.switchBu')}</DialogTitle>
        <DialogDescription className="sr-only">{t('switcher.chooseBu')}</DialogDescription>

        {/* search */}
        <div className="flex items-center gap-3 border-b px-4 py-3.5">
          <Search className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
          <input
            // eslint-disable-next-line jsx-a11y/no-autofocus -- palette pattern: focus the query on open
            autoFocus
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={flat[active] ? optId(active) : undefined}
            aria-label={t('common.state.searchBusinessUnitsAria')}
            className="placeholder:text-muted-foreground flex-1 bg-transparent text-[15px] outline-hidden"
            placeholder={t('switcher.searchBuPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onInputKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          {!pending && total !== null && (
            <span className="text-muted-foreground shrink-0 font-mono text-[11px]">
              {t('switcher.buCount', { count: total })}
            </span>
          )}
        </div>

        {/* list */}
        <div
          id={listId}
          role="listbox"
          aria-multiselectable={multiple || undefined}
          aria-label={t('switcher.buList')}
          onScroll={handleListScroll}
          className="max-h-[52vh] overflow-y-auto p-1.5"
        >
          {!pending && !error && flat.length === 0 && (
            <div role="presentation" className="text-muted-foreground px-4 py-10 text-center text-sm">
              <div aria-live="polite">
                {t('switcher.buNoMatches', { search: query })}
                <br />
                {t('switcher.buNoMatchesHint')}
              </div>
            </div>
          )}
          {sections.map((section) => (
            <div key={section.key}>
              {section.label !== null && (
                <div className="text-muted-foreground flex items-center gap-1.5 px-2.5 pb-1 pt-2.5 text-[11px] font-bold uppercase tracking-wider">
                  {section.recent && <Star className="size-3 fill-[hsl(var(--warning))] text-[hsl(var(--warning))]" />}
                  {section.label}
                </div>
              )}
              {section.items.map((bu) => {
                flatIndex += 1;
                const idx = flatIndex;
                const isActive = idx === active;
                const isChecked = multiple && checked.some((c) => c.code === bu.code);
                const isCurrent = bu.code === currentCode;
                return (
                  <button
                    key={bu.id}
                    id={optId(idx)}
                    ref={(el) => {
                      rowRefs.current[idx] = el;
                    }}
                    type="button"
                    role="option"
                    // โหมด multi: aria-selected คือ "ติ๊กแล้วหรือยัง" ตามรูปของ listbox หลายค่า
                    // ส่วนแถวที่คีย์บอร์ดอยู่บอกผ่าน aria-activedescendant ของช่องค้นหาอยู่แล้ว
                    aria-selected={multiple ? isChecked : isActive}
                    onClick={() => select(bu)}
                    onMouseMove={() => setActive(idx)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left',
                      isActive && 'bg-accent',
                    )}
                  >
                    {multiple && (
                      <span
                        className={cn(
                          'grid size-4 shrink-0 place-items-center rounded-[4px] border',
                          isChecked && 'bg-primary border-primary text-primary-foreground',
                        )}
                        aria-hidden="true"
                      >
                        {isChecked && <Check className="size-3" strokeWidth={3} />}
                      </span>
                    )}
                    <span
                      className="grid size-6 shrink-0 place-items-center rounded-md text-[9px] font-bold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]"
                      style={{ background: buHueColor(bu.code) }}
                      aria-hidden="true"
                    >
                      {buInitials(bu.code)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-mono text-[13px] font-semibold">{bu.code}</span>
                      <span className="text-muted-foreground block truncate text-xs">{bu.name}</span>
                    </span>
                    {bu.cluster_name && (
                      <span className="text-muted-foreground hidden shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] sm:inline">
                        {bu.cluster_name}
                      </span>
                    )}
                    {isCurrent && (
                      <Badge variant="success" className="shrink-0 px-1.5 py-0.5 text-[10px] font-mono">
                        {t('switcher.connected')}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          {pending && (
            <div role="presentation" className="text-muted-foreground flex items-center gap-2 px-4 py-4 text-sm">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              <span aria-live="polite">{t('switcher.loadingBus')}</span>
            </div>
          )}
          {!pending && error && (
            <div role="presentation" className="flex items-center justify-between gap-2 px-4 py-4 text-sm">
              <span className="text-destructive" aria-live="polite">{error}</span>
              <Button variant="ghost" size="sm" className="h-7" onClick={refresh}>
                {t('common.action.retry')}
              </Button>
            </div>
          )}
          {loadingMore && (
            <div role="presentation" className="text-muted-foreground flex items-center gap-2 border-t px-3 py-2 text-xs">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              <span aria-live="polite">{t('switcher.loadingMoreBus')}</span>
            </div>
          )}
          {!loadingMore && loadMoreError && <LoadMoreErrorRow message={loadMoreError} onRetry={loadMore} />}
        </div>

        {/* footer */}
        <div className="text-muted-foreground bg-muted/40 flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-2 text-[11px]">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> {t('switcher.navigate')}
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> {multiple ? t('switcher.toggle') : t('switcher.connect')}
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>esc</Kbd> {t('switcher.close')}
          </span>
          {multiple && (
            <div className="ml-auto flex items-center gap-2">
              <span className="tabular-nums">{t('switcher.selectedCount', { count: checked.length })}</span>
              {checked.length > 0 && (
                <Button variant="ghost" size="sm" className="h-7" onClick={() => setChecked([])}>
                  {t('switcher.clearSelection')}
                </Button>
              )}
              <Button size="sm" className="h-7" disabled={checked.length === 0} onClick={confirmMany}>
                {t('switcher.continueWith', { count: checked.length })}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="bg-card rounded border px-1.5 py-0.5 font-mono text-[10px]">{children}</kbd>;
}

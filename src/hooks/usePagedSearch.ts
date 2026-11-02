import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from './useDebouncedValue';
import { parseApiError } from '../utils/errorParser';

const DEFAULT_DEBOUNCE_MS = 400;
const DEFAULT_PAGE_SIZE = 20;

/** ระยะ (px) จากท้าย dropdown ที่เริ่มโหลดหน้าถัดไป */
export const LOAD_MORE_THRESHOLD_PX = 48;

/** เลื่อนใกล้ท้ายรายการพอจะโหลดหน้าถัดไปหรือยัง */
export function isNearBottom(el: HTMLElement, thresholdPx: number = LOAD_MORE_THRESHOLD_PX): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= thresholdPx;
}

export interface PagedPage<T> {
  data?: T[];
  paginate?: { total?: number };
}

export interface PagedSearchResult<T> {
  results: T[];
  /** กำลังโหลดหน้าแรกของคำค้นปัจจุบัน */
  loading: boolean;
  /** กำลังโหลดหน้าถัดไป (lazy load ตอนเลื่อนถึงท้ายรายการ) */
  loadingMore: boolean;
  /** หน้าแรกของคำค้นปัจจุบันพัง (ไม่มีแถวให้แสดง) */
  error: string;
  /** หน้าถัดไปพัง — แถวที่โหลดแล้วยังอยู่ และ `hasMore` คงเดิมให้ `loadMore` ลองใหม่ได้ */
  loadMoreError: string;
  hasMore: boolean;
  /** จำนวนทั้งหมดของคำค้นปัจจุบัน (จาก paginate.total ของหน้าแรก) · null = ไม่ทราบ */
  total: number | null;
  /** โหลดหน้าถัดไป — ไม่ทำอะไรถ้ากำลังโหลดอยู่หรือไม่มีหน้าเหลือ */
  loadMore: () => void;
  /** ล้างผลแล้วดึงหน้าแรกของคำค้นเดิมใหม่ */
  refresh: () => void;
}

/**
 * ค้นหาฝั่ง server ทีละหน้า (debounce + dedupe by id + generation guard)
 * `loadMore` ดึงหน้าถัดไปต่อท้าย · ไม่ยิงตอน `enabled` เป็น false
 *
 * `fetchPage` ต้อง referentially stable (ประกาศระดับ module หรือห่อ useCallback) —
 * ถ้าเปลี่ยนตัวทุก render, callback ภายในจะถูกสร้างใหม่ทุกครั้ง · การเปลี่ยน fetchPage
 * ไม่ได้ trigger ดึงใหม่เอง (ใช้ `refresh` หรือเปลี่ยนคำค้น)
 */
export function usePagedSearch<T extends { id: string }>(
  query: string,
  enabled: boolean,
  fetchPage: (args: { search: string; page: number; perpage: number }) => Promise<PagedPage<T>>,
  opts?: { pageSize?: number; debounceMs?: number },
): PagedSearchResult<T> {
  const pageSize = opts?.pageSize ?? DEFAULT_PAGE_SIZE;
  const debounceMs = opts?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const [debouncedQuery] = useDebouncedValue(query, debounceMs);
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [loadMoreError, setLoadMoreError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  // generation ทิ้งคำตอบของคำค้นเก่า — ทั้งหน้าแรกและ loadMore ที่ค้างอยู่ตอนคำค้นเปลี่ยน
  const generationRef = useRef(0);
  const fetchedKeyRef = useRef<string | null>(null);
  const pageRef = useRef(0);
  const busyRef = useRef(false);
  const resultsRef = useRef<T[]>([]);

  const run = useCallback(
    (search: string, page: number, generation: number) => {
      busyRef.current = true;
      return fetchPage({ search, page, perpage: pageSize })
        .then((response) => {
          if (generation !== generationRef.current) return;
          const list = response.data || [];
          const total = response.paginate?.total;
          const prev = page === 1 ? [] : resultsRef.current;
          const seen = new Set(prev.map((r) => r.id));
          const merged = [...prev, ...list.filter((r) => !seen.has(r.id))];
          resultsRef.current = merged;
          setResults(merged);
          // total ไม่มี = ไม่รู้ → หน้าเต็มแปลว่าอาจยังมีต่อ
          setHasMore(typeof total === 'number' ? page * pageSize < total : list.length === pageSize);
          pageRef.current = page;
          if (page === 1) setTotal(typeof total === 'number' ? total : null);
        })
        .catch((err: unknown) => {
          if (generation !== generationRef.current) return;
          const message = parseApiError(err).message;
          if (page > 1) {
            // เก็บแถวเดิมไว้ · hasMore คงเดิม เพื่อให้ loadMore (เลื่อนอีกครั้ง / ปุ่มลองใหม่) ยิงซ้ำได้
            setLoadMoreError(message);
          } else {
            setError(message);
            setHasMore(false);
            setTotal(null);
            resultsRef.current = [];
            setResults([]);
            // หน้าแรกพังต้องลองใหม่ได้: ลืมว่าเคยดึงคำค้นนี้
            fetchedKeyRef.current = null;
          }
        })
        .finally(() => {
          if (generation !== generationRef.current) return;
          busyRef.current = false;
          setLoading(false);
          setLoadingMore(false);
        });
    },
    [fetchPage, pageSize],
  );

  useEffect(() => {
    if (!enabled) return;
    const key = `${refreshTick}\u0000${debouncedQuery}`;
    if (fetchedKeyRef.current === key) return;

    fetchedKeyRef.current = key;
    const generation = ++generationRef.current;
    pageRef.current = 0;
    setLoading(true);
    setLoadingMore(false);
    setHasMore(false);
    setTotal(null);
    setError('');
    setLoadMoreError('');
    void run(debouncedQuery, 1, generation);
  }, [debouncedQuery, enabled, refreshTick, run]);

  const loadMore = useCallback(() => {
    if (!enabled || busyRef.current || !hasMore) return;
    setLoadingMore(true);
    setLoadMoreError('');
    void run(debouncedQuery, pageRef.current + 1, generationRef.current);
  }, [enabled, hasMore, debouncedQuery, run]);

  const refresh = useCallback(() => setRefreshTick((n) => n + 1), []);

  return { results, loading, loadingMore, error, loadMoreError, hasMore, total, loadMore, refresh };
}

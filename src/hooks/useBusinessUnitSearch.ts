import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from './useDebouncedValue';
import businessUnitService from '../services/businessUnitService';
import { parseApiError } from '../utils/errorParser';
import type { BusinessUnit } from '../types';

const DEBOUNCE_MS = 400;
const PAGE_SIZE = 20;

export interface BusinessUnitOption {
  id: string;
  code: string;
  name: string;
  cluster_name?: string | null;
  /** ลูกค้าที่ BU ผูกอยู่ — ส่งมาเฉพาะผู้เรียกระดับ backstage ทั้งระบบ (คีย์หาย ≠ ไม่มีลูกค้า) */
  customer?: BusinessUnit['customer'];
}

export interface BusinessUnitSearchResult {
  results: BusinessUnitOption[];
  /** กำลังโหลดหน้าแรกของคำค้นปัจจุบัน */
  loading: boolean;
  /** กำลังโหลดหน้าถัดไป (lazy load ตอนเลื่อนถึงท้ายรายการ) */
  loadingMore: boolean;
  error: string;
  hasMore: boolean;
  /** โหลดหน้าถัดไป — ไม่ทำอะไรถ้ากำลังโหลดอยู่หรือไม่มีหน้าเหลือ */
  loadMore: () => void;
  /** ล้างผลแล้วดึงหน้าแรกของคำค้นเดิมใหม่ (เช่นหลังผูก BU แล้วสถานะในรายการเปลี่ยน) */
  refresh: () => void;
}

const toOption = (b: BusinessUnit): BusinessUnitOption => ({
  id: b.id,
  code: b.code,
  name: b.name,
  cluster_name: b.cluster_name ?? null,
  ...('customer' in b ? { customer: b.customer } : {}),
});

/**
 * ค้นหา BU ฝั่ง server (name, code, description ผ่าน businessUnitService.getAll) ทีละ 20 รายการ
 * เรียงตาม code — `loadMore` ดึงหน้าถัดไปต่อท้าย · ไม่ยิงตอน `enabled` เป็น false
 * ผู้เรียกต้องส่ง `enabled` ตามสิทธิ์ของ endpoint (`cluster.read`): request ที่ไม่มีสิทธิ์อาจได้ 401 แล้วเตะผู้ใช้ออก
 */
export function useBusinessUnitSearch(query: string, enabled: boolean): BusinessUnitSearchResult {
  const [debouncedQuery] = useDebouncedValue(query, DEBOUNCE_MS);
  const [results, setResults] = useState<BusinessUnitOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  // generation ทิ้งคำตอบของคำค้นเก่า — ทั้งหน้าแรกและ loadMore ที่ค้างอยู่ตอนคำค้นเปลี่ยน
  const generationRef = useRef(0);
  const fetchedKeyRef = useRef<string | null>(null);
  const pageRef = useRef(0);
  const busyRef = useRef(false);
  const resultsRef = useRef<BusinessUnitOption[]>([]);

  const fetchPage = useCallback((search: string, page: number, generation: number) => {
    busyRef.current = true;
    return businessUnitService
      .getAll({ page, perpage: PAGE_SIZE, search, sort: 'code:asc' })
      .then((response) => {
        if (generation !== generationRef.current) return;
        const list = ((response.data || []) as BusinessUnit[]).map(toOption);
        const total = response.paginate?.total;
        const prev = page === 1 ? [] : resultsRef.current;
        const seen = new Set(prev.map((b) => b.id));
        const merged = [...prev, ...list.filter((b) => !seen.has(b.id))];
        resultsRef.current = merged;
        setResults(merged);
        // total ไม่มี = ไม่รู้ → หน้าเต็มแปลว่าอาจยังมีต่อ
        setHasMore(typeof total === 'number' ? page * PAGE_SIZE < total : list.length === PAGE_SIZE);
        pageRef.current = page;
      })
      .catch((err: unknown) => {
        if (generation !== generationRef.current) return;
        setError(parseApiError(err).message);
        setHasMore(false);
        if (page === 1) {
          resultsRef.current = [];
          setResults([]);
          fetchedKeyRef.current = null;
        }
      })
      .finally(() => {
        if (generation !== generationRef.current) return;
        busyRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      });
  }, []);

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
    setError('');
    void fetchPage(debouncedQuery, 1, generation);
  }, [debouncedQuery, enabled, refreshTick, fetchPage]);

  const loadMore = useCallback(() => {
    if (!enabled || busyRef.current || !hasMore) return;
    setLoadingMore(true);
    setError('');
    void fetchPage(debouncedQuery, pageRef.current + 1, generationRef.current);
  }, [enabled, hasMore, debouncedQuery, fetchPage]);

  const refresh = useCallback(() => setRefreshTick((n) => n + 1), []);

  return { results, loading, loadingMore, error, hasMore, loadMore, refresh };
}

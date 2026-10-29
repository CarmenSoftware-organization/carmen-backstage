import { useEffect, useRef, useState } from 'react';
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
}

/**
 * ค้นหา BU ฝั่ง server (name, code, description ผ่าน businessUnitService.getAll)
 * รูปเดียวกับ useCustomerSearch — ไม่ยิงตอน `enabled` เป็น false
 * ผู้เรียกต้องส่ง `enabled` ตามสิทธิ์ของ endpoint (`cluster.read`): request ที่ไม่มีสิทธิ์อาจได้ 401 แล้วเตะผู้ใช้ออก
 */
export function useBusinessUnitSearch(
  query: string,
  enabled: boolean,
): { results: BusinessUnitOption[]; loading: boolean; error: string } {
  const [debouncedQuery] = useDebouncedValue(query, DEBOUNCE_MS);
  const [results, setResults] = useState<BusinessUnitOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const generationRef = useRef(0);
  const fetchedQueryRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (fetchedQueryRef.current === debouncedQuery) return;

    fetchedQueryRef.current = debouncedQuery;
    const generation = ++generationRef.current;
    setLoading(true);
    setError('');

    businessUnitService
      .getAll({ page: 1, perpage: PAGE_SIZE, search: debouncedQuery })
      .then((response) => {
        if (generation !== generationRef.current) return;
        const list = (response.data || []) as BusinessUnit[];
        setResults(list.map((b) => ({ id: b.id, code: b.code, name: b.name })));
      })
      .catch((err: unknown) => {
        if (generation !== generationRef.current) return;
        setResults([]);
        setError(parseApiError(err).message);
        fetchedQueryRef.current = null;
      })
      .finally(() => {
        if (generation !== generationRef.current) return;
        setLoading(false);
      });
  }, [debouncedQuery, enabled]);

  return { results, loading, error };
}

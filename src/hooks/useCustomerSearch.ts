import { useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from './useDebouncedValue';
import customerService from '../services/customerService';
import { parseApiError } from '../utils/errorParser';
import type { Customer, CustomerOption } from '../types';

const DEBOUNCE_MS = 400;
const PAGE_SIZE = 20;

/**
 * ค้นหาลูกค้าฝั่ง server (ar_number, company_name, tax_no ผ่าน customerService.getAll)
 * รูปเดียวกับ useUserSearch: ไม่ยิงตอน `enabled` เป็น false, ไม่ดึง query เดิมซ้ำ,
 * และคำตอบเก่าที่ช้ากว่าไม่มีวันทับคำตอบใหม่ (generation counter)
 *
 * Server-side customer typeahead; clone of useUserSearch.
 */
export function useCustomerSearch(
  query: string,
  enabled: boolean,
): { results: CustomerOption[]; loading: boolean; error: string } {
  const [debouncedQuery] = useDebouncedValue(query, DEBOUNCE_MS);
  const [results, setResults] = useState<CustomerOption[]>([]);
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

    customerService
      .getAll({ page: 1, perpage: PAGE_SIZE, search: debouncedQuery })
      .then((response) => {
        if (generation !== generationRef.current) return;
        const list = (response.data || []) as Customer[];
        setResults(
          list.map((c) => ({
            id: c.id,
            ar_number: c.ar_number,
            company_name: c.company_name,
            status: c.status,
          })),
        );
      })
      .catch((err: unknown) => {
        if (generation !== generationRef.current) return;
        setResults([]);
        setError(parseApiError(err).message);
        // query ที่พลาดต้องลองใหม่ได้
        fetchedQueryRef.current = null;
      })
      .finally(() => {
        if (generation !== generationRef.current) return;
        setLoading(false);
      });
  }, [debouncedQuery, enabled]);

  return { results, loading, error };
}

import { useEffect, useRef, useState } from 'react';
import type { PagedPage } from './usePagedSearch';

/** จำนวนค่าสูงสุดต่อ request ตอน hydrate */
export const HYDRATE_CHUNK = 100;

/**
 * ดึงแถวตามชุดคีย์ (id หรือ code) ผ่าน `advance` ทีละ HYDRATE_CHUNK ด้วย Promise.allSettled
 * chunk ที่พัง → `failed: true` (แถวของ chunk นั้นหายไป ให้ผู้เรียกถือเป็น missing)
 */
export async function hydrateByKeys<T>(
  keys: string[],
  field: 'id' | 'code',
  fetchPage: (args: { advance: string; perpage: number }) => Promise<PagedPage<T>>,
): Promise<{ rows: T[]; failed: boolean }> {
  const unique = Array.from(new Set(keys));
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += HYDRATE_CHUNK) chunks.push(unique.slice(i, i + HYDRATE_CHUNK));
  const settled = await Promise.allSettled(
    chunks.map((chunk) =>
      fetchPage({
        advance: JSON.stringify({ where: { [field]: { in: chunk } } }),
        perpage: chunk.length,
      }),
    ),
  );
  const rows: T[] = [];
  let failed = false;
  for (const s of settled) {
    if (s.status === 'fulfilled') rows.push(...(s.value.data || []));
    else failed = true;
  }
  return { rows, failed };
}

/**
 * แปลงคีย์ที่เลือกไว้ (อาจอยู่นอกหน้าแรกของรายการค้นหา) เป็นแถวเต็ม
 * ดึงเฉพาะคีย์ที่ยังไม่อยู่ใน `byKey` · `pending` = ยังรอผล · `missing` = ไม่พบหรือ chunk พัง
 *
 * `fetchByKeys` ไม่ต้อง stable — เก็บไว้ใน ref; effect ผูกกับเนื้อหาของ `keys` เท่านั้น
 */
export function useHydratedOptions<T>(
  keys: string[],
  keyOf: (row: T) => string,
  fetchByKeys: (keys: string[]) => Promise<{ rows: T[]; failed: boolean }>,
): { byKey: Map<string, T>; pending: Set<string>; missing: Set<string> } {
  const [byKey, setByKey] = useState<Map<string, T>>(() => new Map());
  const [missing, setMissing] = useState<Set<string>>(() => new Set());
  const [inflight, setInflight] = useState<Set<string>>(() => new Set());
  const generationRef = useRef(0);
  const byKeyRef = useRef(byKey);
  const keyOfRef = useRef(keyOf);
  const fetchRef = useRef(fetchByKeys);
  keyOfRef.current = keyOf;
  fetchRef.current = fetchByKeys;

  const signature = JSON.stringify(Array.from(new Set(keys)).sort());

  useEffect(() => {
    const wanted = JSON.parse(signature) as string[];
    const toFetch = wanted.filter((k) => !byKeyRef.current.has(k));
    if (toFetch.length === 0) {
      generationRef.current++;
      setInflight(new Set());
      setMissing(new Set());
      return;
    }
    const generation = ++generationRef.current;
    setInflight(new Set(toFetch));
    setMissing(new Set());
    fetchRef
      .current(toFetch)
      .catch(() => ({ rows: [] as T[], failed: true }))
      .then(({ rows }) => {
        if (generation !== generationRef.current) return;
        const next = new Map(byKeyRef.current);
        for (const r of rows) next.set(keyOfRef.current(r), r);
        byKeyRef.current = next;
        setByKey(next);
        setMissing(new Set(toFetch.filter((k) => !next.has(k))));
        setInflight(new Set());
      });
  }, [signature]);

  return { byKey, pending: inflight, missing };
}

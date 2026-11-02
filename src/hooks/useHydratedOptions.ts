import { useEffect, useMemo, useRef, useState } from 'react';
import type { PagedPage } from './usePagedSearch';

/** จำนวนค่าสูงสุดต่อ request ตอน hydrate */
export const HYDRATE_CHUNK = 100;

export interface HydrateResult<T> {
  rows: T[];
  /** มีอย่างน้อยหนึ่ง chunk พัง */
  failed: boolean;
  /** คีย์ของ chunk ที่พัง — ยังไม่รู้ว่ามีจริงหรือไม่ (ลองใหม่ได้) · ไม่ส่งมา + failed = ถือว่าคีย์ที่ไม่ได้คืนมาพังทั้งหมด */
  failedKeys?: string[];
}

/**
 * ดึงแถวตามชุดคีย์ (id หรือ code) ผ่าน `advance` ทีละ HYDRATE_CHUNK ด้วย Promise.allSettled
 * chunk ที่พัง → `failed: true` + คีย์ของ chunk นั้นอยู่ใน `failedKeys`
 */
export async function hydrateByKeys<T>(
  keys: string[],
  field: 'id' | 'code',
  fetchPage: (args: { advance: string; perpage: number }) => Promise<PagedPage<T>>,
): Promise<HydrateResult<T>> {
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
  const failedKeys: string[] = [];
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled') rows.push(...(s.value.data || []));
    else failedKeys.push(...chunks[i]);
  });
  return { rows, failed: failedKeys.length > 0, failedKeys };
}

export interface HydratedOptionsConfig<T> {
  /**
   * แถวที่ผู้เรียกถืออยู่แล้ว (เช่นผลค้นหาที่เพิ่งเลือก) — รวมเข้า `byKey` ระหว่าง render
   * และไม่ถูกดึงซ้ำ · ถ้าแถวหลุดจาก `known` ทีหลังโดยยังไม่เคย hydrate คีย์นั้นจะถูกดึงตามปกติ
   */
  known?: ReadonlyArray<T | null | undefined> | null;
}

/**
 * แปลงคีย์ที่เลือกไว้ (อาจอยู่นอกหน้าแรกของรายการค้นหา) เป็นแถวเต็ม
 * ดึงเฉพาะคีย์ที่ยังไม่อยู่ใน `byKey`/`known` และยังไม่เคยยืนยันว่าไม่มีจริง
 * `pending` คำนวณระหว่าง render — ไม่มีเฟรมที่คีย์ไม่อยู่ในสถานะใดเลย
 * `missing` = ใช้แสดงผลเป็น not-found: ไม่พบจริง (สะสมไว้ ไม่ดึงซ้ำ) **หรือ** chunk พัง
 * `failed` = เฉพาะส่วนที่ chunk พัง — ลองใหม่เมื่อ `keys` เปลี่ยนหรือ remount
 *
 * `fetchByKeys` ไม่ต้อง stable — เก็บไว้ใน ref; effect ผูกกับเนื้อหาของ `keys`
 * (และชุดคีย์ที่ยัง resolve ไม่ได้ เพื่อดึงคีย์ที่หลุดจาก `known`)
 */
export function useHydratedOptions<T>(
  keys: string[],
  keyOf: (row: T) => string,
  fetchByKeys: (keys: string[]) => Promise<HydrateResult<T>>,
  config?: HydratedOptionsConfig<T>,
): { byKey: Map<string, T>; pending: Set<string>; missing: Set<string>; failed: Set<string> } {
  const [byKeyState, setByKey] = useState<Map<string, T>>(() => new Map());
  const [notFound, setNotFound] = useState<Set<string>>(() => new Set());
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const generationRef = useRef(0);
  const byKeyRef = useRef(byKeyState);
  const notFoundRef = useRef(notFound);
  const failedRef = useRef(failed);
  const keyOfRef = useRef(keyOf);
  const fetchRef = useRef(fetchByKeys);
  const lastSignatureRef = useRef<string | null>(null);
  keyOfRef.current = keyOf;
  fetchRef.current = fetchByKeys;

  const signature = JSON.stringify(Array.from(new Set(keys)).sort());
  const wanted = useMemo(() => JSON.parse(signature) as string[], [signature]);

  // รวม `known` เข้ากับแถวที่ hydrate แล้ว (เฉพาะคีย์ที่ต้องการ) — คำนวณระหว่าง render
  const known = config?.known;
  let byKey = byKeyState;
  if (known && known.length > 0) {
    const wantedSet = new Set(wanted);
    let merged: Map<string, T> | null = null;
    for (const row of known) {
      if (!row) continue;
      const k = keyOf(row);
      if (!wantedSet.has(k) || byKeyState.has(k)) continue;
      if (!merged) merged = new Map(byKeyState);
      merged.set(k, row);
    }
    if (merged) byKey = merged;
  }
  const mergedRef = useRef(byKey);
  mergedRef.current = byKey;

  const unresolvedSig = JSON.stringify(
    wanted.filter((k) => !byKey.has(k) && !notFound.has(k) && !failed.has(k)),
  );

  useEffect(() => {
    // คีย์เปลี่ยน → คีย์ที่ chunk เคยพังลองใหม่ด้วย · แค่ known เปลี่ยน → ดึงเฉพาะที่ยัง resolve ไม่ได้
    const keysChanged = lastSignatureRef.current !== signature;
    lastSignatureRef.current = signature;
    const toFetch = (JSON.parse(signature) as string[]).filter(
      (k) =>
        !mergedRef.current.has(k) &&
        !notFoundRef.current.has(k) &&
        (keysChanged || !failedRef.current.has(k)),
    );
    if (toFetch.length === 0) return;
    const generation = ++generationRef.current;
    fetchRef
      .current(toFetch)
      .catch((): HydrateResult<T> => ({ rows: [], failed: true, failedKeys: toFetch }))
      .then((res) => {
        if (generation !== generationRef.current) return;
        const nextByKey = new Map(byKeyRef.current);
        for (const r of res.rows) nextByKey.set(keyOfRef.current(r), r);
        const failedKeys = new Set(res.failedKeys ?? (res.failed ? toFetch : []));
        const nextNotFound = new Set(notFoundRef.current);
        const nextFailed = new Set(failedRef.current);
        for (const k of toFetch) {
          nextFailed.delete(k);
          if (nextByKey.has(k)) continue;
          if (failedKeys.has(k)) nextFailed.add(k);
          else nextNotFound.add(k);
        }
        byKeyRef.current = nextByKey;
        notFoundRef.current = nextNotFound;
        failedRef.current = nextFailed;
        setByKey(nextByKey);
        setNotFound(nextNotFound);
        setFailed(nextFailed);
      });
  }, [signature, unresolvedSig]);

  const pending = useMemo(
    () => new Set(wanted.filter((k) => !byKey.has(k) && !notFound.has(k) && !failed.has(k))),
    [wanted, byKey, notFound, failed],
  );

  // สำหรับแสดงผล: chunk พัง = แสดงเหมือนหาไม่เจอ (แต่ยังลองใหม่ได้)
  const missing = useMemo(() => {
    if (failed.size === 0) return notFound;
    const out = new Set(notFound);
    failed.forEach((k) => out.add(k));
    return out;
  }, [notFound, failed]);

  return { byKey, pending, missing, failed };
}

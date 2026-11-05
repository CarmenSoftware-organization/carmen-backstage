import { useCallback, useEffect, useState } from 'react';

/**
 * Selection state for a server-side DataTable with `enableRowSelection`.
 *
 * Selection is current-page only: pass a `resultKey` that changes whenever the
 * result set does (page, page size, search, sort, filters). Without the reset,
 * TanStack keeps the selection map keyed by row id across loads, leaving
 * off-page rows selected — and deletable — while no visible box is ticked.
 */
export function usePageSelection<T>(resultKey: string) {
  const [selected, setSelected] = useState<T[]>([]);
  const [resetKey, setResetKey] = useState(0);

  const onSelectionChange = useCallback((rows: T[]) => setSelected(rows), []);

  const clear = useCallback(() => {
    setSelected([]);
    setResetKey((k) => k + 1);
  }, []);

  useEffect(() => {
    clear();
  }, [clear, resultKey]);

  return { selected, onSelectionChange, resetKey, clear };
}

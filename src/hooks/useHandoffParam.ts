import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * A one-shot filter handed to a list page in its URL — e.g. the Dashboard's attention band links
 * to `/licenses?tab=subscription&filter=expiring`.
 *
 * Returns the value seen on the first render and then strips the param from the URL, so the
 * page's own filter state (persisted in localStorage) takes over: a later toggle is not fought by
 * a stale param, and reloading the page does not re-apply a filter the user has since cleared.
 *
 * The read is pure (a `useState` initializer, safe under StrictMode's double invoke); the strip
 * goes through react-router's `setSearchParams`, never `history.replaceState`, so other readers
 * of the search params on the same page (LicenseCenter's `?tab=`) do not copy the param back.
 */
export function useHandoffParam(key: string): string | null {
  const [searchParams, setSearchParams] = useSearchParams();
  const [value] = useState(() => searchParams.get(key));

  useEffect(() => {
    if (value === null) return;
    setSearchParams(
      (prev) => {
        if (!prev.has(key)) return prev;
        const next = new URLSearchParams(prev);
        next.delete(key);
        return next;
      },
      { replace: true },
    );
    // once: a handoff is consumed on arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return value;
}

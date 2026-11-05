import { toast } from 'sonner';

interface Messages {
  allOk: (count: number) => string;
  allFailed: (count: number) => string;
  partial: (ok: number, fail: number) => string;
  /** Turns the first rejection into a toast description (e.g. getErrorDetail). */
  detail: (err: unknown) => string | undefined;
}

/** Toasts the outcome of a parallel bulk delete and returns how many succeeded. */
export function summarizeBulkDelete(results: PromiseSettledResult<unknown>[], m: Messages): number {
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  const fail = results.length - ok;
  if (fail === 0) toast.success(m.allOk(ok));
  else if (ok === 0) {
    const first = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    toast.error(m.allFailed(fail), { description: first ? m.detail(first.reason) : undefined });
  } else toast.warning(m.partial(ok, fail));
  return ok;
}

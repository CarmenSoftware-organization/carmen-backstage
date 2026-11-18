import { describe, expect, it, vi } from 'vitest';
import { apiErrorMessage, isLockTimeout, withRateLimitRetry } from './fleetRequest';

const httpError = (status: number, message?: string) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: message ? { message } : {} },
  });

describe('withRateLimitRetry', () => {
  it('retries a 429 and returns the later success', async () => {
    const fn = vi.fn().mockRejectedValueOnce(httpError(429)).mockResolvedValueOnce('ok');
    await expect(withRateLimitRetry(fn, { waitMs: 1 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry any other failure', async () => {
    const fn = vi.fn().mockRejectedValue(httpError(400, 'bad'));
    await expect(withRateLimitRetry(fn, { waitMs: 1 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after the retry budget', async () => {
    const fn = vi.fn().mockRejectedValue(httpError(429));
    await expect(withRateLimitRetry(fn, { retries: 2, waitMs: 1 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('apiErrorMessage', () => {
  it('prefers the server message over the axios one', () => {
    expect(apiErrorMessage(httpError(400, 'Failed to apply ddl: cannot drop columns from view (42P16)'), 'x')).toBe(
      'Failed to apply ddl: cannot drop columns from view (42P16)',
    );
  });

  it('falls back to the error message, then the fallback', () => {
    expect(apiErrorMessage(new Error('Network Error'), 'x')).toBe('Network Error');
    expect(apiErrorMessage({}, 'fallback')).toBe('fallback');
  });
});

describe('isLockTimeout', () => {
  it('recognises the Postgres lock timeout', () => {
    expect(isLockTimeout('Failed to apply ddl: canceling statement due to lock timeout (55P03)')).toBe(true);
    expect(isLockTimeout('cannot drop columns from view')).toBe(false);
  });
});

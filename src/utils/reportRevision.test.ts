import { describe, expect, it } from 'vitest';
import { formatRevision, nextRevision, revisionOf } from './reportRevision';

describe('reportRevision', () => {
  it('reads the revision columns', () => {
    expect(revisionOf({ revision_major: 1, revision_minor: 2 })).toEqual({ major: 1, minor: 2 });
  });

  it('is null on a record from a backend without revisions', () => {
    expect(revisionOf({})).toBeNull();
    expect(revisionOf(null)).toBeNull();
    expect(revisionOf({ revision_major: 1 })).toBeNull();
  });

  it('formats minor as a counter, not a decimal', () => {
    expect(formatRevision({ major: 1, minor: 0 })).toBe('1.0');
    expect(formatRevision({ major: 2, minor: 10 })).toBe('2.10');
  });

  it('minor moves the number after the dot, major moves the one before and resets minor', () => {
    expect(nextRevision({ major: 1, minor: 2 }, 'minor')).toEqual({ major: 1, minor: 3 });
    expect(nextRevision({ major: 1, minor: 9 }, 'minor')).toEqual({ major: 1, minor: 10 });
    expect(nextRevision({ major: 1, minor: 2 }, 'major')).toEqual({ major: 2, minor: 0 });
    expect(nextRevision({ major: 1, minor: 2 }, 'none')).toEqual({ major: 1, minor: 2 });
  });
});

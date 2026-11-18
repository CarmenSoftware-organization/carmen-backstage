import { describe, expect, it } from 'vitest';
import {
  buildFleetRows,
  defaultTargets,
  matchesFilter,
  objectKey,
  pickSourceBu,
  runSignature,
  summarizeRows,
  type BuScan,
  type FleetBu,
} from './fleetMatrix';
import type { DbObjectFingerprint } from '../../types';

const bu = (code: string): FleetBu => ({ code, name: code, schema: code });
const view = (name: string, hash: string): DbObjectFingerprint => ({ type: 'view', name, identity_args: '', hash });
const fn = (name: string, args: string, hash: string): DbObjectFingerprint => ({
  type: 'function',
  name,
  identity_args: args,
  hash,
});

const BUS = ['A1', 'B1', 'C1', 'D1'].map(bu);

describe('buildFleetRows', () => {
  const scans: Record<string, BuScan> = {
    A1: { state: 'ok', objects: [view('v_same', 'h1'), view('v_diff', 'x'), fn('f', 'a int', 'f1')] },
    B1: { state: 'ok', objects: [view('v_same', 'h1'), view('v_diff', 'y'), fn('f', 'a int', 'f1')] },
    C1: { state: 'ok', objects: [view('v_same', 'h1'), view('v_diff', 'y'), fn('f', 'a text', 'f2')] },
    D1: { state: 'error', message: 'down' },
  };
  const rows = buildFleetRows(BUS, scans);
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));

  it('keeps BUs that failed to scan out of the comparison', () => {
    expect(byKey['view:v_same()'].missing).toEqual([]);
    expect(byKey['view:v_same()'].isMissing).toBe(false);
  });

  it('labels the most common variant A', () => {
    const r = byKey['view:v_diff()'];
    expect(r.isDiffering).toBe(true);
    expect(r.variants.map((v) => [v.label, v.hash, v.bus])).toEqual([
      ['A', 'y', ['B1', 'C1']],
      ['B', 'x', ['A1']],
    ]);
  });

  it('treats overloads as separate objects', () => {
    expect(byKey['function:f(a int)'].missing).toEqual(['C1']);
    expect(byKey['function:f(a text)'].missing).toEqual(['A1', 'B1']);
  });

  it('summarizes and filters with overlapping missing/differs', () => {
    expect(summarizeRows(rows)).toEqual({ total: 4, same: 1, missing: 2, differs: 1 });
    expect(rows.filter((r) => matchesFilter(r, 'same')).map((r) => r.key)).toEqual(['view:v_same()']);
    expect(rows.filter((r) => matchesFilter(r, 'all'))).toHaveLength(4);
  });
});

describe('pickSourceBu / defaultTargets', () => {
  const rows = buildFleetRows(BUS, {
    A1: { state: 'ok', objects: [view('v', 'x')] },
    B1: { state: 'ok', objects: [view('v', 'y')] },
    C1: { state: 'ok', objects: [view('v', 'y')] },
    D1: { state: 'ok', objects: [] },
  });
  const row = rows[0];

  it('takes the first BU of the most common variant', () => {
    expect(pickSourceBu(row)).toBe('B1');
  });

  it('targets the missing BUs and the differing ones, never the source or its twins', () => {
    expect(defaultTargets(row, 'B1')).toEqual(['A1', 'D1']);
    expect(defaultTargets(row, 'A1')).toEqual(['B1', 'C1', 'D1']);
  });

  it('targets every BU that has a scan when there is no source (new object)', () => {
    expect(defaultTargets(row, null)).toEqual(['A1', 'B1', 'C1', 'D1']);
  });
});

describe('runSignature', () => {
  it('ignores target order but not SQL or target changes', () => {
    expect(runSignature('x', ['B', 'A'])).toBe(runSignature('x', ['A', 'B']));
    expect(runSignature('x', ['A'])).not.toBe(runSignature('x ', ['A']));
    expect(runSignature('x', ['A'])).not.toBe(runSignature('x', ['A', 'B']));
  });
});

describe('objectKey', () => {
  it('includes the argument list', () => {
    expect(objectKey({ type: 'function', name: 'f', identity_args: 'p date' })).toBe('function:f(p date)');
  });
});

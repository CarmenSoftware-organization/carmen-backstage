import { describe, expect, it } from 'vitest';
import {
  buildFleetRows,
  defaultTargets,
  findUnregistered,
  matchesFilter,
  objectKey,
  pickImportBu,
  runSignature,
  summarizeRows,
  type BuScan,
  type FleetBu,
} from './fleetMatrix';
import type { DbObjectFingerprint, DbObjectRegistryRow } from '../../types';

const bu = (code: string): FleetBu => ({ code, name: code, schema: code });
const view = (name: string, hash: string): DbObjectFingerprint => ({ type: 'view', name, identity_args: '', hash });
const fn = (name: string, args: string, hash: string): DbObjectFingerprint => ({
  type: 'function',
  name,
  identity_args: args,
  hash,
});
const reg = (o: DbObjectFingerprint, id: string): DbObjectRegistryRow => ({ ...o, id });

const BUS = ['A1', 'B1', 'C1', 'D1'].map(bu);
const SCANS: Record<string, BuScan> = {
  A1: { state: 'ok', objects: [view('v', 'x'), fn('f', 'a int', 'f1'), view('v_only_bu', 'q')] },
  B1: { state: 'ok', objects: [view('v', 'OLD'), fn('f', 'a int', 'f1'), view('v_only_bu', 'q')] },
  C1: { state: 'ok', objects: [fn('f', 'a int', 'f1'), fn('f', 'a text', 'other')] },
  D1: { state: 'error', message: 'down' },
};
const REGISTRY = [reg(view('v', 'x'), '1'), reg(fn('f', 'a int', 'f1'), '2')];

describe('buildFleetRows', () => {
  const rows = buildFleetRows(REGISTRY, BUS, SCANS);

  it('makes one row per registry definition, sorted by kind then name', () => {
    expect(rows.map((r) => r.key)).toEqual(['function:f(a int)', 'view:v()']);
  });

  it('marks each scanned BU as match, outdated or missing against the registry hash', () => {
    const v = rows[1];
    expect(v.statusByBu).toEqual({ A1: 'match', B1: 'outdated', C1: 'missing' });
    expect(v.outdated).toEqual(['B1']);
    expect(v.missing).toEqual(['C1']);
    expect(v.needsApply).toBe(true);
  });

  it('leaves a BU that failed to scan out of the comparison', () => {
    expect(rows[0].statusByBu.D1).toBeUndefined();
    expect(rows[0].needsApply).toBe(false);
  });

  it('summarizes and filters', () => {
    expect(summarizeRows(rows)).toEqual({ total: 2, synced: 1, needs: 1 });
    expect(rows.filter((r) => matchesFilter(r, 'needs')).map((r) => r.name)).toEqual(['v']);
    expect(rows.filter((r) => matchesFilter(r, 'synced')).map((r) => r.name)).toEqual(['f']);
    expect(rows.filter((r) => matchesFilter(r, 'all'))).toHaveLength(2);
  });

  it('targets the outdated and the missing BUs by default', () => {
    expect(defaultTargets(rows[1])).toEqual(['B1', 'C1']);
    expect(defaultTargets(rows[0])).toEqual([]);
  });

  it('shows every definition as needing nothing while no BU has been read', () => {
    const none = buildFleetRows(REGISTRY, BUS, {});
    expect(none.every((r) => !r.needsApply)).toBe(true);
  });
});

describe('findUnregistered / pickImportBu', () => {
  const found = findUnregistered(REGISTRY, BUS, SCANS);

  it('lists objects a BU has but the registry does not, with the BUs holding them', () => {
    expect(found.map((o) => [o.key, o.bus])).toEqual([
      ['function:f(a text)', ['C1']],
      ['view:v_only_bu()', ['A1', 'B1']],
    ]);
  });

  it('picks the BU holding the most of them, first code on a tie', () => {
    expect(pickImportBu(found)).toBe('A1');
    expect(pickImportBu([])).toBeNull();
  });
});

describe('runSignature', () => {
  it('ignores target order but not SQL or target changes', () => {
    expect(runSignature('a', ['B', 'A'])).toBe(runSignature('a', ['A', 'B']));
    expect(runSignature('a', ['A'])).not.toBe(runSignature('b', ['A']));
    expect(runSignature('a', ['A'])).not.toBe(runSignature('a', ['A', 'B']));
  });
});

describe('objectKey', () => {
  it('includes the argument list', () => {
    expect(objectKey(fn('f', 'a int', 'h'))).toBe('function:f(a int)');
  });
});

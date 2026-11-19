import type { DbObjectFingerprint, DbObjectKind, DbObjectRegistryRow } from '../../types';

/** A BU the page compares — only active BUs that have a tenant schema. */
export interface FleetBu {
  code: string;
  name: string;
  schema: string;
}

/** Where one BU's scan stands. Only `ok` BUs take part in the comparison. */
export type BuScan =
  | { state: 'loading' }
  | { state: 'ok'; objects: DbObjectFingerprint[] }
  | { state: 'error'; message: string };

/** How one BU's copy of an object stands against the registry definition. */
export type BuStatus = 'match' | 'outdated' | 'missing';

/** One registry definition, with how every scanned BU stands against it. */
export interface FleetRow {
  key: string;
  id: string;
  type: DbObjectKind;
  name: string;
  identity_args: string;
  /** fingerprint of the registry definition */
  hash: string;
  /** status per BU code, for BUs that were scanned */
  statusByBu: Record<string, BuStatus>;
  /** BUs holding a definition that differs from the registry */
  outdated: string[];
  /** BUs that do not have the object */
  missing: string[];
  /** true when at least one scanned BU is outdated or missing */
  needsApply: boolean;
  /** false while the latest edit has not been approved (or the row has no structured form yet) */
  approved: boolean;
}

/** An object to copy into the registry from a BU. */
export interface UnregisteredObject {
  key: string;
  type: DbObjectKind;
  name: string;
  identity_args: string;
  /** BUs that hold it */
  bus: string[];
  /**
   * true = the registry has a row for it, but one saved before structured definitions: it must
   * be imported again before it can be edited or applied. Absent = not in the registry at all.
   */
  stale?: boolean;
}

export type RowFilter = 'all' | 'synced' | 'needs';

/** Identity of an object: kind + name + argument list (overloads are separate objects). */
export const objectKey = (o: { type: DbObjectKind; name: string; identity_args: string }): string =>
  `${o.type}:${o.name}(${o.identity_args})`;

const okCodes = (bus: FleetBu[], scans: Record<string, BuScan>): string[] =>
  bus.filter((b) => scans[b.code]?.state === 'ok').map((b) => b.code);

const byIdentity = (
  a: { type: string; name: string; identity_args: string },
  b: { type: string; name: string; identity_args: string },
): number =>
  a.type.localeCompare(b.type) || a.name.localeCompare(b.name) || a.identity_args.localeCompare(b.identity_args);

/**
 * Compare every scanned BU against the registry: one row per registry definition. BUs still
 * loading or failed are left out entirely — a BU we could not read is not evidence that an
 * object is missing there.
 */
export function buildFleetRows(
  registry: DbObjectRegistryRow[],
  bus: FleetBu[],
  scans: Record<string, BuScan>,
): FleetRow[] {
  const codes = okCodes(bus, scans);
  const hashes = new Map<string, Map<string, string>>();
  for (const code of codes) {
    const scan = scans[code];
    if (scan?.state !== 'ok') continue;
    hashes.set(code, new Map(scan.objects.map((o) => [objectKey(o), o.hash])));
  }
  return registry
    .map((r) => {
      const key = objectKey(r);
      const statusByBu: Record<string, BuStatus> = {};
      const outdated: string[] = [];
      const missing: string[] = [];
      for (const code of codes) {
        const h = hashes.get(code)?.get(key);
        if (h === undefined) {
          statusByBu[code] = 'missing';
          missing.push(code);
        } else if (h !== r.hash) {
          statusByBu[code] = 'outdated';
          outdated.push(code);
        } else {
          statusByBu[code] = 'match';
        }
      }
      return {
        key,
        id: r.id,
        type: r.type,
        name: r.name,
        identity_args: r.identity_args,
        hash: r.hash,
        statusByBu,
        outdated,
        missing,
        needsApply: outdated.length + missing.length > 0,
        // a backend that predates approval sends neither field: treat its rows as approved
        approved: r.approved !== false && r.has_spec !== false,
      };
    })
    .sort(byIdentity);
}

/** Objects found in a scanned BU that the registry does not hold — candidates for import. */
export function findUnregistered(
  registry: DbObjectRegistryRow[],
  bus: FleetBu[],
  scans: Record<string, BuScan>,
): UnregisteredObject[] {
  const known = new Set(registry.map(objectKey));
  const found = new Map<string, UnregisteredObject>();
  for (const code of okCodes(bus, scans)) {
    const scan = scans[code];
    if (scan?.state !== 'ok') continue;
    for (const o of scan.objects) {
      const key = objectKey(o);
      if (known.has(key)) continue;
      const entry = found.get(key) ?? { key, type: o.type, name: o.name, identity_args: o.identity_args, bus: [] };
      entry.bus.push(code);
      found.set(key, entry);
    }
  }
  return Array.from(found.values()).sort(byIdentity);
}

/**
 * Registry rows saved before structured definitions (`has_spec === false`), with the BUs that
 * hold the object — importing them again from one of those BUs gives them their structured form.
 */
export function findStale(
  registry: DbObjectRegistryRow[],
  bus: FleetBu[],
  scans: Record<string, BuScan>,
): UnregisteredObject[] {
  const holders = new Map<string, string[]>();
  for (const code of okCodes(bus, scans)) {
    const scan = scans[code];
    if (scan?.state !== 'ok') continue;
    for (const o of scan.objects) {
      const key = objectKey(o);
      holders.set(key, [...(holders.get(key) ?? []), code]);
    }
  }
  return registry
    .filter((r) => r.has_spec === false)
    .map((r) => ({
      key: objectKey(r),
      type: r.type,
      name: r.name,
      identity_args: r.identity_args,
      bus: holders.get(objectKey(r)) ?? [],
      stale: true,
    }))
    .sort(byIdentity);
}

/** The BU holding the most unregistered objects — the natural one to import from. */
export function pickImportBu(unregistered: UnregisteredObject[]): string | null {
  const counts = new Map<string, number>();
  for (const o of unregistered) for (const code of o.bus) counts.set(code, (counts.get(code) ?? 0) + 1);
  let best: string | null = null;
  counts.forEach((n, code) => {
    if (best === null || n > (counts.get(best) ?? 0) || (n === counts.get(best) && code < best)) best = code;
  });
  return best;
}

export function matchesFilter(row: FleetRow, filter: RowFilter): boolean {
  if (filter === 'needs') return row.needsApply;
  if (filter === 'synced') return !row.needsApply;
  return true;
}

export function summarizeRows(rows: FleetRow[]): { total: number; synced: number; needs: number } {
  const needs = rows.filter((r) => r.needsApply).length;
  return { total: rows.length, synced: rows.length - needs, needs };
}

/** BUs the registry definition should be applied to: the outdated ones and the ones without it. */
export function defaultTargets(row: FleetRow): string[] {
  return [...row.outdated, ...row.missing].sort();
}

/**
 * Key a dry-run result to exactly what it tested. Apply is allowed only while the SQL and the
 * target list are the ones that passed — change either and the user must try again.
 */
export function runSignature(sqlText: string, targets: string[]): string {
  return `${[...targets].sort().join(',')}\n${sqlText}`;
}

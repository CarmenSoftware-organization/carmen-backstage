import type { DbObjectFingerprint, DbObjectKind } from '../../types';

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

export interface FleetVariant {
  hash: string;
  /** A, B, C … — A is the definition most BUs share. */
  label: string;
  bus: string[];
}

/** One object across every scanned BU. */
export interface FleetRow {
  key: string;
  type: DbObjectKind;
  name: string;
  identity_args: string;
  /** hash per BU code, for BUs that have the object */
  byBu: Record<string, string>;
  variants: FleetVariant[];
  /** scanned BUs that do not have the object */
  missing: string[];
  isMissing: boolean;
  isDiffering: boolean;
}

export type RowFilter = 'all' | 'missing' | 'differs' | 'same';

/** Identity of an object across BUs: kind + name + argument list (overloads are separate objects). */
export const objectKey = (o: { type: DbObjectKind; name: string; identity_args: string }): string =>
  `${o.type}:${o.name}(${o.identity_args})`;

const variantLabel = (i: number): string =>
  i < 26 ? String.fromCharCode(65 + i) : `V${i + 1}`;

/**
 * Fold the per-BU scans into one row per object. BUs still loading or failed are left out
 * entirely — a BU we could not read is not evidence that an object is missing there.
 */
export function buildFleetRows(bus: FleetBu[], scans: Record<string, BuScan>): FleetRow[] {
  const okBus = bus.filter((b) => scans[b.code]?.state === 'ok').map((b) => b.code);
  const rows = new Map<string, FleetRow>();
  for (const code of okBus) {
    const scan = scans[code];
    if (scan?.state !== 'ok') continue;
    for (const o of scan.objects) {
      const key = objectKey(o);
      let row = rows.get(key);
      if (!row) {
        row = {
          key,
          type: o.type,
          name: o.name,
          identity_args: o.identity_args,
          byBu: {},
          variants: [],
          missing: [],
          isMissing: false,
          isDiffering: false,
        };
        rows.set(key, row);
      }
      row.byBu[code] = o.hash;
    }
  }
  rows.forEach((row) => {
    const groups = new Map<string, string[]>();
    for (const code of okBus) {
      const h = row.byBu[code];
      if (h === undefined) row.missing.push(code);
      else groups.set(h, [...(groups.get(h) ?? []), code]);
    }
    row.variants = Array.from(groups.entries())
      .map(([hash, list]) => ({ hash, bus: list, label: '' }))
      // most BUs first; ties broken by the first BU code so the order is stable between scans
      .sort((a, b) => b.bus.length - a.bus.length || a.bus[0].localeCompare(b.bus[0]))
      .map((v, i) => ({ ...v, label: variantLabel(i) }));
    row.isMissing = row.missing.length > 0;
    row.isDiffering = row.variants.length > 1;
  });
  return Array.from(rows.values()).sort(
    (a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name) || a.identity_args.localeCompare(b.identity_args),
  );
}

/** Rows a filter keeps. `missing` and `differs` overlap: a row can be both. */
export function matchesFilter(row: FleetRow, filter: RowFilter): boolean {
  if (filter === 'missing') return row.isMissing;
  if (filter === 'differs') return row.isDiffering;
  if (filter === 'same') return !row.isMissing && !row.isDiffering;
  return true;
}

export function summarizeRows(rows: FleetRow[]): { total: number; same: number; missing: number; differs: number } {
  let same = 0;
  let missing = 0;
  let differs = 0;
  for (const r of rows) {
    if (r.isMissing) missing++;
    if (r.isDiffering) differs++;
    if (!r.isMissing && !r.isDiffering) same++;
  }
  return { total: rows.length, same, missing, differs };
}

/** The BU to take the definition from by default: the first BU of the most common variant. */
export function pickSourceBu(row: FleetRow): string | null {
  return row.variants[0]?.bus[0] ?? null;
}

/**
 * BUs that would change if the source BU's definition were applied: the ones without the
 * object and the ones holding a different variant. The source BU itself is never included.
 */
export function defaultTargets(row: FleetRow, sourceBu: string | null): string[] {
  const sourceHash = sourceBu ? row.byBu[sourceBu] : undefined;
  const differing = Object.entries(row.byBu)
    .filter(([code, hash]) => code !== sourceBu && hash !== sourceHash)
    .map(([code]) => code);
  return [...row.missing, ...differing].sort();
}

/**
 * Key a dry-run result to exactly what it tested. Apply is allowed only while the SQL and the
 * target list are the ones that passed — edit either and the user must try again.
 */
export function runSignature(sqlText: string, targets: string[]): string {
  return `${[...targets].sort().join(',')}\n${sqlText}`;
}

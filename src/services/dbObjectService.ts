import api from './api';
import type {
  DbObjectImportResult,
  DbObjectKind,
  DbObjectRegistryEntry,
  DbObjectRegistryRow,
} from '../types';

// The central registry is platform data, not a BU's: it lives under /api-system.
const BASE = '/api-system/db-objects';

// Unwrap the standard `{ data: ... }` envelope, tolerating a bare body.
function unwrap<T>(response: { data: unknown }): T {
  const body = response.data as { data?: unknown };
  return (body?.data ?? body) as T;
}

export interface DbObjectRef {
  type: DbObjectKind;
  name: string;
  identity_args: string;
}

const dbObjectService = {
  /** Every definition in the registry, without its text. */
  list: async (): Promise<DbObjectRegistryRow[]> => unwrap<DbObjectRegistryRow[]>(await api.get(BASE)),

  get: async (id: string): Promise<DbObjectRegistryEntry> =>
    unwrap<DbObjectRegistryEntry>(await api.get(`${BASE}/${id}`)),

  /** Store a new definition. Nothing is applied to any BU. */
  create: async (input: DbObjectRef & { definition: string; note?: string | null }): Promise<DbObjectRegistryEntry> =>
    unwrap<DbObjectRegistryEntry>(await api.post(BASE, input)),

  /** Replace the text. Send the doc_version that was read — a stale one answers 409. */
  update: async (
    id: string,
    input: { definition: string; note?: string | null; doc_version?: number },
  ): Promise<DbObjectRegistryEntry> => unwrap<DbObjectRegistryEntry>(await api.put(`${BASE}/${id}`, input)),

  /** Take the definition out of the registry. The object stays in every BU that has it. */
  remove: async (id: string): Promise<{ id: string }> => unwrap<{ id: string }>(await api.delete(`${BASE}/${id}`)),

  /** Copy definitions from one BU as it holds them now; omit `objects` to take them all. */
  importFromBu: async (buCode: string, objects?: DbObjectRef[]): Promise<DbObjectImportResult> =>
    unwrap<DbObjectImportResult>(await api.post(`${BASE}/import`, { bu_code: buCode, objects })),
};

export default dbObjectService;

import api from './api';
import type {
  ApplyPortableDdlResult,
  DbObjectDeployLogRow,
  DbObjectImportResult,
  DbObjectUploadResult,
  DbObjectKind,
  DbObjectRegistryEntry,
  DbObjectRegistryRow,
  DbObjectSpec,
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

  /** Store a new definition. It starts unapproved and nothing is applied to any BU. */
  create: async (input: { spec: DbObjectSpec; note?: string | null }): Promise<DbObjectRegistryEntry> =>
    unwrap<DbObjectRegistryEntry>(await api.post(BASE, input)),

  /**
   * Replace the spec. A changed spec is unapproved again. Send the doc_version that was read —
   * a stale one answers 409.
   */
  update: async (
    id: string,
    input: { spec: DbObjectSpec; note?: string | null; doc_version?: number },
  ): Promise<DbObjectRegistryEntry> => unwrap<DbObjectRegistryEntry>(await api.put(`${BASE}/${id}`, input)),

  /** Approve the definition as it stands; 409 when it changed since `docVersion` was read. */
  approve: async (id: string, docVersion?: number): Promise<DbObjectRegistryEntry> =>
    unwrap<DbObjectRegistryEntry>(await api.post(`${BASE}/${id}/approve`, { doc_version: docVersion })),

  /** Real rollouts of this definition, newest first. */
  deployLog: async (id: string): Promise<DbObjectDeployLogRow[]> =>
    unwrap<DbObjectDeployLogRow[]>(await api.get(`${BASE}/${id}/deploy-log`)),

  /**
   * Apply (create or replace) or drop this definition in one BU. No SQL is sent: the backend
   * composes it from the stored spec. A real run needs the definition approved; `dryRun` rolls back.
   */
  applyToBu: async (
    buCode: string,
    id: string,
    action: 'apply' | 'drop',
    dryRun: boolean,
  ): Promise<ApplyPortableDdlResult> =>
    unwrap<ApplyPortableDdlResult>(
      await api.post(`/api/config/${buCode}/sql-query/db-objects/${id}/apply`, { action, dry_run: dryRun }),
    ),

  /** Take the definition out of the registry. The object stays in every BU that has it. */
  remove: async (id: string): Promise<{ id: string }> => unwrap<{ id: string }>(await api.delete(`${BASE}/${id}`)),

  /** Copy definitions from one BU as it holds them now; omit `objects` to take them all. */
  importFromBu: async (buCode: string, objects?: DbObjectRef[]): Promise<DbObjectImportResult> =>
    unwrap<DbObjectImportResult>(await api.post(`${BASE}/import`, { bu_code: buCode, objects })),

  /**
   * Read a migration file by running it in `buCode` and rolling it back; with `dryRun: false`,
   * add the objects the registry does not have yet (unapproved). Existing ones are never replaced.
   */
  uploadFile: async (input: {
    buCode: string;
    sqlText: string;
    fileName?: string;
    dryRun: boolean;
  }): Promise<DbObjectUploadResult> =>
    unwrap<DbObjectUploadResult>(
      await api.post(`${BASE}/upload`, {
        bu_code: input.buCode,
        sql_text: input.sqlText,
        file_name: input.fileName,
        dry_run: input.dryRun,
      }),
    ),
};

export default dbObjectService;

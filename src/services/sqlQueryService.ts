import api from './api';
import type {
  DbObjectsResponse,
  DbObjectDefinition,
  SqlExecuteResult,
  SaveDdlInput,
  SaveDdlResult,
  DbObjectFingerprints,
  DbObjectKind,
  PortableDefinition,
  ApplyPortableDdlResult,
} from '../types';

// The tenant SQL endpoints live under the /api proxy (not /api-system).
const base = (buCode: string) => `/api/config/${buCode}/sql-query`;

// Unwrap the standard `{ data: ... }` envelope, tolerating a bare body.
function unwrap<T>(response: { data: unknown }): T {
  const body = response.data as { data?: unknown };
  return (body?.data ?? body) as T;
}

interface DbObjectRef {
  type: string;
  schema: string;
  name: string;
}

const refQuery = ({ type, schema, name }: DbObjectRef) =>
  `type=${encodeURIComponent(type)}&schema=${encodeURIComponent(
    schema,
  )}&name=${encodeURIComponent(name)}`;

const sqlQueryService = {
  getDbObjects: async (buCode: string): Promise<DbObjectsResponse> => {
    const response = await api.get(`${base(buCode)}/db-objects`);
    return unwrap<DbObjectsResponse>(response);
  },

  getDefinition: async (
    buCode: string,
    ref: DbObjectRef,
  ): Promise<DbObjectDefinition> => {
    const response = await api.get(
      `${base(buCode)}/db-objects/definition?${refQuery(ref)}`,
    );
    return unwrap<DbObjectDefinition>(response);
  },

  // `signal` only aborts the browser's HTTP request to the gateway — it does NOT cancel the
  // query on the tenant Postgres database. The gateway's execute() handler
  // (config_sql-query.controller.ts) awaits the microservice call to completion before
  // responding and never wires client disconnect to an early unsubscribe, and the query itself
  // runs inside a Prisma transaction (sql-query.service.ts) with no cancellation hook. So an
  // abort here only stops the client from waiting; the statement keeps running server-side
  // until it finishes or hits its own statement_timeout/transaction timeout. Callers must not
  // present this as a real "Cancel" — see SqlWorkbench.tsx's abort-on-unmount usage.
  executeSql: async (
    buCode: string,
    sqlText: string,
    signal?: AbortSignal,
  ): Promise<SqlExecuteResult> => {
    const response = await api.post(
      `${base(buCode)}/execute`,
      { sql_text: sqlText },
      { signal },
    );
    return unwrap<SqlExecuteResult>(response);
  },

  saveDdl: async (buCode: string, input: SaveDdlInput): Promise<SaveDdlResult> => {
    const response = await api.post(`${base(buCode)}/save`, input);
    return unwrap<SaveDdlResult>(response);
  },

  dropObject: async (
    buCode: string,
    ref: DbObjectRef,
  ): Promise<{ dropped: boolean; type: string; schema: string; name: string }> => {
    const response = await api.delete(`${base(buCode)}/db-objects?${refQuery(ref)}`);
    return unwrap<{ dropped: boolean; type: string; schema: string; name: string }>(response);
  },

  /** One hash per view / function / procedure of the BU (schema-free), for comparing BUs. */
  getFingerprints: async (buCode: string): Promise<DbObjectFingerprints> => {
    const response = await api.get(`${base(buCode)}/db-objects/fingerprints`);
    return unwrap<DbObjectFingerprints>(response);
  },

  /** The object's definition as DDL with no schema name in it — runnable in any BU. */
  getPortableDefinition: async (
    buCode: string,
    ref: { type: DbObjectKind; name: string; identity_args: string },
  ): Promise<PortableDefinition> => {
    const q = `type=${encodeURIComponent(ref.type)}&name=${encodeURIComponent(
      ref.name,
    )}&identity_args=${encodeURIComponent(ref.identity_args)}`;
    const response = await api.get(`${base(buCode)}/db-objects/portable-definition?${q}`);
    return unwrap<PortableDefinition>(response);
  },

  /**
   * Run schema-free DDL in this BU (one transaction, the BU's own search_path, lock_timeout 5s).
   * `dryRun` runs it and rolls back. The backend refuses BU schema names and DROP ... CASCADE.
   */
  applyPortableDdl: async (
    buCode: string,
    sqlText: string,
    dryRun: boolean,
  ): Promise<ApplyPortableDdlResult> => {
    const response = await api.post(`${base(buCode)}/apply-portable-ddl`, {
      sql_text: sqlText,
      dry_run: dryRun,
    });
    return unwrap<ApplyPortableDdlResult>(response);
  },
};

export default sqlQueryService;

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DbObjectFleet from './DbObjectFleet';
import sqlQueryService from '../../services/sqlQueryService';
import dbObjectService from '../../services/dbObjectService';
import type { DbObjectFingerprint, DbObjectRegistryEntry, DbObjectRegistryRow, DbObjectSpec } from '../../types';

vi.mock('../../components/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const hasPermission = vi.fn();
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ hasPermission }),
}));

vi.mock('../../services/businessUnitService', () => ({
  default: {
    getAll: vi.fn().mockResolvedValue({
      data: [
        { id: '1', code: 'A1', name: 'Hotel A', is_active: true, db_schema: 'A_SCHEMA' },
        { id: '2', code: 'B1', name: 'Hotel B', is_active: true, db_schema: 'B_SCHEMA' },
        { id: '3', code: 'C1', name: 'Hotel C', is_active: true, db_schema: 'c_schema' },
        { id: '4', code: 'OFF', name: 'Inactive', is_active: false, db_schema: 'OFF' },
        { id: '5', code: 'NOSCHEMA', name: 'No schema', is_active: true, db_schema: null },
      ],
      paginate: { total: 5, page: 1, perpage: 100 },
    }),
  },
}));

vi.mock('../../services/sqlQueryService', () => ({
  default: {
    getFingerprints: vi.fn(),
    getPortableDefinition: vi.fn(),
    applyPortableDdl: vi.fn(),
  },
}));

vi.mock('../../services/dbObjectService', () => ({
  default: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    importFromBu: vi.fn(),
    approve: vi.fn(),
    deployLog: vi.fn(),
    applyToBu: vi.fn(),
  },
}));

// CodeMirror needs layout APIs jsdom lacks — same textarea stand-in SqlWorkbench.test uses.
vi.mock('../sqlWorkbench/SqlEditor', () => ({
  SqlEditor: ({ value, onChange, readOnly }: { value: string; onChange: (v: string) => void; readOnly?: boolean }) => (
    <textarea aria-label="sql" value={value} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const view = (name: string, hash: string): DbObjectFingerprint => ({ type: 'view', name, identity_args: '', hash });
// v_same: every BU matches the registry. v_diff: A1 matches, B1 differs from it, C1 lacks it.
// v_loose exists in A1 + B1 only and has no registry row.
const FINGERPRINTS: Record<string, DbObjectFingerprint[]> = {
  A1: [view('v_same', 'h1'), view('v_diff', 'x'), view('v_loose', 'l')],
  B1: [view('v_same', 'h1'), view('v_diff', 'OLD'), view('v_loose', 'l')],
  C1: [view('v_same', 'h1')],
};
const REGISTRY: DbObjectRegistryRow[] = [
  { ...view('v_same', 'h1'), id: 'id-same', doc_version: 0, approved: true, has_spec: true },
  { ...view('v_diff', 'x'), id: 'id-diff', doc_version: 2, approved: true, has_spec: true },
];
// The editor holds only the body; the header is the backend's.
const DIFF_SQL = 'SELECT 1';
const entryOf = (id: string, over: Partial<DbObjectRegistryEntry> = {}): DbObjectRegistryEntry => {
  const row = REGISTRY.find((r) => r.id === id) as DbObjectRegistryRow;
  const spec: DbObjectSpec = { type: 'view', name: row.name, body: 'SELECT 1' };
  return { ...row, spec, definition: `CREATE OR REPLACE VIEW "${row.name}" AS\nSELECT 1;\n`, ...over };
};

const svc = vi.mocked(sqlQueryService);
const reg = vi.mocked(dbObjectService);

const renderPage = () =>
  render(
    <MemoryRouter>
      <DbObjectFleet />
    </MemoryRouter>,
  );

const openDiffObject = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: /v_diff/ }));
  await waitFor(() => expect(screen.getByLabelText('sql')).toHaveValue(DIFF_SQL));
};

beforeEach(() => {
  vi.clearAllMocks();
  hasPermission.mockReturnValue(true);
  svc.getFingerprints.mockImplementation(async (code: string) => ({
    bu_code: code,
    schema: code,
    objects: FINGERPRINTS[code],
  }));
  svc.getPortableDefinition.mockImplementation(async (code, ref) => ({
    bu_code: code,
    schema: code,
    ...ref,
    hash: 'x',
    definition: `CREATE OR REPLACE VIEW ${ref.name} AS SELECT 0;\n`,
  }));
  reg.applyToBu.mockImplementation(async (code, _id, _action, dryRun) => ({
    bu_code: code,
    schema: code,
    dry_run: dryRun,
    statements: 1,
    duration_ms: 3,
  }));
  reg.list.mockResolvedValue(REGISTRY);
  reg.get.mockImplementation(async (id: string) => entryOf(id));
  reg.update.mockImplementation(async (id, input) =>
    entryOf(id, { spec: input.spec, doc_version: 3, hash: 'edited', approved: false }),
  );
  reg.approve.mockImplementation(async (id) => entryOf(id, { approved: true }));
  reg.deployLog.mockResolvedValue([]);
  reg.importFromBu.mockResolvedValue({ bu_code: 'A1', created: 1, updated: 0, unchanged: 0, missing: [] });
});

describe('DbObjectFleet', () => {
  it('lists the central definitions and counts how the BUs stand against them', async () => {
    renderPage();
    await waitFor(() => expect(svc.getFingerprints).toHaveBeenCalledTimes(3));
    expect(svc.getFingerprints.mock.calls.map((c) => c[0]).sort()).toEqual(['A1', 'B1', 'C1']);
    const tiles = await screen.findByRole('group', { name: /filter objects by status/i });
    await waitFor(() => expect(within(tiles).getByRole('button', { name: /central definitions/i })).toHaveTextContent('2'));
    expect(within(tiles).getByRole('button', { name: /matches in every bu/i })).toHaveTextContent('1');
    expect(within(tiles).getByRole('button', { name: /need applying/i })).toHaveTextContent('1');
    expect(within(tiles).getByRole('button', { name: /to import from a bu/i })).toHaveTextContent('1');
    // an object only BUs hold is not a row of the list
    expect(screen.queryByRole('button', { name: /^v_loose/ })).toBeNull();
  });

  it('shows each BU as matching, differing from central or not installed, and targets the ones that need it', async () => {
    const user = userEvent.setup();
    renderPage();
    await openDiffObject(user);
    expect(reg.get).toHaveBeenCalledWith('id-diff');
    const table = within(screen.getByRole('region', { name: /central definition and bus/i }));
    expect(table.getByRole('row', { name: /A1/ })).toHaveTextContent('Matches central');
    expect(table.getByRole('row', { name: /B1/ })).toHaveTextContent('Differs from central');
    expect(table.getByRole('row', { name: /C1/ })).toHaveTextContent('Not installed');
    expect(screen.queryByText(/variant/i)).toBeNull();
    expect(screen.queryByText(/^source$/i)).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Apply to A1' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Apply to B1' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Apply to C1' })).toBeChecked();
    // comparing is offered for the BU that differs, against the central definition
    // a labelled button, not a bare icon, so it can be found
    expect(screen.getByRole('button', { name: /compare b1 with the central definition/i })).toHaveTextContent('Compare');
    expect(screen.queryByRole('button', { name: /compare a1/i })).toBeNull();
  });

  it('lets only the body be written: the header fields are fixed for an existing object', async () => {
    const user = userEvent.setup();
    renderPage();
    await openDiffObject(user);
    expect(screen.getByLabelText('Kind')).toBeDisabled();
    expect(screen.getByLabelText('Name')).toBeDisabled();
    expect(screen.getByLabelText('Name')).toHaveValue('v_diff');
    // the composed DDL is shown, read-only, as the backend returned it
    expect(screen.getByText(/CREATE OR REPLACE VIEW "v_diff" AS/)).toBeInTheDocument();
  });

  it('saves an edited body as a spec; the edit is unapproved and cannot be applied until approved', async () => {
    const user = userEvent.setup();
    renderPage();
    await openDiffObject(user);
    expect(screen.getByText('Approved')).toBeInTheDocument();
    const tryBtn = screen.getByRole('button', { name: /try on 2 bu/i });

    await user.type(screen.getByLabelText('sql'), ' AS n');
    expect(tryBtn).toBeDisabled();
    expect(screen.getByText(/save the definition first/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(reg.update).toHaveBeenCalledWith('id-diff', {
        spec: { type: 'view', name: 'v_diff', body: 'SELECT 1 AS n' },
        doc_version: 2,
      }),
    );
    expect(await screen.findByText(/not approved yet/i)).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /central definition and bus/i })).getByText('Awaiting approval')).toBeInTheDocument();

    // it can be tried while unapproved…
    await user.click(tryBtn);
    await waitFor(() => expect(reg.applyToBu).toHaveBeenCalledTimes(2));
    for (const call of reg.applyToBu.mock.calls) expect(call.slice(1)).toEqual(['id-diff', 'apply', true]);
    // …but not applied or removed for real
    const apply = screen.getByRole('button', { name: 'Apply to 2 BU(s)' });
    await waitFor(() => expect(screen.getAllByText('Dry-run passed').length).toBe(2));
    expect(apply).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove from 2 BU(s)' })).toBeDisabled();

    // approving keeps the version that was tried: same fingerprint, so the dry-run still counts
    reg.approve.mockResolvedValueOnce(
      entryOf('id-diff', {
        spec: { type: 'view', name: 'v_diff', body: 'SELECT 1 AS n' },
        doc_version: 3,
        hash: 'edited',
        approved: true,
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(reg.approve).toHaveBeenCalledWith('id-diff', 3));
    await waitFor(() => expect(apply).toBeEnabled());
  });

  it('hides Approve from a user without db_object.approve', async () => {
    hasPermission.mockImplementation((p: string) => p !== 'db_object.approve');
    reg.get.mockImplementation(async (id: string) => entryOf(id, { approved: false }));
    const user = userEvent.setup();
    renderPage();
    await openDiffObject(user);
    expect(screen.getByText(/not approved yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('reloads the definition when someone else saved first', async () => {
    const user = userEvent.setup();
    reg.update.mockRejectedValueOnce(Object.assign(new Error('409'), { response: { status: 409, data: {} } }));
    renderPage();
    await openDiffObject(user);
    await user.type(screen.getByLabelText('sql'), 'x');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(reg.get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByLabelText('sql')).toHaveValue(DIFF_SQL));
  });

  it('applies by id after confirm — no SQL is sent — then settles the view, reloads history and rescans', async () => {
    const user = userEvent.setup();
    renderPage();
    await openDiffObject(user);
    await user.click(screen.getByRole('button', { name: /try on 2 bu/i }));
    const apply = screen.getByRole('button', { name: 'Apply to 2 BU(s)' });
    await waitFor(() => expect(apply).toBeEnabled());
    reg.applyToBu.mockClear();
    reg.deployLog.mockClear();
    svc.getFingerprints.mockClear();

    await user.click(apply);
    const dialog = await screen.findByRole('alertdialog').catch(() => screen.findByRole('dialog'));
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(reg.applyToBu).toHaveBeenCalledTimes(2));
    expect(reg.applyToBu.mock.calls.map((c) => c.join('|')).sort()).toEqual([
      'B1|id-diff|apply|false',
      'C1|id-diff|apply|false',
    ]);
    expect(svc.applyPortableDdl).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(reg.importFromBu).toHaveBeenCalledWith('B1', [{ type: 'view', name: 'v_diff', identity_args: '' }]),
    );
    await waitFor(() => expect(reg.deployLog).toHaveBeenCalledWith('id-diff'));
    await waitFor(() => expect(svc.getFingerprints.mock.calls.map((c) => c[0]).sort()).toEqual(['B1', 'C1']));
  });

  it('removes the object from the chosen BUs by id after confirm', async () => {
    const user = userEvent.setup();
    renderPage();
    await openDiffObject(user);
    await user.click(screen.getByRole('button', { name: 'Remove from 2 BU(s)' }));
    const dialog = await screen.findByRole('alertdialog').catch(() => screen.findByRole('dialog'));
    expect(dialog).toHaveTextContent(/drops v_diff for real in: B1, C1/i);
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(reg.applyToBu).toHaveBeenCalledTimes(2));
    for (const call of reg.applyToBu.mock.calls) expect(call.slice(1)).toEqual(['id-diff', 'drop', false]);
    expect(reg.importFromBu).not.toHaveBeenCalled();
  });

  it('shows the rollout history of the definition', async () => {
    reg.deployLog.mockResolvedValue([
      { id: 'l1', doc_version: 2, hash: 'x', bu_code: 'B1', action: 'apply', success: true, duration_ms: 40, created_at: '2026-11-19T04:00:00Z' },
      { id: 'l2', doc_version: 2, hash: 'x', bu_code: 'C1', action: 'apply', success: false, error: 'lock timeout (55P03)', duration_ms: 5100, created_at: '2026-11-19T04:00:01Z' },
    ]);
    const user = userEvent.setup();
    renderPage();
    await openDiffObject(user);
    expect(await screen.findByText('Rollout history (2)')).toBeInTheDocument();
    expect(screen.getByText('lock timeout (55P03)')).toBeInTheDocument();
  });

  it('shows the database error per BU and keeps Apply locked when a dry-run fails', async () => {
    const user = userEvent.setup();
    reg.applyToBu.mockImplementation(async (code, _id, _action, dryRun) => {
      if (code === 'C1') {
        throw Object.assign(new Error('Request failed with status code 400'), {
          response: { status: 400, data: { message: 'Failed to apply db object: relation "tb_x" does not exist (42P01)' } },
        });
      }
      return { bu_code: code, schema: code, dry_run: dryRun, statements: 1, duration_ms: 3 };
    });
    renderPage();
    await openDiffObject(user);
    await user.click(screen.getByRole('button', { name: /try on 2 bu/i }));
    expect(await screen.findByText(/relation "tb_x" does not exist/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply to 2 BU(s)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Failed only (1)' })).toBeInTheDocument();
  });

  it('creates a new function from the form: kind, name, arguments and body — nothing touches a BU', async () => {
    const user = userEvent.setup();
    reg.create.mockResolvedValue(entryOf('id-same', { id: 'id-new' }));
    renderPage();
    await screen.findByRole('button', { name: /v_diff/ });
    await user.click(screen.getByRole('button', { name: /new object/i }));
    const create = screen.getByRole('button', { name: 'Create' });
    expect(create).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Kind'), 'function');
    await user.type(screen.getByLabelText('Name'), 'f_new');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.type(screen.getByLabelText('Name of argument 1'), 'p_id');
    await user.clear(screen.getByLabelText('Type of argument 1'));
    await user.type(screen.getByLabelText('Type of argument 1'), 'uuid');
    await user.click(create);
    await waitFor(() => expect(reg.create).toHaveBeenCalledTimes(1));
    expect(reg.create.mock.calls[0][0].spec).toMatchObject({
      type: 'function',
      name: 'f_new',
      args: [{ name: 'p_id', type: 'uuid', mode: 'in' }],
      language: 'sql',
      pin_search_path: true,
    });
    expect(reg.applyToBu).not.toHaveBeenCalled();
    await waitFor(() => expect(reg.list).toHaveBeenCalledTimes(2));
  });

  it('asks for a re-import when a definition has no structured form, and locks it', async () => {
    reg.get.mockImplementation(async (id: string) => entryOf(id, { spec: null, has_spec: false }));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /v_diff/ }));
    expect((await screen.findAllByText(/import it again from a bu/i)).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /try on 2 bu/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('imports objects that only BUs hold, from the BU holding the most', async () => {
    const user = userEvent.setup();
    renderPage();
    const tiles = await screen.findByRole('group', { name: /filter objects by status/i });
    await waitFor(() => expect(within(tiles).getByRole('button', { name: /to import from a bu/i })).toHaveTextContent('1'));
    await user.click(within(tiles).getByRole('button', { name: /to import from a bu/i }));
    const panel = within(screen.getByRole('region', { name: /import from a bu/i }));
    expect(panel.getByText('v_loose')).toBeInTheDocument();
    await user.click(panel.getByRole('button', { name: 'Import 1 object(s)' }));
    await waitFor(() =>
      expect(reg.importFromBu).toHaveBeenCalledWith('A1', [{ type: 'view', name: 'v_loose', identity_args: '' }]),
    );
    await waitFor(() => expect(reg.list).toHaveBeenCalledTimes(2));
  });

  it('offers to import again the definitions saved before structured definitions', async () => {
    const user = userEvent.setup();
    reg.list.mockResolvedValue(REGISTRY.map((r) => ({ ...r, has_spec: false, approved: false })));
    renderPage();
    const banner = await screen.findByText(/2 central definition\(s\) were saved before structured definitions/i);
    await user.click(within(banner.parentElement as HTMLElement).getByRole('button', { name: /import again from a bu/i }));
    const panel = within(screen.getByRole('region', { name: /import from a bu/i }));
    expect(panel.getAllByText('Import again')).toHaveLength(2);
    // A1 holds both old rows plus v_loose, so it is the BU offered first
    await user.click(panel.getByRole('button', { name: 'Import 3 object(s)' }));
    await waitFor(() => expect(reg.importFromBu).toHaveBeenCalledTimes(1));
    expect(reg.importFromBu.mock.calls[0][0]).toBe('A1');
    expect(reg.importFromBu.mock.calls[0][1]?.map((o) => o.name).sort()).toEqual(['v_diff', 'v_loose', 'v_same']);
  });

  it('opens on the import panel while the central store is empty', async () => {
    reg.list.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByRole('region', { name: /import from a bu/i })).toBeInTheDocument();
    expect(screen.getByText(/no central definitions yet/i)).toBeInTheDocument();
  });

  it('gives a user without db_object.manage a read-only definition, but still lets them apply it', async () => {
    hasPermission.mockImplementation((p: string) => p !== 'db_object.manage');
    const user = userEvent.setup();
    renderPage();
    await openDiffObject(user);
    expect(screen.getByLabelText('sql')).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: /new object/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove from central store/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try on 2 bu/i })).toBeEnabled();
  });

  it('hides dry-run and apply from a user without sql_workbench.manage', async () => {
    hasPermission.mockImplementation((p: string) => p !== 'sql_workbench.manage');
    const user = userEvent.setup();
    renderPage();
    await openDiffObject(user);
    expect(screen.queryByRole('button', { name: /try on/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /apply to/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Apply to B1' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});

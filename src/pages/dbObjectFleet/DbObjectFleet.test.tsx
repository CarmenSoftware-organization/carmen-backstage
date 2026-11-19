import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DbObjectFleet from './DbObjectFleet';
import sqlQueryService from '../../services/sqlQueryService';
import dbObjectService from '../../services/dbObjectService';
import type { DbObjectFingerprint, DbObjectRegistryRow } from '../../types';

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
  },
}));

// CodeMirror needs layout APIs jsdom lacks — same textarea stand-in SqlWorkbench.test uses.
vi.mock('../sqlWorkbench/SqlEditor', () => ({
  SqlEditor: ({ value, onChange, readOnly }: { value: string; onChange: (v: string) => void; readOnly?: boolean }) => (
    <textarea aria-label="sql" value={value} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const view = (name: string, hash: string): DbObjectFingerprint => ({ type: 'view', name, identity_args: '', hash });
// v_same: every BU matches the registry. v_diff: A1 matches, B1 is out of date, C1 lacks it.
// v_loose exists in A1 + B1 only and has no registry row.
const FINGERPRINTS: Record<string, DbObjectFingerprint[]> = {
  A1: [view('v_same', 'h1'), view('v_diff', 'x'), view('v_loose', 'l')],
  B1: [view('v_same', 'h1'), view('v_diff', 'OLD'), view('v_loose', 'l')],
  C1: [view('v_same', 'h1')],
};
const REGISTRY: DbObjectRegistryRow[] = [
  { ...view('v_same', 'h1'), id: 'id-same', doc_version: 0 },
  { ...view('v_diff', 'x'), id: 'id-diff', doc_version: 2 },
];
const DIFF_SQL = 'CREATE OR REPLACE VIEW v_diff AS SELECT 1;\n';

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
  svc.applyPortableDdl.mockImplementation(async (code, _sql, dryRun) => ({
    bu_code: code,
    schema: code,
    dry_run: dryRun,
    statements: 1,
    duration_ms: 3,
  }));
  reg.list.mockResolvedValue(REGISTRY);
  reg.get.mockImplementation(async (id: string) => {
    const row = REGISTRY.find((r) => r.id === id) as DbObjectRegistryRow;
    return { ...row, definition: `CREATE OR REPLACE VIEW ${row.name} AS SELECT 1;\n` };
  });
  reg.update.mockImplementation(async (id, input) => ({
    ...(REGISTRY.find((r) => r.id === id) as DbObjectRegistryRow),
    definition: input.definition,
    doc_version: 3,
  }));
  reg.importFromBu.mockResolvedValue({ bu_code: 'A1', created: 1, updated: 0, unchanged: 0, missing: [] });
});

describe('DbObjectFleet', () => {
  it('lists the central definitions and counts how the BUs stand against them', async () => {
    renderPage();
    await waitFor(() => expect(svc.getFingerprints).toHaveBeenCalledTimes(3));
    expect(svc.getFingerprints.mock.calls.map((c) => c[0]).sort()).toEqual(['A1', 'B1', 'C1']);
    const tiles = await screen.findByRole('group', { name: /filter objects by status/i });
    await waitFor(() => expect(within(tiles).getByRole('button', { name: /central definitions/i })).toHaveTextContent('2'));
    expect(within(tiles).getByRole('button', { name: /up to date in every bu/i })).toHaveTextContent('1');
    expect(within(tiles).getByRole('button', { name: /need applying/i })).toHaveTextContent('1');
    expect(within(tiles).getByRole('button', { name: /not in the central store/i })).toHaveTextContent('1');
    // an object only BUs hold is not a row of the list
    expect(screen.queryByRole('button', { name: /^v_loose/ })).toBeNull();
  });

  it('shows each BU as up to date, out of date or not installed, and targets the ones that need it', async () => {
    const user = userEvent.setup();
    renderPage();
    await openDiffObject(user);
    expect(reg.get).toHaveBeenCalledWith('id-diff');
    const table = within(screen.getByRole('region', { name: /central definition and bus/i }));
    expect(table.getByRole('row', { name: /A1/ })).toHaveTextContent('Up to date');
    expect(table.getByRole('row', { name: /B1/ })).toHaveTextContent('Out of date');
    expect(table.getByRole('row', { name: /C1/ })).toHaveTextContent('Not installed');
    expect(screen.queryByText(/variant/i)).toBeNull();
    expect(screen.queryByText(/^source$/i)).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Apply to A1' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Apply to B1' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Apply to C1' })).toBeChecked();
    // comparing is offered for the BU that differs, against the central definition
    expect(screen.getByRole('button', { name: /compare b1 with the central definition/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /compare a1/i })).toBeNull();
  });

  it('applies only the saved definition: an edit must be saved before a dry-run', async () => {
    const user = userEvent.setup();
    renderPage();
    await openDiffObject(user);
    const tryBtn = screen.getByRole('button', { name: /try on 2 bu/i });
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    await user.type(screen.getByLabelText('sql'), '-- v2');
    expect(tryBtn).toBeDisabled();
    expect(screen.getByText(/save the definition first/i)).toBeInTheDocument();
    await user.click(save);
    await waitFor(() => expect(reg.update).toHaveBeenCalledWith('id-diff', { definition: `${DIFF_SQL}-- v2`, doc_version: 2 }));
    await waitFor(() => expect(tryBtn).toBeEnabled());
    expect(svc.applyPortableDdl).not.toHaveBeenCalled();

    await user.click(tryBtn);
    await waitFor(() => expect(svc.applyPortableDdl).toHaveBeenCalledTimes(2));
    for (const call of svc.applyPortableDdl.mock.calls) expect(call.slice(1)).toEqual([`${DIFF_SQL}-- v2`, true]);
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

  it('applies for real after confirm, settles the central fingerprint from a BU, then rescans', async () => {
    const user = userEvent.setup();
    renderPage();
    await openDiffObject(user);
    await user.click(screen.getByRole('button', { name: /try on 2 bu/i }));
    const apply = screen.getByRole('button', { name: 'Apply to 2 BU(s)' });
    await waitFor(() => expect(apply).toBeEnabled());
    svc.applyPortableDdl.mockClear();
    svc.getFingerprints.mockClear();

    await user.click(apply);
    const dialog = await screen.findByRole('alertdialog').catch(() => screen.findByRole('dialog'));
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(svc.applyPortableDdl).toHaveBeenCalledTimes(2));
    expect(svc.applyPortableDdl.mock.calls.map((c) => [c[0], c[2]]).sort()).toEqual([
      ['B1', false],
      ['C1', false],
    ]);
    await waitFor(() =>
      expect(reg.importFromBu).toHaveBeenCalledWith('B1', [{ type: 'view', name: 'v_diff', identity_args: '' }]),
    );
    await waitFor(() => expect(svc.getFingerprints.mock.calls.map((c) => c[0]).sort()).toEqual(['B1', 'C1']));
  });

  it('shows the database error per BU and keeps Apply locked when a dry-run fails', async () => {
    const user = userEvent.setup();
    svc.applyPortableDdl.mockImplementation(async (code, _sql, dryRun) => {
      if (code === 'C1') {
        throw Object.assign(new Error('Request failed with status code 400'), {
          response: { status: 400, data: { message: 'Failed to apply ddl: relation "tb_x" does not exist (42P01)' } },
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

  it('creates a new central definition without touching any BU', async () => {
    const user = userEvent.setup();
    reg.create.mockResolvedValue({ ...view('v_new', 'n'), id: 'id-new', definition: 'x', doc_version: 0 });
    renderPage();
    await screen.findByRole('button', { name: /v_diff/ });
    await user.click(screen.getByRole('button', { name: /new object/i }));
    const create = screen.getByRole('button', { name: 'Create' });
    expect(create).toBeDisabled();
    await user.type(screen.getByLabelText('Name'), 'v_new');
    await user.click(create);
    await waitFor(() => expect(reg.create).toHaveBeenCalledTimes(1));
    expect(reg.create.mock.calls[0][0]).toMatchObject({ type: 'view', name: 'v_new', identity_args: '' });
    expect(svc.applyPortableDdl).not.toHaveBeenCalled();
    await waitFor(() => expect(reg.list).toHaveBeenCalledTimes(2));
  });

  it('imports objects that only BUs hold, from the BU holding the most', async () => {
    const user = userEvent.setup();
    renderPage();
    const tiles = await screen.findByRole('group', { name: /filter objects by status/i });
    await waitFor(() => expect(within(tiles).getByRole('button', { name: /not in the central store/i })).toHaveTextContent('1'));
    await user.click(within(tiles).getByRole('button', { name: /not in the central store/i }));
    const panel = within(screen.getByRole('region', { name: /import from a bu/i }));
    expect(panel.getByText('v_loose')).toBeInTheDocument();
    await user.click(panel.getByRole('button', { name: 'Import 1 object(s)' }));
    await waitFor(() =>
      expect(reg.importFromBu).toHaveBeenCalledWith('A1', [{ type: 'view', name: 'v_loose', identity_args: '' }]),
    );
    await waitFor(() => expect(reg.list).toHaveBeenCalledTimes(2));
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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DbObjectFleet from './DbObjectFleet';
import sqlQueryService from '../../services/sqlQueryService';
import type { DbObjectFingerprint } from '../../types';

vi.mock('../../components/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// The authoring switch is read through a getter so each block can pick it; the tests above the
// switched-off block cover the authoring path, which is hidden in the app for now.
const policy = vi.hoisted(() => ({ canAuthor: true }));
vi.mock('./fleetPolicy', () => ({
  get CAN_AUTHOR_SQL() {
    return policy.canAuthor;
  },
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

// CodeMirror needs layout APIs jsdom lacks — same textarea stand-in SqlWorkbench.test uses.
vi.mock('../sqlWorkbench/SqlEditor', () => ({
  SqlEditor: ({ value, onChange, readOnly }: { value: string; onChange: (v: string) => void; readOnly?: boolean }) => (
    <textarea aria-label="sql" value={value} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const view = (name: string, hash: string): DbObjectFingerprint => ({ type: 'view', name, identity_args: '', hash });
const FINGERPRINTS: Record<string, DbObjectFingerprint[]> = {
  A1: [view('v_same', 'h1'), view('v_diff', 'x')],
  B1: [view('v_same', 'h1'), view('v_diff', 'y')],
  C1: [view('v_same', 'h1')],
};
const svc = vi.mocked(sqlQueryService);

const renderPage = () =>
  render(
    <MemoryRouter>
      <DbObjectFleet />
    </MemoryRouter>,
  );

const openDiffObject = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: /v_diff/ }));
  await waitFor(() => expect(screen.getByLabelText('sql')).toHaveValue('CREATE OR REPLACE VIEW v_diff AS SELECT 1;\n'));
};

beforeEach(() => {
  vi.clearAllMocks();
  policy.canAuthor = true;
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
    definition: `CREATE OR REPLACE VIEW ${ref.name} AS SELECT 1;\n`,
  }));
  svc.applyPortableDdl.mockImplementation(async (code, _sql, dryRun) => ({
    bu_code: code,
    schema: code,
    dry_run: dryRun,
    statements: 1,
    duration_ms: 3,
  }));
});

describe('DbObjectFleet', () => {
  it('scans only active BUs with a schema and summarizes the comparison', async () => {
    renderPage();
    await waitFor(() => expect(svc.getFingerprints).toHaveBeenCalledTimes(3));
    expect(svc.getFingerprints.mock.calls.map((c) => c[0]).sort()).toEqual(['A1', 'B1', 'C1']);
    const tiles = await screen.findByRole('group', { name: /filter objects by status/i });
    await waitFor(() => expect(within(tiles).getByRole('button', { name: /objects/i })).toHaveTextContent('2'));
    expect(within(tiles).getByRole('button', { name: /same in every bu/i })).toHaveTextContent('1');
    expect(within(tiles).getByRole('button', { name: /missing in some bus/i })).toHaveTextContent('1');
    expect(within(tiles).getByRole('button', { name: /different definitions/i })).toHaveTextContent('1');
  });

  it('loads the source definition and targets the BUs that would change', async () => {
    const user = userEvent.setup();
    renderPage();
    await openDiffObject(user);
    // A1 and B1 tie at one BU each; the first BU code wins → source A1, targets B1 (differs) + C1 (missing)
    expect(svc.getPortableDefinition).toHaveBeenCalledWith('A1', { type: 'view', name: 'v_diff', identity_args: '' });
    expect(screen.getByRole('checkbox', { name: 'Roll out to B1' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Roll out to C1' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Roll out to A1' })).toBeDisabled();
  });

  it('lets an edited definition reach the source BU, and locks the source again once the edit is undone', async () => {
    const user = userEvent.setup();
    renderPage();
    await openDiffObject(user);
    const source = screen.getByRole('checkbox', { name: 'Roll out to A1' });
    expect(source).toBeDisabled();
    expect(screen.queryByRole('button', { name: /compare a1/i })).toBeNull();

    // e.g. a new version of the view, or a DROP: the source holds the old text now
    await user.type(screen.getByLabelText('sql'), ' ');
    expect(source).toBeEnabled();
    expect(screen.getByRole('button', { name: /compare a1/i })).toBeInTheDocument();
    const detail = screen.getByRole('region', { name: 'Object across BUs' });
    await user.click(within(detail).getByRole('button', { name: 'All' }));
    expect(source).toBeChecked();
    await user.click(screen.getByRole('button', { name: /try on 3 bu/i }));
    await waitFor(() => expect(svc.applyPortableDdl).toHaveBeenCalledTimes(3));
    expect(svc.applyPortableDdl.mock.calls.map((c) => c[0]).sort()).toEqual(['A1', 'B1', 'C1']);

    // back to exactly what A1 holds: A1 is no target any more
    await user.type(screen.getByLabelText('sql'), '{Backspace}');
    expect(source).toBeDisabled();
    expect(source).not.toBeChecked();
    expect(screen.getByRole('button', { name: /try on 2 bu/i })).toBeInTheDocument();
  });

  it('keeps Apply locked until a dry-run passes on exactly this SQL and these BUs', async () => {
    const user = userEvent.setup();
    renderPage();
    await openDiffObject(user);
    const apply = screen.getByRole('button', { name: 'Apply to 2 BU(s)' });
    expect(apply).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /try on 2 bu/i }));
    await waitFor(() => expect(apply).toBeEnabled());
    expect(svc.applyPortableDdl).toHaveBeenCalledTimes(2);
    for (const call of svc.applyPortableDdl.mock.calls) expect(call[2]).toBe(true);

    // editing the SQL invalidates the dry-run
    await user.type(screen.getByLabelText('sql'), ' ');
    expect(apply).toBeDisabled();
  });

  it('applies for real after confirm, then rescans the BUs it touched', async () => {
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
    await waitFor(() => expect(svc.getFingerprints.mock.calls.map((c) => c[0]).sort()).toEqual(['B1', 'C1']));
  });

  it('drops an object from every BU that holds it, then closes its detail and frees the list', async () => {
    const user = userEvent.setup();
    renderPage();
    await openDiffObject(user);
    const sql = screen.getByLabelText('sql');
    await user.clear(sql);
    await user.type(sql, 'DROP VIEW IF EXISTS v_diff;');
    const detail = screen.getByRole('region', { name: 'Object across BUs' });
    await user.click(within(detail).getByRole('button', { name: 'All' }));
    await user.click(screen.getByRole('button', { name: /try on 3 bu/i }));
    const apply = screen.getByRole('button', { name: 'Apply to 3 BU(s)' });
    await waitFor(() => expect(apply).toBeEnabled());

    // the rescan after the drop finds v_diff nowhere
    svc.getFingerprints.mockImplementation(async (code: string) => ({
      bu_code: code,
      schema: code,
      objects: FINGERPRINTS[code].filter((o) => o.name !== 'v_diff'),
    }));
    await user.click(apply);
    const dialog = await screen.findByRole('alertdialog').catch(() => screen.findByRole('dialog'));
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));

    expect(await screen.findByText(/pick an object on the left/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /v_diff/ })).toBeNull();
    expect(screen.getByRole('button', { name: /v_same/ }).closest('[aria-disabled]')).toBeNull();
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

  it('hides dry-run and apply from a read-only user', async () => {
    hasPermission.mockImplementation((p: string) => p !== 'sql_workbench.manage');
    const user = userEvent.setup();
    renderPage();
    await openDiffObject(user);
    expect(screen.queryByRole('button', { name: /try on/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /apply to/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new object/i })).not.toBeInTheDocument();
  });
});

describe('DbObjectFleet while SQL authoring is switched off', () => {
  beforeEach(() => {
    policy.canAuthor = false;
  });

  it('is switched off in the app', async () => {
    const actual = await vi.importActual<typeof import('./fleetPolicy')>('./fleetPolicy');
    expect(actual.CAN_AUTHOR_SQL).toBe(false);
  });

  it('hides New object and shows the definition read-only, even to a manager', async () => {
    const user = userEvent.setup();
    renderPage();
    await openDiffObject(user);
    expect(screen.queryByRole('button', { name: /new object/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText('sql')).toHaveAttribute('readonly');
    expect(screen.queryByText(/allowed: create/i)).not.toBeInTheDocument();
    // the source BU stays locked: nothing can be edited, so it never needs the rollout
    expect(screen.getByRole('checkbox', { name: 'Roll out to A1' })).toBeDisabled();
  });

  it('still rolls the definition out exactly as the source BU holds it', async () => {
    const user = userEvent.setup();
    renderPage();
    await openDiffObject(user);
    await user.click(screen.getByRole('button', { name: /try on 2 bu/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Apply to 2 BU(s)' })).toBeEnabled());
    for (const call of svc.applyPortableDdl.mock.calls) expect(call[1]).toBe('CREATE OR REPLACE VIEW v_diff AS SELECT 1;\n');
  });
});

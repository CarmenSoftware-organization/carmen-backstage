import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BuSwitcher } from './BuSwitcher';
import type { BusinessUnit } from '../types';

const getAll = vi.hoisted(() => vi.fn());
vi.mock('../services/businessUnitService', () => ({ default: { getAll } }));

// Radix Dialog relies on pointer-capture / scroll APIs jsdom doesn't implement.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});

// Node 26 exposes bare `localStorage` as undefined; the switcher reads/writes it
// directly for the "recent BUs" list, so stub it with a fresh in-memory store.
const makeLocalStorage = () => {
  const store: Record<string, string> = {};
  return {
    setItem: (k: string, v: string) => { store[k] = v; },
    getItem: (k: string) => store[k] ?? null,
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    length: 0,
    key: () => null,
  };
};

const BUS: BusinessUnit[] = [
  { id: '1', code: 'ACME-TH', name: 'Acme Thailand', cluster_name: 'Acme', is_active: true },
  { id: '2', code: 'ACME-SG', name: 'Acme Singapore', cluster_name: 'Acme', is_active: true },
  { id: '3', code: 'BETA-TH', name: 'Beta Thailand', cluster_name: 'Beta', is_active: true },
];

async function setup(props: Partial<React.ComponentProps<typeof BuSwitcher>> = {}) {
  const onSelect = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <BuSwitcher
      open
      onOpenChange={onOpenChange}
      currentCode=""
      onSelect={onSelect}
      {...props}
    />,
  );
  await screen.findByText('Acme Thailand');
  return { onSelect, onOpenChange };
}

describe('BuSwitcher', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorage());
    getAll.mockReset();
    // Server-side search: the mock filters like the backend (name / code), code-sorted.
    getAll.mockImplementation(async ({ search }: { search: string }) => {
      const q = (search || '').toLowerCase();
      const data = BUS.filter((b) => !q || `${b.code} ${b.name}`.toLowerCase().includes(q));
      return { data, paginate: { total: data.length } };
    });
  });

  it('searches BUs on the server with the query', async () => {
    const user = userEvent.setup();
    await setup();
    await user.type(screen.getByLabelText('Search business units'), 'beta');
    await waitFor(() => expect(getAll).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'beta', sort: 'code:asc' })));
    await screen.findByText('Beta Thailand');
    expect(screen.queryByText('Acme Thailand')).not.toBeInTheDocument();
  });

  it('lists BUs flat (no cluster grouping) and shows the server total', async () => {
    await setup();
    expect(screen.getByText('3 BUs')).toBeInTheDocument();
  });

  it('connects the BU on click and closes', async () => {
    const user = userEvent.setup();
    const { onSelect, onOpenChange } = await setup();
    await user.click(screen.getByText('Acme Thailand'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: '1', code: 'ACME-TH', name: 'Acme Thailand' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('connects the active row on Enter', async () => {
    const user = userEvent.setup();
    const { onSelect } = await setup();
    const input = screen.getByLabelText('Search business units');
    await user.type(input, 'singapore');
    await screen.findByText('Acme Singapore');
    expect(screen.queryByText('Acme Thailand')).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ code: 'ACME-SG' }));
  });

  it('does not select a stale row while the typed query is still debouncing', async () => {
    const user = userEvent.setup();
    const { onSelect } = await setup();
    await user.type(screen.getByLabelText('Search business units'), 'beta{Enter}');
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByText('Acme Thailand')).not.toBeInTheDocument();
    await screen.findByText('Beta Thailand');
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ code: 'BETA-TH' }));
  });

  it('marks the currently connected BU', async () => {
    await setup({ currentCode: 'ACME-TH' });
    const row = screen.getByText('ACME-TH').closest('[role="option"]') as HTMLElement;
    expect(within(row).getByText('connected')).toBeInTheDocument();
  });

  it('pins recently used BUs under a Recent heading, without repeating them below', async () => {
    localStorage.setItem(
      'sqlwb_recent_bus_v2',
      JSON.stringify([{ id: '3', code: 'BETA-TH', name: 'Beta Thailand', cluster_name: 'Beta' }]),
    );
    await setup();
    expect(screen.getByText('Recent')).toBeInTheDocument();
    expect(screen.getAllByText('BETA-TH')).toHaveLength(1);
  });

  it('drops a deleted recent after validation, and keeps recents when the validation request fails', async () => {
    const stored = [
      { id: '3', code: 'BETA-TH', name: 'Old Beta', cluster_name: 'Beta' },
      { id: '9', code: 'GONE-XX', name: 'Deleted BU', cluster_name: null },
    ];
    localStorage.setItem('sqlwb_recent_bus_v2', JSON.stringify(stored));
    const view = await setup();
    // rendered from storage first; then the server says GONE-XX no longer exists and refreshes BETA-TH's name
    await waitFor(() => expect(screen.queryByText('GONE-XX')).not.toBeInTheDocument());
    const kept = JSON.parse(localStorage.getItem('sqlwb_recent_bus_v2') || '[]');
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ code: 'BETA-TH', name: 'Beta Thailand' });
    expect(view.onSelect).not.toHaveBeenCalled();

    // a failing hydrate must never drop anything
    localStorage.setItem('sqlwb_recent_bus_v2', JSON.stringify(stored));
    getAll.mockImplementation(async ({ advance }: { advance?: string }) => {
      if (advance) throw new Error('boom');
      return { data: BUS, paginate: { total: BUS.length } };
    });
    await setup();
    await waitFor(() => expect(getAll).toHaveBeenCalledWith(expect.objectContaining({ advance: expect.any(String) })));
    expect(JSON.parse(localStorage.getItem('sqlwb_recent_bus_v2') || '[]')).toHaveLength(2);
  });

  it('ignores legacy bare-code recents', async () => {
    localStorage.setItem('sqlwb_recent_bus', JSON.stringify(['BETA-TH']));
    await setup();
    expect(screen.queryByText('Recent')).not.toBeInTheDocument();
  });

  it('confirms multiple picks sorted by code', async () => {
    const user = userEvent.setup();
    const onSelectMany = vi.fn();
    await setup({ multiple: true, onSelectMany });
    await user.click(screen.getByText('Beta Thailand'));
    await user.click(screen.getByText('Acme Thailand'));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onSelectMany.mock.calls[0][0].map((b: { code: string }) => b.code)).toEqual(['ACME-TH', 'BETA-TH']);
  });

  it('records the connected BU as recent for next time', async () => {
    const user = userEvent.setup();
    await setup();
    await user.click(screen.getByText('Acme Singapore'));
    const recent = JSON.parse(localStorage.getItem('sqlwb_recent_bus_v2') || '[]');
    expect(recent[0]).toMatchObject({ id: '2', code: 'ACME-SG' });
  });
});

# User MCP tokens card (admin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only "MCP tokens" card to the admin `UserEdit` page listing the user's MCP tokens (`user.read`) with a destructive "Revoke all MCP tokens" action (`user.update`) for offboarding.

**Architecture:** One new component `src/pages/userEdit/UserMcpTokensCard.tsx` (own fetch via `userService`, stale-response guard keyed on `userId` like `ApplicationSecretCard`), two new `userService` methods, one shared type in `src/types/index.ts`, i18n keys under `pages.users.mcpTokens` (en + th, parity enforced by `Translations` type). Mounted in `UserEdit.tsx` after `UserAccessTree`. Permissions gated with `<Can>`.

**Tech Stack:** Vite 8, React 19, react-router-dom 7, axios (`src/services/api.ts`), shadcn/radix (`Card`, `Table*`, `Badge`, `Button`, `ConfirmDialog`), custom i18n (`useI18n`), `sonner`.

**Spec:** `../carmen-turborepo-backend-v2/docs/superpowers/specs/2026-10-14-mcp-token-ui-design.md` §5 (backend repo, branch `docs/mcp-token-ui-spec`). Backend endpoints are on backend `main` (PR #806): `GET /api-system/user/:user_id/mcp-tokens` (needs `user.read`), `DELETE /api-system/user/:user_id/mcp-tokens` → `{ revoked_count }` (needs `user.update`). Both return the StdResponse envelope `{ data, status, success, message, timestamp }`.

## Global Constraints

- Repo rule (`agent-os/standards/testing/plan-execution.md`): **implement, type-check, commit** — no new `*.test.tsx`. Gates: `bun run typecheck`, `bun run lint`; **`bun run test` must pass before merge** (existing suite; `UserEdit.test.tsx` needs one mock line, see Task 2).
- Commit on branch `feature/user-mcp-tokens` only; **stage only your files** (never `git add -A`). English conventional commits (`feat(users): …`). No push, no amend, no branch switch.
- `CLAUDE.md` rules: never modify `src/components/ui/`; no `alert`/`confirm`; Badge variants only (`success`/`secondary`/`destructive`), no raw green classes; all shared types in `src/types/index.ts` (no `src/types/<file>.ts`); catch blocks use `getErrorDetail(err, t)` for a string (not `parseApiError`); `ConfirmDialog` for destructive actions; async-action buttons disabled during the request; page section order "Card sections → related-data cards → dev-only debug Sheet".
- `src/services/CLAUDE.md`: `/api-system/user/...` and `/api/user/...` are unrelated namespaces — the admin routes are under `api-system` (verified in `mcp-tokens-admin.controller.ts:32`); unwrap with `response.data.data || response.data`.
- Stale-response guard: the route `/users/:id/edit` is unkeyed, so the component instance is reused across ids — every `await` must check `isStale(requestedId)` before touching state/toast (pattern from `ApplicationSecretCard.tsx:77-82`).
- Dates: no date library — use `formatStatusTime` from `src/utils/applicationStatus.ts:102` (local `YYYY-MM-DD HH:mm`).
- Merging to `main` auto-deploys DEV (`CLAUDE.md:73`); Vercel prod tracks the `vercel` branch.

## Deviations from the spec (verified against the repo while planning)

1. `McpTokenRow` lives in `src/types/index.ts` (rule 10), not `src/types/mcpToken.ts`.
2. Errors use `getErrorDetail(err, t)` + `toast.error(title, { description })`, not `parseApiError` (rule 12).
3. Mount point is after `UserAccessTree` (`UserEdit.tsx:838`), guarded `{!isNew && id && …}`; the "card at ~457" in the spec is a loading skeleton.
4. `UserEdit.test.tsx` mocks `userService` with a fixed method list; add `listMcpTokens: vi.fn().mockResolvedValue({ data: [] })` so the existing suite keeps passing (editing a mock, not writing a test).
5. i18n namespace is `pages.users.mcpTokens` (there is no `userEdit` namespace); params use `{{name}}` / `{{count}}`.

## Review Focus

1. **Revoke-all must be impossible without `user.update` and the card invisible without `user.read`** — Task 2: card wrapped in `<Can permission="user.read">`, button in `<Can permission="user.update">`, and `handleRevokeAll` re-checks `hasPermission('user.update')` before calling the service (same belt-and-braces as `handleConfirmDeleteBU`).
2. **Navigating A → B while A's list is loading must not show A's tokens on B** — Task 2 `isStale` after every await.
3. **The button is disabled when there are 0 active tokens or while loading** — Task 2.
4. **`bun run test` stays green** — Task 2 mock line + Task 3 run.
5. **Thai catalog compiles** — every new en key has a th twin (tsc enforces via `Translations`).

---

### Task 1: type, service methods, i18n

**Files:**
- Modify: `src/types/index.ts` (append near the `UsersResponse` block, ~line 831)
- Modify: `src/services/userService.ts` (after `resetPassword`, line 53)
- Modify: `src/i18n/en.ts` (inside `users: { … }`, before its closing `},` at ~line 1285)
- Modify: `src/i18n/th.ts` (same place, ~line 1039)

**Interfaces:**
- Produces: `McpTokenRow`; `userService.listMcpTokens(userId): Promise<unknown>`; `userService.revokeAllMcpTokens(userId): Promise<unknown>`; keys `pages.users.mcpTokens.*`

- [ ] **Step 1: type** — in `src/types/index.ts` after `UsersResponse`:

```ts
/** One MCP token row as returned by GET /api-system/user/:user_id/mcp-tokens (never carries the raw token). */
export interface McpTokenRow {
  id: string;
  name: string;
  token_prefix: string;
  expires_at: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
  created_at?: string | null;
  doc_version: number;
}
```

- [ ] **Step 2: service** — in `src/services/userService.ts` after `resetPassword` (keep the object style):

```ts
  listMcpTokens: async (id: string) => {
    const response = await api.get(`/api-system/user/${id}/mcp-tokens`);
    return response.data;
  },

  revokeAllMcpTokens: async (id: string) => {
    const response = await api.delete(`/api-system/user/${id}/mcp-tokens`);
    return response.data;
  },
```

- [ ] **Step 3: i18n en** — in `src/i18n/en.ts` inside `users: {` just before its closing `},` (after `notFoundDescription`):

```ts
      // ── MCP tokens (admin view) ──
      mcpTokens: {
        title: 'MCP tokens',
        description: 'Tokens this user created for AI assistants (MCP). Revoke all of them when offboarding.',
        revokeAll: 'Revoke all MCP tokens',
        revokeAllTitle: 'Revoke all MCP tokens?',
        revokeAllConfirm: 'All {{count}} active token(s) of "{{name}}" will stop working immediately. This cannot be undone.',
        revokedAll: 'Revoked {{count}} token(s)',
        revokeAllFailed: 'Could not revoke MCP tokens',
        loadFailed: 'Could not load MCP tokens',
        loading: 'Loading…',
        empty: 'No MCP tokens',
        name: 'Name',
        token: 'Token',
        createdAt: 'Created',
        expiresAt: 'Expires',
        lastUsedAt: 'Last used',
        never: 'Never',
        status: 'Status',
        statusActive: 'Active',
        statusExpired: 'Expired',
        statusRevoked: 'Revoked',
      },
```

- [ ] **Step 4: i18n th** — same position in `src/i18n/th.ts`:

```ts
      // ── MCP tokens (admin view) ──
      mcpTokens: {
        title: 'โทเค็น MCP',
        description: 'โทเค็นที่ผู้ใช้สร้างไว้สำหรับผู้ช่วย AI (MCP) เพิกถอนทั้งหมดเมื่อผู้ใช้พ้นสภาพ',
        revokeAll: 'เพิกถอนโทเค็น MCP ทั้งหมด',
        revokeAllTitle: 'เพิกถอนโทเค็น MCP ทั้งหมด?',
        revokeAllConfirm: 'โทเค็นที่ยังใช้งานได้ทั้ง {{count}} ใบของ "{{name}}" จะใช้ไม่ได้ทันที และย้อนกลับไม่ได้',
        revokedAll: 'เพิกถอนแล้ว {{count}} ใบ',
        revokeAllFailed: 'เพิกถอนโทเค็น MCP ไม่สำเร็จ',
        loadFailed: 'โหลดโทเค็น MCP ไม่สำเร็จ',
        loading: 'กำลังโหลด…',
        empty: 'ไม่มีโทเค็น MCP',
        name: 'ชื่อ',
        token: 'โทเค็น',
        createdAt: 'สร้างเมื่อ',
        expiresAt: 'หมดอายุ',
        lastUsedAt: 'ใช้ล่าสุด',
        never: 'ยังไม่เคย',
        status: 'สถานะ',
        statusActive: 'ใช้งานได้',
        statusExpired: 'หมดอายุ',
        statusRevoked: 'เพิกถอนแล้ว',
      },
```

- [ ] **Step 5: verify**

```bash
cd /Users/samutpra/GitHub/carmensoftware-organize/carmen-platform
bun run typecheck && bunx eslint src/types/index.ts src/services/userService.ts src/i18n/en.ts src/i18n/th.ts
```

Expected: clean (a missing th key fails `tsc` — that is the parity gate)

- [ ] **Step 6: commit**

```bash
git checkout -b feature/user-mcp-tokens
git add src/types/index.ts src/services/userService.ts src/i18n/en.ts src/i18n/th.ts
git commit -m "feat(users): userService MCP token methods, McpTokenRow type and i18n keys"
```

---

### Task 2: `UserMcpTokensCard` + mount + test mock

**Files:**
- Create: `src/pages/userEdit/UserMcpTokensCard.tsx`
- Modify: `src/pages/UserEdit.tsx` (import near line 24; mount after line 838)
- Modify: `src/pages/UserEdit.test.tsx` (userService mock, lines 23-30)

**Interfaces:**
- Consumes: `userService.listMcpTokens/revokeAllMcpTokens`, `McpTokenRow`, keys `pages.users.mcpTokens.*` (Task 1); `Can` (default export `src/components/Can`), `ConfirmDialog` (named, `src/components/ui/confirm-dialog`), `Table*` (`src/components/ui/table`), `Badge`, `Button`, `Card*`, `useI18n`, `useAuth().hasPermission`, `getErrorDetail`, `formatStatusTime`
- Produces: `<UserMcpTokensCard userId userName />`

- [ ] **Step 1: component** — `src/pages/userEdit/UserMcpTokensCard.tsx`

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Ban, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '../../hooks/useI18n';
import { useAuth } from '../../context/AuthContext';
import userService from '../../services/userService';
import { getErrorDetail } from '../../utils/errorParser';
import { formatStatusTime } from '../../utils/applicationStatus';
import type { McpTokenRow } from '../../types';
import Can from '../../components/Can';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

type McpTokenStatus = 'active' | 'expired' | 'revoked';

const statusOf = (row: McpTokenRow, now: number = Date.now()): McpTokenStatus => {
  if (row.revoked_at) return 'revoked';
  if (new Date(row.expires_at).getTime() <= now) return 'expired';
  return 'active';
};

const STATUS_BADGE: Record<McpTokenStatus, 'success' | 'secondary' | 'destructive'> = {
  active: 'success',
  expired: 'secondary',
  revoked: 'destructive',
};

const unwrapRows = (body: unknown): McpTokenRow[] => {
  const data = (body as { data?: unknown } | null)?.data ?? body;
  return Array.isArray(data) ? (data as McpTokenRow[]) : [];
};

const unwrapCount = (body: unknown): number => {
  const data = (body as { data?: { revoked_count?: unknown } } | null)?.data ?? body;
  const n = (data as { revoked_count?: unknown } | null)?.revoked_count;
  return typeof n === 'number' ? n : 0;
};

interface UserMcpTokensCardProps {
  userId: string;
  userName: string;
}

/** Read-only list of a user's MCP tokens with an admin "revoke all" — offboarding layer 2 of the MCP spec. */
export function UserMcpTokensCard({ userId, userName }: UserMcpTokensCardProps) {
  const { t } = useI18n();
  const { hasPermission } = useAuth();
  const [rows, setRows] = useState<McpTokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // The route is unkeyed: this instance is reused across user ids. A late response for A must
  // never paint A's tokens, toast, or reload on B's card.
  const currentIdRef = useRef(userId);
  const mountedRef = useRef(false);
  const isStale = useCallback(
    (requestedId: string): boolean => !mountedRef.current || currentIdRef.current !== requestedId,
    [],
  );

  const load = useCallback(
    async (requestedId: string) => {
      setLoading(true);
      try {
        const body = await userService.listMcpTokens(requestedId);
        if (isStale(requestedId)) return;
        setRows(unwrapRows(body));
      } catch (err: unknown) {
        if (isStale(requestedId)) return;
        setRows([]);
        toast.error(t('pages.users.mcpTokens.loadFailed'), { description: getErrorDetail(err, t) });
      } finally {
        if (!isStale(requestedId)) setLoading(false);
      }
    },
    [isStale, t],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    currentIdRef.current = userId;
    setRows([]);
    setConfirmOpen(false);
    void load(userId);
  }, [userId, load]);

  const activeCount = rows.filter((r) => statusOf(r) === 'active').length;

  const handleRevokeAll = async () => {
    if (!hasPermission('user.update')) return;
    const requestedId = userId;
    try {
      const body = await userService.revokeAllMcpTokens(requestedId);
      if (isStale(requestedId)) return;
      toast.success(t('pages.users.mcpTokens.revokedAll', { count: unwrapCount(body) }));
      setConfirmOpen(false);
      await load(requestedId);
    } catch (err: unknown) {
      if (isStale(requestedId)) return;
      toast.error(t('pages.users.mcpTokens.revokeAllFailed'), { description: getErrorDetail(err, t) });
    }
  };

  const statusLabel: Record<McpTokenStatus, string> = {
    active: t('pages.users.mcpTokens.statusActive'),
    expired: t('pages.users.mcpTokens.statusExpired'),
    revoked: t('pages.users.mcpTokens.statusRevoked'),
  };
  const when = (iso?: string | null) => (iso ? formatStatusTime(iso) : t('pages.users.mcpTokens.never'));

  return (
    <Can permission="user.read">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <CardTitle>{t('pages.users.mcpTokens.title')}</CardTitle>
              <CardDescription>{t('pages.users.mcpTokens.description')}</CardDescription>
            </div>
            <Can permission="user.update">
              <Button
                variant="destructive"
                size="sm"
                className="shrink-0"
                disabled={loading || activeCount === 0}
                onClick={() => setConfirmOpen(true)}
              >
                <Ban className="mr-2 h-4 w-4" />
                {t('pages.users.mcpTokens.revokeAll')}
              </Button>
            </Can>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('pages.users.mcpTokens.loading')}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('pages.users.mcpTokens.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('pages.users.mcpTokens.name')}</TableHead>
                    <TableHead>{t('pages.users.mcpTokens.token')}</TableHead>
                    <TableHead>{t('pages.users.mcpTokens.createdAt')}</TableHead>
                    <TableHead>{t('pages.users.mcpTokens.expiresAt')}</TableHead>
                    <TableHead>{t('pages.users.mcpTokens.lastUsedAt')}</TableHead>
                    <TableHead>{t('pages.users.mcpTokens.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const status = statusOf(row);
                    return (
                      <TableRow key={row.id} className={status === 'active' ? undefined : 'text-muted-foreground'}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="font-mono">{row.token_prefix}…</TableCell>
                        <TableCell>{when(row.created_at)}</TableCell>
                        <TableCell>{when(row.expires_at)}</TableCell>
                        <TableCell>{when(row.last_used_at)}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_BADGE[status]}>{statusLabel[status]}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('pages.users.mcpTokens.revokeAllTitle')}
        description={t('pages.users.mcpTokens.revokeAllConfirm', { count: activeCount, name: userName })}
        confirmText={t('pages.users.mcpTokens.revokeAll')}
        confirmVariant="destructive"
        onConfirm={handleRevokeAll}
      />
    </Can>
  );
}
```

If `src/pages/CLAUDE.md:97` requires `<EmptyState icon title />` for empty content, replace the empty `<p>` with it — find the import path from any page that already uses `EmptyState` (`grep -rn "EmptyState" src/pages | head -1`) and pass `icon={KeyRound}` (from `lucide-react`) and `title={t('pages.users.mcpTokens.empty')}`.

- [ ] **Step 2: mount in `UserEdit.tsx`** — add the import next to line 24:

```ts
import { UserMcpTokensCard } from "./userEdit/UserMcpTokensCard";
```

and insert right after the `UserAccessTree` block closes (after line 838 `)}`):

```tsx
        {!isNew && id && <UserMcpTokensCard userId={id} userName={heroName} />}
```

(`heroName` is the const computed at ~line 537; `id` comes from `useParams` at line 83.)

- [ ] **Step 3: keep the existing suite green** — in `src/pages/UserEdit.test.tsx` inside the `userService` mock object (lines 23-30) add:

```ts
    listMcpTokens: vi.fn().mockResolvedValue({ data: [] }),
    revokeAllMcpTokens: vi.fn().mockResolvedValue({ data: { revoked_count: 0 } }),
```

- [ ] **Step 4: verify**

```bash
bun run typecheck && bunx eslint src/pages/userEdit/UserMcpTokensCard.tsx src/pages/UserEdit.tsx src/pages/UserEdit.test.tsx
bun run test -- src/pages/UserEdit.test.tsx
```

Expected: typecheck + eslint clean; the UserEdit suite passes as before

- [ ] **Step 5: commit**

```bash
git add src/pages/userEdit/UserMcpTokensCard.tsx src/pages/UserEdit.tsx src/pages/UserEdit.test.tsx
git commit -m "feat(users): MCP tokens card on UserEdit with admin revoke-all"
```

---

### Task 3: repo gates + manual check

- [ ] **Step 1: gates**

```bash
bun run typecheck && bun run lint && bun run test
git status --short   # only the owner's pre-existing files may remain
```

- [ ] **Step 2: manual (dev gateway running on backend main; `bun run dev` here)**

1. Open `/users/<id>/edit` for a user who owns MCP tokens → card lists them with correct statuses; dates local.
2. Click "Revoke all MCP tokens" → destructive confirm names the user and the active count → confirm → toast "Revoked N token(s)" → list refreshes, all Revoked, button disabled.
3. Open a user with no tokens → empty state, button disabled.
4. As a user without `user.update` (if available) → button absent; without `user.read` → card absent.
5. Switch language to Thai → all card strings translated.

- [ ] **Step 3: commit fallout (if any)**

```bash
git add <files>
git commit -m "fix(users): gate fallout for MCP tokens card"
```

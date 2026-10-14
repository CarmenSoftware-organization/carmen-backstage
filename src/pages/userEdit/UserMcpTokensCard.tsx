import { useCallback, useEffect, useRef, useState } from 'react';
import { Ban, KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '../../hooks/useI18n';
import { useAuth } from '../../context/AuthContext';
import userService from '../../services/userService';
import { getErrorDetail } from '../../utils/errorParser';
import { formatStatusTime } from '../../utils/applicationStatus';
import type { McpTokenRow } from '../../types';
import Can from '../../components/Can';
import { EmptyState } from '../../components/EmptyState';
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
            <EmptyState icon={KeyRound} title={t('pages.users.mcpTokens.empty')} />
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

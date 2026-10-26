import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import Layout from '../components/Layout';
import { PageHeader } from '../components/PageHeader';
import Can from '../components/Can';
import { ListEmptyState } from '../components/ListEmptyState';
import { TableSkeleton } from '../components/TableSkeleton';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import aiProviderService from '../services/aiProviderService';
import { getErrorDetail } from '../utils/errorParser';
import { BACKSTAGE_SCOPED_RECORD } from '../utils/permissions';
import { useI18n } from '../hooks/useI18n';
import type { AiProvider } from '../types';
import AiProviderEditDialog from './aiProviders/AiProviderEditDialog';

export default function AiProviderManagement() {
  const { t } = useI18n();
  const [items, setItems] = useState<AiProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AiProvider | 'new' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await aiProviderService.list();
      setItems([...rows].sort((a, b) => a.sort_order - b.sort_order));
    } catch (err) {
      toast.error(t('pages.aiProviders.loadFailed', { detail: getErrorDetail(err, t) }));
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => { void load(); }, [load]);

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    try {
      await aiProviderService.remove(deleteId);
      toast.success(t('toast.deleted', { entity: t('entity.aiProvider.title') }));
      setDeleteId(null);
      await load();
    } catch (err) {
      toast.error(t('toast.deleteFailed', { entity: t('entity.aiProvider.lower') }), {
        description: getErrorDetail(err, t),
      });
    }
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title={t('nav.aiProviders')}
          subtitle={t('pages.aiProviders.subtitle')}
          actions={
            <Can permission="ai_provider.create" clusterId={BACKSTAGE_SCOPED_RECORD}>
              <Button onClick={() => setEditing('new')}>
                <Plus className="mr-2 h-4 w-4" />
                {t('pages.aiProviders.add')}
              </Button>
            </Can>
          }
        />
        <Card>
          <CardContent className="pt-6">
            {loading && items.length === 0 ? (
              <TableSkeleton columns={7} />
            ) : items.length === 0 ? (
              <ListEmptyState
                searchTerm=""
                activeFilterCount={0}
                icon={Sparkles}
                emptyTitle={t('pages.aiProviders.empty')}
                emptyDescription=""
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">{t('pages.aiProviders.columnIcon')}</th>
                      <th className="px-3 py-2 font-medium">{t('pages.aiProviders.columnLabel')}</th>
                      <th className="px-3 py-2 font-medium">{t('pages.aiProviders.columnCode')}</th>
                      <th className="px-3 py-2 font-medium">{t('pages.aiProviders.columnStatus')}</th>
                      <th className="px-3 py-2 font-medium">{t('pages.aiProviders.columnDefaultBu')}</th>
                      <th className="px-3 py-2 font-medium">{t('pages.aiProviders.columnSort')}</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr key={row.id} className={`border-b last:border-0 ${row.is_active ? '' : 'text-muted-foreground'}`}>
                        <td className="px-3 py-2.5">
                          {row.icon_url ? (
                            <img src={row.icon_url} alt="" className="h-5 w-5 object-contain" />
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground">{row.icon_key ?? '-'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-medium">{row.label}</td>
                        <td className="px-3 py-2.5 font-mono text-xs">{row.code}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant={row.is_active ? 'success' : 'secondary'}>
                            {t(row.is_active ? 'common.status.active' : 'common.status.inactive')}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant={row.default_enabled_for_bu ? 'success' : 'secondary'}>
                            {t(row.default_enabled_for_bu ? 'pages.aiProviders.defaultOn' : 'pages.aiProviders.defaultOff')}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5">{row.sort_order}</td>
                        <td className="px-3 py-1.5">
                          <div className="flex justify-end gap-1">
                            <Can permission="ai_provider.update" clusterId={BACKSTAGE_SCOPED_RECORD}>
                              <Button
                                variant="ghost" size="icon" disabled={loading}
                                aria-label={t('common.action.edit')}
                                onClick={() => setEditing(row)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </Can>
                            <Can permission="ai_provider.delete" clusterId={BACKSTAGE_SCOPED_RECORD}>
                              <Button
                                variant="ghost" size="icon" disabled={loading}
                                aria-label={t('common.action.delete')}
                                onClick={() => setDeleteId(row.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </Can>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title={t('pages.aiProviders.deleteTitle')}
        description={t('pages.aiProviders.deleteDescription')}
        confirmText={t('common.action.delete')}
        confirmVariant="destructive"
        onConfirm={handleConfirmDelete}
      />

      <AiProviderEditDialog
        open={editing !== null}
        onOpenChange={(open) => { if (!open) setEditing(null); }}
        provider={editing !== null && editing !== 'new' ? editing : null}
        nextSortOrder={items.reduce((max, it) => Math.max(max, it.sort_order), 0) + 10}
        onSaved={() => { setEditing(null); void load(); }}
      />
    </Layout>
  );
}

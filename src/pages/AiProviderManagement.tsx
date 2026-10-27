import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ClipboardCopy, Link2, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
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
import { ProviderIconMark } from '../components/icons/ProviderIcons';
import AiProviderEditDialog from './aiProviders/AiProviderEditDialog';

// โดเมนที่ผู้ใช้จะถูกพาไป — อ่านง่ายกว่า template เต็มซึ่งยาวและมี {query}
const hostOf = (template: string) => {
  try {
    return new URL(template.replace(/\{query\}/g, 'q')).hostname;
  } catch {
    return template;
  }
};

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
          <CardContent className={items.length === 0 ? 'pt-6' : 'p-0'}>
            {loading && items.length === 0 ? (
              <TableSkeleton columns={6} />
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
                <table className="w-full text-sm md:min-w-[640px]">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">{t('pages.aiProviders.columnProvider')}</th>
                      <th className="hidden px-4 py-2.5 font-medium md:table-cell">{t('pages.aiProviders.columnOpens')}</th>
                      <th className="hidden px-4 py-2.5 font-medium lg:table-cell">{t('pages.aiProviders.columnPrompt')}</th>
                      <th className="px-4 py-2.5 font-medium">{t('pages.aiProviders.columnStatus')}</th>
                      <th className="hidden px-4 py-2.5 font-medium md:table-cell">{t('pages.aiProviders.columnDefaultBu')}</th>
                      <th className="hidden px-4 py-2.5 text-right font-medium md:table-cell">{t('pages.aiProviders.columnSort')}</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => {
                      const prefills = row.url_template.includes('{query}');
                      // prompt ที่ seed มามักเหมือนกันทุกราย — บอกว่ารายไหนถูกแก้ให้ต่างไปแล้วมีประโยชน์กว่าโชว์บรรทัดแรกซ้ำ ๆ
                      const sharedWith = items.filter((it) => it.id !== row.id && it.default_prompt === row.default_prompt).length;
                      return (
                        <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className={`flex items-center gap-3 ${row.is_active ? '' : 'opacity-50'}`}>
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background">
                                {row.icon_url ? (
                                  <img src={row.icon_url} alt="" referrerPolicy="no-referrer" className="h-5 w-5 object-contain" />
                                ) : (
                                  <ProviderIconMark iconKey={row.icon_key} className="h-5 w-5" />
                                )}
                              </span>
                              <div className="min-w-0">
                                <div className="font-medium">{row.label}</div>
                                <div className="hidden font-mono text-xs text-muted-foreground md:block">{row.code}</div>
                                <div className="truncate font-mono text-xs text-muted-foreground md:hidden">{hostOf(row.url_template)}</div>
                              </div>
                            </div>
                          </td>
                          <td className="hidden px-4 py-3 md:table-cell">
                            <div className="font-mono text-xs">{hostOf(row.url_template)}</div>
                            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              {prefills ? <Link2 className="h-3 w-3 shrink-0" /> : <ClipboardCopy className="h-3 w-3 shrink-0" />}
                              {t(prefills ? 'pages.aiProviders.opensPrefilled' : 'pages.aiProviders.opensCopied')}
                            </div>
                          </td>
                          <td className="hidden px-4 py-3 lg:table-cell">
                            <div className="tabular-nums" title={row.default_prompt}>
                              {t('pages.aiProviders.promptChars', { count: row.default_prompt.length })}
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {sharedWith > 0
                                ? t('pages.aiProviders.promptShared', { count: sharedWith })
                                : t('pages.aiProviders.promptUnique')}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={row.is_active ? 'success' : 'secondary'}>
                              {t(row.is_active ? 'common.status.active' : 'common.status.inactive')}
                            </Badge>
                            {/* จอแคบซ่อนคอลัมน์ BU — ย้ายมาเป็นบรรทัดรองใต้สถานะ */}
                            <div className="mt-1 text-xs text-muted-foreground md:hidden">
                              {t(row.default_enabled_for_bu ? 'pages.aiProviders.buDefaultOn' : 'pages.aiProviders.buDefaultOff')}
                            </div>
                          </td>
                          <td className="hidden px-4 py-3 md:table-cell">
                            <Badge variant={row.default_enabled_for_bu ? 'outline' : 'secondary'}>
                              {t(row.default_enabled_for_bu ? 'pages.aiProviders.buDefaultOn' : 'pages.aiProviders.buDefaultOff')}
                            </Badge>
                          </td>
                          <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground md:table-cell">{row.sort_order}</td>
                          <td className="px-4 py-2">
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
                      );
                    })}
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

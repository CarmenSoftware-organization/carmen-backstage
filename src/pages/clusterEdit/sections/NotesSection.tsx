import { useEffect, useRef } from 'react';
import { Loader2, StickyNote } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { EmptyState } from '../../../components/EmptyState';
import { useAuth } from '../../../context/AuthContext';
import { useI18n } from '../../../hooks/useI18n';
import { NoteComposer } from '../notes/NoteComposer';
import { NoteItem } from '../notes/NoteItem';
import { useClusterNotes } from '../notes/useClusterNotes';
import type { ClusterNote } from '../../../types';

interface NotesSectionProps {
  clusterId: string;
  /** ให้ ClusterEdit โชว์จำนวนบน tab (รู้ค่าหลังเปิด tab ครั้งแรก) */
  onTotalChange?: (total: number) => void;
}

/** tab "Notes" — ไทม์ไลน์ (ซ้าย) + แผงไฟล์ (ขวา; stack ด้านบนต่ำกว่า lg) */
export function NotesSection({ clusterId, onTotalChange }: NotesSectionProps) {
  const { t } = useI18n();
  const { hasPermission } = useAuth();
  const canManage =
    hasPermission('cluster_note.view', { clusterId }) && hasPermission('cluster_note.manage', { clusterId });
  const state = useClusterNotes(clusterId);
  const { notes, total, loading, hasMore, loadMore, refetch, replaceNote, dropNote, prependNote } = state;

  // Report only after a real load: the hook's initial total (0) must not overwrite the count
  // ClusterEdit already seeded on page load.
  const sawLoading = useRef(false);
  useEffect(() => {
    if (loading) {
      sawLoading.current = true;
      return;
    }
    if (sawLoading.current) onTotalChange?.(total);
  }, [total, loading, onTotalChange]);

  // Task 9 hook-in: เปิดแผงประวัติ (no-op จนกว่า Task 9 จะเสียบ)
  const handleOpenHistory = (_note: ClusterNote) => {};

  return (
    <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_18rem]">
      {/* Task 9: files panel slot — แสดงด้านบนต่ำกว่า lg (order-first), คอลัมน์ขวาที่ lg */}
      <aside
        data-slot="notes-files-panel"
        className="order-first border-b empty:hidden lg:order-last lg:border-b-0 lg:border-l"
      />

      <div className="min-w-0">
        {canManage && <NoteComposer clusterId={clusterId} onCreated={prependNote} />}

        {loading && notes.length === 0 ? (
          <div className="space-y-4 p-4" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        ) : notes.length === 0 ? (
          <EmptyState
            icon={StickyNote}
            title={t('pages.clusterNotes.emptyTitle')}
            description={t('pages.clusterNotes.emptyDescription')}
          />
        ) : (
          <ul className="divide-y">
            {notes.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                clusterId={clusterId}
                canManage={canManage}
                onChanged={replaceNote}
                onDeleted={dropNote}
                onOpenHistory={handleOpenHistory}
                onConflict={refetch}
              />
            ))}
          </ul>
        )}

        {hasMore && (
          <div className="flex justify-center border-t p-3">
            <Button variant="outline" size="sm" onClick={loadMore} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('pages.clusterNotes.loadMore')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

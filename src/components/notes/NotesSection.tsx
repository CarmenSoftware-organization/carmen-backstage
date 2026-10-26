import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, StickyNote } from 'lucide-react';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { EmptyState } from '../EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../hooks/useI18n';
import { NoteComposer } from './NoteComposer';
import { NoteItem } from './NoteItem';
import { NoteFilesPanel } from './NoteFilesPanel';
import { DeletedNotesList } from './DeletedNotesList';
import { NoteHistorySheet } from './NoteHistorySheet';
import { useNotes } from './useNotes';
import type { Note } from '../../types';
import type { TKey } from '../../i18n/types';
import type { NotesAdapter, NotesPermissionKeys } from './types';

interface NotesSectionProps {
  ownerId: string;
  /** cluster ที่ใช้ scope สิทธิ์ — cluster: เท่ากับ ownerId, BU: cluster ของ BU */
  scopeClusterId: string;
  adapter: NotesAdapter;
  permissions: NotesPermissionKeys;
  /** ให้ ClusterEdit โชว์จำนวนบน tab (รู้ค่าหลังเปิด tab ครั้งแรก) */
  onTotalChange?: (total: number) => void;
  /** i18n key ของคำอธิบายสถานะว่าง — default คือข้อความของ cluster */
  emptyDescriptionKey?: TKey;
}

/** tab "Notes" — ไทม์ไลน์ (ซ้าย) + แผงไฟล์ (ขวา; stack ด้านบนต่ำกว่า lg) */
export function NotesSection({ ownerId, scopeClusterId, adapter, permissions, onTotalChange, emptyDescriptionKey = 'pages.clusterNotes.emptyDescription' }: NotesSectionProps) {
  const { t } = useI18n();
  const { hasPermission } = useAuth();
  const canManage =
    hasPermission(permissions.view, { clusterId: scopeClusterId }) &&
    hasPermission(permissions.manage, { clusterId: scopeClusterId });
  const state = useNotes(adapter, ownerId);
  const { notes, total, loading, hasMore, loadMore, refetch, replaceNote, dropNote, prependNote } = state;

  // refreshKey: bump หลัง create/update/delete/restore เพื่อให้แผงไฟล์โหลดใหม่
  const [refreshKey, setRefreshKey] = useState(0);
  const bumpFiles = useCallback(() => setRefreshKey((k) => k + 1), []);
  // dropNote ไม่แตะ deletedCount — เก็บค่าเองแล้วปรับ ±1; refetch ที่มี summary จะเขียนทับด้วยค่าจริง
  const [deletedCount, setDeletedCount] = useState(0);
  useEffect(() => setDeletedCount(state.deletedCount), [state.deletedCount]);
  // เปลี่ยนค่า = DeletedNotesList (ถ้ากางอยู่) mount ใหม่และโหลดรายการที่ลบแล้วล่าสุด
  const [deletedListKey, setDeletedListKey] = useState(0);
  const [historyNoteId, setHistoryNoteId] = useState<string | null>(null);

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

  const handleOpenHistory = (note: Note) => setHistoryNoteId(note.id);

  const handleCreated = (note: Note) => {
    prependNote(note);
    bumpFiles();
  };
  const handleChanged = (note: Note) => {
    replaceNote(note);
    bumpFiles();
  };
  const handleDeleted = (id: string) => {
    dropNote(id);
    setDeletedCount((c) => c + 1);
    setDeletedListKey((k) => k + 1);
    bumpFiles();
  };
  const handleRestored = () => {
    setDeletedCount((c) => Math.max(0, c - 1));
    void refetch();
    bumpFiles();
  };

  return (
    <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_18rem]">
      {/* แผงไฟล์ — แสดงด้านบนต่ำกว่า lg (order-first), คอลัมน์ขวาที่ lg */}
      <aside
        data-slot="notes-files-panel"
        className="order-first border-b empty:hidden lg:order-last lg:border-b-0 lg:border-l"
      >
        <NoteFilesPanel ownerId={ownerId} adapter={adapter} refreshKey={refreshKey} />
      </aside>

      <div className="min-w-0">
        {canManage && <NoteComposer ownerId={ownerId} adapter={adapter} onCreated={handleCreated} />}

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
            description={t(emptyDescriptionKey)}
          />
        ) : (
          <ul className="divide-y">
            {notes.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                ownerId={ownerId}
                adapter={adapter}
                canManage={canManage}
                onChanged={handleChanged}
                onDeleted={handleDeleted}
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

        <DeletedNotesList
          key={deletedListKey}
          ownerId={ownerId}
          adapter={adapter}
          canManage={canManage}
          deletedCount={deletedCount}
          onRestored={handleRestored}
          onOpenHistory={handleOpenHistory}
        />
      </div>

      <NoteHistorySheet
        ownerId={ownerId}
        adapter={adapter}
        noteId={historyNoteId}
        open={historyNoteId !== null}
        onOpenChange={(o) => {
          if (!o) setHistoryNoteId(null);
        }}
      />
    </div>
  );
}

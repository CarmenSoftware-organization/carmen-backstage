import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, RotateCcw } from 'lucide-react';
import { NoteFileIcon } from './NoteFileIcon';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { AuditMeta } from '../AuditMeta';
import { useI18n } from '../../hooks/useI18n';
import { normalizeAudit } from '../../utils/audit';
import { getErrorDetail } from '../../utils/errorParser';
import { useNotes } from './useNotes';
import { openNoteFile } from './openNoteFile';
import type { Note } from '../../types';
import type { NotesAdapter } from './types';

interface DeletedNotesListProps {
  ownerId: string;
  adapter: NotesAdapter;
  canManage: boolean;
  deletedCount: number;
  onRestored: (note: Note) => void;
  onOpenHistory?: (note: Note) => void;
}

/** รายการโน้ตที่ลบแล้ว (อ่านอย่างเดียว) — กู้คืนได้เมื่อ `canManage` */
function DeletedRows({ ownerId, adapter, canManage, onRestored, onOpenHistory }: Omit<DeletedNotesListProps, 'deletedCount'>) {
  const { t } = useI18n();
  const { notes, loading, hasMore, loadMore, dropNote } = useNotes(adapter, ownerId, { deleted: true });
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const handleRestore = async (note: Note) => {
    setRestoringId(note.id);
    try {
      await adapter.restore(ownerId, note.id);
      toast.success(t('pages.clusterNotes.restored'));
      dropNote(note.id);
      onRestored(note);
    } catch (err) {
      toast.error(getErrorDetail(err, t));
    } finally {
      setRestoringId(null);
    }
  };

  if (loading && notes.length === 0) {
    return (
      <div className="space-y-2 p-4" aria-busy="true">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }
  if (notes.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">{t('pages.clusterNotes.deletedEmpty')}</p>;
  }

  return (
    <>
      <ul className="divide-y">
        {notes.map((note) => {
          const audit = normalizeAudit(note);
          return (
            <li key={note.id} className="space-y-2 p-4 opacity-90">
              <div className="flex items-start justify-between gap-2">
                <AuditMeta
                  variant="compact"
                  verbKey="pages.clusterNotes.deletedVerb"
                  actor={audit.deleted}
                  className="text-xs text-muted-foreground"
                />
                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={restoringId !== null}
                    onClick={() => void handleRestore(note)}
                  >
                    {restoringId === note.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-2 h-4 w-4" />
                    )}
                    {t('pages.clusterNotes.restore')}
                  </Button>
                )}
              </div>
              {note.message && <p className="whitespace-pre-wrap break-words text-sm">{note.message}</p>}
              {(note.attachments ?? []).length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {note.attachments.map((a) => (
                    <li key={a.fileToken}>
                      <button
                        type="button"
                        onClick={() => void openNoteFile(adapter, ownerId, a.fileToken, t)}
                        className="flex max-w-full items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs hover:bg-muted"
                      >
                        <NoteFileIcon fileName={a.fileName} contentType={a.contentType} />
                        <span className="truncate">{a.fileName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {onOpenHistory && (
                <p className="text-xs">
                  <button type="button" className="underline hover:text-foreground" onClick={() => onOpenHistory(note)}>
                    {t('pages.clusterNotes.viewHistory')}
                  </button>
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {hasMore && (
        <div className="flex justify-center border-t p-3">
          <Button variant="outline" size="sm" onClick={loadMore} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('pages.clusterNotes.loadMore')}
          </Button>
        </div>
      )}
    </>
  );
}

/** ปุ่ม "Show deleted notes (n)" ใต้ไทม์ไลน์ — โหลดรายการเมื่อกางครั้งแรกเท่านั้น */
export function DeletedNotesList({ deletedCount, ...rest }: DeletedNotesListProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  if (deletedCount <= 0 && !open) return null;

  return (
    <div className="border-t">
      <div className="p-3">
        <Button variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open
            ? t('pages.clusterNotes.hideDeleted')
            : t('pages.clusterNotes.showDeleted', { count: deletedCount })}
        </Button>
      </div>
      {open && <DeletedRows {...rest} />}
    </div>
  );
}

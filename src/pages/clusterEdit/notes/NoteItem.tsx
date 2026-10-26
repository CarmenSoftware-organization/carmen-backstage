import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, MoreHorizontal, Paperclip } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { AuditMeta } from '../../../components/AuditMeta';
import clusterNoteService from '../../../services/clusterNoteService';
import { useI18n } from '../../../hooks/useI18n';
import { normalizeAudit } from '../../../utils/audit';
import { getErrorDetail } from '../../../utils/errorParser';
import { notifyVersionConflict } from '../../../utils/docVersion';
import type { ClusterNote } from '../../../types';

interface NoteItemProps {
  note: ClusterNote;
  clusterId: string;
  canManage: boolean;
  onChanged: (note: ClusterNote) => void;
  onDeleted: (id: string) => void;
  onOpenHistory: (note: ClusterNote) => void;
  /** 409 = doc_version ชนหรือ state ไม่ตรง (เช่นถูกลบไปแล้ว) — ผู้เรียกโหลดรายการใหม่เพื่อให้เห็นสถานะจริง */
  onConflict: () => void;
}

const statusOf = (err: unknown): number | undefined =>
  (err as { response?: { status?: number } })?.response?.status;

/** โน้ตหนึ่งรายการในไทม์ไลน์ — แก้ข้อความ inline / ลบ ได้เมื่อ `canManage` */
export function NoteItem({ note, clusterId, canManage, onChanged, onDeleted, onOpenHistory, onConflict }: NoteItemProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.message ?? '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) editRef.current?.focus();
  }, [editing]);

  const audit = normalizeAudit(note);
  const attachments = note.attachments ?? [];
  // โน้ตที่มีแต่ไฟล์ (message ว่าง) ต้องไม่ถูกแก้จนว่างทั้งข้อความและไฟล์
  const canSaveEdit = !saving && draft !== (note.message ?? '') && (draft.trim() !== '' || attachments.length > 0);

  const startEdit = () => {
    setDraft(note.message ?? '');
    setEditing(true);
  };

  const handleSave = async () => {
    if (!canSaveEdit) return;
    setSaving(true);
    try {
      const updated = await clusterNoteService.update(clusterId, note.id, {
        message: draft.trim(),
        doc_version: note.doc_version,
      });
      setEditing(false);
      toast.success(t('pages.clusterNotes.updated'));
      onChanged(updated);
    } catch (err) {
      if (statusOf(err) === 409) {
        notifyVersionConflict(t);
        setEditing(false);
        onConflict();
      } else {
        toast.error(getErrorDetail(err, t));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await clusterNoteService.remove(clusterId, note.id);
      setConfirmDelete(false);
      toast.success(t('pages.clusterNotes.deleted'));
      onDeleted(note.id);
    } catch (err) {
      setConfirmDelete(false);
      if (statusOf(err) === 409) {
        notifyVersionConflict(t);
        onConflict();
      } else {
        toast.error(getErrorDetail(err, t));
      }
    }
  };

  // ไม่ log token/URL — ทั้งคู่เป็นข้อมูลเข้าถึงไฟล์
  const openFile = async (fileToken: string) => {
    try {
      const { url } = await clusterNoteService.fileUrl(clusterId, fileToken);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(getErrorDetail(err, t));
    }
  };

  return (
    <li className="space-y-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <AuditMeta variant="compact" actor={audit.created} className="text-xs text-muted-foreground" />
        {canManage && !editing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t('pages.clusterNotes.menu')}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={startEdit}>{t('common.action.edit')}</DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setConfirmDelete(true)}
              >
                {t('common.action.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            ref={editRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            disabled={saving}
            aria-label={t('pages.clusterNotes.editAria')}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!canSaveEdit}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? t('common.busy.saving') : t('common.action.save')}
            </Button>
          </div>
        </div>
      ) : (
        note.message && <p className="whitespace-pre-wrap break-words text-sm">{note.message}</p>
      )}

      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {attachments.map((a) => (
            <li key={a.fileToken}>
              <button
                type="button"
                onClick={() => void openFile(a.fileToken)}
                className="flex max-w-full items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs hover:bg-muted"
              >
                <Paperclip className="h-3 w-3 shrink-0" />
                <span className="truncate">{a.fileName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {note.is_edited && (
        <p className="text-xs text-muted-foreground">
          {t('pages.clusterNotes.edited')} ·{' '}
          <button type="button" className="underline hover:text-foreground" onClick={() => onOpenHistory(note)}>
            {t('pages.clusterNotes.viewHistory')}
          </button>
        </p>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('pages.clusterNotes.deleteTitle')}
        description={t('pages.clusterNotes.deleteDescription')}
        confirmText={t('common.action.delete')}
        confirmVariant="destructive"
        onConfirm={handleDelete}
      />
    </li>
  );
}

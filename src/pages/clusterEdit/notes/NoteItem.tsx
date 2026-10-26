import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, MoreHorizontal, Paperclip, X } from 'lucide-react';
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
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges';
import { openNoteFile } from './openNoteFile';
import { NOTE_ACCEPT, NOTE_MAX_FILES, validatePickedFiles } from './attachmentRules';
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
  const [picked, setPicked] = useState<File[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) editRef.current?.focus();
  }, [editing]);

  const audit = normalizeAudit(note);
  const attachments = note.attachments ?? [];
  const remaining = attachments.filter((a) => !removed.includes(a.fileToken));
  const dirty = draft !== (note.message ?? '') || picked.length > 0 || removed.length > 0;
  useUnsavedChanges(editing && dirty);
  // ผลลัพธ์ต้องไม่ว่างทั้งข้อความและไฟล์ (เดิม − ที่เอาออก + ที่เพิ่ม)
  const canSaveEdit = !saving && dirty && (draft.trim() !== '' || remaining.length + picked.length > 0);

  const closeEdit = () => {
    setEditing(false);
    setPicked([]);
    setRemoved([]);
  };

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (list.length === 0) return;
    const { ok, errors } = validatePickedFiles(list, remaining.length + picked.length);
    errors.forEach((er) => toast.error(t(er.key, er.params)));
    setPicked((prev) => [...prev, ...ok]);
  };

  const startEdit = () => {
    setDraft(note.message ?? '');
    setPicked([]);
    setRemoved([]);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!canSaveEdit) return;
    setSaving(true);
    try {
      const updated = await clusterNoteService.update(clusterId, note.id, {
        ...(draft !== (note.message ?? '') ? { message: draft.trim() } : {}),
        files: picked,
        remove: removed,
        doc_version: note.doc_version,
      });
      closeEdit();
      toast.success(t('pages.clusterNotes.updated'));
      onChanged(updated);
    } catch (err) {
      if (statusOf(err) === 409) {
        notifyVersionConflict(t);
        closeEdit();
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
          {(remaining.length > 0 || picked.length > 0) && (
            <ul className="flex flex-wrap gap-2">
              {remaining.map((a) => (
                <li key={a.fileToken} className="flex max-w-full items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs">
                  <Paperclip className="h-3 w-3 shrink-0" />
                  <span className="truncate">{a.fileName}</span>
                  <button
                    type="button"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label={t('pages.clusterNotes.removeFile', { name: a.fileName })}
                    disabled={saving}
                    onClick={() => setRemoved((prev) => [...prev, a.fileToken])}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
              {picked.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex max-w-full items-center gap-1.5 rounded-md border border-dashed bg-muted/40 px-2 py-1 text-xs">
                  <Paperclip className="h-3 w-3 shrink-0" />
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label={t('pages.clusterNotes.removeFile', { name: f.name })}
                    disabled={saving}
                    onClick={() => setPicked((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input ref={fileInputRef} type="file" multiple accept={NOTE_ACCEPT} className="hidden" onChange={handlePick} />
          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving || remaining.length + picked.length >= NOTE_MAX_FILES}
            >
              <Paperclip className="mr-2 h-4 w-4" />
              {t('pages.clusterNotes.attach')}
            </Button>
            <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={closeEdit} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!canSaveEdit}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? t('common.busy.saving') : t('common.action.save')}
            </Button>
            </div>
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
                onClick={() => void openNoteFile(clusterId, a.fileToken, t)}
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

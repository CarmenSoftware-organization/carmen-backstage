import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Paperclip, Send, X } from 'lucide-react';
import { NoteFileIcon } from './NoteFileIcon';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { useI18n } from '../../hooks/useI18n';
import { getErrorDetail } from '../../utils/errorParser';
import type { Note } from '../../types';
import { NOTE_ACCEPT, NOTE_MAX_FILES, validatePickedFiles } from './attachmentRules';
import type { NotesAdapter } from './types';

interface NoteComposerProps {
  ownerId: string;
  adapter: NotesAdapter;
  onCreated: (note: Note) => void;
}

/** ช่องเขียนโน้ตใหม่ + แนบไฟล์ (ตรวจ 10 MB / 5 ไฟล์ ฝั่ง client ก่อนส่ง) */
export function NoteComposer({ ownerId, adapter, onCreated }: NoteComposerProps) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // second caller of the hook is fine: each call registers its own beforeunload listener
  useUnsavedChanges(text !== '' || files.length > 0);

  const canSave = (text.trim() !== '' || files.length > 0) && !saving;

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (picked.length === 0) return;
    const { ok, errors } = validatePickedFiles(picked, files.length);
    errors.forEach((e) => toast.error(t(e.key, e.params)));
    setFiles((prev) => [...prev, ...ok]);
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const note = await adapter.create(ownerId, { message: text.trim(), files });
      setText('');
      setFiles([]);
      toast.success(t('pages.clusterNotes.created'));
      onCreated(note);
    } catch (err) {
      toast.error(getErrorDetail(err, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 border-b p-4">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('pages.clusterNotes.placeholder')}
        aria-label={t('pages.clusterNotes.placeholder')}
        rows={3}
        disabled={saving}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            void handleSave();
          }
        }}
      />
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex max-w-full items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs"
            >
              <NoteFileIcon fileName={f.name} contentType={f.type} />
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={t('pages.clusterNotes.removeFile', { name: f.name })}
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                disabled={saving}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between gap-3">
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={NOTE_ACCEPT}
            className="hidden"
            onChange={handlePick}
            data-testid="note-file-input"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={saving || files.length >= NOTE_MAX_FILES}
          >
            <Paperclip className="mr-2 h-4 w-4" />
            {t('pages.clusterNotes.attach')}
          </Button>
        </div>
        <Button type="button" size="sm" onClick={handleSave} disabled={!canSave}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          {saving ? t('common.busy.saving') : t('pages.clusterNotes.post')}
        </Button>
      </div>
    </div>
  );
}

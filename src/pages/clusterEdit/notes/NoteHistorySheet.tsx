import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, History, Loader2 } from 'lucide-react';
import { NoteFileIcon } from './NoteFileIcon';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../../components/ui/sheet';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { EmptyState } from '../../../components/EmptyState';
import { AuditMeta } from '../../../components/AuditMeta';
import { ActivityDiffView, visibleFieldChanges } from '../../../components/activityTrail/ActivityDiffView';
import clusterNoteService from '../../../services/clusterNoteService';
import { useI18n } from '../../../hooks/useI18n';
import { cn } from '../../../lib/utils';
import { normalizeAudit } from '../../../utils/audit';
import type { AuditActor } from '../../../utils/audit';
import { getErrorDetail } from '../../../utils/errorParser';
import { openNoteFile } from './openNoteFile';
import type { TKey } from '../../../i18n/types';
import type { ActivityDiff, ClusterNoteHistoryEntry, ClusterNoteSnapshotAttachment } from '../../../types';

const PER_PAGE = 20;

const VERB_KEYS: Record<string, TKey> = {
  create: 'pages.activityTrail.actionCreate',
  update: 'pages.activityTrail.actionUpdate',
  delete: 'pages.activityTrail.actionDelete',
  restore: 'pages.activityTrail.actionRestore',
};

interface NoteHistorySheetProps {
  clusterId: string;
  noteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** คนทำ: อ่านจาก audit ก่อน แล้วถอยไปฟิลด์ actor_* แบน */
function actorOf(entry: ClusterNoteHistoryEntry): AuditActor | undefined {
  const fromAudit = normalizeAudit(entry).created;
  if (fromAudit) return fromAudit;
  const name = [entry.actor_firstname, entry.actor_middlename, entry.actor_lastname].filter(Boolean).join(' ')
    || entry.actor_username
    || undefined;
  if (!entry.created_at && !name) return undefined;
  return { at: entry.created_at, name };
}

/** diff ที่ไม่มี `attachments` — ฟิลด์นั้นเป็น token ดิบ แสดงเป็นรายการไฟล์ที่เปิดได้แทน */
function withoutAttachments(changes?: ActivityDiff): ActivityDiff | undefined {
  if (!changes) return undefined;
  return { ...changes, fields: changes.fields?.filter((f) => f.field !== 'attachments') };
}

function HistoryRow({ clusterId, entry }: { clusterId: string; entry: ClusterNoteHistoryEntry }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const changes = withoutAttachments(entry.changes);
  const fieldCount = visibleFieldChanges(changes).length;
  // เวอร์ชันหลังการเปลี่ยน (ลบ = เวอร์ชันก่อนลบ)
  const snapshot = entry.action === 'delete' ? (entry.old_data ?? entry.new_data) : (entry.new_data ?? entry.old_data);
  const attachments: ClusterNoteSnapshotAttachment[] = snapshot?.attachments ?? [];

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 py-3 text-left focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden"
      >
        <span className="min-w-0 flex-1">
          <AuditMeta
            variant="compact"
            verbKey={entry.action ? VERB_KEYS[entry.action] : undefined}
            actor={actorOf(entry)}
            className="text-xs text-muted-foreground"
          />
        </span>
        {entry.action === 'update' && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {t('pages.activityTrail.changedFields', { count: fieldCount })}
          </span>
        )}
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <div className="space-y-3 pb-3">
          {snapshot?.message && <p className="whitespace-pre-wrap break-words text-sm">{snapshot.message}</p>}
          {attachments.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {attachments.map((a) => (
                <li key={a.fileToken}>
                  <button
                    type="button"
                    onClick={() => void openNoteFile(clusterId, a.fileToken, t)}
                    className={cn(
                      'flex max-w-full items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs hover:bg-muted',
                      a.removed_at && 'text-muted-foreground',
                    )}
                  >
                    <NoteFileIcon fileName={a.fileName} contentType={a.contentType} />
                    <span className={cn('truncate', a.removed_at && 'line-through')}>{a.fileName}</span>
                    {a.removed_at && <span className="shrink-0">({t('pages.clusterNotes.fileRemoved')})</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {entry.action === 'update' && <ActivityDiffView changes={changes} />}
        </div>
      )}
    </div>
  );
}

/** ประวัติการแก้โน้ตหนึ่งรายการ — หน้าตาเดียวกับ ActivityTrailSheet (ใช้ ActivityDiffView ร่วมกัน) */
export function NoteHistorySheet({ clusterId, noteId, open, onOpenChange }: NoteHistorySheetProps) {
  const { t } = useI18n();
  const [entries, setEntries] = useState<ClusterNoteHistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);

  const fetchPage = useCallback(
    async (next: number, append: boolean) => {
      if (!noteId) return;
      const generation = ++generationRef.current;
      setLoading(true);
      setError(null);
      try {
        const res = await clusterNoteService.history(clusterId, noteId, { page: next, perpage: PER_PAGE });
        if (generation !== generationRef.current) return;
        const items = Array.isArray(res.data) ? res.data : [];
        setEntries((prev) => (append ? [...prev, ...items.filter((n) => !prev.some((p) => p.id === n.id))] : items));
        setTotal(res.paginate?.total ?? items.length);
        setPage(next);
      } catch (err) {
        if (generation !== generationRef.current) return;
        setError(getErrorDetail(err, t));
      } finally {
        if (generation === generationRef.current) setLoading(false);
      }
    },
    [clusterId, noteId, t],
  );

  useEffect(() => {
    if (!open || !noteId) return;
    setEntries([]);
    setTotal(0);
    void fetchPage(1, false);
    return () => {
      // counter, not a DOM node: bumping drops any in-flight response
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generationRef.current++;
    };
  }, [open, noteId, fetchPage]);

  const isEmpty = !loading && entries.length === 0 && !error;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t('pages.clusterNotes.historyTitle')}</SheetTitle>
          <SheetDescription>{t('pages.clusterNotes.historyDescription')}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {error && (
            <p className="text-sm text-destructive">
              {t('pages.activityTrail.loadError')} — {error}
            </p>
          )}
          {loading && entries.length === 0 && (
            <div className="divide-y divide-border">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="size-4 shrink-0" />
                </div>
              ))}
            </div>
          )}
          {isEmpty && <EmptyState icon={History} title={t('pages.clusterNotes.historyEmpty')} />}
          {entries.length > 0 && (
            <div>
              {entries.map((entry) => (
                <HistoryRow key={entry.id} clusterId={clusterId} entry={entry} />
              ))}
            </div>
          )}
          {entries.length < total && (
            <Button variant="outline" className="w-full" disabled={loading} onClick={() => void fetchPage(page + 1, true)}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('pages.clusterNotes.loadMore')}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

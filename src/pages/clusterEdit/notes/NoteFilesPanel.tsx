import { useEffect, useRef, useState } from 'react';
import { ChevronDown, FileText } from 'lucide-react';
import { Skeleton } from '../../../components/ui/skeleton';
import { AuditMeta } from '../../../components/AuditMeta';
import clusterNoteService from '../../../services/clusterNoteService';
import { useI18n } from '../../../hooks/useI18n';
import { cn } from '../../../lib/utils';
import { devLog } from '../../../utils/errorParser';
import { openNoteFile } from './openNoteFile';
import type { ClusterNoteFile } from '../../../types';

interface NoteFilesPanelProps {
  clusterId: string;
  /** เปลี่ยนค่า = โหลดรายการไฟล์ใหม่ (bump หลัง create/update/delete/restore) */
  refreshKey: number;
}

/**
 * แผง "ไฟล์ทั้งหมด" — ไฟล์แนบรวมทุกโน้ต ใหม่สุดก่อน
 * ต่ำกว่า lg พับได้ (พับไว้เป็นค่าเริ่มต้น) ที่ lg แสดงเสมอเป็นคอลัมน์ขวา
 */
export function NoteFilesPanel({ clusterId, refreshKey }: NoteFilesPanelProps) {
  const { t } = useI18n();
  const [files, setFiles] = useState<ClusterNoteFile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const generationRef = useRef(0);

  useEffect(() => {
    const generation = ++generationRef.current;
    void (async () => {
      try {
        const rows = await clusterNoteService.files(clusterId);
        if (generation !== generationRef.current) return;
        const list = Array.isArray(rows) ? rows : [];
        setFiles([...list].sort((a, b) => (b.uploaded_at ?? '').localeCompare(a.uploaded_at ?? '')));
        setFailed(false);
      } catch (err) {
        if (generation !== generationRef.current) return;
        devLog('NoteFilesPanel', err);
        setFailed(true);
      } finally {
        if (generation === generationRef.current) setLoaded(true);
      }
    })();
    return () => {
      // counter, not a DOM node: bumping drops any in-flight response
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generationRef.current++;
    };
  }, [clusterId, refreshKey]);

  const title = t('pages.clusterNotes.filesTitle', { count: files.length });

  return (
    <section className="p-4" aria-label={t('pages.clusterNotes.filesAria')}>
      <button
        type="button"
        className="flex w-full items-center justify-between text-sm font-medium lg:pointer-events-none"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform lg:hidden', open && 'rotate-180')} />
      </button>

      <div className={cn('mt-3', open ? 'block' : 'hidden lg:block')}>
        {!loaded ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : failed ? (
          <p className="text-xs text-destructive">{t('pages.clusterNotes.filesLoadError')}</p>
        ) : files.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('pages.clusterNotes.filesEmpty')}</p>
        ) : (
          <ul className="space-y-2">
            {files.map((f) => (
              <li key={`${f.note_id}-${f.fileToken}`}>
                <button
                  type="button"
                  onClick={() => void openNoteFile(clusterId, f.fileToken, t)}
                  className="flex w-full items-start gap-2 rounded-md border bg-muted/40 px-2 py-1.5 text-left hover:bg-muted"
                >
                  <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs">{f.fileName}</span>
                    <AuditMeta
                      variant="compact"
                      actor={{ at: f.uploaded_at, name: f.uploaded_by_name ?? undefined }}
                      className="text-[11px] text-muted-foreground"
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

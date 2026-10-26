import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import clusterNoteService from '../../../services/clusterNoteService';
import { getErrorDetail } from '../../../utils/errorParser';
import { useI18n } from '../../../hooks/useI18n';
import type { ClusterNote } from '../../../types';

export const NOTES_PER_PAGE = 20;

/**
 * รายการโน้ตของ cluster — โหลดหน้าแรกเมื่อ mount / เปลี่ยน cluster / สลับ `deleted`
 * แล้ว `loadMore` ต่อท้ายทีละหน้า (20) ใช้ generation counter กัน response เก่าทับใหม่
 * (agent-os/standards/hooks/fetch-race-guards.md) — `refetch` ทำให้ `loadMore` ที่ค้างอยู่ถูกทิ้งด้วย
 */
export function useClusterNotes(clusterId: string | undefined, { deleted = false }: { deleted?: boolean } = {}) {
  const { t } = useI18n();
  const [notes, setNotes] = useState<ClusterNote[]>([]);
  const [total, setTotal] = useState(0);
  const [deletedCount, setDeletedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const generationRef = useRef(0);
  const pageRef = useRef(1);

  const fetchPage = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!clusterId) return;
      const generation = ++generationRef.current;
      setLoading(true);
      try {
        const res = await clusterNoteService.list(clusterId, { page: nextPage, perpage: NOTES_PER_PAGE, deleted });
        if (generation !== generationRef.current) return;
        const items = Array.isArray(res.data) ? res.data : [];
        setNotes((prev) => (append ? [...prev, ...items.filter((n) => !prev.some((p) => p.id === n.id))] : items));
        setTotal(res.paginate?.total ?? items.length);
        if (res.summary) setDeletedCount(res.summary.deleted_count ?? 0);
        pageRef.current = nextPage;
        setPage(nextPage);
      } catch (err) {
        if (generation !== generationRef.current) return;
        // keep the list already on screen — a failed refresh must not blank it
        toast.error(getErrorDetail(err, t));
      } finally {
        if (generation === generationRef.current) setLoading(false);
      }
    },
    [clusterId, deleted, t],
  );

  useEffect(() => {
    setNotes([]);
    setTotal(0);
    pageRef.current = 1;
    setPage(1);
    void fetchPage(1, false);
    return () => {
      // counter, not a DOM node: bumping the live value is the point (drops in-flight responses)
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generationRef.current++;
    };
  }, [fetchPage]);

  const loadMore = useCallback(() => fetchPage(pageRef.current + 1, true), [fetchPage]);
  const refetch = useCallback(() => fetchPage(1, false), [fetchPage]);

  const replaceNote = useCallback((note: ClusterNote) => {
    setNotes((prev) => prev.map((n) => (n.id === note.id ? note : n)));
  }, []);

  const dropNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
  }, []);

  /** โน้ตใหม่ขึ้นบนสุด */
  const prependNote = useCallback((note: ClusterNote) => {
    setNotes((prev) => [note, ...prev.filter((n) => n.id !== note.id)]);
    setTotal((prev) => prev + 1);
  }, []);

  return {
    notes,
    total,
    deletedCount,
    loading,
    page,
    hasMore: notes.length < total,
    loadMore,
    refetch,
    replaceNote,
    dropNote,
    prependNote,
  };
}

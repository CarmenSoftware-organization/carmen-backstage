import { toast } from 'sonner';
import { getErrorDetail } from '../../utils/errorParser';
import type { TFunction } from '../../i18n/types';
import type { NotesAdapter } from './types';

/**
 * เปิดไฟล์แนบในแท็บใหม่ — ต้องเรียกจาก click handler แบบ synchronous
 * Safari บล็อก window.open ที่เรียกหลัง await จึงเปิดแท็บว่างก่อน แล้วค่อยชี้ไป presigned URL
 * (ห้ามใส่ noopener ตรงนี้ ไม่งั้นได้ null) — ไม่ log token/URL (ทั้งคู่เป็นข้อมูลเข้าถึงไฟล์)
 * Opens an attachment in a new tab. Call it synchronously from the click handler: Safari blocks
 * window.open after an await, so a blank tab is opened first and pointed at the short-lived URL
 * once it resolves (no `noopener` here — it would make window.open return null). Never logs the
 * token or URL.
 */
export async function openNoteFile(adapter: NotesAdapter, ownerId: string, fileToken: string, t: TFunction): Promise<void> {
  const tab = window.open('', '_blank');
  if (!tab) {
    toast.error(t('pages.clusterNotes.popupBlocked'));
    return;
  }
  try {
    const { url } = await adapter.fileUrl(ownerId, fileToken);
    tab.opener = null;
    tab.location.href = url;
  } catch (err) {
    tab.close();
    toast.error(getErrorDetail(err, t));
  }
}

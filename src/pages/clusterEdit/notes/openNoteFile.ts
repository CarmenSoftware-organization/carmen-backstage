import { toast } from 'sonner';
import clusterNoteService from '../../../services/clusterNoteService';
import { getErrorDetail } from '../../../utils/errorParser';
import type { TFunction } from '../../../i18n/types';

/**
 * ขอ presigned URL ของไฟล์แนบแล้วเปิดแท็บใหม่ — ไม่ log token/URL (ทั้งคู่เป็นข้อมูลเข้าถึงไฟล์)
 * Fetch a short-lived URL for an attachment and open it; never logs the token or URL.
 */
export async function openNoteFile(clusterId: string, fileToken: string, t: TFunction): Promise<void> {
  try {
    const { url } = await clusterNoteService.fileUrl(clusterId, fileToken);
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (err) {
    toast.error(getErrorDetail(err, t));
  }
}

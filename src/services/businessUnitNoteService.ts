import api from './api';
import type {
  ApiListResponse,
  Note,
  NoteFile,
  NoteHistoryEntry,
  NotesResponse,
} from '../types';

const BASE = (businessUnitId: string) => `/api-system/business-units/${businessUnitId}/notes`;

// multipart: ต้องตั้ง Content-Type เองไม่งั้น axios จะ serialize FormData เป็น JSON
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

/**
 * โน้ตภายในของ staff ต่อ business unit — nested resource ใต้ BU
 * response อยู่ใน envelope `{ data, paginate?, summary? }` — รายการคืนทั้ง envelope,
 * รายการเดียว/ผลลัพธ์ก้อนเดียว unwrap ด้วย `data.data || data`
 */
const businessUnitNoteService = {
  list: async (
    businessUnitId: string,
    { page = 1, perpage = 20, deleted = false }: { page?: number; perpage?: number; deleted?: boolean } = {},
  ): Promise<NotesResponse> => {
    const params = new URLSearchParams({ page: String(page), perpage: String(perpage) });
    if (deleted) params.set('deleted', 'true');
    const response = await api.get(`${BASE(businessUnitId)}?${params.toString()}`);
    return response.data;
  },

  /** ไฟล์แนบทุกโน้ตของ BU */
  files: async (businessUnitId: string): Promise<NoteFile[]> => {
    const response = await api.get(`${BASE(businessUnitId)}/files`);
    return response.data.data || response.data;
  },

  /** ขอ presigned URL (อายุ ~300 วิ) — token ส่งใน body ไม่ใส่ใน path เพื่อไม่ให้รั่วลง access log */
  fileUrl: async (businessUnitId: string, fileToken: string): Promise<{ url: string; expires_at: string }> => {
    const response = await api.post(`${BASE(businessUnitId)}/files/url`, { fileToken });
    return response.data.data || response.data;
  },

  create: async (businessUnitId: string, data: { message: string; files: File[] }): Promise<Note> => {
    const fd = new FormData();
    fd.append('message', data.message);
    data.files.forEach((f) => fd.append('files', f));
    const response = await api.post(BASE(businessUnitId), fd, MULTIPART);
    return response.data.data || response.data;
  },

  /**
   * doc_version บังคับ — 409 เมื่อชนกับคนที่แก้ก่อน ส่งเฉพาะฟิลด์ที่เปลี่ยน
   * (`message` ที่ไม่ส่ง = ไม่แตะ) `remove` คือ fileToken ของไฟล์ที่ต้องการเอาออก
   */
  update: async (
    businessUnitId: string,
    noteId: string,
    data: { message?: string; files?: File[]; remove?: string[]; doc_version: number },
  ): Promise<Note> => {
    const fd = new FormData();
    if (data.message !== undefined) fd.append('message', data.message);
    data.files?.forEach((f) => fd.append('files', f));
    data.remove?.forEach((t) => fd.append('remove', t));
    fd.append('doc_version', String(data.doc_version));
    const response = await api.patch(`${BASE(businessUnitId)}/${noteId}`, fd, MULTIPART);
    return response.data.data || response.data;
  },

  remove: async (businessUnitId: string, noteId: string): Promise<{ id: string }> => {
    const response = await api.delete(`${BASE(businessUnitId)}/${noteId}`);
    return response.data.data || response.data;
  },

  restore: async (businessUnitId: string, noteId: string): Promise<{ id: string }> => {
    const response = await api.post(`${BASE(businessUnitId)}/${noteId}/restore`);
    return response.data.data || response.data;
  },

  history: async (
    businessUnitId: string,
    noteId: string,
    { page = 1, perpage = 20 }: { page?: number; perpage?: number } = {},
  ): Promise<ApiListResponse<NoteHistoryEntry>> => {
    const response = await api.get(`${BASE(businessUnitId)}/${noteId}/history?page=${page}&perpage=${perpage}`);
    return response.data;
  },
};

export default businessUnitNoteService;

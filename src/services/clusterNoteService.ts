import api from './api';
import type {
  ApiListResponse,
  ClusterNote,
  ClusterNoteFile,
  ClusterNoteHistoryEntry,
  ClusterNotesResponse,
} from '../types';

const BASE = (clusterId: string) => `/api-system/clusters/${clusterId}/notes`;

// multipart: ต้องตั้ง Content-Type เองไม่งั้น axios จะ serialize FormData เป็น JSON
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

/**
 * โน้ตภายในของ staff ต่อ cluster — nested resource ใต้ cluster
 * response อยู่ใน envelope `{ data, paginate?, summary? }` — รายการคืนทั้ง envelope,
 * รายการเดียว/ผลลัพธ์ก้อนเดียว unwrap ด้วย `data.data || data`
 */
const clusterNoteService = {
  list: async (
    clusterId: string,
    { page = 1, perpage = 20, deleted = false }: { page?: number; perpage?: number; deleted?: boolean } = {},
  ): Promise<ClusterNotesResponse> => {
    const params = new URLSearchParams({ page: String(page), perpage: String(perpage) });
    if (deleted) params.set('deleted', 'true');
    const response = await api.get(`${BASE(clusterId)}?${params.toString()}`);
    return response.data;
  },

  /** ไฟล์แนบทุกโน้ตของ cluster */
  files: async (clusterId: string): Promise<ClusterNoteFile[]> => {
    const response = await api.get(`${BASE(clusterId)}/files`);
    return response.data.data || response.data;
  },

  /** ขอ presigned URL (อายุ ~300 วิ) — token ส่งใน body ไม่ใส่ใน path เพื่อไม่ให้รั่วลง access log */
  fileUrl: async (clusterId: string, fileToken: string): Promise<{ url: string; expires_at: string }> => {
    const response = await api.post(`${BASE(clusterId)}/files/url`, { fileToken });
    return response.data.data || response.data;
  },

  create: async (clusterId: string, data: { message: string; files: File[] }): Promise<ClusterNote> => {
    const fd = new FormData();
    fd.append('message', data.message);
    data.files.forEach((f) => fd.append('files', f));
    const response = await api.post(BASE(clusterId), fd, MULTIPART);
    return response.data.data || response.data;
  },

  /**
   * doc_version บังคับ — 409 เมื่อชนกับคนที่แก้ก่อน ส่งเฉพาะฟิลด์ที่เปลี่ยน
   * (`message` ที่ไม่ส่ง = ไม่แตะ) `remove` คือ fileToken ของไฟล์ที่ต้องการเอาออก
   */
  update: async (
    clusterId: string,
    noteId: string,
    data: { message?: string; files?: File[]; remove?: string[]; doc_version: number },
  ): Promise<ClusterNote> => {
    const fd = new FormData();
    if (data.message !== undefined) fd.append('message', data.message);
    data.files?.forEach((f) => fd.append('files', f));
    data.remove?.forEach((t) => fd.append('remove', t));
    fd.append('doc_version', String(data.doc_version));
    const response = await api.patch(`${BASE(clusterId)}/${noteId}`, fd, MULTIPART);
    return response.data.data || response.data;
  },

  remove: async (clusterId: string, noteId: string): Promise<{ id: string }> => {
    const response = await api.delete(`${BASE(clusterId)}/${noteId}`);
    return response.data.data || response.data;
  },

  restore: async (clusterId: string, noteId: string): Promise<{ id: string }> => {
    const response = await api.post(`${BASE(clusterId)}/${noteId}/restore`);
    return response.data.data || response.data;
  },

  history: async (
    clusterId: string,
    noteId: string,
    { page = 1, perpage = 20 }: { page?: number; perpage?: number } = {},
  ): Promise<ApiListResponse<ClusterNoteHistoryEntry>> => {
    const response = await api.get(`${BASE(clusterId)}/${noteId}/history?page=${page}&perpage=${perpage}`);
    return response.data;
  },
};

export default clusterNoteService;

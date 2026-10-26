import type {
  ApiListResponse,
  Note,
  NoteFile,
  NoteHistoryEntry,
  NotesResponse,
} from "../../types";

/**
 * สัญญาของ service โน้ตต่อ owner (cluster / business unit) — รูปเดียวกับ `clusterNoteService`
 * จึงส่ง service นั้นเป็น adapter ได้ตรง ๆ คอมโพเนนต์ใน `components/notes` ไม่ import service จริง
 * The per-owner notes service contract. `clusterNoteService` satisfies it unchanged, so the shared
 * components never import a concrete service.
 */
export interface NotesAdapter {
  list(
    ownerId: string,
    opts?: { page?: number; perpage?: number; deleted?: boolean },
  ): Promise<NotesResponse>;
  files(ownerId: string): Promise<NoteFile[]>;
  fileUrl(
    ownerId: string,
    fileToken: string,
  ): Promise<{ url: string; expires_at: string }>;
  create(
    ownerId: string,
    data: { message: string; files: File[] },
  ): Promise<Note>;
  update(
    ownerId: string,
    noteId: string,
    data: {
      message?: string;
      files?: File[];
      remove?: string[];
      doc_version: number;
    },
  ): Promise<Note>;
  remove(ownerId: string, noteId: string): Promise<{ id: string }>;
  restore(ownerId: string, noteId: string): Promise<{ id: string }>;
  history(
    ownerId: string,
    noteId: string,
    opts?: { page?: number; perpage?: number },
  ): Promise<ApiListResponse<NoteHistoryEntry>>;
}

/** permission key ที่ใช้เปิด/จัดการโน้ตของ owner นั้น / permission keys gating view and manage */
export interface NotesPermissionKeys {
  view: string;
  manage: string;
}

/** ทุกอย่างที่หน้า owner ต้องส่งให้ `NotesSection` (ยกเว้น `onTotalChange`) */
export interface NotesOwner {
  ownerId: string;
  /** cluster ที่ใช้ scope สิทธิ์ — cluster: เท่ากับ ownerId, BU: cluster ของ BU */
  scopeClusterId: string;
  adapter: NotesAdapter;
  permissions: NotesPermissionKeys;
}

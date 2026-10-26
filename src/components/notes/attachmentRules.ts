export const NOTE_MAX_FILES = 5;
export const NOTE_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const NOTE_ACCEPT =
  '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type PickError = {
  key: 'pages.clusterNotes.fileTooLarge' | 'pages.clusterNotes.tooManyFiles';
  params: Record<string, string | number>;
};

/**
 * ตรวจไฟล์ที่เลือกฝั่ง client (10 MB ต่อไฟล์ / 5 ไฟล์ต่อครั้ง) — ใช้ร่วมกันระหว่าง composer และโหมดแก้
 * `existing` = จำนวนไฟล์ที่นับรวมอยู่แล้ว (ที่เลือกไว้/ที่ยังเหลือ) · คืนไฟล์ที่รับได้ + i18n key ของข้อผิดพลาด
 */
export function validatePickedFiles(picked: File[], existing: number): { ok: File[]; errors: PickError[] } {
  const errors: PickError[] = [];
  const tooBig = picked.filter((f) => f.size > NOTE_MAX_FILE_BYTES);
  if (tooBig.length > 0) errors.push({ key: 'pages.clusterNotes.fileTooLarge', params: { name: tooBig[0].name } });
  const fits = picked.filter((f) => f.size <= NOTE_MAX_FILE_BYTES);
  const room = Math.max(0, NOTE_MAX_FILES - existing);
  if (fits.length > room) errors.push({ key: 'pages.clusterNotes.tooManyFiles', params: { max: NOTE_MAX_FILES } });
  return { ok: fits.slice(0, room), errors };
}

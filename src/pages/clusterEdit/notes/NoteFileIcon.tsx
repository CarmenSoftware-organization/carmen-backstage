import React from 'react';
import { File, FileImage, FileSpreadsheet, FileText, FileType, type LucideIcon } from 'lucide-react';
import { cn } from '../../../lib/utils';

type NoteFileKind = 'pdf' | 'word' | 'excel' | 'image' | 'other';

const KIND_ICON: Record<NoteFileKind, LucideIcon> = {
  pdf: FileText,
  word: FileType,
  excel: FileSpreadsheet,
  image: FileImage,
  other: File,
};

// contentType มาก่อน นามสกุลเป็นตัวสำรอง — ไฟล์ที่เบราว์เซอร์ไม่รู้จักชนิดจะส่ง type ว่างมา
// (เช่น .docx บางเครื่อง) ส่วนไฟล์เก่าในประวัติอาจเป็น application/octet-stream
function noteFileKind(contentType: string | undefined, fileName: string): NoteFileKind {
  const type = (contentType ?? '').toLowerCase();
  if (type === 'application/pdf') return 'pdf';
  if (type.startsWith('image/')) return 'image';
  if (type.includes('wordprocessingml') || type === 'application/msword') return 'word';
  if (type.includes('spreadsheetml') || type === 'application/vnd.ms-excel') return 'excel';

  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png'].includes(ext)) return 'image';
  if (['doc', 'docx'].includes(ext)) return 'word';
  if (['xls', 'xlsx'].includes(ext)) return 'excel';
  return 'other';
}

interface NoteFileIconProps {
  fileName: string;
  contentType?: string;
  className?: string;
}

/** ไอคอนตามชนิดไฟล์แนบของบันทึก — ใช้แทนคลิปหนีบกระดาษบนชิปไฟล์ทุกจุด */
export const NoteFileIcon: React.FC<NoteFileIconProps> = ({ fileName, contentType, className }) => {
  const Icon = KIND_ICON[noteFileKind(contentType, fileName)];
  return <Icon aria-hidden="true" className={cn('h-3.5 w-3.5 shrink-0', className)} />;
};

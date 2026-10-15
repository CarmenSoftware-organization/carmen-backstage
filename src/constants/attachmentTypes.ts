import type { TKey } from '../i18n/types';

/**
 * กลุ่มชนิดไฟล์แนบ comment ที่เลือกเปิดให้ BU ได้ — ต้องตรงกับ backend
 * `apps/backend-gateway/src/common/attachment-policy/attachment-policy.ts` (ATTACHMENT_TYPE_GROUPS)
 * gateway เป็นด่านจริง: ส่งรหัสที่ไม่รู้จักไปจะได้ 400 ATTACHMENT_POLICY_INVALID
 */
export const ATTACHMENT_KEYS = {
  allowedTypes: 'attachment.allowed_types',
  maxSizeMb: 'attachment.max_size_mb',
} as const;
export const ATTACHMENT_KEY_PREFIX = 'attachment.';
export const isAttachmentKey = (key: string | undefined) => !!key && key.startsWith(ATTACHMENT_KEY_PREFIX);

export type AttachmentTypeCode = 'image' | 'pdf' | 'excel' | 'word' | 'csv' | 'text';
export const ATTACHMENT_TYPE_GROUPS: readonly { code: AttachmentTypeCode; labelKey: TKey }[] = [
  { code: 'image', labelKey: 'pages.businessUnits.attachmentTypeImage' },
  { code: 'pdf', labelKey: 'pages.businessUnits.attachmentTypePdf' },
  { code: 'excel', labelKey: 'pages.businessUnits.attachmentTypeExcel' },
  { code: 'word', labelKey: 'pages.businessUnits.attachmentTypeWord' },
  { code: 'csv', labelKey: 'pages.businessUnits.attachmentTypeCsv' },
  { code: 'text', labelKey: 'pages.businessUnits.attachmentTypeText' },
];
export const ATTACHMENT_DEFAULT_TYPES: readonly AttachmentTypeCode[] = ['image', 'pdf'];
export const ATTACHMENT_DEFAULT_MAX_MB = 10;
export const ATTACHMENT_MAX_MB = 25;

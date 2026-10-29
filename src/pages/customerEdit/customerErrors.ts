import { getErrorCode } from '../../utils/errorParser';

export type CustomerErrorKind = 'ar_exists' | 'in_use' | 'linked_elsewhere';

const CODES: Record<string, CustomerErrorKind> = {
  BACKSTAGE_CUSTOMER_AR_NUMBER_EXISTS: 'ar_exists',
  BACKSTAGE_CUSTOMER_IN_USE: 'in_use',
  BACKSTAGE_CUSTOMER_BU_LINKED_ELSEWHERE: 'linked_elsewhere',
};

/**
 * จัดประเภท 409 ของลูกค้า — อ่าน `code` ก่อน (gateway ใส่มาทั้งแบบแบนและซ้อน) แล้วค่อยถอยไปจับข้อความ
 * เพราะ code อาจเป็น null บนสาย · **ผู้เรียกต้องเช็ก `isVersionConflict` ก่อนเสมอ** (409 ตัวนั้นเป็น
 * stale doc_version ไม่ใช่ตัวใดตัวหนึ่งนี้)
 *
 * ข้อความ fallback ตรงกับ message_en / message_th ใน error catalog ของ backend ทั้งสองภาษา
 * Classifies a customer 409: code first, then catalog-message fallback (en + th).
 */
export function customerErrorKind(err: unknown): CustomerErrorKind | undefined {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status !== 409) return undefined;
  const code = getErrorCode(err);
  if (code && CODES[code]) return CODES[code];
  const data = (err as { response?: { data?: { message?: unknown; error?: unknown } } })?.response?.data;
  const nested = data?.error && typeof data.error === 'object' ? (data.error as { message?: unknown }).message : undefined;
  const message = [data?.message, nested, typeof data?.error === 'string' ? data.error : undefined]
    .find((m): m is string => typeof m === 'string') ?? '';
  if (/AR number already exists|ใช้เลข AR นี้อยู่แล้ว/i.test(message)) return 'ar_exists';
  if (/different customer|ผูกกับลูกค้ารายอื่น/i.test(message)) return 'linked_elsewhere';
  if (/still linked to business units|ยังผูกกับหน่วยธุรกิจ/i.test(message)) return 'in_use';
  return undefined;
}

/**
 * ชื่อลูกค้าอีกรายที่ถือ BU อยู่ ถ้า backend แนบมาใน `details` — ปัจจุบัน catalog ไม่แนบ
 * จึงคืน undefined แล้วผู้เรียกใช้ข้อความทั่วไป · อ่านแบบหลวมไว้ให้ backend เพิ่มภายหลังได้
 */
export function linkedElsewhereCustomer(err: unknown): string | undefined {
  const data = (err as { response?: { data?: { details?: unknown; error?: { details?: unknown } } } })?.response?.data;
  const details = data?.details ?? data?.error?.details;
  if (!details || typeof details !== 'object') return undefined;
  const d = details as { customer?: unknown; customer_ar_number?: unknown; ar_number?: unknown };
  const v = d.customer_ar_number ?? d.ar_number ?? d.customer;
  return typeof v === 'string' && v ? v : undefined;
}

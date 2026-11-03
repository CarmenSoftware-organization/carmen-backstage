import type { StorageKindUsage } from '../types';

/** 1 GB = 1024³ ไบต์ — ตรงกับค่า default ฝั่ง backend (5368709120 / 16106127360) */
export const BYTES_PER_GB = 1024 ** 3;

/** โควตาต่ำสุดที่ backend รับ (1 GB) — 0 แปลว่า "ไม่เคยเต็ม" จึงไม่ให้ตั้ง */
export const MIN_QUOTA_BYTES = BYTES_PER_GB;

export const bytesToGb = (bytes: number): number => bytes / BYTES_PER_GB;

/** ตัวเลข GB สำหรับ input — ปัดทศนิยม 2 ตำแหน่ง ตัดศูนย์ท้าย */
export const bytesToGbInput = (bytes: number | null): string =>
  bytes === null ? '' : String(Math.round(bytesToGb(bytes) * 100) / 100);

/** อ่านค่าจาก input GB → ไบต์ · '' = null (ใช้ค่า default) · ค่าเพี้ยน = NaN */
export const gbInputToBytes = (value: string): number | null => {
  const v = value.trim();
  if (v === '') return null;
  const gb = Number(v);
  if (!Number.isFinite(gb)) return Number.NaN;
  return Math.round(gb * BYTES_PER_GB);
};

/**
 * ตรวจช่อง GB ที่ผู้ใช้กรอก — '' ผ่าน (ใช้ค่า default) · ต้องเป็นตัวเลข >= 1 GB และไม่เกิน MAX_SAFE_INTEGER ไบต์
 * @returns true เมื่อค่าใช้ได้
 */
export const isValidQuotaInput = (value: string, allowBlank: boolean): boolean => {
  const bytes = gbInputToBytes(value);
  if (bytes === null) return allowBlank;
  return Number.isFinite(bytes) && bytes >= MIN_QUOTA_BYTES && bytes <= Number.MAX_SAFE_INTEGER;
};

export const formatBytes = (bytes: number): string => {
  if (bytes >= BYTES_PER_GB) return `${(bytes / BYTES_PER_GB).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
};

/** สัดส่วนที่ใช้ไป (ไม่ clamp) — quota <= 0 ถือว่าไม่เต็ม */
export const usedPct = (k: Pick<StorageKindUsage, 'used_bytes' | 'quota_bytes'>): number =>
  k.quota_bytes > 0 ? (k.used_bytes / k.quota_bytes) * 100 : 0;

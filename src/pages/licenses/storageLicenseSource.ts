import type { BuStorageLicense } from '../../types';

/** note ที่ migration ใส่ให้ใบที่แปลงมาจากโควตาที่ตั้งมือแบบเดิม */
export const MIGRATED_NOTE = 'Migrated from manual quota';

export type StorageLicenseSource = 'intake' | 'manual' | 'migrated';

export const storageLicenseSource = (
  r: Pick<BuStorageLicense, 'license_intake_id' | 'note'>,
): StorageLicenseSource =>
  r.license_intake_id ? 'intake' : r.note === MIGRATED_NOTE ? 'migrated' : 'manual';

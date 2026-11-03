import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import backstageConfigService from '../services/backstageConfigService';
import { devLog } from '../utils/errorParser';
import type { StorageQuotaConfig } from '../types';

/**
 * ค่า default สดของโควตา storage จาก config `storage_quota` (ไบต์)
 *
 * อ่านเฉพาะเมื่อมีสิทธิ์ `backstage_config.read` เพราะ 401 จะเตะผู้ใช้ออกจากระบบ ·
 * null = ไม่มีสิทธิ์/อ่านไม่ได้/ยังโหลดไม่เสร็จ — ผู้เรียกต้องแสดงป้ายที่ไม่มีขนาด ห้ามเดาเลข
 */
export function useStorageQuotaDefaults(): { db: number; file: number } | null {
  const { hasPermission } = useAuth();
  const canReadConfig = hasPermission('backstage_config.read');
  const [defaults, setDefaults] = useState<{ db: number; file: number } | null>(null);
  useEffect(() => {
    if (!canReadConfig) return undefined;
    let cancelled = false;
    backstageConfigService
      .getByKey('storage_quota')
      .then((cfg) => {
        const v = (cfg?.value ?? {}) as Partial<StorageQuotaConfig>;
        if (!cancelled && typeof v.default_db_bytes === 'number' && typeof v.default_file_bytes === 'number') {
          setDefaults({ db: v.default_db_bytes, file: v.default_file_bytes });
        }
      })
      .catch((err: unknown) => devLog('Failed to load storage_quota default:', err));
    return () => { cancelled = true; };
  }, [canReadConfig]);
  return defaults;
}

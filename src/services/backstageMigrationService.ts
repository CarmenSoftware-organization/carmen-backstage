import api from './api';
import type {
  BackstageMigrationStatus,
  BackstageMigrationDeployResult,
  BackstageMigrationResolveAction,
  BackstageMigrationResolveResult,
} from '../types';

// Prisma migrations ของ "platform database" — ฐานข้อมูลกลางที่ทุก cluster ใช้ร่วมกัน
// คนละโดเมนกับ tenantMigrationService ซึ่งทำงานกับ DB ของ BU ทีละราย
//
// ด่านฝั่ง backend (PlatformMigrationGuard): ต้องเปิด env PLATFORM_MIGRATION_API_ENABLED
// และผู้เรียกต้องเป็น super-admin (หรือถือ x-deploy-token ซึ่งใช้เฉพาะ CI ไม่ใช่จากหน้าเว็บ)
// ถ้าปิด flag ไว้ทุก endpoint จะตอบ 403 พร้อมข้อความ "Backstage migration API is disabled"
//
// ทั้งสามเป็น request/response ธรรมดา ไม่ใช่ stream — ต่างจาก tenant migrations ที่ส่ง NDJSON
// จึงใช้ axios ตามปกติ ได้ทั้ง token refresh อัตโนมัติและ x-app-id จาก interceptor
// backend serialize งานที่เขียนด้วย in-process lock ตัวเดียว ยิงซ้อนจะได้ 409 กลับมา
const backstageMigrationService = {
  getStatus: async (): Promise<BackstageMigrationStatus> => {
    const res = await api.get('/api-system/backstage/migrations/status');
    return res.data.data ?? res.data;
  },

  deploy: async (): Promise<BackstageMigrationDeployResult> => {
    const res = await api.post('/api-system/backstage/migrations/deploy');
    return res.data.data ?? res.data;
  },

  /**
   * ทำเครื่องหมาย migration ที่ค้างใน `_prisma_migrations` ว่า applied หรือ rolled-back
   * ไม่ได้รัน SQL ของ migration นั้นจริง — เป็นการแก้บันทึกสถานะเท่านั้น
   */
  resolve: async (
    migrationName: string,
    action: BackstageMigrationResolveAction,
  ): Promise<BackstageMigrationResolveResult> => {
    const res = await api.post('/api-system/backstage/migrations/resolve', {
      migration_name: migrationName,
      action,
    });
    return res.data.data ?? res.data;
  },
};

export default backstageMigrationService;

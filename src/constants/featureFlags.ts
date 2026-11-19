import type { TKey } from '../i18n/types';

/**
 * สถานะของฟีเจอร์หนึ่งตัว
 * - `active`   ใช้งานได้ตามปกติ
 * - `inactive` เห็นเมนูแต่กดไม่ได้ เข้าทาง URL ตรงจะเจอหน้า "กำลังพัฒนา"
 * - `hide`     ไม่เห็นเลย ทั้งเมนูและเส้นทาง (เข้า URL ตรงจะเจอ 404)
 *
 * สะกดตรงกับ enum ฝั่ง backend (FeatureFlagsConfigSchema ใน micro-cluster) เป๊ะ ๆ
 * These three strings are the wire contract with the backend enum — do not rename them.
 */
export type FeatureState = 'active' | 'inactive' | 'hide';

export const FEATURE_STATES: readonly FeatureState[] = ['active', 'inactive', 'hide'];

/**
 * นิยามฟีเจอร์หนึ่งรายการในแค็ตตาล็อก
 * One catalog entry.
 */
export interface FeatureDefinition {
  /** คีย์ที่ส่งขึ้น backend — snake_case ตรงกับ regex ฝั่ง server `/^[a-z][a-z0-9_]*$/` */
  key: string;
  /** ป้ายชื่อที่หน้าตั้งค่าแสดง ใช้คีย์ nav เดิมซ้ำเพื่อไม่ให้ชื่อในเมนูกับในหน้าตั้งค่าเพี้ยนกัน */
  labelKey: TKey;
  /** กลุ่มเดียวกับ sidebar เพื่อให้หน้าตั้งค่าเรียงตามลำดับที่ผู้ดูแลเพิ่งเห็นในเมนู */
  groupKey: TKey;
  /** ค่าที่ใช้เมื่ออ่านจาก backend ไม่สำเร็จหรือ backend ยังไม่มีคีย์นี้ */
  defaultState: FeatureState;
}

/**
 * แหล่งความจริงเดียวว่ามีฟีเจอร์อะไรให้เปิด/ปิดได้บ้าง — เป็นของ frontend ทั้งหมด backend เก็บแค่
 * แมป key→state แบบฟรีฟอร์ม การเพิ่มฟีเจอร์ใหม่จึงไม่ต้อง deploy backend ก่อน
 * The single source of truth for what can be gated. The backend stores a free-form map only.
 *
 * ค่าตั้งต้นเป็น `active` ทุกตัวโดยเจตนา: การ deploy ต้องไม่ซ่อนอะไรเองโดยไม่มีคนสั่ง
 * All default to active on purpose: a deploy must never hide anything on its own.
 *
 * ข้อยกเว้นเดียวคือ `license_ai_credit` (`hide`) — เจ้าของสั่งให้ซ่อนไว้ตั้งแต่ deploy แรก (2026-11-19)
 * เพราะ backend ยังไม่มีผู้ใช้เครดิตจริง (OCR ยังไม่เรียก reserve) เปิดได้ที่ /backstage/features
 * The one exception is `license_ai_credit`, hidden by the owner's call until an OCR feature consumes it.
 *
 * `license_storage_quota` (`hide`) ก็เป็นคำสั่งเจ้าของ (2026-11-19): โควตา DB ยังไม่พร้อมขายและยังไม่กำหนดขนาด
 * ระหว่างที่ไม่ใช่ `active` หน้าจอซ่อนโควตา DB (ขนาดที่ใช้ยังโชว์) และ gateway ถือว่าโควตา DB ไม่จำกัด
 * — flag ตัวแรกที่มีผลกับ backend ด้วย · spec docs/superpowers/specs/2026-11-19-hide-db-quota-design.md
 * `license_storage_quota` is the owner's call too: while not active the DB quota is hidden and unlimited.
 *
 * หน้าที่จงใจไม่มี flag เพราะปิดแล้วแอปเข้าไม่ถึงหรือปิดตัวเอง:
 * /dashboard · /backstage/features · /profile · /changelog · /login · / · /403 · /404
 * Deliberately ungated: closing any of them would lock the app or the switch itself.
 *
 * ลำดับในอาร์เรย์นี้คือลำดับที่หน้าตั้งค่าแสดง และรายการที่ groupKey ซ้ำกันต้องอยู่ติดกัน
 * ด้วยเหตุผลเดียวกับ Sidebar — การจัดกลุ่มดูจากแถวที่ซ้ำกันติด ๆ ไม่ใช่จากค่าที่เท่ากันทั้งหมด
 * Same contiguity rule as the sidebar: rows sharing a groupKey must stay adjacent.
 */
export const FEATURE_CATALOG: readonly FeatureDefinition[] = [
  // Organization
  { key: 'clusters', labelKey: 'nav.clusters', groupKey: 'navGroup.organization', defaultState: 'active' },
  { key: 'business_units', labelKey: 'nav.businessUnits', groupKey: 'navGroup.organization', defaultState: 'active' },
  { key: 'tenant_migrations', labelKey: 'nav.tenantMigrations', groupKey: 'navGroup.organization', defaultState: 'active' },
  { key: 'tenant_seeds', labelKey: 'nav.tenantSeeds', groupKey: 'navGroup.organization', defaultState: 'active' },
  { key: 'tenant_imports', labelKey: 'nav.dataImport', groupKey: 'navGroup.organization', defaultState: 'active' },
  { key: 'users', labelKey: 'nav.users', groupKey: 'navGroup.organization', defaultState: 'active' },
  { key: 'customers', labelKey: 'nav.customers', groupKey: 'navGroup.organization', defaultState: 'active' },
  // License management
  { key: 'licenses', labelKey: 'nav.licenses', groupKey: 'navGroup.licenseManagement', defaultState: 'active' },
  { key: 'license_feature_groups', labelKey: 'nav.licenseFeatureGroups', groupKey: 'navGroup.licenseManagement', defaultState: 'active' },
  { key: 'license_features', labelKey: 'nav.licenseFeatures', groupKey: 'navGroup.licenseManagement', defaultState: 'active' },
  { key: 'license_intakes', labelKey: 'nav.licenseIntakes', groupKey: 'navGroup.licenseManagement', defaultState: 'active' },
  // ไม่มีเมนูหรือเส้นทางของตัวเอง — คุมการ์ด/แท็บ/ฟิลด์ AI credit ที่กระจายอยู่หลายหน้า
  { key: 'license_ai_credit', labelKey: 'nav.licenseAiCredit', groupKey: 'navGroup.licenseManagement', defaultState: 'hide' },
  // คุมเฉพาะส่วน "โควตา DB" ของใบ STQ (ขนาด DB ที่ใช้ไปยังโชว์) — gateway ก็อ่านคีย์นี้เพื่อปิดผลของโควตา DB ด้วย
  { key: 'license_storage_quota', labelKey: 'nav.licenseStorageQuota', groupKey: 'navGroup.licenseManagement', defaultState: 'hide' },
  // Content
  { key: 'report_templates', labelKey: 'nav.reportTemplates', groupKey: 'navGroup.content', defaultState: 'active' },
  { key: 'report_form_groups', labelKey: 'nav.formGroups', groupKey: 'navGroup.content', defaultState: 'active' },
  { key: 'dashboard_templates', labelKey: 'nav.dashboardTemplates', groupKey: 'navGroup.content', defaultState: 'active' },
  { key: 'news', labelKey: 'nav.news', groupKey: 'navGroup.content', defaultState: 'active' },
  { key: 'broadcasts', labelKey: 'nav.broadcasts', groupKey: 'navGroup.content', defaultState: 'active' },
  // AI
  { key: 'ai_providers', labelKey: 'nav.aiProviders', groupKey: 'navGroup.ai', defaultState: 'active' },
  // Analytics
  { key: 'usage_analytics', labelKey: 'nav.usageAnalytics', groupKey: 'navGroup.analytics', defaultState: 'active' },
  { key: 'activity_events', labelKey: 'nav.activityEvents', groupKey: 'navGroup.analytics', defaultState: 'active' },
  // Scheduling
  { key: 'cronjobs', labelKey: 'nav.cronjobs', groupKey: 'navGroup.scheduling', defaultState: 'active' },
  // Backstage
  { key: 'applications', labelKey: 'nav.applications', groupKey: 'navGroup.backstage', defaultState: 'active' },
  { key: 'email_settings', labelKey: 'nav.emailSettings', groupKey: 'navGroup.backstage', defaultState: 'active' },
  { key: 'backstage_config', labelKey: 'nav.backstageConfig', groupKey: 'navGroup.backstage', defaultState: 'active' },
  { key: 'backstage_roles', labelKey: 'nav.backstageRoles', groupKey: 'navGroup.backstage', defaultState: 'active' },
  { key: 'super_admins', labelKey: 'nav.superAdmins', groupKey: 'navGroup.backstage', defaultState: 'active' },
  { key: 'user_backstage', labelKey: 'nav.userBackstage', groupKey: 'navGroup.backstage', defaultState: 'active' },
  // Database — กลุ่มเดียวกับที่ sidebar ใช้ ทั้งสองหน้าต้องจัดกลุ่มตรงกัน
  { key: 'backstage_migrations', labelKey: 'nav.backstageMigrations', groupKey: 'navGroup.database', defaultState: 'active' },
  { key: 'sql_workbench', labelKey: 'nav.sqlWorkbench', groupKey: 'navGroup.database', defaultState: 'active' },
  { key: 'database_pools', labelKey: 'nav.databasePools', groupKey: 'navGroup.database', defaultState: 'active' },
  // Cluster admin — คีย์แยกจากของ platform เพราะเป็นคนละหน้าคนละสิทธิ์ ต่อให้ชื่อเมนูซ้ำกัน
  { key: 'cluster_admin_cluster', labelKey: 'nav.cluster', groupKey: 'navGroup.clusterAdmin', defaultState: 'active' },
  { key: 'cluster_admin_business_units', labelKey: 'nav.businessUnits', groupKey: 'navGroup.clusterAdmin', defaultState: 'active' },
  { key: 'cluster_admin_licenses', labelKey: 'nav.licenses', groupKey: 'navGroup.clusterAdmin', defaultState: 'active' },
  { key: 'cluster_admin_users', labelKey: 'nav.users', groupKey: 'navGroup.clusterAdmin', defaultState: 'active' },
];

const CATALOG_KEYS = new Set<string>(FEATURE_CATALOG.map((f) => f.key));

/**
 * คีย์นี้อยู่ในแค็ตตาล็อกหรือไม่ — ใช้แยก "คีย์กำพร้า" ที่ค้างใน DB ออกจากคีย์ที่ยังใช้อยู่
 * Whether the catalog knows this key; the Feature Flags page uses it to spot orphaned rows.
 * @param key - คีย์ที่ได้จาก backend
 * @returns true เมื่อคีย์อยู่ในแค็ตตาล็อก
 */
export function isFeatureKey(key: string): boolean {
  return CATALOG_KEYS.has(key);
}

/**
 * แมปค่าตั้งต้นของทุกฟีเจอร์ — ใช้เป็นฐานที่ค่าจาก backend มาทับทีละคีย์
 * The in-code baseline the backend map is layered on top of, key by key.
 */
export const DEFAULT_FEATURE_STATES: Record<string, FeatureState> = Object.fromEntries(
  FEATURE_CATALOG.map((f) => [f.key, f.defaultState]),
);

/**
 * คีย์ flag ที่คุมโควตา DB ของใบ STQ — ต้องตรงกับ `DB_QUOTA_FLAG_KEY` ใน gateway (storage-quota.service.ts)
 * The flag gating the STQ database quota; must equal the gateway's `DB_QUOTA_FLAG_KEY`.
 */
export const DB_QUOTA_FLAG = 'license_storage_quota';

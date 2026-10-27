import {
  LayoutDashboard, Network, Building2, Users, FileText, Newspaper, Megaphone, AppWindow,
  ShieldCheck, ShieldAlert, UserCog, DatabaseZap, Database, DatabaseBackup, LayoutGrid, Mail, FileSpreadsheet,
  BarChart3, MousePointerClick, Settings, Server, KeyRound, ToggleLeft, Tags, Clock, Sprout, Sparkles
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TKey } from '../../i18n/types';
import type { NavItem } from '../Sidebar';
import type { FeatureState } from '../../constants/featureFlags';

const ALL_BACKSTAGE_NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  // Organization
  { path: '/clusters', labelKey: 'nav.clusters', icon: Network, permission: 'cluster.read', groupKey: 'navGroup.organization', feature: 'clusters' },
  { path: '/business-units', labelKey: 'nav.businessUnits', icon: Building2, permission: 'cluster.read', groupKey: 'navGroup.organization', feature: 'business_units' },
  // งานฐานข้อมูลราย BU — วาดเป็นแถวย่อยใต้ Business Units ต้องอยู่ถัดจากแม่ติดกัน
  { path: '/tenant-migrations', labelKey: 'nav.tenantMigrations', icon: DatabaseZap, permission: 'tenant_migration.read', groupKey: 'navGroup.organization', feature: 'tenant_migrations', parentPath: '/business-units' },
  { path: '/tenant-seeds', labelKey: 'nav.tenantSeeds', icon: Sprout, permission: 'tenant_seed.read', groupKey: 'navGroup.organization', feature: 'tenant_seeds', parentPath: '/business-units' },
  { path: '/tenant-imports', labelKey: 'nav.dataImport', icon: FileSpreadsheet, permission: 'data_import.manage', groupKey: 'navGroup.organization', feature: 'tenant_imports', parentPath: '/business-units' },
  { path: '/users', labelKey: 'nav.users', icon: Users, permission: 'user.read', groupKey: 'navGroup.organization', feature: 'users' },
  // License management — ต้องอยู่ติดกัน: Sidebar จัดกลุ่มจากแถวที่ groupKey ซ้ำกันติด ๆ
  // การแทรกรายการกลุ่มอื่นคั่นจะทำให้หัวข้อนี้แตกเป็นสองหัวข้อ
  // Must stay contiguous: Sidebar groups by consecutive runs of the same `groupKey`.
  { path: '/licenses', labelKey: 'nav.licenses', icon: KeyRound, permission: 'subscription.read', groupKey: 'navGroup.licenseManagement', feature: 'licenses' },
  { path: '/license-modules', labelKey: 'nav.licenseFeatureGroups', icon: LayoutGrid, permission: 'license_feature_group.read', groupKey: 'navGroup.licenseManagement', feature: 'license_feature_groups' },
  { path: '/license-features', labelKey: 'nav.licenseFeatures', icon: Tags, permission: 'license_feature.read', groupKey: 'navGroup.licenseManagement', feature: 'license_features' },
  // Content
  { path: '/report-templates', labelKey: 'nav.reportTemplates', icon: FileText, permission: 'report_template.read', groupKey: 'navGroup.content', feature: 'report_templates' },
  { path: '/report-form-groups', labelKey: 'nav.formGroups', icon: LayoutGrid, permission: 'report_template.read', groupKey: 'navGroup.content', feature: 'report_form_groups' },
  { path: '/dashboard-templates', labelKey: 'nav.dashboardTemplates', icon: LayoutDashboard, permission: 'dashboard_template.read', groupKey: 'navGroup.content', feature: 'dashboard_templates' },
  // เส้นคั่น: เหนือเส้นคือแม่แบบรายงาน ใต้เส้นคือเนื้อหาที่ส่งถึงผู้ใช้
  { path: '/news', labelKey: 'nav.news', icon: Newspaper, permission: 'news.read', groupKey: 'navGroup.content', feature: 'news', dividerBefore: true },
  { path: '/broadcasts', labelKey: 'nav.broadcasts', icon: Megaphone, permission: 'broadcast.read', groupKey: 'navGroup.content', feature: 'broadcasts' },

  // Analytics — must stay contiguous: Sidebar groups by consecutive runs of the same
  // `groupKey`, so splitting these two would render two separate "Analytics" headings.
  { path: '/analytics', labelKey: 'nav.usageAnalytics', icon: BarChart3, permission: 'activity_event.read', groupKey: 'navGroup.analytics', feature: 'usage_analytics' },
  { path: '/activity-events', labelKey: 'nav.activityEvents', icon: MousePointerClick, permission: 'activity_event.detail', groupKey: 'navGroup.analytics', feature: 'activity_events' },
  // Scheduling — งานตามเวลา ไม่ใช่การตั้งค่าระบบ จึงเป็นกลุ่มของตัวเอง
  // Sidebar จัดกลุ่มจากแถวที่ groupKey ซ้ำกันติดกัน แถวนี้ต้องไม่ถูกคั่น
  { path: '/cronjobs', labelKey: 'nav.cronjobs', icon: Clock, permission: 'cronjob.read', groupKey: 'navGroup.scheduling', feature: 'cronjobs' },
  // Backstage
  { path: '/backstage/configs', labelKey: 'nav.backstageConfig', icon: Settings, permission: 'backstage_config.read', groupKey: 'navGroup.backstage', feature: 'backstage_config' },
  { path: '/backstage/email-settings', labelKey: 'nav.emailSettings', icon: Mail, permission: 'email_setting.read', groupKey: 'navGroup.backstage', feature: 'email_settings' },
  { path: '/applications', labelKey: 'nav.applications', icon: AppWindow, permission: 'application.read', groupKey: 'navGroup.backstage', feature: 'applications' },
  // เส้นคั่น: เหนือเส้นคือการตั้งค่าตัวระบบ ใต้เส้นคือการกำหนดว่าใครทำอะไรได้
  { path: '/backstage/roles', labelKey: 'nav.backstageRoles', icon: ShieldCheck, permission: 'backstage_role.read', groupKey: 'navGroup.backstage', feature: 'backstage_roles', dividerBefore: true },
  { path: '/backstage/user-backstage', labelKey: 'nav.userBackstage', icon: UserCog, permission: 'user_backstage.read', groupKey: 'navGroup.backstage', feature: 'user_backstage' },
  // เส้นคั่นแบ่งสองแถวล่างออกจากงานตั้งค่าประจำวัน — ทั้งคู่เปลี่ยนสิ่งที่คนอื่นเข้าถึงได้
  // ไม่ตั้งเป็นกลุ่มใหม่เพราะยังเป็นเรื่อง Backstage เหมือนกัน ต่างแค่ระดับความเสี่ยง
  { path: '/backstage/super-admins', labelKey: 'nav.superAdmins', icon: ShieldAlert, superAdminOnly: true, groupKey: 'navGroup.backstage', feature: 'super_admins', dividerBefore: true },
  // ไม่มี feature โดยเจตนา — สวิตช์ที่ปิดตัวเองได้จะเปิดกลับไม่ได้อีกจากหน้าจอ
  // Deliberately ungated: a switch that could hide itself could never be restored from the UI.
  { path: '/backstage/features', labelKey: 'nav.featureFlags', icon: ToggleLeft, permission: 'feature_flag.manage', groupKey: 'navGroup.backstage' },
  // AI — ต้องอยู่ติดกัน และอยู่ก่อนกลุ่ม Database ที่ต้องเป็นท้ายสุด
  // ชื่อเต็ม "Purchase Request AI Providers" ล้นความกว้าง sidebar — หัวกลุ่ม AI บอกส่วนที่เหลือแล้ว
  { path: '/purchase-request-ai-providers', labelKey: 'nav.aiProvidersShort', icon: Sparkles, permission: 'ai_provider.read', groupKey: 'navGroup.ai', feature: 'ai_providers' },
  // Database — ต้องอยู่ท้ายสุด: ทั้งสองแถวเคยอยู่กลางกลุ่ม Backstage การแยกออกเป็นกลุ่มของตัวเอง
  // โดยทิ้งไว้ตำแหน่งเดิมจะทำให้กลุ่ม Backstage ขาดเป็นสองท่อนและวาดหัวข้อซ้ำสองครั้ง
  // Must stay last: pulling these out mid-group would split Backstage's heading in two.
  { path: '/backstage/migrations', labelKey: 'nav.backstageMigrations', icon: DatabaseBackup, superAdminOnly: true, groupKey: 'navGroup.database', feature: 'backstage_migrations' },
  { path: '/sql-workbench', labelKey: 'nav.sqlWorkbench', icon: Database, permission: 'sql_workbench.read', groupKey: 'navGroup.database', feature: 'sql_workbench' },
  { path: '/backstage/database-pools', labelKey: 'nav.databasePools', icon: Server, permission: 'database_pool.read', groupKey: 'navGroup.database', feature: 'database_pools' },
];

/**
 * The order the sidebar puts resources in, derived from the nav itself so the two can
 * never drift: a role's permission list reads top-to-bottom in the same order as the menu
 * the reader just came from. Several nav items share one resource (Clusters and Business
 * Units are both `cluster.read`) — first appearance wins.
 */
const NAV_RESOURCE_ORDER: string[] = (() => {
  const order: string[] = [];
  for (const item of ALL_BACKSTAGE_NAV_ITEMS) {
    if (!item.permission) continue;
    const resource = item.permission.split('.')[0];
    if (!order.includes(resource)) order.push(resource);
  }
  return order;
})();

/**
 * Sort rank for a permission resource. Resources with no menu entry of their own
 * (`rbac`, `license`) rank after every menu-backed one and, because `Array.sort` is
 * stable, keep catalog order among themselves.
 */
export const resourceRank = (resource: string): number => {
  const i = NAV_RESOURCE_ORDER.indexOf(resource);
  return i === -1 ? NAV_RESOURCE_ORDER.length : i;
};

/** What the sidebar calls a permission resource: its section, its label, its icon. */
export interface ResourceNavMeta {
  groupKey?: TKey;
  labelKey: TKey;
  icon: LucideIcon;
}

/**
 * The menu entry that stands for a permission resource — first appearance wins, exactly as
 * in `resourceRank`, so a role's grant can be read in the sidebar's own words and sections
 * without a second mapping to keep in sync. `undefined` for a resource with no menu entry.
 */
export const resourceNavMeta = (resource: string): ResourceNavMeta | undefined => {
  const item = ALL_BACKSTAGE_NAV_ITEMS.find((i) => i.permission?.split('.')[0] === resource);
  return item ? { groupKey: item.groupKey, labelKey: item.labelKey, icon: item.icon } : undefined;
};

/** The platform-administration navigation, filtered to what this user may reach. */
export function buildBackstageNav(opts: {
  hasPermission: (key: string) => boolean;
  isSuperAdmin: boolean;
  /** สถานะฟีเจอร์จาก FeatureFlagContext — ผู้เรียกต้องส่งมาเสมอ */
  flagOf: (key: string) => FeatureState;
}): NavItem[] {
  return ALL_BACKSTAGE_NAV_ITEMS.filter(
    (item) =>
      (!item.permission || opts.hasPermission(item.permission)) &&
      (!item.superAdminOnly || opts.isSuperAdmin) &&
      // `hide` เท่านั้นที่ตัดทิ้ง ส่วน `inactive` ต้องคงลำดับเดิมไว้ — Sidebar จัดกลุ่มจากแถวที่
      // groupKey ซ้ำกันติด ๆ การตัดรายการกลางกลุ่มออกจึงทำให้กลุ่มเดียวแตกเป็นสองหัวข้อได้
      // Only `hide` removes the row; dropping one mid-group would split its heading in two.
      (!item.feature || opts.flagOf(item.feature) !== 'hide'),
  ).map((item) =>
    item.feature && opts.flagOf(item.feature) === 'inactive'
      ? { ...item, comingSoon: true }
      : item,
  );
}

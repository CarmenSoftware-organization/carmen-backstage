import { ChevronRight, Copy, Mail, Phone } from 'lucide-react';
import { BrandingImageUpload } from '../../../components/BrandingImageUpload';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { TabStrip } from '../../../components/TabStrip';
import { InlineField, Group } from '../../businessUnitEdit/shared';
import { AddressBlock } from './AddressBlock';
import type { ClusterBuTab, ClusterBuTabId } from './ClusterBuTabs';
import type { BusinessUnitFormData } from '../../businessUnitEdit/types';
import { BU_ALIAS_MAX } from '../../businessUnitEdit/types';
import { useI18n } from '../../../hooks/useI18n';

/** หนึ่งบรรทัดของรายการข้ามไป tab อื่น: ชื่อ tab + ค่าที่ตั้งไว้จริง */
export interface TabSummary {
  id: ClusterBuTabId;
  label: string;
  value: string;
}

export interface ClusterBuDocumentProps {
  formData: BusinessUnitFormData;
  fieldErrors: Record<string, string>;
  canEdit: boolean;
  onCommit: (name: string, value: string) => void;
  onValidate: (name: string, value: string) => void;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  /** hotel address → company address ทางเดียว เหมือนหน้า platform */
  onCopyHotelAddress: () => void;
  tabs: ClusterBuTab[];
  activeTab: ClusterBuTabId;
  onTabChange: (tab: ClusterBuTabId) => void;
  /** สรุปของอีก 4 tab ที่แสดงใน Overview */
  summaries: TabSummary[];
  logoUrl: string;
  avatarUrl: string;
  onUploadLogo: (f: File) => Promise<void>;
  onUploadAvatar: (f: File) => Promise<void>;
  /** ตารางผู้ใช้ + สรุปใบอนุญาต (tab People) */
  usersSlot?: React.ReactNode;
  /** timezone, รูปแบบตัวเลข/วันที่, config (tab Configuration) */
  configurationSlot?: React.ReactNode;
  /** การ์ดสัญญา/ที่นั่ง + การ์ดใบ interface (tab Licenses) — อ่านอย่างเดียว */
  licensesSlot?: React.ReactNode;
}

/**
 * รายการข้ามไป tab อื่นพร้อมค่าที่ตั้งไว้ — หัวข้อเปล่า ๆ บังคับให้คลิกทีละ tab
 * เพื่อรู้ว่าข้างในว่างหรือมีของ ซึ่งทำลายงาน "ดูว่า BU นี้ตั้งค่าไว้ยังไง"
 */
function TabJumpList({ summaries, onJump }: { summaries: TabSummary[]; onJump: (id: ClusterBuTabId) => void }) {
  const { t } = useI18n();
  return (
    <Card className="p-0">
      <Group label={t('pages.clusterAdmin.elsewhere')}>
        <ul className="-mx-2">
          {summaries.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onJump(s.id)}
                // คอลัมน์เดียวกับ InlineField (ป้าย 150px, ค่าเริ่มที่ +170px) — เดิมป้ายกว้าง w-20
                // "Configuration" (92px) ล้นไปชนค่า และค่าไม่ตรงคอลัมน์กับการ์ด Identity ข้างบน
                className="hover:bg-primary/5 focus-visible:ring-ring grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 rounded-md px-2 py-2 text-left focus-visible:ring-1 focus-visible:outline-hidden sm:grid-cols-[150px_1fr_auto]"
              >
                <span className="text-muted-foreground col-start-1 text-xs sm:row-start-1">{s.label}</span>
                <span className="col-start-1 min-w-0 truncate text-sm sm:col-start-2 sm:row-start-1 sm:pl-2">{s.value}</span>
                <ChevronRight className="text-muted-foreground col-start-2 row-span-2 row-start-1 size-4 shrink-0 sm:col-start-3 sm:row-span-1" />
              </button>
            </li>
          ))}
        </ul>
      </Group>
    </Card>
  );
}

/**
 * เอกสารของ BU หนึ่งใบ แบ่งเป็น 5 tab แทนการ์ด 6 ใบเรียงลงมา
 *
 * เดิมหน้านี้เป็นสกอลล์เดียวยาว 2,250px โดยตารางผู้ใช้ 10 แถวกินไปเกินครึ่ง ดันที่อยู่โรงแรม
 * บิล และการตั้งค่าไปท้ายสุด — ทั้งที่ทั้งสามอย่างไม่เกี่ยวกับผู้ใช้เลย การแบ่ง tab ตรงนี้
 * ใช้ชุด tab ของ cluster admin เอง (ดู ClusterBuTabs.tsx) ไม่ใช่ชุดของหน้า platform
 *
 * แผ่นป้ายด้านบน (BuPropertyPlate) อยู่นอก tab จึงเห็นชื่อ สถานะ และที่นั่งได้ตลอด
 */
export function ClusterBuDocument({
  formData: f, fieldErrors, canEdit, onCommit, onValidate, onChange, onCopyHotelAddress,
  logoUrl, avatarUrl, onUploadLogo, onUploadAvatar,
  tabs, activeTab, onTabChange, summaries, usersSlot, configurationSlot, licensesSlot,
}: ClusterBuDocumentProps) {
  const { t } = useI18n();

  const inline = (
    name: keyof BusinessUnitFormData,
    label: string,
    opts?: {
      type?: 'text' | 'email' | 'textarea';
      mono?: boolean;
      validate?: boolean;
      maxLength?: number;
      trailing?: React.ReactNode;
    },
  ) => (
    <InlineField
      key={name}
      name={name}
      label={label}
      value={String(f[name] ?? '')}
      type={opts?.type}
      mono={opts?.mono}
      maxLength={opts?.maxLength}
      error={fieldErrors[name]}
      disabled={!canEdit}
      onCommit={onCommit}
      onValidate={opts?.validate ? onValidate : undefined}
      trailing={opts?.trailing}
    />
  );

  // ทางลัดข้างค่า: คลิกที่ค่ายังเป็นการแก้ ส่วนไอคอนนี้คือ "ใช้" ค่านั้น (โทร/ส่งอีเมล)
  const actionLink = (href: string, label: string, Icon: typeof Phone) => (
    <a
      href={href}
      aria-label={label}
      title={label}
      className="text-muted-foreground hover:text-foreground hover:bg-primary/5 focus-visible:ring-ring inline-flex size-8 items-center justify-center rounded-md focus-visible:ring-1 focus-visible:outline-hidden"
    >
      <Icon className="size-3.5" aria-hidden="true" />
    </a>
  );
  const phone = (name: 'hotel_tel' | 'company_tel') => {
    const value = String(f[name] ?? '').trim();
    return inline(name, t('pages.clusterAdmin.phoneLabel'), {
      validate: true,
      trailing: value && actionLink(`tel:${value.replace(/[^\d+]/g, '')}`, t('pages.clusterAdmin.callPhoneAria', { value }), Phone),
    });
  };
  const email = (name: 'hotel_email' | 'company_email') => {
    const value = String(f[name] ?? '').trim();
    return inline(name, t('common.field.email'), {
      type: 'email',
      validate: true,
      trailing: value && actionLink(`mailto:${value}`, t('pages.clusterAdmin.sendEmailAria', { value }), Mail),
    });
  };

  // ข้อมูลติดต่อ | ที่ตั้ง วางเคียงกันตั้งแต่ lg — เดิมเป็นกลุ่มเดียวหัวข้อซ้ำชื่อ tab
  // และครึ่งขวาของการ์ดว่างตลอด ขณะที่ที่อยู่ยาวบรรทัดเดียวจนรหัสไปรษณีย์ตกบรรทัด
  const contactCard = (left: React.ReactNode, right: React.ReactNode) => (
    <Card className="gap-0 p-0">
      <div className="lg:grid lg:grid-cols-2">
        {left}
        {right}
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      <TabStrip tabs={tabs} value={activeTab} onChange={onTabChange} />

      {activeTab === 'overview' && (
        <div className="space-y-4">
          <Card className="p-0">
            <Group label={t('common.section.identity')}>
              {inline('alias_name', t('common.field.alias'), { mono: true, validate: true, maxLength: BU_ALIAS_MAX })}
              {inline('description', t('common.field.description'), { type: 'textarea' })}
            </Group>
            {/* ป้ายกลุ่มแบบเดียวกับที่เหลือของหน้า แทน BusinessUnitBrandingCard ซึ่งใช้หัวการ์ด
                คนละแบบ (CardTitle + CardDescription) — การ์ดนั้นยังเป็นของหน้า platform ต่อไป */}
            <Group label={t('common.section.branding')}>
              <div className="flex flex-col gap-6 pt-1 sm:flex-row sm:gap-10">
                <BrandingImageUpload
                  label={t('pages.clusterAdmin.logoLabel')}
                  value={logoUrl}
                  disabled={!canEdit}
                  shape="rect"
                  onUpload={onUploadLogo}
                />
                <BrandingImageUpload
                  label={t('common.field.avatar')}
                  value={avatarUrl}
                  disabled={!canEdit}
                  shape="square"
                  fallbackName={f.name}
                  fallbackCode={f.code}
                  onUpload={onUploadAvatar}
                />
              </div>
            </Group>
          </Card>
          <TabJumpList summaries={summaries} onJump={onTabChange} />
        </div>
      )}

      {activeTab === 'users' && usersSlot}

      {activeTab === 'hotel' &&
        contactCard(
          <Group label={t('pages.clusterAdmin.contactGroup')}>
            {inline('hotel_name', t('pages.clusterAdmin.hotelNameLabel'))}
            {phone('hotel_tel')}
            {email('hotel_email')}
          </Group>,
          <Group label={t('pages.clusterAdmin.locationGroup')} className="lg:border-l">
            <AddressBlock prefix="hotel" formData={f} disabled={!canEdit} onChange={onChange} />
          </Group>,
        )}

      {activeTab === 'company' &&
        contactCard(
          <Group label={t('pages.clusterAdmin.billingDetailsGroup')}>
            {inline('company_name', t('pages.clusterAdmin.companyNameLabel'))}
            {phone('company_tel')}
            {email('company_email')}
            {inline('tax_no', t('pages.clusterAdmin.taxIdLabel'), { mono: true })}
            {inline('branch_no', t('pages.clusterAdmin.branchLabel'), { mono: true })}
          </Group>,
          <Group
            label={t('pages.clusterAdmin.billingAddressGroup')}
            className="lg:border-l"
            // ปุ่มคัดลอกแตะแค่ที่อยู่ จึงอยู่บนหัวกลุ่มที่อยู่ ไม่ใช่หัวของทั้ง tab
            action={
              canEdit && (
                <Button type="button" variant="ghost" size="sm" className="-my-2" onClick={onCopyHotelAddress}>
                  <Copy className="mr-2 h-4 w-4" />
                  {t('pages.clusterAdmin.copyFromHotelAddress')}
                </Button>
              )
            }
          >
            <AddressBlock prefix="company" formData={f} disabled={!canEdit} onChange={onChange} />
          </Group>,
        )}

      {activeTab === 'configuration' && configurationSlot}

      {activeTab === 'licenses' && licensesSlot}
    </div>
  );
}

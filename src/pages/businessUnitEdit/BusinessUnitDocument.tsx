import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { useState } from 'react';
import { Copy } from 'lucide-react';
import { ClusterPicker } from '../../components/ClusterPicker';
import type { ClusterOption } from '../../hooks/useClusterSearch';
import { useI18n } from '../../hooks/useI18n';
import type { BusinessUnitConfig, TenantCurrency } from '../../types';
import type { BusinessUnitFormData, DefaultCurrency } from './types';
import { BU_ALIAS_MAX } from './types';
import { InlineField, type InlineEditorContext, type InlineOption, type InlineWidth } from './InlineField';
import { Group } from './shared';
import { cn } from '../../lib/utils';
import { brandInitials } from '../../components/BrandMark';
import CalculationSettingsSection from './sections/CalculationSettingsSection';
import NumberFormatsSection from './sections/NumberFormatsSection';
import ConfigurationSection from './sections/ConfigurationSection';
import AttachmentPolicySection, { type AttachmentPolicyValue } from './sections/AttachmentPolicySection';
import DatabaseConnectionSection from './sections/DatabaseConnectionSection';
import { LICENSE_SECTION_IDS } from './LicenseSummaryStrip';
import BusinessUnitTabs, { type BuTab, type BuTabId } from './BusinessUnitTabs';

interface BusinessUnitDocumentProps {
  formData: BusinessUnitFormData;
  fieldErrors: Record<string, string>;
  clusterName: string;
  /** The page's hydrated row for `formData.cluster_id` — the cluster picker reuses it instead of re-fetching. */
  currentClusterOption?: ClusterOption | null;
  logoUrl?: string;
  avatarUrl?: string;
  defaultCurrency: DefaultCurrency | null;
  currencies?: TenantCurrency[] | null;
  currenciesLoading?: boolean;
  currenciesFailed?: boolean;
  getCalculationMethodLabel: (method: string) => string;
  canEdit: boolean;
  /**
   * ระเบียนยังไม่ถูกสร้าง — ตัวควบคุมที่ต้องมี BU อยู่จริงก่อนถึงจะทำงานได้ต้องไม่โผล่มา
   *
   * หน้านี้ซ่อน branding / users / licenses ตอน `isNew` อยู่แล้ว แต่มีอีกสองอย่างที่ตกสำรวจไป:
   * Max users (เป็นผลรวมของใบไลเซนส์ จึงเป็น 0 เสมอ และคำอธิบายใต้ช่องชี้ไปยังแท็บ Users ที่ยัง
   * ไม่มีในหน้าสร้างใหม่) กับ Default currency (catalog ดึงด้วย `currencyService.getForBu(code)`
   * ซึ่งต้องมี BU อยู่บนเซิร์ฟเวอร์ก่อน หน้าสร้างใหม่จึงไม่เคยดึง แล้วตกไปเป็นช่องพิมพ์ที่ขอ UUID
   * ของสกุลเงิน — ช่องที่ไม่มีใครกรอกได้)
   */
  isNew?: boolean;
  // Read-only "Max users" display — computed from the User Licenses card's own license
  // rows (sumActiveLicenses / active count), not form state. There is no editable control
  // for this number any more; it is edited only via the licenses card below.
  activeSeats: number;
  activeLicenseCount: number;
  // simple-field commits (edit-in-place)
  onCommit: (name: string, value: string) => void;
  onToggle: (name: string, value: boolean) => void;
  onValidate: (name: string, value: string) => void;
  onCopyHotelAddress: () => void;
  // event-based handlers for the reused complex sections
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus: (e: React.FocusEvent<HTMLInputElement>) => void;
  onConfigChange: (index: number, field: keyof BusinessUnitConfig, value: string) => void;
  /** นโยบายไฟล์แนบ — ไม่ส่ง = ไม่แสดง section (หน้าอื่นที่ใช้ร่วมกัน) */
  onAttachmentPolicyChange?: (next: AttachmentPolicyValue | null) => void;
  onAddConfigRow: () => void;
  onRemoveConfigRow: (index: number) => void;
  onPoolChange: (field: 'database_pool_id' | 'db_schema', value: string) => void;
  // Tab state is owned by the page, not by this component: Save has to be able to jump to
  // the tab holding a failed field, and the page is what runs the validation.
  tabs: BuTab[];
  activeTab: BuTabId;
  onTabChange: (tab: BuTabId) => void;
  brandingSlot?: React.ReactNode;
  /** ลูกค้า (AR) ของ BU — แสดงเฉพาะเมื่อผู้เรียกมองเห็นฟิลด์ customer */
  customerSlot?: React.ReactNode;
  advancedExtraSlot?: React.ReactNode;
  usersSlot?: React.ReactNode;
  /** แถบสรุป 3 ช่องบนหัวแท็บ Licenses — ช่องกดแล้วเลื่อนไปยัง id ใน `LICENSE_SECTION_IDS` */
  licensesSummarySlot?: React.ReactNode;
  licensesSlot?: React.ReactNode;
  /** ใบสิทธิ์ interface — คนละชนิดกับที่นั่ง จึงเป็นการ์ดของตัวเองใต้ `licensesSlot` ไม่ใช่ก้อนเดียวกัน */
  interfaceLicensesSlot?: React.ReactNode;
  /** โควตาพื้นที่เก็บข้อมูลของ BU — ฝั่งทีม Carmen เท่านั้น (ต้องมี storage_quota.read) */
  storageQuotaSlot?: React.ReactNode;
  /** โน้ตภายในของ staff — หน้าแม่ห่อด้วย `hidden` เองเพื่อให้ draft รอดตอนสลับแท็บ จึงเรนเดอร์ทุกครั้งที่มี slot */
  notesSlot?: React.ReactNode;
}

export default function BusinessUnitDocument(props: BusinessUnitDocumentProps) {
  const { t } = useI18n();
  const {
    formData: f,
    fieldErrors,
    clusterName,
    currentClusterOption = null,
    logoUrl,
    avatarUrl,
    defaultCurrency,
    currencies,
    currenciesLoading,
    currenciesFailed,
    getCalculationMethodLabel,
    canEdit,
    isNew = false,
    activeSeats,
    activeLicenseCount,
    onCommit,
    onToggle,
    onValidate,
    onCopyHotelAddress,
    onChange,
    onBlur,
    onFocus,
    onConfigChange,
    onAttachmentPolicyChange,
    onAddConfigRow,
    onRemoveConfigRow,
    onPoolChange,
    tabs,
    activeTab,
    onTabChange,
    brandingSlot,
    customerSlot,
    advancedExtraSlot,
    usersSlot,
    licensesSummarySlot,
    licensesSlot,
    interfaceLicensesSlot,
    storageQuotaSlot,
    notesSlot,
  } = props;

  // `canEdit` is the one source of write access on this page. Each section already
  // renders a read-only branch when `editing` is false, so gating here disables
  // every control they own (DB credentials, calculation method, config rows).
  const sectionField = { formData: f, editing: canEdit, fieldErrors, onChange, onBlur, onFocus };
  // The picker reports the option it resolved or the user picked; the label must follow a pick
  // immediately (the page's hydrated name only catches up a render later).
  const [clusterOption, setClusterOption] = useState<ClusterOption | null>(null);
  const clusterReadLabel =
    clusterOption && clusterOption.id === f.cluster_id
      ? clusterOption.name
      : currentClusterOption && currentClusterOption.id === f.cluster_id
        ? currentClusterOption.name
        : clusterName && clusterName !== '-' && clusterName !== f.cluster_id
          ? clusterName
          : undefined;

  const inline = (
    name: keyof BusinessUnitFormData,
    label: string,
    opts?: {
      type?: 'text' | 'number' | 'email' | 'textarea' | 'select';
      options?: InlineOption[];
      mono?: boolean;
      width?: InlineWidth;
      validate?: boolean;
      required?: boolean;
      maxLength?: number;
      renderEditor?: (ctx: InlineEditorContext) => React.ReactNode;
      readLabel?: string;
    },
  ) => (
    <InlineField
      key={name}
      name={name}
      label={label}
      value={String(f[name] ?? '')}
      type={opts?.type}
      options={opts?.options}
      mono={opts?.mono}
      width={opts?.width}
      required={opts?.required}
      maxLength={opts?.maxLength}
      error={fieldErrors[name]}
      disabled={!canEdit}
      renderEditor={opts?.renderEditor}
      readLabel={opts?.readLabel}
      onCommit={onCommit}
      onValidate={opts?.validate ? onValidate : undefined}
    />
  );

  return (
    <div className="space-y-4">
      <Card className="p-0">
        {/* Identity strip. One mark, not two: when neither image is uploaded the logo box
            and the avatar are both derived from the same code/name, so rendering both
            printed "DEMO / D / DEMO" three times across one row. A real uploaded logo and
            a real uploaded avatar ARE different artwork, so both still show when set. */}
        <div className="flex flex-wrap items-center gap-3 p-4 sm:px-6">
          <div className="flex shrink-0 gap-2.5">
            {/* Logo keeps its own aspect: slot height fixed, width follows the image, capped at 4:1
                (h-10 → max-w-40). object-cover on a fixed w-14 used to crop landscape logos.
                min-w-10 stops the w-auto box collapsing to 0 before the image decodes. */}
            {logoUrl && (
              <img
                src={logoUrl}
                alt=""
                className="bg-background h-10 w-auto min-w-10 max-w-40 rounded-lg border object-contain p-0.5"
              />
            )}
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="size-10 rounded-full border object-cover" />
            ) : (
              !logoUrl && (
                // กติกาตัวย่อเดียวกับช่อง Avatar ในการ์ด Branding (brandInitials: code ก่อน name) —
                // เดิมตรงนี้หยิบตัวแรกของ name ได้ "B" ขณะที่ Branding ข้างล่างแสดง "DE" ของ BU เดียวกัน
                <div className="bg-primary/90 grid size-10 place-items-center rounded-full text-sm font-bold text-white">
                  {brandInitials(f.name, f.code)}
                </div>
              )
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm">
            {clusterName && clusterName !== '-' && <span className="text-foreground/80">{clusterName}</span>}
            {/* Status toggles: the Badge carries the status semantics, the button
                carries the affordance. Hit area reaches 44px via padding on the
                wrapping button, without growing the badge itself. */}
            <button
              type="button"
              disabled={!canEdit}
              aria-pressed={f.is_active}
              onClick={() => onToggle('is_active', !f.is_active)}
              className="focus-visible:ring-ring -my-2 rounded-full py-2 focus-visible:outline-hidden focus-visible:ring-1"
            >
              <Badge variant={f.is_active ? 'success' : 'secondary'}>
                {f.is_active ? t('common.status.active') : t('common.status.inactive')}
              </Badge>
            </button>
            <button
              type="button"
              disabled={!canEdit}
              aria-pressed={f.is_hq}
              onClick={() => onToggle('is_hq', !f.is_hq)}
              className="focus-visible:ring-ring -my-2 rounded-full py-2 focus-visible:outline-hidden focus-visible:ring-1"
            >
              <Badge variant={f.is_hq ? 'default' : 'secondary'}>{t('common.label.hq')}</Badge>
            </button>
          </div>
        </div>
      </Card>

      {/* The tab strip is pinned below the app header. This page is read and edited many
          times a day and its tabs run several screens deep; unpinned, every tab switch cost
          a scroll back to the top. It carries the BU code so the pinned bar still says which
          record you are in once the header above has scrolled away.
          `top-14` / `md:top-16` are the two Layout header heights — keep them in step.
          ทึบ ไม่ใช่ `bg-background/95 backdrop-blur` — ด้วยเหตุผลเดียวกับแถบ header ใน Layout:
          แถวที่เลื่อนผ่านใต้แถบกลายเป็นเงาจาง ๆ ทับ tab ที่กำลังอ่านอยู่ */}
      <div className="bg-background sticky top-14 z-20 -mt-2 flex items-center gap-3 border-b px-2 sm:px-4 md:top-16">
        {f.code && (
          <span className="text-primary bg-primary/10 shrink-0 rounded px-1.5 py-0.5 font-mono text-xs font-semibold">
            {f.code}
          </span>
        )}
        {/* min-w-0 or the strip refuses to shrink below its five triggers and pushes the
            whole page into a horizontal scroll at 390px — the strip scrolls sideways on its
            own, but only once it is allowed to be narrower than its content. */}
        <div className="min-w-0 flex-1">
          <BusinessUnitTabs tabs={tabs} value={activeTab} onChange={onTabChange} />
        </div>
      </div>

      {activeTab === 'general' && (
        <>
          <Card className="overflow-visible p-0 [&>div:first-child]:border-t-0">
            {/* `cluster_id` and `name` (the latter in the header) are the two fields
                validateRequired() enforces — they are the only ones marked required.
                `code` used to be a third, but it is no longer a field the user sets: the
                platform assigns it at creation and ignores it on update (see the read-only
                block below), so there is nothing left here to validate — don't add it back. */}
            <Group
              label={t('pages.businessUnits.detailsGroup')}
              description={t('pages.businessUnits.detailsGroupDescription')}
            >
              {/* code เป็นรหัสที่แพลตฟอร์มตั้งตอนสร้าง ไม่ใช่ช่องกรอก — หน้า new จึงไม่มีอะไรจะแสดง
                  (แถวยังไม่เกิด รหัสจึงยังไม่มี) และหน้า edit แสดงอย่างเดียวแก้ไม่ได้ เพราะ
                  backend เพิกเฉยต่อ code ที่ส่งมาใน update อยู่แล้ว การเปิดให้พิมพ์ได้จะเป็นช่อง
                  ที่รับค่าแล้วทิ้ง หน้า cluster-admin ถอดช่องนี้ออกด้วยเหตุผลเดียวกัน (BusinessUnitForm.tsx:42)
                  ไม่ใช่ InlineField: ไม่มีอะไรให้กดเข้าโหมดแก้ — รูปเดียวกับแถว maxUsers ข้างล่าง */}
              {!isNew && (
                <div className="grid grid-cols-1 gap-0.5 py-1.5 sm:grid-cols-[150px_1fr] sm:items-start sm:gap-3">
                  <span className="text-muted-foreground pt-2 text-xs">{t('common.field.code')}</span>
                  <div className="min-w-0">
                    <StaticValue value={f.code} mono />
                  </div>
                </div>
              )}
              {inline('alias_name', t('common.field.alias'), { width: 'xs', validate: true, maxLength: BU_ALIAS_MAX })}
              {/* BU Edit is only reachable with cluster.update / cluster.create (App.tsx route guards), the
                  same authority the old full cluster-list load ran under, so search is always allowed. */}
              {inline('cluster_id', t('common.label.cluster'), {
                type: 'select',
                required: true,
                readLabel: clusterReadLabel,
                // Clicking the field means "pick a cluster": the editor opens straight into the
                // search list (one click, like the old <select>) instead of a chip the user must
                // clear first. The current cluster's name is the placeholder; Escape / outside
                // click cancels the edit, so the saved value is untouched until a row is picked.
                renderEditor: (ctx) => (
                  <ClusterPicker
                    value=""
                    placeholder={clusterReadLabel ?? (ctx.value || undefined)}
                    // The editor mounts only because the user just clicked the field to edit it —
                    // focus belongs in its search box, as the built-in inline editors do.
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    invalid={!!fieldErrors.cluster_id}
                    canSearch
                    ariaLabel={t('common.label.cluster')}
                    onOpenChange={ctx.setBusy}
                    onChange={(id, opt) => {
                      if (!id) return;
                      if (opt) setClusterOption(opt);
                      if (id === ctx.value) ctx.cancel();
                      else ctx.commit(id);
                    }}
                  />
                ),
              })}
              {/* Read-only since Task 3.5 — this used to be a typed-in ceiling; it is now a sum of
                  this BU's dated license rows, edited only in the User Licenses card. Not an
                  InlineField: there is nothing here to click into edit mode. */}
              {!isNew && (
                <div className="grid grid-cols-1 gap-0.5 py-1.5 sm:grid-cols-[150px_1fr] sm:items-start sm:gap-3">
                  <span className="text-muted-foreground pt-2 text-xs">{t('pages.businessUnits.maxUsersLabel')}</span>
                  <div className="min-w-0">
                    <StaticValue value={`${activeSeats}`} />
                    <p className="text-muted-foreground mt-1 text-[11px]">
                      {activeLicenseCount === 1
                        ? t('pages.businessUnits.maxUsersFromLicenseOne', { count: activeLicenseCount })
                        : t('pages.businessUnits.maxUsersFromLicenseMany', { count: activeLicenseCount })}
                    </p>
                  </div>
                </div>
              )}
              {inline('description', t('common.field.description'), { type: 'textarea', width: 'md', maxLength: 500 })}
            </Group>
          </Card>

          <CalculationSettingsSection
            {...sectionField}
            onCommit={onCommit}
            defaultCurrency={defaultCurrency}
            getCalculationMethodLabel={getCalculationMethodLabel}
            currencies={currencies}
            currenciesLoading={currenciesLoading}
            currenciesFailed={currenciesFailed}
            showCurrencyField={!isNew}
          />
          {customerSlot}
          {brandingSlot}
        </>
      )}

      {activeTab === 'location' && (
        <Card className="overflow-hidden p-0 [&>div:first-child]:border-t-0">
          {/* Hotel first, company second: the company block copies from it, so the source has
              to be the one already read. Phone and email belong to the hotel — they used to
              sit in a "Contact" group of their own between the two addresses. */}
          <Group
            label={t('common.section.hotel')}
            description={t('pages.businessUnits.hotelGroupDescription')}
            cols={2}
          >
            {inline('hotel_name', t('pages.businessUnits.hotelNameLabel'), { maxLength: 100 })}
            {inline('hotel_address_line1', t('pages.businessUnits.addressLine1Label'))}
            {inline('hotel_address_line2', t('pages.businessUnits.addressLine2Label'))}
            {inline('hotel_sub_district', t('pages.businessUnits.subDistrictLabel'))}
            {inline('hotel_district', t('pages.businessUnits.districtLabel'))}
            {inline('hotel_city', t('pages.businessUnits.cityLabel'))}
            {inline('hotel_province', t('pages.businessUnits.provinceLabel'))}
            {inline('hotel_postal_code', t('pages.businessUnits.postalCodeLabel'), { mono: true , width: 'xs' })}
            {inline('hotel_country', t('pages.businessUnits.countryLabel'))}
            {inline('hotel_latitude', t('pages.businessUnits.latitudeLabel'), { mono: true , width: 'xs' })}
            {inline('hotel_longitude', t('pages.businessUnits.longitudeLabel'), { mono: true , width: 'xs' })}
            {inline('hotel_tel', t('pages.businessUnits.phoneLabel'), { mono: true , width: 'xs' })}
            {inline('hotel_email', t('common.field.email'), { type: 'email' })}
          </Group>

          <Group
            label={t('common.section.company')}
            description={t('pages.businessUnits.companyGroupDescription')}
            cols={2}
            action={
              canEdit && (
                <Button type="button" variant="ghost" size="sm" onClick={onCopyHotelAddress}>
                  <Copy className="mr-2 h-4 w-4" />
                  {t('pages.businessUnits.copyFromHotelAddress')}
                </Button>
              )
            }
          >
            {inline('company_name', t('common.field.company'), { maxLength: 100 })}
            {inline('company_tel', t('pages.businessUnits.companyPhoneLabel'), { mono: true , width: 'xs' })}
            {inline('company_email', t('pages.businessUnits.companyEmailLabel'), { type: 'email' })}
            {inline('company_address_line1', t('pages.businessUnits.companyAddressLine1Label'))}
            {inline('company_address_line2', t('pages.businessUnits.companyAddressLine2Label'))}
            {inline('company_sub_district', t('pages.businessUnits.companySubDistrictLabel'))}
            {inline('company_district', t('pages.businessUnits.companyDistrictLabel'))}
            {inline('company_city', t('pages.businessUnits.companyCityLabel'))}
            {inline('company_province', t('pages.businessUnits.companyProvinceLabel'))}
            {inline('company_postal_code', t('pages.businessUnits.companyPostalCodeLabel'), { mono: true , width: 'xs' })}
            {inline('company_country', t('pages.businessUnits.companyCountryLabel'))}
            {inline('company_latitude', t('pages.businessUnits.companyLatitudeLabel'), { mono: true , width: 'xs' })}
            {inline('company_longitude', t('pages.businessUnits.companyLongitudeLabel'), { mono: true , width: 'xs' })}
          </Group>

          <Group
            label={t('pages.businessUnits.taxGroup')}
            description={t('pages.businessUnits.taxGroupDescription')}
            cols={2}
          >
            {inline('tax_no', t('pages.businessUnits.taxIdLabel'), { mono: true , width: 'xs' })}
            {inline('branch_no', t('pages.businessUnits.branchLabel'), { mono: true , width: 'xs' })}
          </Group>
        </Card>
      )}

      {activeTab === 'formats' && (
        <>
          <Card className="overflow-hidden p-0 [&>div:first-child]:border-t-0">
            <Group
              label={t('pages.businessUnits.dateAndTimeGroup')}
              description={t('pages.businessUnits.dateAndTimeGroupDescription')}
              cols={2}
            >
              {inline('timezone', t('pages.businessUnits.timezoneLabel'), { width: 'xs' })}
              {inline('date_format', t('pages.businessUnits.dateFormatLabel'), { mono: true , width: 'xs' })}
              {inline('date_time_format', t('pages.businessUnits.dateTimeFormatLabel'), { mono: true , width: 'xs' })}
              {inline('time_format', t('pages.businessUnits.timeFormatLabel'), { mono: true , width: 'xs' })}
              {inline('long_time_format', t('pages.businessUnits.longTimeFormatLabel'), { mono: true , width: 'xs' })}
              {inline('short_time_format', t('pages.businessUnits.shortTimeFormatLabel'), { mono: true , width: 'xs' })}
            </Group>
          </Card>
          <NumberFormatsSection {...sectionField} />
        </>
      )}

      {activeTab === 'technical' && (
        <>
          {onAttachmentPolicyChange && (
            <AttachmentPolicySection {...sectionField} onAttachmentPolicyChange={onAttachmentPolicyChange} />
          )}
          <ConfigurationSection
            {...sectionField}
            onConfigChange={onConfigChange}
            onAddConfigRow={onAddConfigRow}
            onRemoveConfigRow={onRemoveConfigRow}
          />
          <DatabaseConnectionSection
            {...sectionField}
            onPoolChange={onPoolChange}
          />
          {advancedExtraSlot}
        </>
      )}

      {activeTab === 'users' && usersSlot}

      {activeTab === 'licenses' && (
        <>
          {licensesSummarySlot}
          {/* ห่อด้วย id ให้ช่องในแถบสรุปเลื่อนมาหา · scroll-mt เผื่อ header + TabStrip ที่ปักอยู่บนสุด
              · ห่อเฉพาะเมื่อมี slot ไม่งั้น div ว่างกิน gap ของ container */}
          {licensesSlot && <div id={LICENSE_SECTION_IDS.seats} className="scroll-mt-32">{licensesSlot}</div>}
          {interfaceLicensesSlot && <div id={LICENSE_SECTION_IDS.interfaces} className="scroll-mt-32">{interfaceLicensesSlot}</div>}
          {storageQuotaSlot && <div id={LICENSE_SECTION_IDS.storage} className="scroll-mt-32">{storageQuotaSlot}</div>}
        </>
      )}

      {notesSlot}
    </div>
  );
}

/**
 * ค่าที่แก้ไม่ได้ในแถวของ document (Code, Max users) — ข้อความเรียบ ไม่มีกรอบ.
 * เดิมใช้ ReadOnlyText (กล่องมีขอบ bg-muted หน้าตาเหมือน input) ขณะที่แถวที่แก้ได้จริงเป็น
 * InlineField ไม่มีกรอบ — ผู้ใช้จึงคลิกกล่องที่ไม่ตอบสนองแล้วมองข้ามช่องที่แก้ได้.
 * padding เท่ากับปุ่ม read-mode ของ InlineField (px-2 py-1.5) ค่าจึงตรงแนวเดียวกับแถวอื่น
 */
function StaticValue({ value, mono }: { value: string; mono?: boolean }) {
  return (
    <div className={cn('px-2 py-1.5 text-sm', mono && 'font-mono tabular-nums')}>{value || '-'}</div>
  );
}

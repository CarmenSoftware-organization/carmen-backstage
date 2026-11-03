import React from 'react';
import { Badge } from '../../../components/ui/badge';
import { CollapsibleSection, InlineField, type InlineOption } from '../shared';
import { useI18n } from '../../../hooks/useI18n';
import type { TFunction } from '../../../i18n/types';
import type { SectionFieldProps, DefaultCurrency } from '../types';
import type { TenantCurrency } from '../../../types';

interface CalculationSettingsSectionProps extends SectionFieldProps {
  defaultCurrency: DefaultCurrency | null;
  getCalculationMethodLabel: (method: string) => string;
  currencies?: TenantCurrency[] | null;
  currenciesLoading?: boolean;
  currenciesFailed?: boolean;
  /**
   * Default Currency is set from the tenant's currency catalog, a platform-managed list
   * this component fetches through `currencies`/`currenciesLoading`/`currenciesFailed`. A
   * cluster administrator has no reach into that catalog (no endpoint scoped to a cluster
   * admin's session exposes it), so the cluster-admin business-unit page never loads those
   * props and cannot offer a working editable control here — showing one would present a
   * field that silently can't do anything useful. The read-only "Default Currency" detail
   * card below is unaffected by this flag; it renders from `defaultCurrency`, which the
   * cluster-admin page does load directly off the business-unit record. Defaults to true
   * so every existing call site is unchanged.
   */
  showCurrencyField?: boolean;
  /**
   * Calculation method drives inventory costing math that is already in effect for a
   * business unit — changing it after the fact is a platform-level decision, not a
   * cluster-admin one, so the cluster-admin page opts to always show it read-only
   * regardless of its own `editing` state. Combined with `editing` (see below) rather than
   * replacing it, so this flag only ever narrows what platform admins already get; it can
   * never widen it. Defaults to true so every existing call site is unchanged.
   */
  canEditCalculationMethod?: boolean;
  /** Commit a value into formData — same contract as the Details rows' InlineField. */
  onCommit: (name: string, value: string) => void;
}

/** ค่าที่ domain สร้างได้ (ดู getCalculationMethodLabel ใน BusinessUnitEdit.tsx) */
const CALCULATION_METHODS = ['average', 'fifo', 'average_per_location'] as const;

const currencyLabel = (c: TenantCurrency, t: TFunction) =>
  `${c.code} - ${c.name}${c.is_active === false ? t('pages.businessUnits.inactiveSuffix') : ''}`;

const CalculationSettingsSection: React.FC<CalculationSettingsSectionProps> = ({
  formData,
  editing,
  onCommit,
  defaultCurrency,
  getCalculationMethodLabel,
  currencies,
  currenciesLoading = false,
  currenciesFailed = false,
  showCurrencyField = true,
  canEditCalculationMethod = true,
}) => {
  const { t } = useI18n();
  const currentId = formData.default_currency_id ?? '';
  const list = Array.isArray(currencies) ? currencies : [];
  // Preserve a saved id that isn't in the fetched list so the value never drops.
  const currentInList = !currentId || list.some((c) => c.id === currentId);
  const currentLabel =
    defaultCurrency && defaultCurrency.id === currentId
      ? `${defaultCurrency.code} - ${defaultCurrency.name}`
      : currentId;
  const currencyOptions: InlineOption[] = [
    ...(currentId && !currentInList ? [{ value: currentId, label: currentLabel }] : []),
    ...list.map((c) => ({ value: c.id, label: currencyLabel(c, t) })),
  ];
  // catalog โหลดไม่สำเร็จ (หรือไม่ได้ส่งมา) ขณะแก้ได้ → ช่องพิมพ์ id ดิบ เหมือน fallback เดิม
  const currencyAsText = editing && !currenciesLoading && (currenciesFailed || !Array.isArray(currencies));
  const methodOptions: InlineOption[] = CALCULATION_METHODS.map((m) => ({ value: m, label: getCalculationMethodLabel(m) }));

  return (
    <CollapsibleSection title={t('pages.businessUnits.calculationSettingsTitle')} description={t('pages.businessUnits.calculationSettingsDescription')} forceOpen>
      <div className="space-y-4">
        {/* แถวเดียวกับการ์ด Details (InlineField: ป้ายซ้าย ค่าขวา คลิกแล้วเป็น select) — เดิมเป็น
            Label ตัวหนาเหนือ <select> ที่เปิดค้าง ในกริด 4 คอลัมน์ แท็บเดียวจึงมีฟอร์มสองไวยากรณ์ */}
        <div>
          <InlineField
            name="calculation_method"
            label={t('pages.businessUnits.calculationMethodLabel')}
            type="select"
            options={methodOptions}
            value={formData.calculation_method ?? ''}
            width="xs"
            disabled={!(editing && canEditCalculationMethod)}
            onCommit={onCommit}
          />
          {showCurrencyField && (
            <InlineField
              name="default_currency_id"
              label={t('pages.businessUnits.defaultCurrencyIdLabel')}
              type={currencyAsText ? 'text' : 'select'}
              options={currencyOptions}
              value={currentId}
              width="sm"
              mono={currencyAsText}
              placeholder={
                currenciesLoading
                  ? t('pages.businessUnits.loadingCurrencies')
                  : currencyAsText
                    ? t('pages.businessUnits.defaultCurrencyIdPlaceholder')
                    : undefined
              }
              disabled={!editing || currenciesLoading}
              onCommit={onCommit}
            />
          )}
        </div>
        {/* แผ่นรายละเอียดสกุลเงินเดิมเป็น `rounded-md border` ซ้อนอยู่ในการ์ดอีกที — กรอบซ้อน
            กรอบทำให้สายตาอ่านว่ามันเป็นวัตถุคนละชั้นกับ field ข้างบน ทั้งที่มันคือส่วนขยาย
            ของ field เดียวกัน เหลือเส้นคั่นบนเส้นเดียว เท่าที่จำเป็นต่อการแยกกลุ่ม */}
        {!editing && defaultCurrency && (
          <div className="space-y-3 border-t pt-4">
            {/* หัวข้อ 'Default currency' ถูกถอด: มันซ้ำคำต่อคำกับป้ายของ field ที่อยู่เหนือมัน
                ไม่ถึงห้าสิบพิกเซล กลุ่มนี้ขยายความ field นั้นอยู่แล้ว ไม่ต้องประกาศตัวซ้ำ
                เหลือแค่ป้ายสถานะ ซึ่งเป็นสิ่งเดียวในแถวนั้นที่บอกอะไรใหม่ */}
            <Badge variant={defaultCurrency.is_active ? 'success' : 'secondary'} className="text-xs">
              {defaultCurrency.is_active ? t('common.status.active') : t('common.status.inactive')}
            </Badge>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t('common.field.code')}</span>
                <div className="text-sm font-medium">{defaultCurrency.code || '-'}</div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t('common.field.name')}</span>
                <div className="text-sm">{defaultCurrency.name || '-'}</div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t('pages.businessUnits.symbolLabel')}</span>
                <div className="text-sm">{defaultCurrency.symbol || '-'}</div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t('pages.businessUnits.decimalPlacesLabel')}</span>
                <div className="text-sm">{defaultCurrency.decimal_places ?? '-'}</div>
              </div>
            </div>
            {defaultCurrency.description && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t('common.field.description')}</span>
                <div className="text-sm">{defaultCurrency.description}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};

export default CalculationSettingsSection;

import { Card } from '../../../components/ui/card';
import { Group } from '../../businessUnitEdit/shared';
import { previewNumberFormat } from '../../businessUnitEdit/sections/numberFormatPreview';
import type { BusinessUnitFormData, DefaultCurrency } from '../../businessUnitEdit/types';
import { cn } from '../../../lib/utils';
import { useI18n } from '../../../hooks/useI18n';

interface ConfigurationReadoutProps {
  formData: BusinessUnitFormData;
  fieldErrors: Record<string, string>;
  defaultCurrency: DefaultCurrency | null;
  getCalculationMethodLabel: (method: string) => string;
}

/**
 * แถวอ่านอย่างเดียว ทรงเดียวกับ InlineField (ป้าย 150px | ค่า) — tab อื่นของหน้านี้อ่านแบบนี้
 * ทั้งหมด เดิม tab นี้ใช้กล่อง input สีเทาซึ่งดูเหมือนช่องที่ถูกปิด ไม่ใช่ค่าที่ตั้งไว้แล้ว
 */
function Row({
  label, children, error, sub,
}: { label: string; children: React.ReactNode; error?: string; sub?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 py-1.5 sm:grid-cols-[150px_1fr] sm:items-start sm:gap-3">
      <span className="text-muted-foreground pt-2 text-xs">{label}</span>
      <div className="min-w-0 px-2 py-1.5 text-sm">
        {children}
        {sub && <div className="text-muted-foreground mt-0.5 text-xs">{sub}</div>}
        {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
      </div>
    </div>
  );
}

const Empty = () => <span className="text-muted-foreground">—</span>;

/**
 * tab Configuration ของ cluster admin — อ่านอย่างเดียวทั้งใบ (เหตุผลอยู่ที่ configurationSlot ใน
 * BusinessUnitForm.tsx) การ์ดเดียว สาม Group แทนการ์ดสามใบที่หัวสามทรง
 *
 * ไม่ใช้ CalculationSettingsSection / NumberFormatsSection ของหน้า platform: สองตัวนั้นเป็นฟอร์ม
 * แก้ได้ที่มีหัว CardHeader ของตัวเอง หน้านี้ต้องการแค่ผลลัพธ์ จึงอ่านค่าเองที่นี่ ค่าทั้งหมดยังอยู่ใน
 * formData และยังส่งกลับใน payload ตอน Save เหมือนเดิม
 *
 * รูปแบบตัวเลขแสดงผลลัพธ์จริง (1,234.568) เป็นค่าหลัก ส่วน JSON ดิบเป็นบรรทัดรอง — ตัว blob
 * ไม่บอกคนอ่านว่าผู้ใช้ปลายทางจะเห็นตัวเลขหน้าตาแบบไหน
 */
export function ConfigurationReadout({
  formData: f, fieldErrors, defaultCurrency, getCalculationMethodLabel,
}: ConfigurationReadoutProps) {
  const { t } = useI18n();

  const text = (name: keyof BusinessUnitFormData, label: string, mono = false) => {
    const value = String(f[name] ?? '');
    return (
      <Row key={name} label={label} error={fieldErrors[name]}>
        {value ? <span className={cn(mono && 'font-mono tabular-nums')}>{value}</span> : <Empty />}
      </Row>
    );
  };

  const format = (name: 'amount_format' | 'quantity_format' | 'recipe_format', label: string) => {
    const raw = f[name];
    const preview = previewNumberFormat(raw);
    return (
      <Row
        key={name}
        label={label}
        error={fieldErrors[name]}
        sub={raw && <span className="font-mono break-all">{raw}</span>}
      >
        {preview.kind === 'ok' ? (
          <span>
            <span className="text-muted-foreground">
              {t('pages.businessUnits.formatPreviewSample', { sample: String(preview.of) })}
            </span>{' '}
            <span className="font-mono font-medium tabular-nums">{preview.text}</span>
          </span>
        ) : preview.kind === 'empty' ? (
          <Empty />
        ) : (
          <span className="text-destructive">
            {preview.reason === 'json'
              ? t('pages.businessUnits.formatPreviewInvalidJson')
              : t('pages.businessUnits.formatPreviewInvalidOptions')}
          </span>
        )}
      </Row>
    );
  };

  const currency = defaultCurrency
    ? [defaultCurrency.code, defaultCurrency.name, defaultCurrency.symbol && `(${defaultCurrency.symbol})`]
        .filter(Boolean).join(' · ')
    : '';

  return (
    <Card className="p-0">
      <Group label={t('pages.clusterAdmin.regionalFormats')}>
        <div className="lg:grid lg:grid-cols-2 lg:gap-x-10">
          {text('timezone', t('pages.clusterAdmin.timezone'))}
          {text('date_format', t('pages.clusterAdmin.dateFormat'), true)}
          {text('date_time_format', t('pages.clusterAdmin.dateTimeFormat'), true)}
          {text('time_format', t('pages.clusterAdmin.timeFormat'), true)}
          {text('long_time_format', t('pages.clusterAdmin.longTimeFormat'), true)}
          {text('short_time_format', t('pages.clusterAdmin.shortTimeFormat'), true)}
        </div>
      </Group>
      <Group label={t('pages.businessUnits.calculationSettingsTitle')}>
        <Row label={t('pages.businessUnits.calculationMethodLabel')} error={fieldErrors.calculation_method}>
          {f.calculation_method ? getCalculationMethodLabel(f.calculation_method) : <Empty />}
        </Row>
        {currency && <Row label={t('pages.businessUnits.defaultCurrencyIdLabel')}>{currency}</Row>}
      </Group>
      <Group label={t('pages.businessUnits.numberFormatsTitle')}>
        {format('amount_format', t('pages.businessUnits.amountFormatLabel'))}
        {format('quantity_format', t('pages.businessUnits.quantityFormatLabel'))}
        {format('recipe_format', t('pages.businessUnits.recipeFormatLabel'))}
      </Group>
    </Card>
  );
}

import { useCallback } from 'react';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { ReadOnlyField } from '../../../components/ReadOnlyField';
import { useI18n } from '../../../hooks/useI18n';
import type { TKey } from '../../../i18n/types';
import type { SubscriptionStatus } from '../../../types';
import { useFeature } from '../../../hooks/useFeature';

export interface SubscriptionFormData {
  cluster_id: string;
  /** BU ที่ออกสัญญาให้ — เลือกได้ตอนสร้างเท่านั้น แก้ทีหลังไม่ได้ เหมือน `cluster_id` */
  business_unit_id: string;
  /** ระบบออกให้ (`SUB-YYMM-####`) — แสดงอย่างเดียว ว่างตอนสร้างเพราะยังไม่มีเลข */
  subscription_number: string;
  /** 'YYYY-MM-DD' — the raw <input type="date"> value, converted to/from ISO Z at the page level. */
  start_date: string;
  end_date: string;
  status: SubscriptionStatus;
  /** AI credit ต่อเดือน — สตริงดิบจาก <input type="number"> (int 0..1,000,000) แปลงเป็นตัวเลขตอนส่ง */
  ai_credits_per_month: string;
}

const STATUS_OPTIONS: SubscriptionStatus[] = ['active', 'inactive', 'expired'];

const selectClassName =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring';

export interface SubscriptionInfoCardProps {
  formData: SubscriptionFormData;
  fieldErrors: Record<string, string>;
  /** false ⇒ every field renders its read-only mode (no separate Edit toggle on this page). */
  editing: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus: (e: React.FocusEvent<HTMLInputElement>) => void;
}

/**
 * เฉพาะสิ่งที่แก้ได้บนสัญญาที่ออกไปแล้ว — ช่วงเวลากับสถานะ ไม่มีอะไรอื่น
 *
 * การ์ดนี้เคยมีหกช่อง โดยสามช่อง (คลัสเตอร์ · หน่วยธุรกิจ · เลขที่สัญญา) แก้ไม่ได้เลยแต่ถูกวาด
 * เป็นกล่องมีขอบเหมือนช่องกรอก ทั้งสามย้ายขึ้นไปอยู่บน `IssuedSubscriptionPlate` แล้ว — ของที่มี
 * ขอบคือของที่แก้ได้ ซึ่งเป็นข้อตกลงเดียวกับที่หน้าแก้ไขใบอนุญาตใช้ (#230)
 *
 * ป้าย "สถานะที่มีผลจริง" ก็ย้ายขึ้นแผ่นเช่นกัน และไปโผล่เฉพาะตอนที่มันไม่ตรงกับ `status` — เดิม
 * มันวางป้าย Active ซ้อนป้าย Active ในช่องเดียวกัน ทำให้ช่องนั้นสูงกว่าเพื่อนและ grid เสียจังหวะ
 * โดยไม่ได้เตือนอะไรเลย
 *
 * โหมดสร้างไม่ผ่านการ์ดนี้ — `SubscriptionCreateForm` เป็นคนละฟอร์ม มี picker คลัสเตอร์/BU
 * ของตัวเอง (`isNew` จึงไม่เป็น prop ที่นี่อีกต่อไป)
 */
export function SubscriptionInfoCard({
  formData,
  fieldErrors,
  editing,
  onChange,
  onBlur,
  onFocus,
}: SubscriptionInfoCardProps) {
  const { t } = useI18n();
  const aiCreditOn = useFeature('license_ai_credit') === 'active';
  // `|| s` only fires for a value outside the union; translate() returns '' on a miss (same
  // shape as SubscriptionTable's stateLabel).
  const statusLabel = useCallback((s: string) => t(`common.status.${s}` as TKey) || s, [t]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('pages.subscriptions.amendTitle')}</CardTitle>
        <CardDescription>{t('pages.subscriptions.amendDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="start_date">{t('common.field.startDate')}{editing && ' *'}</Label>
            {editing ? (
              <>
                <Input
                  type="date"
                  id="start_date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={onChange}
                  onBlur={onBlur}
                  onFocus={onFocus}
                  className={fieldErrors.start_date ? 'border-destructive' : ''}
                />
                {fieldErrors.start_date && (
                  <p className="text-destructive text-xs">{fieldErrors.start_date}</p>
                )}
              </>
            ) : (
              <ReadOnlyField value={formData.start_date} />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="end_date">{t('common.field.endDate')}{editing && ' *'}</Label>
            {editing ? (
              <>
                <Input
                  type="date"
                  id="end_date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={onChange}
                  onBlur={onBlur}
                  onFocus={onFocus}
                  className={fieldErrors.end_date ? 'border-destructive' : ''}
                />
                {fieldErrors.end_date && (
                  <p className="text-destructive text-xs">{fieldErrors.end_date}</p>
                )}
              </>
            ) : (
              <ReadOnlyField value={formData.end_date} />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">{t('common.status.label')}</Label>
            {editing ? (
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={onChange}
                className={selectClassName}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </select>
            ) : (
              <div>
                <Badge variant={formData.status === 'active' ? 'success' : 'secondary'}>
                  {statusLabel(formData.status)}
                </Badge>
              </div>
            )}
          </div>

          {aiCreditOn && (
          <div className="space-y-2">
            <Label htmlFor="ai_credits_per_month">{t('pages.subscriptions.aiCreditsPerMonth')}</Label>
            {editing ? (
              <>
                <Input
                  type="number"
                  id="ai_credits_per_month"
                  name="ai_credits_per_month"
                  min={0}
                  max={1000000}
                  step={1}
                  value={formData.ai_credits_per_month}
                  onChange={onChange}
                  onBlur={onBlur}
                  onFocus={onFocus}
                  aria-invalid={!!fieldErrors.ai_credits_per_month}
                  className={fieldErrors.ai_credits_per_month ? 'border-destructive' : ''}
                />
                {fieldErrors.ai_credits_per_month ? (
                  <p className="text-destructive text-xs">{fieldErrors.ai_credits_per_month}</p>
                ) : (
                  <p className="text-muted-foreground text-xs">{t('pages.subscriptions.aiCreditsPerMonthHint')}</p>
                )}
              </>
            ) : (
              <ReadOnlyField value={formData.ai_credits_per_month} />
            )}
          </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

import React from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { useI18n } from '../../hooks/useI18n';
import { formatRevision, nextRevision, type RevisionParts } from '../../utils/reportRevision';

type Choice = 'minor' | 'major';

const CHOICES: Choice[] = ['minor', 'major'];

interface RevisionBumpToggleProps {
  /** The saved revision the next save starts from */
  current: RevisionParts;
  value: Choice;
  onChange: (next: Choice) => void;
  disabled?: boolean;
}

/**
 * เลือกว่าการบันทึกครั้งนี้จะบวกเลข revision ท้ายกระดาษรายงานแบบไหน — minor (1.2 → 1.3)
 * หรือ major (1.2 → 2.0) · ปุ่มบอกเลขที่จะได้เลย ผู้ใช้ไม่ต้องคิดเอง
 *
 * Picks how this save moves the printed revision. Built from `Button` like
 * `FeatureStateToggle` — the repo has no ToggleGroup primitive and ui/ is off limits.
 */
export const RevisionBumpToggle: React.FC<RevisionBumpToggleProps> = ({ current, value, onChange, disabled = false }) => {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground hidden text-xs sm:inline" title={t('pages.reportTemplates.revision.badgeTitle')}>
        {t('pages.reportTemplates.revision.badge', { revision: formatRevision(current) })} →
      </span>
      <div
        role="radiogroup"
        aria-label={t('pages.reportTemplates.revision.groupLabel')}
        className="inline-flex gap-0.5 rounded-md border border-border p-0.5"
      >
        {CHOICES.map((choice) => (
          <Button
            key={choice}
            type="button"
            role="radio"
            aria-checked={value === choice}
            size="sm"
            disabled={disabled}
            variant={value === choice ? 'default' : 'ghost'}
            className={cn('h-7 px-2 text-xs tabular-nums sm:px-3', value !== choice && 'text-muted-foreground')}
            title={t(choice === 'major' ? 'pages.reportTemplates.revision.majorHint' : 'pages.reportTemplates.revision.minorHint')}
            onClick={() => onChange(choice)}
          >
            {t(choice === 'major' ? 'pages.reportTemplates.revision.major' : 'pages.reportTemplates.revision.minor', {
              next: formatRevision(nextRevision(current, choice)),
            })}
          </Button>
        ))}
      </div>
    </div>
  );
};

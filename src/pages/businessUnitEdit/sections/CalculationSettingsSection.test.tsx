import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CalculationSettingsSection from './CalculationSettingsSection';
import { initialFormData } from '../types';
import type { SectionFieldProps } from '../types';
import type { TenantCurrency } from '../../../types';

const label = () => 'Average';

// ฟิลด์เป็น InlineField แล้ว: โหมดอ่านคือปุ่มที่แสดงค่า (หรือคำชวน "Set …") — คลิกก่อนถึงจะเป็น control
const openField = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

const base = (over: Partial<SectionFieldProps> = {}): SectionFieldProps => ({
  formData: { ...initialFormData },
  editing: true,
  fieldErrors: {},
  onChange: vi.fn(),
  onBlur: vi.fn(),
  onFocus: vi.fn(),
  ...over,
});

const currencies: TenantCurrency[] = [
  { id: 'usd', code: 'USD', name: 'US Dollar', is_active: true },
  { id: 'thb', code: 'THB', name: 'Thai Baht', is_active: false },
];

describe('CalculationSettingsSection currency field', () => {
  it('renders a select option per currency, marking inactive ones', () => {
    render(
      <CalculationSettingsSection
        {...base()}
        defaultCurrency={null}
        getCalculationMethodLabel={label}
        onCommit={vi.fn()}
        currencies={currencies}
      />,
    );
    openField('Set default currency…');
    const select = screen.getByLabelText('Default currency') as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'USD - US Dollar' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'THB - Thai Baht (inactive)' })).toBeInTheDocument();
  });

  it('falls back to a text input when the list failed to load', () => {
    render(
      <CalculationSettingsSection
        {...base()}
        defaultCurrency={null}
        getCalculationMethodLabel={label}
        onCommit={vi.fn()}
        currenciesFailed
      />,
    );
    openField('Default currency ID');
    const field = screen.getByLabelText('Default currency');
    expect(field.tagName).toBe('INPUT');
  });

  it('keeps the saved currency id as a selected option when absent from the list', () => {
    render(
      <CalculationSettingsSection
        {...base({ formData: { ...initialFormData, default_currency_id: 'legacy-id' } })}
        defaultCurrency={{ id: 'legacy-id', code: 'JPY', name: 'Yen', symbol: '¥' }}
        getCalculationMethodLabel={label}
        onCommit={vi.fn()}
        currencies={currencies}
      />,
    );
    openField('JPY - Yen');
    const select = screen.getByLabelText('Default currency') as HTMLSelectElement;
    expect(select.value).toBe('legacy-id');
    expect(screen.getByRole('option', { name: 'JPY - Yen' })).toBeInTheDocument();
  });

  it('renders the read-only detail card when not editing', () => {
    render(
      <CalculationSettingsSection
        {...base({ editing: false })}
        defaultCurrency={{ id: 'usd', code: 'USD', name: 'US Dollar', symbol: '$', is_active: true }}
        getCalculationMethodLabel={label}
        onCommit={vi.fn()}
        currencies={currencies}
      />,
    );
    // กลุ่มนี้ไม่ประกาศหัวข้อซ้ำกับป้าย field ที่อยู่เหนือมันแล้ว ป้ายสถานะคือแถวที่ระบุตัวมัน
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('USD')).toBeInTheDocument();
  });

  it('locks the currency field while currencies are loading', () => {
    render(
      <CalculationSettingsSection
        {...base()}
        defaultCurrency={null}
        getCalculationMethodLabel={label}
        onCommit={vi.fn()}
        currenciesLoading
      />,
    );
    expect(screen.getByRole('button', { name: 'Loading currencies…' })).toBeDisabled();
  });
});

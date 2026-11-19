import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ExtraConfigScreen } from '@features/settings/ui/extra-config/extra-config-screen';
import {
  DEFAULT_RESOLVED_EXTRA_CONFIG,
  EXTRA_CONFIG_KEYS,
} from '@/lib/constants/tenant-extra-config';

const mockSaveMutate = jest.fn();
const mockResetKeyMutate = jest.fn();
const mockResetAllMutate = jest.fn();
const mockMsgSuccess = jest.fn();
const mockMsgError = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
  useLocale: () => 'en',
}));

jest.mock('@/lib/utils/bilingual', () => ({
  useBilingual: () => (en: string | null) => en ?? '',
}));

jest.mock('@/lib/hooks/use-has-permission', () => ({
  useHasPermission: () => true,
}));

jest.mock('@/lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({
    currencyCode: 'OMR',
    decimalPlaces: 3,
  }),
}));

jest.mock('@ui/feedback', () => {
  const actual = jest.requireActual('@ui/feedback/cmx-summary-message');
  const badge = jest.requireActual('@ui/feedback/cmx-status-badge');
  return {
    ...actual,
    ...badge,
    CmxConfirmDialog: () => null,
    cmxMessage: {
      success: (...a: unknown[]) => mockMsgSuccess(...a),
      error: (...a: unknown[]) => mockMsgError(...a),
    },
  };
});

jest.mock('@features/settings/hooks/use-extra-config', () => ({
  useExtraConfig: () => ({
    query: {
      isLoading: false,
      isError: false,
      data: {
        resolved: { ...DEFAULT_RESOLVED_EXTRA_CONFIG, valuesByKey: {} },
        items: [
          {
            config_key: EXTRA_CONFIG_KEYS.NUMBER_SCRIPT,
            category_code: 'NUMBERS_AND_DATES',
            name: 'Currency & Number Digits',
            name2: 'أرقام العملة',
            description: 'Digit script',
            description2: null,
            value_type: 'SELECT',
            default_value: 'LATN',
            effective_value: 'LATN',
            override_value: null,
            is_overridden: false,
            source: 'SYSTEM',
            is_editable_by_tenant: true,
            plan_flag_key: null,
            plan_allowed: true,
            allowed_values: [
              { value: 'LATN', label: '1234567890 (Western)', label2: '1234567890' },
              { value: 'ARAB', label: '١٢٣٤٥٦٧٨٩٠ (Arabic)', label2: '١٢٣٤٥٦٧٨٩٠' },
            ],
            validation_regex: null,
            min_num: null,
            max_num: null,
            rec_order: 10,
          },
          {
            config_key: EXTRA_CONFIG_KEYS.BDI_ISOLATION_ENABLED,
            category_code: 'ACCESSIBILITY',
            name: 'BiDi Isolation',
            name2: 'عزل الاتجاه',
            description: 'Isolates codes',
            description2: null,
            value_type: 'BOOLEAN',
            default_value: 'TRUE',
            effective_value: 'TRUE',
            override_value: null,
            is_overridden: false,
            source: 'SYSTEM',
            is_editable_by_tenant: true,
            plan_flag_key: null,
            plan_allowed: true,
            allowed_values: [
              { value: 'TRUE', label: 'Enabled (Recommended)', label2: 'مفعّل' },
              { value: 'FALSE', label: 'Disabled', label2: 'معطّل' },
            ],
            validation_regex: null,
            min_num: null,
            max_num: null,
            rec_order: 10,
          },
        ],
      },
    },
    saveBatch: {
      isPending: false,
      mutateAsync: mockSaveMutate,
    },
    resetKey: {
      isPending: false,
      mutateAsync: mockResetKeyMutate,
    },
    resetAll: {
      isPending: false,
      mutateAsync: mockResetAllMutate,
    },
  }),
}));

describe('ExtraConfigScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSaveMutate.mockResolvedValue({});
  });

  it('renders list-assisted controls, updates live preview, and submits dirty changes cleanly', async () => {
    render(<ExtraConfigScreen />);

    expect(screen.getByText('Currency & Number Digits')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /1234567890 \(Western\)/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /١٢٣٤٥٦٧٨٩٠ \(Arabic\)/ })).toBeInTheDocument();
    expect(screen.getByText('1,234.500 OMR')).toBeInTheDocument();

    const arabRadio = screen.getByRole('radio', { name: /١٢٣٤٥٦٧٨٩٠/ });
    fireEvent.click(arabRadio);

    const saveBtn = screen.getByRole('button', { name: /saveCount/ });
    expect(saveBtn).toBeEnabled();
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockSaveMutate).toHaveBeenCalledWith([
        { config_key: EXTRA_CONFIG_KEYS.NUMBER_SCRIPT, config_value: 'ARAB' },
      ]);
      expect(mockMsgSuccess).toHaveBeenCalledWith('saved');
    });
  });
});

/**
 * DriverPicker visual coverage for default, loading, and RTL dispatcher use.
 * These localised fixtures keep Storybook independent of tenant API state.
 */
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { NextIntlClientProvider } from 'next-intl';
import { DriverPicker } from './driver-picker';
import type { OrgDriver } from '@/lib/types/drivers';

const englishMessages = {
  drivers: {
    picker: {
      label: 'Driver',
      searchLabel: 'Search drivers',
      searchPlaceholder: 'Search by name, phone, or vehicle plate',
      placeholder: 'Select a driver',
      unassigned: 'Unassigned',
      loading: 'Loading drivers…',
      empty: 'No active drivers are available.',
      noMatches: 'No drivers match your search.',
      onRoute: 'Active route',
      activeRouteWarning: 'This driver already has an active route. Assignment is allowed, but confirm the operational plan.',
    },
  },
};

const arabicMessages = {
  drivers: {
    picker: {
      label: 'السائق',
      searchLabel: 'البحث عن سائقين',
      searchPlaceholder: 'ابحث بالاسم أو الهاتف أو لوحة المركبة',
      placeholder: 'اختر سائقاً',
      unassigned: 'غير مُعيّن',
      loading: 'جار تحميل السائقين…',
      empty: 'لا يوجد سائقون نشطون متاحون.',
      noMatches: 'لا يوجد سائقون يطابقون بحثك.',
      onRoute: 'مسار نشط',
      activeRouteWarning: 'لدى هذا السائق مسار نشط بالفعل. التعيين مسموح، لكن أكد خطة التشغيل.',
    },
  },
};

const drivers: OrgDriver[] = [
  {
    id: 'a3cce68d-85b8-481f-84e4-b1dfb5798ea9',
    tenant_org_id: 'c1f369b7-d9d4-4ff5-a411-658ff2cf4a88',
    branch_id: null,
    linked_user_id: null,
    name: 'Omar Al-Hinai',
    name2: 'عمر الهنائي',
    phone: '+968 9123 4567',
    vehicle_type: 'Van',
    vehicle_plate_no: 'MCT 4621',
    license_no: null,
    is_active: true,
    created_at: null,
    updated_at: null,
  },
  {
    id: '3f4637f2-6781-405a-a549-8ecb3f1d8fa1',
    tenant_org_id: 'c1f369b7-d9d4-4ff5-a411-658ff2cf4a88',
    branch_id: null,
    linked_user_id: null,
    name: 'Salma Al-Balushi',
    name2: 'سلمى البلوشية',
    phone: '+968 9234 5678',
    vehicle_type: 'Motorcycle',
    vehicle_plate_no: 'MCT 8124',
    license_no: null,
    is_active: true,
    created_at: null,
    updated_at: null,
    hasActiveRoute: true,
  },
];

/**
 * Stateful Storybook harness so each variant exercises the controlled picker
 * contract without relying on route-planning data.
 */
function DriverPickerStory({ rtl = false, isLoading = false }: { rtl?: boolean; isLoading?: boolean }) {
  const [value, setValue] = useState<string | undefined>();
  const messages = rtl ? arabicMessages : englishMessages;

  return (
    <NextIntlClientProvider locale={rtl ? 'ar' : 'en'} messages={messages}>
      <div className="w-[360px]" dir={rtl ? 'rtl' : 'ltr'}>
        <DriverPicker drivers={drivers} value={value} onChange={setValue} isLoading={isLoading} />
      </div>
    </NextIntlClientProvider>
  );
}

/** Storybook metadata keeps the shared picker discoverable under Drivers. */
const meta = {
  title: 'Features/Drivers/DriverPicker',
  component: DriverPicker,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  render: () => <DriverPickerStory />,
} satisfies Meta<typeof DriverPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default variant — verifies the normal dispatcher selection flow.
export const Default: Story = {};

// Loading variant — verifies selection is unavailable while tenant driver choices load.
export const Loading: Story = {
  render: () => <DriverPickerStory isLoading />,
};

// RTL variant — verifies Arabic layout direction.
export const RTL: Story = {
  render: () => <DriverPickerStory rtl />,
  parameters: { direction: 'rtl' },
};

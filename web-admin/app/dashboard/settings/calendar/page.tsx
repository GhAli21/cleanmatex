/**
 * Business Calendar route: opening hours, cut-off, ready time and holidays.
 * The tab and branch come from the URL, so the screen needs a Suspense boundary.
 */
import { Suspense } from 'react';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission';
import { SETTINGS_SETTINGS_CALENDAR_ACCESS } from '@features/settings/access/settings-access';
import { BusinessCalendarScreen } from '@features/settings/calendar/ui/business-calendar-screen';

/** Enforces the route contract before rendering the calendar. */
export default function BusinessCalendarPage() {
  return (
    <RequireAnyPermission permissions={SETTINGS_SETTINGS_CALENDAR_ACCESS.page.permissions ?? []}>
      <Suspense fallback={null}>
        <BusinessCalendarScreen />
      </Suspense>
    </RequireAnyPermission>
  );
}

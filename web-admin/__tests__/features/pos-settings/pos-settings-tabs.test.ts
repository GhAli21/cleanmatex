import {
  POS_SETTINGS_FIELDS,
  POS_SETTINGS_FIELD_TAB,
  POS_SETTINGS_TAB,
  POS_SESSION_SURFACE_FIELDS,
  countDirtyFieldsByTab,
  pickPosSettings,
  resolvePosSettingsTab,
} from '@features/pos-settings/model/pos-settings-tabs'
import { CASH_CONTROL_SETTINGS_DEFAULT } from '@lib/constants/cash-control'

describe('pos-settings-tabs', () => {
  it('falls back to the first tab for a missing or unknown ?tab= value', () => {
    expect(resolvePosSettingsTab(null)).toBe(POS_SETTINGS_TAB.REQUIREMENT)
    expect(resolvePosSettingsTab('nope')).toBe(POS_SETTINGS_TAB.REQUIREMENT)
    expect(resolvePosSettingsTab('lifecycle')).toBe(POS_SETTINGS_TAB.LIFECYCLE)
  })

  it('places every per-screen requirement selector on the requirement tab', () => {
    for (const field of POS_SESSION_SURFACE_FIELDS) {
      expect(POS_SETTINGS_FIELD_TAB[field]).toBe(POS_SETTINGS_TAB.REQUIREMENT)
    }
  })

  it('owns only POS-session fields — never the cash-control ones', () => {
    for (const field of POS_SETTINGS_FIELDS) {
      expect(field.startsWith('posSession') || field === 'shiftZReportRequired').toBe(true)
    }
    expect(POS_SETTINGS_FIELDS).not.toContain('blindCloseEnabled')
    expect(POS_SETTINGS_FIELDS).not.toContain('cashChangeBearer')
  })

  it('counts unsaved fields per tab and ignores clean or unknown fields', () => {
    expect(
      countDirtyFieldsByTab({
        posSessionModeOrderEntry: true,
        posSessionModeCashRefd: true,
        posSessionStaleHours: true,
        shiftZReportRequired: false,
        blindCloseEnabled: true,
      })
    ).toEqual({ [POS_SETTINGS_TAB.REQUIREMENT]: 2, [POS_SETTINGS_TAB.LIFECYCLE]: 1 })
  })

  it('narrows a resolved policy to the POS-owned fields', () => {
    const picked = pickPosSettings(CASH_CONTROL_SETTINGS_DEFAULT)
    expect(Object.keys(picked).sort()).toEqual([...POS_SETTINGS_FIELDS].sort())
  })
})

import {
  POS_SESSION_REQUIREMENT_MODE as MODE,
  POS_SESSION_SURFACE,
  isPosSessionRequired,
} from '@/lib/constants/pos-session';
import {
  CASH_CONTROL_SETTINGS_DEFAULT,
  CASH_CONTROL_SETTING_DEFS,
  POS_SESSION_SURFACE_SETTING_FIELD,
} from '@/lib/constants/cash-control';

describe('isPosSessionRequired (per-screen POS-session policy)', () => {
  it('REQUIRED needs a session for any tender, never for no tender', () => {
    expect(isPosSessionRequired(MODE.REQUIRED, 'CASH')).toBe(true);
    expect(isPosSessionRequired(MODE.REQUIRED, 'NON_CASH')).toBe(true);
    expect(isPosSessionRequired(MODE.REQUIRED, 'NONE')).toBe(false);
  });

  it('REQUIRED_FOR_CASH needs a session only when cash is tendered', () => {
    expect(isPosSessionRequired(MODE.REQUIRED_FOR_CASH, 'CASH')).toBe(true);
    expect(isPosSessionRequired(MODE.REQUIRED_FOR_CASH, 'NON_CASH')).toBe(false);
    expect(isPosSessionRequired(MODE.REQUIRED_FOR_CASH, 'NONE')).toBe(false);
  });

  it('OPTIONAL never blocks', () => {
    for (const scope of ['CASH', 'NON_CASH', 'NONE'] as const) {
      expect(isPosSessionRequired(MODE.OPTIONAL, scope)).toBe(false);
    }
  });
});

describe('POS-session surface settings registry', () => {
  it('maps every surface to a registered enum setting that accepts every mode', () => {
    for (const surface of Object.values(POS_SESSION_SURFACE)) {
      const field = POS_SESSION_SURFACE_SETTING_FIELD[surface];
      const def = CASH_CONTROL_SETTING_DEFS.find((d) => d.tsField === field);
      expect(def?.type).toBe('enum');
      expect(def && 'values' in def ? [...def.values].sort() : []).toEqual(Object.values(MODE).sort());
    }
  });

  it('defaults: only order entry requires a session (for cash); every other screen is optional', () => {
    expect(CASH_CONTROL_SETTINGS_DEFAULT.posSessionModeOrderEntry).toBe(MODE.REQUIRED_FOR_CASH);
    expect(CASH_CONTROL_SETTINGS_DEFAULT.posSessionModeLaterColl).toBe(MODE.OPTIONAL);
    expect(CASH_CONTROL_SETTINGS_DEFAULT.posSessionModeStoredVal).toBe(MODE.OPTIONAL);
    expect(CASH_CONTROL_SETTINGS_DEFAULT.posSessionModeCashRefd).toBe(MODE.OPTIONAL);
  });

  it('uses the DB column names of migration 0554', () => {
    const columns = CASH_CONTROL_SETTING_DEFS.map((d) => d.dbColumn);
    expect(columns).toEqual(
      expect.arrayContaining([
        'pos_session_mode_order_entry',
        'pos_session_mode_later_coll',
        'pos_session_mode_stored_val',
        'pos_session_mode_cash_refd',
      ])
    );
    expect(columns).not.toContain('pos_session_req_for_cash');
    expect(columns).not.toContain('pos_session_req_all_tenders');
  });
});

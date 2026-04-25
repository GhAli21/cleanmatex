'use client';

import { Settings2, Package, Layers, CheckCircle2, Clock, DollarSign } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import { Badge } from '@ui/primitives';
import { CmxCard, CmxCardHeader, CmxCardTitle, CmxCardContent } from '@ui/primitives/cmx-card';
import type { OrderPreferenceRow } from '@/app/actions/orders/get-order-preferences';

interface OrdersPreferencesTabRprtProps {
  preferences: OrderPreferenceRow[];
  currencyCode: string;
  locale: 'en' | 'ar';
  translations: {
    emptyPreferences: string;
    levelOrder: string;
    levelItem: string;
    levelPiece: string;
    kindServicePrefs: string;
    kindPackingPrefs: string;
    kindConditionStain: string;
    kindConditionDamage: string;
    kindColor: string;
    kindNote: string;
    ownerSystem: string;
    ownerOverride: string;
    sourceOrderCreate: string;
    sourceManual: string;
    sourceOrderUpdate: string;
    extraCharge: string;
    confirmed: string;
    notConfirmed: string;
    confirmedBy: string;
    createdBy: string;
    prefCode: string;
    prefKind: string;
    level: string;
    source: string;
    owner: string;
    totalExtraCharge: string;
    orderLevelPrefs: string;
    itemLevelPrefs: string;
    pieceLevelPrefs: string;
    itemRef: string;
    pieceRef: string;
  };
}

const LEVEL_ORDER = 'ORDER';
const LEVEL_ITEM = 'ITEM';
const LEVEL_PIECE = 'PIECE';

function LevelIcon({ level }: { level: string }) {
  if (level === LEVEL_ORDER) return <Layers className="w-4 h-4 text-blue-500" />;
  if (level === LEVEL_ITEM) return <Package className="w-4 h-4 text-purple-500" />;
  return <Settings2 className="w-4 h-4 text-orange-500" />;
}

function kindBadge(kind: string | null, t: OrdersPreferencesTabRprtProps['translations']) {
  const map: Record<string, { label: string; cls: string }> = {
    service_prefs: { label: t.kindServicePrefs, cls: 'bg-blue-100 text-blue-800' },
    packing_prefs: { label: t.kindPackingPrefs, cls: 'bg-green-100 text-green-800' },
    condition_stain: { label: t.kindConditionStain, cls: 'bg-red-100 text-red-800' },
    condition_damag: { label: t.kindConditionDamage, cls: 'bg-orange-100 text-orange-800' },
    color: { label: t.kindColor, cls: 'bg-pink-100 text-pink-800' },
    note: { label: t.kindNote, cls: 'bg-gray-100 text-gray-700' },
  };
  const entry = map[kind ?? ''];
  if (!entry) return <Badge variant="outline">{kind ?? '—'}</Badge>;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${entry.cls}`}>{entry.label}</span>;
}

function ownerBadge(owner: string, t: OrdersPreferencesTabRprtProps['translations']) {
  if (owner === 'OVERRIDE')
    return <Badge variant="destructive" className="text-xs">{t.ownerOverride}</Badge>;
  return <Badge variant="secondary" className="text-xs">{t.ownerSystem}</Badge>;
}

function sourceLabel(source: string, t: OrdersPreferencesTabRprtProps['translations']) {
  const map: Record<string, string> = {
    ORDER_CREATE: t.sourceOrderCreate,
    MANUAL: t.sourceManual,
    ORDER_UPDATE: t.sourceOrderUpdate,
  };
  return map[source] ?? source;
}

function shortId(id: string | null) {
  if (!id) return '—';
  return id.slice(0, 8) + '…';
}

interface PrefGroupProps {
  prefs: OrderPreferenceRow[];
  title: string;
  icon: React.ReactNode;
  isRTL: boolean;
  currencyCode: string;
  locale: string;
  t: OrdersPreferencesTabRprtProps['translations'];
}

function PrefGroup({ prefs, title, icon, isRTL, currencyCode, locale, t }: PrefGroupProps) {
  if (prefs.length === 0) return null;

  const totalExtra = prefs.reduce((sum, p) => sum + p.extra_price, 0);
  const hasCharges = totalExtra > 0;

  return (
    <CmxCard>
      <CmxCardHeader className="pb-2">
        <CmxCardTitle className={`text-sm font-semibold flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {icon}
          <span>{title}</span>
          <span className="text-gray-400 font-normal text-xs">({prefs.length})</span>
          {hasCharges && (
            <span className={`${isRTL ? 'mr-auto' : 'ml-auto'} flex items-center gap-1 text-xs text-green-700 font-medium`}>
              <DollarSign className="w-3 h-3" />
              {t.totalExtraCharge}: {totalExtra.toLocaleString(locale === 'ar' ? 'ar' : 'en', { minimumFractionDigits: 2 })} {currencyCode}
            </span>
          )}
        </CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent className="pt-0 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className={`px-3 py-2 text-xs font-medium text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>#</th>
              <th className={`px-3 py-2 text-xs font-medium text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{t.prefCode}</th>
              <th className={`px-3 py-2 text-xs font-medium text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{t.prefKind}</th>
              <th className={`px-3 py-2 text-xs font-medium text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{t.owner}</th>
              <th className={`px-3 py-2 text-xs font-medium text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{t.source}</th>
              <th className={`px-3 py-2 text-xs font-medium text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{t.extraCharge}</th>
              {prefs[0].prefs_level === LEVEL_ITEM && (
                <th className={`px-3 py-2 text-xs font-medium text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{t.itemRef}</th>
              )}
              {prefs[0].prefs_level === LEVEL_PIECE && (
                <>
                  <th className={`px-3 py-2 text-xs font-medium text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{t.itemRef}</th>
                  <th className={`px-3 py-2 text-xs font-medium text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{t.pieceRef}</th>
                  <th className={`px-3 py-2 text-xs font-medium text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{t.confirmed}</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {prefs.map((pref) => (
              <tr key={pref.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className={`px-3 py-2 text-gray-500 tabular-nums ${isRTL ? 'text-right' : 'text-left'}`}>{pref.prefs_no}</td>
                <td className={`px-3 py-2 font-medium text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {pref.preference_code}
                  {pref.preference_category && (
                    <span className="text-gray-400 text-xs ms-1">({pref.preference_category})</span>
                  )}
                </td>
                <td className={`px-3 py-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {kindBadge(pref.preference_sys_kind, t)}
                </td>
                <td className={`px-3 py-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {ownerBadge(pref.prefs_owner_type, t)}
                </td>
                <td className={`px-3 py-2 text-xs text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {sourceLabel(pref.prefs_source, t)}
                </td>
                <td className={`px-3 py-2 tabular-nums ${isRTL ? 'text-right' : 'text-left'}`}>
                  {pref.extra_price > 0 ? (
                    <span className="text-green-700 font-medium">
                      +{pref.extra_price.toLocaleString(locale === 'ar' ? 'ar' : 'en', { minimumFractionDigits: 2 })} {currencyCode}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                {pref.prefs_level === LEVEL_ITEM && (
                  <td className={`px-3 py-2 text-xs text-gray-500 font-mono ${isRTL ? 'text-right' : 'text-left'}`}>
                    {shortId(pref.order_item_id)}
                  </td>
                )}
                {pref.prefs_level === LEVEL_PIECE && (
                  <>
                    <td className={`px-3 py-2 text-xs text-gray-500 font-mono ${isRTL ? 'text-right' : 'text-left'}`}>
                      {shortId(pref.order_item_id)}
                    </td>
                    <td className={`px-3 py-2 text-xs text-gray-500 font-mono ${isRTL ? 'text-right' : 'text-left'}`}>
                      {shortId(pref.order_item_piece_id)}
                    </td>
                    <td className={`px-3 py-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {pref.processing_confirmed ? (
                        <span className="inline-flex items-center gap-1 text-green-700 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {pref.confirmed_by ? <span className="text-gray-500">{pref.confirmed_by}</span> : null}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gray-400 text-xs">
                          <Clock className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </CmxCardContent>
    </CmxCard>
  );
}

export function OrdersPreferencesTabRprt({
  preferences,
  currencyCode,
  locale,
  translations: t,
}: OrdersPreferencesTabRprtProps) {
  const isRTL = useRTL();

  if (preferences.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
        <Settings2 className="w-12 h-12 mb-3 text-gray-300" />
        <p className="text-sm">{t.emptyPreferences}</p>
      </div>
    );
  }

  const orderLevel = preferences.filter((p) => p.prefs_level === LEVEL_ORDER);
  const itemLevel = preferences.filter((p) => p.prefs_level === LEVEL_ITEM);
  const pieceLevel = preferences.filter((p) => p.prefs_level === LEVEL_PIECE);

  const totalExtra = preferences.reduce((sum, p) => sum + p.extra_price, 0);
  const hasAnyCharge = totalExtra > 0;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className={`flex flex-wrap gap-4 items-center p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
        <span className="text-gray-600 font-medium">{preferences.length} {t.emptyPreferences.includes('No') ? 'preferences' : 'تفضيلات'}</span>
        <div className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {orderLevel.length > 0 && (
            <span className="inline-flex items-center gap-1 text-blue-700">
              <Layers className="w-3.5 h-3.5" />
              {t.levelOrder}: {orderLevel.length}
            </span>
          )}
          {itemLevel.length > 0 && (
            <span className="inline-flex items-center gap-1 text-purple-700">
              <Package className="w-3.5 h-3.5" />
              {t.levelItem}: {itemLevel.length}
            </span>
          )}
          {pieceLevel.length > 0 && (
            <span className="inline-flex items-center gap-1 text-orange-700">
              <Settings2 className="w-3.5 h-3.5" />
              {t.levelPiece}: {pieceLevel.length}
            </span>
          )}
        </div>
        {hasAnyCharge && (
          <span className={`${isRTL ? 'mr-auto' : 'ml-auto'} flex items-center gap-1 font-semibold text-green-700`}>
            <DollarSign className="w-4 h-4" />
            {t.totalExtraCharge}: {totalExtra.toLocaleString(locale === 'ar' ? 'ar' : 'en', { minimumFractionDigits: 2 })} {currencyCode}
          </span>
        )}
      </div>

      {/* Groups */}
      <PrefGroup
        prefs={orderLevel}
        title={t.orderLevelPrefs}
        icon={<Layers className="w-4 h-4 text-blue-500" />}
        isRTL={isRTL}
        currencyCode={currencyCode}
        locale={locale}
        t={t}
      />
      <PrefGroup
        prefs={itemLevel}
        title={t.itemLevelPrefs}
        icon={<Package className="w-4 h-4 text-purple-500" />}
        isRTL={isRTL}
        currencyCode={currencyCode}
        locale={locale}
        t={t}
      />
      <PrefGroup
        prefs={pieceLevel}
        title={t.pieceLevelPrefs}
        icon={<Settings2 className="w-4 h-4 text-orange-500" />}
        isRTL={isRTL}
        currencyCode={currencyCode}
        locale={locale}
        t={t}
      />
    </div>
  );
}

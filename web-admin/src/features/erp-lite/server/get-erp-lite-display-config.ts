import 'server-only'

import { getLocale } from 'next-intl/server'
import { getCurrencyConfigAction } from '@/app/actions/tenant/get-currency-config'
import { getAuthContext } from '@/lib/auth/server-auth'
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults'
import type { ErpLiteDisplayConfig } from '../lib/display-format'

export async function getErpLiteDisplayConfig(): Promise<ErpLiteDisplayConfig> {
  const locale = (await getLocale()) === 'ar' ? 'ar' : 'en'

  try {
    const authContext = await getAuthContext()
    const currencyConfig = await getCurrencyConfigAction(authContext.tenantId)

    return {
      locale,
      currencyCode: currencyConfig.currencyCode,
      decimalPlaces: currencyConfig.decimalPlaces,
    }
  } catch {
    return {
      locale,
      currencyCode: ORDER_DEFAULTS.CURRENCY,
      decimalPlaces: ORDER_DEFAULTS.PRICE.DECIMAL_PLACES,
    }
  }
}

'use server';

/**
 * Read-only FX converter server action (Tenant_Currency_FX plan 01 §7.2,
 * "Converter" tab). Composes the already-tested `resolveRate` +
 * `convertMinor`/`formatMinor` (`fx-decimal.ts`) — no new conversion math is
 * introduced here, and `fx-decimal.ts` itself is never edited (it is a
 * byte-identical, checksum-verified port of the HQ copy).
 */

import { getAuthContext } from '@/lib/auth/server-auth';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { prisma } from '@/lib/db/prisma';
import { resolveRate } from '@/lib/services/fx/fx-rate-resolver.service';
import { convertMinor, formatMinor } from '@/lib/services/fx/fx-decimal';
import { FxError } from '@/lib/services/fx/fx-errors';
import { CURRENCY_FX_PERMISSIONS } from '@/lib/constants/permissions/currency-fx-perm';

interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

export interface ConvertAmountInput {
  fromCurrency: string;
  toCurrency: string;
  /** Major-unit decimal string, e.g. "10.000". */
  amount: string;
  rateType?: string;
}

export interface ConvertAmountResult {
  convertedAmount: string;
  rate: string;
  resolution: string;
  book: string | null;
  rateDate: string | null;
  stale: boolean;
}

const MAJOR_AMOUNT_PATTERN = /^\d{1,15}(\.\d{1,6})?$/;

/** Parses a major-unit decimal string into an integer number of minor units, at the given currency's precision. */
function parseMajorToMinor(amount: string, minorUnit: number): bigint {
  const trimmed = amount.trim();
  if (!MAJOR_AMOUNT_PATTERN.test(trimmed)) {
    throw new RangeError(`Invalid amount "${amount}"`);
  }
  const [intPart, fracPart = ''] = trimmed.split('.');
  if (fracPart.length > minorUnit) {
    throw new RangeError(`Amount "${amount}" has more than ${minorUnit} fraction digits for this currency`);
  }
  return BigInt(intPart) * 10n ** BigInt(minorUnit) + BigInt(fracPart.padEnd(minorUnit, '0') || '0');
}

export async function convertAmountAction(input: ConvertAmountInput): Promise<ActionResult<ConvertAmountResult>> {
  try {
    const { tenantId } = await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.FX_RATES_VIEW))) {
      return { success: false, error: 'Forbidden' };
    }

    const [fromCcy, toCcy] = await Promise.all([
      prisma.sys_currency_cd.findUnique({ where: { code: input.fromCurrency }, select: { minor_unit: true } }),
      prisma.sys_currency_cd.findUnique({ where: { code: input.toCurrency }, select: { minor_unit: true } }),
    ]);
    if (!fromCcy || !toCcy) {
      return { success: false, error: 'Unknown currency' };
    }

    const resolved = await resolveRate(tenantId, { from: input.fromCurrency, to: input.toCurrency, rateType: input.rateType });
    const amountMinor = parseMajorToMinor(input.amount, fromCcy.minor_unit);
    const { targetMinor } = convertMinor({
      amountMinor,
      rateScaled: resolved.rateScaled,
      fromMinorUnit: fromCcy.minor_unit,
      toMinorUnit: toCcy.minor_unit,
      mode: 'HALF_UP',
    });

    return {
      success: true,
      data: {
        convertedAmount: formatMinor(targetMinor, toCcy.minor_unit),
        rate: resolved.rate,
        resolution: resolved.resolution,
        book: resolved.book,
        rateDate: resolved.rateDate,
        stale: resolved.stale,
      },
    };
  } catch (error) {
    if (error instanceof FxError) return { success: false, error: error.message, errorCode: error.code };
    if (error instanceof RangeError) return { success: false, error: error.message };
    return { success: false, error: error instanceof Error ? error.message : 'Failed to convert amount' };
  }
}

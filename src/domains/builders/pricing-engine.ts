// ============================================================
// Story 11-6: Bulk Pricing & Discount Engine
// Pure function module — no database dependencies
// All money as BigInt paise. No floating point.
// ============================================================

import { PricingLineItem, BulkPricingBreakdown } from './builders.types';

/** Standard discount tiers — matched against unit count */
export const DISCOUNT_TIERS = [
  { min: 50, max: Infinity, pct: 25, name: '50+' },
  { min: 20, max: 49, pct: 20, name: '20-49' },
  { min: 10, max: 19, pct: 10, name: '10-19' },
  { min: 1, max: 9, pct: 0, name: '1-9' },
] as const;

/**
 * Returns the discount tier for a given unit count.
 * Unit count of 0 returns the 1-9 tier (0% discount).
 */
export function getDiscountTier(unitCount: number): (typeof DISCOUNT_TIERS)[number] {
  const tier = DISCOUNT_TIERS.find((t) => unitCount >= t.min && unitCount <= t.max);
  return tier ?? DISCOUNT_TIERS[DISCOUNT_TIERS.length - 1];
}

/**
 * Shorthand to get just the discount percentage.
 */
export function calculateBulkDiscount(unitCount: number): number {
  return getDiscountTier(unitCount).pct;
}

/**
 * Calculates the full bulk pricing breakdown.
 *
 * AC3 (Story 11-6): Discount applies only to service fees, NOT government fees.
 * Government fees are pass-through at cost.
 *
 * All calculations use BigInt integer arithmetic — never floating point.
 */
export function calculateBulkPricingBreakdown(
  lineItems: PricingLineItem[],
  unitCount: number,
  customDiscountPct?: number
): BulkPricingBreakdown {
  const perUnitServiceFeePaise = lineItems.reduce(
    (sum, item) => sum + item.baseFeePaise,
    BigInt(0)
  );
  const perUnitGovtFeePaise = lineItems.reduce(
    (sum, item) => sum + item.govtFeeEstimatePaise,
    BigInt(0)
  );

  const totalServiceFeePaise = perUnitServiceFeePaise * BigInt(unitCount);
  const totalGovtFeePaise = perUnitGovtFeePaise * BigInt(unitCount);

  const tier = getDiscountTier(unitCount);
  const discountPct = customDiscountPct ?? tier.pct;

  // Integer division: discount = total * pct / 100
  const discountAmountPaise = (totalServiceFeePaise * BigInt(discountPct)) / BigInt(100);
  const finalServiceFeePaise = totalServiceFeePaise - discountAmountPaise;
  const grandTotalPaise = finalServiceFeePaise + totalGovtFeePaise;

  return {
    unitCount,
    lineItems,
    perUnitServiceFeePaise,
    perUnitGovtFeePaise,
    totalServiceFeePaise,
    totalGovtFeePaise,
    discountTierName: customDiscountPct !== undefined ? 'custom' : tier.name,
    discountPct,
    discountAmountPaise,
    finalServiceFeePaise,
    grandTotalPaise,
  };
}

/**
 * Simplified pricing calculator used during Story 11-3 bulk preview.
 * Compatible with the Story 11-3 bulk-pricing.ts interface.
 */
export function calculateBulkPricing(
  services: { baseFeePaise: bigint; govtFeeEstimateMinPaise: bigint }[],
  unitCount: number,
  customDiscountPct?: number
) {
  const lineItems: PricingLineItem[] = services.map((s, i) => ({
    serviceId: `svc-${i}`,
    serviceName: '',
    baseFeePaise: s.baseFeePaise,
    govtFeeEstimatePaise: s.govtFeeEstimateMinPaise,
  }));
  return calculateBulkPricingBreakdown(lineItems, unitCount, customDiscountPct);
}

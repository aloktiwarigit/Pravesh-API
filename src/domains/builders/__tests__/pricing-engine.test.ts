// ============================================================
// Story 11-6: Bulk Pricing & Discount Engine — Tests
// All money as BigInt paise. No floating point.
// ============================================================

import {
  getDiscountTier,
  calculateBulkDiscount,
  calculateBulkPricingBreakdown,
  DISCOUNT_TIERS,
} from '../pricing-engine';
import { PricingLineItem } from '../builders.types';

describe('Pricing Engine', () => {
  describe('getDiscountTier', () => {
    it('returns 0% for fewer than 10 units', () => {
      expect(getDiscountTier(5).pct).toBe(0);
      expect(getDiscountTier(1).pct).toBe(0);
      expect(getDiscountTier(9).pct).toBe(0);
    });

    it('returns 10% for 10-19 units', () => {
      expect(getDiscountTier(10).pct).toBe(10);
      expect(getDiscountTier(15).pct).toBe(10);
      expect(getDiscountTier(19).pct).toBe(10);
    });

    it('returns 20% for 20-49 units', () => {
      expect(getDiscountTier(20).pct).toBe(20);
      expect(getDiscountTier(35).pct).toBe(20);
      expect(getDiscountTier(49).pct).toBe(20);
    });

    it('returns 25% for 50+ units', () => {
      expect(getDiscountTier(50).pct).toBe(25);
      expect(getDiscountTier(100).pct).toBe(25);
      expect(getDiscountTier(500).pct).toBe(25);
    });
  });

  describe('calculateBulkDiscount', () => {
    it('returns correct discount percentage', () => {
      expect(calculateBulkDiscount(5)).toBe(0);
      expect(calculateBulkDiscount(10)).toBe(10);
      expect(calculateBulkDiscount(20)).toBe(20);
      expect(calculateBulkDiscount(50)).toBe(25);
    });
  });

  describe('calculateBulkPricingBreakdown', () => {
    const lineItems: PricingLineItem[] = [
      {
        serviceId: 'svc-mutation',
        serviceName: 'Mutation',
        baseFeePaise: BigInt(1500000), // Rs. 15,000
        govtFeeEstimatePaise: BigInt(500000), // Rs. 5,000
      },
      {
        serviceId: 'svc-title-search',
        serviceName: 'Title Search',
        baseFeePaise: BigInt(800000), // Rs. 8,000
        govtFeeEstimatePaise: BigInt(200000), // Rs. 2,000
      },
      {
        serviceId: 'svc-encumbrance',
        serviceName: 'Encumbrance Certificate',
        baseFeePaise: BigInt(500000), // Rs. 5,000
        govtFeeEstimatePaise: BigInt(100000), // Rs. 1,000
      },
    ];

    it('calculates correct totals for 48 units x 3 services at 20% discount', () => {
      const result = calculateBulkPricingBreakdown(lineItems, 48);

      // Per unit: 15,000 + 8,000 + 5,000 = 28,000 => 2800000 paise
      expect(result.perUnitServiceFeePaise).toBe(BigInt(2800000));

      // Per unit govt: 5,000 + 2,000 + 1,000 = 8,000 => 800000 paise
      expect(result.perUnitGovtFeePaise).toBe(BigInt(800000));

      // Total service fees: 2800000 x 48 = 134400000 paise
      expect(result.totalServiceFeePaise).toBe(BigInt(134400000));

      // Total govt fees: 800000 x 48 = 38400000 paise
      expect(result.totalGovtFeePaise).toBe(BigInt(38400000));

      // 48 units => 20% discount tier
      expect(result.discountPct).toBe(20);
      expect(result.discountTierName).toBe('20-49');

      // Discount: 134400000 * 20 / 100 = 26880000 paise
      expect(result.discountAmountPaise).toBe(BigInt(26880000));

      // Final service fee: 134400000 - 26880000 = 107520000 paise
      expect(result.finalServiceFeePaise).toBe(BigInt(107520000));

      // Grand total: 107520000 + 38400000 = 145920000 paise
      expect(result.grandTotalPaise).toBe(BigInt(145920000));
    });

    it('applies discount only to service fees, not govt fees', () => {
      const result = calculateBulkPricingBreakdown(lineItems, 48);

      // Govt fees should be untouched
      expect(result.totalGovtFeePaise).toBe(
        BigInt(800000) * BigInt(48)
      );

      // Grand total = discounted service fees + full govt fees
      expect(result.grandTotalPaise).toBe(
        result.finalServiceFeePaise + result.totalGovtFeePaise
      );
    });

    it('uses custom discount when provided', () => {
      const result = calculateBulkPricingBreakdown(lineItems, 48, 30);

      expect(result.discountPct).toBe(30);
      expect(result.discountTierName).toBe('custom');

      // 30% of 134400000 = 40320000
      expect(result.discountAmountPaise).toBe(BigInt(40320000));
    });

    it('returns 0% discount for fewer than 10 units', () => {
      const result = calculateBulkPricingBreakdown(lineItems, 5);

      expect(result.discountPct).toBe(0);
      expect(result.discountAmountPaise).toBe(BigInt(0));
      expect(result.finalServiceFeePaise).toBe(result.totalServiceFeePaise);
    });

    it('uses only BigInt calculations — no floating point', () => {
      const result = calculateBulkPricingBreakdown(lineItems, 48);

      // All values should be BigInt
      expect(typeof result.perUnitServiceFeePaise).toBe('bigint');
      expect(typeof result.totalServiceFeePaise).toBe('bigint');
      expect(typeof result.discountAmountPaise).toBe('bigint');
      expect(typeof result.finalServiceFeePaise).toBe('bigint');
      expect(typeof result.grandTotalPaise).toBe('bigint');
    });
  });
});

// Story 13-14: NRI SLA Extension Configuration

// NRI SLA multiplier: extend standard SLAs by this factor
export const NRI_SLA_MULTIPLIER = 1.5; // 50% extra time

// Additional days for POA-related services
export const POA_PROCESSING_DAYS = 14;

// Maximum SLA extension (in days)
export const MAX_NRI_SLA_EXTENSION_DAYS = 30;

/**
 * Calculate the extended SLA for NRI service requests.
 *
 * @param standardSlaDays - The standard SLA in days for domestic customers
 * @param requiresPoa - Whether the service requires a Power of Attorney
 * @returns The adjusted SLA in days for NRI customers
 */
export function calculateNriSla(
  standardSlaDays: number,
  requiresPoa: boolean
): number {
  let slaDays = Math.ceil(standardSlaDays * NRI_SLA_MULTIPLIER);
  if (requiresPoa) {
    slaDays += POA_PROCESSING_DAYS;
  }
  return Math.min(
    slaDays,
    standardSlaDays + MAX_NRI_SLA_EXTENSION_DAYS
  );
}

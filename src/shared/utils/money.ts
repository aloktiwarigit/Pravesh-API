/**
 * Money utilities — all monetary values stored as paise (integer, smallest unit).
 * NEVER use floating point for money calculations.
 */

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function calculatePercentage(amountPaise: number, percentage: number): number {
  return Math.round(amountPaise * percentage / 100);
}

export function formatPaiseForDisplay(paise: number): string {
  const rupees = paiseToRupees(paise);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rupees);
}

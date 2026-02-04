// Story 13-1: NRI Bank Configuration for International UPI Payments

export const NRI_UPI_BANKS = [
  { code: 'ICICI', name: 'ICICI Bank NRI', upiSuffix: '@icici' },
  { code: 'HDFC', name: 'HDFC Bank NRI', upiSuffix: '@hdfcbank' },
  { code: 'AXIS', name: 'Axis Bank NRI', upiSuffix: '@axisbank' },
  { code: 'SBI', name: 'State Bank of India NRI', upiSuffix: '@sbi' },
] as const;

export const SUPPORTED_CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'GBP', symbol: '\u00a3', name: 'British Pound' },
  { code: 'AED', symbol: '\u062f.\u0625', name: 'UAE Dirham' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'EUR', symbol: '\u20ac', name: 'Euro' },
] as const;

export type SupportedCurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]['code'];

export function isValidUpiId(upiId: string): boolean {
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
  return upiRegex.test(upiId);
}

export function isNriBankSupported(upiId: string): boolean {
  const suffix = '@' + upiId.split('@')[1];
  return NRI_UPI_BANKS.some((bank) => bank.upiSuffix === suffix);
}

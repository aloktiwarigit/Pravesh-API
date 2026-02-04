// Story 13-14: NRI Auto-Detection Service
const INDIA_COUNTRY_CODE = '+91';

const INTERNATIONAL_CODES: Record<string, string> = {
  '+1': 'United States / Canada',
  '+44': 'United Kingdom',
  '+971': 'United Arab Emirates',
  '+65': 'Singapore',
  '+61': 'Australia',
  '+49': 'Germany',
  '+33': 'France',
  '+81': 'Japan',
  '+852': 'Hong Kong',
  '+966': 'Saudi Arabia',
  '+968': 'Oman',
  '+974': 'Qatar',
  '+973': 'Bahrain',
  '+60': 'Malaysia',
  '+64': 'New Zealand',
  '+41': 'Switzerland',
  '+31': 'Netherlands',
  '+353': 'Ireland',
  '+46': 'Sweden',
  '+47': 'Norway',
};

export class NriDetectionService {
  static isNriPhone(phone: string): boolean {
    // A phone that does not start with India code is considered NRI
    return (
      !phone.startsWith(INDIA_COUNTRY_CODE) &&
      !phone.startsWith('91') &&
      !phone.startsWith('0')
    );
  }

  static getCountryFromPhone(
    phone: string
  ): { code: string; country: string } | null {
    // Sort by code length descending to match longer codes first (e.g., +852 before +8)
    const sortedCodes = Object.entries(INTERNATIONAL_CODES).sort(
      (a, b) => b[0].length - a[0].length
    );

    for (const [code, country] of sortedCodes) {
      if (phone.startsWith(code)) {
        return { code, country };
      }
    }
    return null;
  }

  static getAllSupportedCountries(): {
    code: string;
    country: string;
  }[] {
    return Object.entries(INTERNATIONAL_CODES).map(
      ([code, country]) => ({
        code,
        country,
      })
    );
  }
}

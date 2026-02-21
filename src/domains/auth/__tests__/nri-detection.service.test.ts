/**
 * Tests for NriDetectionService covering phone-based NRI detection,
 * country lookup, and supported countries listing.
 */
import { describe, test, expect } from 'vitest';
import { NriDetectionService } from '../nri-detection.service';

describe('NriDetectionService', () => {
  // ============================================================
  // isNriPhone
  // ============================================================

  describe('isNriPhone', () => {
    test('returns false for Indian +91 prefix', () => {
      expect(NriDetectionService.isNriPhone('+919876543210')).toBe(false);
    });

    test('returns false for 91 prefix without plus', () => {
      expect(NriDetectionService.isNriPhone('919876543210')).toBe(false);
    });

    test('returns false for 0-prefixed Indian numbers', () => {
      expect(NriDetectionService.isNriPhone('09876543210')).toBe(false);
    });

    test('returns true for US/Canada +1 prefix', () => {
      expect(NriDetectionService.isNriPhone('+14155551234')).toBe(true);
    });

    test('returns true for UK +44 prefix', () => {
      expect(NriDetectionService.isNriPhone('+442071234567')).toBe(true);
    });

    test('returns true for UAE +971 prefix', () => {
      expect(NriDetectionService.isNriPhone('+971501234567')).toBe(true);
    });

    test('returns true for Singapore +65 prefix', () => {
      expect(NriDetectionService.isNriPhone('+6591234567')).toBe(true);
    });

    test('returns true for Australia +61 prefix', () => {
      expect(NriDetectionService.isNriPhone('+61412345678')).toBe(true);
    });

    test('returns true for unknown international number', () => {
      expect(NriDetectionService.isNriPhone('+861234567890')).toBe(true);
    });

    test('returns true for number starting with +', () => {
      expect(NriDetectionService.isNriPhone('+4917612345678')).toBe(true);
    });

    test('returns false for plain 10-digit Indian number starting with 0', () => {
      expect(NriDetectionService.isNriPhone('01234567890')).toBe(false);
    });
  });

  // ============================================================
  // getCountryFromPhone
  // ============================================================

  describe('getCountryFromPhone', () => {
    test('identifies US/Canada from +1 prefix', () => {
      const result = NriDetectionService.getCountryFromPhone('+14155551234');
      expect(result).toEqual({ code: '+1', country: 'United States / Canada' });
    });

    test('identifies UK from +44 prefix', () => {
      const result = NriDetectionService.getCountryFromPhone('+442071234567');
      expect(result).toEqual({ code: '+44', country: 'United Kingdom' });
    });

    test('identifies UAE from +971 prefix', () => {
      const result = NriDetectionService.getCountryFromPhone('+971501234567');
      expect(result).toEqual({ code: '+971', country: 'United Arab Emirates' });
    });

    test('identifies Singapore from +65 prefix', () => {
      const result = NriDetectionService.getCountryFromPhone('+6591234567');
      expect(result).toEqual({ code: '+65', country: 'Singapore' });
    });

    test('identifies Australia from +61 prefix', () => {
      const result = NriDetectionService.getCountryFromPhone('+61412345678');
      expect(result).toEqual({ code: '+61', country: 'Australia' });
    });

    test('identifies Germany from +49 prefix', () => {
      const result = NriDetectionService.getCountryFromPhone('+4917612345678');
      expect(result).toEqual({ code: '+49', country: 'Germany' });
    });

    test('identifies Hong Kong from +852 prefix', () => {
      const result = NriDetectionService.getCountryFromPhone('+85212345678');
      expect(result).toEqual({ code: '+852', country: 'Hong Kong' });
    });

    test('identifies Saudi Arabia from +966 prefix', () => {
      const result = NriDetectionService.getCountryFromPhone('+966501234567');
      expect(result).toEqual({ code: '+966', country: 'Saudi Arabia' });
    });

    test('identifies Qatar from +974 prefix', () => {
      const result = NriDetectionService.getCountryFromPhone('+97412345678');
      expect(result).toEqual({ code: '+974', country: 'Qatar' });
    });

    test('identifies Bahrain from +973 prefix', () => {
      const result = NriDetectionService.getCountryFromPhone('+97312345678');
      expect(result).toEqual({ code: '+973', country: 'Bahrain' });
    });

    test('returns null for unrecognized country code', () => {
      const result = NriDetectionService.getCountryFromPhone('+861234567890');
      expect(result).toBeNull();
    });

    test('returns null for Indian number', () => {
      const result = NriDetectionService.getCountryFromPhone('+919876543210');
      expect(result).toBeNull();
    });

    test('matches longer codes first (e.g., +852 before +8)', () => {
      // Hong Kong +852 should be matched, not some hypothetical +8 code
      const result = NriDetectionService.getCountryFromPhone('+85298765432');
      expect(result).toEqual({ code: '+852', country: 'Hong Kong' });
    });
  });

  // ============================================================
  // getAllSupportedCountries
  // ============================================================

  describe('getAllSupportedCountries', () => {
    test('returns all supported countries', () => {
      const countries = NriDetectionService.getAllSupportedCountries();

      expect(countries.length).toBeGreaterThan(0);
      expect(countries).toContainEqual({ code: '+1', country: 'United States / Canada' });
      expect(countries).toContainEqual({ code: '+44', country: 'United Kingdom' });
      expect(countries).toContainEqual({ code: '+971', country: 'United Arab Emirates' });
    });

    test('each entry has code and country fields', () => {
      const countries = NriDetectionService.getAllSupportedCountries();

      for (const entry of countries) {
        expect(entry).toHaveProperty('code');
        expect(entry).toHaveProperty('country');
        expect(typeof entry.code).toBe('string');
        expect(typeof entry.country).toBe('string');
        expect(entry.code.startsWith('+')).toBe(true);
      }
    });

    test('returns correct number of supported countries', () => {
      const countries = NriDetectionService.getAllSupportedCountries();
      // Based on the source, there are 20 country codes
      expect(countries.length).toBe(20);
    });
  });
});

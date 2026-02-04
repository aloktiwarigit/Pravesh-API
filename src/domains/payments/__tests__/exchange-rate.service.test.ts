/**
 * [P1] Tests for exchange rate service - Currency conversion
 * Story 13-3: Multi-Currency Display & Conversion
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ExchangeRateService } from '../exchange-rate.service.js';

// Mock Prisma
vi.mock('@prisma/client', () => {
  const mockPrisma = {
    exchangeRateSnapshot: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
  };
  return {
    PrismaClient: vi.fn(() => mockPrisma),
  };
});

describe('[P1] ExchangeRateService - Currency Conversion', () => {
  let service: ExchangeRateService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    service = new ExchangeRateService(mockPrisma);
    vi.clearAllMocks();
    delete process.env.EXCHANGE_RATE_API_KEY;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('convertFromInr with known rate calculates correct amount', async () => {
    // Given
    const amountPaise = 8350; // 83.50 INR
    const targetCurrency = 'USD';

    // Mock fallback rates (83.5 INR per 1 USD)
    vi.spyOn(service as any, 'getFallbackRates').mockReturnValue({
      USD: 83.5,
      GBP: 106.0,
      AED: 22.7,
      SGD: 62.5,
      CAD: 61.8,
      AUD: 54.5,
      EUR: 91.0,
    });

    // When
    const result = await service.convertFromInr(amountPaise, targetCurrency);

    // Then
    // 83.50 INR / 83.5 (rate) = 1.00 USD
    expect(result.foreignAmount).toBe(1.00);
    expect(result.exchangeRate).toBe(83.5);
    expect(result.disclaimer).toBe('Exchange rates are indicative and subject to change at payment time.');
  });

  test('convertFromInr rounds to 2 decimal places', async () => {
    // Given
    const amountPaise = 10000; // 100.00 INR
    const targetCurrency = 'USD';

    vi.spyOn(service as any, 'getFallbackRates').mockReturnValue({
      USD: 83.5,
    });

    // When
    const result = await service.convertFromInr(amountPaise, targetCurrency);

    // Then
    // 100.00 INR / 83.5 = 1.1976... USD, rounded to 1.20
    expect(result.foreignAmount).toBe(1.20);
  });

  test('convertFromInr with different currencies uses correct rates', async () => {
    // Given
    const amountPaise = 10600; // 106.00 INR
    const targetCurrency = 'GBP';

    vi.spyOn(service as any, 'getFallbackRates').mockReturnValue({
      GBP: 106.0,
    });

    // When
    const result = await service.convertFromInr(amountPaise, targetCurrency);

    // Then
    // 106.00 INR / 106.0 (rate) = 1.00 GBP
    expect(result.foreignAmount).toBe(1.00);
    expect(result.exchangeRate).toBe(106.0);
  });

  test('convertFromInr throws error for unsupported currency', async () => {
    // Given
    const amountPaise = 10000;
    const unsupportedCurrency = 'JPY';

    vi.spyOn(service as any, 'getFallbackRates').mockReturnValue({
      USD: 83.5,
    });

    // When & Then
    await expect(
      service.convertFromInr(amountPaise, unsupportedCurrency)
    ).rejects.toThrow('Unsupported currency: JPY');
  });
});

describe('[P1] ExchangeRateService - Rate Caching', () => {
  let service: ExchangeRateService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    service = new ExchangeRateService(mockPrisma);
    vi.clearAllMocks();
    delete process.env.EXCHANGE_RATE_API_KEY;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('getRates returns cached rates within TTL (24 hours)', async () => {
    // Given
    vi.useFakeTimers();
    const now = new Date('2025-01-15T10:00:00Z');
    vi.setSystemTime(now);

    const cachedRates = { USD: 83.5, GBP: 106.0 };
    (service as any).cache = {
      rates: cachedRates,
      fetchedAt: new Date('2025-01-15T09:00:00Z'), // 1 hour ago
    };

    // When
    const result = await service.getRates();

    // Then
    expect(result).toEqual(cachedRates);
    expect(mockPrisma.exchangeRateSnapshot.create).not.toHaveBeenCalled();
  });

  test('getRates refreshes when cache exceeds TTL', async () => {
    // Given
    vi.useFakeTimers();
    const now = new Date('2025-01-16T10:00:00Z');
    vi.setSystemTime(now);

    (service as any).cache = {
      rates: { USD: 80.0 },
      fetchedAt: new Date('2025-01-15T09:00:00Z'), // 25 hours ago (exceeded TTL)
    };

    vi.spyOn(service, 'refreshRates').mockResolvedValue({ USD: 83.5 });

    // When
    const result = await service.getRates();

    // Then
    expect(service.refreshRates).toHaveBeenCalled();
    expect(result).toEqual({ USD: 83.5 });
  });

  test('getRates calls refreshRates when cache is null', async () => {
    // Given
    (service as any).cache = null;
    vi.spyOn(service, 'refreshRates').mockResolvedValue({ USD: 83.5 });

    // When
    const result = await service.getRates();

    // Then
    expect(service.refreshRates).toHaveBeenCalled();
    expect(result).toEqual({ USD: 83.5 });
  });
});

describe('[P1] ExchangeRateService - API Integration', () => {
  let service: ExchangeRateService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    service = new ExchangeRateService(mockPrisma);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.EXCHANGE_RATE_API_KEY;
  });

  test('refreshRates inverts API rates correctly (INR→USD to USD→INR)', async () => {
    // Given
    process.env.EXCHANGE_RATE_API_KEY = 'test_api_key_123';

    const mockApiResponse = {
      conversion_rates: {
        USD: 0.012, // 1 INR = 0.012 USD
        GBP: 0.0095, // 1 INR = 0.0095 GBP
        EUR: 0.011, // 1 INR = 0.011 EUR
        AED: 0.044,
        SGD: 0.016,
        CAD: 0.0162,
        AUD: 0.0184,
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      json: async () => mockApiResponse,
    });

    mockPrisma.exchangeRateSnapshot.create.mockResolvedValue({});

    // When
    const result = await service.refreshRates();

    // Then
    // Rate inversion: 1 / 0.012 = 83.333... (how many INR per 1 USD)
    expect(result.USD).toBeCloseTo(83.333, 2);
    // 1 / 0.0095 = 105.263... (how many INR per 1 GBP)
    expect(result.GBP).toBeCloseTo(105.263, 2);
  });

  test('refreshRates caches fetched rates', async () => {
    // Given
    process.env.EXCHANGE_RATE_API_KEY = 'test_api_key';

    const mockApiResponse = {
      conversion_rates: {
        USD: 0.012,
        GBP: 0.0095,
        EUR: 0.011,
        AED: 0.044,
        SGD: 0.016,
        CAD: 0.0162,
        AUD: 0.0184,
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      json: async () => mockApiResponse,
    });

    mockPrisma.exchangeRateSnapshot.create.mockResolvedValue({});

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T10:00:00Z'));

    // When
    await service.refreshRates();

    // Then
    const cache = (service as any).cache;
    expect(cache).not.toBeNull();
    expect(cache.rates.USD).toBeCloseTo(83.333, 2);
    expect(cache.fetchedAt).toEqual(new Date('2025-01-15T10:00:00Z'));
  });

  test('refreshRates persists to database for audit', async () => {
    // Given
    process.env.EXCHANGE_RATE_API_KEY = 'test_api_key';

    const mockApiResponse = {
      conversion_rates: {
        USD: 0.012,
        GBP: 0.0095,
        EUR: 0.011,
        AED: 0.044,
        SGD: 0.016,
        CAD: 0.0162,
        AUD: 0.0184,
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      json: async () => mockApiResponse,
    });

    mockPrisma.exchangeRateSnapshot.create.mockResolvedValue({});

    // When
    await service.refreshRates();

    // Then
    expect(mockPrisma.exchangeRateSnapshot.create).toHaveBeenCalledWith({
      data: {
        id: expect.any(String),
        rates: expect.objectContaining({
          USD: expect.any(Number),
          GBP: expect.any(Number),
        }),
        fetchedAt: expect.any(Date),
      },
    });
  });
});

describe('[P1] ExchangeRateService - Fallback Handling', () => {
  let service: ExchangeRateService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    service = new ExchangeRateService(mockPrisma);
    vi.clearAllMocks();
  });

  test('refreshRates uses fallback rates when API key not configured', async () => {
    // Given
    delete process.env.EXCHANGE_RATE_API_KEY;

    // When
    const result = await service.refreshRates();

    // Then
    expect(result).toEqual({
      USD: 83.5,
      GBP: 106.0,
      AED: 22.7,
      SGD: 62.5,
      CAD: 61.8,
      AUD: 54.5,
      EUR: 91.0,
    });
  });

  test('refreshRates falls back to DB rates on API failure', async () => {
    // Given
    process.env.EXCHANGE_RATE_API_KEY = 'test_api_key';

    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const dbRates = {
      USD: 84.0,
      GBP: 107.0,
      EUR: 92.0,
      AED: 23.0,
      SGD: 63.0,
      CAD: 62.0,
      AUD: 55.0,
    };

    mockPrisma.exchangeRateSnapshot.findFirst.mockResolvedValue({
      id: 'snapshot_1',
      rates: dbRates,
      fetchedAt: new Date('2025-01-14T10:00:00Z'),
    });

    // When
    const result = await service.refreshRates();

    // Then
    expect(result).toEqual(dbRates);
    expect(mockPrisma.exchangeRateSnapshot.findFirst).toHaveBeenCalledWith({
      orderBy: { fetchedAt: 'desc' },
    });
  });

  test('refreshRates uses hardcoded fallback when API fails and no DB rates exist', async () => {
    // Given
    process.env.EXCHANGE_RATE_API_KEY = 'test_api_key';

    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    mockPrisma.exchangeRateSnapshot.findFirst.mockResolvedValue(null);

    // When
    const result = await service.refreshRates();

    // Then
    expect(result).toEqual({
      USD: 83.5,
      GBP: 106.0,
      AED: 22.7,
      SGD: 62.5,
      CAD: 61.8,
      AUD: 54.5,
      EUR: 91.0,
    });
  });

  test('refreshRates caches DB fallback rates', async () => {
    // Given
    process.env.EXCHANGE_RATE_API_KEY = 'test_api_key';

    global.fetch = vi.fn().mockRejectedValue(new Error('API down'));

    const dbRates = { USD: 84.0, GBP: 107.0, EUR: 92.0, AED: 23.0, SGD: 63.0, CAD: 62.0, AUD: 55.0 };
    const fetchedAt = new Date('2025-01-14T10:00:00Z');

    mockPrisma.exchangeRateSnapshot.findFirst.mockResolvedValue({
      rates: dbRates,
      fetchedAt,
    });

    // When
    await service.refreshRates();

    // Then
    const cache = (service as any).cache;
    expect(cache.rates).toEqual(dbRates);
    expect(cache.fetchedAt).toEqual(fetchedAt);
  });
});

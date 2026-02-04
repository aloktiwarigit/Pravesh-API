// Story 13-3: Multi-Currency Display & Conversion - Exchange Rate Service
import { PrismaClient } from '@prisma/client';

interface ExchangeRates {
  [currency: string]: number; // rate: how many INR per 1 unit of foreign currency
}

export class ExchangeRateService {
  private cache: { rates: ExchangeRates; fetchedAt: Date } | null = null;
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(private prisma: PrismaClient) {}

  async getRates(): Promise<ExchangeRates> {
    if (
      this.cache &&
      Date.now() - this.cache.fetchedAt.getTime() < this.CACHE_TTL_MS
    ) {
      return this.cache.rates;
    }
    return this.refreshRates();
  }

  async refreshRates(): Promise<ExchangeRates> {
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    if (!apiKey) {
      // Return fallback rates if no API key configured
      return this.getFallbackRates();
    }

    try {
      const response = await fetch(
        `https://v6.exchangerate-api.com/v6/${apiKey}/latest/INR`
      );
      const data = (await response.json()) as {
        conversion_rates: Record<string, number>;
      };

      // Convert: API gives INR->X rate, we want X->INR rate (how many INR per 1 foreign unit)
      const rates: ExchangeRates = {
        USD: 1 / data.conversion_rates.USD,
        GBP: 1 / data.conversion_rates.GBP,
        AED: 1 / data.conversion_rates.AED,
        SGD: 1 / data.conversion_rates.SGD,
        CAD: 1 / data.conversion_rates.CAD,
        AUD: 1 / data.conversion_rates.AUD,
        EUR: 1 / data.conversion_rates.EUR,
      };

      this.cache = { rates, fetchedAt: new Date() };

      // Persist to DB for audit and fallback
      await this.prisma.exchangeRateSnapshot.create({
        data: {
          rates: rates as any,
          fetchedAt: new Date(),
        },
      });

      return rates;
    } catch (_error) {
      // On failure, try to load last known rates from DB
      const lastSnapshot = await this.prisma.exchangeRateSnapshot.findFirst({
        orderBy: { fetchedAt: 'desc' },
      });
      if (lastSnapshot) {
        const rates = lastSnapshot.rates as unknown as ExchangeRates;
        this.cache = { rates, fetchedAt: lastSnapshot.fetchedAt };
        return rates;
      }
      return this.getFallbackRates();
    }
  }

  private getFallbackRates(): ExchangeRates {
    // Approximate fallback rates (INR per 1 unit of foreign currency)
    return {
      USD: 83.5,
      GBP: 106.0,
      AED: 22.7,
      SGD: 62.5,
      CAD: 61.8,
      AUD: 54.5,
      EUR: 91.0,
    };
  }

  async convertFromInr(
    amountPaise: number,
    targetCurrency: string
  ): Promise<{
    foreignAmount: number;
    exchangeRate: number;
    disclaimer: string;
  }> {
    const rates = await this.getRates();
    const rate = rates[targetCurrency];
    if (!rate) throw new Error(`Unsupported currency: ${targetCurrency}`);

    const inrAmount = amountPaise / 100;
    const foreignAmount = inrAmount / rate;

    return {
      foreignAmount: Math.round(foreignAmount * 100) / 100,
      exchangeRate: Math.round(rate * 1000000) / 1000000,
      disclaimer:
        'Exchange rates are indicative and subject to change at payment time.',
    };
  }
}

/**
 * City Seed Data
 * Seeds primary cities for multi-tenant architecture.
 * Uses upsert on unique [cityName, state] for idempotency.
 */
import { PrismaClient } from '@prisma/client';
export declare function seedCities(prisma: PrismaClient): Promise<Record<string, string>>;
//# sourceMappingURL=cities.seed.d.ts.map
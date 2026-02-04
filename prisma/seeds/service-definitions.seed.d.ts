/**
 * Service Definitions Seed Data
 * Seeds the property legal service catalog with JSONB definition blobs.
 * Each definition includes steps, documents, fees, and SLA info.
 * Uses upsert on unique `code` for idempotency.
 */
import { PrismaClient } from '@prisma/client';
export declare function seedServiceDefinitions(prisma: PrismaClient, cityIdMap: Record<string, string>): Promise<void>;
//# sourceMappingURL=service-definitions.seed.d.ts.map